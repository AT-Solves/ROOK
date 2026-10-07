"""Encryption at rest for connector tokens (rook-security §7, ADR-0004)."""

from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from .config import env, settings

log = logging.getLogger(__name__)


class EncryptionNotConfigured(RuntimeError):
    pass


def _fernet() -> Fernet:
    key = env("ROOK_ENCRYPTION_KEY")
    if key:
        return Fernet(key.encode())
    if settings.dev_login:
        # Local/demo only: derive a key so the prototype runs without setup. Never acceptable in shared environments.
        log.warning("ROOK_ENCRYPTION_KEY not set; deriving a development key (do not use in shared environments)")
        return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("rook-dev:" + settings.secret_key).encode()).digest()))
    raise EncryptionNotConfigured("Set ROOK_ENCRYPTION_KEY (python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')")


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode() if value else ""


def decrypt(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise EncryptionNotConfigured("Stored credential cannot be decrypted with the current key") from exc
