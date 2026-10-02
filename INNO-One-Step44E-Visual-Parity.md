# INNO.One — Step 44E Visual Parity

**Status:** COMPLETE
**Branch:** `ux/step44e-visual-parity`
**Base:** `6292e28 refactor: remediate form detail route architecture`
**Scope:** Hero parity, visual spacing ownership, table action consistency, explanatory block cleanup
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## Goal

Step 44E closes the visual-consistency gaps frozen by Step 44A without changing page-pattern ownership or inventing backend capabilities.

This slice owns:
- approved hero illustrations,
- shared card/form/table spacing parity,
- consistent table Action-column presentation,
- removal of redundant implementation/policy explanation blocks from normal task flow.

It does **not** own:
- Assets ownership/user information architecture (Step 44F),
- Workflow Canvas / React Flow foundation (Step 44G),
- the final full-route visual freeze (Step 44H).

## Production changes

### Hero illustration parity

Approved wireframe illustrations are restored in Production:

- `/apps` → `apps-ecosystem.svg`
- `/assets` → `asset-inventory.svg`
- `/devices/add` continues to use `device-setup.svg`
- Workspace continues to use `workspace-welcome.svg`

Production public assets now contain all four current approved illustrations.

Knowledge Base and Meeting illustrations remain outside this slice because their product slices remain future/deferred.

### Shared Action-column parity

Page-local Action-column links/buttons were replaced with the shared `INNORowActions` contract.

A small routing adapter was added:

```text
production/apps/web-portal/src/components/RouterRowAction.tsx
```

It delegates presentation/accessibility to `INNORowActions` and owns only router navigation.

Applied across current Production collections/details including:
- Admin Users / Access Scopes / Positions / Audit,
- Asset Inventory / Owners / covered assets / Contracts,
- Devices / Device Groups / Inventory Query,
- Helpdesk Tickets / Automation,
- Software Baselines / Software Licenses,
- Asset ownership submission decisions.

The ownership-submission table now uses the canonical **Action** column with shared Confirm/Reject row actions instead of page-local inline buttons.

Production page source now has **0** legacy page-local `className="inno-row-action"` declarations; the class remains an internal shared-component DOM contract.

### Explanatory block cleanup

Redundant implementation-oriented callouts were removed from normal page flow where page/section copy already communicates the boundary.

Examples:
- Integrations: deployment-managed boundary moved into the page description instead of a standalone block.
- Business Calendar: removed “This page owns working time only” and slice-specific holiday-maintenance block.
- Branding / Platform Settings / Roles / Security: removed future-contract explanations that duplicated the visible read-only/current-state behavior.
- Automation Rule / Search / Ticket Create: removed internal-contract explanations that did not help complete the current task.
- Profile: removed unavailable-preferences roadmap copy while retaining the useful organization-managed-fields note.

Useful safety/business notes remain when they materially affect user behavior, such as Agent Deployment privacy and SLA timing semantics.

### Spacing ownership

Known Step 44A spacing gaps are now shared-token owned:
- Agent Deployment card padding uses `--ds-space-4`,
- Admin access-evaluation layout uses shared spacing tokens,
- obsolete Calendar note margin override removed,
- editor footers remain integrated surfaces with shared spacing ownership.

No Design System component API changed, so V1.26 / UI Contract 1.20.0 remain frozen.

## Step 44A gap status

After Step 44E:

```text
step44a_reported_gap_classes=9
step44a_current_gap_classes=2
```

Remediated:
- form/detail side-card misuse,
- floating editor-footer ownership,
- state used for explanation,
- row-action inconsistency,
- spacing drift,
- hero illustration parity,
- missing Tree / TreeGrid parity.

Remaining:
- `assets-user-profiles-ia` → Step 44F,
- `workflow-canvas-missing` → Step 44G.

## QA

Dedicated Step 44E static:

```text
step44e_checks=35
step44e_failures=0
```

Dedicated Step 44E browser at 1366 / 1024 / 768:

```text
step44e_browser_checks=96
step44e_browser_failures=0
step44e_browser_screenshots=10
```

Visual screenshots were inspected for:
- Apps hero,
- Assets hero,
- Agent Deployment hero/form spacing,
- Integrations cleanup,
- Business Calendar cleanup,
- shared row actions,
- desktop and 768 responsive behavior.

No page-level horizontal overflow was found on the Step 44E target surfaces.

### Regression

```text
Step 42.2C collection browser = 193/193
Step 42.2D editor/settings browser = 159/159
Step 42.2E resource detail browser = 256/256
Step 42.2G responsive browser = 77/77
Design System browser = 56/56

Step 44B static/browser = 65/65 + 68/68
Step 44C static/browser = 40/40 + 54/54
Step 44D static/browser = 34/34 + 102/102

Step 36 historical browser = 26/26
Step 38 historical browser = 52/52

Broad Production = 56 routes / 1477 checks / 0 failures
Full static chain = 57/57 / 0 failures
```

Historical Step36/38 browser harnesses now allow a CDP-port environment override so they can be rerun against the current authenticated browser without changing their legacy default ports.

### Build

- `@inno/ui` build PASS
- Web Portal typecheck PASS
- Web Portal production build PASS
- `git diff --check` PASS
- existing Vite chunk-size advisory remains (main chunk ~678.18 kB pre-gzip / ~177.30 kB gzip)

## Architecture notes

- Production still has **56 concrete routes**; Step 44E adds no route.
- No backend/API/Data Model change was made.
- Do not restore Knowledge Base or Meeting hero art until those slices resume.
- Do not reintroduce page-local Action-column markup; use `INNORowActions` or `RouterRowAction`.
- Keep real application states in `INNOState`; removing redundant Purpose Notes must not remove legitimate Empty/Error/Loading/Permission states.
- Do not move the Access Scope TreeGrid back to the list page.
- Do not change the Step 44D create/edit route ownership.

## Next frozen sequence

**Step 44F — Assets Information Architecture**
- rename/restructure Assets ownership navigation,
- remove the “User Profiles” ambiguity with Admin Users,
- preserve Assets ownership responsibilities without duplicating identity administration.

Then:
- Step 44G — Dynamic Workflow Foundation, only when explicitly approved,
- Step 44H — Full Route Visual QA / final freeze.

Do not merge to `main` or deploy unless explicitly requested.
