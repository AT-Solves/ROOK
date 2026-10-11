"""Sign-in and connect flows: server-side single-use state, PKCE, provisioning, token storage.

Multi-tenant (ADR-0011): one Microsoft identity is (tenant id, object id), both read from a validated ID token. The
tenant id selects the ROOK organization; the object id selects the user in it. Email never links accounts, and no
tenant ever comes from the browser.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..config import admin_emails, public_api_url
from ..connectors import ConnectorAuthError, get_connector_class
from ..crypto import decrypt, encrypt
from ..models import AuthState, Connector, ConnectorCredential, Organization, User, utcnow
from .base import ConnectNotAllowed, IdentityClaims, IdentityError, TokenSet
from .microsoft import get_provider

SIGNIN_SCOPES = ["openid", "profile", "email", "User.Read"]
STATE_TTL = timedelta(minutes=10)
# Identity provider -> the delegated data connector it can authorise.
CONNECTOR_FOR_PROVIDER = {"microsoft": "microsoft365"}


@dataclass
class CallbackResult:
    purpose: str
    user: User
    return_to: str
    connector: Connector | None = None


def redirect_uri(provider_id: str) -> str:
    return f"{public_api_url()}/api/auth/{provider_id}/callback"


def safe_return_to(value: str | None) -> str:
    """Only same-site relative paths: prevents open redirects."""
    if not value or not value.startswith("/") or value.startswith("//") or "\\" in value:
        return "/"
    return value[:300]


def _scopes(provider_id: str, purpose: str) -> list[str]:
    if purpose == "signin":
        return SIGNIN_SCOPES
    return get_connector_class(CONNECTOR_FOR_PROVIDER[provider_id]).requested_scopes()


def _subject(claims: IdentityClaims) -> str:
    return f"{claims.provider}:{claims.subject}"


def _connect_tenant(db: Session, provider_id: str, user: User) -> str:
    """The tenant a user may connect data from: their own organization's, from the server — never the browser's."""
    org = db.get(Organization, user.org_id)
    if org is None or org.identity_provider != provider_id or not org.tenant_id or not user.external_subject:
        raise ConnectNotAllowed("Sign in with your Microsoft work or school account to connect Microsoft 365.")
    return org.tenant_id


def start(db: Session, provider_id: str, purpose: str, user: User | None = None, return_to: str | None = None) -> str:
    provider = get_provider(provider_id)
    if not provider.configured():
        raise IdentityError(f"{provider.display_name} is not configured on this server.")
    tenant = _connect_tenant(db, provider_id, user) if purpose == "connect" else None
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    st = AuthState(state=secrets.token_urlsafe(32), nonce=secrets.token_urlsafe(24), code_verifier=verifier,
                   provider=provider_id, purpose=purpose, user_id=user.id if user else None,
                   return_to=safe_return_to(return_to))
    db.add(st)
    # Opportunistic cleanup of abandoned states.
    for old in db.scalars(select(AuthState).where(AuthState.created_at < utcnow() - STATE_TTL)).all():
        db.delete(old)
    db.commit()
    return provider.authorization_url(state=st.state, nonce=st.nonce, code_challenge=challenge,
                                      scopes=_scopes(provider_id, purpose), redirect_uri=redirect_uri(provider_id),
                                      tenant=tenant)


def callback(db: Session, provider_id: str, code: str, state: str) -> CallbackResult:
    st = db.scalar(select(AuthState).where(AuthState.state == state, AuthState.provider == provider_id))
    if st is None:
        raise IdentityError("Sign-in session not found or already used. Please start again.")
    db.delete(st)  # single use, even if what follows fails
    db.commit()
    if utcnow() - st.created_at > STATE_TTL:
        raise IdentityError("Sign-in session expired. Please start again.")
    provider = get_provider(provider_id)
    if st.purpose == "signin":
        tokens = provider.exchange_code(code=code, code_verifier=st.code_verifier, redirect_uri=redirect_uri(provider_id),
                                        scopes=_scopes(provider_id, st.purpose))
        claims = provider.validate_id_token(tokens.id_token, nonce=st.nonce)
        # Identity is (tid, oid). The email used to match source access lists comes from the directory when available.
        claims.email = provider.directory_email(tokens.access_token) or claims.email
        user = provision(db, claims, org_name=lambda: provider.organization_name(tokens.access_token))
        audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="auth.login",
                     tool=provider_id, authorization=f"{provider.display_name} OIDC", result="signed in")
        db.commit()
        return CallbackResult("signin", user, st.return_to)

    user = db.get(User, st.user_id)
    if user is None:
        raise IdentityError("The ROOK user who started this connection no longer exists.")
    tenant = _connect_tenant(db, provider_id, user)
    tokens = provider.exchange_code(code=code, code_verifier=st.code_verifier, redirect_uri=redirect_uri(provider_id),
                                    scopes=_scopes(provider_id, st.purpose), tenant=tenant)
    # The returned identity must be this ROOK user's own Microsoft identity in this organization's tenant:
    # same tenant id and same object id. Email never decides it.
    claims = provider.validate_id_token(tokens.id_token, nonce=st.nonce, expected_tenant=tenant)
    if _subject(claims) != user.external_subject:
        raise IdentityError("Connect the Microsoft 365 account you signed in with.")
    connector = store_connection(db, user, CONNECTOR_FOR_PROVIDER[provider_id], tokens, tenant_id=claims.tenant,
                                 external_subject=_subject(claims))
    return CallbackResult("connect", user, st.return_to, connector)


def provision(db: Session, claims: IdentityClaims, org_name=None) -> User:
    """Find or create the organization for the validated tenant and the user for the validated object id.

    A new tenant gets a new organization in setup state, and its first user becomes the owner (admin). Later users from
    the same tenant join as members. ``org_name`` is called only for a new organization.
    """
    org = db.scalar(select(Organization).where(Organization.identity_provider == claims.provider,
                                               Organization.tenant_id == claims.tenant))
    new_org = org is None
    if new_org:
        from ..bootstrap import DEFAULT_POLICY

        name = (org_name() if org_name else None) or _name_from_email(claims.email)
        org = Organization(name=name, slug=f"org-{secrets.token_hex(6)}", external_ref=f"entra:{claims.tenant}",
                           identity_provider=claims.provider, tenant_id=claims.tenant, status="setup",
                           ai_policy=dict(DEFAULT_POLICY))
        db.add(org)
        db.flush()
        audit.record(db, org_id=org.id, actor="system", action="org.provisioned", tool=claims.provider,
                     authorization="first sign-in from a new Microsoft tenant", result=org.name)

    subject = _subject(claims)
    user = db.scalar(select(User).where(User.org_id == org.id, User.external_subject == subject))
    if user is None:
        if not new_org and org.join_policy != "auto":
            raise IdentityError("Your organization requires administrator approval for new ROOK members.")
        if db.scalar(select(User.id).where(User.org_id == org.id, User.email == claims.email)) is not None:
            # Another identity already uses this email here. Never link by email (it can be reassigned or edited).
            raise IdentityError("This email is already used by another ROOK account in your organization. "
                                "Ask your ROOK administrator for help.")
        role = "admin" if new_org or claims.email in admin_emails() else "member"
        user = User(org_id=org.id, email=claims.email, name=claims.name, external_subject=subject, role=role)
        db.add(user)
        db.flush()
        if new_org:
            org.created_by = user.id
        audit.record(db, org_id=org.id, user_id=user.id, actor="system", action="user.provisioned", tool=claims.provider,
                     authorization="organization owner (first user from this tenant)" if new_org
                     else "member of the tenant's organization", result=f"{user.email} as {user.role}")
    else:
        user.name = claims.name or user.name
        taken = db.scalar(select(User.id).where(User.org_id == org.id, User.email == claims.email, User.id != user.id))
        if claims.email != user.email and taken is None:
            user.email = claims.email  # the sign-in name changed in the tenant; identity is unchanged
        if claims.email in admin_emails():  # development convenience only (empty in production)
            user.role = "admin"
    return user


def _name_from_email(email: str) -> str:
    domain = email.rsplit("@", 1)[-1]
    return domain.split(".")[0].capitalize() if domain else "My organization"


def store_connection(db: Session, user: User, kind: str, tokens: TokenSet, *, tenant_id: str,
                     external_subject: str) -> Connector:
    conn = db.scalar(select(Connector).where(Connector.org_id == user.org_id, Connector.kind == kind,
                                             Connector.created_by == user.id))
    if conn is None:
        conn = Connector(org_id=user.org_id, kind=kind, created_by=user.id)
        db.add(conn)
        db.flush()
    conn.status = "connected"
    cred = db.scalar(select(ConnectorCredential).where(ConnectorCredential.connector_id == conn.id))
    if cred is None:
        cred = ConnectorCredential(org_id=user.org_id, connector_id=conn.id, user_id=user.id)
        db.add(cred)
    cred.tenant_id, cred.external_subject = tenant_id, external_subject
    _save_tokens(cred, tokens)
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="connector.connected",
                 tool=kind, input={"scopes": tokens.scope}, authorization="user OAuth consent", result="connected")
    db.commit()
    return conn


def _save_tokens(cred: ConnectorCredential, tokens: TokenSet) -> None:
    cred.access_token_enc = encrypt(tokens.access_token)
    if tokens.refresh_token:  # refresh tokens may rotate
        cred.refresh_token_enc = encrypt(tokens.refresh_token)
    cred.expires_at = utcnow() + timedelta(seconds=max(60, tokens.expires_in))
    cred.scopes = tokens.scope or cred.scopes
    cred.updated_at = utcnow()


def access_token_getter(db: Session, connector: Connector):
    """Returns a callable giving a valid access token, refreshing (and persisting) when close to expiry."""
    provider_id = next(p for p, k in CONNECTOR_FOR_PROVIDER.items() if k == connector.kind)

    def get() -> str:
        cred = db.scalar(select(ConnectorCredential).where(ConnectorCredential.connector_id == connector.id))
        if cred is None:
            raise ConnectorAuthError("No stored credentials; connect the source first.")
        owner = db.get(User, cred.user_id)
        org = db.get(Organization, connector.org_id)
        # Tokens are used only for the user and tenant that granted them (credentials from before ADR-0011 carry no
        # tenant: they must be reconnected).
        if (owner is None or cred.org_id != connector.org_id or owner.org_id != connector.org_id or org is None
                or not cred.tenant_id or cred.tenant_id != org.tenant_id or cred.external_subject != owner.external_subject):
            connector.status = "needs_reauth"
            db.commit()
            raise ConnectorAuthError("Stored Microsoft 365 access does not match this account. Reconnect the source.")
        if cred.expires_at and cred.expires_at > utcnow() + timedelta(minutes=2):
            return decrypt(cred.access_token_enc)
        try:
            tokens = get_provider(provider_id).refresh(refresh_token=decrypt(cred.refresh_token_enc),
                                                       scopes=_scopes(provider_id, "connect"), tenant=cred.tenant_id)
        except IdentityError as exc:
            connector.status = "needs_reauth"
            db.commit()
            raise ConnectorAuthError(f"{exc}. Reconnect the source.") from exc
        _save_tokens(cred, tokens)
        db.commit()
        return tokens.access_token

    return get


def disconnect(db: Session, user: User, connector: Connector) -> None:
    for cred in db.scalars(select(ConnectorCredential).where(ConnectorCredential.connector_id == connector.id)).all():
        db.delete(cred)
    connector.status = "disconnected"
    audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="connector.disconnected",
                 tool=connector.kind, authorization="user", result="credentials deleted")
    db.commit()
