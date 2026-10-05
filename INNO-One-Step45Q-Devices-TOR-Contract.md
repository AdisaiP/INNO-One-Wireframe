# INNO.One â€” Step45Q Devices TOR Contract Freeze

**Date:** 2026-10-06
**Status:** FROZEN PLANNING CONTRACT
**Branch:** `architecture/step45q-devices-tor-contract-freeze`
**Base:** `b541e90`
**Step45Q Contract:** 1.0.0
**Global API Contract:** 0.5.0 (unchanged in Step45Q)
**Global Data Model Contract:** 0.6.0 (unchanged in Step45Q)

## 1. Why Step45Q exists

The Devices frozen wireframes and TOR-required management surfaces are broader than the current Production implementation.

Two drift classes were confirmed:

1. Production Devices navigation currently exposes only implemented slices and is missing TOR-required jobs.
2. Production Device Detail currently exposes only Overview + Software while the frozen Device Detail defines nine tabs.

Step45Q freezes the missing route/API/data/permission/state boundary before Step45Râ€“45X implementation. It does **not** add placeholder navigation, fake data or backend tables by itself.

Machine-readable source:

`inno-step45q-devices-tor-contract.json`

## 2. TOR-required Devices navigation

When Step45X is complete, Devices navigation must contain this canonical order:

1. **Overview** â€” `/devices/overview`
2. **Devices** â€” `/devices`
3. **Discovery** â€” `/devices/discovery`
4. **Device Groups** â€” `/devices/groups`
5. **Remote Operations** â€” `/devices/remote-operations`
6. **Remote Consent** â€” `/devices/remote-consent`
7. **Inventory Query** â€” `/devices/query`
8. **Deployment Jobs** â€” `/devices/deployments`
9. **Agent Maintenance** â€” `/devices/maintenance`
10. **Endpoint Policies** â€” `/devices/policies`
11. **Active Alerts** â€” `/devices/alerts`

### Availability rule

These routes are TOR-required, but the Availability Contract still applies during implementation:

- do not add a dead normal-navigation entry before its Product route/runtime exists;
- each Step45Râ€“45X slice activates its route only when the route is real, permission-gated and QA-passed;
- by Step45X all eleven TOR-required jobs must be active.

**Device Automation remains retired.** It is not part of this TOR restoration contract.

## 3. Device Detail route and deep links

Canonical Web route:

`/devices/:deviceId`

Pattern: **P03 Resource Detail**

Canonical tab deep-link:

`/devices/:deviceId?tab=<tab-id>`

Default tab: `overview`.

Valid tab IDs are frozen as:

`overview | hardware | software | performance | processes | services | network | activity | tickets`

Unknown tab values fall back to `overview` and must not render a blank surface.

## 4. Device Detail tabs

### Overview â€” Step45R

Owner: Devices
Permission: `devices.view`
Primary operation: existing `GET /devices/{deviceId}`

Purpose:

- resource identity/status,
- assigned user/group/location,
- current inventory summary,
- health summary,
- recent changes,
- real quick actions only.

Offline behavior: keep cached resource detail visible under Resource Offline state.

### Hardware â€” Step45R

Owner: Devices
Permission: `devices.view`

Frozen read operation:

`GET /devices/{deviceId}/hardware-inventory`

Refresh command:

`POST /devices/{deviceId}/inventory-refreshes`

Refresh permission: `devices.manage`.

Data source is normalized Endpoint Agent inventory mapped into Devices-owned inventory snapshot storage. Hardware includes manufacturer/model/serial, processor, memory-bank summary, BIOS and non-secret OS/device metadata.

Freshness:

- fresh: observation <= 24 hours;
- stale: observation > 24 hours.

Offline: show last snapshot with observed-at, provenance and stale state.

Secrets such as full OS product keys or credentials must never be returned. If a key-like identifier is useful, return a masked suffix only.

### Software â€” Step45R

Owner: Devices
Permission: `devices.view`

Existing operations:

- `GET /devices/{deviceId}/software-inventory`
- Endpoint ingestion remains the Step27 contract.

Refresh command uses the shared inventory-refresh operation.

Freshness:

- fresh: observation <= 24 hours;
- stale: observation > 24 hours.

Completeness/provenance from Step27 remain mandatory. Partial evidence never proves absence.

### Performance â€” Step45S

Owner: Devices
Permission: `devices.view`

Frozen read operation:

`GET /devices/{deviceId}/performance?window=<window>&interval=<interval>`

Initial Product defaults:

- window: 5 minutes,
- interval: 5 seconds.

Performance contains CPU, memory and disk/agent health series with sample timestamps.

Freshness:

- live: latest sample <= 60 seconds;
- stale: latest sample > 60 seconds.

Offline: recent history may remain visible but the Live indicator is removed and stale state is explicit.

Planned Devices persistence:

`devices.device_performance_samples`

This is bounded operational telemetry, not an indefinite monitoring warehouse.

### Processes â€” Step45T

Owner: Devices
Read permission: `devices.view`
Terminate permission: `devices.manage`

Frozen operations:

- `POST /devices/{deviceId}/processes/snapshots`
- `GET /devices/{deviceId}/processes/snapshots/{snapshotId}`
- `POST /devices/{deviceId}/processes/{processKey}/terminate`

Process lists are live Endpoint Agent observations. They are **not** durable inventory and are not written to a permanent process-history table.

Snapshot validity: <= 60 seconds.

Offline: `RESOURCE_OFFLINE`; do not show stale process state as current.

Terminate is interruptive and requires warning confirmation plus audit.

### Services â€” Step45T

Owner: Devices
Read permission: `devices.view`
Action permission: `devices.manage`

Frozen operations:

- `POST /devices/{deviceId}/services/snapshots`
- `GET /devices/{deviceId}/services/snapshots/{snapshotId}`
- `POST /devices/{deviceId}/services/{serviceName}/actions`

Allowed service actions:

`start | stop | restart`

Service lists are ephemeral live observations with <= 60-second validity and no durable service-state history table.

Offline: `RESOURCE_OFFLINE`.

Start/stop/restart actions require warning confirmation and audit.

### Network â€” Step45S

Owner: Devices
Permission: `devices.view`

Frozen read operation:

`GET /devices/{deviceId}/network-inventory`

Uses Devices-owned normalized inventory snapshots and exposes adapter/configuration/connectivity facts such as addresses, gateway, DNS, MAC, adapter identity, latency and packet loss when observed.

Freshness:

- fresh: <= 15 minutes;
- stale: > 15 minutes.

Offline: last observation may remain visible with stale metadata.

### Activity â€” Step45U

Owner: Devices
Permission: `devices.view`

Frozen operation:

`GET /devices/{deviceId}/activity`

Response: paged timeline.

The timeline projects Devices-domain facts such as:

- inventory collected/refreshed,
- remote session lifecycle,
- endpoint command lifecycle,
- deployment/maintenance lifecycle,
- policy/compliance changes,
- alert lifecycle.

Vendor logs are not rendered directly as canonical activity.

Planned read model:

`devices.device_activity_items`

### Tickets â€” Step45U

Owner: **Helpdesk**, not Devices.

Read permission: `helpdesk.ticket.view`
Create permission: `helpdesk.ticket.create`

Frozen query extension:

`GET /helpdesk/tickets?relatedDeviceId={deviceId}`

No Devices-owned ticket table/API is introduced.

The Tickets tab must evaluate Helpdesk permission independently. A user may access Device Detail but see tab-local Permission Denied for Tickets.

Device connectivity does not affect ticket availability.

## 5. TOR management surface permissions

Existing global contract permissions remain canonical:

| Surface | Read | Manage/Action |
| --- | --- | --- |
| Overview / Devices / Discovery / Groups / Inventory Query | `devices.view` | `devices.manage` where applicable |
| Remote Operations | `devices.remote` | `devices.remote` |
| Remote Consent | `devices.view` | `devices.remote.consent.manage` |
| Deployment Jobs | `devices.view` | `devices.deploy` |
| Agent Maintenance | `devices.view` | `devices.deploy` for rollout/software; `devices.manage` for restart/power |
| Endpoint Policies | `devices.view` | `devices.policy.manage` |
| Active Alerts | `devices.alert.view` | `devices.alert.manage` |

No new broad `devices.*` permission is invented in Step45Q.

## 6. Ownership and persistence rules

Devices owns:

- canonical Device identity,
- normalized endpoint inventory observations,
- software observations,
- performance samples,
- remote session/consent lifecycle,
- deployment/maintenance lifecycle,
- endpoint policy/compliance,
- alerts,
- Devices activity projection.

Helpdesk owns tickets and `related_device_id`.

MeshCentral owns its own persistence. INNO.One never queries MeshCentral storage directly; the Devices adapter maps vendor protocol/state into INNO.One contracts.

### Planned persistence additions

Step45S may introduce:

`devices.device_performance_samples`

Step45U may introduce:

`devices.device_activity_items`

These names are frozen here but are not migrations yet. Their actual schema is promoted to the global Data Model Contract only in the implementing step.

Processes and Services remain ephemeral and **must not** introduce permanent inventory/history tables for the live lists.

## 7. State contract

Each Device Detail tab owns its own state. A failure in one tab must not blank the entire resource detail.

Required states:

- Loading
- Error
- Permission Denied
- Resource Offline
- Partial Failure
- Stale observation where applicable

Rules:

- Overview/Hardware/Software/Network keep cached evidence visible while offline.
- Processes/Services do not fake cached live state.
- Performance may retain history but cannot claim Live while stale/offline.
- Tickets permission is independent from Devices permission.
- Successful data remains visible when another tab/query fails.
- Observation timestamps, provenance and completeness are visible where evidence quality matters.

## 8. Interaction safety

- Process termination: warning confirmation + `devices.manage` + audit.
- Service start/stop/restart: warning confirmation + `devices.manage` + audit.
- Restart/power actions: warning/danger confirmation + audit.
- Remote control: `devices.remote` + consent gate + session start/end audit.
- Inventory refresh: real async operation with busy/result feedback.
- Never render browser-native `alert()`, `confirm()` or `prompt()`.

## 9. Implementation sequence frozen by Step45Q

- **45R** â€” Overview + Hardware + Software
- **45S** â€” Performance + Network
- **45T** â€” Processes + Services + Endpoint command channel
- **45U** â€” Activity + Tickets
- **45V** â€” Remote Operations + Remote Consent
- **45W** â€” Deployment Jobs + Agent Maintenance
- **45X** â€” Endpoint Policies + Active Alerts + Devices Overview + final TOR navigation

Step45R must not silently pull work forward from later steps unless a dependency requires a small shared primitive.

## 10. Contract promotion rule

Step45Q is a domain-specific frozen planning contract layered on the existing global API 0.5.0 and Data Model 0.6.0 baselines.

As each implementation slice is completed:

1. promote that slice's new public operation(s) into the canonical global API contract/OpenAPI source;
2. promote actual new persistence into the global Data Model Contract;
3. implement permission/scope enforcement;
4. run runtime + browser QA;
5. only then expose its normal-navigation route.

By Step45X all TOR-required Devices navigation routes and all nine Device Detail tabs must be real Product surfaces.

## 11. Non-goals

Step45Q does not:

- implement backend endpoints,
- add database migrations,
- add placeholder sidebar items,
- restore Device Automation,
- claim MeshCentral remote control is complete,
- change the Helpdesk ownership of tickets,
- deploy to the live Linux environment.



## 12. Step45Q verification

- Step45Q domain contract audit: **71 / 71**, issues 0.
- Frozen API Contract 0.5.0 audit: **180 operations**, issues 0.
- Data Model Contract 0.6.0 audit: **94 planning tables**, issues 0.
- Implementation Contract 0.19.0 audit: issues 0.
- `git diff --check`: PASS.
- No Web/API runtime source was changed in Step45Q, so browser/runtime QA is not an applicable acceptance surface for this contract-only step.

**Step45Q is complete. Next implementation slice: Step45R â€” Device Detail Overview + Hardware + Software.**
