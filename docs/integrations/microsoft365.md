# Microsoft 365 integration (multi-tenant Entra ID sign-in + Microsoft Graph)

Owner skills: `rook-connectors`, `rook-security`. Decisions:
- ADR-0003 (connector)
- ADR-0004 (identity), whose tenant handling is superseded by ADR-0011 (multi-tenant)
- ADR-0005 (no autonomous sending)

ROOK is a multi-tenant SaaS product. **One Entra app registration**, owned by the ROOK publisher, serves every customer:

```
Company A tenant ──┐
Company B tenant ──┼──> ROOK (one Entra app) ──> one isolated ROOK organization per tenant
Company C tenant ──┘
```

It is used for two separate flows:

| Flow | When | Authority | Scopes (delegated) |
|---|---|---|---|
| **Sign in** | "Continue with Microsoft" | `organizations` (any work or school tenant, never personal accounts) | `openid profile email User.Read` |
| **Connect Microsoft 365** | Each user connects their own mailbox (Sources/Context → Microsoft 365 → Connect) | the user's own tenant | `openid profile email offline_access User.Read Mail.Read Calendars.Read OnlineMeetings.Read OnlineMeetingTranscript.Read.All` |

`Mail.Send` is added only if a deployment sets `MICROSOFT_ENABLE_SEND=true`. It is off by default; don't enable it.

ROOK reads with **delegated** permissions only. It sees exactly what the signed-in user can see, and each item keeps its source access list (mail → sender and recipients; meetings and transcripts → attendees). No Application permissions are used.

## How organizations and users are created
- **Identities:**
  - The **tenant id** (`tid`) from a validated ID token identifies the organization.
  - The **object id** (`oid`) identifies the user.
  - Email never links accounts, and the browser never chooses the tenant.
- **First user from a new tenant:**
  - ROOK creates a new organization in *setup* state, named from Microsoft Graph (`GET /organization`).
  - That user becomes its **owner and administrator** and is guided through `/setup`: confirm the organization name, then *Connect Microsoft 365*.
- **Later users from the same tenant** join that organization as **members**. They don't get admin rights automatically.
- **Users from a different tenant** get their own, separate organization.
- **`ROOK_ADMIN_EMAILS`** is a **development-only** shortcut. It is ignored in production and never decides who owns an organization.

## A. Steps in Microsoft Entra (the ROOK publisher's own tenant; no secret values in chat, tickets or the repo)

1. **Open App registrations.** Go to <https://entra.microsoft.com>, then *Identity* → *Applications* → *App registrations* → *+ New registration*.
2. **Register the app.**
   - **Name:** `ROOK`. Users see it on the Microsoft consent screen.
   - **Supported account types:** **Accounts in any organizational directory (Any Microsoft Entra ID tenant – Multitenant)**. Do **not** choose an option that includes personal Microsoft accounts.
   - **Redirect URI:** platform **Web**, value `<ROOK_PUBLIC_API_URL>/api/auth/microsoft/callback`.
     - Local development: `http://localhost:8000/api/auth/microsoft/callback`.
     - Add one HTTPS redirect URI per deployed environment, e.g. `https://api.rook.example/api/auth/microsoft/callback`. Entra only allows plain `http` for `localhost`.
   - Click **Register**.
3. **Overview page.** Copy the **Application (client) ID**; it becomes `MICROSOFT_CLIENT_ID`. You don't need the Directory (tenant) ID for multi-tenant sign-in.
4. **Authentication.**
   - Keep **Implicit grant and hybrid flows** unticked, both *Access tokens* and *ID tokens*. ROOK uses the authorization-code flow with PKCE.
   - Keep **Allow public client flows** = **No**.
5. **Certificates & secrets.**
   - Go to *Client secrets* → *+ New client secret*. Choose an expiry and diary the rotation date.
   - Copy the **Value**, not the Secret ID. It is shown once.
   - Put it straight into the server's secret store, or into `backend/.env` for local development, as `MICROSOFT_CLIENT_SECRET`.
   - Production: prefer a certificate (follow-up).
6. **API permissions.**
   - Go to *+ Add a permission* → *Microsoft Graph* → **Delegated permissions**.
   - Add: `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Mail.Read`, `Calendars.Read`, `OnlineMeetings.Read`, `OnlineMeetingTranscript.Read.All`.
   - Do not add Application permissions or `Mail.Send`.
7. **Consent, for your own test tenant.** Click **Grant admin consent for <your organization>**. This covers *your* tenant only (see "Each customer organization" below).
8. **Branding & properties** (needed before onboarding real customers): logo, home page URL, terms of service and privacy statement URLs. Then complete **publisher verification** (Microsoft AI Cloud Partner Program ID plus a verified domain). Many tenants don't let ordinary users consent to apps from unverified publishers, so their administrator would otherwise have to approve ROOK first.

### Each customer organization
- Users can usually consent to the non-admin permissions themselves when they first sign in or connect, unless their tenant blocks user consent.
- `OnlineMeetingTranscript.Read.All` always needs **that tenant's** administrator to consent. Without it, ROOK still works and reports transcripts as unavailable.
- A customer administrator can approve ROOK for everyone either at the first consent prompt (tick *Consent on behalf of your organization*), or in their own Entra admin center under *Enterprise applications → ROOK → Permissions → Grant admin consent*.
- Teams transcripts also require transcription to be allowed by that tenant's Teams meeting policy and turned on in the meeting. Graph exposes transcripts to a delegated user mainly for meetings that user organised.

## B. Server configuration (`backend/.env` locally, git-ignored; a secret store in shared environments)

| Variable | Required | Notes |
|---|---|---|
| `MICROSOFT_CLIENT_ID` | yes | Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | yes | client secret **Value** (secret store) |
| `MICROSOFT_ALLOWED_TENANT_IDS` | no | comma-separated tenant ids allowed to sign in. Empty = any organizational tenant. Useful to limit a test server to your own tenant |
| `MICROSOFT_TENANT_ID` | no (legacy) | if still set, it **restricts** sign-in to that tenant (old single-tenant behaviour). Remove it for multi-tenant |
| `ROOK_ENVIRONMENT` | yes in shared environments | `development` (default) or `production`. Production refuses unsafe settings at startup |
| `ROOK_PUBLIC_API_URL` | yes | must match the redirect URI in step 2 (without `/api/auth/microsoft/callback`) |
| `ROOK_WEB_URL`, `ROOK_CORS_ORIGINS` | yes | where the web app runs |
| `ROOK_SECRET_KEY` | yes | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ROOK_ENCRYPTION_KEY` | yes | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ROOK_DEV_LOGIN` | — | `true` only in local development (synthetic demo workspace); **must be `false` in production** |
| `ROOK_ADMIN_EMAILS` | — | development only; **must be empty in production** |
| `MICROSOFT_ENABLE_TRANSCRIPTS` | — | default `true` |
| `MICROSOFT_ENABLE_SEND` | — | keep `false` |

Restart the API after changing these values.

## C. Verify
1. `GET /api/auth/providers` returns `"configured": true`.
2. `/login` → **Continue with Microsoft** → sign in with a work or school account.
   - As the first user of your tenant, you land on **/setup**. Confirm the organization name, then **Connect Microsoft 365**.
3. **Second user:** sign in with another account from the same tenant. They land directly in the workspace as a **member**.
4. **Isolation:** sign in with an account from a different tenant. It gets a separate, empty organization and sees nothing of the first.
5. **Data:** after connecting, run **Sync now**. You see mail, calendar and (where permitted) Teams transcripts, with any permission gaps explained.
6. **Negative check:** a personal account (outlook.com / hotmail.com) is refused.

## Behaviour and limits (MVP)
- **Sync window:** the first sync reads the last 14 days of mail (up to `MICROSOFT_MAX_MESSAGES_PER_SYNC`, default 500) and the calendar from 14 days back to 14 days ahead. Later syncs are incremental.
- **Message handling:** quoted earlier thread text is stripped. Drafts and cancelled meetings are skipped.
- **Errors:** throttling (429/503) is retried using `Retry-After`. A 401 marks the connection `needs_reauth`.
- **Tokens:**
  - encrypted at rest;
  - bound to the tenant and object id that granted them;
  - refreshed against that tenant's authority;
  - deleted on disconnect.
- **Sending:** ROOK never sends on its own (ADR-0005).

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| `AADSTS50011` redirect URI mismatch | The redirect URI must equal `<ROOK_PUBLIC_API_URL>/api/auth/microsoft/callback` exactly |
| `AADSTS50194` "not configured as a multi-tenant application" | Supported account types is still *single tenant* (step 2) |
| "invalid tenant (personal Microsoft accounts cannot sign in)" | A personal account was used; use a work or school account |
| "not enabled on this ROOK server" | `MICROSOFT_ALLOWED_TENANT_IDS` or legacy `MICROSOFT_TENANT_ID` excludes that tenant |
| `consent_required` / `AADSTS65001` / "Need admin approval" | That tenant blocks user consent or a scope needs admin consent; its administrator must approve ROOK |
| "This email is already used by another ROOK account" | A different Microsoft identity (`oid`) uses the same email in that organization; ROOK never merges accounts by email |
| `invalid_client` | Client secret wrong or expired; create a new one (step 5) |
| Connection `needs_reauth` | Refresh token revoked or expired, or a credential from before ADR-0011 without a tenant: reconnect |
