"""Risk Radar (README §13). Deterministic, explainable rules — every risk says *why* and cites sources.

Rules are re-evaluated after every sync. A risk whose trigger no longer holds is resolved automatically.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import audit
from ..models import Commitment, Decision, Evidence, Meeting, Project, Risk, Signal, utcnow

DELAY_RE = re.compile(r"\b(delayed|slipping|slipped|blocked|behind schedule|postponed)\b", re.I)
ESCALATION_RE = re.compile(r"\bescalation\b", re.I)
NO_OWNER_RE = re.compile(r"\b(no owner|has no owner|unassigned|without an owner|not received an owner)\b", re.I)
DEPENDS_RE = re.compile(r"\bdepends on (?P<what>[^.;]+)", re.I)


def _fmt(d: datetime) -> str:
    return f"{d:%b} {d.day}"


def _snippet(text: str, pattern: re.Pattern, width: int = 140) -> str:
    m = pattern.search(text)
    if not m:
        return text[:width]
    start = max(0, text.rfind(".", 0, m.start()) + 1)
    end = text.find(".", m.end())
    return text[start: end + 1 if end != -1 else len(text)].strip()[:width]


def _confidence(signals: list[Signal]) -> str:
    """§42: high = official source; medium = multiple signals; low = single indirect signal."""
    if any(s.authority >= 0.8 for s in signals):
        return "high"
    return "medium" if len({s.channel for s in signals}) >= 2 else "low"


class _Found:
    def __init__(self, key, rule, title, explanation, level, confidence, project_id, evidence,
                 recommendation="", action=None, related=None):
        self.key, self.rule, self.title, self.explanation = key, rule, title, explanation
        self.level, self.confidence, self.project_id, self.evidence = level, confidence, project_id, evidence
        self.recommendation, self.action, self.related = recommendation, action or {}, related or {}


def _first(name: str) -> str:
    return name.split()[0] if name else "the owner"


def _next_meeting(db: Session, org_id: int, project_id: int, now: datetime) -> Meeting | None:
    return db.scalars(select(Meeting).where(Meeting.org_id == org_id, Meeting.project_id == project_id,
                                            Meeting.starts_at >= now).order_by(Meeting.starts_at)).first()


def detect(db: Session, org_id: int, now: datetime | None = None) -> int:
    now = now or utcnow()
    today = now.date()
    projects = {p.id: p for p in db.scalars(select(Project).where(Project.org_id == org_id)).all()}
    signals = db.scalars(select(Signal).where(Signal.org_id == org_id).order_by(Signal.occurred_at)).all()
    sig_by_id = {s.id: s for s in signals}
    commitments = db.scalars(select(Commitment).where(Commitment.org_id == org_id)).all()
    decisions = db.scalars(select(Decision).where(Decision.org_id == org_id)).all()
    found: list[_Found] = []

    # 1. Overdue commitments ---------------------------------------------------------------
    for c in commitments:
        if c.status == "open" and c.due_date and c.due_date < today:
            src = sig_by_id[c.source_signal_id]
            days = (today - c.due_date).days
            found.append(_Found(
                f"overdue:{c.id}", "overdue_commitment",
                f"Overdue: {c.owner_name} — {c.description}",
                f"{c.owner_name} committed to “{c.description}” in {src.title.split(' — ')[0]} ({src.channel}, "
                f"{_fmt(src.occurred_at)}). It was due {c.due_date:%b} {c.due_date.day} ({days} day{'s' * (days != 1)} ago) "
                "and no completion signal has been detected since.",
                "medium", "high" if c.kind == "explicit" else "low", c.project_id,
                [(c.source_signal_id, "commitment source")],
                recommendation=f"Ask {_first(c.owner_name)} for status and a new date for \u201c{c.description}\u201d. "
                               "ROOK can draft the follow-up for your approval.",
                action={"type": "draft_followup", "commitment_id": c.id},
                related={"commitments": [c.id], "decisions": [c.decision_id] if c.decision_id else []}))

    # 2. Dependency / delivery delay on a project with active commitments or decisions ------
    recent = [s for s in signals if s.occurred_at >= now - timedelta(days=10) and s.project_id and DELAY_RE.search(s.body)]
    by_project: dict[int, list[Signal]] = defaultdict(list)
    for s in recent:
        by_project[s.project_id].append(s)
    for pid, delay_signals in by_project.items():
        proj = projects[pid]
        decs = [d for d in decisions if d.project_id == pid and d.status == "made"]
        open_c = [c for c in commitments if c.project_id == pid and c.status == "open"]
        if not decs and not open_c:
            continue
        parts, ev = [], []
        if decs:
            d = decs[-1]
            src = sig_by_id[d.source_signal_id]
            parts.append(f"Decision {d.code} (“{d.statement}”) was made in {src.title.split(' — ')[0]} on {_fmt(src.occurred_at)}.")
            ev.append((d.source_signal_id, f"decision {d.code}"))
        dependency, dependent = "", None
        for c in open_c:
            c_ev = db.scalars(select(Evidence).where(Evidence.entity_type == "commitment", Evidence.entity_id == c.id)).all()
            chans = [sig_by_id[e.signal_id] for e in c_ev]
            trail = ", confirmed in ".join(f"{s.channel} on {_fmt(s.occurred_at)}" for s in chans)
            due = f" (due {c.due_date:%b} {c.due_date.day})" if c.due_date else ""
            parts.append(f"{c.owner_name} committed: “{c.description}”{due} — first stated in {trail}.")
            ev.extend((s.id, "commitment") for s in chans)
            for s in chans:
                if m := DEPENDS_RE.search(s.body):
                    dependency, dependent = m.group("what").strip(), c
        delays = "; ".join(f"{s.channel} ({_fmt(s.occurred_at)}): “{_snippet(s.body, DELAY_RE)}”" for s in delay_signals)
        if dependency:
            parts.append(f"It depends on {dependency}, which is now reported delayed — {delays}.")
        else:
            parts.append(f"Delay signals: {delays}.")
        ev.extend((s.id, "delay signal") for s in delay_signals)
        near_deadline = any(c.due_date and c.due_date <= today + timedelta(days=7) for c in open_c)
        level = "high" if (len(delay_signals) >= 2 or near_deadline) else "medium"
        target = dependent or (open_c[0] if open_c else None)
        protect = f" that protects {decs[-1].code} ({decs[-1].statement})" if decs else ""
        if target:
            rec = (f"Ask {_first(target.owner_name)} for a recovery plan{protect}"
                   f"{' and a confirmed date for ' + dependency if dependency else ''}. "
                   "ROOK can draft the follow-up for your approval.")
            action = {"type": "draft_followup", "commitment_id": target.id}
        else:
            rec = f"Review {decs[-1].code} with its owner: is {decs[-1].statement.lower()} still achievable?"
            action = {"type": "review_decision", "decision_id": decs[-1].id}
        found.append(_Found(f"delay:{pid}", "dependency_delay", f"{proj.name} at risk: dependency delayed",
                            " ".join(parts), level, _confidence(delay_signals), pid, ev,
                            recommendation=rec, action=action,
                            related={"commitments": [c.id for c in open_c], "decisions": [d.id for d in decs]}))

    # 3. Repeated discussion without closure ------------------------------------------------
    transcripts: dict[int, list[Signal]] = defaultdict(list)
    for s in signals:
        if s.kind == "meeting_transcript" and s.project_id:
            transcripts[s.project_id].append(s)
    for pid, ts in transcripts.items():
        if len(ts) < 3:
            continue
        span = (ts[-1].occurred_at - ts[0].occurred_at).days
        closed = any(d.project_id == pid and d.status == "made" and d.decided_at >= ts[0].occurred_at for d in decisions)
        if span < 10 or closed:
            continue
        weeks = max(1, round(span / 7))
        found.append(_Found(
            f"unresolved:{pid}", "unresolved_discussion", f"{projects[pid].name}: discussed repeatedly without a decision",
            f"{projects[pid].name} has been discussed in {len(ts)} meetings over {weeks} week{'s' * (weeks != 1)} "
            f"({', '.join(_fmt(s.occurred_at) for s in ts)}) without a recorded decision. "
            "Open items keep recurring in each transcript.",
            "high" if len(ts) >= 4 else "medium", "medium", pid, [(s.id, "meeting transcript") for s in ts],
            recommendation=(f"Time-box the {projects[pid].name} decision"
                            f"{' in ' + nxt.title + ' (' + _fmt(nxt.starts_at) + ')' if (nxt := _next_meeting(db, org_id, pid, now)) else ''}: "
                            "name a decision owner and a deadline, and list what information is still missing."),
            action={"type": "prepare_meeting", "meeting_id": nxt.id} if nxt else {"type": "schedule_decision"},
            related={"commitments": [c.id for c in commitments if c.project_id == pid and c.status in {"open", "proposed"}],
                     "decisions": []}))

    # 4. Escalations without an owner -------------------------------------------------------
    for s in signals:
        if s.occurred_at < now - timedelta(days=7) or not (ESCALATION_RE.search(s.body) and NO_OWNER_RE.search(s.body)):
            continue
        owned = any(c.project_id == s.project_id and c.created_at > s.occurred_at and c.status in {"open", "done"}
                    for c in commitments if s.project_id)
        if owned:
            continue
        found.append(_Found(
            f"unowned:{s.id}", "unowned_escalation", f"Unowned escalation: {s.title.replace('Customer escalation: ', '')}",
            f"{s.author_name} raised a customer escalation on {_fmt(s.occurred_at)} ({s.channel}) stating it has no owner. "
            "No commitment or owner has been detected since.",
            "high", "high" if s.authority >= 0.6 else "medium", s.project_id, [(s.id, "escalation")],
            recommendation=f"Assign an owner for this escalation and confirm a response time with {s.author_name}.",
            action={"type": "assign_owner", "signal_id": s.id}, related={"commitments": [], "decisions": []}))

    # Upsert + auto-resolve ------------------------------------------------------------------
    existing = {r.rule_key: r for r in db.scalars(select(Risk).where(Risk.org_id == org_id)).all()}
    seen = set()
    for f in found:
        seen.add(f.key)
        r = existing.get(f.key)
        if r is None:
            r = Risk(org_id=org_id, rule_key=f.key, detected_at=now)
            db.add(r)
            audit.record(db, org_id=org_id, actor="agent:risk", action="risk.detected", tool="risk_rules",
                         input={"rule": f.rule}, authorization="observe", result=f.title)
        elif r.status == "resolved":
            r.status = "open"
        r.rule, r.title, r.explanation, r.level = f.rule, f.title, f.explanation, f.level
        r.confidence, r.project_id = f.confidence, f.project_id
        r.recommendation, r.action, r.related = f.recommendation, f.action, f.related
        db.flush()
        db.execute(delete(Evidence).where(Evidence.entity_type == "risk", Evidence.entity_id == r.id))
        for sid, note in dict.fromkeys(f.evidence):
            db.add(Evidence(org_id=org_id, entity_type="risk", entity_id=r.id, signal_id=sid, note=note))
    for key, r in existing.items():
        if key not in seen and r.status != "resolved":
            r.status = "resolved"

    for p in projects.values():
        levels = {f.level for f in found if f.project_id == p.id}
        p.status = "at_risk" if "high" in levels else ("watch" if levels else "on_track")
    db.flush()
    return len(found)
