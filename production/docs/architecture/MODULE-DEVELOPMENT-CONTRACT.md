# INNO.One Module Development Contract

This contract defines how a new or expanded product module joins the INNO.One Platform CORE without creating hidden coupling.

## Core rule

Modules own their domain, persistence, permissions, events, audit behavior, and navigation metadata.

Modules may depend on Platform capabilities, shared contracts, and shared kernel primitives. They must not depend directly on another module project, namespace, or database schema.

Cross-module collaboration happens through approved contracts, events, identifiers, readers/providers, and Platform capabilities.

## Canonical backend shape

A module lives under:

~~~text
services/platform-api/src/Modules/<Module>/
├── Api/
├── Application/
├── Domain/
├── Infrastructure/
├── Persistence/
├── <Module>Module.cs
└── INNO.One.Modules.<Module>.csproj
~~~

Not every module requires every folder on day one. Add only layers that have a real responsibility.

### Api

Owns endpoint mapping, HTTP translation, status codes, permission entry points, and ETag/concurrency HTTP behavior when applicable.

Do not place reusable or non-trivial persistence logic directly in endpoint files.

### Application

Owns use-case orchestration, module readers/providers, access-aware queries, application validation, and event/audit orchestration.

### Domain

Owns module entities, value objects, invariants, and domain state transitions.

The domain must not import another product module namespace.

### Infrastructure

Owns external adapters, background workers, and implementation details behind contracts.

External systems should expose health/configuration state through the shared integration-health contract when operationally relevant.

### Persistence

Owns the module DbContext, EF mappings, migrations, and development seed for module-owned data when explicitly allowed.

## Project-reference boundary

A product module project may reference:

- INNO.One.Contracts
- INNO.One.SharedKernel

A module must not add a ProjectReference to another INNO.One.Modules.* project.

If a module needs information owned elsewhere:
1. prefer a shared contract/reader/provider,
2. or consume an event/read model,
3. or expose a Platform capability,
4. never bypass the boundary with a direct project reference.

The automated architecture contract test enforces this rule.

## Namespace boundary

A module uses the namespace INNO.One.Modules.<Module>.*.

Source inside one product module must not import INNO.One.Modules.<OtherModule>.

Shared abstractions that multiple modules need belong in an approved shared project, not in one module that others import.

## Database ownership

Each persistent module owns one PostgreSQL schema matching its module identity.

Current examples:

- Platform -> platform
- Devices -> devices
- Assets -> assets
- Helpdesk -> helpdesk
- Reports -> reports
- Workflows -> workflows

Rules:

- migrations create or alter only tables in the module-owned schema,
- database foreign keys must not cross module schemas,
- another module's table is not a shared database API,
- store stable external/module identifiers when a relationship must cross a boundary,
- obtain current cross-module data through contracts/read models/events.

Architecture tests scan migration schema references to prevent accidental cross-module database coupling.

## Shared contracts

Put a contract in INNO.One.Contracts only when at least one boundary needs it.

Typical shared contracts include authorization/access evaluation, audit, integrations/health, operations, directory/readers, stable opaque identifiers, and module-facing provider interfaces.

Do not move internal domain entities into Contracts just to avoid designing a proper boundary.

## Module manifest

User-facing modules register in module-manifests.json.

Minimum fields:
- stable id
- display name
- route
- surface
- launcher visibility
- entryPermission
- dependencies
- permissions
- navigation
- events
- capabilities

Rules:
- module IDs are unique,
- entryPermission must appear in the declared permission list,
- navigation permissions must be declared,
- dependency IDs must exist or be platform,
- dependencies must be acyclic,
- a module cannot depend on itself.

Internal implementation modules do not need a launcher manifest unless they are intended to be user-facing applications.

## Permission contract

Permission IDs use the owning module namespace, for example:

~~~text
devices.view
devices.manage
assets.view
helpdesk.ticket.view
reports.view
~~~

Every protected API/use case must evaluate a real permission rather than infer authorization from page visibility.

When a permission grants resource-scoped access, the module must honor the effective Platform scope returned by the access contract.

## Module availability

For user-facing modules:
- installed + enabled + entry permission = available,
- disabled modules remain unavailable even when a role contains the permission,
- launcher/navigation derives from the module registry/manifest contract,
- APIs still enforce authorization independently of UI visibility.

## Audit contract

Privileged or meaningful state changes must write an audit event with enough information to answer who acted, what action occurred, which module owned it, target type/id, result, correlation ID, and trace ID.

Do not log secrets, tokens, passwords, or sensitive payloads into audit metadata.

## Event contract

Publish events when another module legitimately needs to react without direct coupling.

Before adding an event:
- define the owner,
- define a stable event name,
- keep payload minimal and versionable,
- avoid exposing persistence entities as event payloads,
- document delivery/idempotency expectations when side effects matter.

## Integration health

If a module depends on an external system:
- configuration status must be visible,
- enabled dependencies expose an IIntegrationHealthProvider,
- readiness behavior must be explicit,
- disabled optional integrations must not make the whole Platform unhealthy,
- secrets must never appear in health responses.

## Tests required for a module change

Choose the smallest sufficient set, but every production module must have coverage for its important boundaries.

### Unit

Use for pure business rules, formatting/mapping, and deterministic state transitions.

### Integration

Use for DbContext behavior, authorization + scope, API host behavior, audit/events, and persistence concurrency.

### Contract

Use for manifest validity, architecture boundaries, and deployment/configuration invariants.

### E2E

Use for critical user journeys spanning browser/auth/API and high-value golden paths that would otherwise require manual acceptance.

## Definition of Done for a new module

Copy this checklist into the module task or PR.

- [ ] Module owner and primary job are defined.
- [ ] Module ID and route are stable.
- [ ] Backend project follows the canonical module namespace.
- [ ] No ProjectReference to another product module exists.
- [ ] No import of another product module namespace exists.
- [ ] Persistence schema is owned by this module.
- [ ] No cross-module database foreign key exists.
- [ ] Shared data needs use contracts/events/read models.
- [ ] Entry permission is defined.
- [ ] Resource-scope behavior is defined where needed.
- [ ] Manifest dependencies are declared.
- [ ] Navigation permissions are declared.
- [ ] Audit actions are identified and implemented.
- [ ] Events are documented when cross-module reactions are required.
- [ ] External integrations expose health where applicable.
- [ ] Unit/integration tests cover important business and authorization behavior.
- [ ] Contract tests pass.
- [ ] Critical browser journey has E2E coverage when appropriate.
- [ ] corepack pnpm run check passes.
- [ ] CORE CI is green.

## Review rule

If a module implementation requires breaking one of these boundaries, do not silently bypass the contract.

Change the shared architecture deliberately:
1. document the new capability,
2. update contracts,
3. add or adjust architecture tests,
4. review the impact on existing modules,
5. only then implement the module dependency.
