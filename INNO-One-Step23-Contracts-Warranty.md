# INNO.One — Step 23 Contracts & Warranty

**Status:** completed
**Branch:** `implementation/step23-contracts-warranty`
**Implementation Contract:** 0.14.0

## Scope

Step 23 implements the frozen Contracts & Warranty Web/API slice for Assets.

### Web route

- `/assets/contracts`

### API operations

- `assets.contracts.list` — `GET /assets/contracts`
- `assets.contracts.update` — `PATCH /assets/contracts/{contractId}`

### Persistence

- `assets.contracts` — contract, vendor, service/warranty terms and renewal dates.
- `assets.asset_contract_links` — Assets-owned Asset-to-contract coverage relationship.
- No cross-module database foreign key is introduced.

### Status model

Contract display status is server-authoritative:

- `expired` when the end date is before today.
- `expiring` when the contract ends within 90 days.
- `active` when more than 90 days remain.

The list summary reports active contracts, contracts expiring within 90 days, covered Assets and uncovered Assets for the caller's effective Assets scope.

### Update model

- Contract number is immutable in this slice.
- Vendor, fiscal year, period, warranty/service terms and support contact can be updated.
- Updates use ETag / If-Match concurrency.
- A transition into the 90-day expiration window emits one `contract.expiring` event per covered Asset.
- Contract changes audit as `assets.contract.updated` with internal classification.

### Web UX

The page preserves the frozen master-detail job:

1. KPI summary.
2. Search + status + fiscal-year filters.
3. Compact contract table.
4. Selected contract detail.
5. Covered Asset list.
6. Editable contract record for users with `assets.contract.manage`.

## Completion gates

- Web typecheck/build PASS.
- .NET build 0 warnings / 0 errors.
- Assets + Platform EF pending-model checks PASS.
- Step 23 runtime smoke PASS.
- Step 23 audit 0 issues.
- Frozen static audit chain 0 issues.
- Production visual QA at 1366 / 1024 / 768.
- Frozen browser regression 124 / 124.
- `git diff --check` PASS.

**Step 16 fresh re-validation remains deferred and is still required before merge/release.**


## Final QA

- Step 23 runtime smoke: **PASS**
- Step 23 audit: **0 issues**
- Web typecheck/build: **PASS**
- .NET build: **0 warnings / 0 errors**
- EF pending-model checks for Assets / Platform / Devices / Helpdesk: **PASS**
- contract/static audit chains: **0 issues**
- production Contracts & Warranty visual QA: **3 / 3 screens** at 1366 / 1024 / 768, failures 0
- frozen browser regression: **124 / 124**, failures 0
- `git diff --check`: **PASS**
- remote DB verification:
  - contracts: 3
  - Asset-contract links: 5
  - `assets.contract.manage` permission seeded: 1
  - observed `assets.contract.updated` audits: 2
  - observed `contract.expiring` events: 2
  - Assets cross-module DB foreign keys: 0
  - active contract restored after smoke with ~456 days remaining
- migration `Step23ContractsWarranty` applied to PostgreSQL on `172.10.1.58`

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction. No Step 24 work has been started.**
