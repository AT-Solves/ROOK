---
name: rook-product
description: ROOK product management and requirements skill. Use when turning a request into ROOK stories and acceptance criteria, checking scope (P0/P1/P2), tracing work to FR-xx/JTBD in the ROOK PRD, writing or updating the MVP plan, prioritising a backlog, or deciding whether a feature belongs in ROOK at all.
---

# ROOK Product & Requirements

## Purpose
Keep every piece of ROOK work traceable to the product artifacts and inside the current scope.
This skill guards the core leadership loop and the rule "every feature must strengthen the loop".

## When to use
- Before any feature work: write the story, acceptance criteria and scope level.
- When a request is ambiguous, large, or "sounds intelligent" but has no JTBD.
- When updating `docs/MVP_PLAN.md` or the backlog.
- When evaluating a conflict raised under the rook-orchestrator protocol.

## Responsibilities
- Map work to **JTBD-1..7** and **FR-01..13** (`docs/product/01_PRD.md`) and to the P0/P1/P2 lists
  (`docs/product/02_MVP_SCOPE.md`).
- Write user stories in PRD voice ("As a leader…") with testable acceptance criteria. Include
  trust criteria: provenance, fact versus inference, and "say unknown" behaviour.
- Maintain the traceability matrix in `docs/MVP_PLAN.md` (requirement → milestone → status → tests).
- Keep the MVP success demonstration (02_MVP_SCOPE §"MVP Success Demonstration") runnable
  end to end as the acceptance test for the MVP.
- Define product metrics per the North Star ("important organisational signals converted into
  timely executive action"). Never use AI-activity counts as a success metric.

## Constraints
- Never add PRD "Out of Scope for MVP" items: CRM, unrestricted autonomous communication,
  performance scoring, complex financial analytics, digital twin, autonomous multi-agent execution,
  graph DB without validated scale.
- Never design features that read as employee surveillance (Vision §6, README §44). Stakeholder
  context must be framed as relationship context for the leader, not scoring of people.
- Don't change artifact wording. Propose changes through `docs/CONFLICTS.md`.
- Personality constraints apply to copy: calm, precise, no manufactured urgency (Principle 8).

## Inputs
User request, `docs/product/*`, `docs/MVP_PLAN.md`, `docs/CONFLICTS.md`, current code state.

## Outputs
- A story with ID, JTBD/FR references, scope level, acceptance criteria, and a trust criteria
  section listing evidence, confidence and unknown handling.
- Updates to the traceability matrix.
- Conflict entries when a request contradicts an artifact.

## Quality standards
- Every acceptance criterion can be verified by a test or a demo step.
- Every P0 requirement has at least one story, and every story has exactly one scope level.
- Nothing is marked "done" without a passing test referenced in the matrix.

## Artifact references
00_PRODUCT_VISION §5–8, §13 · 01_PRD §3–10 · 02_MVP_SCOPE (all) · 04_PRODUCT_PRINCIPLES 2, 6, 12.

## Relationships
Parent: rook-orchestrator. Feeds every other skill with stories and acceptance criteria.
Consults rook-ux for interaction acceptance criteria and rook-ai-eval for trust criteria.
