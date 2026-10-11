"""Microsoft Entra ID sign-in, multi-tenant (R01–R02, ADR-0011), against a mocked identity provider with real
RS256 signatures and a published key set (JWKS)."""

import time
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select

from rook.identity import IdentityError
from rook.identity.microsoft import CONSUMER_TENANT, EntraIdProvider
from rook.identity.service import safe_return_to
from rook.models import AuthState, ConnectorCredential, Organization, User
from tests.conftest import _complete_oauth, connect_m365, entra_sign_in
from tests.fixtures.m365 import ATTACKER_KEY, CLIENT_ID, ME, OTHER_TENANT, TENANT, id_claims, sign

NONCE = "n-123"


@pytest.fixture()
def provider(m365):
    return EntraIdProvider(transport=m365.transport())


def _sign_in(client, session_factory, m365):
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    return _complete_oauth(client, session_factory, m365, url).headers["location"]


# ---------------------------------------------------------------- authorize request
def test_authorize_url_uses_organizations_authority_pkce_and_state(client, m365):
    r = client.get("/api/auth/microsoft/login", follow_redirects=False)
    loc = r.headers["location"]
    q = parse_qs(urlparse(loc).query)
    assert loc.startswith("https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?")
    assert q["code_challenge_method"] == ["S256"] and q["code_challenge"][0] and q["state"][0] and q["nonce"][0]
    assert "client_secret" not in loc
    assert "Mail.Read" not in q["scope"][0], "sign-in requests identity scopes only"


def test_the_browser_cannot_choose_the_tenant(client, m365):
    loc = client.get(f"/api/auth/microsoft/login?tenant={OTHER_TENANT}&tid={OTHER_TENANT}",
                     follow_redirects=False).headers["location"]
    assert OTHER_TENANT not in loc and "/organizations/" in loc


# ---------------------------------------------------------------- ID token validation (unit)
def test_valid_token_yields_tenant_and_object_identity(provider):
    c = provider.validate_id_token(sign(id_claims(NONCE)), nonce=NONCE)
    assert (c.tenant, c.subject, c.email) == (TENANT, "oid-yamini", ME)


@pytest.mark.parametrize("case, make, reason", [
    ("forged signature", lambda: sign(id_claims(NONCE), key=ATTACKER_KEY), "invalid signature"),
    ("unknown signing key", lambda: sign(id_claims(NONCE), kid="not-published"), "unknown signing key"),
    ("unsigned token", lambda: sign(id_claims(NONCE), alg="HS256", key="x" * 32), "unexpected signing algorithm"),
    ("wrong audience", lambda: sign(id_claims(NONCE, aud="another-app")), "invalid audience"),
    ("wrong issuer", lambda: sign(id_claims(NONCE) | {"iss": f"https://login.microsoftonline.com/{OTHER_TENANT}/v2.0"}),
     "invalid issuer"),
    ("v1 issuer", lambda: sign(id_claims(NONCE) | {"iss": f"https://sts.windows.net/{TENANT}/"}), "invalid issuer"),
    ("personal account tenant", lambda: sign(id_claims(NONCE, tid=CONSUMER_TENANT)), "invalid tenant"),
    ("malformed tenant", lambda: sign(id_claims(NONCE, tid="not-a-guid")), "invalid tenant"),
    ("wrong nonce", lambda: sign(id_claims("other-nonce")), "invalid nonce"),
    ("expired", lambda: sign(id_claims(NONCE) | {"exp": int(time.time()) - 600}), "expired"),
    ("not yet valid", lambda: sign(id_claims(NONCE) | {"nbf": int(time.time()) + 600}), "not yet valid"),
    ("issued in the future", lambda: sign(id_claims(NONCE) | {"iat": int(time.time()) + 600}), "rejected"),
    ("missing object id", lambda: sign({k: v for k, v in id_claims(NONCE).items() if k != "oid"}), "rejected"),
    ("missing tenant", lambda: sign({k: v for k, v in id_claims(NONCE).items() if k != "tid"}), "rejected"),
    ("garbage", lambda: "not.a.jwt", "Malformed"),
])
def test_invalid_tokens_are_rejected(provider, case, make, reason):
    with pytest.raises(IdentityError, match=reason):
        provider.validate_id_token(make(), nonce=NONCE)


def test_expected_tenant_is_enforced(provider):
    with pytest.raises(IdentityError, match="invalid tenant"):
        provider.validate_id_token(sign(id_claims(NONCE)), nonce=NONCE, expected_tenant=OTHER_TENANT)


def test_tenant_allow_list(provider, monkeypatch):
    monkeypatch.setenv("MICROSOFT_ALLOWED_TENANT_IDS", OTHER_TENANT)
    with pytest.raises(IdentityError, match="not enabled on this ROOK server"):
        provider.validate_id_token(sign(id_claims(NONCE)), nonce=NONCE)
    monkeypatch.setenv("MICROSOFT_ALLOWED_TENANT_IDS", f"{OTHER_TENANT}, {TENANT}")
    assert provider.validate_id_token(sign(id_claims(NONCE)), nonce=NONCE).tenant == TENANT


def test_legacy_single_tenant_setting_still_restricts(provider, monkeypatch):
    monkeypatch.setenv("MICROSOFT_TENANT_ID", OTHER_TENANT)  # an old deployment never silently opens up
    with pytest.raises(IdentityError, match="not enabled"):
        provider.validate_id_token(sign(id_claims(NONCE)), nonce=NONCE)


def test_sign_in_name_wins_over_editable_email_claim(provider):
    claims = id_claims(NONCE, email="real@contoso.example") | {"email": "ceo@victim.example"}
    assert provider.validate_id_token(sign(claims), nonce=NONCE).email == "real@contoso.example"


# ---------------------------------------------------------------- end-to-end flow
def test_forged_token_in_the_callback_signs_nobody_in(client, session_factory, m365):
    m365.tamper = lambda claims: sign(claims, key=ATTACKER_KEY)
    assert "/login?error=" in _sign_in(client, session_factory, m365)
    with session_factory() as db:
        assert db.scalar(select(User).where(User.email == ME)) is None


def test_personal_account_cannot_sign_in(client, session_factory, m365):
    m365.tid = CONSUMER_TENANT
    assert "invalid%20tenant" in _sign_in(client, session_factory, m365)


def test_unknown_tenant_is_refused_when_an_allow_list_is_set(client, session_factory, m365, monkeypatch):
    monkeypatch.setenv("MICROSOFT_ALLOWED_TENANT_IDS", TENANT)
    m365.tid = OTHER_TENANT
    assert "not%20enabled" in _sign_in(client, session_factory, m365)
    with session_factory() as db:
        assert db.scalar(select(Organization).where(Organization.tenant_id == OTHER_TENANT)) is None


def test_first_user_of_a_new_tenant_owns_a_new_organization_in_setup(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    me = client.get("/api/me", headers=h).json()
    assert me["user"]["email"] == ME and me["user"]["role"] == "admin"
    org = me["org"]
    assert org["name"] == "Contoso" and org["status"] == "setup" and org["setup_required"] and org["is_owner"]
    assert org["is_demo"] is False
    actions = [a["action"] for a in client.get("/api/audit", headers=h).json()]
    assert {"org.provisioned", "user.provisioned", "auth.login"} <= set(actions)
    # second sign-in reuses the same user (matched by tenant + object id)
    entra_sign_in(client, session_factory, m365)
    with session_factory() as db:
        assert db.query(User).filter_by(email=ME).count() == 1


def test_later_users_of_the_same_tenant_join_as_members(client, session_factory, m365):
    owner = entra_sign_in(client, session_factory, m365)
    m365.oid, m365.email, m365.display_name = "oid-marcus", "marcus@contoso.example", "Marcus Chen"
    member = entra_sign_in(client, session_factory, m365)
    a, b = client.get("/api/me", headers=owner).json(), client.get("/api/me", headers=member).json()
    assert a["org"]["id"] == b["org"]["id"]
    assert b["user"]["role"] == "member" and b["org"]["setup_required"] is False and b["org"]["is_owner"] is False


def test_different_tenants_get_isolated_organizations(client, session_factory, m365):
    a = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    m365.tid, m365.oid, m365.email = OTHER_TENANT, "oid-fabrikam", "ana@fabrikam.example"
    b = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    assert a["org"]["id"] != b["org"]["id"] and b["org"]["name"] == "Fabrikam" and b["user"]["role"] == "admin"


def test_same_email_in_two_tenants_is_two_separate_users(client, session_factory, m365):
    a = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    m365.tid, m365.oid = OTHER_TENANT, "oid-other"  # same sign-in name, different tenant
    b = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    assert a["user"]["email"] == b["user"]["email"] == ME
    assert a["user"]["id"] != b["user"]["id"] and a["org"]["id"] != b["org"]["id"]


def test_a_new_object_id_never_takes_over_an_account_by_email(client, session_factory, m365):
    first = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    m365.oid = "oid-impostor"  # same tenant, same email, different person
    assert "/login?error=" in _sign_in(client, session_factory, m365)
    with session_factory() as db:
        u = db.get(User, first["user"]["id"])
        assert u.external_subject == "microsoft:oid-yamini"


def test_changed_email_claim_keeps_the_same_account(client, session_factory, m365):
    first = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    m365.email = "yamini.d@contoso.example"  # renamed in the tenant; same object id
    again = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    assert again["user"]["id"] == first["user"]["id"] and again["user"]["email"] == "yamini.d@contoso.example"


def test_admin_emails_are_ignored_in_production(client, session_factory, m365, monkeypatch):
    entra_sign_in(client, session_factory, m365)
    monkeypatch.setenv("ROOK_ADMIN_EMAILS", "marcus@contoso.example")
    monkeypatch.setenv("ROOK_ENVIRONMENT", "production")
    m365.oid, m365.email = "oid-marcus", "marcus@contoso.example"
    member = entra_sign_in(client, session_factory, m365)
    assert client.get("/api/me", headers=member).json()["user"]["role"] == "member"


def test_admin_approval_join_policy_blocks_new_members(client, session_factory, m365):
    entra_sign_in(client, session_factory, m365)
    with session_factory() as db:
        db.scalar(select(Organization).where(Organization.tenant_id == TENANT)).join_policy = "approval"
        db.commit()
    m365.oid, m365.email = "oid-new", "new@contoso.example"
    assert "administrator%20approval" in _sign_in(client, session_factory, m365)


def test_state_is_single_use(client, session_factory, m365):
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "/auth/complete" in _complete_oauth(client, session_factory, m365, url).headers["location"]
    state = parse_qs(urlparse(url).query)["state"][0]
    replay = client.get(f"/api/auth/microsoft/callback?code=good-code&state={state}", follow_redirects=False)
    assert "/login?error=" in replay.headers["location"]


def test_bad_code_and_error_responses_rejected(client, session_factory, m365):
    url = client.get("/api/auth/microsoft/login", follow_redirects=False).headers["location"]
    assert "invalid_grant" in _complete_oauth(client, session_factory, m365, url, code="bad").headers["location"]
    r = client.get("/api/auth/microsoft/callback?error=access_denied&state=x", follow_redirects=False)
    assert "/login?error=access_denied" in r.headers["location"]
    r = client.get("/api/auth/microsoft/callback?code=good-code&state=never-issued", follow_redirects=False)
    assert "/login?error=" in r.headers["location"]


def test_open_redirects_blocked():
    assert safe_return_to("https://evil.example") == "/"
    assert safe_return_to("//evil.example") == "/"
    assert safe_return_to("/meetings") == "/meetings"


def test_unconfigured_provider_reports_503(client, monkeypatch):
    monkeypatch.delenv("MICROSOFT_CLIENT_ID", raising=False)
    assert client.get("/api/auth/microsoft/login", follow_redirects=False).status_code == 503
    providers = client.get("/api/auth/providers").json()
    assert providers["providers"][0]["configured"] is False


def test_tenant_id_is_not_required_for_multi_tenant_sign_in(client, m365, monkeypatch):
    monkeypatch.delenv("MICROSOFT_TENANT_ID", raising=False)
    assert client.get("/api/auth/providers").json()["providers"][0]["configured"] is True


# ---------------------------------------------------------------- organization setup
def test_owner_completes_setup_members_cannot(client, session_factory, m365):
    owner = entra_sign_in(client, session_factory, m365)
    m365.oid, m365.email = "oid-marcus", "marcus@contoso.example"
    member = entra_sign_in(client, session_factory, m365)
    assert client.post("/api/org/setup", json={"name": "Hacked"}, headers=member).status_code == 403
    r = client.post("/api/org/setup", json={"name": "  Contoso   Ltd "}, headers=owner)
    assert r.status_code == 200 and r.json()["name"] == "Contoso Ltd" and r.json()["status"] == "active"
    assert client.get("/api/me", headers=owner).json()["org"]["setup_required"] is False
    assert client.post("/api/org/setup", json={"name": "  "}, headers=owner).status_code == 422


# ---------------------------------------------------------------- connecting Microsoft 365
def test_connect_uses_the_users_own_tenant_and_stores_scoped_encrypted_tokens(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    url = client.post("/api/sources/microsoft365/connect", headers=h).json()["authorization_url"]
    assert url.startswith(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/authorize?")
    cid = connect_m365(client, session_factory, m365, h)
    assert m365.authorities[-1] == TENANT
    with session_factory() as db:
        cred = db.query(ConnectorCredential).filter_by(connector_id=cid).one()
        assert cred.access_token_enc and "at-" not in cred.access_token_enc and "rt-1" not in cred.refresh_token_enc
        assert cred.tenant_id == TENANT and cred.external_subject == "microsoft:oid-yamini"
        assert "Mail.Read" in cred.scopes and "Mail.Send" not in cred.scopes
        assert db.query(AuthState).count() == 1  # only the unused authorize request above remains (it expires)


def test_connect_rejects_another_tenants_identity(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    url = client.post("/api/sources/microsoft365/connect", headers=h).json()["authorization_url"]
    m365.tid = OTHER_TENANT
    loc = _complete_oauth(client, session_factory, m365, url).headers["location"]
    assert "invalid%20tenant" in loc
    with session_factory() as db:
        assert db.query(ConnectorCredential).count() == 0


def test_connect_rejects_another_users_identity(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    url = client.post("/api/sources/microsoft365/connect", headers=h).json()["authorization_url"]
    m365.oid = "oid-someone-else"  # same tenant and even the same email: still not this user
    loc = _complete_oauth(client, session_factory, m365, url).headers["location"]
    assert "Connect%20the%20Microsoft%20365%20account%20you%20signed%20in%20with" in loc
    with session_factory() as db:
        assert db.query(ConnectorCredential).count() == 0


def test_demo_users_cannot_start_a_microsoft_connection(client):
    from tests.conftest import login

    r = client.post("/api/sources/microsoft365/connect", headers=login(client))
    assert r.status_code in (409, 503)


def test_refresh_uses_the_granting_tenant(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    with session_factory() as db:
        cred = db.query(ConnectorCredential).filter_by(connector_id=cid).one()
        cred.expires_at = None  # force a refresh
        db.commit()
    assert client.post(f"/api/sources/{cid}/sync", headers=h).status_code == 200
    assert m365.refreshes == 1 and m365.authorities[-1] == TENANT


def test_credentials_without_a_matching_tenant_are_not_used(client, session_factory, m365):
    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    with session_factory() as db:
        db.query(ConnectorCredential).filter_by(connector_id=cid).one().tenant_id = OTHER_TENANT
        db.commit()
    m365.graph_calls.clear()
    r = client.post(f"/api/sources/{cid}/sync", headers=h)
    assert r.status_code == 409 and "Reconnect" in r.text
    assert not m365.graph_calls


def test_client_id_is_the_only_audience(provider, monkeypatch):
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", "11111111-0000-0000-0000-000000000000")
    with pytest.raises(IdentityError, match="audience"):
        provider.validate_id_token(sign(id_claims(NONCE, aud=CLIENT_ID)), nonce=NONCE)


def test_directory_mailbox_address_is_used_for_source_access_matching(client, session_factory, m365):
    m365.email, m365.mail = "y.devasena@contoso.onmicrosoft.example", ME  # sign-in name differs from the mailbox
    me = client.get("/api/me", headers=entra_sign_in(client, session_factory, m365)).json()
    assert me["user"]["email"] == ME
