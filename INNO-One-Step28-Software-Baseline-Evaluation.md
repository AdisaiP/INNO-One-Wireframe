# INNO.One — Step 28 Software Baseline Evaluation

**Status:** complete; runtime, database and visual QA passed
**Branch:** `implementation/step28-software-baseline-evaluation`
**Implementation Contract:** 0.19.0
**API Contract:** 0.5.0
**Event/Audit Contract:** 0.5.0
**Data Model Contract:** 0.6.0

## Evaluation policy

Assets evaluates active baseline definitions against the latest Devices-owned software observation through `IDeviceSoftwareInventoryReader`. The freshness window is 24 hours.

- Fresh, complete observation: all required identities present → `compliant`; otherwise `missing`.
- Missing link, missing observation, observation older than 24 hours or partial observation → `unknown`.
- A partial observation never proves that absent software is missing.
- Baseline changes mark previous results `stale` until evaluation runs again.
- `baseline.drift` is emitted only when an existing evidence-backed result changes between `compliant` and `missing`. Initial results and transitions involving `unknown` do not emit drift.

## Implemented slice

- GET `/api/v1/assets/software-baselines/{baselineId}/results`.
- POST `/api/v1/assets/software-baselines/{baselineId}/evaluate`.
- Assets-owned `baseline_results` latest-result projection with a unique baseline + Asset key.
- Effective Asset scope enforced for result reads and evaluation.
- Same-transaction `assets.baseline.evaluated` audit and evidence-backed drift outbox.
- Software Baselines UI provides evaluation summary, evidence reason, missing packages and an Evaluate Now action.
- Baseline list reports `not_evaluated`, `current` or `stale`.

No persistent service has been deployed.

## QA results

- Step 28, API, Implementation, Data Model, Event/Audit and Production Skeleton audits: 0 issues.
- Step 26/27 regression guards pass with Step 28 supersession recognized.
- .NET build: PASS, 0 warnings / 0 errors.
- Web typecheck/build: PASS; existing Vite bundle-size advisory only.
- Runtime smoke: `STEP28_BASELINE_EVALUATION_SMOKE_PASS`, with deterministic compliant → missing evidence transition.
- Database guards: Step 28 migration 1, Assets cross-module FK 0, EF pending-model changes 0.
- QA cleanup: temporary Step 28 baselines/results/software snapshots removed; remaining counts 0.
- Existing React visual QA remains valid at 1366 / 1024 / 768 with no page-level overflow.

Next implementation step is **Step 29 — React UI Parity / Frozen UI Port Pass** before adding more feature slices.
