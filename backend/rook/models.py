"""Persistent entities: the Leadership Context Graph (README §15–16) in relational form.

Every row carries ``org_id`` — tenant isolation is enforced in every query (§27).
Relationships are plain foreign keys plus the ``Evidence`` table, which links any
derived entity (decision, commitment, risk, ...) back to the source signals it came from (§18).
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    # AI action policy (§19, §53). Keys: create_task, send_email, send_message -> "never" | "approval" | "auto"
    ai_policy: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("org_id", "email"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    email: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(200), default="")
    role: Mapped[str] = mapped_column(String(20), default="member")  # admin | member


class Person(Base):
    """A stakeholder known to ROOK (may or may not be a ROOK user)."""

    __tablename__ = "people"
    __table_args__ = (UniqueConstraint("org_id", "email"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(200), default="")
    team: Mapped[str] = mapped_column(String(200), default="")


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    aliases: Mapped[list] = mapped_column(JSON, default=list)  # lower-case keywords used for linking
    owner: Mapped[str] = mapped_column(String(200), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="on_track")  # on_track | at_risk | off_track


class Connector(Base):
    __tablename__ = "connectors"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    kind: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30), default="connected")
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class Signal(Base):
    """A normalised unit of communication/work from any connector (§30 'Normalization')."""

    __tablename__ = "signals"
    __table_args__ = (UniqueConstraint("org_id", "connector_id", "external_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    connector_id: Mapped[int] = mapped_column(ForeignKey("connectors.id"))
    external_id: Mapped[str] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(40))  # email | message | meeting_transcript | task_update | document
    channel: Mapped[str] = mapped_column(String(60))  # Gmail, Slack #platform, Jira, ...
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(200))
    author_email: Mapped[str] = mapped_column(String(200), default="")
    participants: Mapped[list] = mapped_column(JSON, default=list)  # emails with access in source system
    visibility: Mapped[str] = mapped_column(String(20), default="org")  # org | restricted
    occurred_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    url: Mapped[str] = mapped_column(String(500), default="")
    authority: Mapped[float] = mapped_column(Float, default=0.5)  # source authority §31
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id"), nullable=True)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (UniqueConstraint("org_id", "external_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    external_id: Mapped[str] = mapped_column(String(300))
    title: Mapped[str] = mapped_column(String(300))
    purpose: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    attendees: Mapped[list] = mapped_column(JSON, default=list)
    organizer: Mapped[str] = mapped_column(String(200), default="")
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    connector_id: Mapped[int | None] = mapped_column(ForeignKey("connectors.id"), nullable=True)


class Decision(Base):
    __tablename__ = "decisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(20))  # D-1001
    statement: Mapped[str] = mapped_column(Text)
    owner: Mapped[str] = mapped_column(String(200), default="")
    rationale: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="made")  # made | pending | superseded
    confidence: Mapped[str] = mapped_column(String(10), default="medium")  # high | medium | low
    decided_at: Mapped[datetime] = mapped_column(DateTime)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id"), nullable=True)
    source_signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id"))
    needs_user: Mapped[bool] = mapped_column(Boolean, default=False)  # pending decision awaiting the leader


class Commitment(Base):
    __tablename__ = "commitments"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    owner_name: Mapped[str] = mapped_column(String(200))
    owner_email: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    kind: Mapped[str] = mapped_column(String(20), default="explicit")  # explicit | inferred (§11)
    status: Mapped[str] = mapped_column(String(20), default="open")  # proposed | open | done | dropped
    confidence: Mapped[str] = mapped_column(String(10), default="medium")
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    source_signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id"))
    completed_signal_id: Mapped[int | None] = mapped_column(ForeignKey("signals.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Risk(Base):
    __tablename__ = "risks"
    __table_args__ = (UniqueConstraint("org_id", "rule_key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    rule_key: Mapped[str] = mapped_column(String(200))  # idempotency key: one risk per rule+subject
    rule: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(300))
    explanation: Mapped[str] = mapped_column(Text)  # §13: no unexplained scores
    level: Mapped[str] = mapped_column(String(10))  # low | medium | high
    confidence: Mapped[str] = mapped_column(String(10), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="open")  # open | acknowledged | resolved
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Evidence(Base):
    """Provenance link: derived entity -> source signal (+ the quoted span)."""

    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(30), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id"))
    quote: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(String(300), default="")


class ActionProposal(Base):
    """Human-in-the-loop action (§19): Recommend -> Prepare -> (approve) -> Execute."""

    __tablename__ = "action_proposals"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(40))  # send_email | send_message | create_task
    title: Mapped[str] = mapped_column(String(300))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | approved | rejected | executed | blocked
    related_type: Mapped[str] = mapped_column(String(30), default="")
    related_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    """§33: actor, intent, tool, input, authorization, result."""

    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor: Mapped[str] = mapped_column(String(60))  # user:<email> | agent:<name> | system
    action: Mapped[str] = mapped_column(String(80))
    intent: Mapped[str] = mapped_column(String(300), default="")
    tool: Mapped[str] = mapped_column(String(80), default="")
    input: Mapped[dict] = mapped_column(JSON, default=dict)
    authorization: Mapped[str] = mapped_column(String(60), default="")
    result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
