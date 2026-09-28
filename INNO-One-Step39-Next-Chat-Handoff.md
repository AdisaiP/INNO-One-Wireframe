# INNO.One — Step 39 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step39-workspace-home`
**Scope:** Workspace Home / Continue Working / Needs Attention / Recent Activity
**Frozen UX baseline:** Design System **V1.26** / UI Contract **1.20.0**
**Implementation Contract:** **0.29.0**

## 1. What Step 39 implemented

Step 39 turns the frozen Workspace Home contract into the production start page.

Canonical routes:

```text
/                         Workspace Home
/workspace/continue       Continue Working
/workspace/attention      Needs Attention
/workspace/recent         Recent Activity
```

Base permission:

```text
platform.workspace.access
```

Public API:

```http
GET /api/v1/platform/workspace
GET /api/v1/platform/workspace/continue
GET /api/v1/platform/workspace/attention
GET /api/v1/platform/activity
```

The implementation follows:

- `workspace-v2.html`
- `workspace-continue.html`
- `workspace-attention.html`
- `workspace-recent.html`
- `INNO-One-Workspace-Architecture-Plan.md`
- `INNO-One-API-Contract.md`
- `INNO-One-Permission-Scope-Contract.md`
- `INNO-One-Data-Ownership-Database-Contract.md`
- Design System V1.26 / UI Contract 1.20.0

Meeting remains intentionally deferred.

## 2. Workspace Home boundary

Workspace Home is a **Start Page**, not an operational KPI dashboard.

The page contains only cross-app starting context:

- greeting / workspace orientation
- Your Apps
- Continue Working
- Needs Attention
- Recent Activity

It does **not** move module-owned operational dashboards into Platform.

Not introduced:

- Device CPU charts
- Helpdesk SLA dashboard
- Meeting analytics
- Admin settings
- module configuration
- fake Meeting cards

## 3. Module ownership

Platform owns orchestration and presentation.

Platform does **not** query Devices, Assets or Helpdesk tables directly for attention signals.

New shared contract:

```text
production/services/platform-api/src/INNO.One.Contracts/Workspace/WorkspaceContracts.cs
```

It defines:

- `WorkspaceAttentionItem`
- `IWorkspaceAttentionProvider`

Module-owned implementations:

### Devices

```text
DevicesWorkspaceAttentionProvider
```

Requires `devices.view`.

Current live signal:

- offline/non-online devices inside the effective Devices scope

Route:

```text
/devices
```

### Helpdesk

```text
HelpdeskWorkspaceAttentionProvider
```

Requires `helpdesk.ticket.view`.

Current live signal:

- open tickets assigned to the current user
- SLA risk detail when assigned tickets are near/beyond resolution target

Route:

```text
/helpdesk/assigned
```

If the current user has no open assigned tickets, Helpdesk correctly returns no attention item.

### Assets

```text
AssetsWorkspaceAttentionProvider
```

Requires `assets.view`.

Current live signal:

- active contracts expiring within 90 days in the effective Assets scope

Route:

```text
/assets/contracts
```

## 4. Activity / Continue Working persistence

Added Platform read-model entity:

```text
PlatformActivityItem
```

Table:

```text
platform.activity_items
```

Fields:

- Id
- UserId
- SourceModule
- ResourceType
- ResourceId
- Title
- Activity
- DestinationPath
- OccurredAt

Index:

- UserId + OccurredAt

Migration:

```text
Step39WorkspaceActivity
```

Development seed creates user-scoped activity projections for the existing test personas.

`GET /platform/activity` and Continue Working only read activity belonging to the current user and only expose modules for which the user still has the module entry permission.

Destination authorization remains authoritative when a resource link is opened.

### Important limitation

Step 39 establishes the persisted Workspace activity read-model boundary, but it does **not** invent an unsupported public `POST /activity` API.

The current Development environment seeds representative activity projection rows.

Automatic projection updates from future domain-event consumers remain infrastructure work once the ingestion/event-consumer contract is defined.

## 5. Apps on Workspace Home

Your Apps is resolved from the existing module manifest + App Module state.

An app is shown only when:

- it is launcher-enabled in its module manifest,
- it is installed,
- it is enabled,
- required dependencies are available,
- the current user passes the module's entry permission.

Current runtime for `adisai` shows:

- Assets
- Devices
- Helpdesk

Meeting is not surfaced because it is still deferred.

## 6. Production Web UI

New production page module:

```text
production/apps/web-portal/src/pages/WorkspacePages.tsx
```

Exports:

- `WorkspaceHomePage`
- `WorkspaceContinuePage`
- `WorkspaceAttentionPage`
- `WorkspaceRecentPage`

Workspace Home implements the frozen hierarchy:

- welcome hero
- compact workspace context pills
- Your Apps cards
- Continue Working feed
- Needs Attention feed
- Recent Activity table

Responsive behavior is defined in the production shared shell stylesheet.

## 7. Shell integration

The INNO.One brand now returns to Workspace Home when the user has `platform.workspace.access`.

Global rail adds a real Home icon.

Workspace contextual navigation now includes:

```text
Start
  Home
  Apps
  Search

My Workspace
  Continue Working
  Needs Attention
  Recent

Account
  Notifications
  Profile & Settings
```

At narrow Web widths the contextual navigation continues to use the existing menu/drawer behavior.

## 8. QA

### Static Step 39

`step39-workspace-home-audit.py`:

```text
issues=0
```

### Full static regression

Steps 15–39 plus frozen UX audit chain:

```text
FINAL_STATIC_FAILED_COUNT=0
STEP39_STATIC_CHAIN=PASS
```

Includes:

- Action/Layout
- Accessibility
- Availability
- Language/Terminology
- Interaction/Feedback
- Table/List Density
- State Coverage
- Design System
- Component Consistency
- Density/Spacing
- Interaction Consistency
- Responsive Pass
- Final Visual

### Runtime

`step39-runtime-qa.py`:

```text
40 / 40 PASS
```

Verified against real PostgreSQL + Keycloak runtime on `172.10.1.58`.

Coverage includes:

- Implementation Contract 0.29.0
- Workspace permission
- current user isolation
- three effective app cards for admin
- Meeting excluded
- persisted Continue Working projection
- persisted Recent Activity projection
- live Devices attention
- live Assets contract attention
- provider partial-failure boundary
- attention count consistency
- absolute destination routes
- activity limit/order/shape
- HR viewer app filtering
- HR viewer self-activity isolation
- HR viewer Assets exclusion
- authentication required

The current live admin attention result during QA was:

- 5 Devices requiring attention
- 1 Assets contract expiring soon
- no Helpdesk item because the current DB had no open ticket assigned to `adisai`

This is expected provider behavior, not a missing Helpdesk provider.

### Browser / responsive

`step39-browser-qa.py`:

```text
82 / 82 PASS
```

Real Keycloak login tested at:

- 1366
- 1024
- 768

Verified:

- Workspace Home loads at `/`
- exactly three current app cards
- four current-user Continue Working resources
- live Needs Attention items
- four Recent Activity rows
- active Home rail/context navigation
- no Meeting content
- no page-level horizontal overflow
- main content remains within viewport
- Continue Working route
- Needs Attention route
- Recent Activity route

Screenshots:

```text
qa-step39-browser-1366-1024-768/workspace-home-1366.png
qa-step39-browser-1366-1024-768/workspace-home-1024.png
qa-step39-browser-1366-1024-768/workspace-home-768.png
```

All three were visually inspected and accepted against the current V1.26 production bridge.

### Builds

- TypeScript typecheck: PASS
- Vite production build: PASS
- Vite warning only: JS application chunk ~602 kB before gzip exceeds 500 kB
- .NET build: 0 warnings / 0 errors
- EF pending-model check: no pending model changes
- `git diff --check`: PASS

## 9. QA/runtime cleanup

Runtime QA temporarily points local Development infrastructure settings to:

```text
172.10.1.58
```

Before the Step 39 Git checkpoint:

- stop QA API / Vite / Chrome
- restore `appsettings.Development.json`
- verify ports 5080 / 5180 / 9240 are closed
- verify no QA-only configuration drift is staged

This cleanup was performed before the final Git checkpoint.

## 10. Next contract-backed slice

The next unimplemented Workspace/Account API already frozen in the API matrix is:

# Step 40 — Profile & Settings

Existing contract:

```http
PATCH /api/v1/platform/me/profile
```

Permission / scope:

```text
platform.workspace.access
self
```

Source UI:

```text
profile.html
```

Before Step 40:

1. inspect the exact mutable profile fields supported by the API/data contract;
2. do not allow organization-managed identity fields to become user-editable without contract support;
3. preserve Keycloak identity vs INNO.One business-profile separation;
4. do not enable fake Email/Desktop preference toggles until a preference persistence contract exists;
5. keep Meeting deferred.

Do not merge `main`.

Do not deploy.
