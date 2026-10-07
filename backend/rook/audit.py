from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .models import AuditLog


def record(
    db: Session,
    *,
    org_id: int,
    actor: str,
    action: str,
    user_id: int | None = None,
    intent: str = "",
    tool: str = "",
    input: dict[str, Any] | None = None,
    authorization: str = "",
    result: str = "",
) -> AuditLog:
    entry = AuditLog(
        org_id=org_id,
        user_id=user_id,
        actor=actor,
        action=action,
        intent=intent,
        tool=tool,
        input=input or {},
        authorization=authorization,
        result=result[:2000],
    )
    db.add(entry)
    return entry
