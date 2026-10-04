# INNO.One - Step 45G Shared Execution + Helpdesk Run History

**Status:** COMPLETE
**Branch:** `implementation/step45g-shared-execution-helpdesk-run-history`
**Base:** `8a26cf5 test: complete step45f runtime qa`
**Next:** Step 45H - Devices Automation & Remediation

## Goal

Add a real shared automation runtime behind the Helpdesk-owned React Flow authoring surface without reviving a standalone Dynamic Workflows Product.

Step45G keeps definition state and execution state separate. Every run is pinned to an immutable workflow definition version and stores its own runtime snapshot, state, steps, audit evidence and integration events.

## Product boundary

- Helpdesk remains the Product owner of the full visual automation experience.
- Automation Core remains a technical module with no launcher.
- Run History lives at `/helpdesk/automation/:automationId/runs` and uses P10.
- There is no end-user `/workflows/:id/runs` surface or generic workflow run API.
- New run history permission: `helpdesk.automation.run.view`.
- Starting a run requires `helpdesk.automation.manage`.
- Module actions re-check their own permissions at execution time.

## Execution contract

Persisted run resources:

- `workflows.workflow_runs`
- `workflows.workflow_run_steps`

A run stores:

- workflow ID + immutable workflow version;
- owner module;
- immutable definition snapshot;
- business input;
- queued/running/waiting/completed/failed state;
- active/completed/failed node evidence;
- actor user ID + authentication subject;
- bounded retry state;
- timestamps and error evidence.

The worker reloads the persisted run snapshot. It never mutates or executes against the current editable definition.

## Step45G execution semantics

Step45G intentionally supports only a deterministic linear execution path.

Core runtime nodes:

- Trigger;
- Wait;
- End.

Helpdesk module executor currently performs real side effects for:

- `helpdesk.ticket.assign_team`;
- `helpdesk.ticket.escalate`.

Assign Team / Escalate:

- requires a support team;
- re-checks `helpdesk.ticket.assign`;
- re-checks Helpdesk ticket scope;
- writes the real ticket assignment;
- increments the ticket version;
- writes Helpdesk audit evidence;
- emits the canonical `ticket.assigned` outbox event;
- uses a run/node idempotency marker so worker replay does not duplicate the side effect.

Migrated Step45F definitions remain compatible because the executor accepts both `configuration.team` and legacy `configuration.actionValue`.

## Explicitly unsupported in Step45G

Condition/Branch execution is not guessed or simulated.

Definitions containing Condition/Branch, fan-out, fan-in, cycles, disconnected nodes or unsupported module actions are rejected before enqueue with an explicit 422 problem code.

Current important codes include:

- `AUTOMATION_BRANCHING_NOT_SUPPORTED`;
- `AUTOMATION_CYCLE_NOT_SUPPORTED`;
- `AUTOMATION_DISCONNECTED_GRAPH`;
- `AUTOMATION_NODE_NOT_EXECUTABLE`;
- `HELPDESK_TEAM_REQUIRED`;
- `AUTOMATION_WAIT_INVALID`.

This protects Product semantics until branching/decision behavior is frozen in a future execution slice.

## Scheduler / retry / recovery policy

- shared `WorkflowExecutionWorker` polls persisted queued/waiting runs;
- Wait persists `nextAttemptAt`;
- Step45G Wait duration is 0-300 seconds;
- retry is only used when the module executor marks a failure retryable;
- maximum attempts: 3;
- backoff: 1s, 2s, 4s (capped at 8s);
- interrupted running work is recovered on worker restart;
- current actor permission is re-evaluated before execution;
- permission revocation fails the run instead of continuing with a stale authorization snapshot.

## Manual enqueue boundary

Step45G exposes an explicit **Run Automation** action that requires a Helpdesk ticket context.

This is intentionally manual enqueue in Step45G. The repository already has a transactional outbox, but it does not yet have a central event dispatcher/consumer that can safely translate `ticket.created`, `ticket.status.changed`, SLA and other module events into workflow run requests.

Do not claim automatic trigger dispatch exists yet. Event-trigger consumption should be added only after the shared dispatch/idempotency contract is frozen.

## API

Helpdesk-owned endpoints:

```text
POST /api/v1/helpdesk/automations/{automationId}/runs
GET  /api/v1/helpdesk/automations/{automationId}/runs
GET  /api/v1/helpdesk/automations/{automationId}/runs/{runId}
```

Start performs graph/module configuration preflight before persisting a run. Invalid execution definitions return 422 and do not create run history.

## Audit and events

Run lifecycle writes audit + outbox evidence for:

- queued;
- started;
- retry scheduled;
- completed;
- failed.

Run audit remains owner scoped to Helpdesk. Module side effects continue to use the owning module's normal audit/event path.

## Web UX

New lazy-loaded `AutomationRunsPage`:

- P10 Run History;
- immutable execution boundary banner;
- Helpdesk ticket context selector;
- real Run Automation action;
- active-run polling;
- run history table;
- run detail drawer;
- immutable definition version;
- duration;
- persisted execution steps;
- localized runtime error/status presentation.

Builder runtime configuration now includes:

- support team for Assign Team / Escalate;
- Wait duration;
- validation before Save for required team and Wait range.

English and Thai catalogs include the runtime UI, step statuses and error presentation.

## Migration

`20261004175939_Step45GWorkflowExecutionRuns`

Creates the persisted run/step tables and supporting indexes/FK.

## QA final

Static/regression:

```text
Step45G static              135/135
Step45F regression          135/135
Step45E bilingual            87/87
```

Dedicated browser/runtime:

```text
step45g_browser_checks=52
step45g_browser_failures=0
step45g_browser_screenshots=5
```

Dedicated runtime proves:

- real Keycloak login;
- real dev PostgreSQL migration/seed;
- executable Helpdesk definition v1;
- Run History responsive at 1366 / 1024 / 768;
- real ticket context dispatch;
- real Assign Team side effect;
- persisted Wait;
- Trigger -> Assign Team -> Wait -> End, four completed steps;
- immutable v1 run snapshot remains unchanged after definition moves to v2/v3;
- missing team rejected before enqueue;
- migrated Condition graph explicitly rejected;
- English and Thai runtime rendering;
- ticket and locale restoration;
- QA definition cleanup.

Broad Product browser:

```text
step42_routes=61
step42_browser_checks=1590
step42_browser_failures=0
```

Build/schema:

- `@inno/i18n` build: PASS;
- `@inno/ui` build: PASS;
- Web typecheck: PASS;
- Web production build: PASS;
- full .NET solution: 0 warnings / 0 errors;
- Workflows EF pending model changes: none;
- Step45G migration SQL generation: PASS;
- `git diff --check`: PASS.

Visual evidence:

- `qa-step45g-helpdesk-automation-runs/1366__run-history-empty-en.png`
- `qa-step45g-helpdesk-automation-runs/1024__run-history-empty-en.png`
- `qa-step45g-helpdesk-automation-runs/768__run-history-empty-en.png`
- `qa-step45g-helpdesk-automation-runs/1366__run-history-completed-en.png`
- `qa-step45g-helpdesk-automation-runs/1366__run-history-completed-th.png`

The final English completed screenshot waits for all four persisted run steps before capture.

## Next

**Step 45H - Devices Automation & Remediation**

Keep the Devices Product model intentionally simpler than Helpdesk:

- module-owned WHEN / IF / THEN rules;
- safe remediation actions first;
- reuse shared execution contracts where appropriate;
- do not expose the full React Flow builder by default;
- preserve normal authorization, endpoint consent and approval requirements for high-impact actions.

Do not merge this branch to `main` unless the user explicitly asks.
