# ADR-0012 — Personal Microsoft accounts: one account, one private workspace

- **Status:** accepted (product owner, 2026-10-12). Amends ADR-0011; resolves C-015.
- **Context:** ROOK must also serve people who use a personal Microsoft account (outlook.com, hotmail.com, live.com).
  This must not weaken work/school sign-in or tenant isolation. All personal accounts share one Entra "tenant",
  `9188040d-6c67-4c5b-b112-36a304b66dad`, so that tenant id cannot be an organization identity.

## Decision
- **Off by default.** `MICROSOFT_ALLOW_PERSONAL_ACCOUNTS` (default `false`). While off, behaviour is exactly ADR-0011:
  sign-in authority `organizations`, personal tokens refused, the personal-accounts key set is not even loaded.
- **Sign-in authority** when on: `common` (work, school and personal accounts). The browser never chooses the authority.
- **Connect / refresh authority** (server-side, from the caller's organization record): the organization's own tenant
  for work accounts; `consumers` for personal accounts.
- **ID-token validation** is unchanged and still complete: RS256 signature against Microsoft's JWKS, `aud`,
  `iss = https://login.microsoftonline.com/{tid}/v2.0`, `exp`/`nbf`/`iat`, `nonce`, `oid`, plus `state` and PKCE. In addition:
  - the personal tenant id is accepted only when the switch is on;
  - a key's origin is enforced: a personal token must be signed by a key from `consumers/discovery/v2.0/keys`,
    a work token by one from `common/discovery/v2.0/keys`;
  - `MICROSOFT_ALLOWED_TENANT_IDS` restricts work/school tenants only;
  - a connect callback must return the same tenant (`consumers` tenant for personal) and the same `oid` as the
    signed-in user.
- **Workspaces.** Organizations gain two additive columns:
  - `account_type`: `organization` | `personal`;
  - `external_key` (unique): `microsoft:tenant:<tid>` for a work tenant, `microsoft:personal:<oid>` for a personal account.

  A personal account gets **its own private workspace**: `tenant_id` NULL, `join_policy` `closed`, the account as its
  sole owner and administrator, named "<first name>'s workspace" (no Graph `/organization` call). There is no shared
  personal organization. Identity is still (tenant id, object id); email never links a work and a personal account.
- **Data (delegated, personal):** `openid profile email offline_access User.Read Mail.Read Calendars.Read` only.
  No `OnlineMeetings.*`, no transcripts, no `Mail.Send`, no Application permissions. The connector never calls Teams
  APIs for a personal account and reports transcripts as "Not available for personal Microsoft accounts." through the
  existing access-gap mechanism.
- **Migration:** additive (`ALTER TABLE … ADD COLUMN`, unique index), with an idempotent backfill of `external_key` for
  existing work organizations. Nothing is dropped or rewritten.

## Consequences
- Turning personal accounts on also needs the Entra app's *Supported account types* to include personal Microsoft
  accounts; that is an operator decision and is not changed by this ADR or by code.
- Turning the switch off again blocks sign-in for existing personal accounts; their data stays isolated in place.
- Personal workspaces cannot be shared or merged with an organization (by design for the MVP).
