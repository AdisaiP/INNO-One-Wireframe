# INNO.One — Step 45C Dynamic Workflow Persistence & Versioning

**Status:** COMPLETE
**Branch:** `implementation/step45c-dynamic-workflow-persistence-versioning`
**Base:** `65d3ca7 feat: add dynamic workflow product ia`
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0
**Current route definitions:** 64

## Goal

Replace the Step 45B browser-session Workflow preview with real INNO.One Workflow definition persistence while keeping execution as a separate Step 45D concern.

Step 45C implements:
- persisted Workflow definitions,
- immutable definition versions,
- optimistic concurrency,
- CRUD API,
- audit events,
- real Workflow permissions,
- installed/enabled launcher availability,
- server-backed Product list and builder.

It does **not** implement Workflow execution, workers, retries or run history.

## Backend module

New Platform API module:

```text
production/services/platform-api/src/Modules/Workflows/
```

Owned schema:

```text
workflows
```

Tables:

```text
workflows.workflow_definitions
workflows.workflow_definition_versions
```

The current definition stores the INNO.One business graph:
- name,
- nodes JSONB,
- edges JSONB,
- orientation,
- status,
- current version,
- created/updated actor,
- created/updated timestamp.

React Flow internals remain outside the persisted business contract.

Each create/update/delete also writes an immutable `workflow_definition_versions` snapshot.

## Optimistic concurrency

Workflow resources expose version ETags:

```text
"v1"
"v2"
...
```

Mutation contract:
- PUT and DELETE require `If-Match`,
- missing `If-Match` returns 428,
- stale version returns 412,
- `WorkflowDefinition.Version` is also an EF concurrency token so simultaneous database updates map to the same 412 conflict contract.

The migration target-model snapshot is aligned with the concurrency metadata.

## API

Implemented under `/api/v1`:

```text
GET    /workflows
GET    /workflows/{workflowId}
POST   /workflows
PUT    /workflows/{workflowId}
DELETE /workflows/{workflowId}
GET    /workflows/{workflowId}/versions
```

IDs use opaque `wf_...` identifiers.

Delete is a soft delete:
- current resource becomes unavailable to list/get,
- the delete transition creates a final immutable version snapshot,
- audit evidence is retained.

No `/runs`, publish or execution endpoint exists in Step 45C.

## Audit

Create/update/delete write into the existing append-only audit ledger in the same database transaction.

Actions:

```text
workflow.definition.created
workflow.definition.updated
workflow.definition.deleted
```

Audit target:
- module: `workflows`
- target type: `workflow_definition`
- classification: `restricted`

## Permissions and module availability

Provisioned permissions:

```text
workflows.view
workflows.manage
```

Development seed grants them to Platform Admin.

The Workflow app is now:
- installed in the development seed,
- enabled,
- `launcher: true`,
- gated by `workflows.view`.

The Product routes no longer use the temporary Step 45B `admin.apps.view` preview gate.

List access requires `workflows.view`. New/edit routes require `workflows.manage`.

## Web Product changes

`WorkflowDraftContext` was removed.

`/workflows` now loads persisted definitions through React Query and shows:
- name,
- current version,
- node/edge counts,
- status,
- updated time.

`/workflows/new` creates a persisted v1 definition.

`/workflows/:workflowId`:
- loads the server definition,
- displays the current version,
- saves a new immutable version,
- sends `If-Match` using the current ETag.

The existing Step 44G `INNOWorkflowCanvas` remains the only graph editor.

Helpdesk Automation remains the separate simple P04 Trigger → Condition → Action editor.

## Bundle isolation

Final Web production build remains split:

```text
main JS                 ~698.73 KB
WorkflowBuilder wrapper ~8.51 KB
workflow engine chunk   ~1.64 MB
```

React Flow + ELK remain outside the initial application bundle.

## QA

Dedicated static:

```text
step45c_checks=68
step45c_failures=0
```

Dedicated browser/runtime:

```text
step45c_browser_checks=87
step45c_browser_failures=0
step45c_browser_screenshots=9
```

Runtime coverage includes:
- normal Apps launcher availability,
- 1366 / 1024 / 768 responsive list/builder,
- create persisted v1,
- full navigation/reopen,
- update to v2,
- stale ETag returns 412,
- version history returns immutable v1/v2 snapshots,
- DELETE returns 204,
- deleted resource GET returns 404,
- deleted resource disappears from list,
- invalid resource never fabricates an editor.

Regression:

```text
Broad Production = 62 routes / 1628 checks / 0 failures
Design System browser = 56 / 56
Step 44A = 108 / 108, current gaps 0
Step 44H-C = 51 / 51
Step 44H final static = 34 / 34
Step 45A current overlay = 78 / 78
Step 30 module/plugin = issues 0
```

Build:
- `@inno/ui` build PASS,
- Web typecheck PASS,
- Web production build PASS,
- full `.NET` solution build PASS,
- final clean .NET build = **0 warnings / 0 errors**,
- `git diff --check` PASS.

The machine has SDK 10.0.201 while `production/global.json` remains pinned to 10.0.103. Temporary QA/build overrides were restored; the repository file remains 10.0.103.

## Next

**Step 45D — Dynamic Workflow Execution & Run History**

Step 45D should consume persisted workflow ID + immutable version and add:
- execution snapshot,
- worker/runtime boundary,
- run state/history,
- retry/failure semantics,
- P10 run history Product surface.

Definition state and execution state must remain separate.

Do not merge to `main` unless explicitly requested.
