# INNO.One â€” Step45R Device Detail Core

**Date:** 2026-10-06
**Status:** IMPLEMENTED + VERIFIED
**Branch:** `implementation/step45r-device-detail-core`
**Base:** Step45Q commit `89db7f0`

## Scope

Step45R activates the first three real Device Detail tabs from the Step45Q TOR contract:

1. Overview
2. Hardware
3. Software

The remaining Performance, Processes, Services, Network, Activity and Tickets tabs remain intentionally unavailable until their owning implementation steps. No dead or Coming Soon tabs are exposed.

## Device Detail navigation

Canonical resource route remains:

`/devices/:deviceId`

Step45R adds query-string deep links:

- Overview: `/devices/:deviceId`
- Hardware: `/devices/:deviceId?tab=hardware`
- Software: `/devices/:deviceId?tab=software`

Unknown `tab` values render Overview instead of a blank surface.

## Hardware inventory

Step45R promotes this public operation into the canonical API/OpenAPI contract:

`GET /devices/{deviceId}/hardware-inventory`

Permission: `devices.view`
Scope: Device resource scope.

The response is normalized Devices-owned observation evidence, not a MeshCentral/vendor DTO. It contains:

- inventory status,
- snapshot/observation timestamps,
- provenance,
- stale flag,
- manufacturer/model/serial,
- processor/BIOS/OS,
- memory capacity and memory slot evidence,
- IP/MAC identity,
- connectivity/last-seen context.

Evidence older than 24 hours is stale.

## Persistence

Step45R activates the already-planned Data Model table:

`devices.device_inventory_snapshots`

EF migration:

`20261005185116_Step45RDeviceHardwareInventory`

The migration creates indexes and backfills one `partial` observation from each existing canonical Device row using:

- source = `legacy_device_row`,
- sourceInstance = `step45r-backfill`,
- observedAt = `last_seen_at` or `updated_at`.

This prevents an upgraded environment from losing known hardware evidence.

DevelopmentSeed also creates hardware snapshots when a new development database is seeded.

## Overview

Overview keeps cached resource detail visible while offline.

Where a Hardware observation exists, Overview prefers the normalized observation for:

- model/manufacturer,
- serial number,
- processor,
- BIOS,
- OS,
- IP,
- MAC.

It falls back to the canonical Device row when the snapshot has no value.

## Software

Software continues to use the Step27 immutable Devices-owned observation contract.

Step45R additionally:

- deep-links the Software tab,
- marks observations older than 24 hours as stale,
- keeps completeness/provenance visible,
- preserves partial-evidence semantics.

## Refresh inventory boundary

Step45Q planned `POST /devices/{deviceId}/inventory-refreshes`, but Step45R deliberately does **not** expose or implement it.

The Endpoint Agent command channel for explicit inventory collection is not real yet. Returning a queued operation without an execution path would violate the Availability Contract.

The Refresh action is promoted only when a real endpoint command path exists.

## Language and visual behavior

Hardware/Software evidence, freshness and status copy is bilingual.

Step45R also localizes Device status and basic device-type fallback in Device Detail.

Responsive review covers 1366 and 768 Device Detail layouts, including an online and an offline device.

## Runtime verification

The Step45R migration was applied successfully to the shared development PostgreSQL at `172.10.1.58` during local QA. The test API used the remote development PostgreSQL and Keycloak while the Web ran locally.

This is QA schema migration only; the Step45R Web/API application build was not deployed to the Linux host.

## QA

- .NET solution build: 0 warnings / 0 errors.
- EF pending model changes: none.
- i18n build: PASS.
- Web typecheck: PASS.
- Web production build: PASS, 2259 modules.
- API Contract: 181 operations / 143 unique paths / 0 issues.
- Step45Q contract: 71 / 71.
- Data Model Contract: 94 planning tables / 0 issues.
- Step45N bilingual audit: 3831 checks / 1871 keys / 0 raw-copy offenders / 0 failures.
- Language/terminology audit: 0 issues.
- Broad browser regression: 66 routes / 1734 checks / 0 failures at 1366 / 1024 / 768.
- Focused Step45R browser QA: 46 / 46, 6 screenshots.
- Online Hardware API returned real snapshot/provenance evidence.
- Offline Device Detail retained cached Hardware under Resource Offline state.
- Visual screenshots inspected after final localization fix.
- `git diff --check`: PASS.

## Next

Step45S â€” Performance + Network.

Do not merge `main` without explicit user instruction.
