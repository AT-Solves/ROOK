---
name: rook-observability
description: ROOK enterprise observability skill. Use when adding logging, tracing, metrics, health checks, AI/LLM telemetry (latency, tokens, cost, fallbacks), connector sync monitoring, audit-vs-operational log separation, or product outcome metrics for ROOK.
---

# ROOK Observability

## Purpose
Make ROOK operable and its AI behaviour inspectable in production, without leaking user content.

## When to use
New services, pipelines, connectors, LLM calls, background jobs, or any incident or performance work.

## Responsibilities
- **Structured logging**: JSON logs with `org_id`, `request_id` and component. No message
  bodies, quotes, tokens or PII in operational logs. Content belongs only in tenant data stores.
- **Tracing**: OpenTelemetry (README §35) across API → services → retrieval → provider →
  connector, with spans for each pipeline stage.
- **Metrics**: sync duration, errors and lag per connector; extraction counts by engine; LLM
  latency, tokens, cost, error and fallback-to-rules rate per provider and model; Ask latency;
  abstention rate; and approval or rejection of actions.
- **Audit ≠ logs**: the AuditLog table is the tenant-visible compliance record (actor, intent,
  tool, input, authorisation, result). Operational telemetry is for operators. Keep them separate.
- **Product outcome metrics**: North Star components such as decisions captured, commitments
  completed versus missed, follow-ups approved, and risks surfaced before escalation. Never use
  "AI messages sent" as a success measure (README §40–41).
- **Health**: `/api/health` reports the provider mode. Add readiness checks for the DB and
  connectors before deployment.

## Constraints
- Use an open standard (OTel) exporter. Choosing an observability vendor needs an ADR.
- Telemetry must not collect per-employee behavioural profiles (surveillance boundary).

## Inputs
New components, SLOs, incidents.

## Outputs
Instrumentation, dashboards or queries as code, alert rules, and runbooks in `docs/operations/`.

## Quality standards
Every external call has a span with timeout and error attributes. Logs pass a "no content" lint
check. MVP SLO: brief p95 < 1 s (rules mode).

## Artifact references
01_PRD §6 (observability, structured logging), FR-13 · 04_PRINCIPLES 2, 11 · README §33, §35, §40–41.

## Relationships
Delivery layer. Used by rook-connectors, rook-agents and rook-api. Builds on rook-devops infrastructure.
