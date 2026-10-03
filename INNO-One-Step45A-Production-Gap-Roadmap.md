# INNO.One — Step 45A Production Gap Audit & Roadmap Freeze

**Status:** COMPLETE  
**Branch:** `planning/step45a-production-gap-roadmap`  
**Base:** `9443903 test: complete step 44h-c browser verification`  
**Frozen Design System:** V1.26  
**Frozen UI Contract:** 1.20.0  
**Current Production route definitions:** 61

## Goal

Close Step 44 architecture cleanup and establish one current source of truth for what is:
- implemented,
- cross-surface implemented,
- foundation-only,
- backend-skeleton,
- deferred,
- boundary-only,
- backlog-only.

Step 45A does not invent a feature implementation. It freezes the next implementation order from the current repository.

Machine-readable roadmap:

```text
inno-step45a-production-gap-roadmap.json
```

Static guard:

```text
step45a-production-gap-roadmap-audit.py
```

## Current implemented Web baseline

The Step 44 interaction matrix contains 61 real Production route definitions:

| Area | Route definitions |
| --- | ---: |
| Workspace / Core | 7 |
| Admin Center | 17 |
| Devices | 7 |
| Assets | 19 |
| Helpdesk | 11 |
| **Total** | **61** |

These five Web areas are the current Product baseline. Meeting, Reports and Dynamic Workflow are not counted as implemented Product routes.

## Registry alignment fixed in Step 45A

The Product module manifest had drift from the current UI:

- Devices omitted `/devices/query` from module navigation.
- Assets still called `/assets/ownership` **Ownership & Users**.
- Assets still called `/assets/owners` **User Profiles**.

Step 45A aligns the embedded Production manifest to the current frozen IA:

```text
/devices/query       → Inventory Query
/assets/ownership    → Ownership Overview
/assets/owners       → Asset Owners
```

The legacy labels remain historical only; they are no longer Production module metadata.

## Gap inventory

### Dynamic Workflow — FOUNDATION ONLY

Already real:
- `@inno/ui/workflow`
- `INNOWorkflowCanvas`
- React Flow + ELK.js
- node/edge domain contract
- responsive Design System proof
- validation/selection/connect/delete/layout behavior
- normal Product bundle isolation

Still missing:
- Production module manifest entry,
- Product routes,
- workflow list,
- Product builder shell,
- persisted definitions,
- versioning/concurrency,
- execution engine,
- run history.

Frozen ownership decision:

> **Dynamic Workflow is a standalone cross-module Web application.**

It must not replace the current Helpdesk Automation editor. Helpdesk Automation remains the focused Trigger → Condition → Action P04 experience.

### Reports — BACKEND SKELETON

Already real:
- Production module manifest entry,
- `Modules/Reports`,
- `ReportsModule`,
- `ReportsDbContext`,
- Platform API DI composition.

Still missing:
- Reports domain model,
- feature API endpoints,
- Production React routes,
- saved reports,
- builder execution,
- export behavior.

Prototype evidence already exists:

```text
reports-overview.html
reports-saved.html
report-builder.html
```

Current Web route intentionally remains:

```text
reports/* → DeferredPage
```

### Meeting — SERVICE SKELETON + DEFERRED WEB

Meeting is further along than a pure placeholder.

Already real:
- Production module manifest entry,
- dedicated `meeting-service`,
- separate `inno_meeting` database boundary,
- `meeting` and `integration` DbContext schemas,
- authentication composition,
- health endpoints,
- five HTML product prototypes.

Current Meeting Service README explicitly freezes Step 14 as health/composition/persistence only. Recording, transcription, summary and action-item logic is not implemented yet.

Still missing:
- Meeting entities/feature persistence,
- feature APIs beyond health,
- Production React routes,
- recording/upload ingestion,
- transcription/summary processing,
- Endpoint Agent recording integration.

Prototype evidence:

```text
meeting.html
meeting-list.html
meeting-new.html
meeting-detail.html
meeting-upcoming.html
```

Current Web route intentionally remains:

```text
meeting/* → DeferredPage
```

### Endpoint Agent — BOUNDARY ONLY

The Production folder currently contains only the runtime boundary README.

Frozen Agent ownership:
- Request Help,
- ownership confirmation,
- real remote consent prompt,
- local runtime behavior,
- future Meeting recording interaction.

Still missing:
- runtime technology decision,
- executable Agent shell,
- authentication/session handling,
- Request Help client,
- ownership confirmation client,
- remote-consent runtime,
- Meeting recording integration.

### Assets Mobile — IMPLEMENTED CROSS-SURFACE

The Android Assets app is a real React Native / Expo runtime, not a Web placeholder.

Current implementation includes:
- OIDC Authorization Code + PKCE,
- SecureStore token handling,
- camera permission,
- QR scanning,
- server QR resolution,
- local recent-scan history,
- Asset result/error states.

It remains outside Web navigation by design.

### Forms — BACKLOG ONLY

The old HTML prototype registry contains a future Forms concept, but Production has:
- no module manifest entry,
- no route,
- no domain/API,
- no approved implementation scope.

Forms is intentionally unscheduled.

## Availability / module-state decision

Production manifests may describe future Web modules such as Meeting and Reports, but a module must not appear in the normal launcher unless:
- it has a real Product route,
- the installed state exists,
- it is enabled,
- dependencies are available,
- the user has the entry permission.

Current development seed installs only:

```text
devices
assets
helpdesk
```

Meeting and Reports remain uninstalled in development until their vertical slices are real.

Workflow is not added to `module-manifests.json` in Step 45A. Step 45B owns that Product IA decision and must still keep the module unavailable from the normal launcher until persistence is ready.

## Frozen implementation roadmap

### Step 45B — Dynamic Workflow Product IA + UI Routes

Backend: **No**

Scope:
- standalone Workflow module IA,
- P02 Workflow list shell,
- P06 New/Edit Workflow builder,
- reuse `INNOWorkflowCanvas`,
- Product route/permission/module-manifest contract,
- no fake execution,
- no persistence yet,
- keep normal launcher unavailable until persistence exists.

Proposed route ownership:

```text
/workflows                  P02 Workflow list
/workflows/new              P06 New Workflow
/workflows/:workflowId      P06 Workflow Builder
```

Run history is reserved for Step 45D.

### Step 45C — Dynamic Workflow Persistence & Versioning

Backend: **Yes**

Scope:
- Workflow definition aggregate,
- INNO node/edge persistence,
- definition versioning,
- optimistic concurrency,
- CRUD API,
- audit events.

Persist INNO.One business definitions, not React Flow internal objects.

### Step 45D — Dynamic Workflow Execution & Run History

Backend: **Yes**

Scope:
- execution snapshot,
- run state/history,
- worker/scheduler boundary,
- failure/retry semantics,
- P10 run history.

Definition state and execution state remain separate.

### Step 46 — Reports Production Vertical Slice

Backend: **Yes**

Use the existing Reports module skeleton.

Initial Product scope:
- Reports Overview,
- Saved Reports,
- Report Builder,
- real Reports domain/API,
- first export contract.

### Step 47 — Endpoint Agent Runtime Foundation

Backend/integration: **Yes**

Before implementation, freeze the runtime technology choice.

Then implement:
- Agent shell/auth,
- Request Help,
- ownership confirmation,
- remote consent runtime,
- shared INNO.One API boundary.

The Agent must not call MeshCentral as a substitute for INNO.One business APIs.

### Step 48 — Meeting Production Module

Backend: **Yes**

Depends on Step 47 for the endpoint recording path.

Scope:
- Meeting Overview,
- list/upcoming,
- create,
- detail,
- upload/recording ingestion,
- transcript/summary processing,
- Endpoint Agent recording integration.

Web Meeting workspace and Endpoint Agent recording remain separate surfaces joined by API/contracts.

## Why Reports precedes Meeting

Reports already has:
- a dedicated backend module,
- a DbContext,
- Platform API composition,
- implemented dependencies: Devices + Assets + Helpdesk.

Meeting has a service boundary, but its feature logic explicitly remains unimplemented and the intended recording path depends on the Endpoint Agent runtime.

Therefore the dependency-aware roadmap places Reports at Step 46, Agent runtime at Step 47 and Meeting at Step 48.

## QA

Step 45A dedicated audit:

```text
step45a_checks=74
step45a_failures=0
```

Module/plugin contract:

```text
step30_modules=devices,assets,helpdesk,meeting,reports
issues=0
```

Build:
- full `INNO.One.sln` build PASS,
- 0 warnings,
- 0 errors,
- Web Portal typecheck PASS,
- `git diff --check` PASS.

No Design System or UI Contract version change was introduced.

## Next

**Step 45B — Dynamic Workflow Product IA + UI Routes**

Step 45B should remain frontend/product-IA only. Do not start Workflow persistence/backend until Step 45C.
