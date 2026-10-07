"""Demo data realism (M3 review prep): meetings at sensible local times; "Today" = the local calendar day."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rook.bootstrap import ensure_demo_tenant
from rook.connectors import demo_data
from rook.db import init_db
from rook.models import User, utcnow
from rook.services.briefing import build_brief
from rook.timeutil import to_local

ZONES = ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Europe/London", "Pacific/Auckland", "America/Sao_Paulo"]


@pytest.mark.parametrize("tz", ZONES)
@pytest.mark.parametrize("utc_hour", range(24))
def test_meetings_fall_in_local_working_hours(tz, utc_hour):
    now = datetime(2026, 10, 7, utc_hour, 17)
    zone = ZoneInfo(tz)
    batch = demo_data.build(now, tz)
    for m in batch.meetings:
        start = m.starts_at.replace(tzinfo=UTC).astimezone(zone)
        end = m.ends_at.replace(tzinfo=UTC).astimezone(zone)
        assert start.hour >= 8 and (end.hour, end.minute) <= (18, 0), (m.title, start, end)
        assert start.date() == end.date(), "no overnight demo meetings"
    assert all(s.occurred_at <= now for s in batch.signals), "no messages from the future"


def test_key_meetings_are_still_ahead_in_the_morning():
    now = datetime(2026, 10, 7, 4, 20)  # 09:50 in Kolkata
    zone = ZoneInfo("Asia/Kolkata")
    times = {m.title: m.starts_at.replace(tzinfo=UTC).astimezone(zone) for m in demo_data.build(now, "Asia/Kolkata").meetings}
    assert times["Phoenix Product Review"].strftime("%a %H:%M") == "Wed 10:30"
    assert times["Payments Migration steering"].strftime("%H:%M") == "13:30"
    assert times["1:1 with David (CFO)"].strftime("%H:%M") == "15:30"
    assert times["Executive staff stand-up"].strftime("%H:%M") == "08:30"


def test_late_in_the_day_meetings_move_to_next_morning():
    now = datetime(2026, 10, 7, 15, 0)  # 20:30 in Kolkata
    zone = ZoneInfo("Asia/Kolkata")
    times = {m.title: m.starts_at.replace(tzinfo=UTC).astimezone(zone) for m in demo_data.build(now, "Asia/Kolkata").meetings}
    assert times["Phoenix Product Review"].strftime("%a %H:%M") == "Thu 09:30"
    assert times["Payments Migration steering"].strftime("%a %H:%M") == "Thu 13:00"


def _tenant(tz: str):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    init_db(engine)
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    ensure_demo_tenant(db, timezone=tz)
    return db, db.query(User).filter_by(email="yamini@acme.example").one()


def test_today_is_the_users_local_calendar_day():
    tz = demo_data.demo_morning_timezone(utcnow(), local_hour=21)  # evening for the user
    db, user = _tenant(tz)
    assert user.timezone == tz
    brief = build_brief(db, user)
    local_today = to_local(utcnow(), tz).date()
    for m in brief["today"]:
        assert to_local(datetime.fromisoformat(m["starts_at"].rstrip("Z")), tz).date() == local_today
    # in the evening only the morning stand-up remains on today's calendar; the rest moved to tomorrow
    assert [m["title"] for m in brief["today"]] == ["Executive staff stand-up"]


def test_morning_brief_has_a_full_local_agenda():
    db, user = _tenant(demo_data.demo_morning_timezone(utcnow()))
    titles = [m["title"] for m in build_brief(db, user)["today"]]
    assert titles == ["Executive staff stand-up", "Phoenix Product Review", "Payments Migration steering", "1:1 with David (CFO)"]
    assert "Northwind quarterly business review" not in titles  # tomorrow is not "today"


def test_demo_morning_timezone_helper():
    for h in range(24):
        now = datetime(2026, 10, 7, h, 5)
        tz = demo_data.demo_morning_timezone(now)
        assert to_local(now, tz).hour == 9
    assert demo_data.demo_morning_timezone(datetime(2026, 10, 7, 9, 0)) == "Etc/GMT"
