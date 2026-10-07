---
name: rook-ai-eval
description: ROOK AI evaluation and hallucination-prevention skill. Use when changing prompts, extraction rules, risk rules, retrieval, or model/provider; when adding golden test cases; when labelling outputs as fact/inference/recommendation/unknown; or when judging whether a ROOK AI output is trustworthy enough to ship.
---

# ROOK AI Evaluation & Hallucination Prevention

## Purpose
Make "Evidence over confidence theatre" (Principle 3) and "Explicit fact over inference"
(Principle 9) measurable. This skill is a release gate for every AI-affecting change.

## When to use
Any change to prompts, rules, models, retrieval, linking, or answer formatting. Use it before
release, and whenever a user reports a wrong or unsupported insight.

## Responsibilities
- **Golden dataset** in `backend/evals/` with realistic multi-channel scenarios. The demo tenant
  is scenario 1. Each scenario has expected decisions, commitments (explicit or inferred, owner,
  due date), completions, risks, merges, and answers to the MVP question set.
- **Metrics**: extraction precision and recall per type; inferred→explicit misclassification
  rate (target 0); merge precision; risk precision; answer groundedness (every claim cites a
  visible source); citation validity; restricted-leak rate (must be 0); and the
  correct-abstention rate on unanswerable questions.
- **Grounding checks at runtime**: verbatim quote validation for extraction; citation-ID
  validation for answers; abstain when there is no evidence.
- **Epistemic labels** (PRD §7): every surfaced claim is one of `fact` (stated in a source),
  `inference` (evidence-backed), `recommendation`, or `unknown`. Confidence follows README §42:
  high = an explicit official source, medium = multiple signals, low = indirect.
- **Decompose mixed answers (C-008, product owner 2026-10-07)**: "ROOK must decompose mixed answers into individually typed claims rather than assigning one weakest-confidence label to the entire response."
  A composite answer has no answer-level `claim_type`. Instead it has ordered `units`:
  FACT (what changed, cited) → INFERENCE (why it may matter, cited, with confidence) →
  RECOMMENDATION (what to consider next) → UNKNOWN (what the evidence cannot establish, with no supporting
  citations). `rook/trust.py::answer_violations` enforces this at runtime.
  `backend/tests/test_eval_answers.py` validates every MVP question for two users, and includes negative cases.
- **Regression gate**: CI runs evals in rules mode (deterministic). Run LLM-mode evals on demand
  or nightly with recorded results.

## Constraints
- Never collapse mixed claim types into one label: not the weakest, not the strongest.
- Never tune to the test set by special-casing scenario text. Add new scenarios instead.
- An eval run that can't reach a model must report "skipped", not "passed".
- Never ship a change that raises the restricted-leak rate or lowers groundedness.

## Inputs
Golden scenarios, the changed component, provider configuration.

## Outputs
An eval report (metrics compared with the baseline), new golden cases for each bug, and a ship or block verdict.

## Quality standards (MVP gates)
Extraction precision ≥ 0.9 (explicit commitments and decisions); recall ≥ 0.8; merge precision
≥ 0.9; groundedness = 100% of claims cited; leak rate = 0; abstention correct on ≥ 95% of
unanswerable questions.

## Artifact references
00_VISION §10 · 01_PRD JTBD-4/6, FR-07–11, §7 · 02_MVP_SCOPE Evidence · 04_PRINCIPLES 3, 4, 9 ·
README §18, §42–43, §51.

## Relationships
Gate for rook-agents, rook-retrieval and rook-context-graph. Uses rook-quality's CI. Reports
into rook-product's traceability matrix.
