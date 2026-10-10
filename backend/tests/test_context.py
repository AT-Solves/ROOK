"""Context Control Center (M3.5 P0-2/P0-3): sources, permissions, sync state, visible coverage, context health."""

from sqlalchemy import select

from rook.models import Connector, Signal, User
from rook.services.context import health, sources
from tests.conftest import connect_m365, entra_sign_in, login


def _ctx(client, headers):
    r = client.get("/api/context", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_demo_context_is_labelled_synthetic_and_explains_its_health(client):
    ctx = _ctx(client, login(client))
    demo = next(s for s in ctx["sources"] if s["kind"] == "demo")
    assert demo["state"] == "connected" and demo["synthetic"] is True
    assert demo["connection"]["account"] == "Synthetic demo organisation"
    assert demo["connection"]["last_successful_sync"]
    h = ctx["health"]
    assert h["claim_type"] == "INFERENCE" and h["synthetic"] is True
    assert h["state"] in {"strong", "partial", "limited"}
    # every health state is explained by FACT reasons derived from real counts
    assert h["reasons"] and all(r["claim_type"] == "FACT" for r in h["reasons"])
    assert {r["kind"] for r in h["reasons"]} <= {"access", "limitation"}
    assert h["coverage"]["meetings"] > 0 and h["coverage"]["conversations"] > 0
    assert any(r["text"].startswith("Meetings:") for r in h["reasons"])


def test_unbuilt_sources_are_never_offered_as_connectable(client):
    ctx = _ctx(client, login(client))
    later = [s for s in ctx["sources"] if s["state"] == "later"]
    assert {"slack", "jira", "github", "zoom"} <= {s["kind"] for s in later}
    assert all(not s["implemented"] and not s["connectable"] and s["connection"] is None for s in later)
    slack = next(s for s in later if s["kind"] == "slack")
    assert [d["label"] for d in slack["data_types"]] == ["Messages", "Channels", "Threads"]
    groups = {g["name"]: g for g in _ctx(client, login(client))["available_later"]}
    assert groups["Atlassian"]["products"] == ["Confluence", "Jira"]
    assert groups["Google Workspace"]["products"] == ["Gmail", "Google Calendar"]
    assert {"Slack", "GitHub", "Zoom"} <= set(groups)


def test_microsoft_365_needs_admin_setup_when_unconfigured(client, monkeypatch):
    for name in ("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID"):
        monkeypatch.delenv(name, raising=False)
    ms = next(s for s in _ctx(client, login(client))["sources"] if s["kind"] == "microsoft365")
    assert ms["state"] == "available" and ms["setup_required"] is True and ms["connectable"] is False


def test_coverage_counts_only_what_the_user_can_see(client, session_factory):
    h = login(client)
    before = _ctx(client, h)["health"]["coverage"]["conversations"]
    with session_factory() as db:
        user = db.scalar(select(User).where(User.email == "yamini@acme.example"))
        conn = db.scalar(select(Connector).where(Connector.org_id == user.org_id, Connector.kind == "demo"))
        db.add(Signal(org_id=user.org_id, connector_id=conn.id, external_id="private-1", kind="email", channel="Outlook",
                      title="Private", body="not for Yamini", author_name="David Kim", author_email="david@acme.example",
                      participants=["david@acme.example"], visibility="restricted", occurred_at=conn.last_synced_at))
        db.commit()
    assert _ctx(client, h)["health"]["coverage"]["conversations"] == before


def test_m365_shows_account_granted_permissions_and_last_sync_outcome(client, session_factory, m365):
    m365.transcripts_forbidden = True  # tenant has not consented to transcripts
    headers = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, headers)
    assert client.post(f"/api/sources/{cid}/sync", headers=headers).status_code == 200

    ms = next(s for s in _ctx(client, headers)["sources"] if s["kind"] == "microsoft365")
    c = ms["connection"]
    assert ms["state"] == "connected" and c["account"] == "yamini@contoso.example"
    scopes = {p["scope"]: p["label"] for p in c["granted_permissions"]}
    assert scopes["Mail.Read"] == "Read your mail" and "Calendars.Read" in scopes
    assert c["last_sync"]["ok"] is True and c["last_successful_sync"]
    assert any("Transcript unavailable" in w for w in c["last_sync"]["warnings"])
    assert c["visible_items"]["conversations"] >= 2 and c["visible_items"]["meetings"] >= 1

    # the permission gap is surfaced as a reason, so health cannot read as "strong"
    h = _ctx(client, headers)["health"]
    assert h["state"] != "strong"
    assert any("Transcript unavailable" in r["text"] for r in h["reasons"])


def test_failed_sync_is_recorded_and_lowers_health(client, session_factory, m365):
    headers = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, headers)
    client.post(f"/api/sources/{cid}/sync", headers=headers)
    m365.revoked = True  # the user revoked ROOK in Microsoft 365
    assert client.post(f"/api/sources/{cid}/sync", headers=headers).status_code == 409
    c = next(s for s in _ctx(client, headers)["sources"] if s["kind"] == "microsoft365")["connection"]
    assert c["status"] == "needs_reauth" and c["last_sync"]["ok"] is False and c["last_sync"]["error"]
    assert any("needs attention" in r["text"] for r in _ctx(client, headers)["health"]["reasons"])


def test_no_sources_means_not_connected(db):
    user = User(org_id=999, email="nobody@example.com", name="Nobody")
    h = health(db, user, sources(db, user))
    assert h["state"] == "not_connected" and h["reasons"][0]["claim_type"] == "FACT"


def test_access_is_shown_per_kind_of_data_with_the_reason(client, session_factory, m365):
    m365.transcripts_forbidden = True
    headers = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, headers)
    before = next(s for s in _ctx(client, headers)["sources"] if s["kind"] == "microsoft365")["connection"]
    assert {a["key"]: a["status"] for a in before["access"]}["mail"] == "granted"  # granted, not yet read
    assert before["last_attempted_sync"] is None and before["actions"] == ["sync", "reconnect", "disconnect"]

    client.post(f"/api/sources/{cid}/sync", headers=headers)
    ms = next(s for s in _ctx(client, headers)["sources"] if s["kind"] == "microsoft365")
    access = {a["key"]: a for a in ms["connection"]["access"]}
    assert ms["name"] == "Microsoft 365"
    assert access["mail"]["status"] == "available" and access["calendar"]["status"] == "available"
    t = access["teams_transcripts"]
    assert t["status"] == "admin_required" and t["status_label"] == "Administrator permission required"
    assert "HTTP 403" in t["reason"] and t["ok"] is False
    c = ms["connection"]
    assert c["last_attempted_sync"] and c["last_sync"]["counts"]["signals_new"] >= 1
    h = _ctx(client, headers)["health"]
    assert h["state"] == "partial" and "but not Teams meeting transcripts" in h["summary"]
    assert any("Administrator permission required" in r["text"] or "administrator permission required" in r["text"]
               for r in h["reasons"])


def test_transcripts_turned_off_on_the_server_are_explained(client, session_factory, m365, monkeypatch):
    monkeypatch.setenv("MICROSOFT_ENABLE_TRANSCRIPTS", "false")
    headers = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, headers)
    client.post(f"/api/sources/{cid}/sync", headers=headers)
    c = next(s for s in _ctx(client, headers)["sources"] if s["kind"] == "microsoft365")["connection"]
    assert {a["key"]: a["status"] for a in c["access"]}["teams_transcripts"] == "disabled"


def test_a_colleagues_microsoft_connection_is_never_shown(client, session_factory, m365):
    headers = entra_sign_in(client, session_factory, m365)
    connect_m365(client, session_factory, m365, headers)
    with session_factory() as db:
        org_id = db.scalar(select(User.org_id).where(User.email == "yamini@contoso.example"))
        db.add(User(org_id=org_id, email="dana@contoso.example", name="Dana Ruiz", role="member"))
        db.commit()
    ms = next(s for s in _ctx(client, login(client, "dana@contoso.example"))["sources"] if s["kind"] == "microsoft365")
    assert ms["state"] == "available" and ms["connection"] is None
    assert "yamini@contoso.example" not in str(_ctx(client, login(client, "dana@contoso.example")))


def test_disconnected_source_reads_as_disconnected_and_stops_counting(client, session_factory, m365):
    headers = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, headers)
    client.post(f"/api/sources/{cid}/sync", headers=headers)
    assert client.post(f"/api/sources/{cid}/disconnect", headers=headers).status_code == 200
    ms = next(s for s in _ctx(client, headers)["sources"] if s["kind"] == "microsoft365")
    assert ms["state"] == "available" and ms["connection"]["status"] == "disconnected"
    assert all(a["status"] == "disconnected" for a in ms["connection"]["access"])
    assert "sync" not in ms["connection"]["actions"] and "disconnect" not in ms["connection"]["actions"]
    assert _ctx(client, headers)["health"]["state"] == "not_connected"


def test_members_cannot_disconnect_organization_sources(client, session_factory):
    login(client)
    with session_factory() as db:
        org_id = db.scalar(select(User.org_id).where(User.email == "yamini@acme.example"))
        demo = db.scalar(select(Connector.id).where(Connector.org_id == org_id, Connector.kind == "demo"))
    member = login(client, "marcus@acme.example")
    assert client.post(f"/api/sources/{demo}/disconnect", headers=member).status_code == 403
    assert client.post(f"/api/sources/{demo}/disconnect", headers=login(client)).status_code == 403  # synthetic stays
    d = next(s for s in _ctx(client, member)["sources"] if s["kind"] == "demo")["connection"]
    assert d["actions"] == ["sync"] and all(a["ok"] for a in d["access"])
