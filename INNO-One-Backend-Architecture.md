# INNO.One — Backend Architecture

**Status:** Planning contract  
**Date:** 2026-09-25  
**UI baseline:** UI Contract 1.12.0 / 83 Web Portal routes  
**Implementation:** Not started

## 1. Goal

Build a backend that supports the frozen INNO.One product architecture without turning every UI page into its own service.

The backend must preserve these existing product rules:

- Workspace, Apps and Admin Center are platform concerns.
- Devices, Assets, Helpdesk, Meeting and Reports own their business logic.
- Keycloak is an identity provider, not the product UI.
- MeshCentral is a Devices engine/provider, not the product UI.
- Web, Endpoint Agent and Android Mobile are separate surfaces sharing contracts, not one shell.
- Cross-module collaboration happens through stable contracts, IDs, read models and events.
- New modules must be installable/enabled through a module contract rather than hard-coded platform navigation.

## 2. Recommended initial architecture

Use a **Modular Monolith** for the INNO.One application backend, plus explicit provider adapters and a worker process.

```
                    ┌──────────────────────────────┐
                    │       INNO.One Web UI        │
                    │       React / Web App        │
                    └──────────────┬───────────────┘
                                   │ HTTPS
                                   ▼
                    ┌──────────────────────────────┐
                    │ INNO.One Web/BFF + API Host  │
                    │       ASP.NET Core 9         │
                    ├──────────────────────────────┤
                    │ Platform Core                │
                    │ Devices                     │
                    │ Assets                      │
                    │ Helpdesk                    │
                    │ Meeting Orchestration       │
                    │ Reports                     │
                    └──────┬─────────┬────────────┘
                           │         │
                  commands/queries  outbox
                           │         │
                           ▼         ▼
                    ┌──────────────────────────────┐
                    │       PostgreSQL            │
                    │ schema per module           │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      INNO.One Worker         │
                    │ async jobs / event dispatch  │
                    └──────────────┬───────────────┘
                                   │
           ┌───────────────────────┼─────────────────────────┐
           ▼                       ▼                         ▼
      Keycloak                MeshCentral             Mail / Storage /
   Identity Provider        Devices Engine            AI / STT providers
```

This does **not** mean every external engine must be rewritten in .NET.

The .NET host owns the platform-facing contract. Providers remain behind adapters.

## 3. Why not microservices first

Do not start with separate deployable services for every module.

That would introduce:
- distributed transactions,
- duplicated authentication/session concerns,
- event-ordering problems,
- multiple deployment pipelines,
- harder local development,
- premature versioning between modules,
- operational overhead before domain boundaries are proven.

The modular monolith still enforces boundaries in code and data so a module can be extracted later.

Extraction is justified only when one or more of these become true:
- independent scaling is required,
- a module needs an incompatible runtime,
- a separate team owns deployment,
- uptime/release cadence differs materially,
- provider orchestration becomes operationally isolated.

## 4. Runtime components

### 4.1 INNO.One Web / BFF

Preferred browser security model:

```
Browser
  ↓ OIDC Authorization Code + PKCE
INNO.One Web/BFF
  ↓ server-side token/session handling
Keycloak
```

The browser should use an HttpOnly secure session cookie for INNO.One where possible instead of storing long-lived access tokens in JavaScript.

Responsibilities:
- sign-in callback,
- session cookie,
- anti-forgery protection,
- current-user bootstrap,
- API proxy/BFF endpoints if needed,
- correlation ID propagation.

### 4.2 INNO.One API Host

One ASP.NET Core host initially.

Responsibilities:
- HTTP APIs,
- permission enforcement,
- scope evaluation,
- module application services,
- provider adapters,
- transaction boundaries,
- writing outbox messages.

### 4.3 INNO.One Worker

Separate process from the same codebase/deployment family.

Responsibilities:
- outbox dispatch,
- notification delivery,
- deployment job orchestration,
- maintenance/restart jobs,
- SLA timers/escalations,
- meeting processing callbacks/jobs,
- report export generation,
- retryable provider work.

The worker must not bypass module application services to mutate another module's tables directly.
## 5. Module boundaries

### 5.1 Platform Core

Owns:
- identity mapping,
- user profile,
- organizations / organizational units,
- groups,
- roles,
- permissions,
- role assignments,
- resource access scopes,
- module registry,
- user app preferences / pinned apps,
- platform notifications,
- audit log,
- provider configuration metadata.

Must not own:
- Devices business entities,
- ticket state machine,
- asset lifecycle,
- meeting transcript/summary,
- report-domain business rules.

### 5.2 Devices

Owns:
- INNO.One Device identity,
- provider mapping to MeshCentral node IDs,
- device groups,
- inventory query definitions,
- remote sessions,
- consent policy/rules/history,
- alerts/rules/channels,
- deployment jobs,
- agent rollout/update state,
- software maintenance,
- restart operations,
- endpoint policies.

Provider rule:

```
INNO.One DeviceId
      │
      ├─ provider = meshcentral
      └─ providerNodeId = <opaque external id>
```

No UI or cross-module code should depend on a MeshCentral node ID as the canonical device identifier.

### 5.3 Assets

Owns:
- asset register,
- ownership/assignment,
- ownership submissions,
- custom fields,
- QR tokens,
- software license inventory,
- contracts/warranty.

Assets may reference a Device by INNO.One `DeviceId` but must not read/write Devices tables directly.

### 5.4 Helpdesk

Owns:
- tickets,
- conversation/activity,
- attachments metadata,
- assignment,
- priority/status,
- categories,
- requester groups,
- SLA policy / ticket SLA state,
- business calendars,
- knowledge base,
- notification rules/templates/delivery history,
- Helpdesk reports/read models.

A Ticket may carry:
- `RelatedDeviceId`,
- `RelatedAssetId`.

Those are module references, not ownership transfers.

### 5.5 Meeting

Owns:
- meeting metadata,
- capture/upload records,
- recording metadata,
- transcript state/content references,
- summary,
- action items,
- processing status.

Audio/video blobs should live in object storage, not PostgreSQL.

AI/STT providers are adapters.

### 5.6 Reports

Owns:
- saved report definitions,
- columns,
- filters,
- grouping/sorting,
- report runs,
- export jobs.

Reports should read from:
- module query contracts,
- reporting/read-model tables,
- replicated projections.

Reports must not become a place where arbitrary SQL reaches across every module schema.

## 6. Source-code structure

Recommended solution layout:

```
INNO.One.sln
src/
  InnoOne.Web/
  InnoOne.Api/
  InnoOne.Worker/

  BuildingBlocks/
    Abstractions/
    Authentication/
    Authorization/
    Events/
    Persistence/
    Observability/
    ProblemDetails/

  Platform/
    Identity/
    Organizations/
    Authorization/
    Modules/
    Notifications/
    Audit/

  Modules/
    Devices/
      Domain/
      Application/
      Infrastructure/
      Contracts/
    Assets/
      Domain/
      Application/
      Infrastructure/
      Contracts/
    Helpdesk/
      Domain/
      Application/
      Infrastructure/
      Contracts/
    Meeting/
      Domain/
      Application/
      Infrastructure/
      Contracts/
    Reports/
      Domain/
      Application/
      Infrastructure/
      Contracts/

  Integrations/
    Keycloak/
    MeshCentral/
    Email/
    ObjectStorage/
    MeetingAI/

tests/
  ArchitectureTests/
  ContractTests/
  Modules/
```

Do not create one shared `Common.BusinessLogic` project containing domain logic from every module.

Shared code is limited to true platform/building-block concerns.

## 7. Module dependency rules

Allowed:

```
Module.Application → its Domain
Module.Infrastructure → its Application / Domain
API Host → module Contracts / Application registration
Module A → Module B.Contracts
Module A → event contract published by Module B
```

Not allowed:

```
Devices → Helpdesk.Infrastructure
Helpdesk → Assets DbContext
Reports → arbitrary cross-schema DbSet
Any module → MeshCentral SDK directly except Devices adapter
Any module → Keycloak admin API directly except Platform Identity adapter
```

Cross-module commands should be rare.

Prefer:
- query contract for immediate lookup,
- event for eventual reaction,
- stable ID reference for navigation/context.

## 8. External integration boundaries

### Keycloak

Keycloak owns:
- authentication credentials,
- MFA / federation if enabled,
- identity-provider session,
- OIDC token issuance.

INNO.One owns:
- application user profile,
- organization membership,
- application roles,
- permissions,
- resource scopes,
- module access.

Map Keycloak subject `sub` to `core.users.external_subject`.

Do not use Keycloak groups/roles as the only source of fine-grained INNO.One resource scope.

### MeshCentral

MeshCentral owns engine-level:
- agent connection,
- remote-control transport,
- provider-side node/session mechanics.

INNO.One owns:
- canonical Device,
- user-visible device group semantics,
- RBAC/scope decision,
- consent policy,
- audit,
- alert/deployment/maintenance product workflows.

Every provider call must be made through `IDeviceProvider` / `IRemoteProvider` style contracts.

### Email

Helpdesk/Platform emits delivery requests to a notification abstraction.

SMTP/provider configuration is infrastructure.

Business rules must not call SMTP directly.

### Object Storage

Use object storage for:
- Helpdesk attachments,
- meeting audio,
- generated report files,
- optional deployment payloads.

Database stores metadata, ownership, hashes and object keys.

### Meeting AI / STT

The Meeting module owns processing state.

Providers return results through an adapter/callback contract.

Provider-specific job IDs remain infrastructure metadata.
## 9. Authorization flow

Every protected request follows:

```
Authenticated user
   ↓
Module enabled?
   ↓
Permission granted?
   ↓
Resource scope permits target?
   ↓
Business invariant permits action?
   ↓
Execute command/query
   ↓
Audit meaningful action
```

Do not combine permission and business-state checks into one vague "CanEdit" rule.

Examples:

Remote control:
- module `devices` enabled,
- permission `devices.remote`,
- Device inside user's effective access scope,
- Device state permits remote session,
- consent policy evaluated,
- audit session start/end.

Ticket assignment:
- permission `helpdesk.ticket.assign`,
- Ticket visible inside effective Helpdesk scope,
- assignee valid for organization/team,
- status transition allowed.

## 10. API style

Base path:

`/api/v1`

Use:
- resource-oriented GET/POST/PATCH/DELETE where natural,
- explicit action endpoints for domain commands,
- RFC Problem Details for errors,
- idempotency keys for retryable create/execute commands,
- optimistic concurrency for editable resources.

Examples:

```
GET  /api/v1/devices
GET  /api/v1/devices/{deviceId}
POST /api/v1/devices/{deviceId}/remote-sessions
POST /api/v1/tickets
POST /api/v1/tickets/{ticketId}/assign
POST /api/v1/deployment-jobs
POST /api/v1/meetings/{meetingId}/process
```

Do not expose provider-shaped endpoints such as:

`/api/meshcentral/nodes/{nodeid}`

to the product UI.

## 11. Event architecture

Use an in-process domain-event mechanism inside a transaction and a transactional **Outbox** for integration events.

```
Domain mutation
   ↓
DB transaction
   ├─ business rows
   └─ outbox message
          ↓
       Worker
          ↓
 Event subscribers / provider jobs / notifications
```

Delivery contract:
- at-least-once,
- consumers idempotent,
- correlation and causation IDs,
- event version,
- tenant/organization context.

Do not depend on exactly-once delivery.

## 12. Observability

Every inbound request and background job should carry:
- trace/correlation ID,
- authenticated actor/user ID where applicable,
- organization ID,
- module,
- operation name.

Required telemetry:
- structured logs,
- request latency,
- provider latency/error rate,
- worker job duration/retry count,
- outbox backlog,
- event-consumer failures,
- MeshCentral adapter health,
- Keycloak connectivity,
- email/storage/AI provider health.

Business audit is not the same as technical logs.

Audit records answer:
- who,
- did what,
- to which business resource,
- when,
- from which module,
- with which relevant metadata.

## 13. Transaction rules

A module command may have one local database transaction.

Do not hold a database transaction open while waiting for:
- MeshCentral,
- email SMTP,
- AI processing,
- object storage upload,
- long-running remote action.

Pattern:

1. validate business state,
2. persist command/job state,
3. commit,
4. dispatch provider work asynchronously,
5. update result state,
6. publish outcome event.

For short provider lookups, synchronous queries are acceptable if they do not mutate cross-module state.

## 14. Background execution

Model long-running operations as explicit jobs:
- DeploymentJob,
- AgentRollout,
- SoftwareMaintenanceJob,
- RestartJob,
- MeetingProcessingJob,
- ReportExportJob,
- NotificationDelivery.

Every job should have:
- status,
- requestedAt,
- startedAt,
- completedAt,
- requestedBy,
- retryCount,
- failureCode/message,
- provider reference if applicable.

UI polling can be used first.

Realtime push can be added for job status and alerts without changing the underlying job model.

## 15. Realtime strategy

Use realtime only where it improves an operational screen.

Candidates:
- device online/offline,
- remote session lifecycle,
- alert created/acknowledged,
- deployment progress,
- ticket assignment/status,
- meeting processing completion.

Recommended initial transport:
- SignalR from INNO.One API to Web.

Providers still communicate through adapters/events.

Do not expose MeshCentral WebSocket protocols directly to the portal UI unless a remote-control transport specifically requires it and is encapsulated by the Devices integration boundary.

## 16. Implementation phases

### Phase 0 — Contracts

This branch.

Deliverables:
- Domain Model,
- API Contract,
- Event Catalog,
- Permission Matrix,
- Database Plan.

No backend code.

### Phase 1 — Platform Core

Implement:
- Keycloak sign-in/session,
- user bootstrap,
- organizations,
- roles/permissions,
- access scopes,
- module registry,
- audit skeleton,
- current-user endpoint.

Acceptance slice:

```
Login
→ Workspace
→ App Launcher visibility
→ Route/action permission guard
→ Audit current-user/module changes
```

### Phase 2 — Devices

First real business vertical slice:

```
Devices List
→ Device Detail
→ Device Groups
→ MeshCentral provider mapping
```

Then:
- alerts,
- remote consent/session,
- deployment/maintenance.

### Phase 3 — Helpdesk

```
Tickets List
→ Create Ticket
→ Ticket Detail
→ Assignment / Status
→ SLA clock
```

Then categories, requester groups, notifications, knowledge.

### Phase 4 — Assets

```
Inventory
→ Asset Detail
→ Ownership
→ QR token
```

Then licenses/contracts.

### Phase 5 — Meeting

```
Create metadata
→ upload/capture record
→ processing job
→ transcript
→ summary/action items
```

### Phase 6 — Reports

Build read models after the source modules have stable queries/events.

## 17. Architecture decisions to keep open

These are intentionally not frozen yet:
- exact frontend stack for production,
- Hangfire vs another durable job scheduler,
- exact object-storage product,
- exact mail provider,
- exact Meeting AI/STT provider,
- whether Redis is needed,
- whether a module later becomes an independent service.

These choices must not change the domain/API/permission/event contracts unless a real requirement demands it.

## 18. Definition of Done before backend code

Backend implementation may begin only when:

- all 83 Web routes have a domain owner,
- route/action permissions are mapped,
- primary APIs are mapped,
- module event names are reviewed,
- cross-module references are explicit,
- database ownership is explicit,
- Keycloak and MeshCentral boundaries are accepted,
- first vertical slice is selected,
- planning audit passes.

Recommended first implementation slice:

**Platform Core authentication/RBAC + Devices List/Detail/Groups.**
