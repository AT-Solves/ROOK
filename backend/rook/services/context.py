"""Context Control Center (M3.5 P0-2/P0-3): what ROOK is connected to, with which permissions, how fresh it is,
and how complete the user's context is.

Everything here is derived from real state — connector rows, stored OAuth grants, the latest sync outcome, and
items *this user can see*. Nothing is hard-coded, and counts never include items the user cannot open.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..connectors import REGISTRY
from ..models import Connector, ConnectorCredential, Signal, User, utcnow
from ..trust import FACT, INFERENCE
from .meetings import visible_meetings
from .permissions import can_view
from .views import iso

# Context types in the order users think about them, with plain-language names.
CONTEXT_TYPES = {
    "meetings": "Meetings",
    "conversations": "Conversations",
    "transcripts": "Meeting transcripts",
    "work_items": "Work items",
    "documents": "Documents",
}
SIGNAL_CONTEXT = {"email": "conversations", "message": "conversations", "meeting_transcript": "transcripts",
                  "task_update": "work_items", "document": "documents"}

# What each OAuth permission lets ROOK do, in words (Microsoft Graph delegated scopes; read-only unless stated).
SCOPE_LABELS = {
    "openid": "Sign you in",
    "profile": "Read your basic profile",
    "email": "Read your email address",
    "offline_access": "Stay connected without asking you to sign in again",
    "User.Read": "Read your basic profile",
    "Mail.Read": "Read your mail",
    "Calendars.Read": "Read your calendar",
    "OnlineMeetings.Read": "Read your Teams meeting details",
    "OnlineMeetingTranscript.Read.All": "Read Teams meeting transcripts you can access (admin consent)",
    "Mail.Send": "Send mail — only messages you approve",
}

STALE_AFTER = timedelta(hours=24)


def _parse(ts: str | None) -> datetime | None:
    return datetime.fromisoformat(ts.rstrip("Z")) if ts else None


def _visible_counts(db: Session, user: User, connector_id: int | None = None) -> Counter:
    q = select(Signal).where(Signal.org_id == user.org_id)
    if connector_id is not None:
        q = q.where(Signal.connector_id == connector_id)
    counts: Counter = Counter()
    for s in db.scalars(q).all():
        if can_view(user, s):
            counts[SIGNAL_CONTEXT.get(s.kind, "conversations")] += 1
    meetings = [m for m in visible_meetings(db, user) if connector_id is None or m.connector_id == connector_id]
    counts["meetings"] += len(meetings)
    return counts


def _connection(db: Session, user: User, conn: Connector, cls) -> dict:
    cred = db.scalar(select(ConnectorCredential).where(ConnectorCredential.connector_id == conn.id))
    granted = sorted(set(cred.scopes.split())) if cred and cred.scopes else []
    owner = db.get(User, conn.created_by) if conn.created_by else None
    last = (conn.config or {}).get("last_sync")
    counts = _visible_counts(db, user, conn.id)
    return {
        "id": conn.id,
        "status": conn.status,
        "account": owner.email if cls.delegated and owner else ("Synthetic demo organisation" if cls.synthetic else "Your organization"),
        "last_successful_sync": iso(conn.last_synced_at),
        "last_sync": last,
        "granted_permissions": [{"scope": s, "label": SCOPE_LABELS.get(s, s)} for s in granted],
        "visible_items": {k: counts.get(k, 0) for k in CONTEXT_TYPES},
    }


def sources(db: Session, user: User) -> list[dict]:
    rows = db.scalars(select(Connector).where(Connector.org_id == user.org_id)).all()
    out = []
    for kind, cls in REGISTRY.items():
        # Delegated connectors are per user: show only the caller's own connection.
        conn = next((r for r in rows if r.kind == kind and (not cls.delegated or r.created_by == user.id)), None)
        if kind == "manual" and conn is None:
            continue  # uploads appear once something has been uploaded
        connected = conn is not None and conn.status != "disconnected"
        out.append({
            "kind": kind,
            "name": cls.display_name,
            "category": cls.category,
            "implemented": cls.implemented,
            "synthetic": cls.synthetic,
            "delegated": cls.delegated,
            "connectable": cls.implemented and cls.delegated and cls.is_configured(),
            "setup_required": cls.implemented and cls.delegated and not cls.is_configured(),
            "data_types": [{"type": t, "label": label} for t, label in cls.data_types],
            "requested_permissions": [{"scope": s, "label": SCOPE_LABELS.get(s, s)} for s in cls.scopes],
            "sending": "enabled — only messages you approve" if cls.sending_enabled() and cls.can_send else "off",
            "state": "connected" if connected else ("available" if cls.implemented else "later"),
            "connection": _connection(db, user, conn, cls) if conn is not None else None,
        })
    order = {"connected": 0, "available": 1, "later": 2}
    return sorted(out, key=lambda s: (order[s["state"]], s["name"]))


def health(db: Session, user: User, srcs: list[dict], now: datetime | None = None) -> dict:
    """Context health from real state. Every statement is either a FACT (a count or a sync outcome) or the overall
    INFERENCE; the reasons are always returned so the UI can explain the state."""
    now = now or utcnow()
    connected = [s for s in srcs if s["state"] == "connected" and s["kind"] != "manual"]
    totals = _visible_counts(db, user)
    present = [t for t in CONTEXT_TYPES if totals.get(t, 0) > 0]
    missing = [t for t in CONTEXT_TYPES if t not in present]
    reasons: list[dict] = []

    if not connected:
        return {"state": "not_connected", "label": "Not connected", "claim_type": INFERENCE,
                "summary": "ROOK has no connected sources yet, so it cannot build context.",
                "reasons": [{"text": "No source is connected.", "claim_type": FACT}],
                "coverage": {t: totals.get(t, 0) for t in CONTEXT_TYPES}, "synthetic": False}

    for t in present:
        reasons.append({"text": f"{CONTEXT_TYPES[t]}: {totals[t]} you can access.", "claim_type": FACT})
    for t in missing:
        reasons.append({"text": f"No {CONTEXT_TYPES[t].lower()} are available to ROOK yet.", "claim_type": FACT})

    problems = []
    for s in connected:
        c = s["connection"]
        if c["status"] in ("needs_reauth", "needs_configuration"):
            problems.append(f"{s['name']} needs attention ({c['status'].replace('_', ' ')}).")
        last_ok = _parse(c["last_successful_sync"])
        if last_ok is None:
            problems.append(f"{s['name']} has not completed a sync yet.")
        elif now - last_ok > STALE_AFTER:
            problems.append(f"{s['name']} was last synchronized more than 24 hours ago.")
        for w in (c.get("last_sync") or {}).get("warnings", []):
            problems.append(f"{s['name']}: {w}")
    reasons += [{"text": p, "claim_type": FACT} for p in problems]

    core = {"meetings", "conversations"}
    if core <= set(present) and "transcripts" in present and ({"work_items", "documents"} & set(present)) and not problems:
        state, label, summary = "strong", "Strong context", \
            "ROOK can see your meetings, conversations, meeting transcripts and work artifacts, and every source is current."
    elif core <= set(present):
        state, label, summary = "partial", "Partial context", \
            "ROOK can see your meetings and conversations, but some context is missing or out of date."
    else:
        state, label, summary = "limited", "Limited context", \
            "ROOK can see only part of your work, so its briefings may miss related conversations or meetings."
    synthetic = any(s["synthetic"] for s in connected)
    return {"state": state, "label": label, "claim_type": INFERENCE, "summary": summary, "reasons": reasons,
            "coverage": {t: totals.get(t, 0) for t in CONTEXT_TYPES}, "synthetic": synthetic}


def context_overview(db: Session, user: User) -> dict:
    srcs = sources(db, user)
    return {"health": health(db, user, srcs), "sources": srcs, "context_types": CONTEXT_TYPES}

