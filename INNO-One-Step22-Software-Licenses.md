# INNO.One — Step 22 Software License Compliance

**Status:** implementation-in-progress
**Branch:** `implementation/step22-software-licenses`
**Implementation Contract:** 0.13.0

## Scope

Step 22 implements the frozen Software Licenses Web/API slice for Assets.

### Web route

- `/assets/software-licenses`

### API operations

- `assets.licenses.list` — `GET /assets/software-licenses`
- `assets.licenses.update` — `PATCH /assets/software-licenses/{licenseId}`

### Persistence

- `assets.software_licenses` — purchased entitlement and renewal metadata.
- `assets.license_allocations` — detected/allocated usage detail owned by Assets.
- No cross-module database foreign key is introduced.

### Compliance model

- Purchased seats are compared with detected/allocated seats.
- Compliance state is server-authoritative:
  - `compliant` when used seats are less than or equal to entitled seats.
  - `overused` when used seats exceed entitled seats.
- Estimated gap cost is the positive seat gap × unit price.
- Updating an entitlement uses ETag / If-Match concurrency.
- A transition from compliant to overused emits `license.overused`.
- License changes audit as `assets.license.updated` with internal classification.

### Web UX

The Software Licenses page preserves the frozen single-screen compliance job:

1. KPI summary.
2. Search + compliance/vendor filters.
3. Compact license product table.
4. Selected-product allocation/usage detail.
5. Editable entitlement record in the owning detail panel.

## Boundary

The frozen contract currently exposes no standalone Software Baseline API operation or Web route. Step 22 does not invent one. Existing baseline tables/permission remain reserved for a later contract-backed slice.

## Completion gates

- Web typecheck/build PASS.
- .NET build 0 warnings / 0 errors.
- Assets + Platform EF pending-model checks PASS.
- Step 22 runtime smoke PASS.
- Step 22 audit 0 issues.
- Frozen static audit chain 0 issues.
- Production visual QA at 1366 / 1024 / 768.
- Frozen browser regression 124 / 124.
- `git diff --check` PASS.

**Step 16 fresh re-validation remains deferred and is still required before merge/release.**
