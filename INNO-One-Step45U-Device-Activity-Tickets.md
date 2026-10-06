# INNO.One â€” Step45U Device Activity + Related Helpdesk Tickets

**Date:** 2026-10-06
**Status:** IMPLEMENTED + VERIFIED
**Branch:** `implementation/step45u-activity-tickets`
**Base:** Step45T commit `14373f3`

## Scope

Step45U completes the frozen nine-tab Device Detail contract.

Device Detail now exposes exactly:

`Overview â†’ Hardware â†’ Software â†’ Performance â†’ Processes â†’ Services â†’ Network â†’ Activity â†’ Tickets`

Unknown `?tab=` values still fall back to Overview.

## Activity

Canonical operation:

`GET /devices/{deviceId}/activity?page=<page>&pageSize=<pageSize>`

Permission: `devices.view`
Scope: effective Device resource scope
Response: paged timeline

Activity is implemented as a Product projection over the canonical INNO.One audit ledger:

`audit.audit_records`

The query is restricted to Devices-owned Device-target events and is ordered newest first.

The endpoint:

- verifies the canonical `dev_...` Device ID,
- enforces Device resource scope,
- resolves opaque user actor IDs through Platform Directory,
- returns event time and audit classification,
- exposes only an allowlist of Product-safe metadata for known Device actions,
- never exposes raw MeshCentral/vendor payloads,
- remains readable while the Device is offline.

Known projected Device actions currently include:

- software inventory observed,
- Process termination,
- Service action.

Future Device lifecycle steps may extend the projection with additional canonical audit events without changing the public Activity API.

### No duplicate Activity table

Step45Q reserved `devices.device_activity_items` as a possible bounded read model.

Step45U intentionally does **not** create that table because the canonical audit ledger already satisfies the current Product query without dual-writing the same events.

The physical read-model table remains deferred and may be introduced later only if measured query volume/latency requires materialization.

This keeps one durable source of truth and avoids drift between audit history and a duplicate activity table.

## Audit classification correction

Step45U also corrects the Step45T audit writer path so sensitive endpoint actions now persist the classification required by the canonical Event/Audit contract:

- `devices.process.terminate` â†’ `restricted`
- `devices.service.action` â†’ `restricted`

The shared Devices ledger writer now accepts a validated classification argument while defaulting other Device audits to `internal`.

Historical development audit rows are not rewritten.

## Related Tickets

Tickets remain owned entirely by Helpdesk.

Existing operation:

`GET /helpdesk/tickets`

now accepts:

`relatedDeviceId=<canonical Device ID>`

The filter:

- validates `dev_...`,
- applies on Helpdesk's own `RelatedDeviceId` relation,
- preserves Helpdesk effective-scope enforcement,
- does not read Devices tables from Helpdesk,
- does not introduce `/devices/{deviceId}/tickets`,
- does not grant Helpdesk access because a user has `devices.view`.

### Independent permissions

Device Detail evaluates Helpdesk permission independently:

- Ticket list: `helpdesk.ticket.view`
- Create Ticket: `helpdesk.ticket.create`

A user may open Device Detail while the Tickets tab renders a tab-local Permission Denied state.

The Create Ticket action is hidden when the user lacks `helpdesk.ticket.create`.

Tickets remain available independently of Device online/offline connectivity.

## Create Ticket deep link

Device Detail opens:

`/helpdesk/tickets/new?relatedDeviceId=<deviceId>`

The Helpdesk Ticket Create page reads the query parameter and preselects the related Device when it is visible in the user's Device scope.

## Web behavior

Activity:

- paged canonical timeline,
- actor name resolution,
- event title/detail normalization,
- classification indicator,
- Refresh action,
- Empty/Loading/Error coverage,
- collection-local pagination.

Tickets:

- paged Helpdesk-owned list,
- Ticket Number links to Helpdesk Ticket Detail,
- priority/status/updated evidence,
- Create Ticket when permitted,
- tab-local Permission Denied,
- Empty/Loading/Error coverage,
- collection-local pagination.

Both tables keep narrow-screen horizontal scrolling inside the collection rather than creating page-level overflow.

## API/Data contracts

Step45U promotes one new API operation:

`devices.activity.list`

Canonical totals after promotion:

- API: **191 operations**
- unique API paths: **153**
- Devices operations: **71**

The existing Helpdesk operation `helpdesk.tickets.list` gains optional `relatedDeviceId`.

Data Model remains **95 planning tables** because no new physical Activity or Ticket table is introduced.

## Runtime verification

Focused browser/API QA authenticated through development Keycloak and used the shared development PostgreSQL.

Verified:

- Activity API returns real audit-backed Device rows,
- actor opaque IDs resolve to directory names,
- Activity metadata is limited to the canonical allowlist,
- related Helpdesk filter returns tickets whose detail references the requested Device,
- all nine Device Detail tabs render in frozen order,
- Activity and Tickets render at 1366 and 768 without page-level overflow,
- Create Ticket deep link preselects the related Device,
- unknown tab values fall back to Overview.

No Step45U release deployment to the Linux host was performed.

## QA

- Step45U static audit: **59 / 59**, issues 0.
- API Contract: **191 operations / 153 unique paths / 0 issues**.
- Event/Audit Contract: **66 actions / 0 issues**.
- Data Model Contract: **95 planning tables / 0 issues**.
- Implementation Contract: **0 issues**.
- Step45Q contract: **72 / 72**.
- Step45N bilingual audit: **4039 checks / 1975 keys / 0 raw-copy offenders / 0 failures**.
- Language/terminology audit: 0 issues.
- i18n build: PASS.
- Web TypeScript typecheck: PASS.
- Web production build: PASS, **2259 modules**.
- .NET solution build: **0 warnings / 0 errors**.
- Focused Step45U browser/runtime QA: **37 / 37**, 4 screenshots.
- Broad browser regression: **66 routes / 1734 checks / 0 failures** at 1366 / 1024 / 768.
- Activity/Tickets screenshots visually inspected at 1366 and 768.
- `git diff --check`: required before checkpoint.

## Next

Step45V â€” Remote Operations + Remote Consent end-to-end through MeshCentral.

The live MeshCentral control integration blocker remains `noauth (noauth-2d)`; Step45V must repair or otherwise resolve that authentication path before remote operations can be claimed complete.

Do not merge `main` without explicit user instruction.
