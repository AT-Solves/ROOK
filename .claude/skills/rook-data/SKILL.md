---
name: rook-data
description: ROOK data architecture skill. Use when adding or changing ROOK entities, tables, fields, indexes, migrations, provenance/evidence storage, retention rules, or the normalised signal format; and when choosing Postgres/pgvector storage patterns.
---

# ROOK Data Architecture

## Purpose
Store ROOK's organisational memory as structured, tenant-isolated, provenance-linked data, so
continuity (Principle 7) and evidence (Principle 3) are guaranteed by the schema.

## When to use
Any change to `backend/rook/models.py`, migrations, the normalised record types in
`connectors/base.py`, or any persistence of AI output.

## Core model (MVP)
Organization · User · Person · Project · Connector · **Signal** (normalised source item, with ACL
metadata and authority) · Meeting · Decision · Commitment · Risk · **Evidence** (entity → signal +
quote) · ActionProposal · AuditLog.

## Responsibilities
- Every table carries `org_id`, indexed. Unique constraints are scoped by org.
- Every AI-derived row links to at least one `Evidence` row. A derived fact with no evidence
  must not be persisted.
- Store the epistemic status of each item: `kind` (explicit / inferred), `confidence`, and status
  lifecycles (decision: pending / made / superseded; commitment: proposed / open / done / dropped;
  risk: open / acknowledged / resolved).
- Use migrations (Alembic) from the first shared environment onward. `create_all` is
  prototype-only.
- Use timezone-aware timestamps stored in UTC, and convert to user time zone at the edge. The
  prototype uses naive UTC, which is a known gap.
- Retention: per-org settings, deletion that cascades from connector disconnect, and audit
  retained separately.
- Add embeddings later, in pgvector columns on Signal chunks, only when rook-retrieval needs them.

## Constraints
- Postgres is the system of record. SQLite is allowed for local and tests only.
- No separate graph DB in the MVP (PRD §10). Relationships live in foreign keys and Evidence.
- Don't store more source content than features need (data minimisation, README §44).

## Inputs
Stories, rook-context-graph entity proposals, rook-security retention rules.

## Outputs
Schema changes, migrations, index plans, and data dictionary entries in `docs/architecture/data-model.md`.

## Quality standards
- Each migration is reversible and tested on Postgres in CI.
- No N+1 queries on brief or list endpoints at demo scale (hundreds of signals).
- Every new entity has a tenant-isolation test and a provenance test.

## Artifact references
01_PRD FR-03, FR-07, FR-08, FR-11, FR-13 · 02_MVP_SCOPE Decision/Commitment Register ·
04_PRINCIPLES 3, 7, 9 · README §10–11, §15, §27, §35.

## Relationships
Child of rook-architecture. Works with rook-context-graph (semantics) and rook-security
(tenancy, retention). Consumed by rook-api and rook-retrieval.
