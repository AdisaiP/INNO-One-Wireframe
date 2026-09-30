# INNO.One — Step 41 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step41-asynchronous-operations`
**Scope:** Shared asynchronous operation resource
**Frozen UX baseline:** Design System **V1.26** / UI Contract **1.20.0**
**Implementation Contract:** **0.31.0**

## 1. What Step 41 implemented

Step 41 implements the frozen shared polling contract:

```http
GET /api/v1/operations/{operationId}
```

Frozen public states:

```text
queued
running
succeeded
failed
partial
```

Meeting remains intentionally deferred.
## 2. Persistence and ownership

Step 41 reuses the existing Platform Infrastructure ledger:

```text
integration.operations
```

No new operation table or migration was created.

A shared contract was added:

```text
IOperationReader
OperationSnapshot
```

Implementation ownership:

```text
INNO.One.Contracts
  -> operation read contract

INNO.One.Infrastructure
  -> integration.operations reader

Platform API
  -> public authorization-bound operation endpoint
```
## 3. Authorization boundary

An operation read is allowed only when:

1. the caller is an active INNO.One user;
2. the stored operation actor is a user;
3. the stored requesting user matches the current user;
4. the operation contains a valid originating permission context;
5. the caller still has that originating permission.

A foreign caller receives the same not-found boundary as an unavailable operation.

The public response does not expose:

- requested actor ID
- requested actor type
- permission context JSON
- internal subject ID
- internal result reference
- raw provider payload
- filesystem paths or provider secrets
## 4. Public operation response

The public resource exposes only safe polling information:

- operationId
- operationType
- originModule
- status
- progress
- errorCode
- statusUrl
- createdAt
- updatedAt
- expiresAt

Progress is normalized to 0–100.

The endpoint rejects stored states outside the frozen public state set rather than leaking an internal state.
## 5. Devices Discovery integration

The existing Discovery Scan was the first real producer integrated with the shared operation resource.

Create now returns HTTP 202 with:

```json
{
  "operationId": "op_...",
  "status": "queued",
  "statusUrl": "/api/v1/operations/op_...",
  "progress": 0,
  "resource": {
    "scanId": "scan_..."
  }
}
```

The HTTP Location header now points to the canonical operation polling resource.

The existing scan resource remains available for module-specific result details.
## 6. Web Portal integration

Updated:

```text
production/apps/web-portal/src/api/types.ts
production/apps/web-portal/src/api/client.ts
production/apps/web-portal/src/pages/DiscoveryPage.tsx
```

Added:

- OperationState
- OperationStatus
- getOperation(operationId)

Network Discovery now polls the shared operation resource for canonical state/progress while retaining the Devices scan resource for addresses/results.

The UI also surfaces the opaque Operation ID and origin module in the current scan summary.
## 7. Contract version

Runtime implementation contract:

```text
0.31.0
```

Frozen UX contracts remain:

```text
Design System V1.26
UI Contract 1.20.0
```

No design-system or route-architecture version changed.
## 8. Static / build QA

Step 41 audit:

```text
step41-asynchronous-operations-audit.py
issues=0
```

Full static regression:

```text
STATIC_TOTAL=40
STATIC_FAILED=0
```

TypeScript typecheck:

```text
PASS
```

Vite production build:

```text
PASS
```

Existing bundle warning remains around 604 kB before gzip.
.NET solution build:

```text
0 warnings
0 errors
```

Repository SDK remains pinned to `10.0.103`.
The Windows QA machine currently has `10.0.201`; build checks temporarily used that installed SDK and restored `global.json` afterward.

EF check for `InfrastructureDbContext`:

```text
No changes have been made to the model since the last migration.
EF_EXIT=0
```

No Step 41 migration is required.

`git diff --check` passes.
## 9. Runtime QA

Runtime target:

```text
PostgreSQL 172.10.1.58:5432
Keycloak   172.10.1.58:8080
```

Result:

```text
35 / 35 PASS
```

Coverage includes:

- Implementation Contract 0.31.0
- HTTP 202 operation creation
- opaque operation and scan IDs
- canonical statusUrl and Location header
- owner can read operation
- foreign user receives 404
- anonymous access rejected
- malformed/missing operation IDs hidden
- safe public response field boundary
- polling through terminal state
- progress reaches 100
- origin scan and operation state agree
## 10. Browser / visual QA

Browser QA:

```text
step41-browser-qa.py
23 / 23 PASS
```

Viewports:

- 1366
- 1024
- 768

Verified:

- real Keycloak sign-in
- Network Discovery route
- Run Scan interaction
- shared operation resource appears
- scan reaches succeeded
- canonical Operation ID remains visible
- global/context navigation active state
- no page-level horizontal overflow
- main content stays inside viewport

Screenshots:

```text
qa-step41-browser-1366-1024-768/discovery-1366.png
qa-step41-browser-1366-1024-768/discovery-1024.png
qa-step41-browser-1366-1024-768/discovery-768.png
```
All three screenshots were visually inspected.

Desktop keeps the existing two-panel Discovery layout.
Narrow Web behavior remains stable at 1024 and 768.
The Operation metadata remains secondary to the primary scan task and does not introduce a new competing navigation pattern.

QA-created Discovery scans and operation records were removed after verification:

```text
deleted_scans=3
deleted_operations=3
```
## 11. Next recommended slice

Recommended next implementation:

# Step 42 — Inventory Query

Why next:

- Inventory Query is already frozen in the API/UI contracts.
- It is a natural consumer of the shared Step 41 operation resource.
- Query execution is explicitly asynchronous in the frozen contract.
- It provides the next reusable proof that module-owned jobs can share one operation polling shape.

Expected screens:

```text
device-query.html
```

Expected shape:

```text
Saved Queries
Query Builder
Run Query
Operation polling
Results
```

Do not start Meeting unless separately resumed.

Do not merge Step 41 to main unless explicitly requested.
Do not deploy.
