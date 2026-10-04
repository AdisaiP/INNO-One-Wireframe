# INNO.One - Step 45F Next Chat Handoff

**Status:** IMPLEMENTATION COMPLETE; runtime/browser QA blocked by dev infrastructure
**Branch:** `implementation/step45f-helpdesk-automation-consolidation`
**Next gate:** finish Step45F runtime/browser QA before Step45G

## Read first

1. `INNO-One-Step45F-Helpdesk-Automation-Consolidation.md`
2. `INNO-One-Step45E-Bilingual-Foundation.md`
3. `INNO-One-Automation-I18N-Rearchitecture-Plan.md`
4. `INNO-One-Step45C-Dynamic-Workflow-Persistence-Versioning.md`
5. `INNO-One-Step44G-Dynamic-Workflow-Foundation.md`

## Current Product decision

- no standalone Dynamic Workflows end-user App;
- shared technical module is named Automation Core and has `launcher:false`;
- Helpdesk owns the first full React Flow automation surface;
- Assets later gets restricted lifecycle workflow;
- Admin later gets constrained approval/lifecycle workflow;
- Devices stays WHEN / IF / THEN Automation & Remediation first;
- Reports uses schedule/subscription, not a graph;
- Meeting remains out of this roadmap.

## Step45F implementation now present

- Helpdesk list uses persisted visual definitions;
- Helpdesk new/edit uses lazy shared `INNOWorkflowCanvas`;
- definitions and immutable versions persist `ownerModule`;
- Helpdesk API facade at `/api/v1/helpdesk/automations`;
- exact Helpdesk permissions `helpdesk.automation.view/manage`;
- generic `/api/v1/workflows` is migration-only and owner-isolated to `legacy_unassigned`;
- old browser `/workflows/*` redirects to `/helpdesk/automation`;
- AppShell standalone workflow navigation removed;
- Automation Core removed from Apps launcher;
- Helpdesk-specific bilingual node catalog;
- Product node metadata supports catalog/configuration and translation keys;
- existing Step18 simple rules are converted to Helpdesk-owned visual definitions by migration;
- new installations no longer seed legacy simple rules;
- legacy simple-rule evaluator disabled by default behind `Helpdesk:LegacyAutomationExecutionEnabled`;
- SLA worker remains active;
- execution/run history remains Step45G.

## Migration

Step45F migration:
`20261004153139_Step45FHelpdeskAutomationOwnership`

It adds `owner_module` to both workflow tables, creates owner-aware indexing and maps existing `helpdesk.automation_rules` into Helpdesk visual definitions + v1 snapshots.

Existing generic Step45C definitions become `legacy_unassigned` and remain inaccessible through the Helpdesk facade.

## Product matrix

Current screen matrix = 61 Product screens.

- `/helpdesk/automation` = P02
- `/helpdesk/automation/new` = P06
- `/helpdesk/automation/:automationId` = P06
- standalone Workflow Product screens removed from matrix and obsolete Workflow list/builder Product files deleted

## QA already green

- Step45F static: 134/134
- Step45E bilingual: 87/87
- Step45A overlay: 78/78
- Step45C persistence: 68/68
- Step30 module/plugin: issues=0
- i18n/ui package builds: PASS
- Web typecheck: PASS
- Web production build: PASS
- .NET full solution: 0 warnings / 0 errors
- Workflows EF pending model changes: none
- migration SQL generation: PASS
- `git diff --check`: PASS
- Step45F browser QA script syntax: PASS

## Runtime QA blocker

At the completion attempt on 2026-10-04, Windows MCP could not reach dev infrastructure:
- PostgreSQL `172.10.1.58:5432` -> unreachable
- Keycloak `172.10.1.58:8080` -> unreachable

The Windows device has no local Docker/PostgreSQL and the repo has no development auth bypass. MacBookPro.home was offline, so there was no alternate MCP path.

Do not infer Product failure from this. The API could not start because the external dev PostgreSQL connection timed out before migrations/runtime could be exercised.

## First action when resuming

1. verify TCP reachability to dev PostgreSQL and Keycloak;
2. start API with migrations + development seed;
3. start Vite with dev Keycloak host;
4. run `python -u step45f-helpdesk-automation-browser-qa.py`;
5. inspect screenshots under `qa-step45f-helpdesk-automation`;
6. run `python -u step42-production-ux-browser-qa.py`;
7. update Step45F docs with browser counts and mark COMPLETE if clean;
8. commit/push any QA-only corrections;
9. only after that start Step45G.

## Browser QA expected coverage

The dedicated suite checks:
- Keycloak login;
- Apps launcher no standalone workflow app;
- Admin registry technical Automation Core;
- old browser route redirect;
- migrated legacy definitions;
- Helpdesk ownership on every list item;
- responsive list/builder at 1366 / 1024 / 768;
- React Flow canvas and module-specific palette;
- no AI/Subflow palette exposure;
- no Publish/Run;
- create v1 and persisted reopen;
- save v2;
- stale ETag 412;
- version history ownership;
- generic facade 404/exclusion for Helpdesk definition;
- Thai builder/list rendering;
- delete cleanup;
- invalid route shared ErrorState;
- locale restore.

## Git discipline

Do not merge to `main` unless the user explicitly asks.
Do not start Step45G until Step45F runtime/browser QA passes.