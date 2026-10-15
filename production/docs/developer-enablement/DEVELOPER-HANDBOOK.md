# Developer Handbook

## Goal

A developer should be able to clone the repository, run the platform, understand ownership boundaries, implement a module safely, test it, and submit a reviewable PR without relying on undocumented tribal knowledge.

## Repository entry points

- Production implementation: `production/`
- Web Portal: `production/apps/web-portal/`
- Endpoint Agent: `production/apps/endpoint-agent/`
- Android Assets app: `production/apps/assets-mobile/`
- Platform API: `production/services/platform-api/`
- Meeting service: `production/services/meeting-service/`
- Shared packages: `production/packages/`
- Module registry: `production/module-manifests.json`
- Architecture contracts: `production/docs/contracts/`
- UX contracts: `production/docs/ux/`

## Local setup

Required:

- Node.js 18.18+; Android mobile currently requires Node.js 20.19.4+
- Corepack
- pnpm 10.17.0 as pinned by the repository
- .NET 10 SDK; baseline 10.0.103
- Docker
- Git

From `production/`:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run check
```

Local PostgreSQL and Keycloak:

```bash
cd infrastructure/docker
cp .env.example .env
docker compose up -d
```

## Before changing a module

Confirm:

1. What business capability owns the change?
2. Which surface owns the interaction: Web Portal, Endpoint Agent, or Android?
3. Which module owns the data?
4. Which permission protects the operation?
5. Is the operation resource-scoped?
6. Does another module need the result synchronously or asynchronously?
7. Does the change need audit or an event?
8. Which tests prove the boundary?

## Module ownership model

Product modules live inside the Platform API modular monolith unless there is a documented reason for a separate deployable service.

A separate service should have a real deployment/runtime reason such as independent scaling, GPU/AI workload, long-running processing, failure isolation, or a distinct lifecycle.

## Definition of Done

A module change is done only when:

- architecture boundaries remain valid,
- permission and scope are enforced server-side,
- data ownership is preserved,
- audit/events are implemented where required,
- UX follows frozen contracts,
- required automated tests pass,
- `corepack pnpm run check` passes,
- CORE CI checks are green,
- the PR explains cross-module impact.
