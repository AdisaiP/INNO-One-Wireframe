# INNO.One — Step 26 Software Baseline Definitions

**Status:** definitions slice complete; evaluator awaits Devices software inventory
**Branch:** `implementation/step26-software-baselines`
**Implementation Contract:** 0.17.0
**API Contract:** 0.3.0

## Job and boundary

The Assets Web Portal can define required software packages for an Asset category. The page lists definitions and edits one definition at a time. It does not claim that a device is compliant merely because no software evidence is available.

Devices currently has no authoritative installed-software inventory or cross-module read contract. License allocations represent entitlements/usage, not a complete software inventory. Therefore `evaluationStatus` is `awaiting_inventory`; `baseline_results` remains reserved, and `baseline.drift` is not emitted. Future evaluation must consume a Devices-owned software observation contract with device ID, product identity, observed timestamp, completeness and provenance. Stale/incomplete observations produce `unknown`, never `compliant` or `missing`.

## Implemented slice

- Web route `/assets/software-baselines` for search, status filter, create and edit.
- GET/POST `/api/v1/assets/software-baselines`; GET/PATCH `/api/v1/assets/software-baselines/{baselineId}`.
- Read: `assets.view`; create/update: `assets.baseline.manage`.
- Definition code is immutable; 1–30 unique package names; draft/active/inactive status.
- ETag / If-Match on update, 412 on stale or missing ETag.
- Assets-owned `software_baselines` table with unique code, jsonb required packages and no cross-module FK.
- `assets.baseline.created` / `assets.baseline.updated` internal audits in the same transaction.
- No event or compliance result is produced without inventory evidence.

## QA and release state

- Web typecheck/build: PASS. .NET build: 0 warnings / 0 errors.
- EF migration `20260927140804_Step26SoftwareBaselineDefinitions` applied to the development database for runtime QA.
- Runtime smoke: `STEP26_DEFINITIONS_SMOKE_PASS`, covering permission, validation, create/list/detail, duplicate code, If-Match, stale ETag and `awaiting_inventory`.
- Development DB guards: migration 1, permission 1, audit rows 3, drift events 0, cross-module FK 0; temporary QA definitions removed.
- React visual QA: list 1366 / 1024 / 768 and create editor 1366 / 768, 5 screenshots, 0 overflow/errors. Native production shell styles verified in screenshots.
- Step 26 audit, API contract audit (176 operations), Implementation Contract audit and historical skeleton/data/event/Step 15–25 audit chain: 0 issues.
- `git diff --check`: PASS.

This branch is not merged. No persistent Web/API service has been deployed. Step 26 definition management is complete; baseline evaluation and drift emission are blocked until Devices owns an authoritative installed-software observation feed with completeness, provenance and time semantics.
