# ROOK — instructions for Claude Code

- Product source of truth: `docs/product/` (00–04). `README.md` is the original build brief and ranks below them.
- Start every ROOK task with the `rook-orchestrator` skill (`.claude/skills/rook-orchestrator/SKILL.md`); it routes to the specialist `rook-*` skills.
- Never silently change product behaviour: log contradictions in `docs/CONFLICTS.md`. Record engineering decisions as ADRs in `docs/architecture/decisions/`.
- The plan and P0 traceability matrix are in `docs/MVP_PLAN.md`. Build P0 only unless told otherwise; do not start broad P1/P2 work.
- Product-owner decisions (2026-10-07): Microsoft 365 / Entra ID first (provider-neutral domain); follow-ups are drafted but **never sent without the requesting user's explicit approval**; Ollama adapter is experimental (P2); observability and DevOps stay lightweight.
- Never request, display, commit or hard-code secrets. Config comes from env vars (`backend/.env.example`).

## Backend
```
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/ruff check rook tests && .venv/bin/python -m pytest -q          # SQLite, rules mode
ROOK_TEST_DATABASE_URL=postgresql+psycopg://... .venv/bin/python -m pytest -q   # same suite on Postgres
.venv/bin/uvicorn rook.main:app --reload    # demo tenant when ROOK_DEV_LOGIN=true; log in as yamini@acme.example
```
Or `docker compose up --build` from the repo root (Postgres + API).
