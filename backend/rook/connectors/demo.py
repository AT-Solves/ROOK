from __future__ import annotations

from datetime import datetime

from ..models import utcnow
from . import demo_data
from .base import BaseConnector, DataType, OutboundMessage, SyncBatch


class DemoConnector(BaseConnector):
    """Synthetic multi-channel workspace (email, Slack, Teams, Meet, Jira) for trying ROOK safely."""

    kind = "demo"
    display_name = "Demo workspace"
    category = "communication"
    phase = 0
    can_send = True
    synthetic = True
    data_types = (DataType("calendar", "meetings", "Calendar"), DataType("email", "conversations", "Email"),
                  DataType("chat", "conversations", "Chat"), DataType("transcripts", "transcripts", "Meeting transcripts"),
                  DataType("work_items", "work_items", "Work items"))

    def sync(self, since: datetime | None) -> SyncBatch:
        # Meeting times are planned in the demo user's configured time zone (set at bootstrap).
        return demo_data.build(utcnow(), self.config.get("timezone", "UTC"))

    def send(self, message: OutboundMessage) -> str:
        # Nothing leaves the system: the demo "outbox" is the audit log.
        return f"Delivered to demo outbox: to={', '.join(message.to)} subject={message.subject!r}"


class ManualConnector(BaseConnector):
    """Signals pasted or uploaded by a user (e.g. a meeting transcript or notes)."""

    kind = "manual"
    display_name = "Manual upload"
    category = "meetings"
    phase = 0
    data_types = (DataType("uploads", "transcripts", "Uploaded transcripts and notes"),)

    def sync(self, since: datetime | None) -> SyncBatch:
        return SyncBatch()
