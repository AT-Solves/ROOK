# ADR-0002 — Prototype backend baseline (spike)

- **Status:** accepted as a spike, to be hardened in M1
- **Context:** A backend prototype was built from the README brief before the product artifacts were provided. It proves the core loop on a synthetic multi-channel tenant.
- **Decision:** Keep it as the MVP baseline: Python 3.12+ / FastAPI / SQLAlchemy 2, SQLite locally with PostgreSQL as the target, an in-process synchronous pipeline, deterministic rule-based extraction and risk rules with optional LLM providers behind `ai/providers.py`, and HMAC session tokens with dev-only passwordless login.
- **Known gaps vs artifacts** (tracked in `docs/MVP_PLAN.md`): no real auth/SSO, no real email/calendar connector, no fact/inference/recommendation/unknown labels, risks lack a recommended next step, naive UTC timestamps, no migrations, no UI.
- **Alternatives:** Discard the spike and start from the plan. Rejected, because the spike already satisfies most P0 behaviours with 23 passing tests.
