# M3.5 — Product foundation: real identity, Context Control Center, meeting intelligence

Status: **proposed — awaiting product-owner approval** (2026-10-10). Nothing in this plan is implemented yet.
Skills consulted: rook-security, rook-data, rook-connectors, rook-context-graph, rook-retrieval, rook-ai-eval, rook-ux, rook-quality.

## 1. What already exists (inspected)

| Area | Current state | Where |
|---|---|---|
| Sign-in | **Real Entra ID OIDC** (authorization code + PKCE, single-use server-side state/nonce, tenant/audience/issuer checks, JIT org+user provisioning, audit `auth.login`). Works as soon as the app registration env vars are set. The login page *hides* the Microsoft button when unconfigured. | `identity/microsoft.py`, `identity/service.py`, `GET /api/auth/{provider}/login|callback` |
| Microsoft 365 data | **Real delegated Graph connector**: Outlook mail, calendar (14 days back / 14 ahead), Teams meeting transcripts where permitted (403/404 → warning, not failure). Least-privilege read scopes; tokens encrypted at rest; refresh; throttling. Tested with mocked Graph only. | `connectors/microsoft/*` |
| Connect / sync / disconnect | Backend endpoints exist: `POST /sources/{kind}/connect` (OAuth consent), `POST /sources/{id}/sync`, `POST /sources/{id}/disconnect` (audited). UI exposes Connect and Sync only. | `api/routes.py` |
| Other sources | Registered as **stubs** (Gmail, Google Calendar, Slack, Jira, Confluence, GitHub, SharePoint/OneDrive, Zoom, Salesforce); `sync` raises "not available". | `connectors/stubs.py` |
| Ingestion | Connector → `NormalizedSignal/Meeting` → pipeline (people/project/meeting resolution, extraction, cross-channel merge with Evidence) → risk rules. Permission model: `visibility` + `participants`, enforced by `can_view` before retrieval. | `connectors/base.py`, `services/pipeline.py`, `services/permissions.py` |
| Meetings | Preparation (participants, previous meetings, decisions, open commitments, risks, related signals, suggested questions) and post-meeting intelligence (decisions, commitments, open questions, who to inform) from transcripts; manual transcript upload. | `services/meetings.py` |
| Context relationships | Relational and evidence-based: Evidence rows (signal → entity), commitment→decision link with basis, risk `related` ids, signal→meeting. No general relationship table, no Topic entity, no thread/conversation id on signals. | `models.py` |
| Home | Situations built only from relationships the API states (PR #7). Consumes whatever the pipeline produces. | `frontend/src/lib/situations.ts` |

## 2. Gaps against the M3.5 brief

1. **Login UX**: the primary action disappears when unconfigured; Demo looks like the main path. (Auth itself is real.)
2. **Context Control Center**: no granted-scope display, no per-source data types, no sync result/warnings history, no disconnect/reconnect in UI, no context health, planned sources shown as a flat list.
3. **Meeting intelligence**: transcripts lose cue timestamps; no topics; no single "meeting intelligence" view joining before/after; continuity limited to same-project lookups.
4. **Context graph**: no explicit relationship records with basis/confidence; no thread/conversation ids from sources, so an email reply chain or Teams thread cannot be followed; no continuity (topic) API.
5. **Provider configuration**: no live tenant has been connected yet (owner action, §6).

## 3. Proposed P0 for M3.5 (implementable now, testable with mocked providers)

| # | Deliverable | Backend | Frontend | Tests |
|---|---|---|---|---|
| P0-1 | **Login: Continue with Microsoft** primary. When unconfigured: the button is shown disabled with an explicit "Not set up on this server — administrator setup required" state. Demo becomes a secondary "Explore a synthetic workspace" link. | none (existing `/auth/providers`) | login page | E2E: unconfigured state; mocked-provider sign-in redirect; demo secondary |
| P0-2 | **Context Control Center** (`/context`, replaces Sources in nav; `/sources` redirects). Connected / Available (planned, no fake Connect) / per-source: account, granted scopes, data types, last successful sync, last sync result + warnings, Sync, Reconnect, Disconnect. | `GET /api/context`: per-source granted scopes (from stored credential), declared data types (connector metadata), last sync report (persisted on the connector), counts of *visible* items per data type | new page | API: scopes/report shape; disconnect audited; counts respect permissions. E2E + axe |
| P0-3 | **Context health** computed from real state: which context types the user can see (meetings, conversations, meeting transcripts, work items, documents), freshness of last sync, permission gaps reported by the connector (e.g. transcripts 403). States: Strong / Partial / Limited / Not connected, each with the reasons shown. Synthetic demo data is labelled as synthetic. | part of `/api/context` | health panel | unit tests per state |
| P0-4 | **Canonical source metadata**: `thread_id` (email conversationId, chat/thread ids) and `source_url` preserved on signals; incremental sync keeps using `since` (Graph delta queries noted as follow-up). | `NormalizedSignal.thread_id`, `Signal.thread_id` (nullable column, create_all) ; M365 normalizer maps `conversationId` | — | normalizer tests |
| P0-5 | **Context links** (evidence-based relationship records): `ContextLink(from, relation, to, basis, confidence, evidence_signal_id)`. Written by the pipeline only for relationships it can justify: transcript-of meeting, same thread, explicit reference to a decision code, commitment-fulfils/relates-to decision (existing basis), risk-concerns commitment/decision, meeting-follows previous meeting (same series/organizer+attendee overlap with stated basis). **Never** "same project" alone. Read paths filter both ends with `can_view`. | new table + pipeline writers + `services/continuity.py` | — | tests: no link without basis; permission filtering on both ends; README continuity example reproduced |
| P0-6 | **Continuity API**: `GET /api/continuity/{type}/{id}` → ordered timeline of linked, visible items (meeting, message, email, transcript, decision, commitment, risk) with relation, basis, claim type and evidence; latest update, people involved, decision/commitment/risk status. | `services/continuity.py` | Continuity section on Meeting detail and Decision/Risk detail ("Continuity") | API + E2E (Phoenix: Teams decision → Outlook confirmation → Slack/Jira delay → risk) |
| P0-7 | **Meeting intelligence view**: Meeting detail reorganised as Before (prep) / After (outcome) / Continuity, with capture status ("Transcript from Microsoft Teams", "No transcript: not permitted / not recorded", "Uploaded by …"). Transcript cues keep start time and speaker; evidence quotes show the timestamp. | VTT parser keeps `[hh:mm:ss] Speaker: text`; intelligence response includes `capture` block | meeting detail | parser + API + E2E |

Out of P0 (needs your approval separately): new real connectors (Slack, Google Workspace, Atlassian, GitHub, Zoom), SharePoint/OneDrive documents, a meeting bot/companion, Topic extraction by LLM, Graph delta sync, Home changes.

## 4. Dependency map

```
P0-4 thread_id ─┐
                ├─> P0-5 ContextLink writers ──> P0-6 Continuity API ──> P0-7 Meeting intelligence view
existing Evidence┘                                                      └─> Decision/Risk "Continuity" section
P0-2 /api/context ──> P0-3 Context health ──> Context Control Center UI
P0-1 Login (independent)
Home (unchanged) <── pipeline output (richer links feed situations automatically)
```

Order: P0-1 → P0-2/3 → P0-4/5 → P0-6 → P0-7. Each lands with tests; one PR per pair keeps reviews small.

## 5. Meeting capture policy (designed, not hidden)

- ROOK uses **only transcripts the platform provides through its supported API** (Teams via Microsoft Graph,
  `OnlineMeetingTranscript.Read.All`, admin consent, transcription started in the meeting — Teams shows the transcription
  notice to every participant) or a transcript/notes **uploaded by an attendee**.
- No recording, no bot, no audio capture in M3.5. A meeting companion would be a separate, explicit design (consent
  banner, organizer opt-in, org policy, retention) — not proposed now.
- Restricted visibility: a transcript is visible only to the meeting's participants (existing `visibility="restricted"`).
- Zoom and Google Meet are **not supported**; the UI says so.

## 6. What needs external provider configuration (owner actions)

| Item | Who | Needed for |
|---|---|---|
| Entra ID app registration; redirect URIs `…/api/auth/microsoft/callback`; env `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` in the deployment secret store | Tenant admin | Live sign-in and Microsoft 365 data |
| Admin consent for `OnlineMeetingTranscript.Read.All` (and Teams transcription enabled by policy) | Tenant admin | Teams transcripts |
| A pilot tenant/mailbox to run the live sync once | Owner | Acceptance A, C, D on real data |
| (Later) Slack / Google / Atlassian / GitHub / Zoom app registrations | Owner | Future connectors |

Until then: everything above is verified with the mocked Graph test suite and the synthetic demo workspace, and the UI states
that Microsoft sign-in is not set up on the server.

## 7. Security implications

- No new OAuth scopes in P0 (documents would add `Files.Read.All`/`Sites.Read.All` — not proposed now).
- `/api/context` returns scope names and counts only for items the caller can see; never other users' connections.
- Context links are filtered on both ends with `can_view`; a link to a restricted item is not revealed (no "1 hidden item" counts).
- Disconnect revokes stored tokens (existing) and is audited; reconnect reuses the consent flow.
- No development-auth shortcuts are added; `ROOK_DEV_LOGIN` stays a demo-only flag that is off in shared environments.

## 8. Conflicts to log (not silently changed)

- **C-011** — 02_MVP_SCOPE lists Slack, Teams chat, documents (SharePoint/OneDrive), Jira as P1/P2; the M3.5 brief names
  them as context sources. Proposal: show them as "Available later" (not connectable) in M3.5; build them only on approval.
- **C-012** — rook-context-graph marks per-topic timelines as P1; the brief asks for Topic Continuity. Proposal: P0 delivers
  evidence-based continuity anchored on a meeting/decision/risk; free-standing Topic entities follow later.
- **C-013** — milestone naming: in `docs/MVP_PLAN.md` "M4" is the Microsoft 365 connector + Entra sign-in (code complete,
  awaiting live configuration). This work is tracked as **M3.5**; the next milestone remains unstarted.

## 9. Acceptance mapping

| Brief criterion | Covered by | Fully verifiable without a live tenant? |
|---|---|---|
| A Authentication | existing OIDC + P0-1 | Flow and redirects: yes (mocked); live sign-in: needs §6 |
| B Context Control Center | P0-2, P0-3 | Yes |
| C Meeting intelligence | existing + P0-7 | Yes with mocked Teams transcript; live: needs §6 |
| D Continuity | P0-4..P0-6 | Yes (demo + mocked Graph) |
| E Trust | claim types on every continuity item and health statement | Yes |
| F Security | §7, permission tests | Yes |
| G Home unchanged, fed by context | no Home code change | Yes |
| H No fabrication | stubs not connectable; health from real counts; links need basis | Yes |
