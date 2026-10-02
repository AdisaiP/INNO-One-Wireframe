# INNO.One — Step 44A Screen Interaction Architecture Audit

**Status:** COMPLETE — architecture decisions frozen for remediation
**Branch:** `ux/step44a-screen-interaction-architecture`
**Base:** `bdf3cca feat: implement inventory query`
**Scope:** Production Web Portal interaction architecture
**Concrete Production routes reviewed:** 56
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

All 56 concrete Production routes are now classified.

| Pattern | Routes |
| --- | ---: |
| P01 Overview | 4 |
| P02 List | 17 |
| P03 Resource Detail | 7 |
| P04 Create/Edit | 7 |
| P05 Settings | 7 |
| P06 Builder | 1 |
| P07 Monitor/Operations | 2 |
| P08 Wizard | 2 |
| P09 Master-Detail | 6 |
| P10 History/Log | 3 |

Remediation priority:

| Priority | Routes |
| --- | ---: |
| Critical | 7 |
| High | 13 |
| Medium | 18 |
| Low | 18 |

## Critical architecture corrections

### Organization Structure

Current Production:
- flat table,
- `Select` row action,
- permanent side editor.

Target:
- P09 hierarchy master-detail,
- real `INNOTree` hierarchy interaction,
- selected hierarchy node owns the adjacent editor.

The adjacent editor is valid here because selecting a hierarchy node and editing that exact node are one continuous task.

### Locations

Same correction as Organization Structure:
- P09,
- real hierarchy tree,
- not a flat table pretending to be hierarchy.

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
- Organization / Locations → hierarchy master-detail remains, but with Tree.
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
- restore approved hero illustrations,
- normalize card/input/button/table spacing,
- remove redundant explanatory state blocks.

### Step 44F — Assets Information Architecture
Rename/restructure ownership navigation so it does not duplicate Admin Users.

### Step 44G — Dynamic Workflow Foundation
Only when explicitly approved:
- `INNOWorkflowCanvas`,
- React Flow,
- ELK.js,
- node/edge contract,
- persistence/execution contract.

### Step 44H — Full Route Visual QA
- 56 routes,
- 1366 / 1024 / 768,
- architecture assertions,
- interaction assertions,
- screenshot/contact-sheet review,
- build/typecheck/regression freeze.

## Step 44A QA

```text
step44a_routes=56
step44a_reported_gap_classes=9
step44a_checks=50
step44a_failures=0
```

Step 44A changes architecture documentation/audit only. It intentionally does not pretend the Product UI is already remediated.

The first Production code remediation begins in Step 44B.
