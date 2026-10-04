# INNO.One - Step 45H Devices Automation & Remediation

**Status:** IMPLEMENTATION COMPLETE - FINAL RUNTIME QA BLOCKED BY DEV INFRA
**Branch:** `implementation/step45h-devices-automation-remediation`
**Base:** Step45G `5eff479`
**Next gate:** restore dev Keycloak/PostgreSQL, rerun Step45H runtime + responsive browser QA, then Step 45I - Assets Automation

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
Step45H static              121/121
Step45G regression          135/135
Step45F regression          135/135
Step45E bilingual            87/87
Step45A roadmap              78/78
git diff --check             PASS
```

Python syntax:

- `step45h-devices-automation-api-qa.py`: PASS;
- `step45h-devices-automation-remediation-audit.py`: PASS.

Builds:

- `@inno/i18n` build: PASS;
- `@inno/ui` build: PASS;
- Web typecheck: PASS;
- Web production build: PASS;
- full `.NET` solution: **0 warnings / 0 errors**;
- `global.json` restored to SDK `10.0.103`.

Web production build retained the known large-chunk warnings for the main/workflow chunks. The Devices Step45H pages themselves remain small lazy chunks.

## Runtime QA status - BLOCKED BY DEV INFRA

A dedicated runtime API suite was added:

- `step45h-devices-automation-api-qa.py`.

It is designed to prove:

- E2E Keycloak token acquisition through `inno-one-e2e`;
- module-owned permissions;
- definition create/list/version persistence;
- real Trigger -> Add to Group -> End execution;
- real local group membership side effect;
- idempotent replay;
- immutable v1 run snapshot after later definition versions;
- WHEN mismatch rejection;
- IF mismatch rejection;
- provider-owned group guard when a provider group is available;
- version/run history;
- QA definition soft-delete.

Final execution could not reach the first authenticated API assertion because the shared dev host became unavailable.

Observed infrastructure failures:

- Keycloak `172.10.1.58:8080`: connection timeout;
- PostgreSQL `172.10.1.58:5432`: connection timeout;
- the local Platform API host shut down because Devices background workers threw DB connection failures and host behavior is configured to stop on unhandled background-service exceptions.

The API QA token request timed out before any Step45H definition/run/remediation mutation occurred, so there is no Step45H runtime side effect from the blocked final attempt requiring cleanup.

Headless browser QA was also abandoned for this gate after the same environment loss plus an unstable Chrome DevTools target. Do not claim responsive/browser runtime coverage is complete.

## Required final gate when infra is restored

1. Confirm Keycloak `172.10.1.58:8080` and PostgreSQL `172.10.1.58:5432` are reachable.
2. Start Platform API with the normal Step45 runtime overrides.
3. Run:
   ```text
   python step45h-devices-automation-api-qa.py
   ```
4. Run responsive Product browser QA for:
   - `/devices/automation`;
   - `/devices/automation/new`;
   - `/devices/automation/:automationId`;
   - `/devices/automation/:automationId/history`;
   at 1366 / 1024 / 768 and in English / Thai critical states.
5. Re-run broad Product regression.
6. Only after those gates are green, mark Step45H COMPLETE and begin Step45I.

## Next after final QA

**Step 45I - Assets Automation**

Do not merge this feature branch to `main` unless the user explicitly asks.
