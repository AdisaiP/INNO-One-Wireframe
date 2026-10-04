# INNO.One - Step 45F Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step45f-helpdesk-automation-consolidation`
**Next step:** Step 45G - Shared Execution + Helpdesk Run History

## Read first

1. `INNO-One-Step45F-Helpdesk-Automation-Consolidation.md`
2. `INNO-One-Automation-I18N-Rearchitecture-Plan.md`
3. `INNO-One-Step45E-Bilingual-Foundation.md`
4. `INNO-One-Step45C-Dynamic-Workflow-Persistence-Versioning.md`
5. `INNO-One-Step44G-Dynamic-Workflow-Foundation.md`

## Frozen Product decision

- no standalone Dynamic Workflows end-user App;
- shared technical module is `Automation Core` with `launcher:false`;
- Helpdesk owns the first full React Flow automation surface;
- `/helpdesk/automation` = P02 list;
- `/helpdesk/automation/new` and `/:automationId` = P06 builder;
- generic `/api/v1/workflows` is migration-only and owner-isolated to `legacy_unassigned`;
- Helpdesk definitions/versions are `ownerModule=helpdesk`;
- exact Product permissions are `helpdesk.automation.view/manage`;
- Devices remains WHEN / IF / THEN Automation & Remediation first;
- Assets later gets restricted lifecycle workflow;
- Admin later gets constrained approval/lifecycle workflow;
- Reports stays schedule-focused;
- Meeting remains out of this roadmap.

## Step45F implementation

- shared `INNOWorkflowCanvas` is lazy-loaded under Helpdesk;
- Helpdesk-specific bilingual trigger/action catalog;
- node metadata supports `catalogKey`, translation keys and business `configuration`;
- create/update/delete/version persistence uses Step45C immutable versioning + ETag/If-Match;
- old `/workflows/*` browser routes redirect to Helpdesk Automation;
- obsolete standalone Workflow Product list/builder files are deleted;
- Apps launcher hides Automation Core;
- Admin registry still exposes Automation Core as a technical module;
- old simple-rule HTTP surface and Web client/types are removed;
- existing Step18 simple rules migrate into Helpdesk-owned visual definitions + v1 snapshots;
- fresh installs no longer seed legacy simple rules;
- legacy simple-rule evaluator is disabled by default behind `Helpdesk:LegacyAutomationExecutionEnabled`;
- SLA processing remains active.

## Migration

`20261004153139_Step45FHelpdeskAutomationOwnership`

It adds `owner_module`, owner-aware indexing and maps existing `helpdesk.automation_rules` into Helpdesk visual definitions. Existing generic Step45C definitions remain `legacy_unassigned`.

## QA final

- Step45F static: 135/135
- Step45E bilingual: 87/87
- Step45A overlay: 78/78
- Step45C persistence: 68/68
- Step30 module/plugin: issues=0
- dedicated Step45F browser/runtime: 105/105, 0 failures, 8 screenshots
- broad Product browser: 1572/1572 across 60 concrete routes, 0 failures
- responsive coverage: 1366 / 1024 / 768
- Web typecheck/build: PASS
- i18n/ui package builds: PASS
- .NET full solution: 0 warnings / 0 errors
- Workflows EF pending model changes: none
- migration SQL generation: PASS
- `git diff --check`: PASS

Visual QA found and fixed one Helpdesk Automation list boundary-spacing issue. `AutomationRulesPage` now imports the shared `WorkflowProductPages.css`; dedicated browser QA explicitly checks the banner spacing and was rerun after the fix.

QA-created Helpdesk definitions are deleted after the suite. User/organization locale values are restored after Thai/English checks.

## Step45G constraints

Do not revive the old global Step45D direction. Step45G must:
- execute immutable workflow ID + version snapshots;
- keep runtime state separate from definition state;
- persist owner-scoped Helpdesk run resources/history;
- add `/helpdesk/automation/:automationId/runs` inside Helpdesk ownership;
- preserve normal authorization, audit and cross-module action boundaries;
- define worker/scheduler/retry semantics before exposing Run;
- provide bilingual runtime status/error presentation;
- keep standalone Dynamic Workflows Product navigation removed.

## Git discipline

Do not merge to `main` unless the user explicitly asks.