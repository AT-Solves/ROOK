# ROOK Skill Architecture

The skills live in `.claude/skills/rook-*/SKILL.md`. Claude Code loads them automatically in this repo, and
they can be invoked by name (for example `/rook-orchestrator`). The root is **rook-orchestrator**: every ROOK task starts there.

## Hierarchy and dependencies
```
rook-orchestrator ── precedence, routing, scope gate, definition of done, conflict protocol
├─ rook-product ─────────── stories, traceability, scope gate         → feeds all skills
├─ rook-architecture ────── layers, ADRs, infrastructure choices      → constrains all technical skills
│   ├─ rook-security (veto) authN/Z, tenancy, ACL mirroring, action policy
│   ├─ rook-data            schema, provenance, retention             ← rook-security
│   └─ rook-api             contracts, errors                         ← rook-data, rook-security
├─ intelligence
│   ├─ rook-context-graph   linking, continuity merges, timelines     ← rook-data
│   ├─ rook-retrieval       permission-first hybrid retrieval         ← rook-security, rook-context-graph
│   ├─ rook-agents          extraction / brief / risk / comms / answer ← rook-retrieval, rook-context-graph, rook-security
│   └─ rook-ai-eval (gate)  golden sets, grounding, leak = 0          gates agents, retrieval, context-graph
├─ edges
│   ├─ rook-connectors      OAuth, sync, normalisation, ACLs          ← rook-security, rook-data, rook-observability
│   └─ rook-ux              executive UI, evidence UX, a11y           ← rook-api, rook-product
└─ delivery
    ├─ rook-quality         test pyramid, CI gates                    used by all; runs rook-ai-eval
    ├─ rook-observability   OTel, metrics, AI telemetry               ← rook-devops
    └─ rook-devops          Docker, CI/CD, secrets, environments      ← rook-security, rook-quality
```

## MVP need
| Skill | MVP | Why |
|---|---|---|
| rook-orchestrator, rook-product | **Required** | Scope and traceability for every task |
| rook-architecture, rook-security, rook-data, rook-api | **Required** | FR-01/04/13, tenancy, provenance |
| rook-context-graph, rook-retrieval, rook-agents, rook-ai-eval | **Required** | The core loop and trust (FR-05–11) |
| rook-connectors | **Required** | One email and one calendar source plus transcript ingestion |
| rook-ux | **Required** | Executive Home, Ask, Meetings, registers |
| rook-quality | **Required** | Automated testing (PRD §6), MVP demo E2E |
| rook-devops | **Required (light)** | Docker plus CI only; private and self-hosted deployment is P2 |
| rook-observability | **Required (baseline)** | Structured logs and LLM/connector metrics. Full OTel dashboards and SLO alerting can wait |

Parts that can wait until after the MVP: rook-connectors P1/P2 sources (Slack, Teams, Jira, …); rook-retrieval semantic/pgvector (C-005);
rook-context-graph timelines, stakeholder context and `supersedes` (P1); rook-devops private-cloud and self-hosted packaging (P2);
rook-observability full dashboards and SLO alerting; rook-agents model routing across several providers.

## How the skills are invoked
1. **Automatically**: each skill's `description` tells Claude Code when it applies (for example, editing `connectors/` loads rook-connectors).
2. **Explicitly**: start a task with `/rook-orchestrator <task>`. It runs the scope gate and names the specialist skills to load (routing table).
3. **At review**: `rook-quality` + `rook-security` + `rook-ai-eval` checklists, together with the generic `code-review` / `security-review` skills.
4. **On conflict**: any skill that finds a contradiction with `docs/product/` writes to `docs/CONFLICTS.md` and stops that thread of work.
