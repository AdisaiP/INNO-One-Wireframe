# INNO.One — Special UI Components & Diagram Strategy

Last updated: 2026-09-24

## 1. Goal

Define which UI pattern/library should be used for hierarchy, diagrams and ordered processes.

Do not solve every visual problem with a generic node canvas.

## 2. Decision table

| Need | Canonical INNO component | Recommended implementation | Use when |
| --- | --- | --- | --- |
| Simple ordered steps | `INNOStepper` | INNO.One native component | fixed 3–8 step process |
| Event history | `INNOTimeline` | INNO.One native component | immutable chronological events |
| Status progression | `INNOStatusStepper` | INNO.One native component | lifecycle/status visualization |
| Simple hierarchy | `INNOTree` | React Arborist or lightweight native tree | categories, locations, folders |
| Hierarchy + columns | `INNOTreeGrid` | TanStack Table expanding rows | org/device/asset hierarchy with data columns |
| Very large enterprise tree grid | `INNOEnterpriseTreeGrid` | AG Grid Tree Data | only when advanced enterprise grid features justify license |
| Organization hierarchy | `INNOOrgChart` | d3-org-chart | reporting line / org structure |
| Editable branching workflow | `INNOWorkflowCanvas` | React Flow + ELK.js | conditions, routing, parallel paths |
| Standards-based BPMN | `INNOBpmnDesigner` | bpmn-js | only when BPMN 2.0 import/export/notation is a requirement |

## 3. Fixed sequence: INNOStepper

Use for a known sequence with a small number of stages.

Examples:
- agent deployment,
- QR label generation,
- onboarding,
- approval wizard,
- setup/configuration.

Good:
```text
Select Target → Configure → Review → Run
```

Do not use React Flow for a fixed sequence.

Minimum states:
- pending,
- current,
- complete,
- blocked,
- optional,
- error.

## 4. History: INNOTimeline

Use when the user needs to understand what already happened.

Examples:
- ticket history,
- asset ownership history,
- remote session audit,
- deployment execution history.

A Timeline is not a workflow editor.

Minimum event model:
```text
id
timestamp
actor
eventType
title
description
metadata
severity
```

## 5. Status progression: INNOStatusStepper

Use to explain current lifecycle state, not chronological history.

Examples:
```text
Open → In Progress → Resolved → Closed
```

Rules:
- show current state,
- show allowed next state where useful,
- do not imply a state was completed if history does not prove it.

## 6. Simple tree: INNOTree

Recommended runtime implementation: **React Arborist** when the tree needs virtualization, keyboard navigation, selection, rename or drag/drop.

Use for:
- Category / Subcategory administration,
- Organization unit picker,
- Location hierarchy,
- File/folder-like structures,
- nested policy targets.

Do not add columns to this component. If the user needs several columns, use TreeGrid instead.

Prototype implementation can remain plain HTML/CSS; runtime library is chosen when the React application is implemented.

## 7. TreeGrid: INNOTreeGrid

Default recommendation: **TanStack Table** with expandable hierarchical rows.

Use for:
- Organization + owner + device counts,
- hierarchical assets,
- grouped inventory,
- policy assignment hierarchy.

Why this is the default:
- keeps rendering/styling under INNO.One control,
- supports expandable row hierarchy,
- does not force a separate visual design system.

Use **AG Grid Tree Data** only when requirements include multiple heavy grid capabilities such as:
- very large virtualized datasets,
- advanced grouping/pivoting,
- Excel-like behavior,
- complex column tooling,
- enterprise support that justifies commercial licensing.

Do not use AG Grid by default merely to render a hierarchy.

## 8. Organization chart: INNOOrgChart

Recommended implementation: **d3-org-chart**.

Use only for actual reporting/organizational relationships.

Example:
```text
CEO
 ├─ IT Director
 │   ├─ Infrastructure
 │   └─ Development
 └─ Finance Director
```

Expected controls:
- expand/collapse,
- search person/unit,
- fit to screen,
- zoom/pan,
- center selected node,
- optional compact/horizontal layout.

Do not use Org Chart for Category trees or workflow.

## 9. Editable workflow: INNOWorkflowCanvas

Recommended implementation:
```text
React Flow (@xyflow/react)
        +
ELK.js auto layout
```

Use for INNO.One Dynamic Workflow:
- trigger,
- condition,
- assignment,
- approval,
- SLA/escalation,
- AI classification,
- notification,
- parallel branches,
- join/end nodes.

React Flow owns interactive node/edge editing.
ELK.js computes automatic node positions; it is not the workflow editor itself.

Suggested node contract:
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

Suggested editor layout:
```text
┌ Node Palette ┐ ┌──────── Canvas ────────┐ ┌ Properties ┐
│ Trigger      │ │                        │ │ selected    │
│ Condition    │ │   nodes + edges        │ │ node form   │
│ Action       │ │                        │ │ validation  │
└──────────────┘ └────────────────────────┘ └────────────┘
```

## 10. BPMN: INNOBpmnDesigner

Use **bpmn-js** only when the product requirement explicitly needs BPMN 2.0 semantics/notation or import/export.

Do not choose BPMN merely because a screen contains a flow.

For INNO.One's custom Helpdesk/Dynamic Workflow builder, React Flow is the preferred starting point because product-specific nodes and UX are more important than BPMN notation.

## 11. Component selection rules

Ask these questions in order:

1. Is it historical? → Timeline.
2. Is it a fixed ordered sequence? → Stepper.
3. Is it current lifecycle status? → Status Stepper.
4. Is it nested data only? → Tree.
5. Is it nested data with columns? → TreeGrid.
6. Is it reporting structure? → Org Chart.
7. Is it an editable branching process? → Workflow Canvas.
8. Must it comply with BPMN 2.0 notation/import/export? → BPMN Designer.

## 12. Prototype vs production

Current HTML prototype:
- should visually prove the right interaction pattern,
- should not embed large framework libraries just for mockup fidelity.

Production React implementation:
- wraps third-party libraries behind INNO components,
- third-party class names must not become app-level contracts,
- INNO tokens own typography, color, spacing and states,
- domain data models remain independent from the visual library.

## 13. Recommended package map for future React implementation

```text
@xyflow/react        → INNOWorkflowCanvas
elkjs                → workflow auto-layout service
d3-org-chart         → INNOOrgChart
@tanstack/react-table→ INNOTreeGrid
react-arborist       → INNOTree
bpmn-js              → INNOBpmnDesigner (conditional)
ag-grid-react        → Enterprise TreeGrid only when justified
```

## 14. Avoid

- React Flow for a static 4-step wizard.
- Org Chart for generic nested menus.
- TreeGrid when a simple Tree is enough.
- BPMN symbols for users who do not work with BPMN.
- AG Grid Enterprise solely because a table has expandable rows.
- handcrafted SVG graph layout when a proven layout engine already solves it.

## 15. Verified implementation references

- React Flow: https://reactflow.dev/ — node-based editor, MIT licensed, built-in drag/zoom/pan/selection.
- ELK.js: https://github.com/kieler/elkjs — automatic graph layout engine; computes positions, not the editor itself.
- bpmn-js: https://bpmn.io/toolkit/bpmn-js/ — BPMN 2.0 viewer/modeler.
- TanStack Table: https://tanstack.com/table/latest/docs/ — expandable hierarchical rows for TreeGrid-style layouts.
- React Arborist: https://github.com/jameskerr/react-arborist — virtualized React tree with keyboard navigation, filtering and drag/drop.
- d3-org-chart: https://github.com/bumbeishvili/org-chart — organization-chart interactions such as expand/collapse, zoom and fit-to-screen.
- AG Grid Tree Data: https://www.ag-grid.com/react-data-grid/tree-data/ — enterprise Tree Data; use only when the paid/enterprise feature set is justified.

Package selection must be revalidated during production implementation for exact version, licensing and security posture.
