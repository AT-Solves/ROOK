from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rook.bootstrap import ensure_demo_tenant
from rook.connectors.demo_data import demo_morning_timezone
from rook.db import get_db, init_db
from rook.main import create_app
from rook.models import utcnow


@pytest.fixture()
def session_factory():
    # ROOK_TEST_DATABASE_URL=postgresql+psycopg://... runs the suite against Postgres (CI does this).
    url = os.environ.get("ROOK_TEST_DATABASE_URL")
    if url:
        from rook.db import Base

        engine = create_engine(url)
        Base.metadata.drop_all(engine)
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    init_db(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as db:
        # A zone where it is mid-morning right now: a realistic working day whenever the suite runs.
        ensure_demo_tenant(db, timezone=demo_morning_timezone(utcnow()))
    return factory


@pytest.fixture()
def db(session_factory):
    with session_factory() as s:
        yield s


@pytest.fixture()
def client(session_factory):
    app = create_app(use_lifespan=False)

    def _db():
        with session_factory() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    return TestClient(app)


def login(client: TestClient, email: str = "yamini@acme.example") -> dict:
    r = client.post("/api/auth/login", json={"email": email})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------------------------------------------------------------- Microsoft 365 (mocked Entra ID + Graph)
from urllib.parse import parse_qs, unquote, urlparse  # noqa: E402

from rook.connectors.microsoft import Microsoft365Connector  # noqa: E402
from rook.identity.microsoft import EntraIdProvider, set_provider_for_tests  # noqa: E402
from rook.models import AuthState  # noqa: E402
from tests.fixtures.m365 import CLIENT_ID, ME, TENANT, FakeM365  # noqa: E402


@pytest.fixture()
def m365(monkeypatch):
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("MICROSOFT_CLIENT_SECRET", "test-secret-not-real")
    monkeypatch.setenv("MICROSOFT_TENANT_ID", TENANT)
    monkeypatch.setenv("ROOK_ADMIN_EMAILS", ME)
    monkeypatch.setenv("ROOK_ORG_NAME", "Contoso")
    fake = FakeM365()
    set_provider_for_tests(EntraIdProvider(transport=fake.transport()))
    monkeypatch.setattr(Microsoft365Connector, "transport_override", fake.transport())
    yield fake
    set_provider_for_tests(EntraIdProvider())


def _complete_oauth(client, session_factory, fake, authorize_url: str, code: str = "good-code"):
    state = parse_qs(urlparse(authorize_url).query)["state"][0]
    with session_factory() as db:
        fake.nonce = db.query(AuthState).filter_by(state=state).one().nonce
    return client.get(f"/api/auth/microsoft/callback?code={code}&state={state}", follow_redirects=False)


def entra_sign_in(client, session_factory, fake) -> dict:
    r = client.get("/api/auth/microsoft/login?return_to=/meetings", follow_redirects=False)
    assert r.status_code == 302, r.text
    done = _complete_oauth(client, session_factory, fake, r.headers["location"])
    loc = done.headers["location"]
    assert "/auth/complete#token=" in loc, loc
    frag = parse_qs(urlparse(loc).fragment)
    assert unquote(frag["return_to"][0]) == "/meetings"
    return {"Authorization": f"Bearer {frag['token'][0]}"}


def connect_m365(client, session_factory, fake, headers) -> int:
    url = client.post("/api/sources/microsoft365/connect", headers=headers).json()["authorization_url"]
    loc = _complete_oauth(client, session_factory, fake, url).headers["location"]
    assert "connected=microsoft365" in loc, loc
    return int(parse_qs(urlparse(loc).query)["id"][0])
