"""Graph JSON -> provider-neutral records. Pure functions (unit-tested with fixtures)."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..base import DirectoryPerson, NormalizedMeeting, NormalizedSignal

_QUOTE_START = re.compile(r"^(From:\s|-----\s*Original Message\s*-----|On .{3,120} wrote:$|_{10,})", re.I)
_VTT_VOICE = re.compile(r"<v\s+([^>]+)>(.*?)(?:</v>|$)", re.S)


def parse_dt(value: str | None, tz_name: str | None = "UTC") -> datetime:
    """Graph timestamps -> naive UTC. Graph returns 7 fractional digits; Python accepts 6."""
    if not value:
        return datetime.now(UTC).replace(tzinfo=None)
    v = value.rstrip("Z")
    if "." in v:
        head, frac = v.split(".", 1)
        v = f"{head}.{frac[:6]}"
    dt = datetime.fromisoformat(v)
    if dt.tzinfo is None:
        try:
            dt = dt.replace(tzinfo=ZoneInfo(tz_name or "UTC"))
        except (ZoneInfoNotFoundError, ValueError):
            dt = dt.replace(tzinfo=UTC)  # Windows zone names: Prefer header asks Graph for UTC anyway
    return dt.astimezone(UTC).replace(tzinfo=None)


def strip_quoted(text: str) -> str:
    """Keep only the new part of an email; earlier thread messages are ingested as their own signals."""
    out = []
    for line in (text or "").replace("\r\n", "\n").split("\n"):
        if _QUOTE_START.match(line.strip()) or line.lstrip().startswith(">"):
            break
        out.append(line)
    return "\n".join(out).strip()


def _addr(recipient: dict | None) -> tuple[str, str]:
    ea = (recipient or {}).get("emailAddress") or {}
    return (ea.get("name") or ea.get("address") or "").strip(), (ea.get("address") or "").strip().lower()


def message_to_signal(msg: dict, owner_email: str) -> NormalizedSignal:
    sender_name, sender = _addr(msg.get("from") or msg.get("sender"))
    recipients = [_addr(r)[1] for r in (msg.get("toRecipients") or []) + (msg.get("ccRecipients") or [])]
    participants = list(dict.fromkeys(e for e in [owner_email.lower(), sender, *recipients] if e))
    body = (msg.get("body") or {}).get("content") or msg.get("bodyPreview") or ""
    return NormalizedSignal(
        external_id=f"msg:{msg['id']}", kind="email", channel="Outlook", title=msg.get("subject") or "(no subject)",
        body=strip_quoted(body)[:20000], author_name=sender_name or sender, author_email=sender,
        occurred_at=parse_dt(msg.get("receivedDateTime")), participants=participants,
        visibility="restricted",  # mail is visible only to its sender/recipients (source ACL)
        url=msg.get("webLink") or "", authority=0.6,
    )


def event_to_meeting(evt: dict, owner_email: str) -> NormalizedMeeting:
    start, end = evt.get("start") or {}, evt.get("end") or {}
    _, organizer = _addr(evt.get("organizer"))
    attendees = [_addr(a)[1] for a in evt.get("attendees") or []]
    return NormalizedMeeting(
        external_id=f"evt:{evt.get('iCalUId') or evt['id']}", title=evt.get("subject") or "(untitled meeting)",
        starts_at=parse_dt(start.get("dateTime"), start.get("timeZone")),
        ends_at=parse_dt(end.get("dateTime"), end.get("timeZone")),
        attendees=list(dict.fromkeys(e for e in [owner_email.lower(), organizer, *attendees] if e)),
        organizer=organizer, purpose=(evt.get("bodyPreview") or "")[:500],
    )


def parse_vtt(vtt: str) -> str:
    """WebVTT with <v Speaker> tags -> 'Speaker: text' lines, merging consecutive turns by the same speaker."""
    turns: list[list[str]] = []
    for m in _VTT_VOICE.finditer(vtt or ""):
        speaker, text = m.group(1).strip(), " ".join(m.group(2).split())
        if not text:
            continue
        if turns and turns[-1][0] == speaker:
            turns[-1][1] += " " + text
        else:
            turns.append([speaker, text])
    return "\n".join(f"{s}: {t}" for s, t in turns)


def transcript_to_signal(meeting: NormalizedMeeting, transcript_id: str, vtt: str) -> NormalizedSignal | None:
    text = parse_vtt(vtt)
    if not text:
        return None
    return NormalizedSignal(
        external_id=f"transcript:{transcript_id}", kind="meeting_transcript", channel="Microsoft Teams",
        title=f"{meeting.title} — transcript", body=text[:200000], author_name=meeting.organizer,
        author_email=meeting.organizer, occurred_at=meeting.ends_at, participants=meeting.attendees,
        visibility="restricted", authority=0.8, meeting_external_id=meeting.external_id,
    )


def people_from(messages: list[dict], events: list[dict]) -> list[DirectoryPerson]:
    seen: dict[str, str] = {}
    for m in messages:
        for r in [m.get("from")] + (m.get("toRecipients") or []) + (m.get("ccRecipients") or []):
            name, email = _addr(r)
            if email and (email not in seen or seen[email] == email):
                seen[email] = name or email
    for e in events:
        for r in [e.get("organizer")] + (e.get("attendees") or []):
            name, email = _addr(r)
            if email and email not in seen:
                seen[email] = name or email
    return [DirectoryPerson(name=n, email=e) for e, n in seen.items()]
