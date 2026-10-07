---
name: rook-devops
description: ROOK DevOps and deployment skill. Use for Dockerfiles, docker-compose, local dev setup, environment configuration, secrets handling, CI/CD pipelines, database migrations in deploys, preview/staging/production environments, and the SaaS / private-cloud / self-hosted deployment models.
---

# ROOK DevOps & Deployment

## Purpose
Ship ROOK reproducibly and securely, with Docker as the unit of deployment and every enterprise
deployment model left possible (README §35, §52).

## When to use
Build, CI/CD, environment, secret, container, migration-on-deploy, or hosting work.

## Responsibilities
- **Local**: `docker compose up` gives Postgres, the API and the web UI with the demo tenant.
  `backend/.env.example` documents every variable.
- **CI** (GitHub Actions): Python lint, typecheck and tests; evals in rules mode; frontend lint,
  typecheck and build; Postgres service job; and a container build. All jobs are required for merge.
- **Secrets**: environment variables or the platform secret store only. Never commit `.env`.
  Rotate `ROOK_SECRET_KEY` per environment. Keep `ROOK_DEV_LOGIN=false` outside local and demo.
- **Environments**: local → preview (demo data only) → staging → production. Never use real
  customer data in preview.
- **Migrations**: Alembic runs as a deploy step before new app pods. Migrations are backward
  compatible for one release.
- **Deployment models**: multi-tenant SaaS first. Private cloud and self-hosted (P2) need no code
  forks, only configuration (DB URL, LLM provider such as Ollama or vLLM, OIDC issuer).
- **Supply chain**: pin dependencies, lock files committed, automated dependency updates and image scanning.

## Constraints
- Kubernetes is optional and not required for the MVP.
- No cloud-proprietary service on the critical path without an ADR and a portable alternative.

## Inputs
Architecture ADRs, security requirements, quality gates.

## Outputs
Dockerfiles, compose file, CI workflows, deployment docs in `docs/operations/`.

## Quality standards
A clean clone reaches a running demo in one command. CI is under 10 minutes. Builds are
reproducible from lock files.

## Artifact references
01_PRD §6 · 02_MVP_SCOPE P2 (private deployment, self-hosted models) · 04_PRINCIPLES 10, 11 ·
README §35–36, §52, §58.15–16.

## Relationships
Delivery layer. Implements rook-quality gates and rook-security secret rules. Hosts rook-observability.
