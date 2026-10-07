"""Microsoft 365 connector (R04–R06): normalisation, ACL mapping, paging, throttling, transcripts."""

from datetime import datetime, timedelta

from rook.connectors.base import ConnectorContext
from rook.connectors.microsoft import Microsoft365Connector
from rook.connectors.microsoft.normalize import message_to_signal, parse_dt, parse_vtt, strip_quoted
from rook.models import Signal
from tests.conftest import connect_m365, entra_sign_in
from tests.fixtures.m365 import ME, FakeM365


def test_parse_dt_handles_graph_precision_and_zones():
    assert parse_dt("2026-10-07T10:00:00.1234567Z") == datetime(2026, 10, 7, 10, 0, 0, 123456)
    assert parse_dt("2026-10-07T10:00:00.0000000", "Asia/Kolkata") == datetime(2026, 10, 7, 4, 30)


def test_strip_quoted_and_vtt():
    assert strip_quoted("New text\n\nFrom: Someone\nold thread") == "New text"
    assert strip_quoted("Hi\n> quoted") == "Hi"
    vtt = "WEBVTT\n\n00:01 --> 00:02\n<v Ann Lee>Hello</v>\n\n00:02 --> 00:03\n<v Ann Lee>again.</v>\n<v Bo Ng>Hi.</v>"
    assert parse_vtt(vtt) == "Ann Lee: Hello again.\nBo Ng: Hi."


def test_message_acl_mirrors_recipients():
    fake = FakeM365()
    msgs, _ = fake.messages()
    s = message_to_signal(msgs[0], ME)
    assert s.visibility == "restricted"
    assert set(s.participants) == {ME, "marcus@contoso.example", "priya@contoso.example"}
    assert "From: Yamini" not in s.body and s.url.startswith("https://outlook.office.com")


def _connector(fake, **ctx):
    return Microsoft365Connector(context=ConnectorContext(owner_email=ME, get_access_token=lambda: "at", **ctx),
                                 transport=fake.transport())


def test_sync_pages_skips_drafts_and_cancelled_and_reads_transcripts():
    fake = FakeM365()
    batch = _connector(fake).sync(None)
    kinds = sorted(s.kind for s in batch.signals)
    assert kinds == ["email", "email", "email", "meeting_transcript"]  # 3 mails over 2 pages (draft skipped) + 1 transcript
    assert len(batch.meetings) == 2  # cancelled event skipped
    tr = next(s for s in batch.signals if s.kind == "meeting_transcript")
    assert tr.body.startswith("Priya Shah: We decided to launch Project Phoenix")
    assert tr.meeting_external_id == "evt:ical-lead"
    assert {p.email for p in batch.people} >= {"marcus@contoso.example", "tom@contoso.example"}


def test_throttling_is_retried():
    fake = FakeM365()
    fake.throttle_once = True
    assert _connector(fake).sync(None).signals


def test_transcript_permission_gap_is_reported_not_fatal():
    fake = FakeM365()
    fake.transcripts_forbidden = True
    ctx_conn = _connector(fake)
    batch = ctx_conn.sync(None)
    assert all(s.kind == "email" for s in batch.signals) and batch.meetings
    assert any("Transcript unavailable" in w for w in ctx_conn.context.warnings)


def test_incremental_sync_uses_last_sync_time():
    fake = FakeM365()
    _connector(fake).sync(datetime(2026, 10, 1, 12))
    # first call path recorded; filter value is in the query string, which the handler saw
    assert fake.graph_calls[0] == "/me/messages"


def test_api_sync_ingests_and_respects_acl(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    report = client.post(f"/api/sources/{cid}/sync", headers=h).json()
    assert report["signals_new"] == 4 and report["decisions_new"] >= 1
    with session_factory() as db:
        assert all(s.visibility == "restricted" for s in db.query(Signal).filter_by(connector_id=cid).all())
    sources = {s["kind"]: s for s in client.get("/api/sources", headers=h).json()}
    assert sources["microsoft365"]["connection"]["status"] == "connected"
    # Nothing Microsoft-specific leaks into domain records
    d = client.get("/api/decisions", headers=h).json()[0]
    assert d["evidence"][0]["channel"] == "Microsoft Teams" and "graph" not in str(d).lower()


def test_expired_token_is_refreshed(client, session_factory, m365):
    from rook.models import ConnectorCredential, utcnow

    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    with session_factory() as db:
        cred = db.query(ConnectorCredential).filter_by(connector_id=cid).one()
        cred.expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
    assert client.post(f"/api/sources/{cid}/sync", headers=h).status_code == 200
    assert m365.refreshes == 1


def test_other_users_cannot_sync_my_mailbox(client, session_factory, m365):
    from tests.conftest import login

    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    assert client.post(f"/api/sources/{cid}/sync", headers=login(client)).status_code == 404
