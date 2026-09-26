# INNO.One — Step 15 First Vertical Slice

**Date:** 2026-09-26
**Status:** Implemented
**Branch:** `implementation/step15-first-vertical-slice`
**Implementation Contract:** 0.6.0
**Production Skeleton:** 0.5.0
**Data Model Contract:** 0.4.0
**Event & Audit Contract:** 0.3.0
**API Contract:** 0.2.0
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0

## 1. Scope

Step 15 is the first feature implementation through the production skeleton.

The vertical slice is:

~~~text
Keycloak sign-in
      ↓
INNO.One User Profile
      ↓
Role + Permission + Resource Scope resolution
      ↓
Devices list
      ↓
Device detail
~~~

Implemented planning operations:

- `platform.me.get`
- `devices.list`
- `devices.get`

Production Web routes:

- `/profile`
- `/devices`
- `/devices/:deviceId`

The frozen HTML prototype remains unchanged and continues to define UX/UI behavior for screens not yet ported.

## 2. Authentication flow

Normal Web authentication is:

~~~text
React Web Portal
  → Keycloak Authorization Code
  → PKCE S256
  → access token
  → /api/v1/*
  → ASP.NET Core JwtBearer validation
~~~

The normal Web client is `inno-one-web`.

It is:

- public,
- Authorization Code enabled,
- Direct Access Grant disabled,
- PKCE S256 required.

The Platform API uses:

~~~text
Authority = Keycloak realm
Audience  = inno-one-api
MapInboundClaims = false
~~~

`MapInboundClaims = false` is intentional. The Keycloak `sub` claim stays named `sub` and is the identity key used by INNO.One.

## 3. Keycloak vs INNO.One authorization

Keycloak proves identity.

INNO.One still owns:

- User Profile,
- roles,
- permissions,
- access assignments,
- Organization scope,
- Location scope,
- Device Group scope,
- include-children behavior,
- module availability.

Mapping:

~~~text
JWT sub
  ↓
platform.user_profiles.keycloak_subject
  ↓
INNO.One User ID
  ↓
AccessEvaluator
~~~

The browser never decides authoritative resource access.

Client permission checks only decide what navigation/UI should be visible.

## 4. Effective access evaluator

`IAccessEvaluator` / `AccessEvaluator` now evaluates:

1. authenticated `sub`,
2. active INNO.One User Profile,
3. module installed + enabled,
4. role permission,
5. active Access Assignment,
6. optional action override narrowing,
7. assignment resource scopes,
8. Organization/Location include-children expansion,
9. Device Group scope.

Current denial reasons include:

- `UNAUTHENTICATED`
- `PROFILE_NOT_FOUND`
- `PROFILE_NOT_ACTIVE`
- `MODULE_DISABLED`
- `PERMISSION_NOT_GRANTED`
- `ACTION_OVERRIDE_DENIED`
- `OUTSIDE_ASSIGNED_SCOPE`

The normal API boundary still returns HTTP authorization semantics rather than exposing internal database details.

## 5. Cross-module read rule

Devices does **not** reference the Platform module project.

Devices obtains display names through the shared query contract:

`IPlatformDirectoryReader`

This resolves:

- User names,
- Organization names,
- Location names.

Therefore:

~~~text
Devices → Contracts → Platform query implementation
~~~

is allowed, while:

~~~text
Devices → Platform tables/classes
~~~

remains disallowed.

There is no cross-module database foreign key.

## 6. Platform persistence implemented

Step 15 implements the first Platform tables required by this slice:

- `user_profiles`
- `organization_units`
- `locations`
- `positions`
- `roles`
- `permissions`
- `role_permissions`
- `access_assignments`
- `access_assignment_resources`
- `access_assignment_actions`
- `app_modules`

Migration:

`Step15IdentityAccess`

Database schema:

`platform`

## 7. Devices persistence implemented

Step 15 implements:

- `devices`
- `device_external_mappings`
- `device_groups`
- `device_group_members`

Migration:

`Step15DeviceCatalog`

Database schema:

`devices`

The production EF layer now uses snake_case naming through `EFCore.NamingConventions`.

The first generated migrations were regenerated before checkpoint so physical names match the Step 13 naming contract.

## 8. Opaque resource IDs

Database primary keys remain UUID.

Public IDs are serialized as opaque IDs such as:

~~~text
user_...
org_...
loc_...
grp_...
dev_...
~~~

The API does not expose raw vendor IDs as the canonical Device identifier.

## 9. MeshCentral mapping boundary

The canonical device remains:

`devices.devices.id`

Provider mapping remains:

~~~text
devices.device_external_mappings
├─ device_id
├─ provider = meshcentral
└─ external_id
~~~

The Device API may return the normalized management-engine name:

`MeshCentral`

but does **not** return:

- MeshCentral node ID,
- vendor `externalId`,
- vendor persistence details.

Real MeshCentral synchronization/network calls remain deferred.

## 10. GET /api/v1/platform/me

The endpoint now returns the authenticated user's business profile.

Data includes:

- opaque User ID,
- employee ID,
- full name,
- email,
- phone/office,
- status,
- Organization,
- Position,
- Location,
- active role names,
- effective client-facing permissions,
- timezone,
- SSO connection state.

Permissions returned to Web are filtered by:

- active assignments,
- action overrides,
- installed/enabled modules.

This lets normal navigation hide modules a user cannot currently enter.

## 11. GET /api/v1/devices

The list endpoint now supports:

- server-side effective scope filtering,
- search,
- Status filter,
- OS filter,
- allow-listed sorting,
- pagination,
- Device Group filter input,
- Platform directory-name enrichment.

Important rule:

**authorization scope filtering happens before `totalItems` is counted.**

This prevents collection metadata from leaking devices outside the caller's scope.

Current search covers:

- hostname,
- serial number,
- IP address,
- operating system.

Pagination:

- page minimum = 1,
- page size clamped to 1–100.

## 12. GET /api/v1/devices/{deviceId}

Resource detail:

- parses opaque `dev_...` identifier,
- validates `devices.view`,
- validates resource scope,
- returns 404 for a missing Device,
- returns 403 for a real Device outside effective scope.

Returned overview includes:

- identity/status/type,
- assigned user,
- Organization/Location,
- Device Group,
- serial/IP/MAC,
- operating system,
- manufacturer/model,
- processor/BIOS,
- logged-on user,
- linked asset reference,
- Agent version,
- last seen,
- CPU/memory/disk snapshot,
- normalized management engine.

## 13. Offline behavior

An offline resource remains viewable when the user has access.

The production Device detail keeps the cached inventory visible and shows:

**Resource offline — Showing the latest cached inventory.**

This preserves the frozen Resource Offline state contract.

## 14. Production Web implementation

Step 15 adds:

- `keycloak-js`,
- `@tanstack/react-query`,
- authenticated app boot,
- Profile context,
- API client,
- shared loading/error handling,
- production shell navigation,
- Profile & Settings screen,
- All Devices screen,
- Device Overview detail screen.

The Web shell exposes only tasks implemented by the current slice.

Unimplemented high-emphasis actions such as:

- Add Device,
- Discover Devices,
- Remote Desktop,
- other future module navigation,

are not shown as fake controls.

## 15. Devices collection UX

The production collection uses:

- Search first,
- Status filter,
- OS filter,
- compact table,
- Action column,
- no-results state,
- loading state,
- API error/permission state,
- pagination.

At narrow Web widths the table scrolls inside its collection container; the page itself does not horizontally overflow.

## 16. Device detail UX

The current vertical slice ports only the frozen Overview job.

Visible content includes:

- resource breadcrumb,
- resource identity/status,
- CPU / Memory / Disk / Last seen strip,
- Device information,
- Inventory summary,
- Management context,
- Organization/Location,
- offline cached-state banner.

Tabs/actions whose backend is not implemented remain hidden.

## 17. Local development fixtures

The local Keycloak/PostgreSQL stack contains development fixtures only.

Fixtures include:

- administrator-style local user `adisai`,
- scope-limited local user `hr.viewer`,
- four sample Devices,
- Organization tree,
- two role/access-assignment examples.

The scoped viewer has:

- `platform.workspace.access`
- `devices.view`

and Human Resources Organization scope only.

This lets the automated smoke test prove server-side scope enforcement.

## 18. Local smoke-only authentication client

The imported **local development realm only** also contains:

`inno-one-e2e`

It enables Direct Access Grant solely for automated local API smoke testing.

It is **not** the normal browser sign-in client and is not a production authentication design.

Normal browser sign-in remains Authorization Code + PKCE S256.

## 19. Runtime QA

Local API smoke verifies:

- unauthenticated API → 401,
- mapped administrator profile loads,
- administrator sees 4 Devices,
- search filter works,
- Status filter works,
- OS filter works,
- pagination works,
- offline detail remains available,
- vendor external ID does not leak,
- HR-scoped viewer sees exactly 1 Device,
- out-of-scope Device detail → 403,
- missing Device → 404.

Database fixture counts verified:

~~~text
profiles=2
assignments=2
devices=4
mappings=4
~~~

## 20. Browser auth QA

The normal Web entry was navigated without an authenticated session.

The redirect to Keycloak was inspected and verified:

- `client_id=inno-one-web`
- `response_type=code`
- `code_challenge_method=S256`
- non-empty PKCE code challenge
- redirect URI returns to `http://localhost:5180`

The direct-grant smoke client is not used by the normal React boot path.

## 21. Visual / responsive QA

The actual Step 15 React page components were rendered in an isolated QA harness with production CSS/data shape and visually inspected.

Reviewed pages:

- All Devices,
- Profile & Settings,
- online Device detail,
- offline Device detail.

Reviewed Web viewports:

- 1366×900,
- 1024×900,
- 768×900.

Automated visual metrics reported:

- page-level horizontal overflow: 0 failures,
- unnamed visible controls: 0 failures,
- collection table containment: pass,
- offline banner: present at all tested viewports.

A duplicate Device title hierarchy found during review was corrected before checkpoint.

The temporary visual QA harness is not part of production runtime code.

## 22. What Step 15 intentionally does not implement

Not implemented yet:

- real MeshCentral node synchronization/network calls,
- Add Device / discovery / enrollment,
- Agent installer generation,
- Remote Desktop command execution,
- Device settings,
- maintenance/deployment commands,
- alert/policy write flows,
- outbox/audit writer for mutation vertical slices,
- production Keycloak realm hardening/secrets,
- full port of all frozen Devices pages.

## 23. Source of truth

- `INNO-One-Step15-First-Vertical-Slice.md`
- `inno-step15-vertical-slice.json`
- `step15-vertical-slice-audit.py`
- `production/scripts/step15-local-smoke.py`
- Step 9–14 frozen planning contracts.

## 24. Step 15 decisions frozen

1. Implementation has moved from planning to **implementation-in-progress**.
2. Normal Web authentication is Keycloak Authorization Code + PKCE S256.
3. The API uses Keycloak Bearer JWT with unmapped `sub`.
4. Keycloak `sub` maps to `platform.user_profiles.keycloak_subject`.
5. Business authorization remains INNO.One-owned.
6. `devices.view` is enforced server-side.
7. collection scope filtering occurs before count/pagination.
8. resource detail performs an explicit resource-scope check.
9. Platform display data crosses into Devices through a shared query contract, not direct table access.
10. public Device identity is INNO.One `dev_...`, not a MeshCentral node ID.
11. vendor external IDs stay private.
12. offline detail preserves cached inventory.
13. only implemented task actions/routes are exposed in normal Web navigation.
14. the local direct-grant client is QA-only and not the normal sign-in path.

## 25. Next recommended implementation slice

Recommended Step 16:

**Devices Management — Device Groups → Discovery / Add Device → Agent enrollment → live MeshCentral synchronization**

This would prove the first write/command path and introduce:

- real MeshCentral adapter calls,
- Device enrollment mapping,
- command idempotency,
- transactional outbox,
- audit records,
- mutation permission checks,
- consent/availability state handling.

This is a recommendation for the next implementation slice, not a newly frozen product requirement.

## 26. Final closeout QA

Final closeout on the Step 15 branch re-ran the complete applicable gate set after runtime integration was stable:

- `step15-vertical-slice-audit.py`: **0 issues**.
- Production Skeleton / Implementation / Data / Event-Audit / API contract audits: **0 issues**.
- Frozen UX/UI static audit chain: **0 issues**.
- Frozen browser regression: **124 / 124 checks**, failures 0.
- Web TypeScript typecheck + production build: **PASS**.
- .NET solution build: **0 warnings / 0 errors**.
- Docker Compose configuration: **PASS**; PostgreSQL healthy and Keycloak running.
- Step 15 local runtime smoke: **PASS**.
- Live browser entry redirects to the Keycloak `inno-one-web` client with Authorization Code + PKCE S256 and renders the organization Sign in form.
- `git diff --check`: **PASS**.

The Step 15 implementation is therefore ready for a Git checkpoint. The frozen UX/UI baseline itself was not changed.
