# INNO.One - Automation Ownership and Bilingual Re-architecture Plan

**Status:** Proposed replacement roadmap after Step 45C
**Date:** 2026-10-04
**Base:** `main@1107bc6`
**Scope:** Product IA, workflow ownership, shared workflow runtime boundaries, and system-wide Thai/English localization
**Decision:** Dynamic Workflows must not remain a standalone end-user App. Meeting is out of scope for this roadmap until explicitly reintroduced.

## 1. Direction

INNO.One will keep workflow technology as a shared platform capability, but workflow authoring will be owned by the business module that uses it.

Users must not leave Helpdesk, Devices, Assets, or Admin Center just to author an automation for that module.

The shared React Flow + ELK canvas remains reusable infrastructure:
- `@inno/ui/workflow`
- `INNOWorkflowCanvas`
- shared definition/version/runtime contracts
- shared execution services

The following standalone product surfaces are superseded:
- `/workflows`
- `/workflows/new`
- `/workflows/:workflowId`
- Apps launcher entry `Dynamic Workflows`
- user-facing `workflows.view` / `workflows.manage` as generic product permissions

The Step 45C persistence work is not discarded. It becomes the shared technical base to be made module-aware.

## 2. Product ownership matrix

| Surface | Workflow builder? | Priority | Product ownership |
| --- | --- | --- | --- |
| Helpdesk | Yes | P0 | Helpdesk Automation |
| Devices | Rules / Remediation first | P1 | Devices Automation & Remediation; advanced graph only if later use cases justify it |
| Assets | Yes | P1 | Assets Automation |
| Admin Center | Yes, constrained | P1 | Approval / lifecycle automation |
| Reports | No general builder | P2 | Scheduling only; can be called by workflows |
| Workspace / Apps | No | N/A | Navigation and launch only |
| Notifications | No | N/A | Shared workflow action provider |
| Endpoint Agent | No builder | N/A | Trigger/action target and user-interaction surface |
| Assets Mobile | No builder | N/A | Trigger/action target and task surface |

## 3. Module-specific automation IA

### Helpdesk - P0
Routes:
- `/helpdesk/automation`
- `/helpdesk/automation/new`
- `/helpdesk/automation/:automationId`
- `/helpdesk/automation/:automationId/runs`

Primary triggers:
- ticket created
- ticket assigned
- ticket status changed
- priority changed
- SLA warning / breach
- requester reply received

Primary actions:
- assign / reassign
- change priority or status
- request approval
- wait
- branch by ticket/requester/device/asset context
- send notification
- create follow-up task
- link device / asset context

Existing simple Trigger -> Condition -> Action Helpdesk editor will be replaced by the shared React Flow builder.

### Devices - P1 automation/remediation, not a full graph by default
Routes:
- `/devices/automation`
- `/devices/automation/new`
- `/devices/automation/:automationId`
- `/devices/automation/:automationId/history`

Primary rule triggers:
- device online/offline
- inventory/compliance change
- discovery result
- policy drift
- operation completed/failed

Primary outcomes:
- run approved remediation / remote operation
- notify owner/admin
- create Helpdesk ticket
- assign device group
- wait for a bounded delay or maintenance window

Default UX is a focused WHEN / IF / THEN rule and remediation editor, not React Flow. The shared automation runtime may store the compiled definition, but the Product UI must stay simple for common endpoint-management work. Add an advanced graph only if real multi-stage device use cases later require approval + wait + consent + verify + retry + escalation.

High-impact remote actions must require explicit permission and may require approval/consent. Automation runtime must never bypass normal Devices authorization.

### Assets - P1
Routes:
- `/assets/automation`
- `/assets/automation/new`
- `/assets/automation/:automationId`
- `/assets/automation/:automationId/runs`

Primary triggers:
- ownership changed
- ownership confirmation submitted
- contract/warranty expiry threshold
- license threshold reached
- software baseline drift
- asset lifecycle/status changed

Primary actions:
- assign owner / request confirmation
- notify owner/admin
- create Helpdesk ticket
- request approval
- update lifecycle state
- wait / branch

### Admin Center - P1, constrained
Routes:
- `/admin/automation`
- `/admin/automation/new`
- `/admin/automation/:automationId`
- `/admin/automation/:automationId/runs`

Use cases:
- access request approval
- role assignment approval
- onboarding/offboarding orchestration
- account activation/deactivation review
- organization/location reassignment review

Security rule:
Admin workflows may orchestrate privileged operations but must call the same authorization/audit services as manual actions. No node may grant authority that the workflow actor/service principal does not possess.

### Reports - no general React Flow builder
Reports should use a focused Schedule UI. A workflow may call a report-generation or report-delivery action, but Reports itself does not need a graph builder unless future requirements introduce genuine branching.

## 4. Shared automation architecture

The end-user IA is module-scoped. The technical implementation remains shared.

Recommended shared definition contract:
```text
id
ownerModule
automationType
version
name
status
nodes[]
edges[]
orientation
createdBy
updatedBy
createdAt
updatedAt
```

`ownerModule` is required for every new definition:
- helpdesk
- devices
- assets
- admin

Runtime state remains separate from definition state:
```text
runId
workflowId
workflowVersion
ownerModule
status
activeNodeIds
completedNodeIds
failedNodeId
startedAt
completedAt
```

Execution always snapshots workflow ID + immutable version. Running workflows never mutate their definition version.

## 5. Node catalog model

The shared canvas must not expose every possible action to every module.

Each module registers a catalog:
- triggers it owns
- conditions it understands
- actions it owns
- cross-module actions it explicitly allows

Shared node kinds remain:
Trigger, Action, Condition, Branch, Approval, Assignment, Wait, Notification, AI, Subflow, End.

Examples:
- Helpdesk builder can expose `ticket.created` but Devices builder cannot.
- Devices can expose `create-helpdesk-ticket` as an approved cross-module action.
- Assets can expose `notify-owner` through the shared notification provider.
- Admin privileged actions require admin-specific permissions.

This preserves one engine without creating one confusing global authoring surface.

## 6. Permissions

Replace generic product permissions with module-owned permissions:
- `helpdesk.automation.view`
- `helpdesk.automation.manage`
- `helpdesk.automation.run.view`
- `devices.automation.view`
- `devices.automation.manage`
- `devices.automation.run.view`
- `assets.automation.view`
- `assets.automation.manage`
- `assets.automation.run.view`
- `admin.automation.view`
- `admin.automation.manage`
- `admin.automation.run.view`

Do not use one generic permission to cross module boundaries.

## 7. Migration from current Step 45C

Keep:
- `@inno/ui/workflow`
- React Flow / ELK
- persisted definitions
- immutable definition versions
- ETag / If-Match concurrency
- create/update/delete audit
- existing workflow database history as migration input

Change:
1. add `ownerModule` to definitions and versions;
2. hide/remove standalone Dynamic Workflows launcher/navigation;
3. remove standalone Product routes after module routes are live;
4. route Helpdesk Automation to the shared builder first;
5. add module-scoped API facades and permissions;
6. add run history only after module ownership is enforced.

Legacy definitions without `ownerModule` must become `legacy_unassigned` and remain hidden from module UIs until explicitly assigned. Do not silently assume they belong to Helpdesk.

The technical project may remain named `Modules/Workflows` during migration to avoid risky renames. A later cleanup may rename it to Automation Core after behavior is stable.

## 8. Bilingual product decision

INNO.One will support both:
- `en-US`
- `th-TH`

This supersedes the old language contract that fixed Web Portal to English and Agent/Mobile to Thai.

Every supported product surface must be switchable:
- Web Portal
- Endpoint Agent
- Android Assets Mobile
- Keycloak/sign-in presentation where controllable
- server-generated notifications/templates
- workflow labels supplied by the product
- validation/errors shown to users

Routes, API field names, enum/status codes, permissions, event names and audit action codes remain language-neutral and must not be translated.

## 9. Locale resolution

Locale priority after sign-in:
1. explicit user preference;
2. organization default locale;
3. supported browser/device locale;
4. `en-US` fallback.

For an existing installation, migration keeps `en-US` as organization default to avoid surprising current users. New installations should choose the organization default during setup.

Profile & Settings gains:
- Language: English / Thai

Admin Center -> Platform Settings gains:
- Default language: English / Thai

Endpoint Agent:
- use mapped user's preference when available;
- otherwise organization default;
- allow a local user override only when policy permits.

Android Mobile:
- use signed-in user's preference;
- otherwise organization default;
- device locale is only a fallback.

## 10. Shared i18n package

Create a shared package:
- `@inno/i18n`

Recommended responsibilities:
- locale resolution
- translation lookup
- React provider/hooks
- locale-aware date/time/number formatting
- document `lang` ownership
- fallback behavior
- missing-key diagnostics in development

Catalog layout:
```text
packages/i18n/
  src/
    locales/
      en-US/
        common.json
        navigation.json
        workspace.json
        devices.json
        assets.json
        helpdesk.json
        admin.json
        reports.json
        workflow.json
      th-TH/
        ...same files...
```

Key examples:
- `common.actions.save`
- `common.states.loading`
- `navigation.helpdesk.automation`
- `helpdesk.automation.createTitle`
- `workflow.node.trigger`
- `workflow.run.failed`

Do not use English source text as the translation key.

## 11. Language-sensitive data

System UI text:
- stored in translation catalogs.

API/status/event/permission identifiers:
- language-neutral stable codes.

User-authored data:
- preserved exactly as entered;
- never auto-translated silently.

User-facing templates that legitimately need two authored versions may use a localized-content shape:
```text
defaultLocale
translations:
  en-US:
    subject
    body
  th-TH:
    subject
    body
```

Examples:
- notification templates
- remote-consent messages
- reusable email templates

Workflow structure itself stays language-neutral. Product-provided node names/descriptions are translation keys. User-supplied workflow name and custom labels are business content and remain as entered.

## 12. Date, number and time rules

API timestamps remain UTC ISO-8601.

UI renders in the effective user/organization time zone.

Use locale-aware formatting while keeping operational dates unambiguous. Thai UI should use Thai language with Gregorian calendar and Latin digits unless a future organization setting explicitly changes that behavior.

Recommended locale formatting target:
- English: `en-US`
- Thai: `th-TH-u-ca-gregory-nu-latn`

Audit/export machine identifiers remain stable regardless of UI language.

## 13. Error and notification localization

Backend APIs return:
- stable error code
- structured parameters
- correlation/trace data

Frontends translate known error codes.

Server-generated end-user messages select a locale from the target recipient or explicit template language.

Audit records store action codes and structured metadata, not translated prose. The Audit UI translates display labels at render time.

## 14. New implementation roadmap

The old Step 45D "Dynamic Workflow Execution & Run History" is superseded until module ownership and bilingual foundations are in place.

### Step 45D-R - Re-architecture freeze
Planning/documentation only:
- freeze this module ownership matrix;
- freeze module routes and permissions;
- freeze bilingual locale contract;
- update current handoff/roadmap references;
- define migration acceptance criteria.

### Step 45E - Bilingual foundation — COMPLETE
Implemented:
- `@inno/i18n`
- user locale preference
- organization default locale
- dynamic document language
- shared formatters
- Profile language switcher
- Admin default-language setting
- localized shell/common states/actions
- bilingual regression audits

Completion evidence: `INNO-One-Step45E-Bilingual-Foundation.md`.

No business module should add new hardcoded UI strings after this step.

### Step 45F - Helpdesk Automation consolidation — COMPLETE
Implemented:
- remove old simple Helpdesk Automation editor;
- mount shared React Flow builder under Helpdesk routes;
- add `ownerModule=helpdesk`;
- reuse Step 45C persistence/versioning;
- migrate Helpdesk permissions;
- remove Dynamic Workflows from Apps launcher;
- bilingual Helpdesk Automation UI;
- no generic global workflow navigation.

This is the first end-to-end proof of the new model.

Step45F is complete on `implementation/step45f-helpdesk-automation-consolidation`. Dedicated browser/runtime QA passed 105/105 with 8 screenshots, broad Product browser regression passed 1572/1572 across 60 concrete routes, and visual inspection passed after fixing the Helpdesk Automation list boundary spacing. Helpdesk ownership, persistence, bilingual behavior and responsive routing are now proven end-to-end.

### Step 45G - Shared execution + Helpdesk Run History — COMPLETE
Completed on `implementation/step45g-shared-execution-helpdesk-run-history`.

Delivered:
- shared execution contract and module executor boundary;
- persisted run + run-step history;
- worker recovery, persisted Wait and bounded retry policy;
- immutable workflow-version snapshot per run;
- Helpdesk `/automation/:id/runs` P10 Product surface;
- owner-scoped run API and `helpdesk.automation.run.view`;
- execution audit/outbox lifecycle evidence;
- real Helpdesk Assign Team / Escalate side effects with current RBAC + ticket-scope re-check;
- bilingual runtime status/error presentation;
- dedicated runtime QA 52/52 and broad Product browser 1590/1590 across 61 routes.

Frozen Step45G execution scope is deterministic linear execution: Trigger -> supported module action(s) -> Wait -> End. Condition/Branch/fan-out/fan-in/cycles are rejected explicitly before enqueue rather than simulated.

Step45G uses manual ticket-context enqueue. Transactional outbox persistence exists, but a central event dispatcher/consumer for automatic trigger-to-run dispatch is not yet implemented and must not be implied.

### Step 45H - Devices Automation & Remediation — COMPLETE

Completed on `implementation/step45h-devices-automation-remediation`.

Delivered:

- Devices-owned P02/P04/P10 Product routes under `/devices/automation`;
- focused WHEN / optional IF / THEN editor with no React Flow surface;
- shared definition/version persistence with `ownerModule=devices`;
- shared run history with managed-device context;
- module permissions `devices.automation.view/manage/run.view`;
- shared worker Devices owner mapping;
- real `devices.device.add_to_group` executor for active INNO.One-owned local static groups;
- current automation + Devices permission/scope re-checks;
- provider-owned group guard;
- idempotent membership remediation;
- bilingual Devices automation/runtime catalog.

Final evidence:

- Step45H static 127/127;
- dedicated API runtime 38/38;
- dedicated responsive/bilingual browser 86/86 with 16 screenshots;
- broad Product browser 1647/1647 across 63 routes after adding Devices Automation routes to the baseline;
- visual inspection passed;
- the real QA membership mutation was removed and verified with zero membership remaining;
- Web/i18n/UI builds PASS and full .NET solution remains 0 warnings / 0 errors.

High-impact remote actions remain deferred and must preserve normal authorization, consent and approval requirements.

### Step 45I - Assets Automation — COMPLETE
Completed on `implementation/step45i-assets-automation`.

Delivered:
- Assets-owned P02/P04/P10 Product routes under `/assets/automation`;
- focused WHEN / optional IF / THEN editor with no React Flow surface;
- shared immutable definition/version/run persistence with `ownerModule=assets`;
- triggers for lifecycle status, owner-unassigned, warranty expiry, baseline drift and Software License overuse;
- actions for Asset lifecycle update and cross-module Helpdesk Ticket creation;
- source-context permission preflight and action-specific permission preflight;
- runtime permission/scope re-checks before side effects;
- idempotent lifecycle remediation;
- real Asset -> Helpdesk Ticket `RelatedAssetId` linking;
- License -> Helpdesk Ticket without a false Asset relation;
- bilingual EN/TH Product/runtime catalogs;
- Step45I static 152/152;
- API runtime 56/56;
- dedicated responsive/bilingual browser 84/84 with 16 screenshots;
- broad Product browser 1704/1704 across 65 routes;
- full Web/.NET build gates green.

Automatic event-to-run dispatch is still not implemented; Step45I exposes explicit test-run enqueue only.

### Step 45J - Admin Approval Automation — DEFERRED
Deferred by product decision. No Step45J implementation was started.

If revived later, keep access/onboarding/offboarding flows constrained by strict privilege boundaries.

### Step 45K - Reports Product slice — COMPLETE
Reports now owns real P02/P06/P10/P05 Product routes, saved definitions, module-owned Devices/Assets/Helpdesk source readers, CSV generation/history/download, daily/weekly/monthly schedules, EN/TH Product copy and current permission/scope re-checks.

The shared `IReportGenerationService` is exposed through Contracts and accepts `automation` as a trigger so modules can opt into report generation through their own approved automation catalog. Step45K does not force a generic Report action into every module. Delivery in this slice is persisted/downloadable CSV; email/external storage delivery remains deferred.

### Step 45L - Endpoint Agent bilingual runtime
Implement Thai/English localization for real Agent runtime, including consent, ownership, request-help, offline/error states, and workflow-created user prompts.

### Step 45M - Android Mobile bilingual completion
Migrate scanner/history/result/error/task surfaces to the same locale model and verify user/org fallback behavior.

### Step 45N - Bilingual completion and cleanup
- migrate all remaining Web/Admin/Devices/Assets/Helpdesk/Reports strings;
- localize notification/template surfaces;
- remove legacy fixed-language assumptions;
- remove/deprecate standalone `/workflows` routes and generic permissions;
- clean legacy unassigned workflow definitions;
- freeze the new Language & Terminology Contract.

## 15. QA gates

### Automation
Each module automation slice must verify:
- correct module ownership
- no cross-module unauthorized nodes
- create/edit/version persistence
- stale ETag rejection
- run references immutable workflow version
- audit/event coverage
- permission denied states
- responsive builder at 1366 / 1024 / 768
- no standalone Dynamic Workflows launcher

### Bilingual
Required automated checks:
- every translation key exists in both `en-US` and `th-TH`;
- no raw user-facing hardcoded strings in migrated surfaces except approved business content;
- fallback never exposes translation keys;
- document `lang` follows active locale;
- dates/numbers/time zone render correctly;
- switching language preserves current route/resource;
- permissions do not change when locale changes;
- English and Thai layouts have no clipping/overflow.

Browser matrix:
- full smoke of all concrete routes in both locales;
- critical workflows at 1366 / 1024 / 768 in both locales;
- Agent and Mobile key flows in both locales;
- Keycloak/sign-in localization where supported.

## 16. Acceptance criteria

The re-architecture is complete when:
1. users cannot launch a standalone Dynamic Workflows App;
2. Helpdesk Automation uses the shared React Flow builder inside Helpdesk;
3. all workflow definitions have an explicit module owner;
4. each module sees only its approved trigger/action catalog;
5. execution uses immutable definition versions;
6. Web, Agent and Mobile can render both Thai and English;
7. user locale and organization default persist correctly;
8. APIs/events/audit remain language-neutral;
9. all active routes pass bilingual and responsive QA;
10. legacy fixed-language and generic workflow navigation contracts are removed or explicitly deprecated.

## 17. Immediate next action

Step 45E, Step 45F, Step 45G, Step 45H, Step 45I and Step 45K are complete. The old global Step45D direction remains retired.

**Step 45J - Admin Approval Automation is deferred by product decision and was not implemented.**

Next implementation is **Step 45L - Endpoint Agent bilingual runtime**.

Reason:
The Web Product now has bilingual foundations across Helpdesk, Devices, Assets and Reports, while Endpoint Agent is still boundary-only. Step45L should implement the real Agent runtime in Thai and English for consent, ownership confirmation, Request Help, offline/error states and explicitly contracted workflow-created prompts without moving Agent-owned interactions into normal Web navigation.
