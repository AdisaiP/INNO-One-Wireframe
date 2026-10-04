# INNO.One - Step 45H Devices Automation & Remediation

**Status:** COMPLETE
**Branch:** `implementation/step45h-devices-automation-remediation`
**Base:** Step45G `5eff479`
**Next:** Step 45I - Assets Automation

## Goal

Add a Devices-owned Automation & Remediation Product surface that reuses the shared automation persistence/runtime without exposing the full React Flow canvas.

The Step45H Product model is intentionally focused:

```text
WHEN -> optional IF -> THEN
```

The UI compiles that rule into the existing immutable workflow definition contract:

```text
Trigger -> Devices action -> End
```

## Frozen Devices boundary

Step45H does not invent high-impact remote operations.

Current repository inspection showed that the shared remote-device integration contract exposes group synchronization, node listing and enrollment capabilities, but does not expose safe runtime contracts for restart, shutdown, remote script execution or remote-session control.

Therefore Step45H ships one real remediation action only:

- `devices.device.add_to_group`

It may add a managed device only to an active, INNO.One-owned local static Device Group.

Explicitly not exposed in the Product editor:

- restart;
- shutdown;
- script execution;
- remote session;
- consent bypass;
- provider-owned group mutation.

High-impact remote automation remains deferred until the normal Devices permission + consent + approval contracts exist. Automation must never bypass those boundaries.

## Product routes

New module-owned routes:

- `/devices/automation` - P02 list;
- `/devices/automation/new` - P04 focused WHEN / IF / THEN editor;
- `/devices/automation/:automationId` - P04 edit/version route;
- `/devices/automation/:automationId/history` - P10 run history.

The Devices editor does not import `INNOWorkflowCanvas` and does not load React Flow CSS.

The Product screen interaction matrix now contains 66 patterns.

## Definition ownership and API

Step45H reuses the shared Workflows persistence tables with:

- `ownerModule=devices`;
- immutable definition versions;
- ETag / If-Match concurrency;
- owner-scoped audit actions.

Devices definition facade:

```text
GET    /api/v1/devices/automations
GET    /api/v1/devices/automations/{automationId}
POST   /api/v1/devices/automations
PUT    /api/v1/devices/automations/{automationId}
DELETE /api/v1/devices/automations/{automationId}
GET    /api/v1/devices/automations/{automationId}/versions
```

Run facade:

```text
POST /api/v1/devices/automations/{automationId}/runs
GET  /api/v1/devices/automations/{automationId}/runs
GET  /api/v1/devices/automations/{automationId}/runs/{runId}
```

A manual test run uses a managed `deviceId` context.

## WHEN / IF semantics

Step45H supports current-device preflight for:

WHEN:

- `device.online`;
- `device.offline`.

Optional IF fields:

- operating system;
- device type;
- status;
- Device Group membership.

Operators:

- equals;
- not equals;
- contains where meaningful.

The run endpoint reads the current managed-device context through the shared `IDeviceDirectoryReader` contract before enqueue.

A selected device that does not match WHEN returns:

- `DEVICES_TRIGGER_CONTEXT_MISMATCH`.

A selected device that does not match IF returns:

- `DEVICES_RULE_CONDITION_NOT_MATCHED`.

These failures happen before a run is persisted.

Step45H does not claim automatic event-to-run dispatch. Manual test-run enqueue remains the Product execution entry until a shared event dispatcher/consumer contract is frozen.

## Remediation executor

`DeviceAutomationNodeExecutor` registers through the shared `IAutomationNodeExecutor` boundary.

Execution re-checks:

1. `devices.automation.manage` in the shared worker;
2. `devices.manage` inside the Devices executor;
3. actor identity consistency;
4. current device scope;
5. current target group scope;
6. active static group eligibility;
7. provider ownership.

Provider-owned groups are blocked with:

- `DEVICES_GROUP_PROVIDER_OWNED`.

Out-of-scope resources are blocked with:

- `DEVICES_OUTSIDE_ASSIGNED_SCOPE`.

The action is idempotent: if the device is already in the target local group, the node completes successfully with `idempotentReplay=true` and does not duplicate membership.

A real mutation writes Devices-owned audit/outbox evidence:

- `devices.automation.remediation.group_added`;
- `device.group.membership.added`.

## Permissions

New module-owned permissions:

- `devices.automation.view`;
- `devices.automation.manage`;
- `devices.automation.run.view`.

Development seed grants them to Platform Admin only.

The Devices manifest exposes Automation only with `devices.automation.view`.

The shared execution worker now maps:

- `devices -> devices.automation.manage`

and writes owner-scoped run lifecycle audit prefixes under `devices.automation.run`.

## Web UX

New pages:

- `DevicesAutomationRulesPage.tsx`;
- `DevicesAutomationRulePage.tsx`;
- `DevicesAutomationHistoryPage.tsx`.

List:

- search;
- immutable version;
- status;
- Run History;
- Edit.

Focused editor:

- rule name;
- WHEN online/offline;
- optional IF;
- THEN read-only remediation type;
- local static target-group selector;
- create / save new immutable version.

Run History:

- managed-device test context;
- polling for active runs;
- persisted run table;
- P10 detail drawer;
- immutable definition snapshot labels;
- persisted run steps and errors.

Step45H pages are lazy-loaded except the small list surface. Production build emitted the editor/history chunks at roughly 8-10 KB each before gzip.

## Bilingual

Added:

- `packages/i18n/src/locales/en-US/devices.json`;
- `packages/i18n/src/locales/th-TH/devices.json`.

The catalog includes:

- list/editor/history UI;
- WHEN / IF / THEN labels;
- Devices trigger/action labels;
- runtime states;
- validation;
- known Devices automation error codes.

English/Thai key parity is enforced by the Step45H audit.

## Static/regression QA

Final local static chain:

```text
Step45H static              127/127
Step45G regression          135/135
Step45F regression          135/135
Step45E bilingual            87/87
Step45A roadmap              78/78
git diff --check             PASS
```

Python syntax:

- `step45h-devices-automation-api-qa.py`: PASS;
- `step45h-devices-automation-browser-qa.py`: PASS;
- `step45h-devices-automation-remediation-audit.py`: PASS;
- `step42-production-ux-browser-qa.py`: PASS.

Builds:

- `@inno/i18n` build: PASS;
- `@inno/ui` build: PASS;
- Web typecheck: PASS;
- Web production build: PASS;
- full `.NET` solution: **0 warnings / 0 errors**;
- `global.json` restored to SDK `10.0.103`.

Web production build retained the known large-chunk warnings for the main/workflow chunks. The Devices Step45H pages themselves remain small lazy chunks.

## Runtime/browser QA final

The restored dev infrastructure was used for final Step45H proof against real Keycloak and PostgreSQL.

Dedicated API runtime:

```text
step45h_api_checks=38
step45h_api_failures=0
```

The API suite proved:

- E2E Keycloak token acquisition through `inno-one-e2e`;
- module-owned permissions;
- definition create/list/version persistence;
- real Trigger -> Add to Group -> End execution;
- real local group membership side effect;
- idempotent replay;
- immutable v1 run snapshot after later definition versions;
- WHEN mismatch rejection before enqueue;
- IF mismatch rejection before enqueue;
- provider-owned group execution blocked with `DEVICES_GROUP_PROVIDER_OWNED`;
- version and run history;
- QA definition soft-delete.

The real membership created by the API test was removed after the assertion and verified with:

```text
MEMBERSHIP_DELETED=1
MEMBERSHIP_REMAINING=0
```

Dedicated responsive/bilingual browser QA:

```text
step45h_browser_checks=86
step45h_browser_failures=0
step45h_browser_screenshots=16
```

Browser coverage proves:

- list/editor/history at 1366 / 1024 / 768;
- no Product page horizontal overflow;
- focused editor does not mount React Flow;
- real Keycloak login;
- UI-dispatched run completes;
- existing-membership remediation is idempotent and non-mutating;
- persisted three-step run detail;
- final English run summary reaches Completed and resolves duration before screenshot capture;
- Thai list/editor/history critical states at 1366 / 768;
- Thai `document.lang`;
- organization and user locale restoration;
- QA definition cleanup.

Broad Product regression was updated to include the new static Devices Automation routes and passed:

```text
step42_routes=63
step42_browser_checks=1647
step42_browser_failures=0
```

Visual evidence was inspected, including the completed English P10 drawer and Thai mobile-width history. The final evidence shows the completed status, immutable v1 rule version, duration and all three completed execution steps.

## Next

**Step 45I - Assets Automation**

Do not merge this feature branch to `main` unless the user explicitly asks.
