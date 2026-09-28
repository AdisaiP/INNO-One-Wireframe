# INNO.One — Step 31 Next Chat Handoff

Last updated: 2026-09-28
Step: **31 — Admin Center Core**
Branch: `implementation/step31-admin-center-core`
Status: **COMPLETE — static/build/runtime/browser QA passed**

## Scope

Meeting is intentionally deferred per user direction.

Step 31 implements the core Admin Center surfaces defined by the repository contracts:

- Admin Overview
- Organization Structure
- Locations
- Positions
- Users
- User Detail
- Roles & Permissions
- Access Scopes
- existing Apps & Modules remains integrated

Source contracts:
- `INNO-One-Workspace-Architecture-Plan.md`
- `INNO-One-API-Contract.md`
- `INNO-One-Permission-Scope-Contract.md`
- frozen Design System / UI contracts

## Backend implemented

New endpoint files:
- `AdminDirectoryEndpoints.cs`
- `AdminAccessEndpoints.cs`

Directory endpoints:
- `GET /api/v1/admin/overview`
- `GET /api/v1/admin/organization/tree`
- `POST /api/v1/admin/organization/units`
- `PUT /api/v1/admin/organization/units/{unitId}`
- `GET /api/v1/admin/locations/tree`
- `POST /api/v1/admin/locations`
- `PUT /api/v1/admin/locations/{locationId}`
- `GET /api/v1/admin/positions`
- `POST /api/v1/admin/positions`
- `PUT /api/v1/admin/positions/{positionId}`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/{userId}`
- `POST /api/v1/admin/users`
- `PUT /api/v1/admin/users/{userId}`

Access endpoints:
- `GET /api/v1/admin/roles`
- `GET /api/v1/admin/permissions`
- `GET /api/v1/admin/access-assignments`
- `GET /api/v1/admin/access-assignments/{assignmentId}`
- `PUT /api/v1/admin/access-assignments/{assignmentId}`
- `GET /api/v1/admin/access-scopes/effective-tree`
- `POST /api/v1/admin/access-scopes/evaluate`

Behavior:
- centralized permission checks
- ETag / If-Match concurrency for mutable masters and assignments
- hierarchy cycle protection
- validation of referenced organization/location/position/role resources
- audit writes for organization, location, position, user, assignment and access evaluation actions

## Permissions

Step 31 seeds and assigns the Platform Admin permissions:
- `admin.access`
- `admin.organization.view`
- `admin.organization.manage`
- `admin.locations.view`
- `admin.locations.manage`
- `admin.positions.view`
- `admin.positions.manage`
- `admin.users.view`
- `admin.users.manage`
- `admin.roles.view`
- `admin.roles.manage`
- `admin.access_scopes.view`
- `admin.access_scopes.manage`
- `admin.access_scopes.evaluate`

Existing Step 30:
- `admin.apps.view`
- `admin.apps.manage`

## React production UI

New production routes:
- `/admin`
- `/admin/organization`
- `/admin/locations`
- `/admin/positions`
- `/admin/users`
- `/admin/users/:userId`
- `/admin/roles`
- `/admin/access-scopes`

Existing:
- `/admin/apps`

Admin rail/context navigation now owns:
- Overview
- Organization / Structure
- Locations
- Positions
- Users
- Roles & Permissions
- Access Scopes
- Apps & Modules

All entries are permission filtered.

### Important contract restraint

The current API contract exposes role/permission catalogs but does **not** define role create/update operations.

Therefore:
- Roles & Permissions is read-only in Step 31.
- no fake New Role / Edit Role action exists.

The current API contract also does not define access-assignment creation.

Therefore:
- Access Scopes edits existing assignments and evaluates access.
- no fake New Assignment action exists.

## User model

Authentication identity remains owned by Keycloak.

INNO.One owns organization profile data:
- employee ID
- display/full name
- email/phone/office
- organization unit
- position
- location
- status
- direct role + scope assignments

The user-create flow links an existing Keycloak subject to a new INNO.One organization profile.

## Contract versions

Preserved:
- Design System V1.26
- UI Contract 1.20.0
- API Contract 0.5.0
- Event/Audit Contract 0.5.0
- Data Model Contract 0.6.0

Implementation Contract:
- **0.21.0**

## QA

Static:
- Step 31 Admin Center audit: `issues=0`
- Step 30 regression audit: `issues=0`
- Step 29 parity regression: `issues=0`
- Steps 15–28 regression audits: all `issues=0`

Build:
- TypeScript typecheck: PASS
- Vite production build: PASS
- .NET build: PASS
- .NET warnings: 0
- .NET errors: 0
- `git diff --check`: PASS

Runtime infrastructure:
- VPN-connected server `172.10.1.58`
- PostgreSQL 17
- Keycloak 26.4.0
- source remained on Windows; no deployment to the server

Runtime suite:
- `python step31-runtime-qa.py`
- **46 / 46 checks PASS**

Runtime coverage includes:
- Platform Admin permission matrix
- Admin/non-admin authorization
- Organization, Locations, Positions, Users, Roles, Permissions, Access Assignments
- User detail
- same-value ETag update + stale 412 for Organization
- same-value ETag update + stale 412 for Access Assignment
- effective access evaluation
- viewer denied on Admin APIs

Browser / visual:
- real Keycloak login
- canonical 1366 pass: **47 / 47**
- responsive 1024 pass: **26 / 26**
- responsive 768 pass: **26 / 26**
- no page-level horizontal overflow
- one active Admin rail entry
- master-detail editors open
- Users New User action visible for admin
- Roles has no fake role mutation
- Access Scopes has no fake create
- Evaluate Access panel present

Representative screenshots are generated in ignored local QA folders:
- `qa-step31-browser-1366/`
- `qa-step31-browser-768/`

## Next action

Step 31 is closed.

Meeting remains intentionally deferred.

Define the next scope explicitly before creating Step 32. Likely remaining high-value Admin/platform areas include Integrations and Audit Center, but do not invent a Step 32 without user direction.

Do not merge `main`.
Do not deploy.
