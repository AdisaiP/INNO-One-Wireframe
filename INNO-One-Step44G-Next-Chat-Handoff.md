# INNO.One — Step 44G Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step44g-dynamic-workflow-foundation`
**Base:** `95d8eed refactor: clarify asset ownership information architecture`
**Scope:** Dynamic Workflow Foundation
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## Read first

```text
INNO-One-Step44G-Dynamic-Workflow-Foundation.md
INNO-One-Step44A-Screen-Interaction-Architecture.md
inno-step44a-screen-interaction-matrix.json
```

## Completed in Step 44G

Shared workflow foundation:
- `@inno/ui/workflow`
- `@inno/ui/workflow.css`
- React Flow interaction
- ELK.js automatic layout
Public INNO.One contracts:
- `INNOWorkflowNodeKind`
- `INNOWorkflowNode`
- `INNOWorkflowEdge`
- `INNOWorkflowValidationIssue`
- `INNOWorkflowDefinition`
- `INNOWorkflowExecutionSnapshot`
- `INNOWorkflowCanvasProps`
- `INNOWorkflowCanvas`

The public contract is independent from React Flow internal Node / Edge objects.

Canonical node kinds:
Trigger, Action, Condition, Branch, Approval, Assignment, Wait, Notification, AI, Subflow, End.
## Important boundaries

Do not replace the existing Helpdesk simple rule editor with React Flow.

Current Helpdesk Automation remains:

```text
Trigger → Condition → Action
P04 Create / Edit
```

Use `INNOWorkflowCanvas` only for true branching P06 workflow builders.

Step 44G does not implement:
- workflow backend persistence,
- workflow execution engine,
- scheduler / worker runtime,
- Dynamic Workflow product navigation,
- a product workflow route.
Persistence boundary:
- persist INNO workflow definitions,
- optional layout coordinates are view metadata,
- do not persist React Flow internal objects.

Execution boundary:
- workflow runtime state is a separate execution snapshot,
- key runs by workflow ID + definition version,
- canvas does not execute runs.

## Design System

Internal Design System now has a live **Dynamic Workflow** section:
- palette,
- branching canvas,
- properties panel,
- validation state,
- responsive behavior at 1366 / 1024 / 768.

Workflow dependencies are isolated behind the lazy `@inno/ui/workflow` subpath so normal product pages do not load React Flow / ELK.
## QA

```text
Step 44G static = 46/46
Step 44G browser = 35/35
Design System browser = 56/56
Step 44A = 50/50
Step 44A current gap classes = 0
Broad Production = 56 routes / 1477 checks / 0 failures

Step 44B static = 65/65
Step 44C static = 40/40
Step 44D static = 34/34
Step 44E static = 35/35
Step 44F static = 24/24
```

Build:
- `@inno/ui` PASS
- Web typecheck PASS
- Web production build PASS
- `git diff --check` PASS
Final main app bundle remains near the pre-44G baseline:

```text
main JS = 678.70 kB / 177.43 kB gzip
main CSS = 99.69 kB / 17.14 kB gzip
```

The workflow engine lives in the lazy Internal Design System chunk until a real product workflow route is introduced.

## Architecture state

Step 44A gap classes:

```text
reported = 9
current = 0
```

All reported Step 44A architecture gaps are now remediated.

Production concrete routes remain **56**.
## Next

**Step 44H — Full Route Visual QA / final freeze**

Scope:
- all 56 concrete Production routes,
- 1366 / 1024 / 768,
- architecture + interaction assertions,
- screenshot/contact-sheet review,
- build/typecheck/regression freeze,
- establish the final post-Step44A visual baseline.

Do not start a new Dynamic Workflow backend/product module as part of Step 44H.
