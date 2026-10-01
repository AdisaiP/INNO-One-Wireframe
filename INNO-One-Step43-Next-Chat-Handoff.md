# INNO.One — Step 43 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step43-inventory-query`
**Base:** `bb1e24d test: complete final structural visual qa`
**Scope:** Inventory Query
**Implementation Contract:** **0.32.0**
**Frozen Design System:** **V1.26**
**Frozen UI Contract:** **1.20.0**
**API Contract:** **0.5.0**
**Data Model Contract:** **0.6.0**

**Do not merge to `main` or deploy unless explicitly requested.**

## Outcome

Step 43 implements the frozen Inventory Query workflow as a real Production slice:

```text
Saved Queries
Query Builder
Run Query
Shared Operation polling
Materialized Results
```

No React Flow or unrestricted SQL-like query language was introduced.
## Production inventory source

The only currently evidence-backed fact source is Devices Step 27 software inventory.

Supported fact:

- Software

Supported fields:

- name
- version
- publisher

Supported operators are modeled by field:

- name/publisher: contains, equals
- version: equals, version_less_than

Process, Service, File and Folder are intentionally unavailable until a real production telemetry source exists.

## API implementation

Frozen operations implemented:

- GET `/api/v1/devices/inventory-queries`
- POST `/api/v1/devices/inventory-queries`
- POST `/api/v1/devices/inventory-queries/runs`
- GET `/api/v1/devices/inventory-queries/runs/{runId}/results`

Step 43 reuses:

- GET `/api/v1/operations/{operationId}`
## Authorization

Saved query list:

- permission: `devices.view`
- ownership: current user

Save:

- permission: `devices.manage`
- ownership: current user

Run:

- permission: `devices.view`
- effective device scope is captured at enqueue time

Results:

- requesting user only
- current `devices.view` permission required
- current effective device scope is reapplied when results are read

A Device Group query is validated against the caller's accessible groups before save/run.

## Persistence

EF migration:

```text
20261001055051_Step43InventoryQuery
```

Creates Devices-owned tables:

- `devices.inventory_queries`
- `devices.inventory_query_runs`
- `devices.inventory_query_results`

The migration was applied successfully to the development PostgreSQL runtime.
## Worker / shared Operation

`InventoryQueryWorker`:

- recovers interrupted running jobs back to queued on startup;
- evaluates the latest software inventory snapshot per accessible device;
- applies modeled field/operator matching;
- materializes device-centric result rows;
- updates the shared Step 41 operation with queued/running/succeeded/failed progress;
- completes successful operations at 100%;
- reports `INVENTORY_QUERY_FAILED` on worker failure.

The public operation response remains the canonical polling surface. Step 43 does not add a second public run-status endpoint.

## Web Portal

Production route:

```text
/devices/query
```

Devices contextual navigation now includes **Inventory Query**.

Page pattern: **P06 Builder**.

Desktop/tablet:

- Saved Queries / Fact coverage = supporting column
- Query Builder = primary surface
- Matching Devices = separate result collection

768 narrow Web:

- Query Builder comes first
- supporting Saved Queries follows
- results remain below both

Saved definitions do not expose a duplicate Save action. Editing a saved definition turns it back into a draft that can be saved as a new query.
## Dedicated QA

Static Step 43 guard:

```text
step43_static_checks=69
step43_static_failures=0
```

Runtime QA against the real development API / PostgreSQL / Keycloak:

```text
step43_runtime_checks=35
step43_runtime_qa=PASS
step43_runtime_matches=3
```

Coverage includes:

- Implementation Contract 0.32.0
- collection/list shape
- unsupported fact rejection
- save + search
- save requires Devices Manage
- run returns HTTP 202 shared Operation
- opaque query/run/operation IDs
- canonical status URL + Location
- owner isolation
- anonymous rejection
- operation type/origin
- terminal progress 100%
- real materialized software results
- foreign run results hidden

Browser QA:

```text
step43_browser_checks=32
step43_browser_failures=0
```
Browser coverage:

- 1366 / 1024 / 768
- no document horizontal overflow
- route/navigation active state
- Builder and Results anatomy
- 1366/1024 support column beside Builder
- 768 Builder-first ordering
- Draft shows Save + Run
- selected Saved Query hides duplicate Save
- Run Query interaction
- shared Operation reaches succeeded 100%
- real result rows render
- no visible runtime error

Screenshots:

```text
qa-step43-inventory-query/1366__inventory-query.png
qa-step43-inventory-query/1024__inventory-query.png
qa-step43-inventory-query/768__inventory-query.png
qa-step43-inventory-query/1366__inventory-query__results.png
```

All were visually inspected.
## Regression / build gates

Step 42.2G responsive regression:

```text
77/77
failures=0
```

Broad existing Production regression final rerun:

```text
51 routes
1366 checks
0 failures
```

The first broad run had one transient `ready /` failure immediately after Keycloak login; every other check passed. A stable authenticated rerun passed 1366/1366 without product changes.

Current authoritative static chain:

```text
52/52
failures=0
```

Build gates:

- `@inno/ui` build: PASS
- Web Portal typecheck: PASS
- Web Portal production build: PASS
- Platform API Release build: **0 warnings / 0 errors**
- existing Vite chunk-size advisory remains; current main bundle is about 665.5 kB before gzip
## QA environment notes

Runtime used process-level overrides only:

- Web: `http://localhost:5180`
- API: `http://127.0.0.1:5080`
- PostgreSQL: `172.10.1.58:5432`
- Keycloak: `172.10.1.58:8080`
- MeshCentral: `172.10.1.58:8443`

No appsettings or repository SDK pin was changed for runtime connectivity.

QA created development Saved Queries named `Step43 QA ...` and their run/result/operation records. No public delete operation exists in the frozen contract, and this Windows environment has no compatible PostgreSQL client/PowerShell 7 driver. They were intentionally not removed by adding a product-only cleanup endpoint.

## Contract status

Frozen contracts remain unchanged:

- Design System V1.26
- UI Contract 1.20.0
- API Contract 0.5.0
- Data Model Contract 0.6.0

Runtime Implementation Contract advances to:

```text
0.32.0
```

Historical Step 42 audits that previously required exactly 0.31.0 were normalized to require **at least 0.31.0**, so later implementation slices do not falsely fail a UX-only historical guard.
## Repository checkpoint

Step 43 feature documentation:

- `INNO-One-Step43-Inventory-Query.md`
- `inno-step43-inventory-query.json`
- `INNO-One-Step43-Next-Chat-Handoff.md`

QA:

- `step43-inventory-query-audit.py`
- `step43-runtime-qa.py`
- `step43-browser-qa.py`

## What comes next

The current repository handoffs do **not** define a frozen Step 44 after Inventory Query.

Do not invent the next feature slice from adjacent screens. Choose or add the next roadmap item explicitly before implementation.

Meeting remains deferred unless separately resumed.

Do not merge to `main` or deploy unless explicitly requested.
