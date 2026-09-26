# INNO.One — Step 18 Helpdesk SLA & Automation

**Date:** 2026-09-26
**Status:** Completed
**Branch:** `implementation/step18-helpdesk-sla-automation`
**Implementation Contract:** 0.9.0
**API Contract:** 0.2.0
**Event & Audit Contract:** 0.3.0
**Data Model Contract:** 0.4.0
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0

## 1. Scope

Step 18 implements the frozen Helpdesk management jobs that follow Helpdesk Core:

**SLA Policy → Business Calendar → SLA Monitor → Pause / Resume → Escalation → Automation Rules**

Implemented API operations:

- `helpdesk.sla_policies.list`
- `helpdesk.sla_policies.update`
- `helpdesk.sla_monitor.get`
- `helpdesk.calendar.get`
- `helpdesk.calendar.update`
- `helpdesk.automation.list`
- `helpdesk.automation.get`
- `helpdesk.automation.create`
- `helpdesk.automation.upsert`

Implemented Web routes:

- `/helpdesk/sla`
- `/helpdesk/calendar`
- `/helpdesk/automation`
- `/helpdesk/automation/new`
- `/helpdesk/automation/:ruleId`

## 2. SLA policy behavior

Each SLA policy keeps:

- response target,
- resolution target,
- Business Calendar,
- applicability label,
- pause-on-requester-wait behavior,
- requester status-notification intent,
- breach reassign behavior,
- ordered escalation levels,
- version / ETag.

SLA policy updates require `helpdesk.sla.manage` and use If-Match concurrency.

## 3. Business Calendar

Step 18 implements the existing Business Calendar contract:

- default calendar,
- timezone,
- weekly working windows,
- seeded holiday exceptions,
- business-time addition/counting for SLA calculations.

Updating working hours recalculates unresolved ticket due dates for policies using that calendar.

Holiday import/custom holiday editing remains outside this slice because the frozen prototype explicitly marks it as future capability.

## 4. Pause / resume

The SLA worker recognizes the existing `waiting` ticket status.

When `pauseOnRequesterWait` is enabled:

- entering requester wait records `paused_at`,
- SLA state becomes `paused`,
- working time no longer advances,
- leaving wait calculates paused business minutes,
- response/resolution due dates are extended by paused business time,
- accumulated pause is retained for future elapsed calculations.

The current public API has no generic status-change operation, so Step 18 does not invent one. Pause/resume logic is implemented against the canonical status state and is exercised through the local QA harness.

## 5. Escalation

The periodic Helpdesk worker evaluates unresolved SLA timers.

At configured thresholds it emits:

- `sla.at_risk`
- `sla.escalated`

The default Development policy uses three ordered levels at 75%, 90% and 100%.

When breach reassignment is enabled, the configured level-3 team becomes the ticket queue while preserving assignment history.

## 6. Automation

Automation rules persist:

- rule name/type,
- trigger,
- scope,
- condition field/operator/value,
- primary action/value,
- active/paused state,
- order/version.

Supported Step 18 triggers:

- `ticket_created`
- `ticket_updated`
- `sla_at_risk`
- `status_changed`

Supported bounded actions:

- `assign_team`
- `set_priority`
- `escalate_manager_chain`

Each rule/ticket/trigger evaluation is idempotently recorded in `helpdesk.automation_executions`.

Automation definition management requires:

- `helpdesk.automation.view`
- `helpdesk.automation.manage`

Rule mutations use ETag / If-Match and `helpdesk.automation_rule.updated` audit records.

## 7. Persistence

Step 18 adds / activates Helpdesk-owned storage:

- `helpdesk.business_calendar`
- `helpdesk.business_calendar_entries`
- `helpdesk.automation_rules`
- `helpdesk.automation_executions`

It also extends:

- `helpdesk.sla_policies`
- `helpdesk.ticket_sla`

No cross-module database FK is introduced.

## 8. Web UX

Production React ports the frozen management patterns:

### SLA & Escalation

- active policy selector,
- response/resolution targets,
- Business Calendar reference,
- policy behavior switches,
- editable escalation levels,
- read-only live SLA monitor,
- canonical Save Policy footer.

### Business Calendar

- weekly working-day configuration,
- timezone,
- read-only holiday exceptions,
- SLA usage summary,
- canonical Save Calendar footer.

### Automation

- rule list with search/status/type filters,
- New Rule header action,
- dedicated rule editor,
- trigger / scope / condition / action fields,
- active/paused state,
- recent execution history,
- canonical Save Rule footer.

## 9. Deferred Step 16 re-validation

The explicit user decision remains unchanged: fresh Step 16 re-validation is deferred until before merge/release.

## 10. Completion checkpoint

Step 18 implementation and final QA are complete on `implementation/step18-helpdesk-sla-automation`.

Final verification:

- Step 18 runtime smoke: **PASS**.
- Step 18 audit: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET solution build: **PASS, 0 warnings / 0 errors**.
- EF pending-model checks for Helpdesk, Platform and Devices: **PASS**.
- Platform API readiness reports Implementation Contract **0.9.0**.
- Contract audit chain: **0 issues**.
- Frozen static UX audit chain: **0 issues**.
- Step 18 production route visual QA: **15 / 15 screens**, failures 0, at 1366 / 1024 / 768.
- Frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.

During runtime QA, the Business Calendar boundary was corrected so persisted SLA due dates are normalized to UTC before Npgsql writes `timestamp with time zone` values. The smoke harness also backdates far enough for breach escalation after requester-wait pause time is deducted.

Step 16 fresh re-validation remains deferred by explicit user request and must still be rerun before merge/release. Do not merge `main` without explicit user instruction.

## 11. Source of truth

- `INNO-One-Step18-Helpdesk-SLA-Automation.md`
- `inno-step18-helpdesk-sla-automation.json`
- `step18-helpdesk-sla-automation-audit.py`
- `production/scripts/step18-local-smoke.py`
