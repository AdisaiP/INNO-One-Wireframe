# INNO.One — Step 17 Helpdesk Core

**Date:** 2026-09-26
**Status:** ✅ COMPLETED
**Branch:** `implementation/step17-helpdesk-core`
**Implementation Contract:** 0.8.0
**API Contract:** 0.2.0
**Event & Audit Contract:** 0.3.0
**Data Model Contract:** 0.4.0
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0

## 1. Scope

Step 17 implements the first real Helpdesk vertical slice through the existing production skeleton:

**Create Ticket → Scoped Ticket Queue → Ticket Detail → Reply → Assignment → SLA → Resolve**

The implementation reuses the frozen Helpdesk Web patterns and keeps Platform / Devices ownership boundaries intact.

Implemented API operations:

- `helpdesk.overview.get`
- `helpdesk.tickets.list`
- `helpdesk.tickets.get`
- `helpdesk.tickets.create`
- `helpdesk.tickets.reply`
- `helpdesk.tickets.reassign`
- `helpdesk.tickets.resolve`
- `helpdesk.categories.tree`
- `helpdesk.statuses.list`

Implemented Web routes:

- `/helpdesk`
- `/helpdesk/tickets`
- `/helpdesk/assigned`
- `/helpdesk/team`
- `/helpdesk/tickets/new`
- `/helpdesk/tickets/:ticketId`

## 2. Authorization

Helpdesk uses the same server-authoritative `IAccessEvaluator` introduced in Step 15.

Core permissions:

- `helpdesk.ticket.view`
- `helpdesk.ticket.create`
- `helpdesk.ticket.reply`
- `helpdesk.ticket.assign`
- `helpdesk.ticket.resolve`

Ticket reads are scope-filtered before pagination.

A ticket is visible when one of these conditions is true:

- the access assignment has `all` scope,
- the requester Organization is inside the caller's effective Organization scope,
- the caller is the requester,
- the caller is the current assignee.

The local Development fixture includes:

- Platform Admin — Helpdesk core actions across the root Organization.
- Support Agent — ticket view/create/reply/assign/resolve.
- HR scoped employee/viewer — view/create only inside HR scope.

## 3. Data ownership

Step 17 creates Helpdesk-owned production tables for the implemented slice:

- `helpdesk.tickets`
- `helpdesk.ticket_replies`
- `helpdesk.ticket_assignments`
- `helpdesk.ticket_status_history`
- `helpdesk.sla_policies`
- `helpdesk.ticket_sla`
- `helpdesk.categories`
- `helpdesk.statuses`

Cross-module references remain stable IDs only:

- requester/assignee User IDs reference Platform conceptually,
- requester Organization ID references Platform conceptually,
- related Device ID references Devices conceptually,
- no PostgreSQL FK crosses Helpdesk → Platform / Devices / Assets.

Same-module relationships use normal FKs.

## 4. Cross-module read contracts

Helpdesk does not query Platform or Devices tables directly.

Shared query contracts now include:

- `IPlatformDirectoryReader.ReadUsersAsync`
- `IPlatformDirectoryReader.SearchUsersAsync`
- `IDeviceDirectoryReader.ReadAsync`

Platform owns User/Organization display data.

Devices owns safe Device display context and scope fields.

MeshCentral identifiers remain behind the Devices adapter and never enter Helpdesk responses.

## 5. Ticket creation

Create Ticket resolves the requester from the authenticated INNO.One profile.

The request captures:

- subject,
- description,
- category,
- impact,
- urgency,
- optional related Device.

Priority is resolved from impact/urgency unless an explicit valid P1–P4 priority is supplied.

A ticket creates:

- canonical ticket,
- initial status history,
- resolved SLA targets,
- `helpdesk.ticket.created` audit record,
- `ticket.created` transactional outbox fact.

Ticket number format remains `HD-<year>-<opaque sequence>`.

## 6. Ticket lifecycle

### Reply

A support reply:

- creates a conversation entry,
- records `helpdesk.ticket.replied`,
- records first-response time in `ticket_sla`,
- moves an Open ticket to In Progress on the first public support reply,
- writes `ticket.status.changed` when that transition occurs.

Internal notes stay explicitly marked `internal`.

Ticket/reply body text is not copied into audit or integration-event payloads.

### Assignment

Assignment:

- requires `helpdesk.ticket.assign`,
- validates the target Platform user through the shared directory contract,
- writes immutable assignment history,
- writes `helpdesk.ticket.assigned` audit,
- writes `ticket.assigned` outbox fact,
- supports ETag / If-Match concurrency.

### Resolve

Resolve:

- requires `helpdesk.ticket.resolve`,
- changes status to Resolved,
- records status history,
- finalizes SLA state,
- writes `helpdesk.ticket.status_changed`,
- writes `helpdesk.ticket.resolved`,
- writes `ticket.status.changed`,
- writes `ticket.resolved`,
- supports ETag / If-Match concurrency.

## 7. SLA

Step 17 seeds four Development policies:

| Priority | Response | Resolution |
| --- | ---: | ---: |
| P1 | 15 min | 2 h |
| P2 | 1 h | 4 h |
| P3 | 4 h | 8 h |
| P4 | 8 h | 16 h |

Ticket list/detail exposes SLA state and elapsed percentage.

This is the first implementation checkpoint; business calendars, pause rules and escalations remain for the later SLA-management slice.

## 8. Web UX

The production React portal now implements the frozen Helpdesk core jobs:

### Service Desk overview

- Open tickets
- Assigned to me
- Due today
- SLA attention
- Priority tickets
- personal queue
- Create Ticket action when permitted

### Ticket queues

- Search
- Status filter
- Priority filter
- All Tickets
- Assigned to Me
- Team Queue
- server-side scope filtering
- pagination
- Empty / No Results / Loading / Error states

### Create Ticket

- canonical editor footer,
- requester profile context,
- Category,
- Impact / Urgency,
- calculated priority preview,
- optional accessible Device link.

### Ticket Detail

- resource header,
- Resolve / Reassign actions by permission,
- Conversation,
- public Reply / Internal Note,
- Activity,
- Properties,
- SLA,
- related Device context.

Helpdesk Manage pages not included in Step 17 remain hidden from production navigation.

## 9. Runtime verification

The local Step 17 runtime smoke verifies:

- unauthenticated Helpdesk API → 401,
- Admin core Helpdesk permissions,
- Helpdesk overview,
- Categories / Statuses,
- Admin full queue,
- HR-scoped queue,
- Employee create vs agent-action permissions,
- scoped ticket creation,
- canonical Device link without vendor-ID leakage,
- assignment,
- stale ETag → 412,
- reply + first-response Open → In Progress transition,
- resolution,
- SLA finalization,
- audit + outbox persistence,
- immutable reply/status history,
- no cross-module PostgreSQL FK,
- queue search/status/priority filters.

Runtime smoke result: **PASS**.

## 10. Deferred Step 16 re-validation

The user's earlier decision remains in force:

- do not treat Step 17 work as a fresh Step 16 re-validation,
- existing Step 16 PASS evidence remains the last known Step 16 evidence,
- Step 16 fresh runtime/visual re-validation is still required before merge/release.

## 11. Final closeout QA

Step 17 closeout completed against the production Helpdesk implementation:

- `production/scripts/step17-local-smoke.py`: **PASS**.
- `step17-helpdesk-core-audit.py`: **0 issues**.
- Implementation / Data / Event-Audit / API / Production Skeleton contract audits: **0 issues**.
- Frozen UX/UI static audit chain: **0 issues**.
- Frozen browser regression: **124 / 124**, failures 0.
- Production Helpdesk browser QA: **15 / 15 route-width screens** across 1366 / 1024 / 768, failures 0.
- No page-level horizontal overflow or unnamed visible controls were found by the Step 17 browser gate.
- Web TypeScript typecheck + production build: **PASS**.
- .NET solution build: **0 warnings / 0 errors**.
- EF pending-model checks for Helpdesk / Platform / Devices: **PASS**.
- `git diff --check`: **PASS**.

The frozen prototype baseline itself was not changed. Step 16 fresh re-validation remains deliberately deferred by user decision and is still required before any merge/release.

## 12. Source of truth

- `INNO-One-Step17-Helpdesk-Core.md`
- `inno-step17-helpdesk-core.json`
- `step17-helpdesk-core-audit.py`
- `production/scripts/step17-local-smoke.py`
