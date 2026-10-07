---
name: rook-api
description: ROOK API architecture skill. Use when adding or changing ROOK HTTP endpoints, request/response schemas, error formats, pagination, auth dependencies, or the contract consumed by the ROOK web UI.
---

# ROOK API Architecture

## Purpose
Give the UI and future clients a stable, typed and secure contract that always returns insights
with their evidence, permission filtering already applied.

## When to use
Any change under `backend/rook/api/`, or any change to the shape of data the UI consumes.

## Responsibilities
- REST under `/api`, with typed Pydantic input models. Move responses to typed models as they
  stabilise. Publish OpenAPI at `/docs`.
- Every endpoint depends on `current_user`, and admin endpoints on `require_admin`. Health is the
  only public endpoint.
- Every insight payload includes `evidence[]`: signal ID, channel, author, timestamp, permitted
  quote and URL. It also includes `confidence`, and the fact / inference / recommendation /
  unknown label (rook-ai-eval).
- Errors use the right status: 401 unauthenticated, 403 forbidden by policy or ACL, 404 not found
  or other tenant, 409 state conflict (for example a connector not configured), 422 validation.
  Messages say what failed, whether the user needs to act, and whether ROOK can continue with
  partial data (UX spec §14).
- Mutations that change state or trigger actions write an audit record.
- Add pagination (`limit` / cursor) to any list that can grow without bound before it ships
  against real connectors.

## Constraints
- Keep business logic in `services/`, not route functions.
- No endpoint returns raw source bodies without passing `can_view`.
- Breaking contract changes need a version bump or coordinated UI change in the same PR.

## Inputs
Stories, service functions, UX screen needs.

## Outputs
Endpoints, schemas, OpenAPI, and API tests in `backend/tests/test_api.py`.

## Quality standards
- Each endpoint has tests for authentication (401), tenancy (404 across orgs) and the happy path.
- Response times stay under 300 ms at p95 for brief and list endpoints at demo scale, excluding
  LLM calls.

## Artifact references
01_PRD FR-01, FR-04, FR-10–13, §6 · 03_UX_UI_SPEC §11–14 · README §58.

## Relationships
Child of rook-architecture. Consumes rook-data and service outputs. Consumed by rook-ux.
Reviewed by rook-security and rook-quality.
