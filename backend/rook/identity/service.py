"""Sign-in and connect flows: server-side single-use state, PKCE, provisioning, token storage."""

from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..config import admin_emails, env, public_api_url
from ..connectors import ConnectorAuthError, get_connector_class
from ..crypto import decrypt, encrypt
from ..models import AuthState, Connector, ConnectorCredential, Organization, User, utcnow
from .base import IdentityClaims, IdentityError, TokenSet
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


def start(db: Session, provider_id: str, purpose: str, user: User | None = None, return_to: str | None = None) -> str:
    provider = get_provider(provider_id)
    if not provider.configured():
        raise IdentityError(f"{provider.display_name} is not configured on this server.")
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
                                      scopes=_scopes(provider_id, purpose), redirect_uri=redirect_uri(provider_id))


def callback(db: Session, provider_id: str, code: str, state: str) -> CallbackResult:
    st = db.scalar(select(AuthState).where(AuthState.state == state, AuthState.provider == provider_id))
    if st is None:
        raise IdentityError("Sign-in session not found or already used. Please start again.")
    db.delete(st)  # single use, even if what follows fails
    db.commit()
    if utcnow() - st.created_at > STATE_TTL:
        raise IdentityError("Sign-in session expired. Please start again.")
    provider = get_provider(provider_id)
    tokens = provider.exchange_code(code=code, code_verifier=st.code_verifier, redirect_uri=redirect_uri(provider_id),
                                    scopes=_scopes(provider_id, st.purpose))
    claims = provider.validate_id_token(tokens.id_token, nonce=st.nonce)
    if st.purpose == "signin":
        user = provision(db, claims)
        audit.record(db, org_id=user.org_id, user_id=user.id, actor=f"user:{user.email}", action="auth.login",
                     tool=provider_id, authorization=f"{provider.display_name} OIDC", result="signed in")
        db.commit()
        return CallbackResult("signin", user, st.return_to)

    user = db.get(User, st.user_id)
    if user is None:
        raise IdentityError("The ROOK user who started this connection no longer exists.")
    # The connected mailbox must belong to the signed-in ROOK user — never someone else's account.
    same_subject = user.external_subject == f"{claims.provider}:{claims.subject}"
    if not same_subject and claims.email != user.email.lower():
        raise IdentityError("Connect the Microsoft 365 account you signed in with.")
    connector = store_connection(db, user, CONNECTOR_FOR_PROVIDER[provider_id], tokens)
    return CallbackResult("connect", user, st.return_to, connector)


def provision(db: Session, claims: IdentityClaims) -> User:
    ref = f"entra:{claims.tenant}" if claims.provider == "microsoft" else f"{claims.provider}:{claims.tenant}"
    org = db.scalar(select(Organization).where(Organization.external_ref == ref))
    if org is None:
        from ..bootstrap import DEFAULT_POLICY

        org = Organization(name=env("ROOK_ORG_NAME", "My organization"), slug=f"org-{secrets.token_hex(4)}",
                           external_ref=ref, ai_policy=dict(DEFAULT_POLICY))
        db.add(org)
        db.flush()
        audit.record(db, org_id=org.id, actor="system", action="org.provisioned", tool=claims.provider,
                     authorization="first sign-in from tenant", result=org.name)
    subject = f"{claims.provider}:{claims.subject}"
    user = db.scalar(select(User).where(User.org_id == org.id, User.external_subject == subject)) or \
        db.scalar(select(User).where(User.org_id == org.id, User.email == claims.email))
    if user is None:
        user = User(org_id=org.id, email=claims.email, name=claims.name, external_subject=subject,
                    role="admin" if claims.email in admin_emails() else "member")
        db.add(user)
        db.flush()
        audit.record(db, org_id=org.id, user_id=user.id, actor="system", action="user.provisioned", tool=claims.provider,
                     authorization="identity provider", result=f"{user.email} as {user.role}")
    else:
        user.external_subject, user.name = subject, claims.name or user.name
        if claims.email in admin_emails():
            user.role = "admin"
    return user


def store_connection(db: Session, user: User, kind: str, tokens: TokenSet) -> Connector:
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
        if cred.expires_at and cred.expires_at > utcnow() + timedelta(minutes=2):
            return decrypt(cred.access_token_enc)
        try:
            tokens = get_provider(provider_id).refresh(refresh_token=decrypt(cred.refresh_token_enc),
                                                       scopes=_scopes(provider_id, "connect"))
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
