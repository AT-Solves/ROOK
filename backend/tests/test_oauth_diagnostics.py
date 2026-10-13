"""Microsoft OAuth failures are diagnosable from the logs without exposing credentials.

Synthetic Microsoft error replies only. Every test checks both what IS logged (an allow-list of shape-checked fields)
and that no secret value appears anywhere in any log record, formatted or raw.
"""

import logging
from urllib.parse import parse_qs, unquote, urlparse

import httpx
import pytest
from sqlalchemy import select

from rook.logging import JsonFormatter
from rook.models import AuthState, ConnectorCredential
from tests.conftest import _complete_oauth, connect_m365, entra_sign_in

TRACE = "0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0"
CORRELATION = "11111111-2222-4333-8444-555555555555"
SECRETS = ["test-secret-not-real",  # MICROSOFT_CLIENT_SECRET in the m365 fixture
           "SECRET_AUTH_CODE", "SECRET_ACCESS_TOKEN", "SECRET_REFRESH_TOKEN", "SECRET_ID_TOKEN",
           "SECRET_BEARER", "SECRET_COOKIE", "Invalid client secret provided"]  # last: raw description text
DESCRIPTION = (f"AADSTS7000215: Invalid client secret provided. client_secret=test-secret-not-real "
               f"code=SECRET_AUTH_CODE https://localhost:8000/api/auth/microsoft/callback?code=SECRET_AUTH_CODE "
               f"Trace ID: {TRACE} Correlation ID: {CORRELATION} Timestamp: 2026-10-13 07:00:00Z")


def _invalid_client(request: httpx.Request) -> httpx.Response:
    """Microsoft's token endpoint rejecting the client; the reply also echoes token-like values it must never log."""
    return httpx.Response(401, json={
        "error": "invalid_client", "error_description": DESCRIPTION, "error_codes": [7000215],
        "timestamp": "2026-10-13 07:00:00Z", "trace_id": TRACE, "correlation_id": CORRELATION,
        "access_token": "SECRET_ACCESS_TOKEN", "refresh_token": "SECRET_REFRESH_TOKEN", "id_token": "SECRET_ID_TOKEN"})


def _diagnostics(caplog) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "rook.identity" and r.getMessage() == "Microsoft OAuth failure"]


def _assert_no_secrets(caplog, extra: list[str]) -> None:
    fmt = JsonFormatter()
    for record in caplog.records:
        if record.name == "httpx2":
            continue  # Starlette's TestClient (the simulated browser) logging its own request; not ROOK's logs
        for text in (fmt.format(record), record.getMessage(), repr(record.__dict__)):
            for secret in SECRETS + extra:
                assert secret not in text, f"{secret!r} leaked in {record.name}"


@pytest.fixture()
def personal_on(monkeypatch):
    monkeypatch.setenv("MICROSOFT_ALLOW_PERSONAL_ACCOUNTS", "true")


@pytest.fixture()
def logs(caplog):
    caplog.set_level(logging.INFO)
    return caplog


def _start(client, account="work") -> tuple[str, str]:
    url = client.get(f"/api/auth/microsoft/login?account={account}", follow_redirects=False).headers["location"]
    return url, parse_qs(urlparse(url).query)["state"][0]


def _pending(session_factory, state) -> tuple[str, str]:
    with session_factory() as db:
        st = db.scalar(select(AuthState).where(AuthState.state == state))
        return st.nonce, st.code_verifier


# ---------------------------------------------------------------- token exchange
def test_invalid_client_at_token_exchange_is_diagnosable_without_secrets(client, session_factory, m365, logs):
    _, state = _start(client)
    nonce, verifier = _pending(session_factory, state)
    m365._token = _invalid_client
    r = client.get(f"/api/auth/microsoft/callback?code=SECRET_AUTH_CODE&state={state}", follow_redirects=False,
                   headers={"Authorization": "Bearer SECRET_BEARER", "Cookie": "session=SECRET_COOKIE"})

    # user-facing behaviour unchanged: only the OAuth error word reaches the browser
    assert unquote(r.headers["location"]).endswith("/login?error=Microsoft sign-in failed: invalid_client")

    [record] = _diagnostics(logs)
    logged = JsonFormatter().format(record)
    for key, value in {"provider": "microsoft", "operation": "token_exchange", "account": "work",
                       "oauth_error": "invalid_client", "aadsts_code": "AADSTS7000215", "http_status": 401,
                       "microsoft_request_id": TRACE, "microsoft_correlation_id": CORRELATION}.items():
        assert getattr(record, key) == value
        assert f'"{key}": ' in logged
    assert record.levelno == logging.WARNING
    _assert_no_secrets(logs, [state, nonce, verifier, "error_description", "Timestamp"])


def test_aadsts_and_ids_are_read_from_the_description_when_not_given_separately(client, session_factory, m365, logs):
    _, state = _start(client, account="work")
    m365._token = lambda request: httpx.Response(400, json={"error": "invalid_grant", "error_description": DESCRIPTION})
    done = client.get(f"/api/auth/microsoft/callback?code=SECRET_AUTH_CODE&state={state}", follow_redirects=False)
    assert "invalid_grant" in unquote(done.headers["location"])
    [record] = _diagnostics(logs)
    assert (record.oauth_error, record.aadsts_code) == ("invalid_grant", "AADSTS7000215")
    assert (record.microsoft_request_id, record.microsoft_correlation_id) == (TRACE, CORRELATION)
    _assert_no_secrets(logs, [state])


def test_personal_flow_is_labelled_and_unshaped_values_are_dropped(personal_on, client, session_factory, m365, logs):
    _, state = _start(client, account="personal")
    m365._token = lambda request: httpx.Response(400, json={
        "error": "Bad <script>SECRET_AUTH_CODE</script>", "error_codes": ["SECRET_ID_TOKEN"],
        "trace_id": "not-a-guid SECRET_ACCESS_TOKEN", "correlation_id": {"x": "SECRET_REFRESH_TOKEN"}})
    client.get(f"/api/auth/microsoft/callback?code=SECRET_AUTH_CODE&state={state}", follow_redirects=False)
    [record] = _diagnostics(logs)
    assert record.account == "personal" and record.oauth_error == "unrecognized" and record.http_status == 400
    for key in ("aadsts_code", "microsoft_request_id", "microsoft_correlation_id"):
        assert not hasattr(record, key)
    _assert_no_secrets(logs, [state])


def test_non_json_failure_logs_status_only(client, session_factory, m365, logs):
    _, state = _start(client)
    m365._token = lambda request: httpx.Response(502, text="<html>SECRET_ACCESS_TOKEN</html>")
    client.get(f"/api/auth/microsoft/callback?code=SECRET_AUTH_CODE&state={state}", follow_redirects=False)
    [record] = _diagnostics(logs)
    assert record.http_status == 502 and not hasattr(record, "oauth_error")
    _assert_no_secrets(logs, [state])


def test_refresh_failure_is_labelled_without_the_refresh_token(client, session_factory, m365, logs):
    h = entra_sign_in(client, session_factory, m365)
    cid = connect_m365(client, session_factory, m365, h)
    with session_factory() as db:
        db.query(ConnectorCredential).filter_by(connector_id=cid).one().expires_at = None  # force a refresh
        db.commit()
    m365._token = _invalid_client
    client.post(f"/api/sources/{cid}/sync", headers=h)
    [record] = _diagnostics(logs)
    assert (record.operation, record.oauth_error, record.aadsts_code) == ("token_refresh", "invalid_client", "AADSTS7000215")
    _assert_no_secrets(logs, ["rt-1"])  # the stored refresh token sent in the failed refresh


# ---------------------------------------------------------------- authorization callback
def test_callback_error_from_microsoft_is_diagnosable_without_the_query(client, session_factory, m365, logs):
    _, state = _start(client, account="work")
    nonce, verifier = _pending(session_factory, state)
    r = client.get("/api/auth/microsoft/callback", follow_redirects=False,
                   params={"error": "invalid_client", "error_description": DESCRIPTION, "state": state,
                           "code": "SECRET_AUTH_CODE"},
                   headers={"Authorization": "Bearer SECRET_BEARER", "Cookie": "session=SECRET_COOKIE"})
    assert unquote(r.headers["location"]).endswith("/login?error=invalid_client")  # unchanged
    [record] = _diagnostics(logs)
    assert (record.operation, record.account, record.oauth_error, record.aadsts_code) == (
        "authorization_callback", "work", "invalid_client", "AADSTS7000215")
    assert record.microsoft_request_id == TRACE and record.microsoft_correlation_id == CORRELATION
    assert not hasattr(record, "http_status")
    _assert_no_secrets(logs, [state, nonce, verifier, "error_description"])
    with session_factory() as db:  # labelling the diagnostic does not consume the pending sign-in
        assert db.scalar(select(AuthState).where(AuthState.state == state)) is not None


def test_callback_error_without_a_known_state_still_logs_safely(client, m365, logs):
    r = client.get("/api/auth/microsoft/callback?error=access_denied&state=SECRET_STATE_VALUE", follow_redirects=False)
    assert unquote(r.headers["location"]).endswith("/login?error=access_denied")
    [record] = _diagnostics(logs)
    assert record.oauth_error == "access_denied" and not hasattr(record, "account")
    _assert_no_secrets(logs, ["SECRET_STATE_VALUE"])


# ---------------------------------------------------------------- success is unchanged
def test_successful_sign_in_logs_no_failure(client, session_factory, m365, logs):
    url, state = _start(client)
    nonce, verifier = _pending(session_factory, state)
    done = _complete_oauth(client, session_factory, m365, url)  # the fake Microsoft's valid code is "good-code"
    assert "/auth/complete#token=" in done.headers["location"]
    assert _diagnostics(logs) == []
    session = parse_qs(urlparse(done.headers["location"]).fragment)["token"][0]
    _assert_no_secrets(logs, [state, nonce, verifier, "good-code", "rt-1", session])
