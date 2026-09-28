# INNO.One — Step 37 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step37-notification-center`
**Scope:** Platform Notification Center
**Frozen UX baseline:** Design System **V1.26** / UI Contract **1.20.0**
**Implementation Contract:** **0.27.0**

## 1. What Step 37 implemented

Step 37 turns the frozen global Notification Center contract into a real production vertical slice.

This is a **personal Platform notification surface**, not an Admin notification-settings module.

Canonical route:

```text
/notifications
```

Permission:

```text
platform.notifications.view
```

The source-of-truth contracts used for this slice are:

- `notifications.html`
- `design-system.html`
- `INNO-One-Design-System-V1-Frozen.md`
- `INNO-One-Permission-Scope-Contract.md`
- `INNO-One-API-Contract.md`
- `INNO-One-Data-Ownership-Database-Contract.md`
- `INNO-One-Event-Audit-Contract.md`
- `INNO-One-Workspace-Architecture-Plan.md`

Meeting remains intentionally deferred.

## 2. Ownership boundary

Platform owns user-targeted notification records and personal read/unread state.

Notifications remain consumers of domain/integration facts rather than owners of the source business event.

A notification deep link is only a normal INNO.One route reference. Opening it does **not** bypass destination authorization.

No `admin.notifications.*` permission or speculative Admin notification configuration was introduced.

Helpdesk notification rule/template/settings APIs remain Helpdesk-owned and are not reused as global Platform notification configuration.

## 3. Persistence

Added Platform entity:

```text
PlatformNotification
```

Table:

```text
platform.notifications
```

Fields:

- Id
- UserId
- SourceModule
- NotificationType
- Title
- Message
- DestinationPath
- IsImportant
- ReadAt
- CreatedAt

Indexes:

- UserId + ReadAt + CreatedAt
- UserId + IsImportant + CreatedAt

UserId is a same-module FK to `platform.user_profiles`.

Migration:

```text
Step37PlatformNotifications
```

Development seed creates representative personal notifications for the existing admin and HR viewer accounts.

## 4. API

Implemented the frozen public API operations:

```http
GET   /api/v1/platform/notifications
PATCH /api/v1/platform/notifications/{notificationId}
POST  /api/v1/platform/notifications/mark-all-read
```

All require:

```text
platform.notifications.view
```

GET supports:

- page
- pageSize
- state=all|unread

It returns only notifications owned by the current user.

PATCH accepts:

```json
{
  "isRead": true
}
```

Cross-user notification IDs return 404 rather than exposing another user's personal notification state.

Mark-all-read mutates only unread notifications belonging to the current user.

## 5. Production Web UI

New page:

```text
production/apps/web-portal/src/pages/NotificationsPage.tsx
```

Implemented:

- Workspace / Notifications page
- unread / important / all summary
- real notification feed
- unread visual treatment
- Important status
- module identity
- relative age
- real Mark all read action
- real persisted read state
- click notification → mark read → navigate to normal destination route
- empty state: “You’re all caught up”
- safe-deep-link explanation
- responsive layout aligned to the frozen V1.26 design language

The prototype's preference controls were **not** ported because no persisted personal preference contract exists yet.

Profile copy now clarifies:

- notification read state is persisted
- email/desktop preference controls remain unavailable until a persistence contract exists

## 6. Shell integration

The global shell now exposes a notification bell when the user has `platform.notifications.view`.

Notifications also appear in the Account contextual navigation and the temporary shell page-search target list.

The Account rail remains the single active global rail context for Profile / Notifications.

Global Search itself remains a later platform slice.

## 7. Permissions / development seed

Added:

```text
platform.notifications.view
```

Development grants currently include:

- Platform Admin
- Device Viewer
- Support Agent
- Employee Helpdesk

This keeps Notification Center available for the existing seeded user personas while all API reads remain self-scoped.

## 8. QA

### Static

`step37-notification-center-audit.py`:

```text
issues=0
```

Full Step 15–37 static regression:

```text
STEP37_STATIC_CHAIN=PASS
FINAL_STATIC_FAILED_COUNT=0
```

The full frozen UX audit chain also passes:

- action/layout
- accessibility
- availability
- language/terminology
- interaction/feedback
- table/list density
- state coverage
- design system
- component consistency
- density/spacing
- interaction consistency
- responsive pass
- final visual baseline

### Runtime

`step37-runtime-qa.py`:

```text
28 / 28 PASS
```

Verified against real PostgreSQL + Keycloak on `172.10.1.58`:

- health reports Implementation Contract 0.27.0
- permission seeded for admin + viewer
- admin sees only its five notification records
- viewer sees only its own notification record
- unread filter
- important/unread counts
- invalid filter rejection
- mark one read
- mark all read
- cross-user mutations return 404
- malformed opaque ID returns 404
- baseline unread state restored after mutation QA

### Browser / visual

`step37-browser-qa.py`:

```text
61 / 61 PASS
```

Real Keycloak login, tested at:

- 1366
- 1024
- 768

Verified:

- five notification rows
- two unread rows
- global bell link
- correct active rail/context navigation
- Mark all read visible/enabled
- no fake notification preference controls
- safe deep-link copy
- no page-level horizontal overflow
- main content stays inside viewport

Screenshots:

```text
qa-step37-browser-1366-1024-768/notifications-1366.png
qa-step37-browser-1366-1024-768/notifications-1024.png
qa-step37-browser-1366-1024-768/notifications-768.png
```

All three were visually inspected and are acceptable against the current V1.26 production bridge.

### Builds

- TypeScript typecheck: PASS
- Vite production build: PASS
- Vite warning only: application chunk is above 500 kB
- .NET build: **0 warnings / 0 errors**
- EF pending-model check: PASS
- `git diff --check`: PASS

## 9. Important local-runtime note

During runtime QA, `appsettings.Development.json` was temporarily pointed from localhost infrastructure to `172.10.1.58`.

Do **not** commit that QA-only configuration drift.

Before the Step 37 Git checkpoint:

1. stop the QA API process,
2. restore `appsettings.Development.json`,
3. verify the working tree contains only Step 37 source/docs/QA changes.

## 10. Next action

Step 37 is closed after the Git checkpoint.

The next contract-backed platform slice is expected to be:

# Step 38 — Global Search

Current frozen direction:

- route `/search`
- permission `platform.search.use`
- `GET /api/v1/search`
- common resource-reference response shape
- authorization filtering before results are returned
- module/provider orchestration rather than direct cross-module table reads
- read models/projections are allowed but are not a new source of truth
- destination authorization still applies after opening a result

Before implementing Step 38, inspect the current Devices / Assets / Helpdesk query contracts and decide the minimum truthful search-provider boundary.

Do not merge `main`.

Do not deploy.

Meeting remains intentionally deferred.
