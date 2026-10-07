# ROOK — Conflict & Open-Decision Log

Maintained under the `rook-orchestrator` conflict protocol. The product artifacts in `docs/product/` are
the source of truth; nothing here changes product behaviour until the product owner resolves it.

Precedence: 04 Principles > 00 Vision > 01 PRD > 02 MVP Scope > 03 UX/UI Spec > README (build brief).

| ID | Status | Topic |
|---|---|---|
| C-001 | **open** — needs product owner | Follow-up drafting + approval: P1 in MVP scope, already in prototype |
| C-002 | resolved by precedence | Connector sequencing: README §37 vs MVP scope |
| C-003 | resolved by precedence | Navigation: Projects / People / Briefings in MVP |
| C-004 | **open** — needs product owner | Self-hosted model adapter (P2) present in prototype |
| C-005 | open — architecture (ADR) | Retrieval: README hybrid/semantic vs keyword-first MVP |

---

### C-001 — Follow-up drafting and execution scope
- **Artifacts:** 02_MVP_SCOPE P1 "Draft follow-up messages" · 01_PRD FR-12 (no scope level) · README §38 item 16 "Human approval for actions" (MVP).
- **Conflict:** The README brief puts human-approved actions in the MVP; the MVP scope lists drafting follow-ups as P1. The prototype backend already implements draft → approve → execute (demo outbox only) with policy and audit.
- **Options:** (a) keep it in the MVP as the "Follow-up" step of the MVP loop (the loop in 02_MVP_SCOPE names *Follow-up*); (b) hide it behind a feature flag until P1.
- **Recommendation:** (a). The MVP goal loop explicitly contains "Follow-up", and the code is small, policy-gated and audited. No real sending until a send-capable connector and policy exist.
- **Resolution:** _pending_

### C-002 — Connector sequencing
- **Artifacts:** README §37 Phase 1 (Outlook, Teams, MS Calendar, Slack, Gmail, Google Calendar) · 02_MVP_SCOPE P0 (one email, one calendar, meeting/conversation ingestion), P1 (Slack, Teams).
- **Resolution:** MVP scope wins: P0 = one email + one calendar + transcript ingestion. Slack/Teams are P1. Recorded in `rook-connectors`.

### C-003 — Navigation items without P0 features
- **Artifacts:** 03_UX_UI_SPEC §3 lists Projects, People, Briefings · 02_MVP_SCOPE puts Timeline and Stakeholder context in P1.
- **Resolution:** UX §3 itself says "hide future modules until implemented". MVP nav = Home, Ask ROOK, Meetings, Decisions, Commitments, Risks, Sources, Settings. The prototype's project/people API endpoints stay but are not surfaced. Recorded in `rook-ux`.

### C-004 — Self-hosted model support
- **Artifacts:** 02_MVP_SCOPE P2 "Self-hosted model support" · README §36 · 04_PRINCIPLES 10 (modular).
- **Conflict:** The prototype includes an Ollama provider adapter behind the provider abstraction.
- **Options:** (a) keep the adapter as an unsupported example of the abstraction; (b) remove it until P2.
- **Recommendation:** (a): about 20 lines that prove the abstraction, with no product surface and no support commitment.
- **Resolution:** _pending_

### C-005 — Retrieval strategy for MVP
- **Artifacts:** README §29 (hybrid: semantic + keyword + metadata + graph) · 01_PRD (silent) · 04_PRINCIPLES 12.
- **Not a product conflict**, but an architecture decision: the MVP uses structured registers + keyword + authority/recency + graph hop; pgvector semantic retrieval is added when the eval set shows a recall gap. To be captured as ADR-0003 by `rook-retrieval` / `rook-architecture`.
