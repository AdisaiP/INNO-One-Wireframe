# INNO.One — Step 44G Dynamic Workflow Foundation

**Status:** COMPLETE
**Branch:** `ux/step44g-dynamic-workflow-foundation`
**Base:** `95d8eed refactor: clarify asset ownership information architecture`
**Scope:** Shared branching workflow canvas foundation
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## Goal

Close the final Step 44A interaction-architecture gap by implementing the frozen `INNOWorkflowCanvas` contract for real branching workflows.

This step intentionally does not add a Dynamic Workflow product route, backend persistence, or an execution engine.

Existing Helpdesk Automation remains the focused P04 Trigger → Condition → Action editor.
## Shared implementation

Production now includes:

```text
@inno/ui/workflow
@inno/ui/workflow.css
```

The shared component uses:
- `@xyflow/react` 12.12.0 for editable graph interaction,
- ELK.js 0.12.0 for layered automatic layout,
- the browser-bundled ELK entry so Vite does not depend on the Node `web-worker` adapter.

The workflow package is exposed as a dedicated subpath rather than the `@inno/ui` root so normal product routes do not load React Flow / ELK.
### Canonical node kinds

```text
Trigger
Action
Condition
Branch
Approval
Assignment
Wait
Notification
AI
Subflow
End
```

`INNOWorkflowCanvas` supports:
- controlled node selection,
- drag / connect / delete,
- pan / zoom / fit view,
- horizontal or vertical ELK layout,
- read-only mode,
- optional layout metadata callback,
- warning / error validation state,
- accessible canvas and focusable graph elements.
## Data boundaries

### Persisted definition

Persist the INNO.One workflow contract, not React Flow internal objects:

```text
schemaVersion
id
version
name
nodes[]
edges[]
business configuration
```

Node coordinates are optional view metadata. ELK may regenerate layout without changing workflow meaning.

### Execution

Runtime execution is a separate snapshot keyed by workflow ID + workflow version:

```text
runId
status
activeNodeIds
completedNodeIds
failedNodeId
```

The canvas edits definitions; it does not execute workflow runs.
## Design System proof

Internal Design System now contains a live **Dynamic Workflow** P06 builder example with:
- Node Palette,
- branching React Flow canvas,
- node Properties panel,
- approval validation state,
- live selection and node creation,
- persistence / layout / execution boundary guidance.

Responsive behavior:
- 1366: Palette | Canvas | Properties,
- 1024: Palette + Canvas, Properties below,
- 768: horizontal palette, full-width Canvas, Properties below.

The Design System contextual navigation now exposes **Workflow Canvas**.
## Bundle ownership

An initial root export pulled React Flow + ELK into every product route and increased the main JS bundle to about 2.33 MB.

The final implementation isolates workflow to `@inno/ui/workflow`.

Final production build:

```text
main JS: 678.70 kB pre-gzip / 177.43 kB gzip
main CSS: 99.69 kB pre-gzip / 17.14 kB gzip
lazy Internal Design System JS: 1,683.64 kB / 515.03 kB gzip
```

The normal application bundle therefore remains effectively at the pre-44G baseline. The existing Vite chunk-size advisory remains, and the large workflow engine is confined to the lazy internal Design System route until a real workflow product surface is introduced.
## QA

```text
Step 44G static = 46/46
Step 44G browser = 35/35
Step 44G screenshots = 2
Design System browser = 56/56
Step 44A architecture = 50/50
Step 44A current gap classes = 0
Broad Production = 56 routes / 1477 checks / 0 failures
```

Regression static:
- Step 44B = 65/65
- Step 44C = 40/40
- Step 44D = 34/34
- Step 44E = 35/35
- Step 44F = 24/24

Build:
- `@inno/ui` PASS
- Web Portal typecheck PASS
- Web Portal production build PASS
- `git diff --check` PASS
## Architecture state after Step 44G

All nine Step 44A reported gap classes are now remediated.

Production concrete route count remains **56**.

No backend/API/data-model migration was introduced.

## Next

**Step 44H — Full Route Visual QA / final freeze**

Step 44H should validate the complete Production route set at 1366 / 1024 / 768 and freeze the post-44A remediation baseline.
