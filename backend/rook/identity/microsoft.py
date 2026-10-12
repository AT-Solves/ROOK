"""Microsoft Entra ID, multi-tenant (ADR-0004, ADR-0011, ADR-0012): OIDC authorization-code flow with PKCE,
confidential client.

The user chooses the kind of account before sign-in, and the choice is bound to the server-side sign-in transaction:
work and school accounts sign in through the ``organizations`` authority; personal Microsoft accounts (only when
``MICROSOFT_ALLOW_PERSONAL_ACCOUNTS=true``) through ``consumers``. Connecting data and refreshing tokens use the
user's own tenant authority, or ``consumers`` for a personal account.
Every ID token is validated cryptographically against Microsoft's published signing keys (JWKS) and then by claim:
audience, issuer for the token's tenant, tenant, expiry / not-before / issued-at, nonce and object id. A personal
account's token must be signed by a key from the personal-accounts key set; a work token by one from the common set.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from urllib.parse import urlencode

import httpx
import jwt

from ..config import allowed_tenants, env, personal_accounts_enabled
from .base import IdentityClaims, IdentityError, IdentityProvider, TokenSet

log = logging.getLogger(__name__)

LOGIN_HOST = "https://login.microsoftonline.com"
SIGNIN_AUTHORITY = "organizations"  # work and school sign-in, from any tenant; never personal accounts
PERSONAL_AUTHORITY = "consumers"  # personal accounts: sign-in, connecting and refreshing (only when enabled)
JWKS_URL = f"{LOGIN_HOST}/common/discovery/v2.0/keys"
PERSONAL_JWKS_URL = f"{LOGIN_HOST}/consumers/discovery/v2.0/keys"
GRAPH = "https://graph.microsoft.com/v1.0"
# The tenant that issues tokens for personal Microsoft accounts (outlook.com, hotmail.com, live.com).
CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"
_GUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
JWKS_TTL = 24 * 3600
JWKS_MIN_REFRESH = 300  # an unknown key id may trigger at most one refetch per 5 minutes
CLOCK_SKEW = 60


def valid_tenant_id(value: str | None) -> bool:
    """An organizational (work or school) tenant id. The personal-accounts tenant is not one."""
    return bool(value) and bool(_GUID.match(value)) and value != CONSUMER_TENANT


class EntraIdProvider(IdentityProvider):
    id = "microsoft"
    display_name = "Microsoft Entra ID"

    def __init__(self, transport: httpx.BaseTransport | None = None):
        self._transport = transport
        self._keys: dict[str, tuple[object, frozenset[str]]] = {}  # kid -> (key, key sets it was published in)
        self._keys_at = 0.0
        self._lock = threading.Lock()

    @property
    def client_id(self) -> str:
        return env("MICROSOFT_CLIENT_ID")

    def configured(self) -> bool:
        return bool(self.client_id and env("MICROSOFT_CLIENT_SECRET"))

    def _http(self) -> httpx.Client:
        return httpx.Client(transport=self._transport, timeout=30)

    @staticmethod
    def _authority(tenant: str | None) -> str:
        """``None``: work or school sign-in; an organizational tenant id; or ``consumers`` for a personal account.
        Always chosen by the server."""
        if tenant is None:
            return f"{LOGIN_HOST}/{SIGNIN_AUTHORITY}/oauth2/v2.0"
        if tenant == PERSONAL_AUTHORITY:
            if not personal_accounts_enabled():
                raise IdentityError("Personal Microsoft accounts are not enabled on this ROOK server.")
            return f"{LOGIN_HOST}/{PERSONAL_AUTHORITY}/oauth2/v2.0"
        if not valid_tenant_id(tenant):
            raise IdentityError("Invalid Microsoft tenant.")
        return f"{LOGIN_HOST}/{tenant}/oauth2/v2.0"

    def authorization_url(self, *, state, nonce, code_challenge, scopes, redirect_uri, tenant=None) -> str:
        q = {"client_id": self.client_id, "response_type": "code", "redirect_uri": redirect_uri, "response_mode": "query",
             "scope": " ".join(scopes), "state": state, "nonce": nonce, "code_challenge": code_challenge,
             "code_challenge_method": "S256"}
        return f"{self._authority(tenant)}/authorize?{urlencode(q)}"

    def _token(self, data: dict, tenant: str | None) -> TokenSet:
        data = data | {"client_id": self.client_id, "client_secret": env("MICROSOFT_CLIENT_SECRET")}
        try:
            r = self._http().post(f"{self._authority(tenant)}/token", data=data)
        except httpx.HTTPError as exc:
            raise IdentityError("Could not reach Microsoft sign-in. Try again shortly.") from exc
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400 or "access_token" not in body:
            # Error codes (e.g. invalid_grant, consent_required) are safe to surface; descriptions may include IDs.
            raise IdentityError(f"Microsoft sign-in failed: {body.get('error', r.status_code)}")
        return TokenSet(access_token=body["access_token"], refresh_token=body.get("refresh_token", ""),
                        expires_in=int(body.get("expires_in", 3600)), id_token=body.get("id_token", ""),
                        scope=body.get("scope", ""))

    def exchange_code(self, *, code, code_verifier, redirect_uri, scopes, tenant=None) -> TokenSet:
        return self._token({"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
                            "code_verifier": code_verifier, "scope": " ".join(scopes)}, tenant)

    def refresh(self, *, refresh_token, scopes, tenant) -> TokenSet:
        return self._token({"grant_type": "refresh_token", "refresh_token": refresh_token, "scope": " ".join(scopes)},
                           tenant)

    # -- signing keys -------------------------------------------------------------------------
    def _fetch_keys(self, url: str) -> list[dict]:
        try:
            r = self._http().get(url)
            r.raise_for_status()
            return r.json().get("keys", [])
        except (httpx.HTTPError, ValueError) as exc:
            raise IdentityError("Could not load Microsoft's signing keys. Try again shortly.") from exc

    def _load_keys(self) -> None:
        sets = {"common": JWKS_URL}
        if personal_accounts_enabled():
            sets["consumers"] = PERSONAL_JWKS_URL
        loaded: dict[str, tuple[object, frozenset[str]]] = {}
        for name, url in sets.items():
            try:
                keys = self._fetch_keys(url)
            except IdentityError:
                if name == "common":
                    raise
                # The personal-accounts keys are optional: without them personal tokens are rejected (unknown key),
                # but work and school sign-in keeps working.
                log.warning("Could not load the personal-accounts signing keys; personal sign-in is unavailable.")
                continue
            for k in keys:
                if k.get("kty") == "RSA" and k.get("kid") and k.get("use", "sig") == "sig":
                    try:
                        key = jwt.PyJWK(k, algorithm="RS256").key
                    except jwt.PyJWKError:
                        continue
                    prev = loaded.get(k["kid"])
                    loaded[k["kid"]] = (prev[0] if prev else key, (prev[1] if prev else frozenset()) | {name})
        if not loaded:
            raise IdentityError("Microsoft returned no usable signing keys.")
        self._keys, self._keys_at = loaded, time.time()

    def _signing_key(self, kid: str):
        with self._lock:
            now = time.time()
            if not self._keys or now - self._keys_at > JWKS_TTL:
                self._load_keys()
            elif kid not in self._keys and now - self._keys_at > JWKS_MIN_REFRESH:
                self._load_keys()  # Microsoft rotates keys; refetch once for an unknown key id
            entry = self._keys.get(kid)
        if entry is None:
            raise IdentityError("ID token rejected: unknown signing key")
        return entry

    # -- ID token -----------------------------------------------------------------------------
    def validate_id_token(self, id_token: str, *, nonce: str, expected_tenant: str | None = None) -> IdentityClaims:
        try:
            header = jwt.get_unverified_header(id_token)
        except jwt.PyJWTError as exc:
            raise IdentityError("Malformed ID token") from exc
        if header.get("alg") != "RS256" or not header.get("kid"):
            raise IdentityError("ID token rejected: unexpected signing algorithm")
        try:
            key, key_sets = self._signing_key(header["kid"])
        except IdentityError:
            # Rejected either way. The unverified tenant only picks a clearer message when personal accounts are off
            # (their key set is then never loaded, so a personal token's key is always unknown).
            if not personal_accounts_enabled() and _unverified_tid(id_token) == CONSUMER_TENANT:
                raise IdentityError("ID token rejected: invalid tenant (personal Microsoft accounts cannot sign in)") from None
            raise
        try:
            claims = jwt.decode(
                id_token, key, algorithms=["RS256"], audience=self.client_id,
                leeway=CLOCK_SKEW, options={"require": ["exp", "iat", "aud", "iss", "tid", "oid", "nonce"],
                                            "verify_signature": True, "verify_aud": True, "verify_exp": True,
                                            "verify_iat": True, "verify_nbf": True, "verify_iss": False})
        except jwt.InvalidAudienceError as exc:
            raise IdentityError("ID token rejected: invalid audience") from exc
        except jwt.ExpiredSignatureError as exc:
            raise IdentityError("ID token rejected: expired") from exc
        except jwt.ImmatureSignatureError as exc:
            raise IdentityError("ID token rejected: not yet valid") from exc
        except jwt.InvalidSignatureError as exc:
            raise IdentityError("ID token rejected: invalid signature") from exc
        except jwt.PyJWTError as exc:
            raise IdentityError("ID token rejected: invalid token") from exc
        if claims.get("iat", 0) > time.time() + CLOCK_SKEW:
            raise IdentityError("ID token rejected: issued in the future")

        tid = str(claims["tid"]).lower()
        personal = tid == CONSUMER_TENANT
        if personal:
            # Personal accounts: only when explicitly enabled, and only with a key from the personal-accounts key set.
            if not personal_accounts_enabled():
                raise IdentityError("ID token rejected: invalid tenant (personal Microsoft accounts cannot sign in)")
            if "consumers" not in key_sets:
                raise IdentityError("ID token rejected: invalid signing key for a personal account")
        elif not valid_tenant_id(tid):
            raise IdentityError("ID token rejected: invalid tenant")
        elif "common" not in key_sets:
            raise IdentityError("ID token rejected: invalid signing key for a work or school account")
        # The issuer must be the token's own tenant (multi-tenant validation; the signature has been verified).
        if claims.get("iss") != f"{LOGIN_HOST}/{tid}/v2.0":
            raise IdentityError("ID token rejected: invalid issuer")
        if expected_tenant is not None and tid != expected_tenant.lower():
            raise IdentityError("ID token rejected: invalid tenant (the account belongs to another organization)")
        allowed = allowed_tenants()  # work and school tenants only; personal accounts are governed by their own switch
        if not personal and allowed and tid not in allowed:
            raise IdentityError("ID token rejected: invalid tenant (this organization is not enabled on this ROOK server)")
        if claims.get("nonce") != nonce:
            raise IdentityError("ID token rejected: invalid nonce")
        if not claims.get("oid"):
            raise IdentityError("ID token rejected: invalid subject")
        # preferred_username is the sign-in name (unique in the tenant); the email claim can be edited and unverified.
        email = (claims.get("preferred_username") or claims.get("email") or "").lower()
        if "@" not in email:
            raise IdentityError("Your Microsoft account has no email address ROOK can use.")
        return IdentityClaims(provider=self.id, tenant=tid, subject=str(claims["oid"]), email=email,
                              name=claims.get("name") or email, personal=personal)

    def directory_email(self, access_token: str) -> str | None:
        """The primary SMTP address from the directory (Graph GET /me ``mail``, readable with User.Read).

        Source systems list people by mailbox address, which can differ from the sign-in name (UPN); this is what
        ROOK matches against source access lists. It is directory data, not a token claim the user can edit."""
        try:
            r = self._http().get(f"{GRAPH}/me", params={"$select": "mail"},
                                 headers={"Authorization": f"Bearer {access_token}"})
            if r.status_code == 200:
                mail = (r.json().get("mail") or "").strip().lower()
                return mail if "@" in mail else None
        except (httpx.HTTPError, ValueError):
            log.info("Could not read the user's directory email from Microsoft Graph")
        return None

    def organization_name(self, access_token: str) -> str | None:
        """The tenant's display name (Graph GET /organization, readable with User.Read)."""
        try:
            r = self._http().get(f"{GRAPH}/organization", params={"$select": "displayName"},
                                 headers={"Authorization": f"Bearer {access_token}"})
            if r.status_code == 200:
                value = r.json().get("value") or []
                name = (value[0].get("displayName") or "").strip() if value else ""
                return name[:200] or None
        except (httpx.HTTPError, ValueError):
            log.info("Could not read the organization name from Microsoft Graph")
        return None


_PROVIDERS: dict[str, IdentityProvider] = {}


def get_provider(provider_id: str) -> IdentityProvider:
    if provider_id != "microsoft":
        raise IdentityError(f"Unknown identity provider: {provider_id}")
    return _PROVIDERS.setdefault(provider_id, EntraIdProvider())


def set_provider_for_tests(provider: IdentityProvider) -> None:
    _PROVIDERS[provider.id] = provider


def _unverified_tid(id_token: str) -> str:
    """The token's tid claim WITHOUT verification: used only to choose an error message, never to accept a token."""
    try:
        return str(jwt.decode(id_token, options={"verify_signature": False}).get("tid", "")).lower()
    except jwt.PyJWTError:
        return ""
