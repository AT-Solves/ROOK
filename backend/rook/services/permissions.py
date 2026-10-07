"""Permission filtering happens *before* retrieval or display (README §26, §58.6).

A signal is visible if it is org-wide in its source system, or the user was a participant.
Derived entities inherit visibility from their source signal, so ROOK never reveals the
contents of something the user could not open in the source system.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Signal, User


def can_view(user: User, signal: Signal) -> bool:
    if signal.org_id != user.org_id:
        return False
    if signal.visibility == "org":
        return True
    return user.email.lower() in {p.lower() for p in (signal.participants or [])}


def visible_signals(db: Session, user: User) -> list[Signal]:
    rows = db.scalars(select(Signal).where(Signal.org_id == user.org_id).order_by(Signal.occurred_at.desc())).all()
    return [s for s in rows if can_view(user, s)]


def visible_signal_ids(db: Session, user: User) -> set[int]:
    return {s.id for s in visible_signals(db, user)}
