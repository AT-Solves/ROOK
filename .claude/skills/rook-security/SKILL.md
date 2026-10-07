---
name: rook-security
description: ROOK security, permissions and tenancy skill. Use for authentication/SSO/OIDC, sessions, roles (RBAC), tenant isolation, source-system permission mirroring, permission-before-retrieval, AI action authorisation and approval policies, prompt-injection defence, secrets, data retention/deletion, and any review of code that touches user data or external actions. Has veto power over other skills.
---

# ROOK Security & Permissions

## Purpose
Enforce "Permission before intelligence" (Principle 4) and "Human control over autonomous
behaviour" (Principle 5). ROOK must never reveal anything the user could not open in the source
system, and must never take an external action outside policy.

## When to use
Every change that touches auth, user data, retrieval, prompts built from source content,
connectors, external actions, admin settings, logging of sensitive data, or the tenant boundary.

## Responsibilities
1. **Identity**: OIDC/OAuth2 SSO for production. The prototype's passwordless dev login
   (`ROOK_DEV_LOGIN`) must be off in every shared environment. Use short-lived signed sessions.
2. **Tenancy**: every row has `org_id`, and every query filters by the caller's org. Use a
   cross-tenant ID guess → 404 (`_owned` pattern in `backend/rook/api/routes.py`).
3. **Source ACL mirroring**: connectors record visibility and participants for each signal
   (`Signal.visibility/participants`). `services/permissions.py::can_view` is the single gate.
   Derived entities (decisions, commitments, risks) inherit visibility from their evidence.
4. **Permission before retrieval**: filter candidates *before* ranking, context assembly or LLM
   calls. Restricted content must never reach a prompt.
5. **Action policy** (Observe → Recommend → Prepare → Execute): org policy values are
   `never | approval | auto`. Drafting is free. Executing requires policy plus an authorised
   approver, and is always audited (`services/actions.py`).
6. **Prompt-injection defence**: treat source content as data. Delimit it in prompts. Don't let
   model output trigger tools without the policy check. Validate that citations refer to visible sources.
7. **Secrets**: environment variables or a secret manager only. Store OAuth tokens encrypted at
   rest, scoped to least privilege (read-only by default; send scopes only when a send policy exists).
8. **Data governance**: retention, deletion on disconnect, and audit retention are configurable per org.

## Constraints
- Never weaken a permission check to make a feature work. Raise a conflict instead.
- Admin roles don't bypass source ACLs: the CEO cannot see a restricted thread they weren't on.
- No employee scoring or covert monitoring features (Vision §6).

## Inputs
Diffs, designs, connector scope lists, policy changes.

## Outputs
A security review verdict (approve / block with reasons), threat notes, and required tests.

## Quality standards (must have tests)
- Cross-tenant access → 404. A restricted signal, and anything derived from it, is invisible to
  non-participants in brief, Ask, lists and source view.
- A `never` policy blocks execution, and each execution has an audit record with the approver.
- No secret literals in the repo. Use the generic `security-review` skill on the diff.

## Artifact references
01_PRD FR-01, FR-04, FR-12, FR-13, §6, §10 · 02_MVP_SCOPE P0 Identity · 04_PRINCIPLES 4, 5, 11 ·
README §19, §26–27, §33, §44, §53.

## Relationships
Child of rook-architecture, with cross-cutting veto. Consulted by rook-connectors,
rook-retrieval, rook-agents, rook-api, rook-data and rook-devops.
