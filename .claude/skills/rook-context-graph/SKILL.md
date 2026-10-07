---
name: rook-context-graph
description: ROOK context and knowledge graph engineering skill. Use when linking signals to projects/people/meetings, deduplicating the same decision or commitment seen across channels, modelling relationships (owns, depends on, supersedes, confirms), building timelines, or reasoning about cross-channel continuity in ROOK.
---

# ROOK Context & Knowledge Graph

## Purpose
Deliver ROOK's main differentiator, **cross-channel contextual continuity** (Vision §9). The aim
is to recognise that a meeting, an email, a Slack thread and a Jira update are parts of the same
business event, and to keep a decision connected to its later actions, outcomes and risks
(Principle 7).

## When to use
- When changing entity linking (`services/pipeline.py::link_project`, `_resolve_person`).
- When changing cross-channel merging (decision and commitment deduplication with corroborating
  evidence).
- When adding a relationship type, a timeline, or project or stakeholder context.

## Responsibilities
- **Entity resolution**: people (email first, then unique name match), projects (name and aliases,
  later embeddings), and meetings (calendar event ID ↔ transcript).
- **Continuity merging**: the same commitment or decision from multiple channels becomes one
  entity with several Evidence rows ("first stated in X, confirmed in Y"). Corroboration can
  raise confidence. It never invents facts.
- **Relationships (MVP, relational)**: Person–owns→Commitment, Commitment–part of→Project,
  Decision–about→Project, Signal–evidence of→Entity, Commitment–depends on→(text dependency, later
  an entity), Signal–transcript of→Meeting. Add `supersedes` for changed decisions in P1.
- **Timeline**: ordered events per project or topic (P1 in MVP scope; the data model must already
  support it).
- **Graph-context retrieval hook**: given a question or meeting, return the connected subgraph
  for rook-retrieval to assemble.

## Constraints
- Relational tables in Postgres. No graph DB unless an ADR shows scale need (PRD §10).
- Linking must be explainable. Store why something was linked (shared IDs, alias match,
  similarity) so the UI can show it.
- An ambiguous match (for example two people with the same first name) must not link. Leave it
  unlinked and lower confidence.
- No people-scoring relationships, such as reliability scores per employee.

## Inputs
Normalised signals, extraction results, directory data from connectors.

## Outputs
Linked entities, merged evidence, timelines, and subgraphs for context assembly.

## Quality standards
- A labelled linking and merging test set in the eval suite (rook-ai-eval), with precision ≥ 0.9
  on merges. A false merge is worse than a missed merge.
- The README continuity example (decision → email confirmation → delayed dependency → risk) is
  reproduced by a regression test (`tests/test_pipeline.py`).

## Artifact references
00_VISION §3, §9 · 01_PRD JTBD-3/4, FR-03, FR-07–09 · 02_MVP_SCOPE P1 Timeline, Stakeholder
context · 04_PRINCIPLES 1, 7 · README §4, §15–16, §49–50.

## Relationships
Part of the intelligence layer under rook-orchestrator. Built on rook-data. Feeds
rook-retrieval and rook-agents. Evaluated by rook-ai-eval.
