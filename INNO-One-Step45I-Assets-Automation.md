# INNO.One - Step 45I Assets Automation

**Status:** COMPLETE
**Branch:** `implementation/step45i-assets-automation`
**Base:** Step45H completion `3f48f2c`
**Next:** Step 45J - Admin Approval Automation

## Goal

Add an Assets-owned Automation Product that reuses the shared immutable automation definition/run infrastructure without exposing a standalone Workflow app or the full React Flow canvas.

The Product model remains focused:

```text
WHEN -> optional IF -> THEN
```

The focused editor compiles that business rule into the shared deterministic runtime:

```text
Trigger -> supported Action -> End
```

## Product routes

Step45I owns four Assets routes:

- `/assets/automation` - P02 rule list;
- `/assets/automation/new` - P04 focused create;
- `/assets/automation/:automationId` - P04 edit / immutable version;
- `/assets/automation/:automationId/runs` - P10 run history.

The Assets editor does not import `INNOWorkflowCanvas` and does not load React Flow CSS.

The current Product interaction matrix contains **70** classified routes/screens.

## Definition and run ownership

Definitions continue to use the shared Workflows persistence layer with:

- `ownerModule=assets`;
- immutable definition versions;
- ETag / If-Match optimistic concurrency;
- owner-scoped audit actions.

Assets definition facade:

```text
GET    /api/v1/assets/automations
GET    /api/v1/assets/automations/{automationId}
POST   /api/v1/assets/automations
PUT    /api/v1/assets/automations/{automationId}
DELETE /api/v1/assets/automations/{automationId}
GET    /api/v1/assets/automations/{automationId}/versions
```

Assets run facade:

```text
POST /api/v1/assets/automations/{automationId}/runs
GET  /api/v1/assets/automations/{automationId}/runs
GET  /api/v1/assets/automations/{automationId}/runs/{runId}
```

Manual test-run enqueue uses either an Asset or Software License context.

Automatic event-to-run dispatch is **not** implemented in Step45I and must not be implied.

## WHEN catalog

### Asset signals

- `assets.asset.lifecycle_status`
- `assets.asset.owner_unassigned`
- `assets.asset.warranty_expiring`
- `assets.asset.baseline_drift`

### Software License signal

- `assets.license.overused`

The run facade validates the current business context before enqueue.

Examples of explicit pre-enqueue failures:

- `ASSETS_LIFECYCLE_CONTEXT_MISMATCH`
- `ASSETS_OWNER_CONTEXT_MISMATCH`
- `ASSETS_WARRANTY_THRESHOLD_NOT_REACHED`
- `ASSETS_WARRANTY_MISSING`
- `ASSETS_BASELINE_DRIFT_NOT_PRESENT`
- `ASSETS_LICENSE_THRESHOLD_NOT_REACHED`
- `ASSETS_RULE_CONDITION_NOT_MATCHED`

## Optional IF catalog

Asset context:

- category;
- lifecycle status;
- owner state.

Software License context:

- vendor;
- license model;
- compliance.

The focused Product editor exposes only fields meaningful for the selected trigger/resource type.

## THEN catalog

### Update Asset lifecycle

Catalog key:

- `assets.asset.set_lifecycle_status`

Supported targets:

- `in_use`
- `stock`
- `repair`
- `retired`

Runtime behavior:

- requires current `assets.manage`;
- re-checks current Asset scope;
- uses the real Asset record/version;
- writes Assets audit evidence;
- emits `asset.changed`;
- is idempotent when the Asset already has the requested lifecycle state.

A lifecycle action is rejected before enqueue when the run context is not an Asset:

- `ASSETS_ACTION_CONTEXT_MISMATCH`.

### Create Helpdesk Ticket

Catalog key:

- `helpdesk.ticket.create`

The cross-module action uses the Helpdesk-owned `IHelpdeskAutomationTicketCreator` contract.

Runtime behavior:

- re-checks `helpdesk.ticket.create`;
- verifies actor identity;
- creates a real Helpdesk Ticket, SLA and status history;
- writes Helpdesk audit evidence;
- emits `ticket.created`;
- is idempotent through the automation idempotency key.

When the source is an Asset:

- the created Ticket persists `RelatedAssetId`;
- the audit/outbox payload includes the Asset relation;
- subject/body templates may expand Asset fields.

When the source is a Software License:

- no fake Asset relationship is created;
- License template fields are expanded from the selected License context.

## Permission model

Module permissions:

- `assets.automation.view`;
- `assets.automation.manage`;
- `assets.automation.run.view`.

Shared worker:

- re-checks `assets.automation.manage` before execution.

Source-context permissions:

- Asset trigger/context -> `assets.view`;
- Software License trigger/context -> `assets.license.manage`.

Action permissions:

- Update Lifecycle -> `assets.manage`;
- Create Helpdesk Ticket -> `helpdesk.ticket.create`.

The run facade performs source/action permission preflight before enqueue and the module executor/service re-checks the relevant permission again at side-effect time.

Automation never gains authority simply because a definition was previously saved.

## Shared contracts

Step45I added shared automation contracts for:

- Asset context;
- Software License context;
- Software Baseline context;
- Assets automation context reader;
- Helpdesk automation ticket creation.

This keeps Workflows/Automation Core independent from concrete Assets/Helpdesk project references while preserving module ownership of business side effects.

## Web UX

### P02 list

- search;
- immutable version/status;
- Edit;
- Run History;
- standard collection states.

### P04 focused editor

- Rule name;
- WHEN trigger;
- trigger-specific configuration;
- optional IF;
- THEN action;
- action-specific configuration;
- canonical editor footer;
- only actions/triggers allowed by current permissions are shown;
- no React Flow.

### P10 run history

- Asset or Software License context selector;
- manual Test Automation action;
- active-run polling;
- persisted run table;
- immutable rule version;
- P10 detail drawer;
- translated runtime status/error;
- persisted execution steps.

## Bilingual

Step45I adds and registers:

- `packages/i18n/src/locales/en-US/assets.json`;
- `packages/i18n/src/locales/th-TH/assets.json`.

The catalogs cover:

- P02/P04/P10 Assets Automation UI;
- WHEN / IF / THEN labels;
- trigger/action labels;
- validation;
- run states;
- action/context permission errors;
- current-context mismatch errors.

English/Thai key parity is enforced by the Step45I static audit.

## Runtime QA

### Dedicated API runtime

```text
step45i_api_checks=56
step45i_api_failures=0
step45i_api_created_tickets=2
```

Proven against real Keycloak/PostgreSQL runtime:

- module permissions;
- definition create/version/history;
- stale ETag -> 412;
- real Asset lifecycle mutation;
- lifecycle restore through canonical Assets API;
- immutable run v1 snapshot;
- lifecycle idempotent replay;
- owner-unassigned mismatch before enqueue;
- warranty threshold mismatch before enqueue;
- overused Software License trigger;
- compliant License rejection;
- real Asset -> Helpdesk Ticket;
- Asset Ticket `RelatedAssetId` is correct;
- real License -> Helpdesk Ticket;
- License Ticket has no false Asset relationship;
- Asset/License template expansion;
- owner-scoped run history.

QA business data cleanup:

- mutated Asset lifecycle was restored through the normal API;
- two QA Helpdesk Tickets were deleted with targeted cleanup after verification;
- both Tickets were verified absent afterward;
- QA definitions were soft-deleted.

### Dedicated responsive/bilingual browser

```text
step45i_browser_checks=84
step45i_browser_failures=0
step45i_browser_screenshots=16
```

Covered:

- real Keycloak login;
- 1366 / 1024 / 768;
- P02 list;
- P04 focused editor;
- P10 run history;
- no horizontal overflow;
- no React Flow;
- UI-dispatched Asset run;
- idempotent/non-mutating lifecycle action;
- three persisted execution steps;
- English completed state;
- Thai list/editor/history critical states;
- Thai `document.lang`;
- locale restore;
- browser QA definition cleanup.

Visual inspection passed for representative desktop/narrow English and Thai screenshots.

Evidence directory:

- `qa-step45i-assets-automation-browser/`

### Broad Product regression

```text
step42_routes=65
step42_browser_checks=1704
step42_browser_failures=0
```

Broad regression now includes Assets Automation static routes. Dedicated Step45I QA covers dynamic Assets Automation Edit/Run History routes when the broad run sees the list in its cleaned empty state.

## Static / regression QA

Final chain:

```text
Step45I static              152/152
Step45H regression          127/127
Step45G regression          135/135
Step45F regression          135/135
Step45E bilingual            87/87
Step45A roadmap              78/78
Step30 module contract       issues=0
Language / terminology       issues=0
git diff --check             PASS
```

Language audit:

- Web routes: 93
- English surfaces: 94/94
- Thai surfaces: 3/3
- unscoped Thai fragments: 0
- terminology mismatches: 0

## Builds

- `@inno/i18n` build: PASS;
- `@inno/ui` build: PASS;
- Web typecheck: PASS;
- Web production build: PASS;
- Web build transformed 2256 modules;
- Assets Automation Runs lazy chunk ~9 KB;
- Assets Automation Rule lazy chunk ~15.5 KB;
- full .NET solution: **0 warnings / 0 errors**;
- `global.json` restored to SDK `10.0.103`.

The existing large main/workflow chunk warnings remain unchanged; the new focused Assets surfaces are small lazy chunks.

## Next

**Step 45J - Admin Approval Automation**

Admin automation must be constrained by privileged-operation semantics:

- access request approval;
- role assignment approval;
- onboarding/offboarding;
- account activation/deactivation review;
- organization/location reassignment review.

A saved automation must never grant itself more authority than the current actor/service identity has.

Meeting remains outside this roadmap.

Do not merge this branch to `main` unless the user explicitly asks.
