"""Ask ROOK (README §17, §48, §51).

Pipeline: permission-filtered retrieval -> structured context assembly -> (optional) LLM narrative
-> evidence validation. Structured answers are produced deterministically, so ROOK can answer common
leadership questions without any model and never presents an uncited claim.
"""

from __future__ import annotations

import re
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..ai.providers import LLMError, get_provider
from ..models import Commitment, Decision, Project, Risk, Signal, User, utcnow
from .briefing import build_brief
from .meetings import find_meeting, preparation
from .permissions import visible_signals
from .text import tokens
from .views import Viewer, signal_ref

NO_EVIDENCE = "I couldn't find enough evidence to answer this confidently."


def _section(title: str, items: list[dict]) -> dict:
    return {"title": title, "items": items}


def _ci(c: dict) -> dict:
    due = f" · due {c['due_date']}" if c["due_date"] else ""
    return {"text": f"{c['owner']}: {c['description']}", "meta": f"{c['status']}{due}", "evidence": c["evidence"]}


def _di(d: dict) -> dict:
    return {"text": f"{d['code']} · {d['statement']}", "meta": f"{d['status']} · {d['owner']}", "evidence": d["evidence"]}


def _ri(r: dict) -> dict:
    return {"text": r["title"], "meta": f"{r['level']} risk · {r['confidence']} confidence", "detail": r["explanation"],
            "evidence": r["evidence"]}


def _match_project(db: Session, org_id: int, q: str) -> Project | None:
    ql = q.lower()
    best, hits = None, 0
    for p in db.scalars(select(Project).where(Project.org_id == org_id)).all():
        n = sum(1 for k in [p.name.lower(), *p.aliases] if k in ql) + len(tokens(p.name) & tokens(q))
        if n > hits:
            best, hits = p, n
    return best


def _dossier(db: Session, v: Viewer, p: Project) -> dict:
    org = v.user.org_id
    decisions = [v.decision(d) for d in db.scalars(select(Decision).where(Decision.org_id == org, Decision.project_id == p.id)).all() if v.visible(d)]
    commitments = [v.commitment(c) for c in db.scalars(select(Commitment).where(Commitment.org_id == org, Commitment.project_id == p.id)).all() if v.visible(c)]
    risks = [v.risk(r) for r in db.scalars(select(Risk).where(Risk.org_id == org, Risk.project_id == p.id, Risk.status == "open")).all() if v.visible(r)]
    timeline = [signal_ref(s) | {"summary": s.body.split("\n")[0][:200]}
                for s in db.scalars(select(Signal).where(Signal.org_id == org, Signal.project_id == p.id).order_by(Signal.occurred_at)).all()
                if v.signal(s.id)]
    return {"project": {"id": p.id, "name": p.name, "owner": p.owner, "summary": p.summary, "status": p.status},
            "decisions": decisions, "commitments": commitments, "risks": risks, "timeline": timeline}


def project_dossier(db: Session, user: User, project_id: int) -> dict | None:
    p = db.get(Project, project_id)
    if not p or p.org_id != user.org_id:
        return None
    return _dossier(db, Viewer(db, user), p)


def _collect_sources(sections: list[dict]) -> list[dict]:
    seen, out = set(), []
    for sec in sections:
        for it in sec["items"]:
            for e in it.get("evidence", []):
                if e["signal_id"] not in seen:
                    seen.add(e["signal_id"])
                    out.append(e)
    return out


def _structured(db: Session, user: User, q: str) -> dict | None:
    v = Viewer(db, user)
    ql = q.lower()
    brief = build_brief(db, user)

    if re.search(r"\b(what changed|since yesterday|what's new|what is new|recent changes)\b", ql):
        items = [{"text": f"{c['channel']}: {c['summary']}", "meta": ", ".join(c["derived"]) or c["author"],
                  "evidence": [c]} for c in brief["changes"]]
        return {"intent": "changes", "answer": f"{len(items)} meaningful changes in the last 36 hours.",
                "sections": [_section("Changes", items)]}

    if re.search(r"\bwaiting (for|on)\b", ql):
        items = [_ci(c) for c in brief["waiting_for"]]
        return {"intent": "waiting_for", "answer": f"You are waiting on {len(items)} commitments from others.",
                "sections": [_section("Waiting for", items)]}

    if re.search(r"\b(pending decisions?|decisions? (are )?pending|decisions? (do i|i) need)\b", ql):
        items = [_di(d) for d in brief["decisions_pending"]]
        mine = sum(1 for d in brief["decisions_pending"] if d["needs_me"])
        return {"intent": "decisions_pending", "answer": f"{len(items)} decision(s) pending; {mine} need you.",
                "sections": [_section("Pending decisions", items)]}

    if "overdue" in ql:
        today = utcnow().date()
        rows = [v.commitment(c, today) for c in db.scalars(select(Commitment).where(Commitment.org_id == user.org_id)).all() if v.visible(c)]
        items = [_ci(c) for c in rows if c["status"] == "overdue"]
        return {"intent": "overdue", "answer": f"{len(items)} commitment(s) are overdue.", "sections": [_section("Overdue", items)]}

    if re.search(r"\b(prepare|prep|brief me)\b.*\bmeeting\b|\bmeeting\b.*\b(prepare|prep)\b|\bprepare me for\b", ql):
        m = find_meeting(db, user, q)
        if not m:
            return {"intent": "meeting_prep", "answer": "I couldn't identify which meeting you mean. Try its time or title.",
                    "sections": [], "final": True}
        prep = preparation(db, user, m)
        secs = [
            _section("Previous decisions", [_di(d) for d in prep["decisions"]]),
            _section("Open actions", [_ci(c) for c in prep["open_commitments"]]),
            _section("Known risks", [_ri(r) for r in prep["risks"]]),
            _section("Suggested questions", [{"text": s, "evidence": []} for s in prep["suggested_questions"]]),
        ]
        start = prep["meeting"]["starts_at"][11:16]
        return {"intent": "meeting_prep", "answer": f"Before your {start} {m.title}: " + (
            "; ".join(prep["prep_reasons"]) or "no open risks or pending decisions."),
            "sections": [s for s in secs if s["items"]], "meeting_id": m.id}

    if re.search(r"\b(focus|attention|what do i need|what should i)\b", ql):
        items = [{"text": f"{a['label']}: {a['title']}", "meta": f"{a['level']} · {a['confidence']} confidence",
                  "detail": a["why"], "evidence": _attention_evidence(v, a)} for a in brief["attention"]]
        return {"intent": "attention", "answer": " ".join(brief["headline"][:1]), "sections": [_section("Needs you", items)]}

    project = _match_project(db, user.org_id, q) or _project_from_retrieval(db, user, q)
    if m := re.search(r"\bwhy is (.+?) at risk\b", ql):
        if project:
            d = _dossier(db, v, project)
            items = [_ri(r) for r in d["risks"]]
            ans = f"{project.name} has {len(items)} open risk(s)." if items else f"I found no open risks for {project.name}."
            return {"intent": "why_risk", "answer": ans, "sections": [_section("Why", items)]}

    if re.search(r"\b(what did we decide|decided|decision)\b", ql):
        rows = [d for d in db.scalars(select(Decision).where(Decision.org_id == user.org_id)).all() if v.visible(d)]
        qt = tokens(q) - {"decide", "decided", "decision", "decisions"}
        scored = [(len(qt & tokens(d.statement + " " + (v.project_name(d.project_id) or ""))), d) for d in rows]
        hits = [v.decision(d) for n, d in sorted(scored, key=lambda x: -x[0]) if n > 0]
        if hits:
            return {"intent": "decision_lookup", "answer": hits[0]["statement"] + (f" — {hits[0]['rationale']}" if hits[0]["rationale"] else ""),
                    "sections": [_section("Decisions", [_di(d) for d in hits])]}

    if re.search(r"\bwho owns\b", ql):
        rows = [c for c in db.scalars(select(Commitment).where(Commitment.org_id == user.org_id)).all() if v.visible(c)]
        qt = tokens(q) - {"owns"}
        hits = [v.commitment(c) for c in rows if len(qt & tokens(c.description)) >= 1]
        if hits:
            return {"intent": "owner_lookup", "answer": f"{hits[0]['owner']} owns “{hits[0]['description']}”.",
                    "sections": [_section("Owners", [_ci(c) for c in hits])]}

    if project and re.search(r"\b(happened|everything|related|status|update|tell me about|show me)\b", ql):
        d = _dossier(db, v, project)
        secs = [
            _section("Timeline", [{"text": f"{t['occurred_at'][:10]} · {t['channel']}: {t['summary']}", "evidence": [t]} for t in d["timeline"]]),
            _section("Decisions", [_di(x) for x in d["decisions"]]),
            _section("Commitments", [_ci(x) for x in d["commitments"]]),
            _section("Risks", [_ri(x) for x in d["risks"]]),
        ]
        status = {"at_risk": "at risk", "watch": "being watched", "on_track": "on track"}.get(project.status, project.status)
        return {"intent": "project", "answer": f"{project.name} is {status}. {project.summary}",
                "sections": [s for s in secs if s["items"]], "project_id": project.id}
    return None


def _project_from_retrieval(db: Session, user: User, q: str) -> Project | None:
    """Graph hop: when the question names no project, use the project of the best-matching sources."""
    counts: dict[int, int] = {}
    for s in _retrieve(db, user, q, k=3):
        if s.project_id:
            counts[s.project_id] = counts.get(s.project_id, 0) + 1
    return db.get(Project, max(counts, key=counts.get)) if counts else None


def _attention_evidence(v: Viewer, a: dict) -> list[dict]:
    kind = {"risk": "risk", "decision": "decision", "commitment": "commitment"}[a["type"]]
    return v.evidence(kind, a["id"])


def _retrieve(db: Session, user: User, q: str, k: int = 6) -> list[Signal]:
    """Hybrid-lite retrieval: keyword overlap weighted by source authority and recency (§29, §31).

    Permission filtering is applied first, so restricted content is never a retrieval candidate.
    """
    qt = tokens(q)
    if not qt:
        return []
    now = utcnow()
    scored = []
    for s in visible_signals(db, user):
        overlap = len(qt & tokens(s.title + " " + s.body))
        if overlap == 0:
            continue
        recency = max(0.0, 1 - (now - s.occurred_at).days / 60)
        scored.append((overlap + 0.5 * s.authority + 0.5 * recency, s))
    return [s for _, s in sorted(scored, key=lambda x: -x[0])[:k]]


def _llm_narrative(q: str, context: str, valid_ids: set[int]) -> tuple[str, str] | None:
    provider = get_provider()
    if not provider:
        return None
    system = ("You are ROOK, an AI Chief of Staff. Answer concisely like an excellent human chief of staff. "
              "Use ONLY the provided sources. Cite sources inline as [S<id>]. If the sources do not support an "
              f"answer, reply exactly: {NO_EVIDENCE}")
    try:
        text = provider.complete(system, f"Question: {q}\n\nSources:\n{context}", max_tokens=600)
    except LLMError:
        return None
    cited = {int(x) for x in re.findall(r"\[S(\d+)\]", text)}
    if NO_EVIDENCE in text:
        return NO_EVIDENCE, "low"
    if not cited or not cited <= valid_ids:  # evidence validation: every citation must be a real, visible source
        return None
    return text.strip(), "medium" if len(cited) >= 2 else "low"


def ask(db: Session, user: User, question: str) -> dict:
    q = question.strip()
    result = _structured(db, user, q)
    engine = "structured"
    if result is None or (not result.pop("final", False) and not any(s["items"] for s in result["sections"])):
        hits = _retrieve(db, user, q)
        if not hits:
            result = {"intent": "search", "answer": NO_EVIDENCE, "sections": [], "confidence": "low"}
        else:
            evidence = [signal_ref(s) | {"summary": s.body[:240]} for s in hits]
            result = {"intent": "search", "answer": "Here is what I found in your connected sources.",
                      "sections": [_section("Relevant sources", [{"text": f"{e['channel']} · {e['title']}", "detail": e["summary"],
                                                                 "evidence": [e]} for e in evidence])],
                      "confidence": "low"}
            ctx = "\n".join(f"[S{s.id}] {s.occurred_at:%Y-%m-%d} {s.channel} — {s.author_name}: {s.title}\n{s.body}" for s in hits)
            if llm := _llm_narrative(q, ctx, {s.id for s in hits}):
                result["answer"], result["confidence"] = llm
                engine = "llm"
    result.setdefault("confidence", "high" if result["sections"] else "low")
    result["sources"] = _collect_sources(result["sections"])
    result["engine"] = engine
    result["question"] = q
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="ask",
                 intent=q[:300], tool="ask_rook", authorization="user session",
                 result=f"intent={result['intent']} sources={len(result['sources'])}")
    db.commit()
    return result
