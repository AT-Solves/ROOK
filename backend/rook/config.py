"""Runtime configuration. Every secret comes from the environment (README §58.15–16)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so the prototype needs no extra dependency."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.environ.get("ROOK_DATABASE_URL", "sqlite:///./rook.db"))
    secret_key: str = field(default_factory=lambda: os.environ.get("ROOK_SECRET_KEY", "dev-only-change-me"))  # see DEFAULT_SECRET_KEY
    dev_login: bool = field(default_factory=lambda: _bool("ROOK_DEV_LOGIN", True))
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in os.environ.get("ROOK_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
        )
    )
    token_ttl_seconds: int = 60 * 60 * 12

    llm_provider: str = field(default_factory=lambda: os.environ.get("ROOK_LLM_PROVIDER", "rules").lower())
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ROOK_ANTHROPIC_API_KEY", ""))
    anthropic_model: str = field(default_factory=lambda: os.environ.get("ROOK_ANTHROPIC_MODEL", "claude-sonnet-5-5"))
    openai_api_key: str = field(default_factory=lambda: os.environ.get("ROOK_OPENAI_API_KEY", ""))
    openai_model: str = field(default_factory=lambda: os.environ.get("ROOK_OPENAI_MODEL", "gpt-4.1"))
    ollama_url: str = field(default_factory=lambda: os.environ.get("ROOK_OLLAMA_URL", "http://localhost:11434"))
    ollama_model: str = field(default_factory=lambda: os.environ.get("ROOK_OLLAMA_MODEL", "llama3.1"))



settings = Settings()


# --- Values read at call time (so deployments and tests can change them without re-import) ---------

def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    return _bool(name, default)


def public_api_url() -> str:
    """Externally reachable base URL of this API (used for OAuth redirect URIs)."""
    return env("ROOK_PUBLIC_API_URL", "http://localhost:8000").rstrip("/")


def web_url() -> str:
    """Base URL of the ROOK web app (where users land after sign-in / connect)."""
    return env("ROOK_WEB_URL", "http://localhost:3000").rstrip("/")


def environment() -> str:
    """development | production. Anything other than "development" is treated as production (fail closed)."""
    return "development" if env("ROOK_ENVIRONMENT", "development").lower() == "development" else "production"


def is_development() -> bool:
    return environment() == "development"


def admin_emails() -> set[str]:
    """Development convenience only: never decides who owns or administers a real organization (ADR-0011)."""
    if not is_development():
        return set()
    return {e.strip().lower() for e in env("ROOK_ADMIN_EMAILS").split(",") if e.strip()}


def allowed_tenants() -> set[str]:
    """Optional allow-list of Entra tenant ids that may sign in. Empty: any organizational tenant.

    ``MICROSOFT_TENANT_ID`` (the single-tenant setting before ADR-0011) still restricts sign-in to that tenant, so an
    existing deployment never silently opens up; set ``MICROSOFT_ALLOWED_TENANT_IDS`` instead.
    """
    raw = f"{env('MICROSOFT_ALLOWED_TENANT_IDS')},{env('MICROSOFT_TENANT_ID')}"
    return {t.strip().lower() for t in raw.split(",") if t.strip()}


DEFAULT_SECRET_KEY = "dev-only-change-me"


class UnsafeConfiguration(RuntimeError):
    pass


def check_runtime_config() -> None:
    """Refuse to start a production server with development-only settings."""
    if is_development():
        return
    problems = []
    if settings.dev_login:
        problems.append("ROOK_DEV_LOGIN must be false (demo login is development-only)")
    if not settings.secret_key or settings.secret_key == DEFAULT_SECRET_KEY or len(settings.secret_key) < 32:
        problems.append("ROOK_SECRET_KEY must be set to a random value of at least 32 characters")
    if not env("ROOK_ENCRYPTION_KEY"):
        problems.append("ROOK_ENCRYPTION_KEY must be set")
    if env("ROOK_ADMIN_EMAILS"):
        problems.append("ROOK_ADMIN_EMAILS is development-only; organization ownership comes from first sign-in")
    if problems:
        raise UnsafeConfiguration("Unsafe production configuration: " + "; ".join(problems))
