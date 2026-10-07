# ADR-0006 — Keyword-first, permission-first retrieval for the MVP

- **Status:** accepted
- **Decision:** For the MVP, Ask ROOK answers from structured registers first (intent routing), then from keyword retrieval weighted by source authority and recency, plus a project graph hop. All candidates are filtered by `can_view` before ranking or generation. pgvector semantic retrieval is added only when the eval set shows a recall gap (rook-ai-eval), which keeps the infrastructure minimal (Principle 12).
