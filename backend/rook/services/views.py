"""Serialisers that apply permission filtering and attach provenance + claim type to every insight
(README §18, §43; PRD §7). Nothing leaves the API about a source the viewer cannot open.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Commitment, Decision, Evidence, Meeting, Person, Project, Risk, Signal, User
from ..trust import FACT, INFERENCE, RECOMMENDATION, UNKNOWN
from .permissions import can_view


def iso(v: datetime | date | None) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat() + "Z"  # stored as naive UTC
    return v.isoformat()


def signal_ref(s: Signal, quote: str = "", note: str = "") -> dict:
    return {
        "signal_id": s.id, "kind": s.kind, "channel": s.channel, "title": s.title, "author": s.author_name,
        "occurred_at": iso(s.occurred_at), "quote": quote, "note": note, "url": s.url, "authority": s.authority,
    }


def _source_label(s: Signal) -> str:
    return f"{s.title.split(' — ')[0]} ({s.channel}, {s.occurred_at:%b} {s.occurred_at.day})"


class Viewer:
    """Per-request helper bound to a user; caches signals and enforces visibility."""

    def __init__(self, db: Session, user: User):
        self.db, self.user = db, user
        self._signals = {s.id: s for s in db.scalars(select(Signal).where(Signal.org_id == user.org_id)).all()}
        self._projects = {p.id: p for p in db.scalars(select(Project).where(Project.org_id == user.org_id)).all()}
        self._people = {p.email.lower(): p for p in db.scalars(select(Person).where(Person.org_id == user.org_id)).all()}

    # -- visibility ---------------------------------------------------------------------
    def signal(self, signal_id: int | None) -> Signal | None:
        s = self._signals.get(signal_id) if signal_id else None
        return s if s and can_view(self.user, s) else None

    def visible(self, entity) -> bool:
        if isinstance(entity, Risk):
            return bool(self.evidence("risk", entity.id))
        return self.signal(entity.source_signal_id) is not None

    def evidence(self, entity_type: str, entity_id: int) -> list[dict]:
        rows = self.db.scalars(select(Evidence).where(
            Evidence.org_id == self.user.org_id, Evidence.entity_type == entity_type, Evidence.entity_id == entity_id)).all()
        out, seen = [], set()
        for e in rows:
            if (s := self.signal(e.signal_id)) and (e.signal_id, e.note) not in seen:
                seen.add((e.signal_id, e.note))
                out.append(signal_ref(s, e.quote, e.note))
        return sorted(out, key=lambda x: x["occurred_at"] or "")

    def project_name(self, pid: int | None) -> str | None:
        return self._projects[pid].name if pid in self._projects else None

    def person_name(self, email: str) -> str:
        p = self._people.get(email.lower())
        return p.name if p else email

    def is_me(self, name: str, email: str = "") -> bool:
        return bool(email and email.lower() == self.user.email.lower()) or name.lower() == self.user.name.lower()

    # -- entities -----------------------------------------------------------------------
    def decision(self, d: Decision) -> dict:
        src = self.signal(d.source_signal_id)
        related = [c for c in self.db.scalars(select(Commitment).where(
            Commitment.org_id == self.user.org_id, Commitment.decision_id == d.id)).all() if self.visible(c)]
        evidence = self.evidence("decision", d.id)
        return {
            "id": d.id, "code": d.code, "statement": d.statement, "owner": d.owner, "rationale": d.rationale,
            "status": d.status, "confidence": d.confidence, "decided_at": iso(d.decided_at),
            "project_id": d.project_id, "project": self.project_name(d.project_id), "meeting_id": d.meeting_id,
            "participants": [self.person_name(e) for e in d.participants or []],
            "context": _source_label(src) if src else "",
            "needs_me": d.status == "pending" and self.is_me(d.owner),
            # A decision is only registered when it is explicitly stated, so it is a FACT about the source.
            "claim_type": FACT if evidence else UNKNOWN,
            "basis": (f"{'Stated' if d.status == 'made' else 'Raised as pending'} by {d.owner or 'participant'} in "
                      f"{_source_label(src)}") if src else "",
            "related_commitments": [{"id": c.id, "owner": c.owner_name, "description": c.description,
                                     "status": c.status} for c in related],
            "evidence": evidence,
        }

    def commitment(self, c: Commitment, today: date | None = None) -> dict:
        today = today or date.today()
        overdue = c.status == "open" and c.due_date is not None and c.due_date < today
        evidence = self.evidence("commitment", c.id)
        src = self.signal(c.source_signal_id)
        dec = self.db.get(Decision, c.decision_id) if c.decision_id else None
        related_decision = None
        if dec and self.visible(dec):
            related_decision = {"id": dec.id, "code": dec.code, "statement": dec.statement, "basis": c.decision_link_basis,
                                "claim_type": FACT if c.decision_link_type == "fact" else INFERENCE}
        if c.status == "done":
            status_basis = "Completion detected in a later source." if c.completed_signal_id else "Marked done by a user."
            status_type = INFERENCE if c.completed_signal_id else FACT
        elif overdue:
            status_basis, status_type = "Past its due date and no completion signal has been detected.", INFERENCE
        else:
            status_basis, status_type = "", FACT
        return {
            "id": c.id, "owner": c.owner_name, "owner_email": c.owner_email, "description": c.description,
            "due_date": iso(c.due_date), "kind": c.kind, "status": "overdue" if overdue else c.status,
            "confidence": c.confidence, "project_id": c.project_id, "project": self.project_name(c.project_id),
            "mine": self.is_me(c.owner_name, c.owner_email),
            # Explicit "I will…" statements are facts about the source; "someone should…" is ROOK's inference.
            "claim_type": (FACT if c.kind == "explicit" else INFERENCE) if evidence else UNKNOWN,
            "basis": (f"{'Stated' if c.kind == 'explicit' else 'Inferred from'} "
                      f"{'by ' + c.owner_name + ' in ' if c.kind == 'explicit' else ''}{_source_label(src)}") if src else "",
            "status_claim_type": status_type, "status_basis": status_basis,
            "related_decision": related_decision,
            "evidence": evidence,
        }

    def risk(self, r: Risk) -> dict:
        evidence = self.evidence("risk", r.id)
        return {
            "id": r.id, "title": r.title, "explanation": r.explanation, "level": r.level, "confidence": r.confidence,
            "status": r.status, "rule": r.rule, "project_id": r.project_id, "project": self.project_name(r.project_id),
            "detected_at": iso(r.detected_at),
            "claim_type": INFERENCE if evidence else UNKNOWN,  # risks are always ROOK's derivation
            "basis": f"Detected by rule '{r.rule}' from {len(evidence)} source(s).",
            "recommended_action": {"text": r.recommendation, "claim_type": RECOMMENDATION, "action": r.action or {}}
            if r.recommendation else None,
            "related": r.related or {},
            "evidence": evidence,
        }

    def meeting(self, m: Meeting) -> dict:
        return {
            "id": m.id, "title": m.title, "purpose": m.purpose, "starts_at": iso(m.starts_at), "ends_at": iso(m.ends_at),
            "attendees": m.attendees, "organizer": m.organizer, "project_id": m.project_id,
            "project": self.project_name(m.project_id),
        }
