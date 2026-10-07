# ADR-0003 — Microsoft 365 (Graph) as the first enterprise connector, provider-neutral domain

- **Status:** accepted (product-owner decision 2026-10-07)
- **Context:** MVP P0 needs one email source, one calendar source and a meeting/conversation path. The product owner chose Microsoft 365.
- **Decision:**
  - A single `microsoft365` connector (`backend/rook/connectors/microsoft/`) uses Microsoft Graph with **delegated** permissions per user: Outlook mail, calendar, and Teams meeting transcripts where the tenant permits.
  - Vendor concepts (Graph IDs, `webLink`, `onlineMeeting`, VTT, Windows time zones) stay inside the connector. It emits only the provider-neutral `NormalizedSignal` / `NormalizedMeeting` / `DirectoryPerson` records. The domain model, pipeline, services and API contain no Microsoft-specific concepts, so Google Workspace can be added later as another connector with no domain change.
  - Access control is mirrored from the source: each mail item is `restricted` to its sender and recipients plus the mailbox owner, and each meeting and transcript to its attendees.
  - Sync is incremental by timestamp (lookback window on first sync). Graph delta queries come later. A 429 is retried using `Retry-After`. A transcript permission failure is skipped and reported, never fatal (graceful degradation, PRD §6).
  - Sending (`Mail.Send`) is off by default (`MICROSOFT_ENABLE_SEND=false`) and, when enabled, only runs after explicit user approval (ADR-0005).
- **Consequences:** Projects are not a Graph concept, so admins define projects and aliases in ROOK for linking (`POST /api/projects`). The required configuration is documented in `docs/integrations/microsoft365.md`.
