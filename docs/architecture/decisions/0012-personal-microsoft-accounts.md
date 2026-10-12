# ADR-0012 — Personal Microsoft accounts: one account, one private workspace

- **Status:** accepted (product owner, 2026-10-12). Amends ADR-0011; resolves C-015. Sign-in amended 2026-10-12:
  explicit account-type choice replaces the single `common` sign-in (see "Sign-in: explicit account choice").
- **Context:** ROOK must also serve people who use a personal Microsoft account (outlook.com, hotmail.com, live.com).
  This must not weaken work/school sign-in or tenant isolation. All personal accounts share one Entra "tenant",
  `9188040d-6c67-4c5b-b112-36a304b66dad`, so that tenant id cannot be an organization identity.

## Decision
- **Off by default.** `MICROSOFT_ALLOW_PERSONAL_ACCOUNTS` (default `false`). While off, behaviour is exactly ADR-0011:
  sign-in authority `organizations`, personal tokens refused, the personal-accounts key set is not even loaded.
- **Sign-in authority** when on: chosen by the kind of account the user picks (below). `common` is no longer used.
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
- **What users see matches what ROOK asks for:** for a personal workspace, Context and Sources list only the scopes above
  and no Teams data type, and sending shows as off. A personal workspace never sends, even if a server sets
  `MICROSOFT_ENABLE_SEND=true`.
- **Key availability:** the personal-accounts key set is optional. If Microsoft's `consumers` key endpoint fails,
  personal tokens are rejected (unknown key) but work and school sign-in keeps working; a failure of the `common`
  key set still blocks sign-in, as before.
- **Migration:** additive (`ALTER TABLE … ADD COLUMN`, unique index), with an idempotent backfill of `external_key` for
  existing work organizations. Nothing is dropped or rewritten.

## Sign-in: explicit account choice (amendment, 2026-10-12)
- **Why:** with one *Continue with Microsoft* button on the `common` authority, Microsoft refused a genuine personal
  account ("You can't sign in here with a personal account") although the app allowed personal accounts, while the
  same account signed in through `consumers`. ROOK does not work around Microsoft's `common` routing; it asks instead.
- **Login page:** with personal accounts off, unchanged (one *Continue with Microsoft* button, `organizations`). With
  them on, two choices: *Continue with work or school account* (`organizations`) and *Continue with personal Microsoft
  account* (`consumers`).
- **Bound to the server-side transaction:** `GET /api/auth/microsoft/login?account=work|personal` stores the choice as
  the sign-in transaction's purpose (`signin` | `signin_personal`, the existing `AuthState.purpose` column; no schema
  change). The callback reads it only from that stored transaction, never from the browser.
- **Validated against the returned identity:** the code is exchanged at the same authority it was issued by, and the
  ID token must match the choice: a personal choice requires the personal-accounts tenant (and its key set); a work
  or school choice rejects a personal account. All other checks (signature, issuer, audience, expiry, nonce, state,
  PKCE, tenant and object id, `MICROSOFT_ALLOWED_TENANT_IDS`) are unchanged. A personal choice is refused while
  personal accounts are off.
- **Scopes:** sign-in still asks only for `openid profile email User.Read` for either choice.

## Consequences
- Turning personal accounts on also needs the Entra app's *Supported account types* to include personal Microsoft
  accounts; that is an operator decision and is not changed by this ADR or by code.
- Turning the switch off again blocks sign-in for existing personal accounts; their data stays isolated in place.
- Personal workspaces cannot be shared or merged with an organization (by design for the MVP).
