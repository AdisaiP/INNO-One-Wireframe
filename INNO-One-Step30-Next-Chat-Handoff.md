# INNO.One — Step 30 Next Chat Handoff

Last updated: 2026-09-28
Step: **30 — Module SDK / Plugin Contract Foundation**
Branch: `implementation/step30-module-plugin-contract`
Status: **COMPLETE — static/build/runtime/browser QA passed**

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

Runtime module dependencies preserve the frozen registry intent:
- Assets → Devices
- Helpdesk → Devices + Assets
- Reports → Devices + Assets + Helpdesk
- Devices / Meeting → Platform only
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

## Runtime QA completed

Runtime infrastructure:
- VPN-connected Ubuntu server `172.10.1.58`
- Docker project `inno-one-step18`
- PostgreSQL 17
- Keycloak 26.4.0
- Windows source remained the current Step 30 branch
- PostgreSQL/Keycloak were consumed through local SSH tunnels; source code was not deployed to the server

Verified:
- `Step30AppRegistryConcurrency` migration applied to the real PostgreSQL database
- Keycloak-backed admin and non-admin tokens
- `GET /platform/apps` permission filtering
- `GET /admin/apps` admin-only visibility
- not-installed module enable conflict
- dependency conflicts for Assets/Devices
- enable/disable mutation
- ETag stale-write returns 412
- disabled module disappears from launcher
- final Helpdesk state restored
- audit rows `platform.app.availability_changed` written with version changes

Automated runtime suite:
- `python step30-runtime-qa.py`
- **31 / 31 checks PASS**

## Browser / visual QA completed

Automated browser suite:
- `python step30-browser-qa.py`
- **48 / 48 checks PASS**

Verified at:
- 1366 px
- 1024 px
- 768 px

Covered:
- real Keycloak login
- Apps data and search
- Apps & Modules data
- active rail state
- no page-level horizontal overflow
- module row/switch counts
- no fake Install action
- Inspect detail
- screenshot review

Local screenshots are generated under `qa-step30-browser/` and remain ignored QA artifacts.

## Next action

Step 30 is closed. Continue only from a newly defined next requirement / phase. Do not invent Step 31 without an explicit scope source.
