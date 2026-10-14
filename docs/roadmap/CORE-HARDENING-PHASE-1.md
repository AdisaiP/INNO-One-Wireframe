# CORE Hardening Phase 1

Status: Planned
Branch: `feat/core-hardening-phase-1`
Target: move the shared INNO.One CORE from roughly 78% readiness to 88-90% readiness before full module expansion.

## Goal

Harden the platform capabilities that every module depends on:

- authentication and application-user gating
- role / permission / access-scope enforcement
- module availability and registry gating
- auditability and operational diagnostics
- repeatable deployment and acceptance
- enforceable module boundaries

Do not expand module-specific product scope in this phase unless it is required to prove a CORE contract.

## Phase 0 - Development baseline

### CORE-001 Reproducible toolchain - COMPLETE (2026-10-14)
- Use the repository-pinned Node/pnpm versions.
- Make pnpm available through Corepack on developer machines.
- Install the .NET SDK expected by `production/global.json` (10.0.103) or deliberately revise the repository SDK policy in a separate reviewed change.
- Make `pnpm check` run from a clean clone without machine-specific workarounds.

Exit criteria:
- clean clone can install dependencies
- TypeScript packages build
- Web Portal typecheck/build passes
- .NET solution builds

Evidence: clean dependency reinstall followed by corepack pnpm run check passed on Windows with Node 22.15.1, pnpm 10.17.0 and .NET SDK 10.0.201; .NET build completed with 0 warnings and 0 errors.

### CORE-002 CI baseline - IMPLEMENTED (branch protection pending)
Add CI for:
- package build/typecheck
- Web Portal production build
- .NET build
- unit/integration/contract tests as they are added
- `git diff --check` / repository hygiene checks where appropriate

Exit criteria:
- pull requests cannot merge when CORE build/test checks fail

## Phase 1 - Authorization integration tests

### CORE-010 Test foundation - COMPLETE (2026-10-14)
Create real test projects under `production/tests/integration`.

Preferred coverage:
- PostgreSQL-backed persistence integration
- Platform API authorization harness
- deterministic test identities / claims
- repeatable database reset or isolated test database

### CORE-011 Application-user gating - COMPLETE (2026-10-14)
Prove:
- active application user can enter
- pending user is blocked from protected application paths
- disabled/inactive user is blocked
- unknown identity follows the intended access-request/provisioning flow

### CORE-012 RBAC + access scope - COMPLETE (2026-10-14)
Prove:
- permission allow
- missing permission -> 403
- role change changes effective permissions
- all-resource scope
- organization scope
- location scope
- device-group scope
- out-of-scope resource -> denied
- include-children behavior

### CORE-013 Module availability - COMPLETE (2026-10-14)
Prove:
- enabled module + permission -> available
- disabled module -> unavailable even when the user has permission
- missing entry permission -> unavailable
- dependency/manifest rules are honored

Exit criteria for Phase 1:
- critical authorization decisions are automated and reproducible
- no authorization rule depends only on manual browser verification

## Phase 2 - Golden-path E2E

### CORE-020 E2E framework - COMPLETE (2026-10-14)
Create the first real suite under `production/tests/e2e`.

Recommended first surface: Web Portal.

### CORE-021 Sign-in to workspace - COMPLETE (2026-10-14)
Golden path:
1. Keycloak sign-in
2. application-user validation
3. workspace loads
4. permitted apps are visible
5. user can open an allowed module

### CORE-022 Admin access assignment - COMPLETE (API-host golden path, 2026-10-14)
Golden path:
1. admin opens a user/access assignment
2. assigns role and resource scope
3. target user signs in
4. allowed route succeeds
5. out-of-scope route is denied

### CORE-023 Audit golden path - COMPLETE (API-host golden path, 2026-10-14)
Golden path:
1. perform an auditable privileged action
2. audit record is written
3. Admin Audit can retrieve it
4. correlation/trace identifiers can be followed

Exit criteria for Phase 2:
- login -> workspace -> module is automated
- one admin authorization-change flow is automated
- one auditable action is automated

Evidence: Playwright auth-workspace.spec.ts covers Keycloak sign-in -> Workspace -> Apps -> Devices. AdminAccessAuditGoldenPathTests exercises assignment update -> effective access -> searchable audit with correlation/trace through the real Platform API test host and PostgreSQL. CORE E2E and CORE CI were green at commit d24f68f.

## Phase 3 - Observability baseline

### CORE-030 Correlation and trace propagation - COMPLETE (2026-10-14)
Standardize:
- correlation ID
- trace ID
- request logging context
- propagation through internal adapters where applicable

### CORE-031 Structured logging - COMPLETE (2026-10-14)
Minimum useful fields:
- timestamp
- level
- service/module
- route/operation
- traceId
- correlationId
- user/application-user ID when safe
- duration
- result/status

Do not log secrets, access tokens, passwords, or sensitive request payloads.

### CORE-032 Health model - COMPLETE (2026-10-14)
Define and test:
- liveness
- readiness
- database health
- Keycloak dependency health
- MeshCentral dependency health where the Platform surface depends on it
- partial/degraded dependency state

Remain OpenTelemetry-compatible without forcing a monitoring vendor yet.

Exit criteria for Phase 3:
- an operator can determine where a failed request failed
- unhealthy dependencies are visible through a consistent health model

Evidence: RequestContextMiddleware standardizes correlation/trace logging and response headers. ReadinessIntegrationTests covers ready, missing required dependency, disconnected required dependency, and disconnected enabled optional dependency; 4/4 passed locally on 2026-10-14.

## Phase 4 - Deployment hardening

### CORE-040 Environment contract - COMPLETE (2026-10-14)
Document and validate:
- local/dev
- test/UAT
- production
- required environment variables
- secrets
- public URLs
- CORS/origin rules
- Keycloak configuration
- MeshCentral configuration
- storage/database configuration

### CORE-041 Database migration and rollback - COMPLETE (2026-10-14)
Define:
- migration execution order
- backup before destructive migration
- rollback expectations
- fresh-environment bootstrap
- upgrade from the current legacy deployment when required

### CORE-042 Acceptance checklist - COMPLETE (2026-10-14)
Automate or document a deterministic production acceptance flow:
- health endpoints
- Keycloak discovery/sign-in
- Platform API
- Web Portal
- core permission checks
- audit write/read
- integration health

Exit criteria for Phase 4:
- a new environment can be deployed from documented inputs
- deployment acceptance does not depend on tribal knowledge

## Phase 5 - Module contract enforcement

### CORE-050 Architecture tests - COMPLETE (2026-10-14)
Enforce:
- no cross-module project references unless explicitly permitted by Platform contracts
- no cross-module database foreign keys
- module persistence ownership
- shared contracts live in approved shared/contract packages
- module manifests remain valid

### CORE-051 Module starter/checklist - COMPLETE (2026-10-14)
Document the canonical module shape and minimum requirements:
- API
- Application
- Domain
- Infrastructure/Persistence where needed
- Contracts/events
- permission IDs
- navigation/manifest registration
- audit rules
- tests
- health/dependency declarations

Exit criteria for Phase 5:
- a new module can be added without inventing its own architecture
- invalid module coupling fails an automated check

## CORE exit gate

CORE is ready for full module expansion when all of the following are true:

- clean-clone build is green
- CI is green
- critical auth/RBAC/scope decisions have integration tests
- login -> workspace -> module E2E is green
- admin role/scope assignment E2E is green
- audit golden path is green
- structured logging + correlation/trace baseline exists
- health/readiness model is defined and exercised
- deployment/acceptance path is reproducible
- module boundary rules are automated

Target readiness at this point: 88-90%.

## Module sequence after the gate

Recommended order:

1. Devices - first production module and strongest dependency for remote operations.
2. Assets - consumes device/inventory context but owns its asset data.
3. Helpdesk - integrates with users/devices/assets through contracts, not direct persistence coupling.
4. Meeting - can progress in parallel after the CORE gate because its service boundary is more independent.
5. Reports - expand after upstream modules expose stable reporting contracts/events.

## First implementation batch

Start with these tasks only:

1. CORE-001 - make the pinned toolchain reproducible on the Windows dev machine.
2. CORE-002 - add baseline CI.
3. CORE-010 - create the integration-test foundation.
4. CORE-011 - implement application-user gating tests.
5. CORE-012 - implement RBAC/access-scope integration tests.

Do not start Devices feature expansion until this first batch is green.
