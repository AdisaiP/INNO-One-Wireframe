# INNO.One — Step 30 Next Chat Handoff

Last updated: 2026-09-28
Step: **30 — Module SDK / Plugin Contract Foundation**
Branch: `implementation/step30-module-plugin-contract`
Status: **FOUNDATION CHECKPOINT — static/build complete, runtime browser QA pending**

## Goal

Turn the existing plugin-ready architecture into a real central module contract without undoing Step 29 UI parity or Steps 15–28 behavior.

Existing architecture source:
- `INNO-One-Workspace-Architecture-Plan.md` §11 Module / Plugin Contract
- Phase 2: App Registry + Permission
- `INNO-One-Availability-Contract.md` §8 Module Registry

No merge to `main`.
No deployment.
## Implemented in this checkpoint

### Canonical module manifest

New runtime source:
- `production/module-manifests.json`
- schemaVersion: `1`

Declared modules:
- Devices
- Assets
- Helpdesk
- Meeting
- Reports

Manifest owns:
- module id/name/icon/entry route
- entry permission
- dependencies
- declared permissions
- module navigation
- events
- integration capabilities

Meeting and Reports are declared but remain not installed in the App Registry.
### Backend registry

New:
- `ModuleManifestCatalog`
- manifest validation at startup
- Platform-owned permission namespace helper
- `PlatformLedgerWriter`
- App Registry endpoints

Endpoints:
- `GET /api/v1/platform/apps`
- `GET /api/v1/admin/apps`
- `PATCH /api/v1/admin/apps/{appId}`

Behavior:
- launcher requires Installed + Enabled + Permission
- navigation is permission-filtered
- dependencies are enforced on enable
- enabled dependents block disabling a required module
- not-installed modules have no Install action
- availability mutation writes `platform.app.availability_changed`
### Permission correction

`platform.*` and `admin.*` are now treated as Platform-owned permission namespaces.

This fixes the prior behavior where `admin.*` could incorrectly return `MODULE_DISABLED` because no `app_modules.admin` row exists.

Added development seed permissions:
- `platform.apps.view`
- `admin.apps.view`
- `admin.apps.manage`

Platform Admin receives all three.
Normal workspace roles receive `platform.apps.view` where appropriate.

### Concurrency

`platform.app_modules` now has `version bigint`.

Migration:
- `Step30AppRegistryConcurrency`

Availability updates support ETag / If-Match behavior.
Existing rows start at version 1.
### React production UI

New real routes:
- `/apps`
- `/admin/apps`

`/apps`:
- real App Launcher
- search
- only apps that are installed, enabled and permitted
- real deep links into modules

`/admin/apps`:
- central Module Registry
- installed/enabled/available summary
- real enable/disable switch when user has `admin.apps.manage`
- Inspect remains active
- no fake Install control for not-installed modules

Shell now includes:
- Apps rail entry
- Admin Apps entry when permitted
- global search targets
- contextual navigation for Apps and Apps & Modules
## Contract versions

Preserved:
- Design System V1.26
- UI Contract 1.20.0
- API Contract 0.5.0
- Event/Audit Contract 0.5.0
- Data Model Contract 0.6.0

Implementation Contract:
- **0.20.0**

Step 29 frozen UI behavior remains authoritative for existing production routes.

## QA completed

- Step 30 module/plugin contract audit: `issues=0`
- Step 29 React UI parity audit: `issues=0`
- Steps 15–28 regression audits: all `issues=0`
- Web TypeScript typecheck: PASS
- Web Vite production build: PASS
- .NET build: PASS, 0 warnings / 0 errors
- manifest JSON parse: PASS
- `git diff --check`: PASS
## Runtime QA pending

Windows development machine currently does not have Docker Desktop.

Therefore the following Step 30 runtime checks are still pending:
- PostgreSQL migration execution
- Keycloak-backed authenticated API checks
- `GET /platform/apps` permission matrix
- `GET /admin/apps` admin visibility
- enable/disable mutation + ETag stale-write test
- dependency conflict tests
- audit row verification
- React browser QA for `/apps` and `/admin/apps`
- visual QA at 1366 / 1024 / 768

Do not mark Step 30 fully complete until these runtime/browser checks pass.

## Next action

Install/start the Windows runtime dependencies (PostgreSQL + Keycloak, preferably Docker Desktop), apply migrations, start API + Web, then execute Step 30 browser/runtime QA.

Do not invent Step 31 before Step 30 runtime QA closes.
