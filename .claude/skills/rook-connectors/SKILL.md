---
name: rook-connectors
description: ROOK communication and integration connector skill. Use when adding or changing a ROOK source connector (Gmail, Google Calendar, Outlook, Microsoft Calendar, Teams, Slack, Jira, Confluence, SharePoint, Zoom, ...) - OAuth setup, scopes, sync/incremental cursors, normalisation into Signal/Meeting, ACL/permission metadata, rate limits, send capability, and connector failure handling.
---

# ROOK Connectors

## Purpose
Bring permitted source information into ROOK as normalised, ACL-annotated records through
independent, replaceable connectors (FR-02, FR-03; Principle 10).

## When to use
Any change under `backend/rook/connectors/`, or a new integration.

## Contract
Implement `BaseConnector` (`connectors/base.py`):
`sync(since) -> SyncBatch(signals, meetings, people, projects)`, optional `send(OutboundMessage)`,
plus class metadata (`kind`, `display_name`, `category`, `phase`, `required_env`, `scopes`,
`can_send`). Register the connector in `connectors/__init__.py::REGISTRY`.

## Responsibilities
- **Sequencing per MVP scope** (this overrides README §37 Phase 1 where they differ):
  P0 = one email source, one calendar source, and a meeting or conversation ingestion path (the
  manual transcript upload already exists). P1 = Slack, Teams, a document source. P2 = Jira,
  Confluence, GitHub, SharePoint, OneDrive, Zoom, Meet, CRM.
- **OAuth**: authorisation-code flow with PKCE where supported. Tokens are encrypted at rest and
  refreshed. Request read-only scopes by default. Request send scopes only if the org policy allows
  sending.
- **ACL mapping**: set `visibility` and `participants` on every signal to mirror who can see it
  at the source (mail: recipients; private channels: members; calendar: attendees). When in
  doubt, use `restricted`.
- **Normalisation**: stable `external_id`, the author, an accurate UTC `occurred_at`, a source
  `url` for "open original", and an `authority` value per source type (README §31).
- **Incremental sync**: cursors or delta tokens, idempotent upserts, backoff on rate limits.
  Partial failure must not block other connectors (graceful failure, PRD §6).
- **Disconnect**: revoke tokens and delete or retain data per the org retention policy.

## Constraints
- No vendor logic outside the connector module.
- No polling more often than the admin-configured frequency. Use webhooks or push where available.
- No data beyond what features need (data minimisation).
- Never hard-code to Microsoft Teams. ROOK stays channel-agnostic (README §5).

## Inputs
Vendor API docs, OAuth app credentials (supplied by the user or admin), scope decisions from rook-security.

## Outputs
A connector class, a fixture-based test suite (recorded or synthetic API responses, no live
calls in CI), a setup doc in `docs/integrations/<kind>.md`, and the required environment variables in `.env.example`.

## Quality standards
- Tests cover normalisation, ACL mapping, incremental cursor, idempotency and error paths.
- Sync status and errors are visible in Sources UI and audit, and each sync emits metrics.

## Artifact references
01_PRD FR-02, FR-03, FR-04, §6 · 02_MVP_SCOPE Connector Foundation, P1, P2 · 04_PRINCIPLES 4, 10 ·
README §5, §30–31, §37.

## Relationships
Edge skill. Depends on rook-security (scopes, ACL), rook-data (normalised schema) and
rook-observability (sync telemetry). Feeds the pipeline consumed by rook-context-graph.
