# INNO.One — Step 27 Devices Installed Software Inventory

**Status:** complete; runtime and visual QA passed
**Branch:** `implementation/step27-devices-software-inventory`
**Implementation Contract:** 0.18.0
**API Contract:** 0.4.0
**Event/Audit Contract:** 0.4.0
**Data Model Contract:** 0.5.0

## Job and ownership

Devices owns installed-software observations. Each immutable snapshot records the Device, observation and receipt times, completeness, source provenance and normalized package rows. Assets consumes the latest observation through `IDeviceSoftwareInventoryReader`; it does not query Devices tables.

A `complete` observation can prove presence and absence at its observed time. A `partial` observation proves only packages that were reported. Absence from a partial observation remains unknown.

## Implemented slice

- `GET /api/v1/devices/{deviceId}/software-inventory` using `devices.view` and effective Device scope.
- `PUT /api/v1/devices/{deviceId}/software-inventory` using `devices.manage` and effective Device scope.
- At most 2,000 unique normalized products per report.
- Observation time may not be over five minutes in the future or more than 30 days old.
- A report must be newer than the latest snapshot; stale/equal observations return HTTP 409.
- Sources: `endpoint_agent`, `meshcentral`, `manual_import`.
- Immutable `devices.software_inventory_snapshots` plus child `devices.installed_software`.
- Same-transaction audit and outbox event with metadata only; package inventory is not copied into events.
- Device Detail shows the latest inventory, provenance, observed time and partial-evidence warning.
- Development fixtures provide complete and partial examples.

## Boundary

The authenticated ingestion endpoint currently uses `devices.manage`. A production Endpoint Agent credential can receive that permission through the platform identity model later without changing the public payload contract.

This step supplies trustworthy inventory evidence. Assets baseline evaluation, result projection and `baseline.drift` emission remain the next step.

## QA and release state

Static contracts, builds, runtime smoke, database guards and visual QA must be recorded before this step is marked complete. This branch is not merged and no persistent service has been deployed.


## QA results

- .NET build: PASS, 0 warnings / 0 errors.
- Web typecheck/build: PASS; Vite reports the existing bundle-size advisory.
- Step 27, API, Implementation, Data Model, Event/Audit and Production Skeleton audits: 0 issues.
- Runtime smoke: `STEP27_SOFTWARE_INVENTORY_SMOKE_PASS`, covering permission, time/package validation, normalization, write/read and stale observation conflict.
- Development database guards: migration 1, snapshots 4 before QA cleanup, packages 12, audit 1, event 1, cross-module Devices FK 0; temporary QA snapshot removed and `qa_remaining=0`.
- React visual QA: complete and partial evidence at 1366 / 1024 / 768, 6 screenshots, 0 overflow/errors/loading failures.
- EF pending-model check: no changes since the Step 27 migration.

No persistent Web/API service was deployed.
