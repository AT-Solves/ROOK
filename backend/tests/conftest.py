from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine

from rook.bootstrap import ensure_demo_tenant
from rook.db import get_db, init_db
from rook.main import create_app


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    init_db(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as db:
        ensure_demo_tenant(db)
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
