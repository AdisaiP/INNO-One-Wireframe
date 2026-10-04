# INNO.One - Step 45G Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step45g-shared-execution-helpdesk-run-history`
**Next:** Step 45H - Devices Automation & Remediation

## Read first

1. `INNO-One-Step45G-Shared-Execution-Helpdesk-Run-History.md`
2. `INNO-One-Automation-I18N-Rearchitecture-Plan.md`
3. `INNO-One-Step45F-Helpdesk-Automation-Consolidation.md`
4. `INNO-One-Step45E-Bilingual-Foundation.md`
5. `INNO-One-Step44G-Dynamic-Workflow-Foundation.md`

## Frozen Product boundary

- no standalone Dynamic Workflows end-user App;
- Automation Core stays technical-only with `launcher:false`;
- Helpdesk owns P02 Automation + P06 builder + P10 Run History;
- Helpdesk definitions and runs are owner-scoped;
- definition state and execution state remain separate;
- every run is pinned to workflow ID + immutable workflow version;
- runtime never rewrites immutable definition versions;
- Meeting stays outside this roadmap.

## Step45G implementation

Backend:

- persisted `workflow_runs` and `workflow_run_steps`;
- immutable definition snapshots per run;
- shared provider contract `IAutomationNodeExecutor`;
- shared background execution worker;
- restart recovery;
- persisted Wait scheduling;
- bounded retry policy;
- actor RBAC re-check during execution;
- audit + outbox lifecycle evidence;
- Helpdesk Assign Team / Escalate real ticket side effects;
- idempotent Helpdesk side effects.

API:

- POST `/api/v1/helpdesk/automations/:automationId/runs`;
- GET `/api/v1/helpdesk/automations/:automationId/runs`;
- GET `/api/v1/helpdesk/automations/:automationId/runs/:runId`;
- run history permission `helpdesk.automation.run.view`.

Web:

- `/helpdesk/automation/:automationId/runs`;
- lazy P10 Run History page;
- ticket context launcher;
- polling;
- detail drawer and persisted steps;
- Thai/English runtime status/errors;
- Assign Team and Wait configuration in builder.

## Execution semantics frozen for Step45G

Executable now:

- Trigger;
- Helpdesk Assign Team;
- Helpdesk Escalate;
- Wait;
- End.

Step45G executes one deterministic linear path only.

Not executable yet:

- Condition;
- Branch;
- graph fan-out/fan-in;
- cycles;
- unsupported module action catalogs.

Those shapes return explicit 422 problems before enqueue. Do not simulate them.

## Automatic trigger boundary

Step45G uses manual Run Automation enqueue with a Helpdesk ticket context.

The repository has transactional outbox persistence but no central dispatcher/consumer that safely converts module events into automation runs. Do not claim automatic trigger execution exists. Freeze that contract before adding event-trigger consumption.

## QA

- Step45G static: 135/135
- Step45F regression: 135/135
- Step45E bilingual: 87/87
- dedicated Step45G runtime/browser: 52/52, 0 failures, 5 screenshots
- broad Product browser: 1590/1590 across 61 routes, 0 failures
- responsive: 1366 / 1024 / 768
- Web/i18n/ui builds: PASS
- full .NET solution: 0 warnings / 0 errors
- Workflows EF pending model changes: none
- migration SQL generation: PASS
- visual inspection: PASS

## Next: Step45H

Devices Automation & Remediation must remain module-owned and should start from WHEN / IF / THEN rather than exposing full React Flow.

Before implementation:

1. inspect Devices event/action/remediation contracts already in the repo;
2. classify safe vs high-impact actions;
3. freeze permission/consent/approval semantics;
4. define which Devices rules reuse shared runtime and which remain Devices-native;
5. add Thai/English Product strings at the same time;
6. run dedicated + broad responsive QA.

Do not merge Step45G to `main` unless the user explicitly asks.
