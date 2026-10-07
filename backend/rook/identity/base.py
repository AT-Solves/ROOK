"""Identity-provider abstraction (ADR-0004). Microsoft Entra ID is the first implementation; Google etc. plug in here."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class IdentityError(Exception):
    """Sign-in or token validation failed. Messages are safe to show to users (no secrets)."""


@dataclass
class TokenSet:
    access_token: str
    refresh_token: str
    expires_in: int
    id_token: str = ""
    scope: str = ""


@dataclass
class IdentityClaims:
    provider: str
    tenant: str  # organisation at the IdP
    subject: str  # stable user id at the IdP
    email: str
    name: str


class IdentityProvider(ABC):
    id: str
    display_name: str

    @abstractmethod
    def configured(self) -> bool: ...

    @abstractmethod
    def authorization_url(self, *, state: str, nonce: str, code_challenge: str, scopes: list[str], redirect_uri: str) -> str: ...

    @abstractmethod
    def exchange_code(self, *, code: str, code_verifier: str, redirect_uri: str, scopes: list[str]) -> TokenSet: ...

    @abstractmethod
    def refresh(self, *, refresh_token: str, scopes: list[str]) -> TokenSet: ...

    @abstractmethod
    def validate_id_token(self, id_token: str, *, nonce: str) -> IdentityClaims: ...
