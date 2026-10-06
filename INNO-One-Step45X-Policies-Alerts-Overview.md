# Step45X — Endpoint Policies + Active Alerts + Devices Overview

Date: 2026-10-06
Branch: `implementation/step45x-policies-alerts-overview`
Base: Step45W checkpoint `eec6f72`

## Status

**COMPLETE — IMPLEMENTED + VERIFIED**

Step45X completes the frozen Devices TOR navigation slice with real Product-owned Overview, Endpoint Policies, Policy Compliance, Active Alerts, Alert Rules, Alert Channels, Alert History, permissions, persistence, evaluator behavior, audit/event records, responsive UI, and final Devices navigation.

No merge to `main` and no Linux Web/API release deployment were performed.

## Final Devices navigation

The production Devices context navigation now exposes the frozen 11 jobs in canonical order:

1. Overview
2. Devices
3. Discovery
4. Device Groups
5. Remote Operations
6. Remote Consent
7. Inventory Query
8. Deployment Jobs
9. Agent Maintenance
10. Endpoint Policies
11. Active Alerts

Legacy Agent Deployment remains available only as a compatibility route and is hidden from normal navigation. Device Automation remains retired.

## Persistence

Added the seven frozen Devices-owned tables:

- `devices.endpoint_policies`
- `devices.policy_assignments`
- `devices.policy_compliance`
- `devices.device_alerts`
- `devices.device_alert_rules`
- `devices.alert_channels`
- `devices.alert_delivery_history`

Migration:

- `20261006054134_Step45XPoliciesAlertsOverview`

The migration is additive-only in `Up()`: it creates the seven tables plus indexes/foreign keys and does not drop or alter prior Devices tables.

The migration was applied successfully to the shared development PostgreSQL environment at `172.10.1.58`.

## Permissions

Promoted the frozen permissions into the Platform development seed and repair path:

- `devices.policy.manage`
- `devices.alert.view`
- `devices.alert.manage`

Effective Device scope remains authoritative for Overview, policy visibility/compliance, active alerts, alert history, and scoped rule operations.

## API

Implemented all 16 frozen Step45X operations:

- `GET /devices/overview`
- `GET /devices/policies`
- `GET /devices/policies/{policyId}`
- `PUT /devices/policies/{policyId}`
- `GET /devices/policies/{policyId}/compliance`
- `GET /devices/alerts`
- `POST /devices/alerts/{alertId}/acknowledge`
- `POST /devices/alerts/acknowledge-all`
- `GET /devices/alert-rules`
- `GET /devices/alert-rules/{ruleId}`
- `POST /devices/alert-rules`
- `PUT /devices/alert-rules/{ruleId}`
- `GET /devices/alert-channels`
- `PUT /devices/alert-channels`
- `POST /devices/alert-channels/tests`
- `GET /devices/alert-history`

## Evidence-truthful policy evaluation

Step45X seeds Product policy definitions for:

- USB Storage Control
- Remote Consent
- Screen Capture
- Agent Update

Policy configuration is deliberately separate from compliance evidence.

- Agent Update evaluates the reported `Device.AgentVersion` against the configured target release.
- USB Storage Control remains `pending` until Endpoint Agent evidence exists.
- Remote Consent remains `pending` per device where the Product control-plane policy exists but device-specific enforcement evidence is not reported.
- Screen Capture is created as a draft/unassigned policy and can remain outside an effective scoped policy collection until assigned.
- Missing evidence is never treated as compliant.

Compliance is materialized into `policy_compliance` and stale scope rows are removed.

## Evidence-truthful alert evaluation

Step45X seeds Product alert rules for:

- Offline anomaly by Device Group
- Hardware change detected
- Software inventory changed
- Asset baseline drift

Only Offline Anomaly is evaluated immediately because current Device connectivity is real evidence available in the Devices module.

Hardware, Software, and Baseline Drift rules are registered but do not fabricate alert instances until comparable trusted observations exist.

The evaluator creates/resolves `device_alerts` from real connectivity state and emits `device.alert.created` when a new evidence-backed condition opens.

Alert acknowledgement writes both audit and outbox evidence. Rule changes emit `device.alert.rule.updated`.

## Alert channels

Product-owned channels:

- Console
- Sound
- Email

Console/Sound can be healthy inside the Product surface.

Email does not claim external mail delivery without configuration. The UI explicitly explains that external delivery is not fabricated.

Channel tests use the canonical operation ledger and return terminal Product configuration-check evidence instead of pretending an external provider delivered a message.

## Web Portal

Added real production surfaces:

- `/devices/overview`
- `/devices/policies`
- `/devices/policies/:policyId`
- `/devices/policies/:policyId/compliance`
- `/devices/alerts`
- `/devices/alerts/rules`
- `/devices/alerts/rules/new`
- `/devices/alerts/rules/:ruleId`
- `/devices/alerts/channels`
- `/devices/alerts/history`

Visual QA identified and fixed two polish gaps before completion:

- Alert sub-navigation was visually concatenated; it is now a responsive Product tab strip.
- Overview OS/manufacturer distributions and managed-device rows lacked visual structure; they now use responsive bars and structured activity rows.

The final screenshots were visually inspected at desktop and compact widths.

## Runtime bug found and fixed

Runtime QA found one real EF Core query bug in `GET /devices/alerts`.

The first implementation ordered alerts through the local helper `SeverityRank(...)`, which EF Core could not translate to SQL and returned HTTP 500.

The query was corrected to an EF-translatable conditional severity ordering expression. A clean .NET rebuild and runtime QA then passed.

## QA

Static / contract:

- Step45X audit: **229 / 229 PASS**
- Step45Q Devices TOR audit: **84 / 84 PASS**
- API contract: **191 operations / 153 unique paths / 0 issues**
- Data model contract: **95 total tables / 0 issues**
- Event/Audit contract: **38 events / 70 audit actions / 0 issues**
- Implementation contract: **43 existing permissions / 33 reserved / 0 issues**
- `git diff --check`: PASS

Build:

- .NET solution clean build after runtime fix: **0 warnings / 0 errors**
- Web TypeScript typecheck: PASS
- Web production build: PASS
- Vite: **2265 modules transformed**
- Existing chunk-size warning only; no build failure

Runtime API/DB:

- **83 checks PASS**
- Devices visible in effective QA scope: **8**
- Agent Update compliance rows: **8**
- Active alerts at verification time: **0**
- Alert history at verification time: **0**
- Empty alert state is truthful because no current evidence-backed alert condition is active

Browser / visual:

- **84 / 84 PASS**
- **0 failures**
- **8 screenshot checkpoints**
- widths: **1366px + 768px**
- no page-level overflow on Overview / Policies / Alerts / Rules / Channels / History
- policy detail and compliance rows verified
- final 11-job Devices navigation verified by route href and order
- final screenshots visually inspected after UI polish

## Existing Step45V blocker

The separate Step45V live MeshCentral control-auth blocker `noauth (noauth-2d)` remains unresolved and recorded. Step45X does not claim that blocker was fixed.

## Merge state / next scope

Step45X completes the currently frozen Devices TOR navigation sequence through Overview, Endpoint Policies, and Active Alerts.

Do not merge `main` without explicit user instruction.

Do not invent a Step45Y scope from this checkpoint. The next implementation slice should be explicitly frozen/approved from the roadmap or user direction.



# UX consistency follow-up — 2026-10-06

User review identified two visual regressions in the newly implemented Devices surfaces.

Fixed:

- Restored the canonical Devices contextual-navigation grouping from the approved prototype:
  - WORKSPACE: Overview, Devices, Discovery, Device Groups, Remote Operations, Remote Consent, Inventory Query
  - OPERATIONS: Deployment Jobs, Agent Maintenance, Policies, Alerts, Reports
- Restored the Reports shortcut under Devices Operations when the user has `reports.view`.
- Changed the Devices sidebar labels from `Endpoint Policies` / `Active Alerts` back to the canonical compact labels `Policies` / `Alerts`.
- Standardized top-level Step45V/W/X Web pages to the normal `INNOPage` page-header pattern without a leading title icon:
  - Remote Operations
  - Remote Consent
  - Deployment Jobs
  - Agent Maintenance
  - Agent Updates / Software Maintenance / Restart Operations / Maintenance History
  - Endpoint Policies
  - Policy Compliance
  - Active Alerts / Rules / Channels / History
- Kept `INNOResourceHeader` with a resource icon only on true Resource Detail pages such as an individual Deployment Job or Endpoint Policy, matching Device / Asset / Ticket detail behavior.
- Restored the Agent Maintenance sub-navigation: Overview / Agent Updates / Software / Restart / History.

QA after the follow-up:

- Web TypeScript typecheck: PASS
- Web production build: PASS, 2265 modules transformed
- Step45W browser regression: 87 / 87 PASS
- Step45X browser regression: 84 / 84 PASS
- Step45X static audit: 229 / 229 PASS
- Step45Q Devices TOR audit: 84 / 84 PASS
- Action/Layout audit: 0 issues
- Component Consistency audit: 0 issues
- Responsive Pass audit: 0 issues
- git diff --check: PASS
- Visual screenshots inspected at 1366 and 768; no page-level overflow. Desktop Devices sidebar now visibly contains the WORKSPACE / OPERATIONS split and Reports shortcut.

No backend behavior changed. Step45V live MeshCentral `noauth (noauth-2d)` blocker remains unchanged. Do not merge `main` without explicit user instruction.
