# INNO.One — Step 43 Inventory Query

**Status:** COMPLETE — implementation, runtime, browser, regression and build QA passed
**Branch:** `implementation/step43-inventory-query`
**Implementation Contract:** 0.32.0
**API Contract:** 0.5.0
**Data Model Contract:** 0.6.0
**Frozen UX:** Design System V1.26 / UI Contract 1.20.0

## Purpose

Step 43 implements the frozen Inventory Query workflow without introducing an unrestricted query language or graph builder.

The production flow is:

```text
Saved Queries
Query Builder
Run Query
Shared Operation polling
Materialized Results
```

The feature consumes the Step 41 shared asynchronous Operation resource.
## Supported inventory evidence

The current production inventory source is Step 27 Devices software inventory.

Supported fact:

- Software

Supported fields:

- Software name
- Version
- Publisher

Supported operators are constrained by field. Process, Service, File and Folder are intentionally not exposed until a production telemetry source exists.

## Scope and authorization

- List saved queries: `devices.view`, self-owned saved definitions.
- Save query: `devices.manage`, self-owned saved definitions.
- Run query: `devices.view`, effective device scope captured at enqueue time.
- Results: `devices.view`, requesting user only.

Query scope may be all accessible devices or one accessible Device Group.
## API and persistence

Implemented frozen operations:

- GET `/api/v1/devices/inventory-queries`
- POST `/api/v1/devices/inventory-queries`
- POST `/api/v1/devices/inventory-queries/runs`
- GET `/api/v1/devices/inventory-queries/runs/{runId}/results`
- GET `/api/v1/operations/{operationId}` reused from Step 41

Devices-owned persistence:

- `devices.inventory_queries`
- `devices.inventory_query_runs`
- `devices.inventory_query_results`

The run stores the modeled definition and effective access scope snapshot. Results materialize device-centric software matches with the source observation timestamp.
## Web Portal

Production route:

```text
/devices/query
```

The page follows P06 Builder:

- desktop/tablet: Saved Queries support panel beside Query Builder;
- narrow Web: Query Builder comes first;
- Results remain a separate collection below the builder;
- Save is available only to Devices Manage;
- Run uses the shared Operation state/progress;
- selecting a saved definition does not imply an update endpoint; editing it creates a draft that may be saved as a new definition.

No React Flow dependency is used.

## Runtime evidence

Step 43 runtime QA executed a real saved Software query against the development PostgreSQL inventory and returned three matching endpoint devices.
## QA targets

Dedicated guards:

- `step43-inventory-query-audit.py`
- `step43-runtime-qa.py`
- `step43-browser-qa.py`

Browser QA covers 1366 / 1024 / 768 plus a completed result state.

The Step 42.2 responsive regression remains a compatibility gate. Frozen Design System V1.26 and UI Contract 1.20.0 are unchanged.

Do not merge to `main` or deploy unless explicitly requested.
