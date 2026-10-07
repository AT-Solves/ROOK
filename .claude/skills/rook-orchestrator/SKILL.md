---
name: rook-orchestrator
description: Root skill for ALL ROOK development work. Use at the start of any ROOK task (feature, fix, design, review, planning) to establish source-of-truth precedence, pick the specialist ROOK skills to load, run the scope gate, and apply the ROOK definition of done. Also use whenever a technical choice might contradict a ROOK product artifact.
---

# ROOK Orchestrator (root of the ROOK skill hierarchy)

## Purpose
Single entry point that keeps every ROOK task aligned with the product artifacts and routes work to
the right specialist skills. It owns *how we work*, not any one technical area.

## When to use
- At the start of every ROOK task, before writing code or design.
- When a task touches more than one specialist area.
- When anyone (human or agent) proposes something that may conflict with an artifact.

## Source of truth and precedence
The product artifacts in `docs/product/` define product behavior. On conflict, the higher item wins:

1. `04_PRODUCT_PRINCIPLES.md` — non-negotiable principles.
2. `00_PRODUCT_VISION.md` — what ROOK is / is not.
3. `01_PRD.md` — functional (FR-xx), non-functional and trust requirements.
4. `02_MVP_SCOPE.md` — **what is built now** (P0 / P1 / P2). Governs every scope question.
5. `03_UX_UI_SPEC.md` — interaction and presentation.
6. `README.md` — the original build brief. Useful for architecture detail; never overrides 1–5.

Engineering decisions live in `docs/architecture/decisions/` (ADRs) and **must not** change product
behavior. If one would, follow the conflict protocol.

## Conflict protocol (mandatory)
Never silently change the product definition. When a decision, request or existing code conflicts
with an artifact:
1. Stop that part of the work.
2. Add an entry to `docs/CONFLICTS.md` (ID, artifacts and sections involved, the conflict,
   options, a recommendation, status `open`).
3. Tell the user in your reply, and continue only with parts that don't depend on it.
4. Only the product owner closes a conflict. Record the resolution, then update the artifact or ADR.

## Skill hierarchy and routing
```
rook-orchestrator  (this skill: precedence, routing, scope gate, definition of done)
├── rook-product            requirements, traceability, scope gate         [governance]
├── rook-architecture       system shape, module boundaries, ADRs          [foundation]
│   ├── rook-security       authN/Z, tenancy, permissions-before-retrieval  (cross-cutting, veto)
│   ├── rook-data           schema, entities, provenance, retention
│   └── rook-api            HTTP contracts, errors, pagination, versioning
├── Intelligence layer
│   ├── rook-context-graph  entities, relationships, linking, continuity
│   ├── rook-retrieval      permission-filtered hybrid retrieval, context assembly
│   ├── rook-agents         extraction/briefing/risk/communication agents, tool safety
│   └── rook-ai-eval        golden sets, grounding checks, hallucination prevention (gate)
├── Edges
│   ├── rook-connectors     source integrations, normalisation, sync, ACL mapping
│   └── rook-ux             executive UI, evidence UX, states, accessibility
└── Delivery
    ├── rook-quality        test strategy, fixtures, CI gates
    ├── rook-observability  logs, traces, metrics, AI/agent telemetry
    └── rook-devops         containers, environments, secrets, CI/CD, deployment models
```

Routing table — load these skills for these tasks:

| Task | Primary | Also load |
|---|---|---|
| New feature or story | rook-product | rook-architecture, plus the owning specialist |
| Extraction, briefing, risk or Ask logic | rook-agents | rook-retrieval, rook-ai-eval, rook-context-graph |
| Search or "answer a question" | rook-retrieval | rook-security, rook-ai-eval |
| New entity, field or relationship | rook-data | rook-context-graph, rook-security |
| New endpoint | rook-api | rook-security, rook-quality |
| New source system | rook-connectors | rook-security, rook-data, rook-observability |
| Any screen | rook-ux | rook-api, rook-product |
| Auth, roles, tenancy, external actions | rook-security | rook-architecture, rook-observability |
| CI, Docker, environments | rook-devops | rook-quality, rook-security |
| Release or PR review | rook-quality | rook-security, rook-ai-eval, plus the generic `code-review` / `security-review` |

Generic session skills such as `code-review`, `security-review` and `simplify` are reused as
tools, not duplicated. ROOK skills add the ROOK-specific checklists those generic skills apply.

## Scope gate (run before building anything)
1. Which FR / JTBD / P-level in the artifacts does this serve? If none, don't build it (MVP rule).
2. Is it P0? If it's P1 or P2, build it only on an explicit request and note that in the PR.
3. Does it strengthen the loop Communication → Context → Decision → Commitment → Follow-up →
   Risk → Executive Brief? If not, defer it.
4. Does it respect all 12 principles? If not, raise a conflict.

## Definition of done (every ROOK change)
- Traceable to an FR/JTBD and a scope level (rook-product).
- Tenant-scoped, and permission-filtered before retrieval or display (rook-security).
- Every insight carries provenance and a fact / inference / recommendation / unknown label (rook-ai-eval).
- Every AI or external action is audited with actor, intent, tool, input, authorisation and result.
- Tests added: unit, plus API or eval where relevant (rook-quality).
- UX has empty, loading and error states and is keyboard accessible (rook-ux).
- No secrets in code; config comes from the environment (rook-devops).
- `docs/CONFLICTS.md` and ADRs updated if a decision was made.

## Outputs
A short plan naming the skills used, the FR/scope mapping, any conflicts raised, and the
definition-of-done checklist status in the PR description.
