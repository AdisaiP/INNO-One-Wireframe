# INNO.One - Step 45K Reports Product Slice

**Status:** COMPLETE
**Branch:** `implementation/step45k-reports-product-slice`
**Base:** Step45I completion `18a15a8`
**Step45J:** Deferred by product decision; not implemented
**Next:** Step 45L - Endpoint Agent bilingual runtime

## Goal

Turn Reports from a registered backend/Web placeholder into a real Product slice focused on:

- reusable saved report definitions;
- module-owned data sources;
- current permission/scope enforcement at generation time;
- persisted report runs and downloadable CSV output;
- scheduled report generation;
- EN/TH Product UI;
- an integration boundary that other modules can opt into without creating a standalone Workflow Product.

Reports remains the owner of report definitions, generation, schedules, runs and output.

## Product routes

Step45K owns five Report screens:

- `/reports` - P02 saved report list;
- `/reports/new` - P06 report builder;
- `/reports/:reportId` - P06 report editor;
- `/reports/:reportId/runs` - P10 generation history;
- `/reports/schedules` - P05 schedule management.

The current Product interaction matrix contains **75** classified screens.

## Report sources

Reports reads business data only through module-owned `IReportSourceReader` contracts.

### Devices

Source key:

- `devices.inventory`

Required permission:

- `devices.view`

The reader re-evaluates current device visibility, organization, location and device-group scope before returning rows.

### Assets

Source key:

- `assets.inventory`

Required permission:

- `assets.view`

The reader re-evaluates current organization/location scope and linked-device group visibility before returning rows.

### Helpdesk

Source key:

- `helpdesk.tickets`

Required permission:

- `helpdesk.ticket.view`

The reader limits rows to current requester/assignee visibility and permitted organization scope.

Reports does not query another module's tables directly from its own generation service.

## Definition model

A saved report stores:

- name;
- description;
- source key;
- selected columns;
- optional filters;
- output format;
- immutable version number;
- ETag / If-Match concurrency state;
- created/updated metadata.

Step45K output format is deliberately limited to **CSV**.

Supported filters use the source-approved filter field catalog and:

- equals;
- not equals;
- contains.

## Permissions

Reports Product permissions:

- `reports.view`;
- `reports.create`;
- `reports.manage`.

Generation performs two independent permission layers:

1. current `reports.create`;
2. current permission/scope for the selected source module.

A saved report never preserves historical authority.

If access changes after the definition was saved, the next run uses the new current access state.

## Runs and output

A generation run persists:

- Report ID and version snapshot;
- report name;
- trigger;
- status;
- requester user/subject;
- row count;
- CSV file name/MIME;
- generated CSV text;
- timestamps;
- error code/detail when generation fails.

Supported trigger values are:

- `manual`;
- `schedule`;
- `automation`.

The HTTP Product endpoint uses `manual`.

The schedule worker uses `schedule`.

The shared `IReportGenerationService` contract accepts `automation` so a module automation can opt into report generation through the Reports boundary when that module adds an approved catalog action.

Step45K intentionally does **not** insert a generic Generate Report action into every module's automation catalog.

## Output security

Persisted CSV is scope-sensitive.

The download endpoint therefore requires:

- current `reports.view`;
- the requesting user to be the same user whose current scope generated the run.

This prevents another Reports viewer from downloading output generated under a broader user's scope.

## Schedules

Reports owns scheduled generation.

A schedule stores:

- name;
- report;
- daily / weekly / monthly cadence;
- time zone;
- hour/minute;
- optional day of week/month;
- enabled state;
- next run;
- last run;
- version/ETag;
- creator user and subject.

The worker executes a due schedule using the creator identity recorded on the schedule.

`ReportGenerationService` then re-checks the creator's current:

- `reports.create`;
- source permission;
- source resource scope.

The schedule therefore does not retain permission simply because it was created earlier.

## Delivery boundary

Step45K delivery is intentionally narrow:

```text
Generate
  -> persist run/output
  -> download CSV
```

Email delivery, external storage delivery and additional formats such as PDF/XLSX are not implemented in Step45K.

They can be added behind Reports-owned contracts without changing source-module ownership.

## Audit

Reports writes module-tagged audit evidence into the shared audit ledger for definition/run lifecycle actions, including correlation/trace context.

## Web UX

### P02 Reports

- searchable report collection;
- source and output format;
- Generate;
- Run History;
- Edit;
- pagination;
- Empty / No Results / Loading / Error states.

### P06 Report builder

- Report name;
- description;
- source selection;
- source-specific columns;
- optional source-approved filters;
- CSV output indicator;
- canonical editor footer;
- localized source/column/data-type labels.

### P10 Run History

- Generate Report;
- persisted run status/version/trigger/row count;
- CSV download;
- localized statuses;
- pagination.

### P05 Schedules

- report schedule collection;
- create/edit dialog;
- daily/weekly/monthly cadence;
- time-zone-aware next run;
- enabled switch;
- destructive delete confirmation.

## App shell

Reports is now a real permission-gated Product surface.

- App rail entry requires `reports.view`;
- Reports context navigation exposes Reports and Report Schedules;
- narrow Web uses the existing compact context-navigation behavior;
- the previous generic "outside the currently enabled production modules" placeholder no longer appears on Reports routes.

## Bilingual

Step45K adds and registers:

- `packages/i18n/src/locales/en-US/reports.json`;
- `packages/i18n/src/locales/th-TH/reports.json`.

Coverage includes:

- route/page headings;
- report builder;
- source names;
- source columns;
- data types;
- filters/operators;
- run history;
- schedules;
- validation/result copy;
- Empty/No Results states.

English/Thai key parity is enforced by the Step45K static audit.

## Persistence

Reports now owns real EF persistence in schema `reports`:

- `report_definitions`;
- `report_runs`;
- `report_schedules`.

Migration:

- `20261005035512_Step45KReportsProductSlice`.

Final EF check:

```text
No changes have been made to the model since the last migration.
```

## Dedicated API runtime QA

Final:

```text
step45k_api_checks=49
step45k_api_failures=0
```

Proven against real Keycloak/PostgreSQL runtime:

- Reports permissions;
- source catalog;
- Devices report create/read/generate/history/detail/download;
- Assets report create/read/generate/history/detail/download;
- Helpdesk report create/read/generate/history/detail/download;
- real CSV MIME/content;
- report source persistence;
- stale ETag -> 412;
- current ETag update;
- schedule create/list/update/enable;
- next-run calculation;
- schedule cleanup;
- report soft-delete cleanup.

## Dedicated responsive/bilingual browser QA

Final:

```text
step45k_browser_checks=109
step45k_browser_failures=0
step45k_browser_screenshots=21
```

Covered:

- real Keycloak login;
- 1366 / 1024 / 768;
- P02/P06/P10/P05 Reports routes;
- no horizontal overflow;
- real UI-dispatched report generation;
- persisted completed run/output;
- EN/TH;
- Thai source localization;
- Reports shell context instead of placeholder;
- locale restore;
- QA report cleanup.

Representative screenshots were visually inspected.

## Broad Product regression

Final:

```text
step42_routes=68
step42_browser_checks=1789
step42_browser_failures=0
```

The broad matrix includes Reports list/new/schedules and all prior dynamic Product routes.

## Static/regression QA

Final verified chain:

```text
Step45K static              199/199
Step45A roadmap              80/80
Step45I regression          152/152
Step45H regression          127/127
Step45G regression          135/135
Step45F regression          135/135
Step45E bilingual            87/87
Step30 module contract       issues=0
Language / terminology       issues=0
```

## Builds

Final gates:

- `@inno/i18n` build: PASS;
- `@inno/ui` build: PASS;
- Web typecheck: PASS;
- Web production build: PASS;
- Web build transformed **2262 modules**;
- full .NET solution: **0 warnings / 0 errors**;
- Reports EF pending model changes: none;
- `global.json` restored to SDK `10.0.103`.

Existing large Web/workflow chunk warnings remain warnings only.

## Deferred

Not part of Step45K:

- PDF/XLSX output;
- email delivery;
- external file-storage delivery;
- a generic global Report workflow action;
- Step45J Admin Approval Automation;
- Meeting Product work.

## Next

**Step 45L - Endpoint Agent bilingual runtime**

Implement the real Endpoint Agent runtime in Thai/English while preserving Agent surface ownership for consent, ownership confirmation, Request Help, offline/error states and workflow-created user prompts.

Do not merge this branch to `main` unless the user explicitly asks.
