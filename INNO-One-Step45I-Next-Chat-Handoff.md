# INNO.One - Step 45I Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step45i-assets-automation`
**Next:** Step 45J - Admin Approval Automation

## Read first

1. `INNO-One-Step45I-Assets-Automation.md`
2. `INNO-One-Automation-I18N-Rearchitecture-Plan.md`
3. `INNO-One-Step45H-Devices-Automation-Remediation.md`
4. `INNO-One-Step45G-Shared-Execution-Helpdesk-Run-History.md`
5. `INNO-One-Step45E-Bilingual-Foundation.md`

## Frozen Product boundary

- no standalone Dynamic Workflows Product;
- Assets owns Automation under `/assets/automation`;
- Assets uses focused WHEN / optional IF / THEN;
- do not expose React Flow in Assets by default;
- definitions/runs remain shared technical infrastructure;
- definitions use `ownerModule=assets`;
- current source permission and action permission are re-checked before side effects;
- manual Test Automation enqueue exists;
- automatic event-to-run dispatch does not exist yet;
- Meeting remains outside this roadmap.

## Routes

```text
/assets/automation
/assets/automation/new
/assets/automation/:automationId
/assets/automation/:automationId/runs
```

Patterns:

- P02 list;
- P04 create/edit;
- P10 history.

Current Product interaction matrix: **70** screens.

## Trigger catalog

Asset:

- `assets.asset.lifecycle_status`;
- `assets.asset.owner_unassigned`;
- `assets.asset.warranty_expiring`;
- `assets.asset.baseline_drift`.

Software License:

- `assets.license.overused`.

## Action catalog

- `assets.asset.set_lifecycle_status`;
- `helpdesk.ticket.create`.

## Permission contract

Module:

- `assets.automation.view`;
- `assets.automation.manage`;
- `assets.automation.run.view`.

Source:

- Asset -> `assets.view`;
- License -> `assets.license.manage`.

Action:

- lifecycle update -> `assets.manage`;
- Helpdesk ticket -> `helpdesk.ticket.create`.

Shared worker re-checks `assets.automation.manage`.

The module executor/service re-checks action permissions at execution time.

## Cross-module Helpdesk rule

Asset-created Tickets persist the real `RelatedAssetId`.

License-created Tickets intentionally have no Asset relation.

Do not replace this with a Workflows-owned direct Helpdesk DB write. The Helpdesk module owns Ticket creation through `IHelpdeskAutomationTicketCreator`.

## QA

```text
Step45I static             152/152
Step45I API runtime         56/56
Step45I browser             84/84
Step45I screenshots         16
Broad Product             1704/1704
Broad routes                    65
Step45H regression         127/127
Step45G regression         135/135
Step45F regression         135/135
Step45E bilingual           87/87
Step45A roadmap             78/78
Step30 issues                    0
Language issues                  0
.NET warnings/errors             0/0
```

Visual inspection passed at representative 1366 / 768 English and Thai states.

QA business mutations were cleaned:

- lifecycle restored through Assets API;
- QA Helpdesk Tickets deleted and verified absent;
- QA definitions soft-deleted;
- locale restored.

## Next: Step45J

Admin Approval Automation is a constrained privileged workflow slice.

Before implementation:

1. inspect existing access request / role / account lifecycle / onboarding contracts;
2. freeze which operations can be automated and which require an Approval node or explicit human confirmation;
3. preserve existing Admin RBAC and audit semantics;
4. never allow an automation to gain privileges beyond its current actor/service identity;
5. keep Product ownership inside Admin Center;
6. add EN/TH Product strings at the same time;
7. run dedicated runtime + responsive/bilingual + broad QA.

Do not merge Step45I to `main` unless explicitly requested.
