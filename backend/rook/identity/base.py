"""Identity-provider abstraction (ADR-0004). Microsoft Entra ID is the first implementation; Google etc. plug in here."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class IdentityError(Exception):
    """Sign-in or token validation failed. Messages are safe to show to users (no secrets)."""


class ConnectNotAllowed(IdentityError):
    """This ROOK account cannot connect the source (e.g. it did not sign in with that provider)."""


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
    """``tenant`` selects the authority: ``None`` means "any organizational tenant" (sign-in); a tenant id pins the
    request to that tenant (connecting data, refreshing tokens). It always comes from server-side state."""

    id: str
    display_name: str

    @abstractmethod
    def configured(self) -> bool: ...

    @abstractmethod
    def authorization_url(self, *, state: str, nonce: str, code_challenge: str, scopes: list[str], redirect_uri: str,
                          tenant: str | None = None) -> str: ...

    @abstractmethod
    def exchange_code(self, *, code: str, code_verifier: str, redirect_uri: str, scopes: list[str],
                      tenant: str | None = None) -> TokenSet: ...

    @abstractmethod
    def refresh(self, *, refresh_token: str, scopes: list[str], tenant: str) -> TokenSet: ...

    @abstractmethod
    def validate_id_token(self, id_token: str, *, nonce: str, expected_tenant: str | None = None) -> IdentityClaims: ...

    def directory_email(self, access_token: str) -> str | None:
        """The user's primary email from the provider's directory, when it can be read with the sign-in token."""
        return None

    def organization_name(self, access_token: str) -> str | None:
        """The organization's display name from the provider, when it can be read with the sign-in token."""
        return None
