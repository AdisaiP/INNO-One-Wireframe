# INNO.One — Step 38 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step38-global-search`
**Scope:** Global Search
**Frozen UX baseline:** Design System **V1.26** / UI Contract **1.20.0**
**Implementation Contract:** **0.28.0**

## 1. What Step 38 implemented

Step 38 replaces the temporary shell page-name search with the frozen Global Search contract.

Canonical route:

```text
/search
```

Permission:

```text
platform.search.use
```

Public API:

```http
GET /api/v1/search?q=<query>&limit=<limit>
```

The implementation follows:

- `INNO-One-API-Contract.md`
- `INNO-One-Permission-Scope-Contract.md`
- `INNO-One-Data-Ownership-Database-Contract.md`
- `INNO-One-Implementation-Architecture-Contract.md`
- `INNO-One-Workspace-Architecture-Plan.md`
- Design System V1.26 / UI Contract 1.20.0

Meeting remains intentionally deferred.

## 2. Architecture boundary

Platform owns search orchestration only.

Platform does **not** query Devices, Assets or Helpdesk persistence directly.

A shared contract now lives in:

```text
production/services/platform-api/src/INNO.One.Contracts/Search/SearchContracts.cs
```

It defines:

- `GlobalSearchResult`
- `IGlobalSearchProvider`

Each owning module implements its own provider and applies its own permission/scope rules before returning resource references.

This preserves the frozen rule:

> Global Search returns only authorization-filtered resource references.

Opening a result still runs the destination route's normal authorization.

No new cross-module source-of-truth table or search index was introduced in Step 38.

## 3. Search providers

### Devices

Provider:

```text
DevicesGlobalSearchProvider
```

Requires:

```text
devices.view
```

Searches:

- hostname
- serial number
- IP address
- operating system

Scope follows the Devices list boundary:

- organization
- location
- device group
- all-resources when explicitly granted

Result:

```text
type = device
route = /devices/dev_...
```

### Assets

Provider:

```text
AssetsGlobalSearchProvider
```

Requires:

```text
assets.view
```

Searches:

- asset tag
- name
- serial number
- brand
- model

Scope follows Assets visibility:

- organization
- location
- linked Device group through `IDeviceDirectoryReader`

Result:

```text
type = asset
route = /assets/asset_...
```

### Helpdesk

Provider:

```text
HelpdeskGlobalSearchProvider
```

Requires:

```text
helpdesk.ticket.view
```

Searches:

- ticket number
- subject

Scope follows Helpdesk ticket visibility:

- all-resources
- current user is requester
- current user is assignee
- requester organization is in effective organization scope

Result:

```text
type = ticket
route = /helpdesk/tickets/ticket_...
```

## 4. Platform API

New:

```text
production/services/platform-api/src/Modules/Platform/Api/GlobalSearchEndpoints.cs
```

Behavior:

- requires `platform.search.use`
- missing/blank `q` returns 400 ProblemDetails
- `limit` defaults to 30 and is clamped to 1–50
- resolves all registered `IGlobalSearchProvider` implementations
- collects already-filtered provider results
- ranks exact match, then prefix match, then other matches
- applies the global result limit
- returns only the common resource-reference shape

Response fields:

- query
- items
- totalItems
- providerCount

Current provider count:

```text
3
```

No direct module DbContext reference exists in the Platform endpoint.

## 5. Permission seed

Added:

```text
platform.search.use
```

Development role grants include:

- Platform Admin
- Device Viewer
- Support Agent
- Employee Helpdesk

Destination module permissions still determine whether each provider contributes results.

The permission is included in both existing development permission/role ensure chains.

## 6. Web Portal

New page:

```text
production/apps/web-portal/src/pages/SearchPage.tsx
```

Features:

- route `/search?q=...`
- real API-backed global search
- query URL state
- search input + Search action
- initial state
- loading/error state
- no-results state
- Device / Asset / Ticket result summary
- common resource result rows
- direct links to destination resources
- authorization-boundary explanation
- responsive layout

The global header search now sends resource queries to:

```text
/search?q=...
```

The old local `searchTargets` page-name lookup was removed.

The header search only renders when the current user has:

```text
platform.search.use
```

Search is treated as a Workspace utility, not as another application rail item.

## 7. Regression audit update

Step 35 and Step 36 audit scripts previously asserted that Branding and Platform Settings appeared inside the old temporary shell `searchTargets` list.

Since Step 38 intentionally removes that temporary page-name search, those two obsolete assertions were removed.

Their real route, permission, side-navigation and Admin Overview checks remain intact.

## 8. QA

### Runtime

`step38-runtime-qa.py`:

```text
28 / 28 PASS
```

Verified against real PostgreSQL + Keycloak on `172.10.1.58`:

- health reports Implementation Contract 0.28.0
- admin and HR viewer have `platform.search.use`
- missing query rejected with 400
- exact Device result
- exact Asset result
- exact Helpdesk ticket result
- exact five-field common resource-reference shape
- correct opaque destination routes
- multi-result Device search
- provider count = 3
- global limit respected
- HR viewer can see HR Device
- HR viewer cannot see Digital Technology Device
- HR viewer receives no Asset result without `assets.view`
- HR viewer can see HR ticket
- HR viewer cannot see Finance ticket
- no-match returns 200 with empty result set

### Browser / responsive visual

`step38-browser-qa.py`:

```text
55 / 55 PASS
```

Real Keycloak login.

Tested at:

- 1366
- 1024
- 768

Verified:

- Search route renders
- real Device result appears
- no page-level horizontal overflow
- main content remains inside viewport
- Search has no application rail selection
- Workspace/Search contextual navigation is active
- global header search is visible
- destination Device route is correct
- initial Search state
- Helpdesk ticket result + route
- Asset result + route
- no-results state

Screenshots:

```text
qa-step38-browser-1366-1024-768/search-device-1366.png
qa-step38-browser-1366-1024-768/search-device-1024.png
qa-step38-browser-1366-1024-768/search-device-768.png
```

All three were visually inspected and accepted against the current V1.26 production bridge.

### Static regression

`step38-global-search-audit.py`:

```text
issues=0
```

Full Step 15–38 regression plus frozen UX audit chain:

```text
FINAL_STATIC_FAILED_COUNT=0
STEP38_STATIC_CHAIN=PASS
```

### Builds

- TypeScript typecheck: PASS
- Vite production build: PASS
- Vite warning only: JS chunk ~591 kB before gzip is above the 500 kB warning threshold
- .NET build: 0 warnings / 0 errors
- EF pending-model check: no pending model changes
- `git diff --check`: PASS

Step 38 adds no database entity/table, so no EF migration is required.

## 9. Runtime cleanup

Runtime QA temporarily pointed local Development infrastructure settings at `172.10.1.58`.

That QA-only configuration was restored before the Git checkpoint.

QA processes on:

- 5080
- 5180
- 9238

were stopped after verification.

## 10. Next contract-backed slice

After Apps, Notifications and Search, the remaining frozen Workspace Layer contract is **Workspace Home**.

The API matrix already defines:

```http
GET /api/v1/platform/workspace
GET /api/v1/platform/workspace/continue
GET /api/v1/platform/workspace/attention
GET /api/v1/platform/activity
```

Base permission:

```text
platform.workspace.access
```

The Workspace Architecture explicitly says Home is a **Start Page**, not an operational KPI dashboard.

Expected next step:

# Step 39 — Workspace Home

Before implementation:

1. inspect `workspace-v2.html`, `workspace-continue.html`, and `workspace-attention.html`;
2. inspect the exact response/data ownership contract for workspace/activity;
3. reuse module query contracts/providers rather than directly reading module tables from Platform;
4. do not reintroduce module KPI dashboards into Home;
5. keep Meeting cards/actions deferred unless a real Meeting contract-backed implementation exists.

Do not merge `main`.

Do not deploy.

Meeting remains intentionally deferred.
