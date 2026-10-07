"""Microsoft Entra ID (OIDC authorisation-code flow with PKCE, confidential client)."""

from __future__ import annotations

import base64
import json
import time
from urllib.parse import urlencode

import httpx

from ..config import env
from .base import IdentityClaims, IdentityError, IdentityProvider, TokenSet


def _b64json(segment: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))


class EntraIdProvider(IdentityProvider):
    id = "microsoft"
    display_name = "Microsoft Entra ID"

    def __init__(self, transport: httpx.BaseTransport | None = None):
        self._transport = transport

    @property
    def client_id(self) -> str:
        return env("MICROSOFT_CLIENT_ID")

    @property
    def tenant(self) -> str:
        return env("MICROSOFT_TENANT_ID")

    def configured(self) -> bool:
        return bool(self.client_id and env("MICROSOFT_CLIENT_SECRET") and self.tenant)

    def _authority(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant}/oauth2/v2.0"

    def authorization_url(self, *, state, nonce, code_challenge, scopes, redirect_uri) -> str:
        q = {"client_id": self.client_id, "response_type": "code", "redirect_uri": redirect_uri, "response_mode": "query",
             "scope": " ".join(scopes), "state": state, "nonce": nonce, "code_challenge": code_challenge,
             "code_challenge_method": "S256"}
        return f"{self._authority()}/authorize?{urlencode(q)}"

    def _token(self, data: dict) -> TokenSet:
        data = data | {"client_id": self.client_id, "client_secret": env("MICROSOFT_CLIENT_SECRET")}
        try:
            r = httpx.Client(transport=self._transport, timeout=30).post(f"{self._authority()}/token", data=data)
        except httpx.HTTPError as exc:
            raise IdentityError("Could not reach Microsoft sign-in. Try again shortly.") from exc
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400 or "access_token" not in body:
            # Error codes (e.g. invalid_grant, consent_required) are safe to surface; descriptions may include IDs.
            raise IdentityError(f"Microsoft sign-in failed: {body.get('error', r.status_code)}")
        return TokenSet(access_token=body["access_token"], refresh_token=body.get("refresh_token", ""),
                        expires_in=int(body.get("expires_in", 3600)), id_token=body.get("id_token", ""),
                        scope=body.get("scope", ""))

    def exchange_code(self, *, code, code_verifier, redirect_uri, scopes) -> TokenSet:
        return self._token({"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
                            "code_verifier": code_verifier, "scope": " ".join(scopes)})

    def refresh(self, *, refresh_token, scopes) -> TokenSet:
        return self._token({"grant_type": "refresh_token", "refresh_token": refresh_token, "scope": " ".join(scopes)})

    def validate_id_token(self, id_token: str, *, nonce: str) -> IdentityClaims:
        """Claim validation for an ID token received directly from the token endpoint over TLS
        (OIDC Core §3.1.3.7 permits TLS server validation in place of signature checks for this case)."""
        try:
            claims = _b64json(id_token.split(".")[1])
        except (IndexError, ValueError) as exc:
            raise IdentityError("Malformed ID token") from exc
        tid = claims.get("tid", "")
        checks = [
            (claims.get("aud") == self.client_id, "audience"),
            (tid == self.tenant, "tenant (only the configured Microsoft tenant may sign in)"),
            (claims.get("iss") == f"https://login.microsoftonline.com/{tid}/v2.0", "issuer"),
            (int(claims.get("exp", 0)) > time.time() - 60, "expiry"),
            (claims.get("nonce") == nonce, "nonce"),
            (bool(claims.get("oid")), "subject"),
        ]
        for ok, what in checks:
            if not ok:
                raise IdentityError(f"ID token rejected: invalid {what}")
        email = (claims.get("email") or claims.get("preferred_username") or "").lower()
        if "@" not in email:
            raise IdentityError("Your Microsoft account has no email address ROOK can use.")
        return IdentityClaims(provider=self.id, tenant=tid, subject=claims["oid"], email=email,
                              name=claims.get("name") or email)


_PROVIDERS: dict[str, IdentityProvider] = {}


def get_provider(provider_id: str) -> IdentityProvider:
    if provider_id != "microsoft":
        raise IdentityError(f"Unknown identity provider: {provider_id}")
    return _PROVIDERS.setdefault(provider_id, EntraIdProvider())


def set_provider_for_tests(provider: IdentityProvider) -> None:
    _PROVIDERS[provider.id] = provider
