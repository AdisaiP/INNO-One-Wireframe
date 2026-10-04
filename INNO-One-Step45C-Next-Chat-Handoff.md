# INNO.One — Step 45C Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step45c-dynamic-workflow-persistence-versioning`
**Base:** `65d3ca7 feat: add dynamic workflow product ia`
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0
**Current route definitions:** 64

## Read first

- `INNO-One-Step45C-Dynamic-Workflow-Persistence-Versioning.md`
- `INNO-One-Step45B-Next-Chat-Handoff.md`
- `INNO-One-Step44G-Dynamic-Workflow-Foundation.md`
- `inno-step44a-screen-interaction-matrix.json`

## Current Workflow state

Dynamic Workflow is now a persisted Product module.

Routes remain:

```text
/workflows
/workflows/new
/workflows/:workflowId
```

The builder still reuses `INNOWorkflowCanvas`.

Persistence:
- schema `workflows`,
- current definition table,
- immutable version table,
- JSONB nodes/edges,
- opaque `wf_...` IDs.

API:
- list/get/create/update/delete,
- version history,
- ETag + If-Match,
- 428 missing precondition,
- 412 stale/racing update,
- append-only create/update/delete audit.

Permissions:
- `workflows.view`
- `workflows.manage`

Workflow is installed/enabled in development and is now visible from the normal Apps launcher when the user has `workflows.view`.

## Important boundary

Step 45C adds definition persistence only.

Still absent by design:
- Publish semantics,
- Run action,
- execution engine,
- scheduler/worker,
- retries,
- run history.

Helpdesk Automation remains the simple Trigger → Condition → Action P04 editor.

## QA

- Step 45C static = **68/68**
- Step 45C browser/runtime = **87/87**, 9 screenshots
- Broad Production = **62 routes / 1628/1628**
- Design System = **56/56**
- Step 44A = **108/108**, gaps=0
- Step 44H-C = **51/51**
- Step 44H final static = **34/34**
- Step 45A current overlay = **78/78**
- Step 30 module/plugin = **issues 0**
- UI build PASS
- Web typecheck PASS
- Web production build PASS
- full .NET solution build PASS, **0 warnings / 0 errors**
- `git diff --check` PASS

## Next

Start **Step 45D — Dynamic Workflow Execution & Run History**.

Persist execution snapshots against **workflow ID + workflow version**. Do not mutate definition versions as runtime state.

Do not merge to `main` unless explicitly requested.
