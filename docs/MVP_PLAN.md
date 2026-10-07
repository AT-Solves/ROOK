# ROOK — MVP Development Plan

Owner skill: `rook-product`. Source of truth: `docs/product/` (precedence in `rook-orchestrator`).

**MVP goal (02_MVP_SCOPE):** prove one complete loop:
Communication → Context → Decision → Commitment → Follow-up → Risk → Executive Brief.

## Product-owner decisions (2026-10-07)
| # | Decision | Recorded in |
|---|---|---|
| 1 | Follow-up drafting is in the MVP, human-controlled; no autonomous external communication | C-001, ADR-0005 |
| 2 | Ollama/self-hosted adapter stays experimental and unsupported (P2) | C-004 |
| 3 | Microsoft 365 via Microsoft Graph is the first platform (Outlook, Calendar, Teams meeting context where permitted); domain stays provider-neutral | ADR-0003 |
| 4 | Microsoft Entra ID is the first identity provider, behind an extensible abstraction | ADR-0004 |
| 5 | Secrets only via `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` (+ ROOK env vars); never in code or chat | `docs/integrations/microsoft365.md` |
| 6 | All 15 skills kept; observability and DevOps are lightweight in the MVP | `docs/skills/README.md` |
| 7 | Keep the prototype; harden incrementally | ADR-0002 |
| 9 | Trust layer first: FACT / INFERENCE / RECOMMENDATION / UNKNOWN, provenance, permission-before-retrieval | this plan, R16–R17 |

## MVP success definition (acceptance test, product owner 2026-10-07)
1. A user connects Microsoft 365.
2. ROOK obtains permitted email, calendar and meeting information.
3. ROOK generates an executive brief.
4. The user opens an upcoming meeting and receives contextual preparation.
5. ROOK identifies an explicit decision and its associated commitments.
6. ROOK tracks the commitments.
7. A dependency becomes delayed.
8. ROOK detects and explains the risk.
9. The user asks **"What changed and what should I do?"**, and ROOK gives one evidence-backed answer containing what changed, why it matters, relevant evidence, a recommended action, and the confidence and type of each claim.
10. The user requests a follow-up draft, and ROOK generates it.
11. The user explicitly approves before any external communication is sent.

Automated as `backend/tests/test_mvp_success.py` (steps 3–11 on the demo tenant, plus steps 1–2 against a mocked Microsoft Graph). The UI walk-through is part of M3.

## Milestones
| # | Milestone | Lead skills | Status |
|---|---|---|---|
| M0 | Backend spike of the core loop | intelligence skills | ✅ done |
| M2 | **Trust layer** (claim types, provenance, recommended actions, combined answer) | ai-eval, agents, retrieval, context-graph | ✅ done (this iteration) |
| M4 | **Microsoft 365 connector + Entra ID sign-in** | connectors, security, data | ✅ code done with mocked Graph tests; ⏳ needs the owner's app registration for a live run |
| M1 | Lightweight foundation: Postgres, compose, CI, timestamps in UTC with user time zone | devops (light), data, quality | ✅ done (Alembic deferred to the first shared environment, see R23) |
| M3 | Web UI P0 screens | ux, api | ⏳ next |
| M5 | LLM mode with eval parity | agents, ai-eval, observability (light) | later in MVP |
| M6 | MVP demo on staging + pilot | quality, devops | later in MVP |

## P0 traceability matrix
Status legend: ✅ implemented and tested · ⚠ partial · ⏳ planned · 🔑 waits on product-owner configuration.

| ID | Requirement (artifact) | Implementation | Tests | Acceptance criteria | Depends on | Status |
|---|---|---|---|---|---|---|
| R01 | Sign in with secure sessions (FR-01, P0 Identity) | `rook/identity/` (Entra ID OIDC + PKCE), `rook/auth.py` (session token), `api/routes.py` `/auth/*` | `tests/test_identity.py` | Entra code flow validates state, nonce, aud, iss, tid, exp; state is single-use and expires; wrong tenant is rejected; the session token is HMAC-signed with expiry; dev login can be disabled | R02 | ✅ (live run 🔑) |
| R02 | Organisation/workspace, user profile, basic roles (FR-01) | `models.py` Organization/User, provisioning in `identity/service.py` | `test_identity.py`, `test_api.py` | Tenant maps to one org; first sign-in provisions a member; `ROOK_ADMIN_EMAILS` gives admin; `/api/me` returns the profile and time zone | — | ✅ |
| R03 | Modular connector interface (FR-02) | `connectors/base.py`, registry, `ConnectorContext` | `test_api.py::test_sources_*` | New connectors register without domain changes; vendor names only in `connectors/` | — | ✅ |
| R04 | Email source: Outlook (FR-02/03) | `connectors/microsoft/` (graph client, normalise, connector) | `tests/test_microsoft365.py` | Messages normalised to signals with author, timestamp, link, quoted-reply stripping; incremental since last sync; 429 retried | R03, R07, R01 | ✅ (live 🔑) |
| R05 | Calendar source: Microsoft Calendar (FR-02/03) | same | `test_microsoft365.py` | Calendar view ±14 days normalised to meetings with attendees and purpose in UTC | R03 | ✅ (live 🔑) |
| R06 | Meeting/conversation ingestion path (FR-03) | Teams transcripts via Graph (flagged), manual transcript upload `POST /meetings/{id}/transcript` | `test_microsoft365.py`, `test_api.py::test_transcript_upload*` | VTT is converted to speaker lines and linked to the meeting; transcript permission errors are skipped and reported; upload extracts decisions and commitments | R05 | ✅ |
| R07 | Permission metadata and enforcement before retrieval/generation (FR-04, P4) | `services/permissions.py`, `services/views.py`, ACL mapping in connectors | `test_api.py::test_permissions_*`, `test_signal_access_check`, `test_microsoft365.py::test_acl` | Restricted items are invisible to non-participants in brief, Ask, lists, sources and LLM context; derived entities inherit visibility | R03 | ✅ |
| R08 | Executive Home: Needs Attention, Today, Pending Decisions, Active Commitments, Waiting For, Risks, Recent Changes (FR-05) | `services/briefing.py`, `GET /api/brief` | `test_api.py::test_brief` | All sections present; "today" in the user's time zone; every item has evidence and a claim type | R07, R16, R17 | ✅ API · ⏳ UI (M3) |
| R09 | Ask ROOK minimum questions (FR-10): attention, changed, pending decisions, waiting for, overdue, prepare next meeting, at risk | `services/ask.py` | `tests/test_ask.py` | Each question routes to its intent and returns a non-empty, evidence-backed structured answer on demo data | R07, R16 | ✅ |
| R10 | "What changed and what should I do?" single combined answer (success definition step 9) | `services/ask.py::_changed_and_do` | `test_ask.py`, `test_mvp_success.py` | Answer contains `what_changed`, `why_it_matters`, `evidence`, `recommended_actions`, with confidence and claim type on every claim | R15, R17 | ✅ |
| R11 | Meeting preparation (FR-06) | `services/meetings.py::preparation` | `test_api.py`, `test_mvp_success.py` | Purpose, participants, previous meetings, decisions, open actions, risks, related sources, suggested questions (as RECOMMENDATION) | R07 | ✅ |
| R12 | Post-meeting extraction: decisions, commitments, risks, open questions (FR-06/07/08) | `services/meetings.py::post_meeting`, `ai/extraction.py` | `test_extraction.py`, `test_api.py::test_transcript_upload*` | Explicit decisions and commitments extracted with quotes; inferred actions are `proposed`; open questions listed | R06 | ✅ |
| R13 | Decision register: decision, date, maker, participants, context, source, status, related actions (FR-07) | `models.Decision`, `views.decision` | `test_pipeline.py` | All fields present; related commitments linked; cross-channel duplicates merged with corroborating evidence | R16 | ✅ |
| R14 | Commitment register: commitment, owner, due, source, confidence, status, related decision/project (FR-08) | `models.Commitment.decision_id`, `pipeline._link_decision` | `test_pipeline.py` | Explicit vs inferred distinguished; related decision linked when evidence supports it; completion is detected from a later signal | R13 | ✅ |
| R15 | Basic risk radar: risk, severity, evidence, related project/commitment, recommended next step (FR-09) | `services/risk.py` | `test_pipeline.py::test_risk_*` | Each risk has explanation, evidence, `recommended_action` (RECOMMENDATION), related commitment/decision; auto-resolves when cleared | R14 | ✅ |
| R16 | Evidence/provenance for every significant insight (FR-11) | `models.Evidence`, `views.py` | `test_trust.py` | Every decision, commitment, risk and answer item carries ≥1 visible source with timestamp, author, channel and excerpt, or is labelled UNKNOWN | R07 | ✅ |
| R17 | Claim types FACT / INFERENCE / RECOMMENDATION / UNKNOWN (PRD §7, decision 9) | `rook/trust.py`, applied in `views.py`, `ask.py`, `meetings.py`, `briefing.py` | `test_trust.py` | Explicit statements → FACT; derived/overdue/risks/inferred → INFERENCE; suggested steps/questions/drafts → RECOMMENDATION; no evidence → UNKNOWN; inferred never shown as FACT | R16 | ✅ |
| R18 | Follow-up: recommend, draft with context, explicit approval, no autonomous send (FR-12, C-001) | `services/actions.py`, policy endpoints | `test_api.py::test_followup_*`, `test_policy_*`, `test_mvp_success.py` | Draft includes evidence; `auto` rejected for send kinds; only the requester can approve a send; nothing is sent without approval; Graph send off by default | R15, R01 | ✅ |
| R19 | Audit of important user, system, connector and external actions (FR-13) | `audit.py`, `AuditLog` | `test_api.py`, `test_identity.py` | Sign-in, connect, sync, extraction, risk, draft, approve, reject, block and send are each recorded with actor, intent, tool, input, authorisation, result | — | ✅ |
| R20 | Multi-tenant isolation (NFR) | `org_id` on all rows, `_owned` | `tests/test_tenancy.py` | Cross-org IDs → 404; brief and Ask never include other-org data | — | ✅ |
| R21 | Web UI P0 screens, empty/loading/error states, WCAG 2.2 AA (UX spec) | `frontend/` | Playwright | Per `rook-ux` | R08–R18 | ⏳ M3 |
| R22 | Model-provider abstraction with deterministic fallback (NFR) | `ai/providers.py` | `test_extraction.py` | Rules mode works with no key; LLM output must quote the source or is dropped | — | ✅ |
| R23 | Lightweight DevOps: compose (Postgres + API), CI, no secrets in repo | `docker-compose.yml`, `backend/Dockerfile`, `.github/workflows/ci.yml` | CI | One-command local run; CI runs tests on SQLite and Postgres | — | ✅ (Alembic ⏳ before the first shared environment) |
| R24 | Lightweight observability: structured logs without content, health | `rook/logging.py`, `/api/health` | `test_api.py` | JSON logs with org and request IDs; no message bodies in logs | — | ✅ |

## Out of scope for MVP (do not build)
CRM; autonomous or unrestricted communication; performance scoring; complex financial analytics; digital twin;
autonomous multi-agent execution; graph DB; every P1/P2 item (Slack, Teams chat channels, documents, Jira, …,
timeline UI, stakeholder UI, weekly brief); production self-hosted inference.

## Actions for the product owner
See `docs/integrations/microsoft365.md`: register the Entra ID app, grant the delegated scopes (admin consent for
transcripts), and set the environment variables in the deployment secret store. Secret values are never shared in chat or committed.
