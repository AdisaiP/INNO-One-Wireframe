# INNO.One — Step 45B Dynamic Workflow Product IA + UI Routes

**Status:** COMPLETE  
**Branch:** `ux/step45b-dynamic-workflow-product-ia`  
**Base:** `7adddae docs: freeze production gap roadmap`  
**Frozen Design System:** V1.26  
**Frozen UI Contract:** 1.20.0  
**Current route definitions:** 64

## Goal

Turn the Step 44G React Flow + ELK foundation into an honest Product IA preview without introducing Workflow persistence or execution before Step 45C/45D.

## Product routes

```text
/workflows                  P02 Workflow list
/workflows/new              P06 New Workflow builder
/workflows/:workflowId      P06 Session Draft builder
```

The builder reuses `@inno/ui/workflow` and `INNOWorkflowCanvas`; no second canvas implementation exists.

## Step 45B session model

Step 45B intentionally has no Workflow backend.

`WorkflowDraftContext` keeps drafts in React memory only:
- no API client,
- no fetch,
- no localStorage/sessionStorage/indexedDB,
- refresh clears the draft.

UI language is explicit:
- **Session draft**
- **Keep in Session**
- **Update Session Draft**
- no Publish,
- no Run,
- no fake server save,
- no run history.

Missing session IDs render an honest unavailable state.

## P06 builder

The Product builder owns:
- Node Palette,
- Workflow Canvas,
- Properties,
- workflow name,
- selected node label/description,
- connect/delete,
- ELK layout metadata,
- horizontal/vertical layout,
- structural validation.

Starter definition:

```text
Workflow starts -> Choose an action -> Workflow complete
```

Structural checks cover:
- exactly one Trigger,
- at least one End,
- disconnected incoming/outgoing paths.

## Availability / module contract

`production/module-manifests.json` now declares:

```text
id: workflows
route: /workflows
launcher: false
entryPermission: workflows.view
permissions:
  workflows.view
  workflows.manage
dependency:
  platform
```

The module is **not installed in the development seed**.

Normal Apps launcher and global rail therefore remain unchanged.

For Step 45B only, direct Product routes use `admin.apps.view` as an explicit preview gate. Dedicated `workflows.*` permission provisioning begins with persisted Workflow resources in Step 45C.

## Helpdesk boundary

Helpdesk Automation remains a separate P04 Trigger -> Condition -> Action editor.

It does not import or render `INNOWorkflowCanvas`.

## Bundle isolation

Workflow engine remains a lazy subpath dependency.

Current production output includes approximately:
- main JS: 698 KB,
- WorkflowBuilderPage wrapper: 8 KB,
- workflow React Flow + ELK chunk: 1.64 MB.

The heavy workflow engine does not move into the initial Product bundle.

## Responsive behavior

Visual review passed at:
- 1366: palette | canvas | properties,
- 1024: canvas remains primary; properties move below,
- 768: compact palette grid, full-width canvas, properties below.

No page-level horizontal overflow was observed.

## QA

Dedicated static:

```text
step45b_checks=66
step45b_failures=0
```

Dedicated browser:

```text
step45b_browser_checks=84
step45b_browser_failures=0
step45b_browser_screenshots=9
```

Broad Production:

```text
step42_routes=62
step42_browser_checks=1628
step42_browser_failures=0
```

Design System:

```text
step42_2_design_system_checks=56
step42_2_design_system_failures=0
```

Other gates:
- Step 30 module/plugin contract = issues 0,
- current Step 44A matrix = 64 routes / 108 checks / 0 fail / current gaps 0,
- full .NET solution build = PASS / 0 warnings / 0 errors,
- `@inno/ui` build PASS,
- Web typecheck PASS,
- Web production build PASS,
- `git diff --check` PASS.

## Next

**Step 45C — Dynamic Workflow Persistence & Versioning**

Step 45C should replace session drafts with persisted INNO.One workflow definitions, versioning, optimistic concurrency, CRUD API and audit events.

Do not add execution/run history until Step 45D.
