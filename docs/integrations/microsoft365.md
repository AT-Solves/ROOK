# Microsoft 365 integration (Entra ID sign-in + Microsoft Graph)

Owner skills: `rook-connectors`, `rook-security`. Decisions: ADR-0003 (connector), ADR-0004 (identity), ADR-0005 (no autonomous sending).

ROOK uses **one Entra ID app registration** for two flows:

| Flow | When | Scopes (delegated) |
|---|---|---|
| **Sign in** | "Sign in with Microsoft" | `openid profile email User.Read` |
| **Connect Microsoft 365** | Sources → Microsoft 365 → Connect (each user connects their own mailbox) | `openid profile email offline_access User.Read Mail.Read Calendars.Read OnlineMeetings.Read OnlineMeetingTranscript.Read.All` (+ `Mail.Send` only if `MICROSOFT_ENABLE_SEND=true`) |

ROOK reads with **delegated** permissions only: it sees exactly what the signed-in user can see, and each item keeps
its source access list (mail → sender and recipients; meetings and transcripts → attendees). No application-wide
(tenant-wide) mailbox access is requested.

## Steps for the project owner (no secret values belong in chat, tickets or the repo)

1. **Register the app.** In the Microsoft Entra admin center, go to *App registrations* → *New registration*.
   - Name: `ROOK` (any name works).
   - Supported account types: **Accounts in this organizational directory only** (single tenant).
   - Redirect URI (platform *Web*): `<ROOK_PUBLIC_API_URL>/api/auth/microsoft/callback`.
     For local development this is `http://localhost:8000/api/auth/microsoft/callback`. Add one redirect URI per environment.
2. **Create a client secret.** Under *Certificates & secrets* → *New client secret*, choose an expiry and record when to
   rotate it. Put the value **directly into your secret store or deployment environment** as `MICROSOFT_CLIENT_SECRET`.
3. **Add API permissions.** Under *API permissions* → *Microsoft Graph* → *Delegated*, add the scopes in the table above.
   `OnlineMeetingTranscript.Read.All` needs **admin consent**: click *Grant admin consent for <tenant>*.
   If you don't grant it, ROOK still works and skips transcripts with a visible warning.
   Add `Mail.Send` only if you want approved follow-ups sent from users' mailboxes.
4. **Set environment variables** for the API (see `backend/.env.example`):
   ```
   MICROSOFT_CLIENT_ID=<Application (client) ID>
   MICROSOFT_TENANT_ID=<Directory (tenant) ID>
   MICROSOFT_CLIENT_SECRET=<from step 2, via secret store>
   ROOK_PUBLIC_API_URL=<https URL of the API>
   ROOK_WEB_URL=<https URL of the web app>
   ROOK_ENCRYPTION_KEY=<generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
   ROOK_SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(48))">
   ROOK_ADMIN_EMAILS=<your email>
   ROOK_ORG_NAME=<your organisation name>
   ROOK_DEV_LOGIN=false
   MICROSOFT_ENABLE_SEND=false   # set true only after deciding to allow approved sending
   ```
5. **Teams transcripts (optional).** Transcription must be enabled by your Teams meeting policy and turned on in the
   meeting. Graph exposes transcripts to a delegated user mainly for meetings that user organised. Others are
   skipped and reported in the sync result.

## Verify
1. Open `GET /api/auth/providers` and check that `configured: true`.
2. Visit `/api/auth/microsoft/login`, sign in, and you are redirected to the web app with a session.
   Your organisation and admin user are created on the first sign-in.
3. Admin: create projects so ROOK can link conversations, for example `POST /api/projects {"name": "Project Phoenix", "aliases": ["phoenix"]}`.
4. `POST /api/sources/microsoft365/connect`: open the returned URL and consent. You return to `/sources?connected=microsoft365`.
5. `POST /api/sources/{id}/sync` returns counts of signals, meetings, decisions, commitments and risks, plus any
   `warnings` (for example transcripts not permitted).

## Behaviour and limits (MVP)
- First sync reads the last 14 days of mail (up to `MICROSOFT_MAX_MESSAGES_PER_SYNC`, default 500) and the calendar
  from 14 days back to 14 days ahead. Later syncs are incremental from the previous sync time.
- Quoted earlier thread text is stripped, because each message is ingested on its own. Drafts and cancelled meetings are skipped.
- Throttling (429/503) is retried using `Retry-After`. A 401 marks the connection `needs_reauth`.
- Tokens are encrypted at rest. Disconnecting deletes the stored tokens. Previously ingested items follow the org retention policy (to be configured, rook-data).
- **Sending:** ROOK never sends on its own. A follow-up is sent only after the requesting user approves that
  specific draft, and only if `MICROSOFT_ENABLE_SEND=true` and the user granted `Mail.Send`. Otherwise the user copies the draft.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| `AADSTS50011` redirect URI mismatch | The redirect URI in step 1 must equal `<ROOK_PUBLIC_API_URL>/api/auth/microsoft/callback` exactly |
| `invalid tenant` on sign-in | Account belongs to another tenant; only `MICROSOFT_TENANT_ID` may sign in (single-tenant MVP) |
| `consent_required` / `AADSTS65001` | Admin consent not granted for a scope (step 3) |
| Sync warning "Transcript unavailable" | No admin consent for transcripts, transcription off, or the user didn't organise the meeting |
| Connection `needs_reauth` | Refresh token revoked or expired: reconnect from Sources |
