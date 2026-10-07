---
name: rook-architecture
description: ROOK enterprise architecture skill. Use when deciding where code belongs in ROOK, adding a module or service, choosing infrastructure (DB, queue, vector store, graph store), introducing a dependency, defining the event model, or writing an ADR. Use before any change that crosses module boundaries.
---

# ROOK Enterprise Architecture

## Purpose
Keep ROOK a modular, replaceable, enterprise-first system (Principles 10, 11) that can grow from
the MVP to SaaS, private cloud or self-hosted deployment without a rewrite.

## When to use
- When adding a module or package, or moving responsibilities between layers.
- When choosing or adding infrastructure or a third-party dependency.
- When defining events, async processing, or how agents call tools.
- When writing or reviewing an ADR.

## Reference architecture (current)
```
connectors/  ->  pipeline (ingest -> normalise -> link -> extract -> track -> detect)  ->  models (Postgres/SQLite)
                                                                            |
ai/ (providers, extraction)   services/ (briefing, meetings, ask, risk, actions, permissions, views)
                                                                            |
                                         api/ (FastAPI, auth)  ->  web UI (Next.js)
```
Code: `backend/rook/`. Layer rules:
- `connectors` know vendors and nothing about extraction. `ai` knows models and nothing about HTTP.
- `services` hold business logic. They never call vendor SDKs directly; they go through the
  connector and provider interfaces.
- `api` is thin: auth, validation and serialisation only.
- Retrieval is separate from generation (README §58.5). Permission filtering happens inside
  retrieval, before generation (FR-04).

## Responsibilities
- Own the ADR log at `docs/architecture/decisions/NNNN-title.md` (context, decision,
  alternatives, consequences, artifact references).
- Own the event model (README §34) and how stages trigger each other. Today it is synchronous
  in-process. Moving to a queue (Redis/Celery or equivalent) needs an ADR.
- Keep the model-provider abstraction (FR NFR "model-provider abstraction") and the connector
  abstraction intact.
- Make sure all three deployment models (SaaS, private, self-hosted) stay possible. Don't
  depend on single-cloud managed services.

## Constraints
- PostgreSQL first. Start with pgvector, and use relational tables for the graph. A dedicated
  graph DB or vector DB needs evidence of scale and an ADR (PRD §10).
- Kubernetes is optional and Docker is enough for the MVP (README §35).
- Prefer open-source infrastructure. Commercial AI APIs go behind interfaces (README §36).
- No speculative platform work ahead of the P0 loop (Principle 12).

## Inputs
Stories (rook-product), current code, ADRs, `docs/CONFLICTS.md`.

## Outputs
ADRs, module and interface definitions, sequence or data-flow notes, and a dependency verdict.

## Quality standards
- Every new dependency or infrastructure component has an ADR with alternatives and an exit path.
- No import cycles across layers, and vendor names appear only in `connectors/` and `ai/providers.py`.
- Each module can be tested without network access, using fakes for providers and connectors.

## Artifact references
00_VISION §1, §5 · 01_PRD §6 · 02_MVP_SCOPE P2 (private deployment, self-hosted models) ·
04_PRINCIPLES 10, 11, 12 · README §28–36, §52.

## Relationships
Parent: rook-orchestrator. Children: rook-security (veto), rook-data, rook-api. Constrains the
intelligence skills (rook-context-graph, rook-retrieval, rook-agents) and the edge skills.
