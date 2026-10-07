# ROOK — MVP Development Plan

Owner skill: `rook-product`. Goal (02_MVP_SCOPE): prove one complete loop:
**Communication → Context → Decision → Commitment → Follow-up → Risk → Executive Brief**.
Acceptance test: the *MVP Success Demonstration* in `docs/product/02_MVP_SCOPE.md`, automated as a Playwright E2E.

## Current state (baseline M0, backend spike)
`backend/` already implements, on a synthetic multi-channel demo tenant (Gmail/Outlook/Slack/Teams/Meet/Jira-shaped signals):
normalised signals with ACL metadata, a pipeline, rule-based decision/commitment/completion extraction (LLM optional),
cross-channel merging with evidence, four explainable risk rules, the daily brief, meeting prep and post-meeting
extraction, transcript upload, Ask ROOK (MVP question set and retrieval fallback with abstention),
policy-gated follow-up drafts, an audit log, and a connector registry. There are 23 passing tests. See ADR-0002.

## Milestones

| # | Milestone | Scope | Lead skills | Exit criteria |
|---|---|---|---|---|
| M0 | Backend spike | P0 core logic | all intelligence skills | ✅ done, 23 tests |
| M1 | Foundation hardening | FR-01, NFRs | architecture, security, data, devops, quality | Postgres and Alembic; OIDC sign-in (Google or Microsoft); tz-aware timestamps; docker-compose; GitHub Actions CI (lint, type, tests, Postgres job) |
| M2 | Trust layer | FR-07–11, PRD §7 | ai-eval, agents, retrieval | fact/inference/recommendation/unknown labels on every insight; risk "recommended next step"; commitment ↔ related decision link; golden eval set and CI gate; "What changed and what should I do?" answered as one evidence-backed recommendation |
| M3 | Web UI (P0 screens) | Executive Home, Ask, Meeting Intelligence, registers, Sources, Settings/Audit | ux, api | Screens per UX spec with empty, loading and error states; WCAG 2.2 AA checks; MVP nav only |
| M4 | Real P0 connectors | FR-02/03, one email and one calendar | connectors, security, observability | Gmail and Google Calendar **or** Outlook and Microsoft Calendar via OAuth, incremental sync, ACL mapping, fixture tests |
| M5 | LLM mode | FR-07/08/10 quality | agents, ai-eval, observability | Provider configured; LLM-mode eval ≥ rules baseline; token, cost and latency telemetry; rules fallback verified |
| M6 | MVP demo and pilot readiness | Success demonstration | quality, devops, observability | E2E demo green on staging; runbook; security review; pilot tenant onboarded |

M1–M3 can proceed without anything from the product owner. M4 needs OAuth credentials, and M5 needs an LLM API key (see *Actions for the product owner*).

## Traceability matrix (P0)

| Requirement | Artifact | Implemented in | Status | Tests |
|---|---|---|---|---|
| Sign-in, workspace, roles, sessions | FR-01, P0 Identity | `auth.py` (dev login only) | ⚠ needs OIDC (M1) | test_api auth |
| Connector framework | FR-02 | `connectors/base.py`, registry | ✅ | test_api sources |
| One email + one calendar source | FR-02, P0 | stubs only | ❌ M4 | — |
| Meeting/conversation ingestion | P0 | transcript upload endpoint, demo connector | ✅ | test_transcript_upload |
| Permission metadata and enforcement | FR-04 | `services/permissions.py`, `views.py` | ✅ | test_permissions_*, test_signal_access |
| Executive Home sections | FR-05, P0 | `services/briefing.py` | ✅ API / ❌ UI (M3) | test_brief |
| Ask ROOK minimum questions | FR-10, P0 | `services/ask.py` | ✅ (combined "what changed and what should I do" ⚠ M2) | test_ask_* |
| Meeting prep and post-meeting | FR-06, P0 | `services/meetings.py` | ✅ | test_transcript_upload |
| Decision register | FR-07, P0 | Decision model, extraction | ⚠ participants/context/related actions (M2) | test_pipeline |
| Commitment register | FR-08, P0 | Commitment model, extraction | ⚠ related decision link (M2) | test_pipeline |
| Basic risk radar | FR-09, P0 | `services/risk.py` | ⚠ recommended next step (M2) | test_risk_* |
| Evidence / provenance | FR-11 | Evidence model, `views.py` | ✅ (labels M2) | test_pipeline |
| Audit | FR-13 | AuditLog, `audit.py` | ✅ | test_followup_* |
| Follow-up drafting | FR-12, P1 | `services/actions.py` | ✅ (scope: C-001) | test_followup_*, test_policy_* |

## Out of scope for MVP (do not build)
CRM, unrestricted autonomous communication, performance scoring, complex financial analytics, a digital twin,
autonomous multi-agent execution, a graph DB (PRD §10); everything listed under P2.

## Actions for the product owner
1. Resolve **C-001** (follow-up drafting in the MVP?) and **C-004** (keep the Ollama adapter?) in `docs/CONFLICTS.md`.
2. Pick the P0 email and calendar ecosystem: **Google Workspace** or **Microsoft 365**.
3. Create an OAuth app for that ecosystem (Google Cloud console or Microsoft Entra app registration) with the read-only
   scopes listed in `backend/rook/connectors/stubs.py`, and provide the client ID and secret as environment
   variables. They must never be committed.
4. Pick the SSO/OIDC provider for sign-in (often the same tenant as item 2).
5. Optionally, provide an LLM API key and choose a provider (Anthropic, OpenAI, or none, which keeps rules mode).
6. Choose a hosting target for staging (any Docker host with managed Postgres).
7. Provide or approve a realistic pilot dataset or test mailbox, with consent from the people in it.
