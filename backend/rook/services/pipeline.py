"""Knowledge pipeline (README §30): ingest -> normalise -> link -> extract -> track -> detect risk.

Each stage emits an audit record so the processing that produced any insight is reviewable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import audit
from ..ai.extraction import Extraction, get_extractor
from ..connectors import (
    BaseConnector,
    ConnectorAuthError,
    ConnectorContext,
    ConnectorNotConfigured,
    SyncBatch,
    get_connector_class,
)
from ..models import (
    Commitment,
    Connector,
    Decision,
    Evidence,
    Meeting,
    Person,
    Project,
    Signal,
    User,
    utcnow,
)
from . import risk
from .text import first_name, jaccard, overlap

log = logging.getLogger(__name__)


@dataclass
class SyncReport:
    signals_new: int = 0
    meetings_upserted: int = 0
    decisions_new: int = 0
    commitments_new: int = 0
    commitments_completed: int = 0
    evidence_linked: int = 0
    risks_open: int = 0
    engine: str = "rules"
    events: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def connector_instance(db: Session, connector: Connector) -> BaseConnector:
    """Instantiate a connector with its runtime context (owner, delegated token access)."""
    cls = get_connector_class(connector.kind)
    ctx = ConnectorContext()
    if cls.delegated:
        owner = db.get(User, connector.created_by) if connector.created_by else None
        ctx.owner_email = owner.email if owner else ""
        from ..identity.service import access_token_getter

        ctx.get_access_token = access_token_getter(db, connector)
    return cls(connector.config, ctx)


def sync_connector(db: Session, connector: Connector, actor: str = "system") -> SyncReport:
    instance = connector_instance(db, connector)
    try:
        batch = instance.sync(connector.last_synced_at)
    except (ConnectorNotConfigured, ConnectorAuthError) as exc:
        connector.status = "needs_reauth" if isinstance(exc, ConnectorAuthError) else "needs_configuration"
        _record_sync(connector, ok=False, error=str(exc), warnings=list(instance.context.warnings))
        audit.record(db, org_id=connector.org_id, actor=actor, action="connector.sync_failed",
                     tool=connector.kind, result=str(exc))
        db.commit()
        raise
    report = ingest(db, connector, batch)
    report.warnings = list(instance.context.warnings)
    connector.last_synced_at = utcnow()
    connector.status = "connected"
    _record_sync(connector, ok=True, warnings=report.warnings,
                 counts={"signals_new": report.signals_new, "meetings": report.meetings_upserted})
    audit.record(db, org_id=connector.org_id, actor=actor, action="connector.synced", tool=connector.kind,
                 intent="Synchronise permitted information from source", input={"connector_id": connector.id},
                 authorization="connector OAuth grant", result=str(report.__dict__ | {"events": len(report.events)}))
    db.commit()
    return report


def _record_sync(connector: Connector, *, ok: bool, warnings: list[str], error: str = "", counts: dict | None = None) -> None:
    """Keep the outcome of the latest sync on the connector, so users can see what happened (Context Control Center)."""
    from .views import iso

    connector.config = {**(connector.config or {}), "last_sync": {
        "at": iso(utcnow()), "ok": ok, "error": error, "warnings": warnings[:20], "counts": counts or {}}}


def ingest(db: Session, connector: Connector, batch: SyncBatch) -> SyncReport:
    org_id = connector.org_id
    report = SyncReport()

    for p in batch.people:
        if not db.scalar(select(Person).where(Person.org_id == org_id, Person.email == p.email)):
            db.add(Person(org_id=org_id, name=p.name, email=p.email, title=p.title, team=p.team))
    for pr in batch.projects:
        if not db.scalar(select(Project).where(Project.org_id == org_id, Project.name == pr.name)):
            db.add(Project(org_id=org_id, name=pr.name, aliases=pr.aliases, owner=pr.owner, summary=pr.summary))
    db.flush()
    projects = db.scalars(select(Project).where(Project.org_id == org_id)).all()

    for m in batch.meetings:
        row = db.scalar(select(Meeting).where(Meeting.org_id == org_id, Meeting.external_id == m.external_id))
        if row is None:
            row = Meeting(org_id=org_id, external_id=m.external_id, connector_id=connector.id)
            db.add(row)
        row.title, row.starts_at, row.ends_at = m.title, m.starts_at, m.ends_at
        row.attendees, row.organizer, row.purpose = m.attendees, m.organizer, m.purpose
        row.project_id = link_project(projects, f"{m.title} {m.purpose}")
        report.meetings_upserted += 1
    db.flush()

    for s in batch.signals:
        exists = db.scalar(select(Signal.id).where(
            Signal.org_id == org_id, Signal.connector_id == connector.id, Signal.external_id == s.external_id))
        if exists:
            continue
        meeting = None
        if s.meeting_external_id:
            meeting = db.scalar(select(Meeting).where(Meeting.org_id == org_id, Meeting.external_id == s.meeting_external_id))
        project_id = link_project(projects, f"{s.title}\n{s.body}") or (meeting.project_id if meeting else None)
        if meeting and meeting.project_id is None and project_id:
            meeting.project_id = project_id
        db.add(Signal(
            org_id=org_id, connector_id=connector.id, external_id=s.external_id, kind=s.kind, channel=s.channel,
            title=s.title, body=s.body, author_name=s.author_name, author_email=s.author_email,
            participants=s.participants, visibility=s.visibility, occurred_at=s.occurred_at, url=s.url,
            authority=s.authority, project_id=project_id, meeting_id=meeting.id if meeting else None))
        report.signals_new += 1
    db.flush()

    process_pending_signals(db, org_id, report)
    report.risks_open = risk.detect(db, org_id)
    return report


def link_project(projects: list[Project], text: str) -> int | None:
    """Entity linking: the project whose name/aliases are mentioned most."""
    lower = text.lower()
    best, best_hits = None, 0
    for p in projects:
        hits = sum(lower.count(k) for k in [p.name.lower(), *[a.lower() for a in p.aliases or []]])
        if hits > best_hits:
            best, best_hits = p.id, hits
    return best


def process_pending_signals(db: Session, org_id: int, report: SyncReport) -> None:
    extractor = get_extractor()
    report.engine = extractor.name
    pending = db.scalars(select(Signal).where(Signal.org_id == org_id, Signal.processed.is_(False))
                         .order_by(Signal.occurred_at)).all()
    for signal in pending:
        result = extractor.extract(body=signal.body, kind=signal.kind, author=signal.author_name,
                                   occurred_at=signal.occurred_at)
        _persist(db, signal, result, report)
        signal.processed = True
        db.flush()


def _resolve_person(db: Session, org_id: int, name: str) -> Person | None:
    if not name:
        return None
    people = db.scalars(select(Person).where(Person.org_id == org_id)).all()
    for p in people:
        if p.name.lower() == name.lower():
            return p
    matches = [p for p in people if first_name(p.name) == first_name(name)]
    return matches[0] if len(matches) == 1 else None


def _add_evidence(db: Session, signal: Signal, entity_type: str, entity_id: int, quote: str, note: str = "") -> None:
    db.add(Evidence(org_id=signal.org_id, entity_type=entity_type, entity_id=entity_id,
                    signal_id=signal.id, quote=quote, note=note))


def _next_decision_code(db: Session, org_id: int) -> str:
    n = db.scalar(select(func.count(Decision.id)).where(Decision.org_id == org_id)) or 0
    return f"D-{1001 + n}"


def _persist(db: Session, signal: Signal, result: Extraction, report: SyncReport) -> None:
    org_id = signal.org_id
    agent = f"agent:extraction({result.engine})"
    projects = db.scalars(select(Project).where(Project.org_id == org_id)).all()

    def project_for(quote: str) -> int | None:
        # Link each item by its own sentence first; a meeting can cover several projects.
        return link_project(projects, quote) or signal.project_id

    for d in result.decisions:
        status = "pending" if d.pending else "made"
        pid = project_for(d.quote)
        existing = [x for x in db.scalars(select(Decision).where(
            Decision.org_id == org_id, Decision.status == status, Decision.project_id == pid)).all()
            if jaccard(x.statement, d.statement) >= 0.5]
        if existing:  # same decision seen on another channel: add provenance, don't duplicate (§4)
            _add_evidence(db, signal, "decision", existing[0].id, d.quote, "corroborating source")
            report.evidence_linked += 1
            continue
        owner = _resolve_person(db, org_id, d.owner)
        row = Decision(org_id=org_id, code=_next_decision_code(db, org_id), statement=d.statement,
                       owner=owner.name if owner else d.owner, rationale=d.rationale, status=status,
                       confidence=d.confidence, decided_at=signal.occurred_at, project_id=pid,
                       meeting_id=signal.meeting_id, source_signal_id=signal.id, needs_user=d.pending,
                       participants=list(signal.participants or []))
        db.add(row)
        db.flush()
        _add_evidence(db, signal, "decision", row.id, d.quote)
        report.decisions_new += 1
        report.events.append(f"DECISION_DETECTED {row.code}")
        audit.record(db, org_id=org_id, actor=agent, action="decision.detected", tool="extraction",
                     input={"signal_id": signal.id}, authorization="observe", result=f"{row.code}: {row.statement}")

    for c in result.commitments:
        owner = _resolve_person(db, org_id, c.owner_name)
        owner_name = owner.name if owner else (c.owner_name or "Unassigned")
        candidates = db.scalars(select(Commitment).where(
            Commitment.org_id == org_id, Commitment.owner_name == owner_name,
            Commitment.status.in_(["open", "proposed"]))).all()
        dup = next((x for x in candidates if jaccard(x.description, c.description) >= 0.5), None)
        if dup:
            _add_evidence(db, signal, "commitment", dup.id, c.quote, "confirmed in another channel")
            if dup.due_date is None and c.due_date:
                dup.due_date = c.due_date
            if dup.confidence != "high" and c.kind == "explicit":
                dup.confidence = "high"  # corroborated by multiple signals
            report.evidence_linked += 1
            continue
        row = Commitment(org_id=org_id, owner_name=owner_name, owner_email=owner.email if owner else "",
                         description=c.description, due_date=c.due_date, kind=c.kind,
                         # Inferred actions never become assigned work without approval (§11).
                         status="open" if c.kind == "explicit" else "proposed",
                         confidence=c.confidence, project_id=project_for(c.quote), source_signal_id=signal.id,
                         created_at=signal.occurred_at)
        db.add(row)
        db.flush()
        _link_decision(db, row, signal)
        _add_evidence(db, signal, "commitment", row.id, c.quote)
        report.commitments_new += 1
        report.events.append(f"COMMITMENT_CREATED {row.id}")

    for done in result.completions:
        person = _resolve_person(db, org_id, done.author_name)
        name = person.name if person else done.author_name
        open_items = db.scalars(select(Commitment).where(
            Commitment.org_id == org_id, Commitment.owner_name == name, Commitment.status == "open")).all()
        best = max(open_items, key=lambda x: overlap(x.description, done.text), default=None)
        if best and overlap(best.description, done.text) >= 2:
            best.status = "done"
            best.completed_signal_id = signal.id
            _add_evidence(db, signal, "commitment", best.id, done.quote, "completion detected")
            report.commitments_completed += 1
            report.events.append(f"TASK_COMPLETED commitment {best.id}")
            audit.record(db, org_id=org_id, actor=agent, action="commitment.completed", tool="extraction",
                         input={"signal_id": signal.id, "commitment_id": best.id}, authorization="observe",
                         result=best.description)


DECISION_LINK_WINDOW_DAYS = 14


def _link_decision(db: Session, c: Commitment, signal: Signal) -> None:
    """Commitment -> related decision (MVP Commitment Register).

    FACT when stated in the same source as the decision; INFERENCE when it is the only decision made on
    the same project within the preceding window. Ambiguity (several candidates) means no link.
    """
    if c.project_id is None:
        return
    made = db.scalars(select(Decision).where(
        Decision.org_id == c.org_id, Decision.project_id == c.project_id, Decision.status == "made",
        Decision.decided_at <= signal.occurred_at)).all()
    same = [d for d in made if d.source_signal_id == signal.id]
    if len(same) == 1:
        c.decision_id, c.decision_link_type = same[0].id, "fact"
        c.decision_link_basis = f"Committed in the same discussion where {same[0].code} was decided."
        return
    recent = [d for d in made if (signal.occurred_at - d.decided_at).days <= DECISION_LINK_WINDOW_DAYS]
    if len(recent) == 1:
        d = recent[0]
        c.decision_id, c.decision_link_type = d.id, "inference"
        c.decision_link_basis = (f"Same project as {d.code}, decided "
                                 f"{(signal.occurred_at - d.decided_at).days} day(s) earlier.")


def sync_all(db: Session, org_id: int, actor: str = "system") -> list[SyncReport]:
    reports = []
    for c in db.scalars(select(Connector).where(Connector.org_id == org_id)).all():
        try:
            reports.append(sync_connector(db, c, actor))
        except (ConnectorNotConfigured, ConnectorAuthError):
            continue
    return reports


def relink_projects(db: Session, org_id: int) -> int:
    """After an admin adds or edits a project: link unlinked signals and items, then re-run risk detection."""
    projects = db.scalars(select(Project).where(Project.org_id == org_id)).all()
    changed = 0
    for s in db.scalars(select(Signal).where(Signal.org_id == org_id, Signal.project_id.is_(None))).all():
        if pid := link_project(projects, f"{s.title}\n{s.body}"):
            s.project_id, changed = pid, changed + 1
    for model in (Decision, Commitment):
        for row in db.scalars(select(model).where(model.org_id == org_id, model.project_id.is_(None))).all():
            quotes = db.scalars(select(Evidence.quote).where(Evidence.entity_type == model.__tablename__[:-1],
                                                             Evidence.entity_id == row.id)).all()
            if pid := link_project(projects, " ".join(quotes)) or (db.get(Signal, row.source_signal_id).project_id):
                row.project_id, changed = pid, changed + 1
    risk.detect(db, org_id)
    db.commit()
    return changed


def connect_demo(db: Session, org_id: int, user: User | None = None) -> Connector:
    conn = db.scalar(select(Connector).where(Connector.org_id == org_id, Connector.kind == "demo"))
    if conn is None:
        conn = Connector(org_id=org_id, kind="demo", created_by=user.id if user else None)
        db.add(conn)
        db.flush()
    return conn
