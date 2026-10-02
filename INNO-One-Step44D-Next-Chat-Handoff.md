# INNO.One — Step 44D Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step44d-form-detail-route-remediation`
**Base:** `08cb719 refactor: add hierarchy interaction parity`
**Scope:** Form / Detail Route Remediation
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## Read first

Primary Step 44D summary:

```text
INNO-One-Step44D-Form-Detail-Route-Remediation.md
```

Architecture source of truth:

```text
INNO-One-Step44A-Screen-Interaction-Architecture.md
inno-step44a-screen-interaction-matrix.json
```

## What changed

Step 44D removes invalid permanent side-card / inline editor architecture from five affected surfaces.

### Positions
- `/admin/positions` remains P02.
- Create/Edit uses `INNODialog`.
- No permanent master-detail/editor panel remains.

### Users
- `/admin/users` is list-only.
- Added `/admin/users/new`.
- Added `/admin/users/:userId/edit`.
- `/admin/users/:userId` is read-only P03 detail.

### Access Scopes
- `/admin/access-scopes` is list + evaluation only.
- Added `/admin/access-scopes/:assignmentId/edit`.
- Step 44C `INNOTreeGrid` moved into the dedicated edit route.

### Contracts
- `/assets/contracts` is list-only.
- Added `/assets/contracts/:contractId`.
- Added `/assets/contracts/:contractId/edit`.
- Contract detail is read-only P03.
- Contract edit is P04 with canonical editor footer.
- No backend detail endpoint was added; the frontend lookup adapter reuses the existing paginated contracts API.

### Custom Fields
- `/assets/custom-fields` is a settings/list surface.
- Add/Edit uses `INNODialog`.
- Old inline editor-row architecture is removed.

## Current route matrix

Concrete Production routes: **56**

```text
P01 4
P02 17
P03 7
P04 7
P05 7
P06 1
P07 2
P08 2
P09 6
P10 3
```

## Step 44A gap status

```text
step44a_reported_gap_classes=9
step44a_current_gap_classes=4
```

Remediated through 44D:
- permanent side-card form/detail architecture,
- editor footer floating-card ownership,
- explanatory state misuse,
- spacing ownership,
- Tree / TreeGrid missing.

Still present:
- row-action inconsistency,
- hero illustration parity,
- Workflow Canvas missing,
- Assets User Profiles / Ownership IA ambiguity.

## QA

Dedicated static:

```text
step44d_checks=34
step44d_failures=0
step44d_new_routes=5
step44d_remediated_surfaces=5
```

Dedicated browser:

```text
step44d_browser_checks=102
step44d_browser_failures=0
```

Regression:

```text
Step 42.2C browser = 193/193
Step 42.2D browser = 159/159
Step 42.2E browser = 250/250
Step 44B browser = 65/65
Step 44C browser = 54/54
Step 42.2G responsive = 77/77
Design System browser = 56/56
Broad Production = 56 routes / 1468 checks / 0 failures
Full static chain = 56/56 / 0 failures
```

Build:
- `@inno/ui` build PASS,
- Web Portal typecheck PASS,
- Web Portal production build PASS,
- `git diff --check` PASS,
- existing Vite chunk-size advisory only.

## Important implementation notes

- Do not move Organization / Locations away from hierarchy master-detail; those are valid P09 continuous selection/edit tasks.
- Do not move Access Scope TreeGrid back to the list route.
- Do not reintroduce User inline create/edit forms.
- Do not reintroduce Contract inline selected-record editor.
- Do not add a Contract backend detail endpoint unless API Contract work explicitly approves it.
- Custom Fields remains one schema update API; the dialog only changes interaction ownership.
- Frozen Design System V1.26 / UI Contract 1.20.0 are unchanged.

## Next

The frozen Step 44A sequence says:

**Step 44E — Visual Parity**

Expected scope:
- approved hero illustrations,
- remaining visual spacing/card/input/button/table drift,
- redundant explanatory block cleanup.

After that:
- Step 44F — Assets Information Architecture,
- Step 44G — Dynamic Workflow Foundation only when explicitly approved,
- Step 44H — Full Route Visual QA.

Do not merge to `main` or deploy unless explicitly requested.
