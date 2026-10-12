"""Personal Microsoft accounts (ADR-0012): off by default; when enabled, one private workspace per account.

The fake Microsoft publishes two key sets, like the real one: ``common`` (work and school) and ``consumers``
(personal accounts). Personal tokens carry Microsoft's personal-accounts tenant id and are signed with the consumers key.
"""

import time
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import StaticPool

from rook.db import init_db
from rook.identity import IdentityError
from rook.identity.microsoft import EntraIdProvider
from rook.models import Connector, ConnectorCredential, Organization, Signal, User
from tests.conftest import _complete_oauth, connect_m365, entra_sign_in
from tests.fixtures.m365 import (
    ATTACKER_KEY,
    CONSUMER_TENANT,
    ME,
    OTHER_TENANT,
    TENANT,
    id_claims,
    sign,
    sign_personal,
)

NONCE = "n-personal"


@pytest.fixture()
def personal_on(monkeypatch):
    monkeypatch.setenv("MICROSOFT_ALLOW_PERSONAL_ACCOUNTS", "true")


@pytest.fixture()
def provider(m365):
    return EntraIdProvider(transport=m365.transport())


def as_personal(m365, oid="oid-ana", email="ana@outlook.example", name="Ana Silva"):
    m365.tid, m365.oid, m365.email, m365.display_name = CONSUMER_TENANT, oid, email, name


def _personal(**kw) -> dict:
    return id_claims(NONCE, tid=CONSUMER_TENANT, oid="oid-ana", email="ana@outlook.example", **kw)


def _me(client, headers):
    return client.get("/api/me", headers=headers).json()


# ---------------------------------------------------------------- off by default
def test_personal_accounts_are_off_by_default(client, provider):
    with pytest.raises(IdentityError, match="personal Microsoft accounts cannot sign in"):
        provider.validate_id_token(sign_personal(_personal()), nonce=NONCE)
    assert client.get("/api/auth/providers").json()["providers"][0]["personal_accounts"] is False
    loc = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "/organizations/oauth2/v2.0/authorize" in loc  # unchanged work/school sign-in


def test_personal_sign_in_refused_when_disabled(client, session_factory, m365):
    as_personal(m365)
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "personal%20Microsoft%20accounts%20cannot%20sign%20in" in _complete_oauth(
        client, session_factory, m365, url).headers["location"]
    with session_factory() as db:
        assert db.scalar(select(Organization).where(Organization.account_type == "personal")) is None


# ---------------------------------------------------------------- token validation when enabled
def test_personal_token_accepted_when_enabled(personal_on, client, provider):
    c = provider.validate_id_token(sign_personal(_personal()), nonce=NONCE)
    assert c.personal is True and c.tenant == CONSUMER_TENANT and c.subject == "oid-ana"
    assert client.get("/api/auth/providers").json()["providers"][0]["personal_accounts"] is True
    loc = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert loc.startswith("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?")


@pytest.mark.parametrize("case, make, reason", [
    ("forged signature", lambda: sign(_personal(), key=ATTACKER_KEY), "invalid signature|unknown signing key"),
    ("signed with the work-account key set", lambda: sign(_personal()), "invalid signing key for a personal account"),
    ("wrong audience", lambda: sign_personal(_personal(aud="another-app")), "invalid audience"),
    ("wrong issuer", lambda: sign_personal(_personal() | {"iss": f"https://login.microsoftonline.com/{TENANT}/v2.0"}),
     "invalid issuer"),
    ("expired", lambda: sign_personal(_personal() | {"exp": int(time.time()) - 600}), "expired"),
    ("wrong nonce", lambda: sign_personal(id_claims("other", tid=CONSUMER_TENANT, oid="oid-ana")), "invalid nonce"),
    ("missing object id", lambda: sign_personal({k: v for k, v in _personal().items() if k != "oid"}), "rejected"),
])
def test_invalid_personal_tokens_rejected(personal_on, provider, case, make, reason):
    with pytest.raises(IdentityError, match=reason):
        provider.validate_id_token(make(), nonce=NONCE)


def test_work_token_signed_with_the_personal_key_set_is_rejected(personal_on, provider):
    with pytest.raises(IdentityError, match="invalid signing key for a work or school account"):
        provider.validate_id_token(sign_personal(id_claims(NONCE)), nonce=NONCE)


def test_work_allow_list_still_enforced_and_does_not_govern_personal_accounts(personal_on, provider, monkeypatch):
    monkeypatch.setenv("MICROSOFT_ALLOWED_TENANT_IDS", OTHER_TENANT)
    with pytest.raises(IdentityError, match="not enabled on this ROOK server"):
        provider.validate_id_token(sign(id_claims(NONCE)), nonce=NONCE)  # work tenant not on the list
    assert provider.validate_id_token(sign_personal(_personal()), nonce=NONCE).personal  # personal unaffected


# ---------------------------------------------------------------- workspaces
def test_each_personal_account_gets_its_own_private_workspace(personal_on, client, session_factory, m365):
    as_personal(m365)
    a = _me(client, entra_sign_in(client, session_factory, m365))
    as_personal(m365, oid="oid-ben", email="ben@hotmail.example", name="Ben Okoro")
    b = _me(client, entra_sign_in(client, session_factory, m365))
    assert a["org"]["id"] != b["org"]["id"]
    for me, name in ((a, "Ana's workspace"), (b, "Ben's workspace")):
        assert me["org"]["account_type"] == "personal" and me["org"]["name"] == name
        assert me["user"]["role"] == "admin" and me["org"]["is_owner"] and me["org"]["setup_required"]
    with session_factory() as db:
        orgs = db.scalars(select(Organization).where(Organization.account_type == "personal")).all()
        assert {o.external_key for o in orgs} == {"microsoft:personal:oid-ana", "microsoft:personal:oid-ben"}
        assert all(o.tenant_id is None and o.join_policy == "closed" for o in orgs)
        assert db.query(Organization).filter_by(tenant_id=CONSUMER_TENANT).count() == 0  # no shared personal org
    assert not any("/organization" in p for p in m365.graph_calls)  # no Graph /organization call for personal setup


def test_another_personal_account_never_joins_a_personal_workspace(personal_on, client, session_factory, m365):
    as_personal(m365)
    a = _me(client, entra_sign_in(client, session_factory, m365))
    as_personal(m365, oid="oid-other", email="ana@outlook.example", name="Ana Silva")  # same email and name
    b = _me(client, entra_sign_in(client, session_factory, m365))
    assert a["org"]["id"] != b["org"]["id"] and a["user"]["id"] != b["user"]["id"]
    with session_factory() as db:
        assert db.query(User).filter_by(org_id=a["org"]["id"]).count() == 1


def test_same_email_as_work_and_personal_identity_stays_separate(personal_on, client, session_factory, m365):
    work = _me(client, entra_sign_in(client, session_factory, m365))
    as_personal(m365, oid="oid-yamini-personal", email=ME, name="Yamini Devasena")
    personal = _me(client, entra_sign_in(client, session_factory, m365))
    assert work["user"]["email"] == personal["user"]["email"] == ME
    assert work["user"]["id"] != personal["user"]["id"] and work["org"]["id"] != personal["org"]["id"]
    assert work["org"]["account_type"] == "organization" and personal["org"]["account_type"] == "personal"


def test_changed_email_keeps_the_personal_identity(personal_on, client, session_factory, m365):
    as_personal(m365)
    first = _me(client, entra_sign_in(client, session_factory, m365))
    as_personal(m365, email="ana.silva@outlook.example")
    again = _me(client, entra_sign_in(client, session_factory, m365))
    assert again["user"]["id"] == first["user"]["id"] and again["user"]["email"] == "ana.silva@outlook.example"


def test_owner_completes_personal_setup(personal_on, client, session_factory, m365):
    as_personal(m365)
    h = entra_sign_in(client, session_factory, m365)
    r = client.post("/api/org/setup", json={"name": "Ana's ROOK"}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "active" and r.json()["account_type"] == "personal"


# ---------------------------------------------------------------- connecting Microsoft 365
def _connect_personal(client, session_factory, m365):
    as_personal(m365)
    h = entra_sign_in(client, session_factory, m365)
    url = client.post("/api/sources/microsoft365/connect", headers=h).json()["authorization_url"]
    return h, url


def test_personal_connect_uses_consumers_and_only_supported_scopes(personal_on, client, session_factory, m365):
    h, url = _connect_personal(client, session_factory, m365)
    assert url.startswith("https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?")
    scopes = set(parse_qs(urlparse(url).query)["scope"][0].split())
    assert scopes == {"openid", "profile", "email", "offline_access", "User.Read", "Mail.Read", "Calendars.Read"}
    cid = connect_m365(client, session_factory, m365, h)
    assert m365.authorities[-1] == "consumers"
    token_scopes = set(m365.token_scopes[-1].split())
    assert not token_scopes & {"OnlineMeetings.Read", "OnlineMeetingTranscript.Read.All", "Mail.Send"}
    with session_factory() as db:
        cred = db.query(ConnectorCredential).filter_by(connector_id=cid).one()
        assert cred.tenant_id == CONSUMER_TENANT and cred.external_subject == "microsoft:oid-ana"


def test_personal_sync_reads_mail_and_calendar_but_never_teams(personal_on, client, session_factory, m365):
    h, _ = _connect_personal(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    m365.graph_calls.clear()
    r = client.post(f"/api/sources/{cid}/sync", headers=h)
    assert r.status_code == 200 and r.json()["signals_new"] >= 1 and r.json()["meetings_upserted"] >= 1
    assert "/me/messages" in m365.graph_calls and "/me/calendarView" in m365.graph_calls
    assert not any("onlineMeetings" in c for c in m365.graph_calls)
    with session_factory() as db:
        assert db.query(Signal).filter_by(connector_id=cid, kind="meeting_transcript").count() == 0


def test_personal_teams_capability_reported_unavailable(personal_on, client, session_factory, m365):
    h, _ = _connect_personal(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)

    def transcripts():
        ctx = client.get("/api/context", headers=h).json()
        ms = next(s for s in ctx["sources"] if s["kind"] == "microsoft365")
        return {a["key"]: a for a in ms["connection"]["access"]}

    before = transcripts()  # before any sync: never "administrator permission required"
    assert before["teams_transcripts"]["status"] == "unavailable"
    assert before["teams_transcripts"]["reason"] == "Not available for personal Microsoft accounts."
    client.post(f"/api/sources/{cid}/sync", headers=h)
    after = transcripts()
    assert after["teams_transcripts"]["status"] == "unavailable"
    assert after["mail"]["status"] == "available" and after["calendar"]["status"] == "available"


def test_personal_refresh_uses_consumers(personal_on, client, session_factory, m365):
    h, _ = _connect_personal(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    with session_factory() as db:
        db.query(ConnectorCredential).filter_by(connector_id=cid).one().expires_at = None
        db.commit()
    assert client.post(f"/api/sources/{cid}/sync", headers=h).status_code == 200
    assert m365.refreshes == 1 and m365.authorities[-1] == "consumers"
    assert "OnlineMeetings.Read" not in m365.token_scopes[-1]


@pytest.mark.parametrize("swap", ["tid", "oid"])
def test_personal_connect_rejects_another_identity(personal_on, client, session_factory, m365, swap):
    h, url = _connect_personal(client, session_factory, m365)
    if swap == "tid":
        m365.tid = TENANT  # a work account comes back instead of the personal one
    else:
        m365.oid = "oid-someone-else"
    loc = _complete_oauth(client, session_factory, m365, url).headers["location"]
    assert "/login?error=" in loc
    with session_factory() as db:
        assert db.query(ConnectorCredential).count() == 0


# ---------------------------------------------------------------- isolation between personal workspaces
def test_personal_account_cannot_reach_another_personal_workspace(personal_on, client, session_factory, m365):
    h_a, _ = _connect_personal(client, session_factory, m365)
    cid_a = connect_m365(client, session_factory, m365, h_a)
    client.post(f"/api/sources/{cid_a}/sync", headers=h_a)
    as_personal(m365, oid="oid-ben", email="ben@hotmail.example", name="Ben Okoro")
    h_b = entra_sign_in(client, session_factory, m365)
    with session_factory() as db:
        sig_a = db.scalar(select(Signal.id).where(Signal.connector_id == cid_a))
    assert client.get(f"/api/signals/{sig_a}", headers=h_b).status_code == 404
    assert client.post(f"/api/sources/{cid_a}/sync", headers=h_b).status_code == 404
    assert client.post(f"/api/sources/{cid_a}/disconnect", headers=h_b).status_code == 404
    assert client.get("/api/meetings", headers=h_b).json() == []
    assert "ana@outlook.example" not in client.get("/api/context", headers=h_b).text
    with session_factory() as db:
        assert db.get(Connector, cid_a).status == "connected"


def test_disabling_personal_accounts_blocks_existing_personal_sign_in(client, session_factory, m365, monkeypatch):
    monkeypatch.setenv("MICROSOFT_ALLOW_PERSONAL_ACCOUNTS", "true")
    as_personal(m365)
    entra_sign_in(client, session_factory, m365)
    monkeypatch.setenv("MICROSOFT_ALLOW_PERSONAL_ACCOUNTS", "false")
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "/login?error=" in _complete_oauth(client, session_factory, m365, url).headers["location"]


# ---------------------------------------------------------------- database upgrade
def test_upgrade_backfills_external_keys_idempotently():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.begin() as c:  # an organizations table from after ADR-0011, before ADR-0012
        c.execute(text("CREATE TABLE organizations (id INTEGER PRIMARY KEY, name VARCHAR(200), slug VARCHAR(100) UNIQUE, "
                       "external_ref VARCHAR(200) UNIQUE, identity_provider VARCHAR(40), tenant_id VARCHAR(64), "
                       "status VARCHAR(20), created_by INTEGER, setup_completed_at TIMESTAMP, is_demo BOOLEAN, "
                       "join_policy VARCHAR(20), ai_policy JSON, created_at TIMESTAMP)"))
        c.execute(text("INSERT INTO organizations (id, name, slug, external_ref, identity_provider, tenant_id, status, "
                       "is_demo, join_policy, ai_policy) VALUES "
                       f"(1, 'Contoso', 'org-1', 'entra:{TENANT}', 'microsoft', '{TENANT}', 'active', 0, 'auto', '{{}}'), "
                       "(2, 'Acme Robotics', 'acme', NULL, NULL, NULL, 'active', 1, 'auto', '{}')"))
    init_db(engine)
    init_db(engine)  # idempotent
    assert {"account_type", "external_key"} <= {c["name"] for c in inspect(engine).get_columns("organizations")}
    with engine.connect() as c:
        rows = c.execute(text("SELECT id, account_type, external_key FROM organizations ORDER BY id")).all()
    assert [tuple(r) for r in rows] == [(1, "organization", f"microsoft:tenant:{TENANT}"), (2, "organization", None)]
    with engine.begin() as c:  # the identity key is unique
        with pytest.raises(IntegrityError):
            c.execute(text("INSERT INTO organizations (id, name, slug, external_key, ai_policy) "
                           f"VALUES (3, 'Dup', 'dup', 'microsoft:tenant:{TENANT}', '{{}}')"))


def test_work_sign_in_finds_an_organization_not_yet_backfilled(client, session_factory, m365):
    first = _me(client, entra_sign_in(client, session_factory, m365))
    with session_factory() as db:
        db.get(Organization, first["org"]["id"]).external_key = None
        db.commit()
    again = _me(client, entra_sign_in(client, session_factory, m365))
    assert again["org"]["id"] == first["org"]["id"] and again["user"]["id"] == first["user"]["id"]
    with session_factory() as db:
        assert db.get(Organization, first["org"]["id"]).external_key == f"microsoft:tenant:{TENANT}"
