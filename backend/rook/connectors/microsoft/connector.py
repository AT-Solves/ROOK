from __future__ import annotations

import logging
from datetime import timedelta

import httpx

from ...config import env, env_bool
from ...models import utcnow
from ..base import BaseConnector, ConnectorNotConfigured, OutboundMessage, SyncBatch
from . import normalize
from .graph import GraphClient, GraphError

log = logging.getLogger(__name__)

# Delegated Microsoft Graph permissions requested when a user connects Microsoft 365 (least privilege, read-only).
DATA_SCOPES = (
    "offline_access",
    "User.Read",
    "Mail.Read",
    "Calendars.Read",
    "OnlineMeetings.Read",
    "OnlineMeetingTranscript.Read.All",  # requires admin consent; transcripts are skipped if not granted
)
SEND_SCOPE = "Mail.Send"  # requested only when MICROSOFT_ENABLE_SEND=true

_MSG_FIELDS = "id,subject,body,bodyPreview,from,sender,toRecipients,ccRecipients,receivedDateTime,webLink,isDraft"
_EVT_FIELDS = "id,iCalUId,subject,bodyPreview,start,end,attendees,organizer,isOnlineMeeting,onlineMeeting,isCancelled"


def _iso(dt) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class Microsoft365Connector(BaseConnector):
    kind = "microsoft365"
    display_name = "Microsoft 365 (Outlook, Calendar, Teams meetings)"
    category = "communication"
    phase = 1
    delegated = True
    can_send = True
    required_env = ("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID")
    scopes = DATA_SCOPES
    data_types = (("conversations", "Outlook mail"), ("meetings", "Calendar"),
                  ("transcripts", "Teams meeting transcripts (where permitted)"))
    transport_override: httpx.BaseTransport | None = None  # tests inject a mock Graph here

    def __init__(self, config=None, context=None, transport: httpx.BaseTransport | None = None):
        super().__init__(config, context)
        self._transport = transport

    @classmethod
    def sending_enabled(cls) -> bool:
        return env_bool("MICROSOFT_ENABLE_SEND", False)

    @classmethod
    def requested_scopes(cls) -> list[str]:
        return ["openid", "profile", "email", *DATA_SCOPES, *([SEND_SCOPE] if cls.sending_enabled() else [])]

    def _client(self) -> GraphClient:
        if self.context.get_access_token is None:
            raise ConnectorNotConfigured("Connect Microsoft 365 first (Sources → Microsoft 365 → Connect).")
        return GraphClient(self.context.get_access_token, transport=self._transport or self.transport_override)

    def sync(self, since):
        graph = self._client()
        owner = self.context.owner_email
        now = utcnow()
        start = (since - timedelta(hours=1)) if since else now - timedelta(days=self.context.lookback_days)
        max_messages = int(env("MICROSOFT_MAX_MESSAGES_PER_SYNC", "500"))

        messages = [m for m in graph.iterate("/me/messages", {
            "$filter": f"receivedDateTime ge {_iso(start)}", "$orderby": "receivedDateTime desc",
            "$select": _MSG_FIELDS, "$top": "50"}, limit=max_messages) if not m.get("isDraft")]
        events = [e for e in graph.iterate("/me/calendarView", {
            "startDateTime": _iso(now - timedelta(days=self.context.lookback_days)),
            "endDateTime": _iso(now + timedelta(days=14)), "$select": _EVT_FIELDS, "$top": "100"}, limit=1000)
            if not e.get("isCancelled")]

        meetings = [normalize.event_to_meeting(e, owner) for e in events]
        signals = [normalize.message_to_signal(m, owner) for m in messages]
        if env_bool("MICROSOFT_ENABLE_TRANSCRIPTS", True):
            signals += self._transcripts(graph, events, meetings, now)
        return SyncBatch(signals=signals, meetings=meetings, people=normalize.people_from(messages, events))

    def _transcripts(self, graph: GraphClient, events: list[dict], meetings, now) -> list:
        """Teams meeting transcripts 'where permitted' — permission or licensing gaps are reported, never fatal."""
        out = []
        for evt, meeting in zip(events, meetings, strict=True):
            join = ((evt.get("onlineMeeting") or {}).get("joinUrl")) if evt.get("isOnlineMeeting") else None
            if not join or meeting.ends_at > now:
                continue
            try:
                literal = join.replace("'", "''")  # OData string-literal escaping
                found = graph.get("/me/onlineMeetings", {"$filter": f"JoinWebUrl eq '{literal}'"}).get("value", [])
                if not found:
                    continue
                mid = found[0]["id"]
                for t in graph.get(f"/me/onlineMeetings/{mid}/transcripts").get("value", []):
                    vtt = graph.get_text(f"/me/onlineMeetings/{mid}/transcripts/{t['id']}/content", {"$format": "text/vtt"})
                    if sig := normalize.transcript_to_signal(meeting, t["id"], vtt):
                        out.append(sig)
            except GraphError as exc:
                if exc.status in (401, 403, 404):
                    msg = f"Transcript unavailable for '{meeting.title}' ({exc.status}); continuing without it."
                    self.context.warnings.append(msg)
                    log.info(msg)
                    continue
                raise
        return out

    def send(self, message: OutboundMessage) -> str:
        if not self.sending_enabled():
            raise ConnectorNotConfigured("Sending through Microsoft 365 is disabled (MICROSOFT_ENABLE_SEND=false).")
        self._client().post("/me/sendMail", {
            "message": {"subject": message.subject, "body": {"contentType": "Text", "content": message.body},
                        "toRecipients": [{"emailAddress": {"address": a}} for a in message.to]},
            "saveToSentItems": True})
        return f"Sent from your Microsoft 365 mailbox to {', '.join(message.to)}."
