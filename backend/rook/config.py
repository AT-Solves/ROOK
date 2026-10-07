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
    secret_key: str = field(default_factory=lambda: os.environ.get("ROOK_SECRET_KEY", "dev-only-change-me"))
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


def admin_emails() -> set[str]:
    return {e.strip().lower() for e in env("ROOK_ADMIN_EMAILS").split(",") if e.strip()}
