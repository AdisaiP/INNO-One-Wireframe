# INNO.One — Step 19 Assets Core

**Status:** completed  
**Branch:** `implementation/step19-assets-core`  
**Implementation Contract:** 0.10.0

## Scope

Step 19 implements the first production Assets vertical slice while preserving the frozen Web / Endpoint Agent / Android Mobile boundaries.

### Web jobs

- Assets Overview
- Asset Inventory
- Asset Detail
- Ownership overview
- Asset Owners
- Owner Detail
- Endpoint Agent ownership submissions review

### API operations

- `assets.overview.get`
- `assets.list`
- `assets.get`
- `assets.update`
- `assets.ownership.list`
- `assets.ownership.change`
- `assets.owners.list`
- `assets.owners.get`
- `assets.ownership_submissions.list`
- `assets.ownership_submissions.decide`

### Web routes

- `/assets`
- `/assets/inventory`
- `/assets/:assetId`
- `/assets/ownership`
- `/assets/owners`
- `/assets/owners/:userId`
- `/assets/ownership/submissions`

## Persistence

Step 19 activates only these Assets-owned tables:

- `assets.assets`
- `assets.asset_ownership_history`
- `assets.ownership_submissions`

Cross-module IDs are stored as stable GUID values without database foreign keys.

Assets reads Platform users / organizations / locations through `IPlatformDirectoryReader` and Devices through `IDeviceDirectoryReader`. Assets must not query Platform or Devices tables directly.

## Authorization

- Read jobs require `assets.view`.
- Asset mutation / ownership change / submission decision require `assets.manage`.
- Server-side effective scope is authoritative.
- Asset scope is evaluated from organization/location references on the Asset record.

## Events and audit

Active Step 19 events:

- `asset.changed`
- `ownership.changed`

Audit actions:

- `assets.asset.updated`
- `assets.ownership.changed`

Endpoint Agent ownership confirmation remains a separate surface. Step 19 only implements the Web review queue for the durable submission record.

## Deferred Assets capabilities

The following API/UX contract capabilities remain intentionally deferred to later Assets slices:

- Custom Fields
- QR label generation / QR resolve
- Software baselines
- Software licenses
- Contracts / Warranty management
- Android Assets Mobile scanner runtime

## Completion gates

Before Step 19 can be marked completed:

- Web typecheck/build PASS
- .NET build 0 warnings / 0 errors
- Assets EF pending-model check PASS
- Step 19 runtime smoke PASS
- Step 19 audit 0 issues
- existing contract/static audit chain 0 issues
- production route visual QA at 1366 / 1024 / 768
- frozen browser regression 124 / 124
- `git diff --check` PASS
- commit/push with clean working tree

**Step 16 fresh re-validation remains deferred and is still required before merge/release.**

## Final QA

- Step 19 runtime smoke: **PASS**
- Step 19 audit: **0 issues**
- Web typecheck/build: **PASS**
- .NET build: **0 warnings / 0 errors**
- EF pending-model checks: **PASS**
- contract/static audit chains: **0 issues**
- production Assets visual QA: **21 / 21 screens**, failures 0
- frozen browser regression: **124 / 124**, failures 0
- `git diff --check`: **PASS**
- Assets migration `Step19AssetsCore` applied to the remote development PostgreSQL on `172.10.1.58`

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction. No Step 20 work has been started.**
