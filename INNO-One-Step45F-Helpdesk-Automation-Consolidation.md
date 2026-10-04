# INNO.One - Step 45F Helpdesk Automation Consolidation

**Status:** COMPLETE
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
- Step45F: 135/135
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

## 9. Runtime/browser QA

Dedicated browser/runtime QA:

```text
step45f_browser_checks=105
step45f_browser_failures=0
step45f_browser_screenshots=8
```

Validated against the real development PostgreSQL + Keycloak environment:
- Apps launcher hides Dynamic Workflows / Automation Core;
- Admin registry exposes Automation Core only as a technical module;
- `/workflows` browser route redirects into Helpdesk;
- existing Step18 rules are migrated into Helpdesk-owned visual definitions;
- every Helpdesk list item is owner-scoped to `helpdesk`;
- 1366 / 1024 / 768 list and builder behavior;
- shared React Flow canvas with Helpdesk-only node palette;
- AI/Subflow are not exposed in the Helpdesk palette;
- no premature Publish/Run controls;
- create v1, persisted reopen and save v2;
- stale ETag returns 412;
- immutable version history remains Helpdesk-owned;
- generic workflow facade returns 404/excludes Helpdesk definitions;
- Thai/English list and builder rendering;
- invalid definition route uses the shared error state;
- QA-created definition is deleted;
- organization/user locale values are restored after QA.

Visual inspection found one banner-spacing defect on the Helpdesk Automation list. The list now imports the shared `WorkflowProductPages.css`; the dedicated QA was rerun after the fix and explicitly verifies shared flex spacing at 1366 / 1024 / 768. English and Thai screenshots were re-inspected successfully.

Evidence:
- `qa-step45f-helpdesk-automation`
- 8 PNG screenshots.

Broad Product browser regression after Step45F:

```text
step42_routes=60
step42_browser_checks=1572
step42_browser_failures=0
```

This includes the migrated Helpdesk Automation dynamic definition route and responsive 1024 / 768 coverage.

## 10. Next step

**Step 45G - Shared Execution + Helpdesk Run History**

Start only from the frozen Step45F ownership boundary:
- execution must reference workflow ID + immutable workflow version;
- runtime state stays separate from definition state;
- runs remain owner-scoped to Helpdesk;
- execution uses normal authorization/audit services;
- add Helpdesk run history under the module-owned Automation surface;
- keep bilingual runtime status/error presentation;
- do not restore standalone Dynamic Workflows Product navigation.
