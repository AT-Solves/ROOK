"""Times are stored as naive UTC. They are converted to the user's IANA time zone only at the edges."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def tz(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def to_local(dt_utc: datetime, tzname: str | None) -> datetime:
    return dt_utc.replace(tzinfo=UTC).astimezone(tz(tzname))


def local_day_bounds_utc(now_utc: datetime, tzname: str | None) -> tuple[datetime, datetime]:
    """[start, end) of the user's local 'today', as naive UTC."""
    local = to_local(now_utc, tzname)
    start_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
    start = start_local.astimezone(UTC).replace(tzinfo=None)
    return start, start + timedelta(days=1)


def is_valid_tz(name: str) -> bool:
    try:
        ZoneInfo(name)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False
