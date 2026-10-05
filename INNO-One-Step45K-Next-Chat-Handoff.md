# INNO.One - Step 45K Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step45k-reports-product-slice`
**Base:** Step45I `18a15a8`
**Step45J:** Deferred by user/product decision
**Next:** Step 45L - Endpoint Agent bilingual runtime

## Read first

1. `INNO-One-Step45K-Reports-Product-Slice.md`
2. `INNO-One-Automation-I18N-Rearchitecture-Plan.md`
3. `INNO-One-Step45I-Next-Chat-Handoff.md`
4. `INNO-One-Step45E-Bilingual-Foundation.md`

## Product boundary

Reports is now a real Web Product.

Routes:

```text
/reports
/reports/new
/reports/:reportId
/reports/:reportId/runs
/reports/schedules
```

Patterns:

- P02 Reports list;
- P06 Report builder/editor;
- P10 Run History;
- P05 Schedules.

Current Product interaction matrix: **75** screens.

## Data sources

Module-owned source readers:

- `devices.inventory` -> `devices.view`;
- `assets.inventory` -> `assets.view`;
- `helpdesk.tickets` -> `helpdesk.ticket.view`.

Each reader re-checks current source permission and resource scope.

Do not replace these boundaries with Reports-owned direct reads of another module's business tables.

## Permissions

Reports:

- `reports.view`;
- `reports.create`;
- `reports.manage`.

Generation must re-check current `reports.create` and current source access every run.

A saved report/schedule must never retain historical authority.

## Output security

CSV output is persisted with the run.

Download is restricted to the same user whose current scope generated the output.

Keep this guard:

```text
run.RequestedByUserId == current access.UserId
```

Do not weaken it to `reports.view` alone.

## Schedules

Daily / weekly / monthly schedules are implemented.

Schedule execution uses the schedule creator's stored subject/user identity, then `ReportGenerationService` performs fresh Reports/source permission and scope checks.

## Automation integration

Shared contract:

- `IReportGenerationService`;
- `ReportGenerationRequest`.

Trigger values support `automation`.

This is the module boundary for future/opt-in module automation actions.

Step45K does **not** insert a generic Generate Report action into every module's automation catalog. A module should add that action only when its own Product contract approves the use case.

## Current delivery scope

Implemented:

- persisted generation result;
- downloadable CSV;
- scheduled generation.

Deferred:

- PDF;
- XLSX;
- email delivery;
- external storage delivery.

## Bilingual

Reports EN/TH catalogs are registered.

Source names, column labels, data types, headings, actions, filters, runs and schedules are localized.

## QA

```text
Step45K static              199/199
Step45K API runtime          49/49
Step45K browser             109/109
Step45K screenshots              21
Broad Product             1789/1789
Broad routes                    68
Step45A roadmap              80/80
Step45I regression          152/152
Step45H regression          127/127
Step45G regression          135/135
Step45F regression          135/135
Step45E bilingual            87/87
Step30 issues                    0
Language issues                  0
.NET warnings/errors             0/0
Reports pending model changes   none
```

Web/i18n/UI build gates PASS.

Visual inspection passed for representative desktop/narrow EN/TH states.

QA report/schedule data was cleaned after verification.

## Next: Step45L

Endpoint Agent bilingual runtime.

Before implementation:

1. inspect the current Endpoint Agent boundary/README and any existing native/runtime skeleton;
2. freeze real Agent routes/states for consent, ownership confirmation and Request Help;
3. preserve Web Portal vs Agent ownership;
4. use the existing Step45E locale preference/default model;
5. implement Thai/English key runtime states including offline/error;
6. integrate workflow-created Agent prompts only through an explicit Agent contract;
7. run dedicated runtime + bilingual/responsive/native-surface QA.

Step45J Admin Approval Automation remains deferred, not complete.

Do not merge Step45K to `main` unless explicitly requested.
