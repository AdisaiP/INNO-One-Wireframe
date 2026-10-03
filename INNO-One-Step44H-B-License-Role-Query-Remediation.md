# INNO.One — Step 44H-B License / Role / Query Remediation

**Status:** COMPLETE  
**Branch:** `ux/step44h-b-license-role-query-remediation`  
**Base:** `ca313d7 test: freeze step 44 final visual qa`  
**Frozen Design System:** V1.26  
**Frozen UI Contract:** 1.20.0  
**Current route definitions:** 57  
**Concrete browser URLs covered:** 58 including Workspace root `/`

## Goal

Address the three post-freeze UX findings raised after Step 44H:

1. Software Licenses needed a true detail resource instead of another overlay-heavy surface.
2. Roles & Permissions needed real Create/Edit Role + permission assignment instead of a read-only reference.
3. Inventory Query still read like several competing cards rather than one clear builder task.

This pass intentionally supersedes the earlier H-A decisions for these three surfaces only.
## Software Licenses

### Architecture

The Software Licenses route remains a P02 primary collection:

```text
/assets/software-licenses
```

Row **Open** now navigates to a dedicated P03 detail route:

```text
/assets/software-licenses/:licenseId
```

The detail route owns:
- resource identity + compliance status,
- purchased / used / overage / renewal summary,
- **Entitlement & Renewal**,
- detected endpoint/user allocations.

The ambiguous label **License record** is removed.

### What “Entitlement & Renewal” means

The previous License Record fields were actually commercial entitlement metadata:
- License model
- Purchased seats
- Unit price
- Renewal date
- Contract reference

They now live in the dedicated license detail context under **Entitlement & Renewal**.

Editing those five fields is a focused dialog from the resource header:

```text
Edit Entitlement
→ Edit Entitlement & Renewal dialog
```

Detected allocations remain read-only operational evidence.

### API

Added:

```text
GET /api/v1/assets/software-licenses/{licenseId}
```

The endpoint returns the license resource plus current allocations and ETag.
The existing PATCH endpoint remains the entitlement mutation boundary.
No database schema change was required.
## Roles & Permissions

Roles are now a real administration surface rather than a fixed four-role reference.

### UI

`/admin/roles` now supports:
- **New Role** page-header action,
- role list with Edit Role row action,
- focused New/Edit Role drawer,
- stable immutable role code after creation,
- editable name and status,
- permission search,
- permission grouping by module,
- per-permission checkboxes,
- Select module / Clear module shortcuts,
- permission matrix retained below as a reference view.

### Backend

The existing persistence model already had:

```text
Role
Permission
RolePermission
```

Step 44H-B exposes that model through real APIs:

```text
POST /api/v1/admin/roles
PUT  /api/v1/admin/roles/{roleId}
```

Both mutations require:

```text
admin.roles.manage
```

Role updates use optimistic concurrency with `If-Match`.

Role code is normalized to lowercase at creation for stable identity.

### Platform Admin protection

The `platform_admin` role:
- cannot be made inactive,
- must retain the critical Admin Center / role-management permissions,
- exposes those permissions as protected in the editor.

This prevents the role editor from creating an obvious administrative lockout path.
## Inventory Query

The page is now explicitly a P06 builder.

### Removed
- permanent Saved Queries side card,
- standalone Fact Coverage card,
- disabled Fact selector,
- dark query-code preview block,
- competing two-column master/detail feeling.

### Current layout

Page header:
- **Saved Queries** utility action.

Primary builder:
- Query name
- Search scope
- optional Device Group revealed only when needed
- light **Match devices where** clause builder
  - Field
  - Operator
  - Value
- human-readable Condition / Scope summary
- Save Query / Save as New
- Run Query

Supporting surface:
- Results collection below the builder.

Saved Queries:
- focused drawer,
- searchable reusable definitions,
- selecting one loads it into the builder and closes the drawer.

The value placeholder is explicit (`e.g. Chrome`) so placeholder copy cannot be mistaken for actual query state.
## Architecture matrix

Step 44A matrix now contains **57 current route definitions**.

Relevant entries:

```text
admin/roles
  P02 role-list+drawer+permission-matrix

devices/query
  P06 builder+saved-query-drawer

assets/software-licenses
  P02 list

assets/software-licenses/:licenseId
  P03 detail-route+edit-dialog
```

Current pattern counts:

```text
P01 = 4
P02 = 21
P03 = 8
P04 = 7
P05 = 7
P06 = 1
P07 = 2
P08 = 2
P09 = 2
P10 = 3
```

The broad browser harness also covers the Workspace root `/`, giving **58 concrete navigable URLs** in regression.
## QA

### Dedicated H-B static

```text
step44h_b_checks=40
step44h_b_failures=0
```

### Dedicated H-B browser

1366 / 1024 / 768:

```text
step44h_b_browser_checks=89
step44h_b_browser_failures=0
step44h_b_browser_screenshots=16
```

Interaction proof includes:
- Software License Open → dedicated detail route,
- Entitlement edit dialog,
- New Role drawer,
- Create Role POST reaching the duplicate-code conflict guard,
- Edit Role PUT completing successfully,
- loaded permission assignments in Edit Role,
- Saved Queries drawer,
- Device Group field progressive reveal.

### Broad Production browser regression

```text
step42_routes=58
step42_browser_checks=1525
step42_browser_failures=0
```

### Design System browser

```text
56 / 56
failures = 0
```
## Build / test

Backend:

```text
dotnet build INNO.One.sln
Build succeeded
0 warnings
0 errors
```

`dotnet test INNO.One.sln --no-build --no-restore` exits successfully. The repository test folders currently contain documentation placeholders rather than executable test projects, so behavioral API proof is additionally covered by the browser/API mutation checks above.

Frontend:

```text
@inno/ui build PASS
Web Portal typecheck PASS
Web Portal production build PASS
```

Current production bundle:

```text
main JS  = 686.97 kB / 179.00 kB gzip
main CSS = 104.74 kB / 17.85 kB gzip
```

The existing Vite >500 kB chunk-size advisory remains.

No database migration was introduced.
## Visual review

Dedicated screenshots were opened and visually reviewed for:
- Software License list,
- Software License detail,
- Entitlement edit dialog,
- Roles list/matrix,
- New Role drawer,
- Edit Role drawer,
- Inventory Query,
- Saved Queries drawer,
- 768 responsive variants.

Observed result:
- license detail reads as a resource rather than an embedded editor,
- role permission assignment remains usable inside the drawer,
- Inventory Query has one clear primary builder,
- no page-level horizontal overflow at 1366 / 1024 / 768.

## Next

Step 44H-B is the latest UX baseline for these three surfaces.

The branch includes the previous Step 44H checkpoint because it was created from `ca313d7`; merging H-B later will therefore carry both Step 44H QA/freeze files and the H-B remediation.

Do not merge to `main` unless explicitly requested.
