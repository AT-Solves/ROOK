"""Create the demo tenant: organisation, two users, demo connector, initial sync."""

from __future__ import annotations

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Organization, User
from .services.pipeline import connect_demo, sync_connector

DEFAULT_POLICY = {
    # §19 Observe / Recommend / Prepare / Execute — what ROOK may execute and under which control.
    "send_email": "approval",
    "send_message": "approval",
    "create_task": "approval",
    "delete_data": "never",
    "modify_business_system": "never",
}


def ensure_demo_tenant(db: Session, sync: bool = True, timezone: str | None = None) -> Organization:
    """Demo tenant. Its users and its meeting times share one time zone: `timezone`, else
    ROOK_DEMO_TIMEZONE, else UTC — so the synthetic agenda falls in that zone's working hours."""
    org = db.scalar(select(Organization).where(Organization.slug == "acme"))
    tz = timezone or os.environ.get("ROOK_DEMO_TIMEZONE") or "UTC"
    if org is None:
        org = Organization(name="Acme Robotics", slug="acme", ai_policy=dict(DEFAULT_POLICY))
        db.add(org)
        db.flush()
        db.add_all([
            User(org_id=org.id, email="yamini@acme.example", name="Yamini Devasena",
                 title="Chief Executive Officer", role="admin", timezone=tz),
            User(org_id=org.id, email="marcus@acme.example", name="Marcus Chen", title="VP Engineering", role="member",
                 timezone=tz),
        ])
        db.flush()
        connect_demo(db, org.id).config = {"timezone": tz}
        db.commit()
        if sync:
            for c in org_connectors(db, org.id):
                sync_connector(db, c, actor="system:bootstrap")
    return org


def org_connectors(db: Session, org_id: int):
    from .models import Connector

    return db.scalars(select(Connector).where(Connector.org_id == org_id)).all()
