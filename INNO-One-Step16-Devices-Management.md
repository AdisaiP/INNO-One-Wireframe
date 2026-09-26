# INNO.One — Step 16 Devices Management

**Date:** 2026-09-26
**Status:** Implementation in progress
**Branch:** `implementation/step16-devices-management`
**Implementation Contract:** 0.7.0
**API Contract:** 0.2.0
**Event & Audit Contract:** 0.3.0
**Data Model Contract:** 0.4.0
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0

## 1. Scope

Step 16 extends the real production Devices slice through four operator jobs:

~~~text
Device Groups
    ↓
Network Discovery
    ↓
Agent Enrollment
    ↓
Live MeshCentral Synchronization
~~~

Implemented frozen API operations:

- `devices.groups.list`
- `devices.groups.create`
- `devices.groups.get`
- `devices.groups.update`
- `devices.group_members.list`
- `devices.discovery_scan.create`
- `devices.discovery_scan.get`
- `devices.discovery_results.list`
- `devices.agent_installer.create`

Production Web routes:

- `/devices/groups`
- `/devices/groups/:groupId`
- `/devices/discovery`
- `/devices/add`

Dynamic Device Group rule editing remains intentionally hidden because its rule engine is not implemented in this slice.

## 2. Device Groups

Device Groups are canonical INNO.One resources.

The implementation supports:

- effective-scope list filtering,
- static group creation,
- detail and member list,
- ETag / `If-Match` update concurrency,
- active/inactive lifecycle,
- Organization and Location ownership,
- group-to-MeshCentral mapping behind the adapter boundary,
- same-transaction audit for privileged create/update.

MeshCentral group IDs are never public INNO.One resource IDs.

## 3. Discovery

Network Discovery is a durable asynchronous operation.

The first implementation deliberately limits scanning to:

- IPv4,
- RFC1918 private ranges,
- loopback,
- link-local,
- maximum 512 addresses per scan.

Public IPv4 ranges are rejected server-side.

The discovery worker persists:

- scan state,
- progress,
- addresses scanned,
- reachable endpoint results,
- managed/unmanaged classification,
- durable `integration.operations` state.

The first scan mechanism is ICMP reachability. More discovery protocols can be added behind this boundary later without changing the Web job.

## 4. Agent enrollment

`POST /api/v1/devices/agent-installers` requires `devices.deploy`.

The endpoint:

1. validates Device Group scope,
2. ensures a corresponding MeshCentral group exists,
3. requests a time-limited MeshCentral enrollment link,
4. returns an authorized enrollment resource to the Web Portal,
5. never returns the MeshCentral group ID.

The Web UI exposes Windows / macOS / Linux enrollment choice and a profile selector. It does not claim that a remote endpoint has enrolled until the live synchronization reports the endpoint.

## 5. Live MeshCentral synchronization

`MeshCentralRemoteDeviceEngine` is a real vendor adapter using the MeshCentral control WebSocket boundary.

The adapter implements:

- group listing,
- group create/update,
- node listing,
- enrollment invite creation.

`MeshCentralSyncWorker` periodically:

- reads MeshCentral nodes,
- accepts only nodes inside canonical INNO.One groups mapped to MeshCentral,
- upserts canonical `devices.devices`,
- stores vendor IDs only in `device_external_mappings`,
- updates group membership,
- inherits Organization/Location from the canonical group,
- updates connection state and cached endpoint inventory,
- emits existing frozen `device.online` / `device.offline` facts through the transactional outbox when state changes.

INNO.One never queries the MeshCentral database directly.

## 6. Execution, audit and outbox persistence

Step 16 introduces the first shared implementation migration for:

- `integration.operations`
- `integration.outbox_messages`
- `audit.audit_records`

The Devices migration adds the Step 16 fields and tables already planned in the Data Model Contract:

- Device Group mapping/sync metadata,
- `discovery_scans`,
- `discovery_results`.

A Devices mutation can write its canonical record and shared audit/outbox record through the same PostgreSQL transaction.

## 7. Local development MeshCentral

Local Docker Compose now includes a pinned MeshCentral engine:

`ghcr.io/ylianst/meshcentral:1.2.6`

Local HTTPS endpoint:

`https://localhost:8443`

Production configuration keeps the integration disabled by default and requires deployment-managed credentials/TLS configuration.

## 8. Web Portal

The Devices application navigation now exposes only implemented jobs:

- Devices
- Discovery
- Device Groups
- Agent Deployment

New Device Group is shown only to `devices.manage`.

Agent Deployment is shown only to `devices.deploy`.

Future dynamic groups and unimplemented discovery/deployment actions stay out of the normal task flow.

## 9. Migrations

- Infrastructure: `Step16ExecutionLedger`
- Devices: `Step16DevicesManagement`

## 10. QA closeout

Step 16 is **IMPLEMENTED + VERIFIED** on the dedicated implementation branch.

Final gates:

- local PostgreSQL / Keycloak / MeshCentral runtime: **PASS**,
- Device Group create/update through real MeshCentral adapter: **PASS**,
- If-Match / stale ETag behavior: **PASS**,
- time-limited Agent Enrollment: **PASS**,
- bounded private IPv4 Discovery async operation: **PASS**,
- durable integration.operations persistence: **PASS**,
- privileged Device Group audit persistence: **PASS**,
- live MeshCentral node to canonical INNO.One Device synchronization: **PASS**,
- MeshCentral vendor group/node IDs remain private: **PASS**,
- EF pending model changes for Devices / Infrastructure: **none**,
- Web TypeScript typecheck: **PASS**,
- Web production build: **PASS**,
- .NET solution build: **0 warnings / 0 errors**,
- Step 15 runtime regression: **PASS**,
- Step 16 audit: **0 issues**,
- Production Skeleton / Implementation / Data / Event-Audit / API audits: **0 issues**,
- frozen UX/UI static audit chain: **0 issues**,
- frozen browser regression: **124 / 124**, failures 0,
- Step 16 React visual QA: **4 routes x 3 viewports = 12 screens**, failures 0,
- git diff --check: **PASS** before checkpoint.

The Step 16 visual review covered:

- /devices/groups,
- /devices/groups/:groupId,
- /devices/discovery,
- /devices/add,

at **1366 / 1024 / 768**. No page-level horizontal overflow, unnamed visible controls, uncontained table overflow, stuck loading state or visible error state remained.

## 11. QA harness boundary

Runtime integration and visual QA are intentionally separate proofs.

The real runtime smoke uses PostgreSQL, Keycloak, the real Platform API and a real local MeshCentral 1.2.6 instance.

For synthetic **live-sync** QA only, MeshCentral AddLocalDevice requires an **agentless mesh**. The smoke harness therefore creates a temporary MeshCentral agentless group solely to manufacture a local test node, maps the QA canonical group to that temporary engine group, and verifies that MeshCentralSyncWorker creates a canonical dev_ resource without leaking node/ or mesh/ identifiers.

This **does not change product enrollment behavior**. Normal Agent Enrollment continues to create/use a standard MeshCentral agent group and returns only the authorized enrollment link.

For layout-only browser inspection, the React pages were rendered against an isolated mock API/auth harness after runtime integration had already passed. The production keycloak.ts file was restored before the final typecheck/build/audit checkpoint; no authentication bypass is part of the committed implementation.

## 12. Source of truth

- INNO-One-Step16-Devices-Management.md
- inno-step16-devices-management.json
- step16-devices-management-audit.py
- production/scripts/step16-local-smoke.py
- production/scripts/step16-meshcontrol.mjs
- production/scripts/step16-meshcentral-init.py

The frozen HTML UX/UI baseline remains unchanged.

## 13. Deferred re-validation note — 2026-09-26

The user explicitly requested that the **additional Step 16 re-test / fresh re-validation be deferred** so implementation can move on.

The PASS results above remain the last recorded Step 16 QA evidence. No new runtime/visual pass is claimed by this note.

Before any merge to `main`, release, or production handoff, resume here and rerun at minimum:

- `python3 production/scripts/step16-local-smoke.py`,
- `python3 step16-devices-management-audit.py`,
- Web typecheck + production build,
- .NET solution build,
- frozen browser regression,
- Step 16 route visual QA,
- `git diff --check`.

This deferred verification is a **release gate**, not a request to undo the implemented Step 16 code.
