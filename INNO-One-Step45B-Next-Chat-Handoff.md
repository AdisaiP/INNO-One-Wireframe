# INNO.One — Step 45B Next Chat Handoff

**Status:** COMPLETE
**Branch:** ux/step45b-dynamic-workflow-product-ia
**Base:** 7adddae docs: freeze production gap roadmap
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0
**Current route definitions:** 64

## Read first

- INNO-One-Step45B-Dynamic-Workflow-Product-IA.md
- INNO-One-Step45A-Next-Chat-Handoff.md
- INNO-One-Step44G-Dynamic-Workflow-Foundation.md
- inno-step44a-screen-interaction-matrix.json

## Current Workflow Product IA

Routes: /workflows, /workflows/new, /workflows/:workflowId.
List is P02. New/edit are P06 and reuse INNOWorkflowCanvas.
Builder owns Node Palette, React Flow + ELK canvas, Properties, add/connect/delete, node label/description, orientation and structural validation.

## Important Step 45B boundary

There is still no Workflow persistence or execution.
Drafts use React memory only: no API, fetch, localStorage, sessionStorage or indexedDB. Refresh clears them.
Session IDs are not persisted Product IDs. No Publish or Run action exists.

## Module availability

Workflow manifest exists with launcher=false and it is not installed in the development seed.
Normal Apps launcher/global rail must remain free of Workflow.
Step 45B direct-route preview uses admin.apps.view.
Future permissions are declared as workflows.view and workflows.manage; Step 45C owns real provisioning and persistence semantics.

## Helpdesk boundary

Keep /helpdesk/automation/new as the simple P04 Trigger -> Condition -> Action editor. Do not replace it with React Flow.

## QA

- Step 45B static = 66/66
- Step 45B browser = 84/84, 9 screenshots
- Broad Production = 62 routes / 1628 checks / 0 failures
- Design System = 56/56
- Step 44A current = 64 routes / 108 checks / 0 failures / gaps=0
- Step 30 module/plugin = issues 0
- Full .NET build = 0 warnings / 0 errors
- UI build = PASS
- Web typecheck = PASS
- Web production build = PASS
- git diff --check = PASS

Visual review at 1366 / 1024 / 768 passed.

## Next

Start Step 45C — Dynamic Workflow Persistence & Versioning.
Scope: Workflow definition aggregate, INNO node/edge persistence, definition versions, optimistic concurrency/ETag, CRUD API, audit events, replace session drafts with server resources, and provision workflows.view/workflows.manage.
Do not implement execution engine, worker, retries or run history until Step 45D.

Do not merge to main unless explicitly requested.
