"""Serialisers that apply permission filtering and attach provenance to every insight (§18, §43)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Commitment, Decision, Evidence, Meeting, Project, Risk, Signal, User
from .permissions import can_view


def iso(v: datetime | date | None) -> str | None:
    return v.isoformat() if v else None


def signal_ref(s: Signal, quote: str = "", note: str = "") -> dict:
    return {
        "signal_id": s.id, "kind": s.kind, "channel": s.channel, "title": s.title, "author": s.author_name,
        "occurred_at": iso(s.occurred_at), "quote": quote, "note": note, "url": s.url, "authority": s.authority,
    }


class Viewer:
    """Per-request helper bound to a user; caches signals and enforces visibility."""

    def __init__(self, db: Session, user: User):
        self.db, self.user = db, user
        self._signals = {s.id: s for s in db.scalars(select(Signal).where(Signal.org_id == user.org_id)).all()}
        self._projects = {p.id: p for p in db.scalars(select(Project).where(Project.org_id == user.org_id)).all()}

    # -- visibility ---------------------------------------------------------------------
    def signal(self, signal_id: int) -> Signal | None:
        s = self._signals.get(signal_id)
        return s if s and can_view(self.user, s) else None

    def visible(self, entity) -> bool:
        if isinstance(entity, Risk):
            return bool(self.evidence("risk", entity.id))
        return self.signal(entity.source_signal_id) is not None

    def evidence(self, entity_type: str, entity_id: int) -> list[dict]:
        rows = self.db.scalars(select(Evidence).where(
            Evidence.org_id == self.user.org_id, Evidence.entity_type == entity_type, Evidence.entity_id == entity_id)).all()
        out = []
        for e in rows:
            if s := self.signal(e.signal_id):
                out.append(signal_ref(s, e.quote, e.note))
        return sorted(out, key=lambda x: x["occurred_at"] or "")

    def project_name(self, pid: int | None) -> str | None:
        return self._projects[pid].name if pid in self._projects else None

    def is_me(self, name: str, email: str = "") -> bool:
        return (email and email.lower() == self.user.email.lower()) or name.lower() == self.user.name.lower()

    # -- entities -----------------------------------------------------------------------
    def decision(self, d: Decision) -> dict:
        return {
            "id": d.id, "code": d.code, "statement": d.statement, "owner": d.owner, "rationale": d.rationale,
            "status": d.status, "confidence": d.confidence, "decided_at": iso(d.decided_at),
            "project_id": d.project_id, "project": self.project_name(d.project_id), "meeting_id": d.meeting_id,
            "needs_me": d.status == "pending" and self.is_me(d.owner),
            "evidence": self.evidence("decision", d.id),
        }

    def commitment(self, c: Commitment, today: date | None = None) -> dict:
        today = today or date.today()
        overdue = c.status == "open" and c.due_date is not None and c.due_date < today
        return {
            "id": c.id, "owner": c.owner_name, "owner_email": c.owner_email, "description": c.description,
            "due_date": iso(c.due_date), "kind": c.kind, "status": "overdue" if overdue else c.status,
            "confidence": c.confidence, "project_id": c.project_id, "project": self.project_name(c.project_id),
            "mine": self.is_me(c.owner_name, c.owner_email), "evidence": self.evidence("commitment", c.id),
        }

    def risk(self, r: Risk) -> dict:
        return {
            "id": r.id, "title": r.title, "explanation": r.explanation, "level": r.level, "confidence": r.confidence,
            "status": r.status, "rule": r.rule, "project_id": r.project_id, "project": self.project_name(r.project_id),
            "detected_at": iso(r.detected_at), "evidence": self.evidence("risk", r.id),
        }

    def meeting(self, m: Meeting) -> dict:
        return {
            "id": m.id, "title": m.title, "purpose": m.purpose, "starts_at": iso(m.starts_at), "ends_at": iso(m.ends_at),
            "attendees": m.attendees, "organizer": m.organizer, "project_id": m.project_id,
            "project": self.project_name(m.project_id),
        }
