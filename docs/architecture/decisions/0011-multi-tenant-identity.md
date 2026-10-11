# ADR-0011 — Multi-tenant Microsoft identity: one tenant, one ROOK organization

- **Status:** accepted (product owner, 2026-10-11). Supersedes the single-tenant parts of ADR-0004.
- **Context:** ROOK is an enterprise SaaS product. Users from any Microsoft 365 organization must be able to sign in with their work or school account and arrive in their own, isolated ROOK organization.

## Decision
- **One Entra app, multi-tenant.** Supported account types: *Accounts in any organizational directory*. Personal Microsoft accounts are not accepted.
- **Sign-in authority:** `https://login.microsoftonline.com/organizations/oauth2/v2.0`. Connecting data and refreshing tokens use the user's own tenant authority (`/{tenant-id}/`), which comes from the server, never from the browser.
- **ID-token validation** (`rook/identity/microsoft.py`), all of:
  - RS256 signature against Microsoft's published keys: JWKS `common/discovery/v2.0/keys`, cached for 24 h, with at most one refetch per 5 minutes for an unknown key id;
  - `aud` = our client id;
  - `iss` = `https://login.microsoftonline.com/{tid}/v2.0`, using the token's own (signed) `tid`;
  - `tid` is a GUID and not the personal-accounts tenant `9188040d-…`;
  - optional `MICROSOFT_ALLOWED_TENANT_IDS` allow-list;
  - `exp`, `nbf` and `iat` with 60 s leeway;
  - `nonce`;
  - `oid` present.

  `state` (single-use, 10 min) and PKCE (S256) are unchanged.
- **Identity:** a Microsoft identity is (tenant id, object id).
  - The validated `tid` selects the organization (`organizations.identity_provider = 'microsoft'`, `tenant_id`, unique together).
  - The validated `oid` selects the user (`users.external_subject = 'microsoft:<oid>'`, unique per organization).
  - **Email never links accounts.** A new `oid` whose email is already used in the organization is refused, not merged. The display email comes from `preferred_username` (the sign-in name) rather than the editable `email` claim.
- **Provisioning:**
  - The first user from a new tenant creates the organization in `setup` state. They become its owner (`created_by`) and an admin.
  - The suggested name comes from Microsoft Graph `GET /organization` (readable with `User.Read`), falling back to the email domain.
  - Later users from the same tenant join as **members** (`join_policy = 'auto'`). `join_policy = 'approval'` is reserved for a future admin-approval flow; until that flow exists it refuses new members.
- **Setup:** an admin of an organization in `setup` state is sent to `/setup`. There they confirm the name (`POST /api/org/setup`, always their own organization) and are offered *Connect Microsoft 365*. Members and existing organizations go straight to the workspace.
- **Connect (data) is separate from sign-in.** The returned ID token must carry the organization's `tid` **and** the signed-in user's `oid`; otherwise the connection is refused. Credentials store `tenant_id` and `external_subject`, and are used only when both still match the owner and the organization. Credentials from before this ADR carry no tenant and must be reconnected.
- **Permissions:** delegated only, unchanged:
  - `openid profile email offline_access User.Read Mail.Read Calendars.Read OnlineMeetings.Read OnlineMeetingTranscript.Read.All` (the last needs each customer tenant's admin consent);
  - no Application permissions;
  - `Mail.Send` only if a deployment explicitly enables approved sending (off by default).
- **Demo login** only finds users in the synthetic demo organization (`organizations.is_demo`). It can never issue a session for a real-tenant user.
- **`ROOK_ENVIRONMENT`** = `development` | `production`. Anything other than `development` counts as production, so the check fails closed. Production refuses to start when any of these hold:
  - `ROOK_DEV_LOGIN=true`;
  - `ROOK_SECRET_KEY` is the default, missing or shorter than 32 characters;
  - `ROOK_ENCRYPTION_KEY` is missing;
  - `ROOK_ADMIN_EMAILS` is set.

  `ROOK_ADMIN_EMAILS` and the derived development encryption key work only in development.
- **`MICROSOFT_TENANT_ID`** is no longer required. If it is still set, it restricts sign-in to that tenant, so an existing single-tenant deployment never opens up silently. Prefer `MICROSOFT_ALLOWED_TENANT_IDS`.
- **Isolation** is unchanged and now covered route by route:
  - `org_id` comes from the session user;
  - `_owned()` returns 404 for other organizations' rows;
  - delegated connectors also check the owner.

  `tests/test_tenancy.py` exercises every ID-bearing route and every list route against another organization.

## Consequences
- **New dependency:** `PyJWT[crypto]`. Widely used and audited, and uses the `cryptography` package we already depend on.
- **Schema:** additive columns and unique indexes, applied by `init_db` for existing databases (no migration framework yet, ADR-0002).
- **Follow-up (security hardening, separate PR):** move the ROOK session from a `sessionStorage` Bearer token to an httpOnly, Secure, SameSite cookie behind a backend-for-frontend (ADR-0007). Session transport is deliberately unchanged here.
- **Follow-ups:**
  - Microsoft publisher verification before onboarding customers (many tenants block user consent to unverified multi-tenant apps);
  - an "ask your administrator to approve ROOK" admin-consent link;
  - certificate credentials instead of a client secret in production;
  - an admin-approval join flow.
