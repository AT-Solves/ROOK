from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    return create_engine(url, **kwargs)


engine = make_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db(bind=None) -> None:
    from . import models  # noqa: F401  (register tables)

    bind = bind or engine
    Base.metadata.create_all(bind=bind)
    _upgrade(bind)


# Additive upgrades for databases created before a column existed (no migration framework yet, ADR-0002).
_ADDED_COLUMNS = {
    "organizations": {
        "identity_provider": "VARCHAR(40)",
        "tenant_id": "VARCHAR(64)",
        "status": "VARCHAR(20) NOT NULL DEFAULT 'active'",
        "created_by": "INTEGER",
        "setup_completed_at": "TIMESTAMP",
        "is_demo": "BOOLEAN NOT NULL DEFAULT FALSE",
        "join_policy": "VARCHAR(20) NOT NULL DEFAULT 'auto'",
    },
    "connector_credentials": {
        "tenant_id": "VARCHAR(64) NOT NULL DEFAULT ''",
        "external_subject": "VARCHAR(200) NOT NULL DEFAULT ''",
    },
}
_UNIQUE_INDEXES = {
    "uq_org_tenant": ("organizations", "identity_provider, tenant_id"),
    "uq_user_subject": ("users", "org_id, external_subject"),
}


def _upgrade(bind) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(bind)
    with bind.begin() as conn:
        for table, cols in _ADDED_COLUMNS.items():
            if not insp.has_table(table):
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        for name, (table, cols) in _UNIQUE_INDEXES.items():
            conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS {name} ON {table} ({cols})"))
        # Backfill: organizations provisioned from Entra before ADR-0011 carried the tenant only in external_ref.
        conn.execute(text("UPDATE organizations SET identity_provider = 'microsoft', tenant_id = substr(external_ref, 7) "
                          "WHERE tenant_id IS NULL AND external_ref LIKE 'entra:%'"))


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
