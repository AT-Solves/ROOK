"""Microsoft Entra ID sign-in (R01–R02) against a mocked identity provider."""

from urllib.parse import parse_qs, urlparse

from rook.identity.service import safe_return_to
from rook.models import AuthState, ConnectorCredential, User
from tests.conftest import _complete_oauth, connect_m365, entra_sign_in
from tests.fixtures.m365 import ME


def test_authorize_url_uses_pkce_and_state(client, m365):
    r = client.get("/api/auth/microsoft/login", follow_redirects=False)
    q = parse_qs(urlparse(r.headers["location"]).query)
    assert r.headers["location"].startswith("https://login.microsoftonline.com/")
    assert q["code_challenge_method"] == ["S256"] and q["code_challenge"][0] and q["state"][0] and q["nonce"][0]
    assert "client_secret" not in r.headers["location"]
    assert "Mail.Read" not in q["scope"][0], "sign-in requests identity scopes only"


def test_sign_in_provisions_org_admin_and_audits(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    me = client.get("/api/me", headers=h).json()
    assert me["user"]["email"] == ME and me["user"]["role"] == "admin" and me["org"]["name"] == "Contoso"
    actions = [a["action"] for a in client.get("/api/audit", headers=h).json()]
    assert {"org.provisioned", "user.provisioned", "auth.login"} <= set(actions)
    # second sign-in reuses the same user (matched by stable subject)
    entra_sign_in(client, session_factory, m365)
    with session_factory() as db:
        assert db.query(User).filter_by(email=ME).count() == 1


def test_state_is_single_use(client, session_factory, m365):
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "/auth/complete" in _complete_oauth(client, session_factory, m365, url).headers["location"]
    state = parse_qs(urlparse(url).query)["state"][0]
    replay = client.get(f"/api/auth/microsoft/callback?code=good-code&state={state}", follow_redirects=False)
    assert "/login?error=" in replay.headers["location"]


def test_wrong_tenant_and_bad_code_rejected(client, session_factory, m365):
    m365.tid = "99999999-0000-0000-0000-000000000000"
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "invalid%20tenant" in _complete_oauth(client, session_factory, m365, url).headers["location"]
    m365.tid = parse_qs(urlparse(url).query)  # reset below
    from tests.fixtures.m365 import TENANT

    m365.tid = TENANT
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "invalid_grant" in _complete_oauth(client, session_factory, m365, url, code="bad").headers["location"]


def test_open_redirects_blocked():
    assert safe_return_to("https://evil.example") == "/"
    assert safe_return_to("//evil.example") == "/"
    assert safe_return_to("/meetings") == "/meetings"


def test_unconfigured_provider_reports_503(client, monkeypatch):
    monkeypatch.delenv("MICROSOFT_CLIENT_ID", raising=False)
    assert client.get("/api/auth/microsoft/login", follow_redirects=False).status_code == 503
    providers = client.get("/api/auth/providers").json()
    assert providers["providers"][0]["configured"] is False


def test_connect_stores_encrypted_tokens(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    with session_factory() as db:
        cred = db.query(ConnectorCredential).filter_by(connector_id=cid).one()
        assert cred.access_token_enc and "at-1" not in cred.access_token_enc and "rt-1" not in cred.refresh_token_enc
        assert "Mail.Read" in cred.scopes and "Mail.Send" not in cred.scopes  # send scope only when enabled
        assert db.query(AuthState).count() == 0
