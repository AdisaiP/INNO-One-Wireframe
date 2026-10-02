# INNO.One — Step 44C Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step44c-hierarchy-component-parity`
**Base:** `d2658e1 refactor: add shared interaction foundations`
**Scope:** Hierarchy Component Parity
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## What Step 44C implemented

Production now has native shared hierarchy primitives in `@inno/ui`:

- `INNOTree`
- `INNOTreeGrid`
- shared flat-parent hierarchy builder
- shared expandable-node discovery

The implementation is native INNO.One code. Step 44C intentionally adds **no Tree/Grid vendor dependency**.
## Production implementation decision

The earlier Step 44A library direction was intentionally superseded after review.

Current decision:

- `INNOTree` -> native controlled React component in `@inno/ui`
- `INNOTreeGrid` -> native controlled React component in `@inno/ui`
- `INNOOrgChart` -> remains a future specialized component; d3-org-chart is still a candidate
- `INNOWorkflowCanvas` -> remains separate future work; React Flow + ELK only when branching workflow scope is approved

No dependency was added for:

- TanStack Table
- React Arborist
- AG Grid
- Syncfusion
- RSuite Table
- ka-table

The frozen V1.26 component names and interaction contract remain unchanged.
## INNOTree behavior

`INNOTree` supports:

- parentId hierarchy construction
- canonical root -> child traversal
- expand / collapse
- selected node state
- search context that preserves matching ancestors and descendants
- roving tabindex
- Arrow Up / Down
- Arrow Left / Right
- Home / End
- Enter / Space selection
- `role=tree/treeitem`
- `aria-level`
- `aria-expanded`
- `aria-selected`

Malformed/disconnected hierarchy data is not guessed into new roots after a branch is collapsed.

## INNOTreeGrid behavior

`INNOTreeGrid` adds hierarchy behavior to tabular metadata:

- configurable data columns
- expandable hierarchical rows
- selected row semantics
- the same hierarchy keyboard model
- `role=treegrid/row`
- `aria-level`
- `aria-expanded`
- `aria-selected`
- row/column counts
- local horizontal overflow ownership on narrow viewports
## Product migrations

### Organization Structure

`AdminHierarchyPage` no longer renders Organization as a flat table with a Select action.

It now uses `INNOTree`:

- search feeds the hierarchy directly
- hierarchy selection owns the current record
- the existing detail editor consumes that selected record
- status remains visible as node metadata

### Locations

Locations uses the same `INNOTree` contract.

The current live seed contains only one location root, so the live Locations page has no expandable child to exercise. The shared component behavior is covered by Organization, the Design System sample and dedicated browser QA.

### Access Scopes

Access Scopes now has a real `INNOTreeGrid` Scope Browser for Organization and Location scopes.

The browser:

- uses canonical Organization / Location hierarchy data
- supports search
- shows Resource / Code / Status
- selects `resourceId` directly
- respects `canManage`
- keeps narrow horizontal overflow inside the TreeGrid surface

The old flat Resource select for Organization/Location scope was removed and replaced with a selected-resource summary.
## Design System

Internal Design System hierarchy examples now render the real shared primitives:

- live `INNOTree`
- live `INNOTreeGrid`

The previous fake tree/treegrid markup and page-local CSS were removed.

The implementation map explicitly records:

> Native INNOTree / INNOTreeGrid in @inno/ui; no Tree/Grid vendor dependency.

## Step 44A gap status

Step 44A still models all original 9 issue classes.

After Step 44C:

```text
step44a_reported_gap_classes=9
step44a_current_gap_classes=5
```

Tree / TreeGrid missing is now **REMEDIATED**.

Remaining gap classes:

- permanent side-card form/detail architecture
- legacy row-action inconsistency
- hero illustration parity
- Workflow Canvas missing
- Assets User Profiles IA ambiguity
## QA

Dedicated static:

```text
step44c_checks=40
step44c_failures=0
step44c_hierarchy_vendor_dependencies=0
step44c_product_tree_routes=2
step44c_product_treegrid_routes=1
```

Step 44A regression:

```text
step44a_checks=51
step44a_failures=0
step44a_current_gap_classes=5
```

Dedicated browser:

```text
step44c_browser_checks=63
step44c_browser_failures=0
step44c_browser_screenshots=10
```

The screenshots were generated and visually inspected during QA. The evidence directory is intentionally regenerable/ignored and may be cleaned to preserve disk space.
## Regression gates

```text
Step 44B browser = 65/65
Step 42.2G responsive = 77/77
Design System browser = 56/56
Broad Production = 51 routes / 1366 checks / 0 failures
Full static chain = 55/55 / 0 failures
```

Build:

- `@inno/ui` build PASS
- Web Portal typecheck PASS
- Web Portal production build PASS
- `git diff --check` PASS
- only the existing Vite chunk-size advisory remains

One first-pass Step 44B browser assertion read row-action initial focus one render tick too early. Immediate rerun passed 65/65, while Arrow navigation, Escape and focus restoration had already passed in the first run.

The historical Step 42.2C list audit was updated only for the superseding Step 44C hierarchy contract: Organization/Locations now use `INNOTree` selection instead of requiring a table Action column. Its primary-table rules remain unchanged for all other pages.
## Runtime / disk notes

Browser QA used the existing authenticated Chrome CDP environment.

The local Platform API was restored on port 5080 with process-level development overrides only; no runtime override was written into product configuration.

The C: drive again became nearly full during QA artifact generation. Cleanup was limited to ignored/regenerable `qa-*` directories. The tracked `qa-final-visual` baseline was not deleted.

## Next

**Step 44D — Form / Detail Route Remediation**

Expected focus:

- Positions
- Users create/edit
- Access Scopes assignment editor
- Contracts
- Custom Fields
- remaining affected permanent master-detail / side-card editor architecture

Step 44C does **not** claim that Access Scopes' current permanent side editor is final; TreeGrid parity is complete, while form/detail route architecture belongs to Step 44D.

Do not merge to `main` or deploy unless explicitly requested.
