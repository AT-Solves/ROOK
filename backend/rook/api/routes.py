from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..ai.providers import provider_name
from ..auth import current_user, issue_token, require_admin
from ..config import settings
from ..connectors import REGISTRY, ConnectorNotConfigured, SyncBatch, get_connector_class
from ..connectors.base import NormalizedSignal
from ..db import get_db
from ..models import (
    ActionProposal, AuditLog, Commitment, Connector, Decision, Meeting, Organization, Person, Project, Risk, Signal, User, utcnow,
)
from ..services import actions as action_svc
from ..services import ask as ask_svc
from ..services import meetings as meeting_svc
from ..services.briefing import build_brief
from ..services.pipeline import ingest, sync_connector
from ..services.views import Viewer, iso, signal_ref

router = APIRouter(prefix="/api")


def _user_dict(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "title": u.title, "role": u.role, "org_id": u.org_id}


def _owned(db: Session, model, id_: int, user: User):
    row = db.get(model, id_)
    if row is None or row.org_id != user.org_id:  # tenant isolation: other orgs' rows simply don't exist
        raise HTTPException(404, "Not found")
    return row


# ---------------------------------------------------------------- auth / meta
class LoginIn(BaseModel):
    email: str


@router.get("/health")
def health():
    return {"ok": True, "llm": provider_name()}


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    if not settings.dev_login:
        raise HTTPException(403, "Dev login disabled; use SSO")
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None:
        raise HTTPException(401, "Unknown user")
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="auth.login",
                 authorization="dev login")
    db.commit()
    return {"token": issue_token(user), "user": _user_dict(user)}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    org = db.get(Organization, user.org_id)
    return {"user": _user_dict(user), "org": {"id": org.id, "name": org.name}, "llm": provider_name()}


# ---------------------------------------------------------------- brief / ask
@router.get("/brief")
def brief(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return build_brief(db, user)


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


@router.post("/ask")
def ask(body: AskIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return ask_svc.ask(db, user, body.question)


# ---------------------------------------------------------------- meetings
@router.get("/meetings")
def meetings(user: User = Depends(current_user), db: Session = Depends(get_db)):
    v, now = Viewer(db, user), utcnow()
    transcript_ids = {s.meeting_id for s in db.scalars(select(Signal).where(Signal.org_id == user.org_id, Signal.meeting_id.is_not(None)))}
    out = []
    for m in meeting_svc.visible_meetings(db, user):
        reasons = meeting_svc.prep_reasons(db, v, m) if m.ends_at >= now else []
        out.append(v.meeting(m) | {"past": m.ends_at < now, "prep_reasons": reasons, "has_transcript": m.id in transcript_ids})
    return out


def _my_meeting(db: Session, user: User, meeting_id: int) -> Meeting:
    m = _owned(db, Meeting, meeting_id, user)
    if user.email.lower() not in {a.lower() for a in m.attendees}:
        raise HTTPException(404, "Not found")
    return m


@router.get("/meetings/{meeting_id}/prep")
def meeting_prep(meeting_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return meeting_svc.preparation(db, user, _my_meeting(db, user, meeting_id))


@router.get("/meetings/{meeting_id}/intelligence")
def meeting_intel(meeting_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return meeting_svc.post_meeting(db, user, _my_meeting(db, user, meeting_id))


class TranscriptIn(BaseModel):
    text: str = Field(min_length=10, max_length=200_000)


@router.post("/meetings/{meeting_id}/transcript")
def upload_transcript(meeting_id: int, body: TranscriptIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Meeting ingestion: paste a transcript ('Name: text' lines) and ROOK extracts decisions and commitments."""
    m = _my_meeting(db, user, meeting_id)
    conn = db.scalar(select(Connector).where(Connector.org_id == user.org_id, Connector.kind == "manual"))
    if conn is None:
        conn = Connector(org_id=user.org_id, kind="manual", created_by=user.id)
        db.add(conn)
        db.flush()
    n = len(db.scalars(select(Signal.id).where(Signal.connector_id == conn.id)).all())
    sig = NormalizedSignal(
        external_id=f"upload-{m.id}-{n + 1}", kind="meeting_transcript", channel="Uploaded transcript",
        title=f"{m.title} — transcript", body=body.text, author_name=user.name, author_email=user.email,
        occurred_at=m.ends_at, participants=m.attendees, visibility="restricted", authority=0.8,
        meeting_external_id=m.external_id)
    report = ingest(db, conn, SyncBatch(signals=[sig]))
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="meeting.transcript_uploaded",
                 tool="manual", input={"meeting_id": m.id, "chars": len(body.text)}, authorization="user session",
                 result=f"decisions={report.decisions_new} commitments={report.commitments_new}")
    db.commit()
    return meeting_svc.post_meeting(db, user, m) | {"report": report.__dict__}


# ---------------------------------------------------------------- decisions / commitments / risks
@router.get("/decisions")
def decisions(status: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = Viewer(db, user)
    q = select(Decision).where(Decision.org_id == user.org_id).order_by(Decision.decided_at.desc())
    if status:
        q = q.where(Decision.status == status)
    return [v.decision(d) for d in db.scalars(q).all() if v.visible(d)]


@router.get("/commitments")
def commitments(scope: str = "all", user: User = Depends(current_user), db: Session = Depends(get_db)):
    v, today = Viewer(db, user), utcnow().date()
    rows = [v.commitment(c, today) for c in db.scalars(select(Commitment).where(Commitment.org_id == user.org_id)
                                                       .order_by(Commitment.due_date)).all() if v.visible(c)]
    if scope == "mine":
        rows = [c for c in rows if c["mine"]]
    elif scope == "waiting":
        rows = [c for c in rows if not c["mine"] and c["status"] in {"open", "overdue"}]
    elif scope == "proposed":
        rows = [c for c in rows if c["status"] == "proposed"]
    return rows


class AcceptIn(BaseModel):
    owner_name: str | None = None


def _visible_commitment(db: Session, user: User, cid: int) -> Commitment:
    c = _owned(db, Commitment, cid, user)
    if not Viewer(db, user).visible(c):
        raise HTTPException(404, "Not found")
    return c


@router.post("/commitments/{cid}/accept")
def accept_commitment(cid: int, body: AcceptIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Turn an inferred action into an assigned commitment — only with explicit human approval (§11)."""
    c = _visible_commitment(db, user, cid)
    owner_name = (body.owner_name or "").strip() or user.name
    person = db.scalar(select(Person).where(Person.org_id == user.org_id, Person.name == owner_name))
    c.owner_name, c.owner_email = owner_name, person.email if person else (user.email if owner_name == user.name else "")
    c.status, c.kind, c.confidence = "open", "explicit", "medium"
    if c.due_date is None:
        c.due_date = utcnow().date() + timedelta(days=7)
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="commitment.accepted",
                 input={"commitment_id": c.id, "owner": owner_name}, authorization="user approval", result=c.description)
    db.commit()
    return Viewer(db, user).commitment(c)


def _set_status(db: Session, user: User, cid: int, status: str, action: str):
    c = _visible_commitment(db, user, cid)
    c.status = status
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action=action,
                 input={"commitment_id": c.id}, authorization="user", result=c.description)
    from ..services import risk

    risk.detect(db, user.org_id)
    db.commit()
    return Viewer(db, user).commitment(c)


@router.post("/commitments/{cid}/dismiss")
def dismiss_commitment(cid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _set_status(db, user, cid, "dropped", "commitment.dismissed")


@router.post("/commitments/{cid}/complete")
def complete_commitment(cid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _set_status(db, user, cid, "done", "commitment.completed_manually")


class FollowupIn(BaseModel):
    tone: str = "executive"


@router.post("/commitments/{cid}/followup")
def followup(cid: int, body: FollowupIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.tone not in action_svc.TONES:
        raise HTTPException(422, f"tone must be one of {action_svc.TONES}")
    c = _visible_commitment(db, user, cid)
    return _proposal(action_svc.draft_followup(db, user, c, body.tone))


@router.get("/risks")
def risks(include_resolved: bool = False, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = Viewer(db, user)
    q = select(Risk).where(Risk.org_id == user.org_id)
    if not include_resolved:
        q = q.where(Risk.status != "resolved")
    order = {"high": 0, "medium": 1, "low": 2}
    return sorted([v.risk(r) for r in db.scalars(q).all() if v.visible(r)], key=lambda r: order[r["level"]])


@router.post("/risks/{rid}/acknowledge")
def ack_risk(rid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _owned(db, Risk, rid, user)
    r.status = "acknowledged"
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="risk.acknowledged",
                 input={"risk_id": r.id}, authorization="user", result=r.title)
    db.commit()
    return Viewer(db, user).risk(r)


# ---------------------------------------------------------------- projects / people / sources
@router.get("/projects")
def projects(user: User = Depends(current_user), db: Session = Depends(get_db)):
    out = []
    for p in db.scalars(select(Project).where(Project.org_id == user.org_id)).all():
        d = ask_svc.project_dossier(db, user, p.id)
        out.append({"id": p.id, "name": p.name, "owner": p.owner, "summary": p.summary, "status": p.status,
                    "open_risks": len(d["risks"]), "decisions": len(d["decisions"]),
                    "open_commitments": len([c for c in d["commitments"] if c["status"] in {"open", "overdue", "proposed"}]),
                    "last_activity": d["timeline"][-1]["occurred_at"] if d["timeline"] else None})
    return out


@router.get("/projects/{pid}")
def project(pid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = ask_svc.project_dossier(db, user, pid)
    if d is None:
        raise HTTPException(404, "Not found")
    return d


@router.get("/people")
def people(user: User = Depends(current_user), db: Session = Depends(get_db)):
    v, today = Viewer(db, user), utcnow().date()
    brief_people = {p["email"]: p for p in build_brief(db, user)["people"]}
    commitments = [c for c in db.scalars(select(Commitment).where(Commitment.org_id == user.org_id)).all() if v.visible(c)]
    signals = [s for s in db.scalars(select(Signal).where(Signal.org_id == user.org_id).order_by(Signal.occurred_at.desc())).all()
               if v.signal(s.id)]
    out = []
    for p in db.scalars(select(Person).where(Person.org_id == user.org_id).order_by(Person.name)).all():
        if p.email == user.email:
            continue
        recent = [signal_ref(s) for s in signals if s.author_email == p.email][:5]
        out.append({"name": p.name, "email": p.email, "title": p.title, "team": p.team,
                    "open_commitments": [v.commitment(c, today) for c in commitments if c.owner_email == p.email and c.status == "open"],
                    "recent": recent, "attention": brief_people.get(p.email)})
    return out


@router.get("/signals/{sid}")
def signal(sid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Open the original source behind an insight — only if the user could see it in the source system."""
    s = _owned(db, Signal, sid, user)
    if not Viewer(db, user).signal(s.id):
        raise HTTPException(403, "You do not have access to this source in the originating system")
    return signal_ref(s) | {"body": s.body, "participants": s.participants, "visibility": s.visibility}


@router.get("/sources")
def sources(user: User = Depends(current_user), db: Session = Depends(get_db)):
    connected = {c.kind: c for c in db.scalars(select(Connector).where(Connector.org_id == user.org_id)).all()}
    catalog = []
    for kind, cls in REGISTRY.items():
        c = connected.get(kind)
        catalog.append({
            "kind": kind, "name": cls.display_name, "category": cls.category, "phase": cls.phase,
            "credentials_present": cls.is_configured(), "required_env": list(cls.required_env), "scopes": list(cls.scopes),
            "can_send": cls.can_send,
            "connection": {"id": c.id, "status": c.status, "last_synced_at": iso(c.last_synced_at)} if c else None,
        })
    return sorted(catalog, key=lambda x: (x["phase"], x["name"]))


class ConnectIn(BaseModel):
    kind: str


@router.post("/sources")
def connect_source(body: ConnectIn, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        cls = get_connector_class(body.kind)
    except KeyError:
        raise HTTPException(404, "Unknown connector")
    conn = db.scalar(select(Connector).where(Connector.org_id == user.org_id, Connector.kind == body.kind))
    if conn is None:
        conn = Connector(org_id=user.org_id, kind=body.kind, created_by=user.id,
                         status="connected" if cls.kind in {"demo", "manual"} else "needs_configuration")
        db.add(conn)
        db.flush()
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="connector.connected",
                 tool=body.kind, authorization="admin", result=conn.status)
    db.commit()
    return {"id": conn.id, "status": conn.status}


@router.post("/sources/{cid}/sync")
def sync_source(cid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    conn = _owned(db, Connector, cid, user)
    try:
        report = sync_connector(db, conn, actor=f"user:{user.email}")
    except ConnectorNotConfigured as exc:
        raise HTTPException(409, str(exc))
    return report.__dict__


# ---------------------------------------------------------------- actions (human in the loop)
def _proposal(p: ActionProposal) -> dict:
    return {"id": p.id, "kind": p.kind, "title": p.title, "payload": p.payload, "status": p.status, "result": p.result,
            "related_type": p.related_type, "related_id": p.related_id, "created_at": iso(p.created_at)}


@router.get("/actions")
def list_actions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(ActionProposal).where(ActionProposal.org_id == user.org_id, ActionProposal.user_id == user.id)
                      .order_by(ActionProposal.created_at.desc())).all()
    return [_proposal(p) for p in rows]


class ActionEditIn(BaseModel):
    subject: str | None = None
    body: str | None = None


def _my_action(db: Session, user: User, aid: int) -> ActionProposal:
    p = _owned(db, ActionProposal, aid, user)
    if p.user_id != user.id and user.role != "admin":
        raise HTTPException(404, "Not found")
    return p


@router.patch("/actions/{aid}")
def edit_action(aid: int, body: ActionEditIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _my_action(db, user, aid)
    if p.status != "draft":
        raise HTTPException(409, "Only drafts can be edited")
    p.payload = p.payload | {k: v for k, v in body.model_dump().items() if v is not None}
    p.updated_at = utcnow()
    db.commit()
    return _proposal(p)


@router.post("/actions/{aid}/approve")
def approve_action(aid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return _proposal(action_svc.approve(db, user, _my_action(db, user, aid)))
    except action_svc.PolicyError as exc:
        raise HTTPException(409, str(exc))


@router.post("/actions/{aid}/reject")
def reject_action(aid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _proposal(action_svc.reject(db, user, _my_action(db, user, aid)))


# ---------------------------------------------------------------- admin
POLICY_VALUES = {"never", "approval", "auto"}


@router.get("/admin/policy")
def get_policy(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.get(Organization, user.org_id).ai_policy


@router.put("/admin/policy")
def put_policy(body: dict[str, str], user: User = Depends(require_admin), db: Session = Depends(get_db)):
    if any(v not in POLICY_VALUES for v in body.values()):
        raise HTTPException(422, f"values must be one of {sorted(POLICY_VALUES)}")
    org = db.get(Organization, user.org_id)
    org.ai_policy = (org.ai_policy or {}) | body
    audit.record(db, org_id=org.id, user_id=user.id, actor=f"user:{user.email}", action="policy.updated",
                 input=body, authorization="admin")
    db.commit()
    return org.ai_policy


@router.get("/audit")
def audit_log(limit: int = 200, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(AuditLog).where(AuditLog.org_id == user.org_id).order_by(AuditLog.id.desc()).limit(min(limit, 1000))
    if user.role != "admin":
        q = q.where(AuditLog.user_id == user.id)
    return [{"id": a.id, "at": iso(a.created_at), "actor": a.actor, "action": a.action, "intent": a.intent, "tool": a.tool,
             "input": a.input, "authorization": a.authorization, "result": a.result} for a in db.scalars(q).all()]
