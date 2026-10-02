# INNO.One — Step 44H-A Page Architecture & Spacing Remediation

**Status:** COMPLETE  
**Branch:** `ux/step44h-a-page-architecture-spacing`  
**Base:** `f0b373b feat: add dynamic workflow foundation`  
**Frozen Design System:** V1.26  
**Frozen UI Contract:** 1.20.0  
**Production routes:** 56

## Goal

Revise page architecture decisions that were technically permitted by Step 44A but did not read well in the final Production UI, then normalize the spacing/panel ownership issues found during visual review.

This step does not add backend APIs, database schema, permissions, or product modules.
## Architecture revisions

### Organization Structure / Locations

Previous:
- P09 permanent hierarchy master-detail
- tree left, editor card always reserved on the right

Now:
- P02 hierarchy list + focused drawer
- `INNOTree` owns the full collection width
- selecting a hierarchy node opens `INNODrawer`
- New Unit / New Location opens the same focused editor drawer
- hierarchy remains visible behind the drawer

The shared `INNOTree` now renders visible connector lines for nested levels instead of relying on indentation alone.

### Audit Log

Audit Log now follows the original P10 decision:
- history table is the primary surface
- Open shows immutable audit detail in `INNODrawer`
- the permanent right-side Audit Detail panel is removed
### Software Licenses

Previous:
- list plus permanent selected-license detail/editor below the collection

Now:
- P02 primary license-product list
- row action is **Open**
- allocations and the short License Record editor open in a focused `INNODrawer`
- no product is auto-selected on initial load

No license-detail route or backend contract was invented.

### Roles & Permissions

The current API exposes a read-only role catalog only.

Production therefore:
- keeps Role catalog and Permission matrix as separate stacked surfaces
- adds a lightweight note explaining that system roles are read-only
- does not expose fake New Role / Create Role controls
- states that custom role creation and permission editing require a future API contract

Current development data still contains four platform roles:
Platform Admin, Device Viewer, Support Agent, Employee.
### Access Scopes

Access Assignments remains the page's primary job.

`Evaluate Access` is now a page-header utility action that opens an `INNODialog` with:
- User
- Permission
- effective access result

Assignment editing remains on its dedicated P04 route.

No Create Assignment control was added because the current API does not expose creation.

### Inventory Query

The page is now more builder-centric:
- Saved Queries remains the supporting left rail on wide screens
- standalone Fact coverage card is removed
- available fact-source guidance is a lightweight note inside the builder
- New Query belongs to the builder header
- Run Query remains the primary footer command
- the current POST-only save contract is explicit
- opening a saved query exposes **Save as New**, not a misleading update action
## Spacing remediations

### Asset detail
- Current owner read-only content now owns normal horizontal panel-body padding
- Linked managed endpoint uses the same body-spacing contract

### QR Labels
- Label setup editor receives full bottom panel padding
- Visible label content no longer appears pinned to the card edge

### Asset Ownership
- Assets now uses a domain-neutral ownership overview grid instead of the Helpdesk-specific class
- the overview grid has a 16px section gap before Recent ownership changes
- it remains two columns on desktop and stacks at 1024 / 768

## Step 44A matrix after revision

```text
Production routes = 56
P01 = 4
P02 = 21
P03 = 7
P04 = 7
P05 = 7
P06 = 1
P07 = 2
P08 = 2
P09 = 2
P10 = 3

reported gap classes = 9
current gap classes = 0
```
## QA

Dedicated H-A static audit:

```text
step44h_a_checks=40
step44h_a_failures=0
```

Dedicated H-A browser QA at 1366 / 1024 / 768:

```text
step44h_a_browser_checks=143
step44h_a_browser_failures=0
step44h_a_browser_screenshots=20
```

Broad Production regression:

```text
step42_routes=56
step42_browser_checks=1477
step42_browser_failures=0
```

Internal Design System regression:

```text
step42_2_design_system_checks=56
step42_2_design_system_failures=0
```
Static regression:
- Step 44A = 50/50, current gaps = 0
- Step 44B = 65/65
- Step 44C = 40/40
- Step 44D = 34/34
- Step 44E = 35/35
- Step 44F = 24/24
- Step 44G = 46/46
- Step 44H-A = 40/40

Build:
- `@inno/ui` build PASS
- Web Portal typecheck PASS
- Web Portal production build PASS
- main JS = 678.38 kB / 177.49 kB gzip
- main CSS = 100.70 kB / 17.34 kB gzip
- only the existing Vite chunk-size advisory remains

## Next

**Step 44H — Full Route Visual QA / Final Freeze**

Step 44H should use this H-A architecture as the new visual baseline and perform the final complete route/screenshot freeze. It should not reintroduce the permanent side editors removed here.
