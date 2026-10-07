"""Connector contract (README §5, §37).

Every source system — Gmail, Outlook, Slack, Teams, Jira, ... — implements this interface and
returns *normalised* records. Nothing downstream knows which vendor a signal came from, so new
connectors can be added independently without touching the pipeline.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class NormalizedSignal:
    external_id: str
    kind: str  # email | message | meeting_transcript | task_update | document
    channel: str
    title: str
    body: str
    author_name: str
    author_email: str
    occurred_at: datetime
    participants: list[str] = field(default_factory=list)
    visibility: str = "org"  # "restricted" => only participants may see it (mirrors source ACLs, §26)
    url: str = ""
    authority: float = 0.5
    meeting_external_id: str | None = None


@dataclass
class NormalizedMeeting:
    external_id: str
    title: str
    starts_at: datetime
    ends_at: datetime
    attendees: list[str]
    organizer: str = ""
    purpose: str = ""


@dataclass
class DirectoryPerson:
    name: str
    email: str
    title: str = ""
    team: str = ""


@dataclass
class DirectoryProject:
    name: str
    aliases: list[str]
    owner: str = ""
    summary: str = ""


@dataclass
class SyncBatch:
    signals: list[NormalizedSignal] = field(default_factory=list)
    meetings: list[NormalizedMeeting] = field(default_factory=list)
    people: list[DirectoryPerson] = field(default_factory=list)
    projects: list[DirectoryProject] = field(default_factory=list)


@dataclass
class OutboundMessage:
    to: list[str]
    subject: str
    body: str


class ConnectorNotConfigured(Exception):
    """Raised when a connector needs credentials/OAuth that have not been provided."""


class BaseConnector(ABC):
    kind: str
    display_name: str
    category: str  # communication | meetings | documents | work | business
    phase: int  # rollout phase from README §37
    required_env: tuple[str, ...] = ()
    scopes: tuple[str, ...] = ()
    can_send: bool = False

    def __init__(self, config: dict | None = None):
        self.config = config or {}

    @classmethod
    def is_configured(cls) -> bool:
        import os

        return all(os.environ.get(name) for name in cls.required_env)

    @abstractmethod
    def sync(self, since: datetime | None) -> SyncBatch: ...

    def send(self, message: OutboundMessage) -> str:
        raise NotImplementedError(f"{self.display_name} connector cannot send messages")
