# ROOK — instructions for Claude Code

- Product source of truth: `docs/product/` (00–04). `README.md` is the original build brief and ranks below them.
- Start every ROOK task with the `rook-orchestrator` skill (`.claude/skills/rook-orchestrator/SKILL.md`); it routes to the specialist `rook-*` skills.
- Never silently change product behaviour: log contradictions in `docs/CONFLICTS.md`. Record engineering decisions as ADRs in `docs/architecture/decisions/`.
- The plan and traceability matrix are in `docs/MVP_PLAN.md`. Build P0 only unless told otherwise.
- Backend: `cd backend && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python -m pytest -q`.
  Run: `.venv/bin/uvicorn rook.main:app --reload` (demo tenant auto-created; log in as `yamini@acme.example`).
