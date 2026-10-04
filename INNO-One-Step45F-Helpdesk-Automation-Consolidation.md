# INNO.One - Step 45F Helpdesk Automation Consolidation

**Status:** IMPLEMENTATION COMPLETE - runtime/browser QA blocked by dev infrastructure
**Date:** 2026-10-04
**Branch:** `implementation/step45f-helpdesk-automation-consolidation`
**Base:** `c1eb689 feat: add bilingual runtime foundation`

## 1. Product decision implemented

Dynamic Workflows is no longer a standalone end-user Product surface.

Workflow/Automation remains shared technical infrastructure, but Helpdesk now owns the first full visual authoring surface:

- `/helpdesk/automation` -> P02 module-owned definitions list
- `/helpdesk/automation/new` -> P06 React Flow builder
- `/helpdesk/automation/:automationId` -> P06 persisted definition editor

The compatibility browser route `/workflows/*` redirects into Helpdesk Automation. `Automation Core` remains a technical module with `launcher:false` and no end-user navigation.

## 2. Shared ownership model

`WorkflowDefinition` and immutable `WorkflowDefinitionVersion` now persist `ownerModule`.

Current ownership values used by Step 45F:
- `helpdesk` for Helpdesk visual automation
- `legacy_unassigned` for the migration-only generic workflow facade

All Helpdesk list/get/create/update/delete/version queries require the exact Helpdesk owner boundary.

## 3. Helpdesk API facade

New module-owned API:

- GET `/api/v1/helpdesk/automations`
- GET `/api/v1/helpdesk/automations/{automationId}`
- POST `/api/v1/helpdesk/automations`
- PUT `/api/v1/helpdesk/automations/{automationId}`
- DELETE `/api/v1/helpdesk/automations/{automationId}`
- GET `/api/v1/helpdesk/automations/{automationId}/versions`

Permissions:
- `helpdesk.automation.view`
- `helpdesk.automation.manage`

The old `/api/v1/workflows` facade remains migration-only and is restricted to `ownerModule=legacy_unassigned`, so generic workflow permissions cannot read Helpdesk-owned definitions.

ETag / If-Match versioning and 428 / 412 concurrency behavior are preserved.

Helpdesk definition audit actions are module-aware:
- `helpdesk.automation.definition.created`
- `helpdesk.automation.definition.updated`
- `helpdesk.automation.definition.deleted`

## 4. Helpdesk visual builder

The old simple Trigger -> Condition -> Action Product editor was replaced with the shared `INNOWorkflowCanvas`.

The builder is lazy-loaded so React Flow / ELK remains isolated from the initial Web bundle.

Helpdesk-specific catalog currently exposes:

- Ticket Created
- Ticket Updated
- Status Changed
- SLA At Risk
- Requester Replied
- Ticket Condition
- Branch
- Manager Approval
- Assign Team
- Update Ticket
- Escalate Ticket
- Wait
- Notify Requester
- End

AI and Subflow remain shared node kinds but are not exposed in the Helpdesk palette.

Each Product-provided node can persist:
- `catalogKey`
- `labelKey` / `descriptionKey`
- canonical fallback `label` / `description`
- `configuration`

This lets the same saved definition render in Thai or English without rewriting business data. When a user customizes a label/description, it becomes user-authored content and the translation key is cleared.

## 5. Legacy simple-rule migration

Step18 `helpdesk.automation_rules` data is not silently hidden.

The Step45F Workflows migration:
- adds `owner_module` to definitions and versions;
- preserves pre-Step45F generic definitions as `legacy_unassigned`;
- converts existing Helpdesk simple rules into Helpdesk-owned visual definitions;
- maps legacy trigger/condition/action values into stable catalog/configuration metadata;
- creates the immutable version-1 snapshot for migrated definitions.

Fresh installations no longer seed the old simple automation rules.

The legacy evaluator remains in code only behind `Helpdesk:LegacyAutomationExecutionEnabled`, whose default is false. SLA evaluation remains enabled. New visual definitions intentionally remain non-executable until Step 45G.

## 6. Bilingual behavior

New Helpdesk Automation Product UI is built on Step45E `@inno/i18n`.

New catalogs:
- `en-US/helpdesk.json`
- `th-TH/helpdesk.json`
- `en-US/workflow.json`
- `th-TH/workflow.json`

Localized surfaces include list copy, builder panels, catalog labels/descriptions, node kind labels, validation severity, definition status, feedback and actions.

## 7. Screen matrix

The current Product interaction matrix contains 61 screens.

Standalone workflow Product entries were removed, and the now-unreferenced `WorkflowListPage.tsx` / `WorkflowBuilderPage.tsx` Product files were deleted so there is only one end-user authoring path. Helpdesk automation entries are now:
- list = P02
- new/edit = P06
- shared special component = `INNOWorkflowCanvas`

## 8. QA completed

Static / contract:
- Step45F: 134/134
- Step45E bilingual foundation: 87/87 after new catalogs
- Step45A current overlay: 78/78
- Step45C persistence regression: 68/68
- Step30 module/plugin: issues=0
- `git diff --check`: PASS

Build / schema:
- `@inno/i18n` build: PASS
- `@inno/ui` build: PASS
- Web typecheck: PASS
- Web production build: PASS
- full .NET solution build: PASS
- .NET warnings: 0
- .NET errors: 0
- Workflows EF pending model changes: none
- Step45F migration SQL generation: PASS
- generated SQL contains owner-module migration, legacy rule conversion and Helpdesk ownership

Known Vite warning remains unchanged: React Flow / ELK lazy chunk is larger than 500 KB. It is still isolated in the lazy Automation builder chunk.

## 9. Runtime/browser QA status

Dedicated browser QA has been added as `step45f-helpdesk-automation-browser-qa.py` and syntax-checks successfully.

It is designed to verify:
- Apps launcher hides Dynamic Workflows / Automation Core;
- Admin registry shows Automation Core only as technical module;
- `/workflows` browser route redirects into Helpdesk;
- migrated rules appear as Helpdesk-owned definitions;
- 1366 / 1024 / 768 list and builder behavior;
- Helpdesk-only node palette;
- create v1 / reopen / save v2;
- stale ETag -> 412;
- immutable version history;
- generic workflow facade cannot read/list Helpdesk definitions;
- Thai/English rendering;
- delete / 404 cleanup;
- invalid definition shared error state;
- locale restoration after QA.

Runtime/browser execution is currently blocked because the configured dev infrastructure host `172.10.1.58` is unreachable from the Windows MCP machine on both PostgreSQL 5432 and Keycloak 8080. The machine has no local Docker, local PostgreSQL or development-auth fallback. This is an infrastructure availability gap, not a compile/static failure.

Do not mark Step45F fully QA-complete and do not start Step45G until this browser/runtime suite is executed against the real dev infrastructure.

## 10. Next gate

When dev PostgreSQL + Keycloak are reachable:

1. start Platform API with normal development migration/seed against dev infrastructure;
2. start Vite with the dev Keycloak URL;
3. run `python -u step45f-helpdesk-automation-browser-qa.py`;
4. visually inspect generated Step45F screenshots;
5. run updated broad `step42-production-ux-browser-qa.py` (standalone workflow routes were removed from its Product route list);
6. if both are clean, update this document to COMPLETE;
7. only then begin Step45G - Shared Execution + Helpdesk Run History.
