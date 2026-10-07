"""Meeting intelligence: preparation (§8) and post-meeting extraction (§9)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Commitment, Decision, Meeting, Person, Risk, Signal, User, utcnow
from ..trust import FACT, RECOMMENDATION, claim
from .text import overlap
from .views import Viewer, signal_ref

OPEN_QUESTION_RE = re.compile(r"(\?$|\b(still open|unresolved|no agreement|without agreement|come back to this|weighing)\b)", re.I)


def visible_meetings(db: Session, user: User) -> list[Meeting]:
    rows = db.scalars(select(Meeting).where(Meeting.org_id == user.org_id).order_by(Meeting.starts_at)).all()
    return [m for m in rows if user.email.lower() in {a.lower() for a in m.attendees}]


def _people(db: Session, org_id: int, emails: list[str]) -> list[dict]:
    known = {p.email.lower(): p for p in db.scalars(select(Person).where(Person.org_id == org_id)).all()}
    out = []
    for e in emails:
        p = known.get(e.lower())
        out.append({"email": e, "name": p.name if p else e, "title": p.title if p else ""})
    return out


def _context(db: Session, v: Viewer, m: Meeting) -> dict:
    org = v.user.org_id
    pid = m.project_id
    decisions = [d for d in db.scalars(select(Decision).where(Decision.org_id == org, Decision.project_id == pid)).all()
                 if pid and v.visible(d)]
    commitments = [c for c in db.scalars(select(Commitment).where(
        Commitment.org_id == org, Commitment.status.in_(["open", "proposed"]))).all()
        if v.visible(c) and ((c.project_id == pid) if pid else (c.owner_email in m.attendees))]
    risks = [r for r in db.scalars(select(Risk).where(Risk.org_id == org, Risk.status == "open", Risk.project_id == pid)).all()
             if pid and v.visible(r)]
    return {"decisions": decisions, "commitments": commitments, "risks": risks}


def prep_reasons(db: Session, v: Viewer, m: Meeting) -> list[str]:
    ctx = _context(db, v, m)
    reasons = []
    if ctx["risks"]:
        reasons.append(f"{len(ctx['risks'])} open risk{'s' * (len(ctx['risks']) != 1)}")
    pending = [d for d in ctx["decisions"] if d.status == "pending"]
    if pending:
        reasons.append(f"{len(pending)} pending decision{'s' * (len(pending) != 1)}")
    today = utcnow().date()
    overdue = [c for c in ctx["commitments"] if c.status == "open" and c.due_date and c.due_date < today]
    if overdue:
        reasons.append(f"{len(overdue)} overdue commitment{'s' * (len(overdue) != 1)}")
    return reasons


def _lc(s: str) -> str:
    return s[:1].lower() + s[1:]


def suggested_questions(v: Viewer, ctx: dict) -> list[dict]:
    qs: list[str] = []
    made = [d for d in ctx["decisions"] if d.status == "made"]
    today = utcnow().date()
    for r in ctx["risks"]:
        if r.rule == "dependency_delay" and made:
            qs.append(f"What is the recovery plan to protect the decision to {_lc(made[-1].statement)}?")
        elif r.rule == "unresolved_discussion":
            qs.append(f"What do we need in the room today to close the {v.project_name(r.project_id)} decision?")
        elif r.rule == "unowned_escalation":
            qs.append(f"Who will own “{r.title.replace('Unowned escalation: ', '')}”, and by when?")
    for d in ctx["decisions"]:
        if d.status == "pending":
            qs.append(f"Do we have what we need to decide: {_lc(d.statement)}?")
    for c in ctx["commitments"]:
        if c.status == "open" and c.due_date and c.due_date <= today + timedelta(days=1):
            qs.append(f"{c.owner_name.split()[0]}, are we still on track for “{c.description}”?")
        if c.status == "proposed":
            qs.append(f"Who should own: {_lc(c.description)}?")
    return [claim(q, RECOMMENDATION, basis="Suggested from open risks, decisions and commitments for this meeting.")
            for q in list(dict.fromkeys(qs))[:6]]


def preparation(db: Session, user: User, m: Meeting) -> dict:
    v = Viewer(db, user)
    ctx = _context(db, v, m)
    now = utcnow()
    previous = [x for x in visible_meetings(db, user)
                if x.id != m.id and x.starts_at < m.starts_at and x.starts_at < now
                and ((m.project_id and x.project_id == m.project_id) or x.title == m.title)][-5:]
    related = [s for s in db.scalars(select(Signal).where(Signal.org_id == user.org_id).order_by(Signal.occurred_at.desc())).all()
               if m.project_id and s.project_id == m.project_id and v.signal(s.id) and s.occurred_at >= now - timedelta(days=21)][:8]
    return {
        "meeting": v.meeting(m),
        "participants": _people(db, user.org_id, m.attendees),
        "prep_reasons": prep_reasons(db, v, m),
        "previous_meetings": [v.meeting(x) for x in reversed(previous)],
        "decisions": [v.decision(d) for d in ctx["decisions"]],
        "open_commitments": [v.commitment(c, now.date()) for c in ctx["commitments"]],
        "risks": [v.risk(r) for r in ctx["risks"]],
        "related_signals": [signal_ref(s) for s in related],
        "suggested_questions": suggested_questions(v, ctx),
    }


def post_meeting(db: Session, user: User, m: Meeting) -> dict:
    """What came out of a meeting: decisions, commitments, open questions, who to inform."""
    v = Viewer(db, user)
    transcripts = [s for s in db.scalars(select(Signal).where(Signal.org_id == user.org_id, Signal.meeting_id == m.id)).all()
                   if v.signal(s.id)]
    sig_ids = {s.id for s in transcripts}
    decisions = [d for d in db.scalars(select(Decision).where(Decision.org_id == user.org_id)).all()
                 if d.source_signal_id in sig_ids]
    commitments = [c for c in db.scalars(select(Commitment).where(Commitment.org_id == user.org_id)).all()
                   if c.source_signal_id in sig_ids]
    questions = []
    for s in transcripts:
        for line in s.body.splitlines():
            text = line.split(": ", 1)[-1].strip()
            if OPEN_QUESTION_RE.search(text):
                questions.append(claim(text, FACT, evidence=[signal_ref(s, text)], basis="Raised and left open in the meeting."))
    owners = {c.owner_email for c in commitments if c.owner_email}
    inform = [p for p in _people(db, user.org_id, sorted(owners)) if p["email"] not in m.attendees]
    return {
        "meeting": v.meeting(m),
        "has_transcript": bool(transcripts),
        "decisions": [v.decision(d) for d in decisions],
        "commitments": [v.commitment(c) for c in commitments],
        "open_questions": questions,
        "inform": inform,
        "deadlines": sorted({c.due_date.isoformat() for c in commitments if c.due_date}),
    }


def find_meeting(db: Session, user: User, query: str, now: datetime | None = None) -> Meeting | None:
    """Resolve 'my 2 PM meeting' / 'the product review' to a meeting."""
    now = now or utcnow()
    upcoming = [m for m in visible_meetings(db, user) if m.ends_at >= now - timedelta(hours=1)]
    if t := re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", query, re.I):
        hour = int(t.group(1)) % 12 + (12 if t.group(3).lower() == "pm" else 0)
        minute = int(t.group(2) or 0)
        for m in upcoming:
            if m.starts_at.hour == hour and m.starts_at.minute == minute:
                return m
    if re.search(r"\bnext meeting\b", query, re.I):
        nxt = [m for m in upcoming if m.starts_at >= now]
        return nxt[0] if nxt else None
    scored = sorted(upcoming, key=lambda m: overlap(m.title + " " + m.purpose, query), reverse=True)
    if scored and overlap(scored[0].title + " " + scored[0].purpose, query) > 0:
        return scored[0]
    return None
