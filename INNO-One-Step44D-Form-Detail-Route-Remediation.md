# INNO.One — Step 44D Form / Detail Route Remediation

**Status:** COMPLETE
**Branch:** `ux/step44d-form-detail-route-remediation`
**Base:** `08cb719 refactor: add hierarchy interaction parity`
**Scope:** Correct invalid permanent side-card / master-detail form architecture
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## Goal

Step 44D applies the Step 44A form/detail architecture rule to the remaining incorrectly permanent editors.

The rule remains:

- short simple form → focused dialog is acceptable,
- 6–12 fields → dedicated create/edit route,
- multi-section form → dedicated route,
- true hierarchy selection + edit may remain adjacent when it is one continuous job,
- read-only resource inspection belongs on a resource detail route.

## Production changes

### Positions

`/admin/positions` is now a collection-owned list.

Removed:
- permanent `admin-master-detail`,
- permanent `admin-editor-panel`,
- selected-row editor state.

Create/Edit now uses shared `INNODialog`.

### Users

`/admin/users` is now list-only.

Added:
- `/admin/users/new` → P04 create route,
- `/admin/users/:userId/edit` → P04 edit route.

`/admin/users/:userId` remains a read-only P03 resource detail route and links to the dedicated edit route.

### Access Scopes

`/admin/access-scopes` is now list + evaluation utility only.

Added:
- `/admin/access-scopes/:assignmentId/edit` → P04 edit route.

The Step 44C `INNOTreeGrid` hierarchy browser moved with the assignment editor to the dedicated edit route. The list no longer owns a permanent editor.

### Contracts & Warranty

`/assets/contracts` is now a P02 list.

Added:
- `/assets/contracts/:contractId` → P03 contract detail,
- `/assets/contracts/:contractId/edit` → P04 contract editor.

The detail route owns identity, summary, terms and covered assets. The edit route owns the multi-section form and canonical `INNOEditorFooter`.

No backend detail endpoint was invented. `getAssetContract()` is a frontend adapter over the existing paginated list API until a future API contract explicitly adds a detail endpoint.

### Asset Custom Fields

`/assets/custom-fields` remains a settings/list surface.

Removed:
- permanent inline editor rows.

Add/Edit now uses focused shared `INNODialog`, while persistence still uses the existing schema update API.

## Route architecture

Step 44D adds 5 concrete Production routes:

- `admin/users/new`
- `admin/users/:userId/edit`
- `admin/access-scopes/:assignmentId/edit`
- `assets/contracts/:contractId`
- `assets/contracts/:contractId/edit`

The Step 44A matrix now covers **56 concrete Production routes**.

Current pattern counts:

- P01 = 4
- P02 = 17
- P03 = 7
- P04 = 7
- P05 = 7
- P06 = 1
- P07 = 2
- P08 = 2
- P09 = 6
- P10 = 3

## Gap status

The Step 44A permanent side-card form/detail gap is now **REMEDIATED**.

Current gap classes:

```text
step44a_reported_gap_classes=9
step44a_current_gap_classes=4
```

Remaining:
- row-action inconsistency,
- hero illustration parity,
- Workflow Canvas foundation,
- Assets User Profiles / Ownership information architecture.

## QA

Dedicated Step 44D static:

```text
step44d_checks=34
step44d_failures=0
step44d_new_routes=5
step44d_remediated_surfaces=5
```

Dedicated browser QA at 1366 / 1024 / 768:

```text
step44d_browser_checks=102
step44d_browser_failures=0
```

Screenshots were generated and visually inspected for:
- Positions dialog,
- User create/edit,
- Access Scope edit + TreeGrid,
- Custom Field dialog,
- Contract detail/edit.

No page-level horizontal overflow was found on the remediated surfaces.

## Regression gates

```text
Step 42.2C collection browser = 193/193
Step 42.2D editor/settings browser = 159/159
Step 42.2E resource detail browser = 250/250
Step 44B shared interaction browser = 65/65
Step 44C hierarchy browser = 54/54
Step 42.2G responsive browser = 77/77
Design System browser = 56/56
Broad Production = 56 routes / 1468 checks / 0 failures
Full static chain = 56/56 / 0 failures
```

Build:
- `@inno/ui` build PASS,
- Web Portal typecheck PASS,
- Web Portal production build PASS,
- `git diff --check` PASS,
- only the existing Vite chunk-size advisory remains.

## Historical QA updates

Older audits that encoded the superseded inline editor architecture were updated to assert the new ownership instead of being disabled.

Examples:
- Step 42.2C now expects Edit navigation on Positions / Access Scopes rather than Select + permanent editor.
- Step 42.2D now tests the User create route rather than inline creation.
- Step 42.2E treats Admin User detail as read-only P03 and edit as separate P04.
- Step 44C validates `INNOTreeGrid` on the Access Scope edit route.
- Broad Production QA now includes all 56 current concrete routes.

## Next frozen sequence

Per Step 44A:

**Step 44E — Visual Parity**
- restore approved hero illustrations,
- normalize remaining card/input/button/table visual drift,
- remove redundant explanatory blocks where still present.

Then:
- Step 44F — Assets Information Architecture,
- Step 44G — Dynamic Workflow Foundation only when explicitly approved,
- Step 44H — Full Route Visual QA.

Do not merge to `main` or deploy unless explicitly requested.
