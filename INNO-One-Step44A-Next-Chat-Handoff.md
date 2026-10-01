# INNO.One — Step 44A Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step44a-screen-interaction-architecture`
**Base:** `bdf3cca feat: implement inventory query`
**Scope:** Production Screen Interaction Architecture Audit
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## What Step 44A changed

Step 44A does not visually patch pages yet. It freezes the correct interaction architecture first so later remediation cannot simply make the wrong pattern look cleaner.

New source of truth:

- `INNO-One-Step44A-Screen-Interaction-Architecture.md`
- `inno-step44a-screen-interaction-matrix.json`
- `step44a-screen-interaction-architecture-audit.py`

`INNO-One-Screen-Architecture-Refactor-Plan.md` now includes the Step 44A Production checkpoint.

## Coverage

All 51 concrete Production React routes are classified.

```text
P01=4
P02=17
P03=6
P04=3
P05=7
P06=1
P07=2
P08=2
P09=6
P10=3
```

Priority:

```text
critical=4
high=11
medium=18
low=18
```

Critical routes:

- `/admin/organization`
- `/admin/locations`
- `/admin/access-scopes`
- `/assets/contracts`

## Nine confirmed Production gap classes

The Step 44A audit detects all nine classes directly from current source:

1. incorrect/permanent side-card form/detail use;
2. editor footer visually behaving like a separate floating card;
3. `INNOState` used for passive explanation;
4. inconsistent row action semantics/presentation;
5. page-local spacing drift;
6. hero illustration migration gap;
7. missing Production `INNOWorkflowCanvas` / React Flow foundation;
8. missing Production `INNOTree` / `INNOTreeGrid` wrappers;
9. Assets `User Profiles` information-architecture ambiguity.

Dedicated audit:

```text
step44a_routes=51
step44a_reported_gap_classes=9
step44a_checks=60
step44a_failures=0
```

## Frozen architecture decisions

### Organization / Locations

Target:
- P09 hierarchy master-detail,
- real hierarchy control,
- selected hierarchy node may own adjacent editor because selection + edit is one task.

Do not keep the current flat table as the hierarchy surface.

### Positions

Target:
- P02 list,
- Create/Edit in a focused dialog/modal.

Three-field form does not justify a permanent side editor.

### Users

Target:
- P02 list,
- P03 detail,
- P04 create/edit when profile editing is complex.

### Access Scopes

Target:
- P02 assignment list,
- P04 assignment editor,
- `INNOTreeGrid` scope browser,
- effective access may use a read-only drawer,
- access evaluation remains a focused utility.

### Contracts & Warranty

Target:
- P02 list,
- P03 detail,
- P04 edit.

Current large inline/permanent record editor must be split.

### Integrations

Target:
- P07 health monitor.

The `Configuration remains deployment-managed` message is passive policy context and must not be rendered with `INNOState`.

### Helpdesk Automation vs Dynamic Workflow

Current simple Trigger → Condition → Action rule editor remains P04.

Do not add React Flow merely to beautify it.

Real branching Dynamic Workflow is a separate future P06 capability using:

```text
INNOWorkflowCanvas
@xyflow/react
ELK.js
```

only after branching workflow scope is explicitly approved.

### Assets people information architecture

Identity administration:

```text
Admin Center > Users
```

Asset ownership people data:

```text
Assets > Ownership > Asset Owners / Ownership Profiles
```

Assets must not appear to be a second generic user-management module.

## Step 44B next

**Step 44B — Shared Interaction Foundations**

Implement shared Product primitives before page-by-page refactors:

1. `INNORowActions`
2. Dialog/Drawer foundations suitable for compact CRUD / contextual inspection
3. integrated editor action bar replacing floating-card appearance
4. Purpose Note / Info Callout for passive explanations
5. spacing ownership/tokens for cards, forms, inputs, buttons, table cells

Then use those foundations in Step 44C+.

## Later sequence

- 44C Hierarchy Component Parity — `INNOTree` / `INNOTreeGrid`
- 44D Form / Detail Route Remediation
- 44E Visual Parity / Illustrations / spacing
- 44F Assets Information Architecture
- 44G Dynamic Workflow Foundation only if explicitly approved
- 44H Full Route Visual QA

Do not merge to `main` or deploy unless explicitly requested.
