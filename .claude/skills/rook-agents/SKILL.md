---
name: rook-agents
description: ROOK AI agent engineering skill. Use when building or changing ROOK's specialised AI components - extraction (decisions, commitments, completions), meeting prep, briefing, risk radar, follow-up/communication drafting, Ask ROOK answer generation - including prompts, model routing, structured outputs, tool use, and the observe/recommend/prepare/execute control model.
---

# ROOK AI Agents

## Purpose
Turn retrieved evidence into executive intelligence through small, specialised,
deterministic-first components, never one giant autonomous agent (README §32, PRD §10).

## When to use
Changes under `backend/rook/ai/` or the agent-like services: `services/briefing.py`,
`meetings.py`, `risk.py`, `actions.py`, and the generation path in `ask.py`.

## Agents (MVP set)
| Agent | Code | Mode |
|---|---|---|
| Extraction (decision, commitment, completion) | `ai/extraction.py` | Observe |
| Risk radar | `services/risk.py` (explainable rules) | Observe and recommend |
| Briefing | `services/briefing.py` | Recommend |
| Meeting prep and post-meeting | `services/meetings.py` | Recommend |
| Communication (follow-up drafts) | `services/actions.py` | Prepare, then execute only by policy |
| Answering | `services/ask.py` | Recommend |
| Validation (grounding) | `ai/extraction.py` quote check, `ask.py` citation check | Gate |

## Responsibilities
- **Deterministic fallback**: every agent works with `ROOK_LLM_PROVIDER=rules`. LLMs improve
  coverage and wording, and are never the only path.
- **Structured outputs**: JSON contracts with verbatim `quote` fields. Drop items whose quote
  isn't in the source.
- **Explicit versus inferred**: inferred actions become `proposed` commitments that need human
  acceptance (PRD JTBD-4, README §11).
- **Model routing**: route classification or extraction to cheaper models and synthesis to
  stronger ones. Sensitive tenants go to an approved or local provider (`ai/providers.py`).
  Provider choice is configuration, not code.
- **Tool safety**: every action has actor, intent, tool, input, authorisation and result in the
  audit log. No hidden autonomous actions. External execution goes through `actions.approve`
  and the org policy.
- **Risk explanations**: every risk states what, why, source, when and suggested next step
  (UX §9, README §43). There are no opaque scores.
- **Tone**: copy follows the ROOK personality (calm, precise, no manufactured urgency).

## Constraints
- No autonomous multi-agent execution, and no sending without policy (PRD §10).
- Prompts treat source text as untrusted data (rook-security).
- Never fabricate people, dates, decisions or reasons. Say "I couldn't find enough evidence…".

## Inputs
Evidence sets from rook-retrieval, entities from rook-context-graph, org policy.

## Outputs
Typed extraction results, briefs, prep packs, risk records, draft actions, and answers with citations.

## Quality standards
- Each agent has unit tests on rules mode and eval cases (rook-ai-eval) for LLM mode.
- A prompt change requires an eval run with no regression on grounding or precision.

## Artifact references
00_VISION §5, §11 · 01_PRD FR-05–12, §7 · 02_MVP_SCOPE Meeting Intelligence, Risk Radar ·
04_PRINCIPLES 5, 8, 9 · README §19–20, §28, §32–33, §42–43.

## Relationships
Intelligence layer. Depends on rook-retrieval, rook-context-graph and rook-security (actions).
Gated by rook-ai-eval. Observed by rook-observability.
