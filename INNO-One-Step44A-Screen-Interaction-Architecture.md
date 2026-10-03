# INNO.One — Step 44A Screen Interaction Architecture Audit

**Status:** COMPLETE — architecture decisions frozen for remediation
**Branch:** `ux/step44a-screen-interaction-architecture`
**Base:** `bdf3cca feat: implement inventory query`
**Scope:** Production Web Portal interaction architecture
**Current Production route definitions:** 61 (Step 44H-C adds explicit Software Baseline create/detail/edit routes and Asset Edit after the 56-route H freeze)
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## Why Step 44A exists

Step 42/42.2 proved shell consistency, responsive ownership, state coverage and visual stability, but those gates did not decide whether each screen was using the correct interaction architecture.

Step 44A therefore asks a different question:

> Is this screen using the correct product interaction model for the job?

The audit explicitly distinguishes:

- dedicated route,
- modal/dialog,
- drawer,
- true master-detail,
- hierarchy tree,
- tree grid,
- resource detail,
- settings page,
- builder,
- operations monitor,
- wizard,
- history/log.

The machine-readable source of truth is:

```text
inno-step44a-screen-interaction-matrix.json
```

The enforcement audit is:

```text
step44a-screen-interaction-architecture-audit.py
```

## Route classification

All 61 current Production route definitions are now classified. The broad browser harness is prepared to cover the Workspace root `/` plus dynamic resource routes; Step 44H-C browser execution is pending because the current test infra host is unreachable.

| Pattern | Routes |
| --- | ---: |
| P01 Overview | 4 |
| P02 List / focused overlay | 23 |
| P03 Resource Detail | 9 |
| P04 Create/Edit | 10 |
| P05 Settings | 7 |
| P06 Builder | 1 |
| P07 Monitor/Operations | 2 |
| P08 Wizard | 2 |
| P09 Master-Detail | 0 |
| P10 History/Log | 3 |

Remediation priority:

| Priority | Routes |
| --- | ---: |
| Critical | 9 |
| High | 24 |
| Medium | 14 |
| Low | 14 |

## Critical architecture corrections

### Organization Structure

Current Production:
- flat table,
- `Select` row action,
- permanent side editor.

Target after Step 44H-A revision:
- P02 hierarchy list with focused drawer,
- real `INNOTree` hierarchy interaction,
- selected hierarchy node opens the short create/edit form in an `INNODrawer`,
- the hierarchy remains full-width instead of reserving a permanent editor column.

The drawer is preferred after Production visual review because the edit form is short and the permanent side editor created avoidable empty space.

### Locations

Same correction as Organization Structure:
- P02 hierarchy list + drawer,
- real hierarchy tree,
- not a flat table pretending to be hierarchy,
- no permanent editor column.

### Access Scopes

Current Production compresses list, assignment editor and evaluation into one route.

Target:
- P02 assignment list,
- P04 create/edit assignment route,
- hierarchy browser backed by `INNOTreeGrid`,
- effective-access inspection may use a read-only drawer,
- evaluation remains a focused utility.

### Contracts & Warranty

Current Production selects a contract from a table and exposes a large multi-field record editor underneath it.

Target:
- P02 contract list,
- P03 contract detail route,
- P04 contract edit route.

The form has enough fields and related asset context that a permanent side/inline editor is no longer justified.

## Form / detail surface rule

The original screen architecture rule is reaffirmed:

- 1–5 simple fields → modal/dialog or drawer is acceptable.
- 6–12 fields → dedicated create/edit route.
- multi-section or conditional form → dedicated route.
- sequential operation → P08 Wizard.
- permanent master-detail is allowed only when selection + detail/edit are one continuous job.
- read-only contextual inspection may use a drawer.

This means “put a card beside the table” is not a default pattern.

## User-reported issue decisions

### 1. Small detail/form card beside tables

Confirmed gap.

Step 44A now classifies each route instead of reusing master-detail everywhere.

Examples:
- Organization / Locations → full-width hierarchy Tree + focused drawer.
- Positions → list + focused modal.
- Users → list → detail/edit routes.
- Access Scopes → list + edit route + TreeGrid utility.
- Contracts → list → detail/edit routes.
- Custom Fields → settings list + modal.

### 2. Save button / footer placement

Confirmed visual-ownership gap.

The existing `INNOEditorFooter` is semantically correct but visually behaves like a separate rounded card in many pages.

Target:
- default = integrated action bar attached to the owning editor,
- normal document flow when untouched,
- dock only for a long dirty editor,
- docking must retain editor width,
- never look like an unrelated floating card.

### 3. Circular state icon used for explanatory sections

Confirmed misuse.

`INNOState` is reserved for actual application states:
- Empty,
- No Results,
- Loading,
- Error,
- Permission,
- Disabled,
- Offline,
- Partial Failure.

Passive policy/explanation text such as:

```text
Configuration remains deployment-managed
```

must use a lightweight Purpose Note / Info Callout or be removed when redundant.

### 4. Table row actions are inconsistent

Confirmed.

Production currently mixes:
- Select,
- Open,
- Test,
- buttons,
- links,
- page-local styling.

Target shared contract:
- `INNORowActions`,
- one common row command = one canonical compact action,
- multiple commands = More menu,
- destructive command last and separated,
- verbs are semantic: Open, Edit, Inspect, Test, Select only where the interaction genuinely differs.

### 5. Padding / margin / card / input drift

Confirmed.

The shared design system is still overridden by page-specific CSS for:
- editor footer,
- deployment,
- ticket create,
- baseline editor,
- QR and other page-local layouts.

Target:
- shared spacing tokens own card header/body/footer,
- shared input/button dimensions,
- shared table cell spacing,
- page CSS contains exceptions only.

### 6. Hero illustrations missing from Production

Confirmed.

Wireframes use hero illustrations for:
- Workspace,
- Apps,
- Assets,
- Agent Deployment,
- Knowledge Base,
- Meeting.

Production currently carries only:
- `workspace-welcome.svg`,
- `device-setup.svg`.

Step 44E restore candidates:
- Apps,
- Assets,
- Agent Deployment remains.

Knowledge Base and Meeting stay tied to their future/deferred slices.

### 7. React Flow / Workflow Engine missing

Confirmed as a production component gap, not a bug in the simple Helpdesk rule editor.

Frozen design direction remains:

```text
INNOWorkflowCanvas
  = @xyflow/react
  + ELK.js
```

Use it only for real branching workflow:
- conditions,
- parallel branches,
- approval,
- wait,
- assignment,
- notification,
- subflow.

Current Helpdesk Automation is a simple Trigger → Condition → Action editor and remains P04.

Dynamic Workflow gets its own future P06 slice in Step 44G only when branching workflow scope is explicitly approved.

### 8. TreeGrid / hierarchy component missing

Confirmed.

Frozen design contract already defines:
- `INNOTree`,
- `INNOTreeGrid`,
- `INNOOrgChart`.

But `@inno/ui` does not currently implement those production wrappers.

Target implementation decision updated by Step 44C:
- Tree → native `INNOTree` in `@inno/ui`,
- TreeGrid → native `INNOTreeGrid` in `@inno/ui`,
- OrgChart → d3-org-chart remains a future specialized component.

Step 44C intentionally adds no Tree/Grid vendor dependency. The frozen V1.26 component names and interaction contract remain unchanged.

### 9. Assets > User Profiles

Confirmed information-architecture ambiguity.

Canonical ownership boundary:

```text
Admin Center > Users
  = platform identity / organization user administration

Assets > Ownership > Asset Owners / Ownership Profiles
  = asset ownership metadata
  + owned assets
  + Agent-submitted ownership data
  + ownership-specific custom fields
```

Production must stop presenting Assets as a second generic user-management area.

## Remediation sequence

### Step 44B — Shared Interaction Foundations
Implement:
- row actions,
- dialog/drawer foundations,
- integrated editor action bar,
- Purpose Note / Info Callout,
- shared spacing ownership.

### Step 44C — Hierarchy Component Parity
Implement production:
- `INNOTree`,
- `INNOTreeGrid`,
- hierarchy keyboard/selection behavior.

Remediate:
- Organization,
- Locations,
- Access Scope hierarchy.

### Step 44D — Form / Detail Route Remediation
Refactor:
- Positions,
- Users create/edit,
- Access Scopes,
- Contracts,
- Custom Fields,
- other incorrectly permanent master-detail editors.

### Step 44E — Visual Parity
**Status: COMPLETE on `ux/step44e-visual-parity`.**

Completed:
- restored approved Apps / Assets hero illustrations while retaining Agent Deployment / Workspace,
- normalized remaining spacing ownership to shared tokens/components,
- standardized table Action columns on `INNORowActions`,
- removed redundant explanatory blocks from normal task flow.

After Step 44E, Step 44A reports **2 remaining gap classes**: Assets User Profiles IA and Workflow Canvas.

### Step 44F — Assets Information Architecture
Rename/restructure ownership navigation so it does not duplicate Admin Users.

### Step 44G — Dynamic Workflow Foundation
Only when explicitly approved:
- `INNOWorkflowCanvas`,
- React Flow,
- ELK.js,
- node/edge contract,
- persistence/execution contract.

### Step 44H-A — Page Architecture & Spacing Remediation

Post-44G Production visual review revises several earlier permissive master-detail decisions:

- Organization / Locations → full-width `INNOTree` + focused `INNODrawer`; shared tree connector lines make hierarchy depth visible.
- Audit Log → history table + read-only `INNODrawer`, matching the original P10 decision.
- Software Licenses → primary list + focused drawer for allocations and the short entitlement editor.
- Roles & Permissions → read-only system-role reference + separately spaced permission matrix; no custom-role create control until a backend contract exists.
- Access Scopes → assignments list remains primary; `Evaluate Access` is a utility dialog.
- Inventory Query → builder hierarchy and action ownership clarified; fact coverage becomes a lightweight note.
- Asset detail / QR Labels / Asset Ownership → spacing and panel-body ownership normalized.

These decisions supersede the earlier adjacent-editor allowances where noted in the route matrix.

### Step 44H — Full Route Visual QA
**Status: COMPLETE on `ux/step44h-final-visual-qa`.**

Final freeze evidence:
- 56 routes,
- 1366 / 1024 / 768,
- 168 top-of-page screenshots,
- 12 / 20 / 32 bottom screenshots at 1366 / 1024 / 768,
- architecture + interaction assertions,
- 6 contact sheets visually reviewed,
- 2462 browser checks / 0 failures,
- Design System browser 56 / 56,
- build/typecheck/static regression PASS.

No additional Production UI source change was required after Step 44H-A.

### Step 44H-B — License / Role / Query Remediation
**Status: COMPLETE on `ux/step44h-b-license-role-query-remediation`.**

Post-freeze user review intentionally supersedes three Step 44H-A decisions:

- **Software Licenses** → the product list stays P02, but Open now navigates to a dedicated P03 Software License Detail route. Detail owns **Entitlement & Renewal** plus detected allocations. The former ambiguous `License record` label is removed; its five commercial entitlement fields edit in a focused dialog.
- **Roles & Permissions** → roles are no longer a read-only reference. Existing `Role`, `Permission`, and `RolePermission` persistence is exposed through real Create/Update APIs guarded by `admin.roles.manage`. New/Edit Role uses a drawer with dynamic permission assignment and optimistic concurrency. Platform Admin retains lockout protections.
- **Inventory Query** → the builder is full width. Saved Queries becomes a utility drawer, the disabled Fact selector and dark code-preview block are removed, and the query reads as a light clause builder with Condition/Scope summary.

The route matrix after Step 44H-B was 57 route definitions; the historical Step 44H visual evidence remains the pre-H-B 56-route freeze.

### Step 44H-C — Remaining Page Architecture Cleanup
**Status: COMPLETE on `ux/step44h-c-page-architecture-cleanup`; implementation, browser verification and visual review passed.**

A second route-by-route architecture audit found and remediated the remaining embedded form/detail surfaces:

- **Software Baselines** → P02 list only, dedicated P03 detail + evaluation results, dedicated P04 create/edit routes.
- **Device Groups** → the short Create Group form opens in a dialog; group detail remains stable while Edit Group opens in a dialog.
- **Asset Detail** → read-only P03 detail; multi-section Asset/custom-field editing moves to `/assets/:assetId/edit`; Change Owner stays a separate focused dialog.
- **Ticket Detail** → two-field Reassign action opens a dialog instead of inserting an editor panel into the detail page.
- **Admin Apps** → module registry stays list-first; Inspect opens technical manifest metadata in a drawer instead of native inline `<details>`.
- **Helpdesk SLA** → explicitly reviewed and retained as P05 because policy configuration is the page's primary job; the live SLA monitor remains supporting context.

No P09 Master-Detail routes remain in the current matrix. The current matrix contains 61 route definitions.

Step 44H-C completion evidence:
- dedicated H-C browser QA = 145 checks / 0 failures / 38 screenshots,
- broad Production regression = 60 concrete routes / 1572 checks / 0 failures,
- Design System browser = 56 / 56,
- affected screenshots visually reviewed,
- Admin Apps Inspect drawer wrapping issue found during visual review, fixed, rerun and re-reviewed,
- build/typecheck/static regression PASS.

The current database has zero Software Baseline rows, so the real list empty state is tested directly while Baseline Detail/Edit visual evidence uses a browser-only fetch fixture that does not mutate Product data.

## Step 44A QA

```text
step44a_routes=61
step44a_reported_gap_classes=9
step44a_current_gap_classes=0
step44a_checks=97
step44a_failures=0
```

Step 44A changes architecture documentation/audit only. It intentionally does not pretend the Product UI is already remediated.

The first Production code remediation begins in Step 44B.
