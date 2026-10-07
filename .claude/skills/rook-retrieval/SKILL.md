---
name: rook-retrieval
description: ROOK RAG and retrieval engineering skill. Use when changing how ROOK finds context for Ask ROOK, meeting prep or briefs - candidate generation, permission filtering, ranking (keyword, semantic, metadata, recency, source authority), graph hops, chunking/embedding, and context assembly for the LLM.
---

# ROOK Retrieval & Context Assembly

## Purpose
Return the smallest, most authoritative, permission-safe set of evidence that answers a
leadership question, so generation is grounded and cheap.

## When to use
Any change to `services/ask.py` (`_retrieve`, `_structured`, `_project_from_retrieval`), meeting
preparation context, brief assembly, or the introduction of embeddings or pgvector.

## Pipeline (fixed order)
1. **Permission filter** → only `can_view` signals and entities are candidates (FR-04). Never after ranking.
2. **Structured first** → if the question maps to a known intent (attention, changes, pending
   decisions, waiting for, overdue, prepare for meeting, at risk), answer from the structured
   registers. The MVP minimum question set (02_MVP_SCOPE "Ask ROOK") must always route here.
3. **Hybrid candidates** → keyword (the MVP), then pgvector semantic search and metadata filters
   (project, person, time range) once justified by eval results.
4. **Graph hop** → expand to linked decisions, commitments and risks (rook-context-graph).
5. **Rank** → relevance plus source authority (official > casual, README §31) plus recency.
6. **Assemble** → numbered sources `[S<id>]` with timestamp, channel and author. Enforce a token budget.
7. **Hand-off** → to generation (rook-agents) with citation-validation requirements (rook-ai-eval).

## Responsibilities
- Own intent routing and its tests.
- Own chunking and embedding strategy when it's introduced (an ADR is needed). Embeddings stay
  tenant-scoped.
- Return an explicit "insufficient evidence" signal when ranking confidence is low (Principle 3,
  README §51).

## Constraints
- No vector-only retrieval (README §29). Keyword and metadata remain part of every path.
- No cross-tenant indexes or shared embedding caches.
- No restricted content in prompts, logs or caches.

## Inputs
Question, user (for permissions), time context, the registers, signals.

## Outputs
A ranked, permission-filtered evidence set plus the structured result. The no-evidence path is explicit.

## Quality standards
- Retrieval eval: recall@5 ≥ 0.9 on the golden question set. Restricted-leak rate = 0 (hard gate).
- Each MVP minimum question has an API test asserting the intent and non-empty sources on demo data.

## Artifact references
01_PRD JTBD-6, FR-04, FR-10, FR-11, §7 · 02_MVP_SCOPE Ask ROOK minimum questions ·
03_UX_UI_SPEC §5 · 04_PRINCIPLES 3, 4 · README §17, §29–31, §48, §51.

## Relationships
Intelligence layer. Depends on rook-security (filter), rook-context-graph (hops) and rook-data.
Feeds rook-agents. Gated by rook-ai-eval.
