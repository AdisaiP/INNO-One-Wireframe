# INNO.One — Implementation Architecture Contract

**Date:** 2026-09-26  
**Status:** Implementation planning contract  
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0  
**Scope:** Step 9 — Architecture & Module Boundaries  
**Backend implementation:** Not started by this document

## 1. Purpose

This document converts the final-frozen UX/UI baseline into an implementation architecture without changing the accepted UI.

The architecture must preserve these frozen product rules:

- One screen = one primary job.
- Share contracts, not navigation.
- Web Portal, Endpoint Agent and Android Mobile are separate application surfaces.
- External engines such as MeshCentral and Keycloak are providers/engines, not the INNO.One product UI.
- Modules may use different internal technology when justified, but identity, permissions, API conventions, events, audit and error semantics are shared contracts.

## 2. Architecture decision

INNO.One v1 should start as:

- one React Web Portal,
- one .NET Platform API implemented as a modular monolith,
- one Endpoint Agent application,
- one Android/Expo Assets Mobile application,
- Keycloak as the identity provider,
- MeshCentral behind an INNO.One Devices adapter,
- Meeting processing allowed to remain a separate service boundary because recording/transcription/AI processing has different runtime characteristics,
- shared contracts for API, permission, event, error and audit semantics.

Do **not** begin with dozens of microservices.

The modular monolith is the default because it preserves module boundaries while avoiding distributed-system complexity before the domain boundaries have proven they need independent scaling/deployment.

## 3. Target system context

```text
                                Keycloak
                         Authentication / SSO
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          INNO.One Platform                           │
│                                                                      │
│ Identity Profile · Organization · RBAC · App Registry · Notification │
│ Global Search · Audit                                                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                Unified API / shared contracts
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
       ▼                        ▼                        ▼
  Devices Module          Helpdesk Module           Assets Module
       │                        │                        │
       ▼                        │                        │
 MeshCentral Adapter            │                        │
       │                        │                        │
       ▼                        │                        │
  MeshCentral                   │                        │
                                │                        │
                       ┌────────▼─────────┐              │
                       │ Meeting Service  │              │
                       │ Recording / AI   │              │
                       └──────────────────┘              │
                                                        │
       ┌────────────────────────┴────────────────────────┐
       │                                                 │
       ▼                                                 ▼
 Reports / Read Models                            Notifications / Audit
```

## 4. Client surfaces

### 4.1 Web Portal

Production direction: **React**.

Owns:

- Workspace,
- App Launcher,
- Devices,
- Assets,
- Helpdesk operator console,
- Meeting web workspace,
- Reports,
- Admin Center.

Recommended source boundary:

```text
apps/web-portal/
└── src/
    ├── app/
    │   ├── router/
    │   ├── shell/
    │   └── providers/
    ├── platform/
    │   ├── workspace/
    │   ├── apps/
    │   ├── search/
    │   ├── notifications/
    │   └── account/
    ├── modules/
    │   ├── devices/
    │   ├── assets/
    │   ├── helpdesk/
    │   ├── meeting/
    │   ├── reports/
    │   └── admin/
    └── shared/
        ├── api/
        ├── auth/
        ├── components/
        ├── hooks/
        └── utils/
```

One Web deployment is preferred initially. Module boundaries are code and route boundaries, not separate micro-frontends.

### 4.2 Endpoint Agent

Owns interactions on the managed endpoint:

- Request Help,
- ownership/user confirmation,
- remote-consent prompt,
- local agent status/runtime behaviors.

The Agent may share API and design contracts with Web but must not share Web navigation.

### 4.3 Android Assets Mobile

Owns:

- camera permission,
- QR scanning,
- QR token validation result,
- mobile asset lookup,
- scan history where required.

The mobile app uses the same identity/API contracts but keeps its own navigation and mobile task model.

## 5. Server-side modules

The initial .NET Platform API should be a modular monolith with explicit module ownership.

```text
services/platform-api/
├── Host/
├── Modules/
│   ├── Platform/
│   │   ├── IdentityProfile/
│   │   ├── Organization/
│   │   ├── Users/
│   │   ├── Rbac/
│   │   ├── AppRegistry/
│   │   ├── Notifications/
│   │   ├── GlobalSearch/
│   │   └── Audit/
│   ├── Devices/
│   ├── Assets/
│   ├── Helpdesk/
│   └── Reports/
├── Integrations/
│   ├── Keycloak/
│   ├── MeshCentral/
│   ├── Email/
│   └── Ai/
└── SharedKernel/
    ├── Api/
    ├── Auth/
    ├── Events/
    ├── Errors/
    └── Observability/
```

A module should normally contain:

```text
<Module>/
├── Domain/
├── Application/
├── Infrastructure/
├── Contracts/
└── Api/
```

The shared kernel must stay small. Business entities do not belong in SharedKernel merely because multiple modules reference their IDs.

## 6. Module ownership

### Platform

Owns the canonical cross-application concepts:

- User Profile,
- Organization Unit,
- Position,
- Location,
- Role,
- Permission catalog,
- Access Assignment / Scope,
- App Registry,
- platform notifications,
- audit envelope,
- global-search orchestration.

Keycloak owns credentials/authentication; Platform owns INNO.One business identity/profile and authorization assignments.

### Devices

Owns:

- Device,
- INNO.One Device ID,
- Device Group,
- device inventory snapshot,
- remote-operation intent,
- consent policy/configuration,
- endpoint policy,
- deployment jobs,
- maintenance jobs,
- device alerts.

Devices maps its canonical Device ID to external MeshCentral Node ID.

### Assets

Owns:

- Asset,
- asset ownership,
- asset custom fields,
- software baseline/license view,
- contract/warranty records,
- QR label/token lifecycle.

Assets may reference a Device ID but does not own Device.

### Helpdesk

Owns:

- Ticket,
- ticket status,
- assignment,
- SLA policy/result,
- requester groups,
- categories,
- automation rules,
- knowledge base,
- helpdesk notification rules/templates.

Helpdesk may reference User ID, Device ID and Asset ID through contracts; it does not copy those aggregate roots.

### Meeting

Owns:

- Meeting,
- audio/recording reference,
- transcript,
- summary,
- action items,
- processing lifecycle.

Meeting processing may run as a separate service while exposing the same API/event/audit conventions.

### Reports

Owns:

- saved report definition,
- report query metadata,
- export job metadata.

Reports should read module-owned data through query contracts/read models, not by reaching into another module's tables directly.

## 7. External engines and adapters

### Keycloak

Keycloak responsibilities:

- authentication,
- SSO,
- token issuance,
- identity-provider federation where required.

INNO.One responsibilities:

- user profile,
- organization membership,
- position,
- role assignment,
- permission evaluation,
- resource scopes,
- application access.

Do not encode all business authorization into Keycloak roles.

### MeshCentral

Required boundary:

```text
Web / Agent
    │
    ▼
INNO.One Devices API
    │
    ▼
MeshCentral Adapter
    │
    ▼
MeshCentral
```

No normal Web module should call MeshCentral directly.

The adapter owns:

- node-ID mapping,
- vendor API translation,
- vendor error translation,
- vendor session lifecycle translation,
- vendor-specific credentials/configuration.

## 8. API boundary

Clients should see one INNO.One API namespace even if internal services differ.

Recommended external route family:

```text
/api/platform/...
/api/devices/...
/api/assets/...
/api/helpdesk/...
/api/meeting/...
/api/reports/...
/api/admin/...
```

Reverse proxy/gateway routing may distribute these routes internally later without changing client contracts.

The exact endpoint inventory is now defined by Step 11 in `INNO-One-API-Contract.md`, `inno-api-contract.json` and `openapi-inno-one-v1.json`.

## 9. Event boundary

Modules communicate cross-domain state changes through contracts, not direct business-logic calls.

Initial implementation may use:

- in-process domain events for same-process reactions,
- transactional outbox for durable integration events,
- an external broker only when operational need justifies it.

Step 12 now defines the Event & Audit boundary in `INNO-One-Event-Audit-Contract.md` and `inno-event-audit-contract.json`.

Frozen implementation rules:

- same-module Domain Events may remain in-process,
- cross-module/service Integration Events use the canonical envelope,
- database-backed Integration Events use a transactional outbox,
- delivery is at-least-once and consumers deduplicate by `eventId`,
- there is no global ordering guarantee,
- correlation/causation/trace IDs propagate across API → event → audit,
- Audit is append-only and is not the business event bus,
- generic event/audit payloads exclude secrets and raw content.

Existing prototype event names are preserved in the Step 12 v1 event catalog, including:

- device.online,
- device.offline,
- remote.started,
- ticket.created,
- ticket.assigned,
- ticket.resolved,
- meeting.created,
- transcript.completed,
- summary.completed,
- ownership.changed.

## 10. Persistence boundary

Initial deployment may use one physical relational database, but module ownership must remain explicit.

Recommended rule:

- separate schema or clearly separated table namespace per module,
- no module writes another module's tables,
- cross-module references use stable IDs,
- reports/search use read models or module APIs,
- migrations are owned per module.

The detailed entity/schema model is now frozen by Step 13 in `INNO-One-Data-Ownership-Database-Contract.md` and `inno-data-model-contract.json`.

## 11. Shared packages

```text
packages/
├── ui/
│   ├── INNOButton
│   ├── INNOForm
│   ├── INNOTable
│   ├── INNOTree
│   ├── INNOTreeGrid
│   ├── INNOOrgChart
│   ├── INNOWorkflowCanvas
│   └── INNOState
├── contracts/
│   ├── api/
│   ├── permissions/
│   ├── events/
│   ├── errors/
│   └── audit/
├── auth/
└── shared/
```

Third-party UI libraries stay behind INNO components.

Current production direction:

- React Arborist → INNOTree,
- TanStack Table → INNOTreeGrid,
- d3-org-chart → INNOOrgChart,
- React Flow + ELK.js → INNOWorkflowCanvas.

## 12. Dependency rules

Allowed:

```text
Web module → API contract
Module Application → own Domain
Module Infrastructure → own Domain/Application contracts
Module → integration event contract
Integration Adapter → external engine
```

Disallowed:

```text
Web Devices → MeshCentral directly
Helpdesk → Devices database tables
Assets → Platform user tables
Meeting → Helpdesk internal classes
Module A → Module B Infrastructure project
External vendor DTO → leak into UI/API contract
```

## 13. Deployment shape — initial

A practical first deployment:

```text
Reverse Proxy
├── Web Portal
├── Platform API (.NET modular monolith)
├── Meeting Processing/API
├── Keycloak
├── MeshCentral
├── Database
└── Observability stack
```

Endpoint Agent and Android Mobile are separately distributed clients.

## 14. Project/repository target shape

```text
INNO.One/
├── apps/
│   ├── web-portal/
│   ├── endpoint-agent/
│   └── assets-mobile/
├── services/
│   ├── platform-api/
│   └── meeting-service/
├── packages/
│   ├── ui/
│   ├── contracts/
│   ├── auth/
│   └── shared/
├── infrastructure/
│   ├── docker/
│   ├── reverse-proxy/
│   ├── database/
│   ├── monitoring/
│   └── deployment/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── e2e/
└── docs/
    ├── architecture/
    ├── api/
    ├── events/
    ├── permissions/
    └── ux-ui/
```

This is a target production structure, not a request to rewrite the current frozen HTML prototype in place.

## 15. Decisions frozen by Step 9

1. Web Portal is one React application initially.
2. Web modules are route/code boundaries, not independent micro-frontends.
3. Core server starts as a .NET modular monolith.
4. Meeting processing may be separately deployed.
5. Keycloak is authentication/SSO, not the full business authorization model.
6. MeshCentral is behind a Devices adapter.
7. Platform owns canonical User/Organization/RBAC/App Registry/Audit concepts.
8. Modules own their domain data and do not write each other's persistence.
9. Cross-module interaction uses API/event contracts.
10. Shared UI and contracts are packages, not copied source.
11. Microservices are an evolution option, not the starting assumption.

## 16. Deferred decisions

Not frozen yet:

- .NET 10 production patch/update cadence (runtime/project skeleton is now frozen by Step 14),
- Web dependency update cadence (React/Vite/TypeScript checkpoint is now frozen by Step 14),
- exact PostgreSQL major release / managed provider (engine itself is frozen to PostgreSQL by Step 13),
- broker technology,
- caching technology,
- observability vendor,
- deployment target/Kubernetes requirement,
- long-term Meeting runtime divergence, if .NET 10 no longer fits the processing workload,
- exact Agent implementation language.

These should be selected only when Step 11–15 provide enough implementation context.

## 17. Step 11 API Contract checkpoint — 2026-09-26

Step 11 now freezes the public planning API boundary at **API Contract 0.2.0**.

- Base path: `/api/v1`.
- Catalog: **172 operations / 137 unique paths**.
- Frozen Web coverage: **93 / 93 routes**.
- Runtime Agent/Mobile coverage: **3 / 3 surfaces** requiring APIs.
- OpenAPI planning skeleton: `openapi-inno-one-v1.json` with **172 operations**.
- Normal user authentication: Keycloak Bearer JWT.
- Error contract: `application/problem+json`.
- Mutable config concurrency: ETag + If-Match.
- High-impact command retry safety: Idempotency-Key.
- Long-running work: 202 + operation resource.
- Agent-only endpoints are explicitly marked with provisional device-bound auth mode rather than normal end-user permissions.
- API mapping refined the implementation permission catalog to **43 existing + 33 reserved** permissions.

Source of truth:
- `INNO-One-API-Contract.md`
- `inno-api-contract.json`
- `openapi-inno-one-v1.json`
- `api-contract-audit.py`

No backend feature implementation was started by Step 11.

## 18. Step 12 Event & Audit Contract checkpoint — 2026-09-26

Implementation planning now advances to **Contract 0.3.0**.

Step 12 freezes:
- 37 integration-event types already declared by the prototype registry: **34 active + 3 future Workflow**.
- Canonical event envelope with event/correlation/causation/trace identity.
- Transactional outbox for database-backed cross-module/service facts.
- At-least-once delivery with consumer inbox/dedupe by `eventId`.
- No global ordering guarantee; best-effort per-subject partition ordering only.
- Exponential-backoff retry with dead-letter handling; never silently discard.
- Append-only audit record contract with **62 canonical audit actions**.
- Audit access permission remains `admin.audit.view` while the Audit UI stays unavailable/future.
- Secret/raw-content minimization for tickets, remote chat/files, meeting content and QR tokens.
- Four semantic retention classes; concrete durations remain governance decisions.

Source of truth:
- `INNO-One-Event-Audit-Contract.md`
- `inno-event-audit-contract.json`
- `event-audit-contract-audit.py`

Historical checkpoint: no backend feature code was started by Step 12. Step 13 Data Ownership / Database Model is now complete, including PostgreSQL, schema ownership, outbox/inbox/audit storage and migration boundaries.

## 19. Step 13 Data Ownership / Database Model checkpoint — 2026-09-26

Implementation planning now advances to **Contract 0.4.0**.

Step 13 freezes:
- PostgreSQL as the production relational database engine.
- `inno_core` as the modular-monolith database with 8 owned schemas.
- `inno_meeting` as the separately owned Meeting database.
- Keycloak and MeshCentral persistence remain outside INNO.One business schemas.
- Core planning catalog: **83 tables**; Meeting: **9 tables**; total: **92 logical tables**.
- Database PKs use UUID while public API IDs remain opaque.
- Cross-module and cross-database references use stable IDs without DB foreign keys.
- Mutable entities use explicit bigint version for ETag/If-Match concurrency.
- No universal soft-delete; domain lifecycle/status/archival rules apply.
- JSONB is bounded and cannot replace canonical relational ownership.
- Helpdesk attachments, Meeting media/files and Report exports use object storage with DB metadata only.
- Core outbox/inbox/operation state lives in `inno_core.integration`; core audit history lives in `inno_core.audit`.
- Each module owns its own DbContext/migrations; a migration may not alter another module's tables.
- Reports/Search use query contracts/read models rather than direct cross-module business-table reads.
- v1 does not introduce generic SaaS `tenant_id`; Organization Unit is not a tenant boundary.

Source of truth:
- `INNO-One-Data-Ownership-Database-Contract.md`
- `inno-data-model-contract.json`
- `data-model-contract-audit.py`

No backend feature code was started by Step 13. Next: **Step 14 Production Project Skeleton**.

## 20. Step 14 Production Project Skeleton checkpoint — 2026-09-26

Implementation planning now advances to **Contract 0.5.0**.

The buildable implementation root is `production/` and contains:
- React 19.2 + TypeScript 5.9 + Vite 6.4 Web Portal shell.
- pnpm workspace packages: `@inno/ui`, `@inno/contracts`, `@inno/auth`, `@inno/shared`.
- .NET 10 solution with **12 projects**.
- Platform API modular-monolith composition root plus Platform / Devices / Assets / Helpdesk / Reports modules.
- Dedicated Keycloak and MeshCentral adapter projects.
- Separate .NET 10 Meeting service skeleton.
- **8 DbContext boundaries** aligned with Step 13 schema ownership.
- Per-module EF migration folders and local `dotnet-ef` tool manifest.
- Local Docker bootstrap for PostgreSQL + Keycloak.
- Reverse-proxy, monitoring and deployment boundaries.

Important scope rule:
- the frozen HTML prototype remains the UX/UI source of truth,
- no Step 11 feature endpoint is falsely marked implemented,
- Agent implementation language remains deferred,
- Assets Mobile retains Expo direction but its runtime scaffold waits for the mobile vertical slice.

Source of truth:
- `INNO-One-Production-Project-Skeleton.md`
- `production/production-skeleton.json`
- `production-skeleton-audit.py`

Next: **Step 15 First Vertical Slice**.
