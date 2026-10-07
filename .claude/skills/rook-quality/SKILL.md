---
name: rook-quality
description: ROOK quality engineering and testing skill. Use when writing or reviewing ROOK tests, choosing test levels, building fixtures/demo scenarios, setting CI gates, reviewing a PR for completeness, or verifying the MVP success demonstration end to end.
---

# ROOK Quality Engineering

## Purpose
Prove that ROOK behaves as the artifacts say, especially its trust, permission and continuity
guarantees, at every commit.

## When to use
Every code change; PR review (alongside the generic `code-review` skill); release readiness checks.

## Test pyramid
- **Unit**: extraction rules, date parsing, risk rules, linking (`backend/tests/test_extraction.py`).
- **Pipeline or scenario**: demo tenant end to end, covering continuity merges, completions and
  risk lifecycle (`test_pipeline.py`).
- **API**: authentication, tenancy, permissions, policies and audit (`test_api.py`) using
  FastAPI TestClient and in-memory SQLite.
- **Eval**: AI quality gates (rook-ai-eval).
- **E2E**: Playwright scripts the MVP Success Demonstration (02_MVP_SCOPE). Chromium is
  preinstalled in cloud sessions; never run `playwright install`.
- **Postgres**: a CI job runs the suite against Postgres before any shared deployment.

## Responsibilities
- Mandatory test classes for each feature: happy path, tenant isolation, permission (restricted
  source), no-evidence or abstention, and audit written.
- Deterministic tests: rules mode, a fixed or relative clock, and no network.
- Demo data (`connectors/demo_data.py`) stays realistic, self-consistent and relative to "now".
- CI gates: lint, typecheck, unit, API and evals must be green to merge.

## Constraints
- Never skip, disable or loosen a failing test to get green. Fix the cause.
- Live vendor calls are not allowed in CI. Use recorded fixtures.

## Inputs
Stories with acceptance criteria, diffs, and the eval reports.

## Outputs
Tests, fixtures, CI configuration, and a review checklist result in the PR.

## Quality standards
Coverage of the services and ai packages ≥ 85%. Every P0 acceptance criterion maps to at least
one test in the traceability matrix, and the MVP demo E2E is green.

## Artifact references
01_PRD §6 (automated testing) · 02_MVP_SCOPE MVP Success Demonstration · 04_PRINCIPLES 11 · README §58.13.

## Relationships
Delivery layer. Used by every skill. Runs rook-ai-eval gates in CI (rook-devops).
