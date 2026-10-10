# ROOK — Conflict & Open-Decision Log

Maintained under the `rook-orchestrator` conflict protocol. The product artifacts in `docs/product/` are
the source of truth; nothing here changes product behaviour until the product owner resolves it.

Precedence: 04 Principles > 00 Vision > 01 PRD > 02 MVP Scope > 03 UX/UI Spec > README (build brief).

| ID | Status | Topic |
|---|---|---|
| C-001 | **resolved** (product owner, 2026-10-07) | Follow-up drafting is in the MVP; human-controlled, no autonomous sending |
| C-002 | resolved by precedence | Connector sequencing: README §37 vs MVP scope |
| C-003 | resolved by precedence | Navigation: Projects / People / Briefings in MVP |
| C-004 | **resolved** (product owner, 2026-10-07) | Keep Ollama adapter as experimental/unsupported (P2) |
| C-005 | resolved — ADR-0006 | Retrieval: README hybrid/semantic vs keyword-first MVP |
| C-007 | **deferred** (product owner, 2026-10-07) | Settings screen kept out of M3; revisit in a later milestone |
| C-008 | **resolved** (product owner, 2026-10-07) | Mixed answers are decomposed into individually typed claims |

---

### C-001 — Follow-up drafting and execution scope
- **Artifacts:** 02_MVP_SCOPE P1 "Draft follow-up messages" · 01_PRD FR-12 (no scope level) · README §38 item 16 "Human approval for actions" (MVP).
- **Conflict:** The README brief puts human-approved actions in the MVP; the MVP scope lists drafting follow-ups as P1. The prototype backend already implements draft → approve → execute (demo outbox only) with policy and audit.
- **Options:** (a) keep it in the MVP as the "Follow-up" step of the MVP loop (the loop in 02_MVP_SCOPE names *Follow-up*); (b) hide it behind a feature flag until P1.
- **Recommendation:** (a). The MVP goal loop explicitly contains "Follow-up", and the code is small, policy-gated and audited. No real sending until a send-capable connector and policy exist.
- **Resolution (product owner, 2026-10-07):** **Keep in MVP**, human-controlled. ROOK may identify the need for a follow-up, recommend it, draft it, show supporting context, and must require explicit user approval before sending. ROOK must NOT autonomously send external communication in the MVP. Enforced in code: the `auto` policy is rejected for `send_email`/`send_message`, and only the requesting user can approve a send (ADR-0005).

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
- **Resolution (product owner, 2026-10-07):** **Keep as experimental/unsupported.** Self-hosted model support remains P2, must not increase MVP scope, and no production-grade self-hosted inference infrastructure is built now. The adapter is labelled experimental in code and docs.

### C-005 — Retrieval strategy for MVP
- **Artifacts:** README §29 (hybrid: semantic + keyword + metadata + graph) · 01_PRD (silent) · 04_PRINCIPLES 12.
- **Not a product conflict**, but an architecture decision: the MVP uses structured registers + keyword + authority/recency + graph hop; pgvector semantic retrieval is added when the eval set shows a recall gap. Captured as ADR-0006.

### C-007 — Settings screen in the MVP navigation
- **Artifacts:** 03_UX_UI_SPEC §3 lists *Settings*; 02_MVP_SCOPE P0 *Audit* ("track important user and system actions"); PRD user story "As an administrator, I want audit logs…"; the M3 request lists the P0 screens without Settings; `rook-ux` named Settings as part of the MVP nav.
- **Conflict:** The audit log and the AI action policy exist in the API (`GET /api/audit`, `GET/PUT /api/admin/policy`) but have no screen. Following the M3 screen list, Settings is **not** shown in the navigation, so administrators can only reach audit records through the API.
- **Options:** (a) add a minimal Settings screen in M3 (read-only audit log plus action-policy view with `auto` disabled for external communication); (b) defer it to the next milestone and keep audit API-only for now.
- **Recommendation:** (a) as a small follow-up. The data and endpoints already exist, and it makes FR-13 visible to administrators.
- **Resolution (product owner, 2026-10-07):** **Deferred.** Settings stays out of M3 because it was not part of the agreed P0 screen scope. Do not start it until the owner schedules it. Audit and policy remain available through the API.

### C-008 — Claim type of a composite direct answer
- **Artifacts:** 01_PRD §7 (distinguish fact / inference / recommendation / unknown); 04_PRINCIPLES 9; UX §5 (direct answer first).
- **Observation:** For "What changed and what should I do?", the one-sentence direct answer combines a fact (what changed), an inference (why it matters) and a recommendation. The UI labels the whole sentence with the **weakest** applicable type (INFERENCE), so it is never shown as a fact. Each part is then broken out below with its own label and evidence.
- **Options:** (a) keep the weakest-type label on the summary sentence (current); (b) drop the summary sentence and show only the labelled parts; (c) render the summary as three labelled clauses.
- **Recommendation:** (a). It is conservative and readable, and nothing is overstated.
- **Resolution (product owner, 2026-10-07):** **Rejected (a); decompose instead.** Principle: *"ROOK must decompose mixed answers into individually typed claims rather than assigning one weakest-confidence label to the entire response."*
  The combined answer is now explicit semantic units, each with its own claim type and evidence:
  FACT (what objectively changed, with sources), INFERENCE (why it may matter, with evidence and confidence),
  RECOMMENDATION (what to consider next), and UNKNOWN (what ROOK cannot establish from available evidence).
  The answer has no overall `claim_type`. This is enforced by `rook/trust.py::answer_violations` and tested in
  `backend/tests/test_eval_answers.py`, `frontend/src/__tests__/trust.test.tsx` and `frontend/e2e/workflow.spec.ts`.
  Recorded in the rook-ai-eval, rook-agents and rook-ux skills. The product artifacts (`docs/product/`) are unchanged; adding the principle to PRD §7 is the owner's call.

### C-006 — Environment variable names for Microsoft credentials
- **Artifacts:** product-owner decision 2026-10-07 names `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`; the prototype used a `ROOK_` prefix.
- **Resolution:** The owner's names are used unprefixed (informational; no product impact).

### C-009 — "Waiting for you" metric label on Home
- **Artifacts:** design-system rebuild brief (2026-10-10) lists the Home metric as **WAITING FOR YOU**; 03_UX_UI_SPEC §4 and MVP P0 name the section **Waiting For**; the API field `counts.waiting_for` counts commitments **other people owe the user**.
- **Conflict:** "Waiting for you" reads as *items waiting on the user* — the opposite of what the number counts. Relabelling it would silently change what the metric means.
- **Options:** (a) keep **Waiting for** (current; matches the UX spec and the Home section it links to); (b) use **Waiting on others** for clarity; (c) use **Waiting for you** and change the count to items blocked on the user (a product/API change).
- **Recommendation:** (a). The visual rebuild ships with (a); no behaviour changed.
- **Resolution (product owner, 2026-10-10):** **"Waiting on others".** "Waiting for you" implies people are waiting for the leader; "Waiting on others" means the leader is waiting for another person, team or system. Terminology only — `counts.waiting_for` and the underlying data are unchanged. Applied to the Home metric, the matching Home section and the Commitments tab. Distinction kept: *Your commitments* = owned by the user; *Waiting on others* = commitments/dependencies the user is waiting for.

### C-010 — Home information architecture (Executive Command Center)
- **Artifacts:** `03_UX_UI_SPEC §4` lists Home's main sections as Needs Your Attention, Today, Decisions, Commitments, Waiting For, At Risk, Recent Changes; product-owner brief (2026-10-10) replaces them with Executive pulse, One thing needs your judgment, Your next moves, Today's moves, Watch, Recent changes, organised around *situations*.
- **Conflict:** the new IA no longer shows the registers as separate Home sections. Their content is kept and regrouped (attention → judgment + next moves; today → today's moves; decisions/commitments/waiting for → situations, pulse, next moves; at risk → watch); every register stays in its module.
- **Resolution:** pending product-owner approval of `docs/design/ROOK_HOME_UX_SPEC.md`. `docs/product/` is not edited; updating UX §4 is the owner's call.
