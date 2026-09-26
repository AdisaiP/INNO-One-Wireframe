# INNO.One — Production Project Skeleton

**Date:** 2026-09-26
**Status:** Step 14 production scaffold
**Production Skeleton Contract:** 0.5.0
**Data Model Contract:** 0.4.0
**Event & Audit Contract:** 0.3.0
**API Contract:** 0.2.0
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0

## 1. Purpose

Step 14 turns the frozen architecture/contracts into a buildable production repository skeleton without implementing feature-heavy business logic and without replacing the frozen HTML prototype.

The new implementation lives under 'production/'.

The existing prototype remains the UX/UI source of truth until each frozen screen is deliberately ported into React.

## 2. Technology checkpoint

The production skeleton currently uses:

- **.NET 10 / ASP.NET Core** for Platform API and the initial Meeting service boundary.
- **EF Core 10.0.4 + Npgsql 10.0.3** for PostgreSQL persistence.
- **React 19.2 + TypeScript 5.9.3 + Vite 6.4.3** for the Web Portal.
- **pnpm 10.17 workspaces** for Web/shared TypeScript packages.
- **PostgreSQL** as frozen by Step 13.
- **Keycloak** behind the identity adapter boundary.
- **MeshCentral** behind the Devices remote-engine adapter boundary.

The Endpoint Agent implementation language remains intentionally deferred.

Android/Expo remains the Assets Mobile direction; its heavy runtime scaffold begins with the first mobile vertical slice rather than Step 14.

## 3. Repository structure

~~~text
production/
├── INNO.One.sln
├── global.json
├── Directory.Build.props
├── Directory.Packages.props
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── web-portal/
│   ├── endpoint-agent/
│   └── assets-mobile/
├── services/
│   ├── platform-api/
│   │   └── src/
│   │       ├── INNO.One.PlatformApi/
│   │       ├── INNO.One.Contracts/
│   │       ├── INNO.One.SharedKernel/
│   │       ├── INNO.One.Infrastructure/
│   │       ├── Integrations/
│   │       │   ├── Keycloak/
│   │       │   └── MeshCentral/
│   │       └── Modules/
│   │           ├── Platform/
│   │           ├── Devices/
│   │           ├── Assets/
│   │           ├── Helpdesk/
│   │           └── Reports/
│   └── meeting-service/
├── packages/
│   ├── ui/
│   ├── contracts/
│   ├── auth/
│   └── shared/
├── infrastructure/
├── tests/
└── docs/
~~~

## 4. .NET solution boundary

'INNO.One.sln' currently contains **12 buildable projects**.

Core composition:

- 'INNO.One.PlatformApi'
- 'INNO.One.Contracts'
- 'INNO.One.SharedKernel'
- 'INNO.One.Infrastructure'
- 'INNO.One.Modules.Platform'
- 'INNO.One.Modules.Devices'
- 'INNO.One.Modules.Assets'
- 'INNO.One.Modules.Helpdesk'
- 'INNO.One.Modules.Reports'
- 'INNO.One.Integrations.Keycloak'
- 'INNO.One.Integrations.MeshCentral'
- 'INNO.One.MeetingService'

Module projects do not compile-reference other module projects.

The Platform API composition root may reference every module because it is the host/composition layer.

## 5. Module shape

Each core module already has reserved boundaries for:

- Domain
- Application
- Infrastructure
- Contracts
- Api
- Persistence

Step 14 intentionally does not populate these folders with speculative business logic.

## 6. PostgreSQL / EF Core boundary

Buildable DbContexts now exist for:

- 'PlatformDbContext' → 'platform'
- 'DevicesDbContext' → 'devices'
- 'AssetsDbContext' → 'assets'
- 'HelpdeskDbContext' → 'helpdesk'
- 'ReportsDbContext' → 'reports'
- 'InfrastructureDbContext' → 'integration' plus future explicit audit/readmodel mappings
- 'MeetingDbContext' → 'meeting'
- 'MeetingIntegrationDbContext' → 'integration' in 'inno_meeting'

Each module owns its migration directory.

A local 'dotnet-ef' tool manifest is pinned to EF tooling 10.0.4.

No business tables/migrations are generated yet because Step 14 is a skeleton, not a fake feature implementation.

## 7. Platform API

The Platform API currently wires:

- module registration,
- PostgreSQL DbContexts,
- Keycloak JWT Bearer configuration boundary,
- authorization services,
- health endpoints.

Current executable checks:

- '/health/live'
- '/health/ready'

No Step 11 feature endpoint is falsely implemented yet.

## 8. Meeting service

Meeting is a separately runnable ASP.NET Core service in Step 14.

It owns:

- 'inno_meeting.meeting'
- 'inno_meeting.integration'

It currently wires:

- Meeting DbContext
- Meeting integration/outbox DbContext
- Keycloak JWT Bearer boundary
- health endpoints

Recording/transcription/summary feature logic remains for later vertical slices.

## 9. Web Portal

The React skeleton is buildable, uses local development port **5180**, and owns the top-level production route boundaries:

- '/'
- '/apps'
- '/devices'
- '/assets'
- '/helpdesk'
- '/meeting'
- '/reports'
- '/admin'

The shell deliberately shows boundary placeholders instead of re-inventing frozen feature screens.

Frozen UI pages will be ported by vertical slice from Design System V1.26 / UI Contract 1.20.0.

## 10. Shared Web packages

### '@inno/contracts'

Carries implementation-facing contract/version constants and stable route/API constants.

### '@inno/ui'

Starts the production Design System package and imports the frozen V1.26 token baseline.

Only a minimal primitive bridge exists in Step 14.

### '@inno/auth'

Owns client-side permission helper contracts.

Client authorization remains UX-only; API authorization is authoritative.

### '@inno/shared'

Contains small stable cross-package utilities only.

## 11. External engine boundaries

### Keycloak

Compile-time adapter project:

'services/platform-api/src/Integrations/Keycloak'

Keycloak remains Authentication/SSO only.

### MeshCentral

Compile-time adapter project:

'services/platform-api/src/Integrations/MeshCentral'

No direct vendor persistence access is introduced.

No fake MeshCentral API implementation is created in Step 14.

## 12. Local development infrastructure

'production/infrastructure/docker/compose.yml' currently provides:

- PostgreSQL 17 local checkpoint
- Keycloak 26.4 local checkpoint

PostgreSQL bootstrap creates:

- 'inno_core'
- 'inno_meeting'
- 'keycloak'

and the frozen Step 13 schemas.

PostgreSQL 17 is a **local-development image checkpoint**, not a change to Step 13's rule that production major/provider selection remains deployment-specific.

MeshCentral remains external to the local Step 14 compose stack.

## 13. Reverse proxy boundary

A reverse-proxy skeleton establishes intended ownership:

- '/api/v1/meeting/*' → Meeting service
- other '/api/*' → Platform API
- Web shell → Web Portal

This is an infrastructure boundary only; deployment technology remains deferred.

## 14. Agent and Mobile boundaries

### Endpoint Agent

Repository boundary exists, but implementation language remains deferred.

It will consume the '/api/v1/agent' contract and preserve Thai Endpoint Agent UX ownership.

### Assets Mobile

Repository boundary exists with Android/Expo direction retained.

The actual Expo runtime scaffold starts when QR/mobile authentication is implemented as a vertical slice.

This avoids pulling in a large unused mobile dependency tree before mobile work begins.

## 15. Build and validation

Current build commands:

~~~bash
cd production

pnpm install
pnpm typecheck
pnpm build

dotnet tool restore
dotnet restore INNO.One.sln
dotnet build INNO.One.sln
~~~

Both .NET runnable services have been smoke-tested through their readiness endpoints.

## 16. What Step 14 does not implement

Step 14 deliberately does not implement:

- real ticket/device/asset/report CRUD,
- real Keycloak user/profile synchronization,
- real MeshCentral calls,
- database entities for all 92 planning tables,
- Event Outbox dispatcher,
- Audit writer,
- Mobile QR scanner,
- Agent runtime,
- Meeting transcription/summary engine,
- full React port of the 93 frozen Web routes.

Those begin as vertical slices after the skeleton is accepted.

## 17. Source of truth

- 'production/production-skeleton.json'
- 'production-skeleton-audit.py'
- 'production/README.md'
- 'INNO-One-Production-Project-Skeleton.md'
- all Step 9–13 contracts

## 18. Step 14 decisions frozen

1. Production implementation lives under 'production/'; frozen prototype remains untouched.
2. Core implementation target is .NET 10.
3. Initial Meeting service also uses .NET 10.
4. Web checkpoint is React 19.2 + TypeScript 5.9 + Vite 6.4.
5. pnpm workspaces own Web/shared packages.
6. Platform API remains a modular monolith.
7. Module projects cannot compile-reference another module project.
8. Each module owns its DbContext/migrations.
9. Keycloak and MeshCentral have explicit adapter projects.
10. Web shared UI/contracts/auth/shared are packages, not copied per module.
11. Local Docker bootstrap includes PostgreSQL + Keycloak only.
12. Agent language remains deferred.
13. Assets Mobile remains Expo direction but runtime scaffold is deferred to its vertical slice.
14. No feature endpoint is marked implemented merely because a project skeleton exists.

## 19. Next step

Step 15 should implement the **first vertical slice** through the real skeleton.

Recommended slice:

**Sign in / User Profile → Organization/Permission resolution → Devices list → Device detail**

This slice proves:

- Keycloak token validation,
- INNO.One user mapping,
- RBAC/scope evaluation,
- Platform + Devices module boundaries,
- PostgreSQL migrations,
- API conventions,
- React query/API layer,
- frozen Web shell/page port,
- MeshCentral adapter mapping without leaking vendor IDs.
