"""ROOK_ENVIRONMENT and database upgrades (ADR-0011)."""

import dataclasses

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from rook import config, crypto
from rook.config import UnsafeConfiguration, check_runtime_config
from rook.db import init_db

GOOD_SECRET = "x" * 48


def _production(monkeypatch, *, dev_login=False, secret=GOOD_SECRET, encryption="k", admin_emails=""):
    monkeypatch.setenv("ROOK_ENVIRONMENT", "production")
    monkeypatch.setenv("ROOK_ENCRYPTION_KEY", encryption) if encryption else monkeypatch.delenv("ROOK_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ROOK_ADMIN_EMAILS", admin_emails)
    monkeypatch.setattr(config, "settings", dataclasses.replace(config.settings, dev_login=dev_login, secret_key=secret))


def test_safe_production_configuration_starts(monkeypatch):
    _production(monkeypatch)
    check_runtime_config()


@pytest.mark.parametrize("unsafe, expected", [
    ({"dev_login": True}, "ROOK_DEV_LOGIN"),
    ({"secret": "dev-only-change-me"}, "ROOK_SECRET_KEY"),
    ({"secret": "short"}, "ROOK_SECRET_KEY"),
    ({"encryption": ""}, "ROOK_ENCRYPTION_KEY"),
    ({"admin_emails": "me@example.com"}, "ROOK_ADMIN_EMAILS"),
])
def test_production_refuses_unsafe_configuration(monkeypatch, unsafe, expected):
    _production(monkeypatch, **unsafe)
    with pytest.raises(UnsafeConfiguration, match=expected):
        check_runtime_config()


def test_production_app_refuses_to_start_with_demo_login(monkeypatch):
    from rook.main import create_app

    _production(monkeypatch, dev_login=True)
    with pytest.raises(UnsafeConfiguration):
        create_app(use_lifespan=False)


def test_unknown_environment_is_treated_as_production(monkeypatch):
    monkeypatch.setenv("ROOK_ENVIRONMENT", "staging")
    assert config.environment() == "production" and config.admin_emails() == set()


def test_development_allows_demo_conveniences(monkeypatch):
    monkeypatch.setenv("ROOK_ENVIRONMENT", "development")
    monkeypatch.setenv("ROOK_ADMIN_EMAILS", "Me@Example.com")
    check_runtime_config()
    assert config.admin_emails() == {"me@example.com"}


def test_derived_encryption_key_only_in_development(monkeypatch):
    monkeypatch.delenv("ROOK_ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("ROOK_ENVIRONMENT", "development")
    assert crypto.decrypt(crypto.encrypt("secret")) == "secret"
    monkeypatch.setenv("ROOK_ENVIRONMENT", "production")
    with pytest.raises(crypto.EncryptionNotConfigured):
        crypto.encrypt("secret")


def test_existing_databases_are_upgraded_and_backfilled():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.begin() as c:  # the schema before ADR-0011
        c.execute(text("CREATE TABLE organizations (id INTEGER PRIMARY KEY, name VARCHAR(200), slug VARCHAR(100) UNIQUE, "
                       "external_ref VARCHAR(200) UNIQUE, ai_policy JSON, created_at TIMESTAMP)"))
        c.execute(text("INSERT INTO organizations (id, name, slug, external_ref, ai_policy) VALUES "
                       "(1, 'Contoso', 'org-1', 'entra:11111111-2222-3333-4444-555555555555', '{}')"))
    init_db(engine)
    cols = {c["name"] for c in inspect(engine).get_columns("organizations")}
    assert {"identity_provider", "tenant_id", "status", "created_by", "setup_completed_at", "is_demo", "join_policy"} <= cols
    assert {"tenant_id", "external_subject"} <= {c["name"] for c in inspect(engine).get_columns("connector_credentials")}
    with engine.connect() as c:
        row = c.execute(text("SELECT identity_provider, tenant_id, status, is_demo FROM organizations")).one()
    assert tuple(row) == ("microsoft", "11111111-2222-3333-4444-555555555555", "active", 0)
    init_db(engine)  # idempotent
