# INNO.One — Step 36 Next Chat Handoff

Last updated: 2026-09-28
Step: **36 — Platform Settings Foundation**
Branch: `implementation/step36-platform-settings`
Status: **COMPLETE — static/build/runtime/browser QA passed**

## Scope

Meeting remains intentionally deferred.

Step 36 activates the final planned Platform Settings Admin surface without inventing a persisted global settings model that is not present in the frozen contracts.

Implemented:
- `/admin/settings`
- safe effective-settings API
- Admin navigation / global search / Admin Overview integration
- `admin.settings.manage` development permission seed
- responsive read-only Platform Settings page
- Implementation Contract `0.26.0`

## Contract boundary

Current source contracts provide:
- Platform Settings as an Admin Center IA area
- reserved permission `admin.settings.manage`
- frozen API conventions
- safe/masked configuration GET rule
- ETag / If-Match requirement for future mutable configuration

Current contracts do **not** define:
- persisted global settings resource schema
- mutable timezone-default setting
- retention-duration settings
- organization-wide notification defaults
- settings-specific ETag resource representation
- settings-specific audit action catalog

Step 36 therefore does not create speculative settings tables or fake Save/Edit controls.

## API

New endpoint:
- `GET /api/v1/admin/settings`

Permission:
- `admin.settings.manage`

Response:
- `configurationMode = contract-and-deployment-managed`
- `mutableSettings = false`
- hosting environment
- safe setting groups
- effective/frozen setting items
- checked timestamp

No POST / PUT / PATCH / DELETE settings endpoints were added.

## Effective settings exposed

### API
- Public API base path: `/api/v1`
- Authentication contract: `Bearer JWT`
- Authorization model: `Permission + resource scope`
- List pagination: `Page-number pagination`
- Error response format: `application/problem+json`
- Mutable configuration concurrency: `ETag / If-Match`

### Time
- API timestamp transport: `ISO 8601 with timezone`

### Runtime
- current ASP.NET Core hosting environment

### Contract versions
- Design System
- UI Contract
- API Contract
- Event / Audit Contract
- Data Model Contract
- Implementation Contract

Sensitive values are intentionally excluded:
- DB connection strings
- passwords
- Keycloak authority configuration
- MeshCentral credentials
- secrets

## React UI

New:
- `AdminPlatformSettingsPage.tsx`

Route:
- `/admin/settings`

Pattern:
- read-only P05 Settings foundation

UI includes:
- Environment summary
- group count
- setting count
- read-only mode
- Effective Platform Settings table
- Group
- Setting
- Effective value
- Source
- Frozen / Effective state
- Detail
- Refresh Settings
- future mutation-boundary guidance

Integrated into:
- Admin contextual navigation
- global search
- Admin Overview

No fake controls:
- no Save Settings
- no Edit Settings
- no Update Settings
- no timezone editor
- no retention editor

## QA

Static:
- Step 36 audit: `issues=0`
- Step 35 regression: `issues=0`
- Step 34 regression: `issues=0`
- Step 33 regression: `issues=0`
- Step 32 regression: `issues=0`
- Step 31 regression: `issues=0`
- Step 30 regression: `issues=0`
- Step 29 parity: `issues=0`
- Steps 15–28: all `issues=0`

Runtime:
- real PostgreSQL + Keycloak runtime on `172.10.1.58`
- `step36-runtime-qa.py`: **36 / 36 PASS**

Runtime coverage:
- Platform Admin receives `admin.settings.manage`
- viewer does not receive it
- endpoint permission enforcement
- exact 14 safe effective settings
- exact contract/version values
- frozen/effective state correctness
- implementation version `0.26.0`
- secret-leak checks
- viewer receives 403

Browser / visual:
- real Keycloak login
- `step36-browser-qa.py`: **67 / 67 PASS**
- 1366 / 1024 / 768
- no page-level horizontal overflow
- one active Admin rail entry
- all 14 rows visible
- frozen contract values visible
- Refresh Settings visible
- no fake mutation actions
- no settings editor fields
- Admin Overview Platform Settings link present
- representative screenshots visually reviewed

Final regression:
- Steps 15–36 static audits: PASS
- TypeScript typecheck: PASS
- Vite production build: PASS
- .NET build: **0 warnings / 0 errors**
- `git diff --check`: PASS
- final marker: `STEP36_FINAL_CHAIN=PASS`

## Next action

Step 36 is closed.

Meeting remains intentionally deferred.

The Admin Center sequence now has implemented foundations for:
- Organization / Users / Roles / Scopes
- Apps & Modules
- Integrations
- Audit
- Security
- Branding
- Platform Settings

The architecture also mentions platform-level Notifications and Search. Before starting another numbered step, inspect whether those remain intended as Admin Center modules or belong to module-specific/global-service work, then define the next scope from the current contracts.

Do not merge `main`.
Do not deploy.
