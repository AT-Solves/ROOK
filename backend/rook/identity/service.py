"""Sign-in and connect flows: server-side single-use state, PKCE, provisioning, token storage.

Multi-tenant (ADR-0011): one Microsoft identity is (tenant id, object id), both read from a validated ID token. The
tenant id selects the ROOK organization; the object id selects the user in it. Email never links accounts, and no
tenant ever comes from the browser.

Personal Microsoft accounts (ADR-0012, only when ``MICROSOFT_ALLOW_PERSONAL_ACCOUNTS=true``): all of them share one
Microsoft tenant, so the tenant is not an organization boundary for them. Each personal account gets its own private
workspace keyed by its object id; nobody else ever joins it.
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
from ..config import admin_emails, personal_accounts_enabled, public_api_url
from ..connectors import ConnectorAuthError, get_connector_class
from ..crypto import decrypt, encrypt
from ..models import AuthState, Connector, ConnectorCredential, Organization, User, utcnow
from .base import ConnectNotAllowed, IdentityClaims, IdentityError, TokenSet
from .microsoft import CONSUMER_TENANT, PERSONAL_AUTHORITY, get_provider

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


# Sign-in purposes, by the kind of account the user chose before sign-in (ADR-0012). The choice is stored with the
# server-side sign-in transaction (AuthState.purpose); the callback never takes it from the browser.
SIGNIN_PURPOSES = {"signin": False, "signin_personal": True}  # purpose -> personal account


def _scopes(provider_id: str, purpose: str, personal: bool = False) -> list[str]:
    if purpose in SIGNIN_PURPOSES:
        return SIGNIN_SCOPES
    return get_connector_class(CONNECTOR_FOR_PROVIDER[provider_id]).requested_scopes(personal=personal)


def _subject(claims: IdentityClaims) -> str:
    return f"{claims.provider}:{claims.subject}"


@dataclass
class ConnectTarget:
    authority: str  # organizational tenant id, or "consumers" for a personal account
    tenant: str  # the tid the returned token must carry
    personal: bool


def _connect_target(db: Session, provider_id: str, user: User) -> ConnectTarget:
    """Where a user may connect data from, decided from their own workspace on the server — never the browser."""
    org = db.get(Organization, user.org_id)
    if org is None or org.identity_provider != provider_id or not user.external_subject:
        raise ConnectNotAllowed("Sign in with your Microsoft account to connect Microsoft 365.")
    if org.account_type == "personal":
        return ConnectTarget(authority=PERSONAL_AUTHORITY, tenant=CONSUMER_TENANT, personal=True)
    if not org.tenant_id:
        raise ConnectNotAllowed("Sign in with your Microsoft work or school account to connect Microsoft 365.")
    return ConnectTarget(authority=org.tenant_id, tenant=org.tenant_id, personal=False)


def start(db: Session, provider_id: str, purpose: str, user: User | None = None, return_to: str | None = None) -> str:
    provider = get_provider(provider_id)
    if not provider.configured():
        raise IdentityError(f"{provider.display_name} is not configured on this server.")
    target = _connect_target(db, provider_id, user) if purpose == "connect" else None
    if purpose == "signin_personal":
        if not personal_accounts_enabled():
            raise IdentityError("Personal Microsoft accounts are not enabled on this ROOK server.")
        authority = PERSONAL_AUTHORITY
    else:
        authority = target.authority if target else None  # None: work or school sign-in (organizations)
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
                                      scopes=_scopes(provider_id, purpose, bool(target and target.personal)),
                                      redirect_uri=redirect_uri(provider_id), tenant=authority)


def callback(db: Session, provider_id: str, code: str, state: str) -> CallbackResult:
    st = db.scalar(select(AuthState).where(AuthState.state == state, AuthState.provider == provider_id))
    if st is None:
        raise IdentityError("Sign-in session not found or already used. Please start again.")
    db.delete(st)  # single use, even if what follows fails
    db.commit()
    if utcnow() - st.created_at > STATE_TTL:
        raise IdentityError("Sign-in session expired. Please start again.")
    provider = get_provider(provider_id)
    if st.purpose in SIGNIN_PURPOSES:
        # The kind of account chosen before sign-in (from the stored transaction) fixes the authority for the code
        # exchange and the kind of identity that may come back: a personal choice only accepts a personal account,
        # a work or school choice only a work or school account.
        personal = SIGNIN_PURPOSES[st.purpose]
        tokens = provider.exchange_code(code=code, code_verifier=st.code_verifier, redirect_uri=redirect_uri(provider_id),
                                        scopes=_scopes(provider_id, st.purpose),
                                        tenant=PERSONAL_AUTHORITY if personal else None)
        claims = provider.validate_id_token(tokens.id_token, nonce=st.nonce,
                                            expected_tenant=CONSUMER_TENANT if personal else None)
        if claims.personal != personal:
            raise IdentityError("This is a personal Microsoft account. Use “Continue with personal Microsoft account”."
                                if claims.personal else
                                "This is a work or school account. Use “Continue with work or school account”.")
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
    target = _connect_target(db, provider_id, user)
    tokens = provider.exchange_code(code=code, code_verifier=st.code_verifier, redirect_uri=redirect_uri(provider_id),
                                    scopes=_scopes(provider_id, st.purpose, target.personal), tenant=target.authority)
    # The returned identity must be this ROOK user's own Microsoft identity in this workspace's tenant:
    # same tenant id and same object id. Email never decides it.
    claims = provider.validate_id_token(tokens.id_token, nonce=st.nonce, expected_tenant=target.tenant)
    if _subject(claims) != user.external_subject:
        raise IdentityError("Connect the Microsoft 365 account you signed in with.")
    connector = store_connection(db, user, CONNECTOR_FOR_PROVIDER[provider_id], tokens, tenant_id=claims.tenant,
                                 external_subject=_subject(claims))
    return CallbackResult("connect", user, st.return_to, connector)


def provision(db: Session, claims: IdentityClaims, org_name=None) -> User:
    """Find or create the organization for the validated tenant and the user for the validated object id.

    A new tenant gets a new organization in setup state, and its first user becomes the owner (admin). Later users from
    the same tenant join as members. ``org_name`` is called only for a new organization. Personal accounts are
    provisioned separately (:func:`provision_personal`).
    """
    if claims.personal:
        return provision_personal(db, claims)
    key = f"microsoft:tenant:{claims.tenant}"
    org = db.scalar(select(Organization).where(Organization.external_key == key))
    if org is None:  # an organization from before ADR-0012 that has not been backfilled yet
        org = db.scalar(select(Organization).where(Organization.identity_provider == claims.provider,
                                                   Organization.tenant_id == claims.tenant,
                                                   Organization.account_type == "organization"))
        if org is not None and org.external_key is None:
            org.external_key = key
    new_org = org is None
    if new_org:
        from ..bootstrap import DEFAULT_POLICY

        name = (org_name() if org_name else None) or _name_from_email(claims.email)
        org = Organization(name=name, slug=f"org-{secrets.token_hex(6)}", external_ref=f"entra:{claims.tenant}",
                           identity_provider=claims.provider, tenant_id=claims.tenant, status="setup",
                           account_type="organization", external_key=key,
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


def provision_personal(db: Session, claims: IdentityClaims) -> User:
    """One private workspace per personal Microsoft account, keyed by its object id. Its only member is that account
    (owner and admin); nobody else ever joins, and email never links it to any other identity."""
    key = f"microsoft:personal:{claims.subject}"
    subject = _subject(claims)
    org = db.scalar(select(Organization).where(Organization.external_key == key))
    if org is None:
        from ..bootstrap import DEFAULT_POLICY

        org = Organization(name=_personal_workspace_name(claims), slug=f"me-{secrets.token_hex(6)}",
                           identity_provider=claims.provider, tenant_id=None, account_type="personal",
                           external_key=key, status="setup", join_policy="closed", ai_policy=dict(DEFAULT_POLICY))
        db.add(org)
        db.flush()
        user = User(org_id=org.id, email=claims.email, name=claims.name, external_subject=subject, role="admin")
        db.add(user)
        db.flush()
        org.created_by = user.id
        audit.record(db, org_id=org.id, actor="system", action="org.provisioned", tool=claims.provider,
                     authorization="first sign-in from a personal Microsoft account", result=org.name)
        audit.record(db, org_id=org.id, user_id=user.id, actor="system", action="user.provisioned", tool=claims.provider,
                     authorization="owner of a personal workspace", result=f"{user.email} as admin")
        return user
    user = db.scalar(select(User).where(User.org_id == org.id, User.external_subject == subject))
    if user is None or org.account_type != "personal":
        raise IdentityError("This personal workspace belongs to another account.")
    user.name = claims.name or user.name
    user.email = claims.email  # the account's email changed; identity (oid) is unchanged
    return user


def _personal_workspace_name(claims: IdentityClaims) -> str:
    first = (claims.name or "").split()[0] if (claims.name or "").strip() and "@" not in claims.name else ""
    return f"{first}'s workspace" if first else "My workspace"


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
        personal = org is not None and org.account_type == "personal"
        expected_tenant = CONSUMER_TENANT if personal else (org.tenant_id if org else None)
        # Tokens are used only for the user and tenant that granted them (credentials from before ADR-0011 carry no
        # tenant: they must be reconnected).
        if (owner is None or cred.org_id != connector.org_id or owner.org_id != connector.org_id or org is None
                or not cred.tenant_id or cred.tenant_id != expected_tenant
                or cred.external_subject != owner.external_subject):
            connector.status = "needs_reauth"
            db.commit()
            raise ConnectorAuthError("Stored Microsoft 365 access does not match this account. Reconnect the source.")
        if cred.expires_at and cred.expires_at > utcnow() + timedelta(minutes=2):
            return decrypt(cred.access_token_enc)
        try:
            tokens = get_provider(provider_id).refresh(refresh_token=decrypt(cred.refresh_token_enc),
                                                       scopes=_scopes(provider_id, "connect", personal),
                                                       tenant=PERSONAL_AUTHORITY if personal else cred.tenant_id)
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
