# INNO.One — API Contract

**Date:** 2026-09-26  
**Status:** Implementation planning contract  
**API Contract:** 0.5.0
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0  
**Architecture Contract:** 0.2.0  
**Scope:** Step 11 — API Contract  
**Backend implementation:** Not started by this document

## 1. Purpose

This document maps the final-frozen INNO.One UI into a production API boundary.

It defines:

- API namespace and versioning,
- authentication/authorization expectations,
- request/response conventions,
- pagination/filtering/sorting,
- validation/error semantics,
- optimistic concurrency,
- idempotency,
- asynchronous operation handling,
- module endpoint ownership,
- screen-to-endpoint coverage,
- cross-module linking rules,
- Endpoint Agent and Android Mobile API boundaries.

The machine-readable source is `inno-api-contract.json`.

The OpenAPI 3.1 planning skeleton is `openapi-inno-one-v1.json`.

## 2. Base API

Production external namespace:

```text
/api/v1
```

Examples:

```text
GET  /api/v1/devices
GET  /api/v1/helpdesk/tickets/{ticketId}
POST /api/v1/admin/access-scopes/evaluate
```

Version belongs in the URL at the public boundary.

Internal implementation projects may use normal .NET namespaces/modules; clients must not depend on internal assembly names.

## 3. Authentication

Normal Web/Mobile API authentication uses a Keycloak-issued Bearer token.

```http
Authorization: Bearer <JWT>
```

Keycloak establishes identity.

INNO.One resolves that identity into:

- User Profile,
- role assignments,
- permission catalog,
- access assignments,
- effective resource scope.

Authorization remains server-side authoritative.

The Endpoint Agent may later use a device-bound credential/session in addition to user context. Exact device credential provisioning is deferred; Agent endpoints must not assume a browser cookie.

## 4. Correlation and tracing

Clients may send:

```http
X-Correlation-Id: <uuid-or-trace-token>
```

The API returns a correlation identifier on every response.

Errors also expose:

```text
traceId
correlationId
```

This enables Helpdesk, Device, Agent and audit records to be correlated across module boundaries.

## 5. Resource identifiers

API identifiers are stable opaque identifiers.

Examples:

```text
dev_...
ticket_...
asset_...
user_...
org_...
location_...
role_...
asg_...
report_...
meeting_...
```

User-visible codes such as:

```text
HD-2026-001048
EMP-00184
AST-PC-000142
DESKTOP-HR-014
```

are display/business identifiers and are not required to be the persistence primary key.

URLs and relationships should use opaque IDs unless a route explicitly documents a business-key lookup.

## 6. Time and locale

Timestamps returned by APIs use ISO 8601 with timezone.

Recommended canonical server representation:

```text
2026-09-26T08:30:00Z
```

Web/Agent/Mobile convert to local display time.

API enums/codes stay language-neutral English identifiers. Thai text in Agent/Mobile is presentation content, not translated API field names.

## 7. Standard success shapes

### 7.1 Resource

```json
{
  "data": {
    "id": "dev_123",
    "name": "DESKTOP-HR-014"
  }
}
```

### 7.2 Collection without pagination

```json
{
  "data": [
    { "id": "..." },
    { "id": "..." }
  ]
}
```

### 7.3 Paged collection

```json
{
  "items": [
    { "id": "..." }
  ],
  "page": 1,
  "pageSize": 25,
  "totalItems": 128,
  "totalPages": 6
}
```

### 7.4 Command result

```json
{
  "data": {
    "status": "completed"
  }
}
```

### 7.5 Asynchronous operation

```json
{
  "operationId": "op_...",
  "status": "queued",
  "statusUrl": "/api/v1/operations/op_..."
}
```

## 8. Pagination

Canonical query parameters:

```text
page
pageSize
search
sort
order
```

Defaults:

```text
page = 1
pageSize = 25
max pageSize = 100
```

Example:

```http
GET /api/v1/devices?page=2&pageSize=25&search=notebook&sort=lastSeenAt&order=desc
```

The API performs authorization filtering before calculating:

- totalItems,
- totalPages,
- returned items.

Never calculate counts from unauthorized rows and then hide rows client-side.

## 9. Filtering

Resource-specific filters use explicit query parameters.

Examples:

```text
GET /devices?status=online&groupId=grp_...
GET /assets?ownerId=user_...&organizationId=org_...
GET /helpdesk/tickets?queue=assigned-to-me&priority=P2&status=in_progress
GET /reports/saved?owner=me&dataset=assets
GET /admin/users?status=active&organizationId=org_...
```

Do not accept an unrestricted SQL-like filter expression from normal UI clients.

Advanced Device Inventory Query remains its own modeled query resource.

## 10. Sorting

Canonical query:

```text
sort=<known-field>
order=asc|desc
```

Each endpoint publishes an allow-list of sortable fields.

Unknown sort fields return validation failure rather than being silently ignored.

## 11. Validation

Invalid write requests return HTTP 422:

```json
{
  "type": "https://inno.one/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "One or more fields are invalid.",
  "traceId": "trace_...",
  "correlationId": "corr_...",
  "retryable": false,
  "fieldErrors": {
    "subject": [
      "Subject is required."
    ],
    "categoryId": [
      "Category does not exist."
    ]
  }
}
```

This maps directly to the frozen UI validation behavior:

- inline field errors,
- focus first invalid field,
- one summary error toast.

## 12. Canonical error contract

Content type:

```text
application/problem+json
```

Required implementation error codes:

```text
VALIDATION_FAILED
UNAUTHENTICATED
PERMISSION_DENIED
RESOURCE_NOT_FOUND
CONFLICT
PRECONDITION_FAILED
MODULE_DISABLED
RESOURCE_OFFLINE
PARTIAL_FAILURE
DEPENDENCY_UNAVAILABLE
RATE_LIMITED
```

Recommended status mapping:

| HTTP | Code / meaning |
| --- | --- |
| 400 | malformed request |
| 401 | UNAUTHENTICATED |
| 403 | PERMISSION_DENIED |
| 404 | RESOURCE_NOT_FOUND |
| 409 | CONFLICT |
| 412 | PRECONDITION_FAILED |
| 422 | VALIDATION_FAILED |
| 424 / 503 | dependency unavailable |
| 429 | RATE_LIMITED |

## 13. UI state mapping

The API must preserve enough information for the frozen state contract.

### Empty

Valid collection with zero items and no active user filter.

### No Results

Valid collection with zero items while search/filter criteria are active.

### Loading

Client state while request/operation is pending.

### Error

Non-permission/non-offline failure.

### Permission Denied

HTTP 403.

### Module Disabled

Problem code:

```text
MODULE_DISABLED
```

### Resource Offline

For cached resource-detail experiences, the API may return the last-known resource data with an explicit connectivity state:

```json
{
  "data": {
    "id": "dev_...",
    "connectivity": {
      "state": "offline",
      "lastSeenAt": "..."
    }
  }
}
```

The UI keeps cached detail visible under the Offline banner.

### Partial Failure

Batch operations preserve successful items and identify only failures.

```json
{
  "operationId": "op_...",
  "status": "partial",
  "summary": {
    "succeeded": 91,
    "failed": 5
  },
  "failures": [
    {
      "resourceId": "dev_...",
      "code": "RESOURCE_OFFLINE"
    }
  ]
}
```

## 14. Optimistic concurrency

Mutable configuration resources use:

```text
ETag
If-Match
```

Example:

```http
GET /api/v1/devices/alert-rules/rule_1

ETag: "v7"
```

Update:

```http
PUT /api/v1/devices/alert-rules/rule_1
If-Match: "v7"
```

A stale update returns:

```text
412 PRECONDITION_FAILED
```

Use this for configuration/edit resources such as:

- policies,
- alert rules,
- remote-consent configuration,
- SLA policies,
- notification rules/templates/settings,
- automation rules,
- organization masters,
- user profiles,
- roles/access assignments,
- saved reports.

## 15. Idempotency

High-impact create commands require:

```http
Idempotency-Key: <client-generated-key>
```

Required for:

- remote-session creation,
- deployment creation,
- screenshot/wake jobs,
- maintenance jobs,
- restart jobs,
- alert channel tests,
- report runs/exports,
- meeting processing.

A retry with the same key and equivalent request returns the same operation/resource result rather than creating duplicate work.

## 16. Asynchronous jobs

Long-running work returns HTTP 202.

Examples:

- network discovery,
- deployment,
- software maintenance,
- restart,
- screenshot capture,
- wake-on-LAN job,
- inventory query execution,
- report execution/export,
- meeting recording/processing.

Operation states:

```text
queued
running
succeeded
failed
partial
```

The public polling shape is:

```text
GET /api/v1/operations/{operationId}
```

The operation resource is authorization-bound to the caller/origin resource permission.

## 17. File uploads

The frozen UI requires file handling for:

- Remote Session file transfer,
- Helpdesk attachments,
- Meeting audio upload,
- Meeting files.

Step 11 does not freeze object-storage technology.

Initial contract:

- uploads use module-owned endpoints,
- file size/type validation is server-side,
- malware/security scanning may be inserted before final availability,
- clients receive an opaque file/resource ID,
- filesystem paths are never exposed as public IDs.

For large Meeting recordings, implementation may later move to a signed multipart/object-storage flow without changing Meeting resource semantics.

## 18. Cross-module linking

References use stable IDs.

Examples:

```text
Ticket.relatedDeviceId -> Devices Device ID
Ticket.relatedAssetId  -> Assets Asset ID
Asset.linkedDeviceId   -> Devices Device ID
Device.ownerUserId     -> Platform User ID
Asset.ownerUserId      -> Platform User ID
```

Rules:

- Helpdesk does not embed/copy Device authorization records.
- Assets does not own User or Organization records.
- Reports does not query another module's tables directly.
- Global Search returns only authorization-filtered resource references.
- Deep links still require destination permission.

## 19. Key request models

These examples define semantic payload ownership. Exact optional fields may expand during implementation, but the frozen UI job must remain intact.

### 19.1 Organization Unit

```json
{
  "name": "Digital Technology",
  "code": "DTD",
  "unitType": "division",
  "parentUnitId": "org_root",
  "managerUserId": "user_...",
  "primaryLocationId": "loc_a"
}
```

### 19.2 Location

```json
{
  "name": "Building A",
  "code": "TECH-A",
  "locationType": "building",
  "parentLocationId": "loc_technopolis",
  "description": "Technopolis Building A"
}
```

### 19.3 User Profile

```json
{
  "employeeId": "EMP-00184",
  "fullName": "Adisai Plomlee",
  "organizationUnitId": "org_dtd",
  "positionId": "pos_sysdev",
  "email": "adisai@inno.local",
  "phone": "02-577-9999 ext. 184",
  "locationId": "loc_a",
  "office": "Floor 3",
  "status": "active"
}
```

Credentials/password are not part of this payload.

### 19.4 Access Assignment

```json
{
  "subjectType": "user",
  "subjectId": "user_...",
  "roleId": "support_agent",
  "scope": {
    "type": "organization",
    "resourceIds": [
      "org_head_office"
    ],
    "includeChildren": true
  },
  "actionOverrides": [
    "devices.view",
    "devices.remote",
    "devices.deploy"
  ],
  "status": "active"
}
```

### 19.5 Ticket Create

```json
{
  "subject": "Cannot connect VPN",
  "description": "FortiClient cannot establish a tunnel.",
  "categoryId": "cat_network",
  "subcategoryId": "cat_vpn",
  "relatedDeviceId": "dev_...",
  "relatedAssetId": "asset_...",
  "impact": "medium",
  "urgency": "high",
  "attachmentIds": []
}
```

Priority is server-calculated when the configured Helpdesk model requires it.

### 19.6 Ticket Reassign

```json
{
  "teamId": "team_network",
  "assigneeUserId": "user_...",
  "note": "Escalated to Network team."
}
```

### 19.7 Automation Rule

```json
{
  "name": "P1 three-level escalation",
  "trigger": "sla_at_risk",
  "scope": {
    "priority": "P1"
  },
  "conditions": [
    {
      "field": "priority",
      "operator": "equals",
      "value": "P1"
    }
  ],
  "primaryAction": "escalate_manager_chain",
  "status": "active"
}
```

### 19.8 Device Deployment

```json
{
  "type": "software",
  "target": {
    "source": "device_group",
    "resourceIds": [
      "group_head_office"
    ]
  },
  "packageId": "pkg_...",
  "profileId": "profile_standard",
  "schedule": {
    "startAt": "2026-09-26T18:00:00Z",
    "maintenanceWindowId": "mw_after_hours"
  },
  "retryPolicy": "standard",
  "restartBehavior": "notify"
}
```

### 19.9 Remote Consent Policy

```json
{
  "mode": "ask_except_trusted",
  "promptTimeoutSeconds": 60,
  "noResponseAction": "deny",
  "declineAction": "deny",
  "showOperatorIdentity": true,
  "requireAgainAfterReconnect": true,
  "auditEveryDecision": true
}
```

### 19.10 Alert Rule

```json
{
  "type": "offline_anomaly",
  "severity": "critical",
  "scope": {
    "type": "device_group",
    "resourceIds": []
  },
  "evaluationWindowMinutes": 10,
  "minimumAffectedDevices": 3,
  "enabled": true
}
```

### 19.11 Asset Ownership Change

```json
{
  "ownerUserId": "user_...",
  "organizationUnitId": "org_...",
  "effectiveAt": "2026-09-26T00:00:00Z",
  "reason": "assigned_to_employee"
}
```

### 19.12 Saved Report Definition

```json
{
  "name": "Hardware by Organization Unit",
  "dataset": "devices.hardware",
  "columns": [
    "brand",
    "model",
    "serialNumber",
    "organizationUnit"
  ],
  "filters": [],
  "groupBy": [
    "organizationUnit"
  ],
  "sort": []
}
```

### 19.13 Meeting Create

```json
{
  "title": "Daily Product Sync",
  "language": "th"
}
```

Recording and uploaded audio are separate processing commands against the Meeting resource.

## 20. Endpoint ownership summary

Current Step 11 machine-readable catalog contains:

- Platform: 12 operations
- Devices: 71 operations
- Assets: 24 operations
- Reports: 9 operations
- Helpdesk: 37 operations
- Meeting: 10 operations
- Admin: 23 operations
- Endpoint Agent: 5 operations

Total:

```text
191 operations
153 unique paths
```

This catalog covers every one of the 93 frozen Web routes plus the three runtime Agent/Mobile surfaces that need APIs.

Design System is intentionally not a runtime API consumer.

## 21. Module API rules

### Platform

Own:

- current profile,
- workspace summaries,
- app visibility,
- notifications,
- activity,
- global-search orchestration.

### Devices

Own all Device operational APIs and all translation to MeshCentral.

No public endpoint exposes MeshCentral Node DTOs as the INNO.One contract.

### Assets

Own inventory/ownership/QR/license/contract resources.

### Helpdesk

Own ticket lifecycle, SLA, taxonomy, requester grouping, notifications, knowledge and automation configuration.

### Meeting

Public API stays under `/api/v1/meeting` even if processing is deployed separately.

### Reports

Own saved definitions/runs/exports; module data stays authorization-filtered.

### Admin

Own Organization, Location, Position, User Profile, Role/Permission catalogs, App Registry administration and Access Scope evaluation.

## 22. Endpoint Agent contract

Endpoint Agent remains a separate client surface.

It uses:

- Agent/device context,
- Helpdesk ticket creation,
- ownership confirmation,
- remote-consent request/decision APIs.

The Agent must not call MeshCentral directly for product business operations that belong to INNO.One Devices.

Agent authentication/provisioning is a later security implementation decision; the HTTP resource boundary in this contract remains stable. Agent-only endpoints are marked with `authMode=agent-device` rather than borrowing normal user permissions such as `devices.view`. The generic operation poll endpoint is similarly marked `authMode=operation-owner` because access derives from the originating authorized command rather than a new standalone permission.

## 23. Android Assets Mobile contract

Mobile QR scanning uses:

```text
POST /api/v1/assets/qr/resolve
```

Permission:

```text
assets.qr.scan
```

The QR value is treated as an opaque/signed token.

Do not place mutable asset JSON or privileged business data directly into the QR code.

## 24. Report Builder contract

The frozen Report Builder maps to three concerns:

1. dataset/field metadata,
2. preview,
3. saved report definitions.

Endpoints:

```text
GET  /reports/datasets
POST /reports/preview
GET  /reports/saved/{reportId}
POST /reports/saved
PUT  /reports/saved/{reportId}
```

A preview is always permission/scope filtered using the caller's effective access.

## 25. Access Scope contract

Admin Access Scope screens map to:

```text
GET  /admin/access-assignments
GET  /admin/access-assignments/{assignmentId}
PUT  /admin/access-assignments/{assignmentId}

GET  /admin/access-scopes/effective-tree
POST /admin/access-scopes/evaluate
```

The Scope Browser TreeGrid result should include enough information to render:

- hierarchy,
- resource type,
- device/member count,
- inherited state,
- effective actions.

Evaluate Access returns an explainable authorization trace for authorized Admin users.

## 26. Search and notifications

### Global Search

Global Search orchestrates module providers but returns a common resource-reference shape.

```json
{
  "type": "device",
  "id": "dev_...",
  "title": "DESKTOP-HR-014",
  "subtitle": "HR / Bangkok",
  "route": "/devices/dev_..."
}
```

Results outside effective permission/scope are never returned.

### Notifications

Notifications contain an authorized destination reference, not a bypass token.

Opening the destination triggers normal authorization again.

## 27. API versioning

Breaking API contract changes require a new public API version or a migration-compatible transition.

Non-breaking additions include:

- optional response fields,
- new endpoints,
- new enum values only where clients are explicitly documented to tolerate unknown values.

Do not silently rename:

- permission IDs,
- event types,
- resource ID fields,
- error codes,
- existing public paths.

## 28. Deprecation

When an endpoint is replaced:

1. document the replacement,
2. mark the old endpoint deprecated in OpenAPI,
3. keep compatibility for the agreed migration window,
4. monitor use before removal,
5. remove only in a versioned change.

## 29. Security rules

- Authorize every resource server-side.
- Scope-filter list queries server-side.
- Validate ownership/resource relationships server-side.
- Do not trust client-calculated priority/permission/effective scope.
- Do not expose vendor credentials.
- Do not leak SMTP credentials, Keycloak client secrets or MeshCentral credentials through configuration GET endpoints.
- Sensitive settings return masked/configuration-safe representations.
- Audit privileged configuration/action changes according to Step 12.

## 30. Step 11 decisions frozen

1. Public API base is `/api/v1`.
2. Bearer JWT is the normal user authentication contract.
3. Permission + resource scope remains the authorization model.
4. Page-number pagination is the v1 frozen list convention.
5. `application/problem+json` is the error contract.
6. Mutable configuration uses ETag / If-Match.
7. Long-running/high-impact work uses asynchronous operation resources.
8. High-impact POST jobs use Idempotency-Key.
9. Cross-module references use stable IDs; modules do not read/write each other's persistence directly.
10. MeshCentral remains hidden behind Devices APIs.
11. Every frozen Web route has at least one mapped API operation.
12. Runtime Agent/Mobile surfaces have explicit API coverage.
13. API planning source is machine-readable and audited.
14. API mapping exposed six additional permission gaps; the implementation permission contract now reserves `admin.access`, `helpdesk.kb.view`, `helpdesk.ticket.reply`, `helpdesk.automation.view`, `helpdesk.automation.manage` and `meeting.files.manage`.

## 31. Deferred API decisions

Not frozen in Step 11:

- exact object-storage vendor,
- exact Agent credential provisioning,
- WebSocket/SignalR transport details,
- external event broker,
- exact rate-limit values,
- exact cache-control policy,
- exact attachment size limits,
- exact Meeting streaming protocol,
- public partner/external API surface,
- service-account/client-credential API,
- bulk-import API,
- explicit deny authorization model.

These should be chosen only when implementation requirements justify them.

## 32. Event & Audit Contract checkpoint

Step 12 is now defined by `INNO-One-Event-Audit-Contract.md` and `inno-event-audit-contract.json`.

The API contract therefore hands off these fields/behaviors directly into the event/audit layer:

- `X-Correlation-Id` → event/audit `correlationId`,
- async `operationId` or triggering `eventId` → `causationId`,
- observability `traceId` → event/audit `traceId`,
- successful privileged mutation → append-only audit record,
- cross-module committed fact → transactional outbox integration event,
- secrets/raw content → excluded from generic event/audit payloads.

Step 13 Data Ownership / Database Model is now complete. The next implementation step is **Step 14 Production Project Skeleton**.

## 33. Canonical endpoint catalog

Machine-readable source: `inno-api-contract.json` (191 operations / 153 unique paths after Step45U additive promotion).

### Platform

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/platform/me` | `platform.workspace.access` | `self` | `workspace-v2.html`, `profile.html` |
| `GET` | `/platform/workspace` | `platform.workspace.access` | `self` | `workspace-v2.html` |
| `GET` | `/platform/workspace/continue` | `platform.workspace.access` | `self` | `workspace-continue.html` |
| `GET` | `/platform/workspace/attention` | `platform.workspace.access` | `effective` | `workspace-attention.html` |
| `GET` | `/platform/activity` | `platform.workspace.access` | `self` | `workspace-recent.html` |
| `GET` | `/platform/apps` | `platform.apps.view` | `effective` | `app-launcher-v2.html`, `modules.html` |
| `GET` | `/platform/notifications` | `platform.notifications.view` | `self` | `notifications.html` |
| `PATCH` | `/platform/notifications/{notificationId}` | `platform.notifications.view` | `self` | `notifications.html` |
| `POST` | `/platform/notifications/mark-all-read` | `platform.notifications.view` | `self` | `notifications.html` |
| `PATCH` | `/platform/me/profile` | `platform.workspace.access` | `self` | `profile.html` |
| `GET` | `/search` | `platform.search.use` | `effective` | `workspace-v2.html`, `app-launcher-v2.html` |
| `GET` | `/operations/{operationId}` | auth:`operation-owner` | `self` | `deployment-job-detail.html`, `remote-operations.html`, `device-query.html`, `meeting-detail.html`, `reports-saved.html` |

### Devices

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/devices/overview` | `devices.view` | `effective` | `devices-overview-v2.html` |
| `GET` | `/devices` | `devices.view` | `effective` | `devices.html` |
| `GET` | `/devices/{deviceId}` | `devices.view` | `resource` | `device-detail-v2.html`, `device-group-detail.html` |
| `PATCH` | `/devices/{deviceId}` | `devices.manage` | `resource` | `device-detail-v2.html` |
| `POST` | `/devices/agent-installers` | `devices.deploy` | `effective` | `device-add.html` |
| `POST` | `/devices/discovery-scans` | `devices.manage` | `effective` | `device-discovery.html` |
| `GET` | `/devices/discovery-scans/{scanId}` | `devices.view` | `effective` | `device-discovery.html` |
| `GET` | `/devices/discovery-scans/{scanId}/results` | `devices.view` | `effective` | `device-discovery.html` |
| `GET` | `/devices/groups` | `devices.view` | `effective` | `device-groups.html` |
| `POST` | `/devices/groups` | `devices.manage` | `effective` | `device-groups.html` |
| `GET` | `/devices/groups/{groupId}` | `devices.view` | `resource` | `device-group-detail.html` |
| `PATCH` | `/devices/groups/{groupId}` | `devices.manage` | `resource` | `device-group-detail.html` |
| `GET` | `/devices/groups/{groupId}/members` | `devices.view` | `resource` | `device-group-detail.html` |
| `GET` | `/devices/remote-sessions` | `devices.remote` | `effective` | `remote-operations.html` |
| `POST` | `/devices/{deviceId}/remote-sessions` | `devices.remote` | `resource` | `remote-operations.html`, `device-detail-v2.html` |
| `GET` | `/devices/remote-sessions/{sessionId}` | `devices.remote` | `resource` | `remote-session.html` |
| `POST` | `/devices/remote-sessions/{sessionId}/disconnect` | `devices.remote` | `resource` | `remote-session.html` |
| `PATCH` | `/devices/remote-sessions/{sessionId}/mode` | `devices.remote` | `resource` | `remote-session.html` |
| `POST` | `/devices/remote-sessions/{sessionId}/files` | `devices.remote` | `resource` | `remote-session.html` |
| `GET` | `/devices/screenshot-jobs` | `devices.view` | `effective` | `remote-operations.html` |
| `POST` | `/devices/screenshot-jobs` | `devices.manage` | `effective` | `remote-operations.html` |
| `POST` | `/devices/wake-jobs` | `devices.manage` | `effective` | `remote-operations.html` |
| `GET` | `/devices/remote-consent/policy` | `devices.view` | `all` | `remote-consent.html`, `remote-consent-policy.html` |
| `PUT` | `/devices/remote-consent/policy` | `devices.remote.consent.manage` | `all` | `remote-consent-policy.html` |
| `GET` | `/devices/remote-consent/messages/{language}` | `devices.view` | `all` | `remote-consent-message.html` |
| `PUT` | `/devices/remote-consent/messages/{language}` | `devices.remote.consent.manage` | `all` | `remote-consent-message.html` |
| `GET` | `/devices/remote-consent/bypass-rules` | `devices.view` | `all` | `remote-consent-rules.html` |
| `POST` | `/devices/remote-consent/bypass-rules` | `devices.remote.consent.manage` | `all` | `remote-consent-rules.html` |
| `PATCH` | `/devices/remote-consent/bypass-rules/{ruleId}` | `devices.remote.consent.manage` | `all` | `remote-consent-rules.html` |
| `GET` | `/devices/remote-consent/history` | `devices.view` | `effective` | `remote-consent-history.html` |
| `GET` | `/devices/inventory-queries` | `devices.view` | `self` | `device-query.html` |
| `POST` | `/devices/inventory-queries` | `devices.manage` | `self` | `device-query.html` |
| `POST` | `/devices/inventory-queries/runs` | `devices.view` | `effective` | `device-query.html` |
| `GET` | `/devices/inventory-queries/runs/{runId}/results` | `devices.view` | `effective` | `device-query.html` |
| `GET` | `/devices/deployments` | `devices.view` | `effective` | `deployment-jobs.html` |
| `POST` | `/devices/deployments` | `devices.deploy` | `effective` | `deployment-new.html`, `deployment-jobs.html` |
| `GET` | `/devices/deployments/{deploymentId}` | `devices.view` | `resource` | `deployment-job-detail.html` |
| `GET` | `/devices/agent-rollouts` | `devices.view` | `effective` | `agent-maintenance.html`, `agent-updates.html` |
| `POST` | `/devices/agent-rollouts` | `devices.deploy` | `effective` | `agent-rollout-new.html` |
| `GET` | `/devices/software-maintenance-jobs` | `devices.view` | `effective` | `software-maintenance.html` |
| `POST` | `/devices/software-maintenance-jobs` | `devices.deploy` | `effective` | `software-maintenance-new.html` |
| `GET` | `/devices/restart-jobs` | `devices.view` | `effective` | `restart-operations.html` |
| `POST` | `/devices/restart-jobs` | `devices.manage` | `effective` | `restart-schedule.html` |
| `GET` | `/devices/maintenance-history` | `devices.view` | `effective` | `maintenance-history.html`, `agent-maintenance.html` |
| `GET` | `/devices/policies` | `devices.view` | `effective` | `endpoint-policies.html` |
| `GET` | `/devices/policies/{policyId}` | `devices.view` | `resource` | `endpoint-policies.html` |
| `PUT` | `/devices/policies/{policyId}` | `devices.policy.manage` | `resource` | `endpoint-policies.html` |
| `GET` | `/devices/policies/{policyId}/compliance` | `devices.view` | `resource` | `endpoint-policies.html` |
| `GET` | `/devices/alerts` | `devices.alert.view` | `effective` | `device-alerts.html` |
| `POST` | `/devices/alerts/{alertId}/acknowledge` | `devices.alert.manage` | `resource` | `device-alerts.html` |
| `POST` | `/devices/alerts/acknowledge-all` | `devices.alert.manage` | `effective` | `device-alerts.html` |
| `GET` | `/devices/alert-rules` | `devices.alert.view` | `effective` | `device-alert-rules.html` |
| `GET` | `/devices/alert-rules/{ruleId}` | `devices.alert.view` | `resource` | `device-alert-rule.html` |
| `POST` | `/devices/alert-rules` | `devices.alert.manage` | `effective` | `device-alert-rules.html`, `device-alert-rule.html` |
| `PUT` | `/devices/alert-rules/{ruleId}` | `devices.alert.manage` | `resource` | `device-alert-rule.html` |
| `GET` | `/devices/alert-channels` | `devices.alert.view` | `all` | `device-alert-channels.html` |
| `PUT` | `/devices/alert-channels` | `devices.alert.manage` | `all` | `device-alert-channels.html` |
| `POST` | `/devices/alert-channels/tests` | `devices.alert.manage` | `all` | `device-alert-channels.html` |
| `GET` | `/devices/alert-history` | `devices.alert.view` | `effective` | `device-alert-history.html` |

### Assets

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/assets/overview` | `assets.view` | `effective` | `assets-overview.html` |
| `GET` | `/assets` | `assets.view` | `effective` | `asset-inventory.html` |
| `GET` | `/assets/{assetId}` | `assets.view` | `resource` | `asset-detail.html`, `user-detail.html` |
| `PATCH` | `/assets/{assetId}` | `assets.manage` | `resource` | `asset-detail.html` |
| `GET` | `/assets/ownership` | `assets.view` | `effective` | `asset-ownership.html` |
| `POST` | `/assets/{assetId}/ownership` | `assets.manage` | `resource` | `asset-ownership.html` |
| `GET` | `/assets/owners` | `assets.view` | `effective` | `asset-users.html` |
| `GET` | `/assets/owners/{userId}` | `assets.view` | `resource` | `asset-user-detail.html` |
| `GET` | `/assets/ownership-submissions` | `assets.view` | `effective` | `asset-ownership-submissions.html` |
| `POST` | `/assets/ownership-submissions/{submissionId}/decision` | `assets.manage` | `resource` | `asset-ownership-submissions.html` |
| `GET` | `/assets/custom-fields` | `assets.view` | `all` | `asset-custom-fields.html` |
| `PUT` | `/assets/custom-fields` | `assets.manage` | `all` | `asset-custom-fields.html` |
| `POST` | `/assets/{assetId}/qr-label` | `assets.qr.print` | `resource` | `asset-qr.html` |
| `POST` | `/assets/qr/resolve` | `assets.qr.scan` | `effective` | `asset-mobile.html` |
| `GET` | `/assets/software-licenses` | `assets.license.manage` | `effective` | `software-licenses.html` |
| `PATCH` | `/assets/software-licenses/{licenseId}` | `assets.license.manage` | `resource` | `software-licenses.html` |
| `GET` | `/assets/contracts` | `assets.view` | `effective` | `contracts-warranty.html` |
| `PATCH` | `/assets/contracts/{contractId}` | `assets.contract.manage` | `resource` | `contracts-warranty.html` |

### Reports

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/reports/overview` | `reports.view` | `effective` | `reports-overview.html` |
| `GET` | `/reports/datasets` | `reports.view` | `effective` | `report-builder.html` |
| `POST` | `/reports/preview` | `reports.view` | `effective` | `report-builder.html` |
| `GET` | `/reports/saved` | `reports.view` | `self` | `reports-saved.html` |
| `GET` | `/reports/saved/{reportId}` | `reports.view` | `resource` | `reports-saved.html`, `report-builder.html` |
| `POST` | `/reports/saved` | `reports.create` | `self` | `report-builder.html` |
| `PUT` | `/reports/saved/{reportId}` | `reports.manage` | `resource` | `report-builder.html` |
| `POST` | `/reports/saved/{reportId}/runs` | `reports.view` | `resource` | `reports-saved.html` |
| `POST` | `/reports/exports` | `reports.view` | `effective` | `reports-overview.html`, `report-builder.html` |

### Helpdesk

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/helpdesk/overview` | `helpdesk.ticket.view` | `effective` | `helpdesk.html` |
| `GET` | `/helpdesk/tickets` | `helpdesk.ticket.view` | `effective` | `helpdesk-tickets.html`, `helpdesk-assigned.html`, `helpdesk-team.html` |
| `GET` | `/helpdesk/tickets/{ticketId}` | `helpdesk.ticket.view` | `resource` | `ticket-detail.html`, `helpdesk-notification-delivery.html` |
| `POST` | `/helpdesk/tickets` | `helpdesk.ticket.create` | `effective` | `ticket-new.html`, `helpdesk-agent-request.html` |
| `POST` | `/helpdesk/tickets/{ticketId}/replies` | `helpdesk.ticket.reply` | `resource` | `ticket-detail.html` |
| `POST` | `/helpdesk/tickets/{ticketId}/assignment` | `helpdesk.ticket.assign` | `resource` | `ticket-detail.html` |
| `POST` | `/helpdesk/tickets/{ticketId}/resolve` | `helpdesk.ticket.resolve` | `resource` | `ticket-detail.html` |
| `GET` | `/helpdesk/sla-policies` | `helpdesk.ticket.view` | `all` | `helpdesk-sla.html` |
| `PUT` | `/helpdesk/sla-policies/{policyId}` | `helpdesk.sla.manage` | `all` | `helpdesk-sla.html` |
| `GET` | `/helpdesk/sla-monitor` | `helpdesk.ticket.view` | `effective` | `helpdesk-sla.html`, `helpdesk-team.html` |
| `GET` | `/helpdesk/categories/tree` | `helpdesk.ticket.view` | `all` | `helpdesk-settings.html`, `helpdesk-categories.html`, `ticket-new.html` |
| `PUT` | `/helpdesk/categories/{categoryId}` | `helpdesk.catalog.manage` | `all` | `helpdesk-categories.html` |
| `GET` | `/helpdesk/statuses` | `helpdesk.ticket.view` | `all` | `helpdesk-statuses.html` |
| `PUT` | `/helpdesk/statuses` | `helpdesk.status.manage` | `all` | `helpdesk-statuses.html` |
| `GET` | `/helpdesk/requester-groups` | `helpdesk.ticket.view` | `all` | `helpdesk-requester-groups.html` |
| `PUT` | `/helpdesk/requester-groups/{groupId}` | `helpdesk.requester_group.manage` | `all` | `helpdesk-requester-groups.html` |
| `GET` | `/helpdesk/business-calendar` | `helpdesk.ticket.view` | `all` | `helpdesk-calendar.html` |
| `PUT` | `/helpdesk/business-calendar` | `helpdesk.sla.manage` | `all` | `helpdesk-calendar.html` |
| `GET` | `/helpdesk/notification-rules` | `helpdesk.notifications.view` | `all` | `helpdesk-notifications.html` |
| `GET` | `/helpdesk/notification-rules/{ruleId}` | `helpdesk.notifications.view` | `resource` | `helpdesk-notification-rule.html` |
| `PUT` | `/helpdesk/notification-rules/{ruleId}` | `helpdesk.notifications.manage` | `resource` | `helpdesk-notification-rule.html` |
| `GET` | `/helpdesk/notification-templates` | `helpdesk.notifications.view` | `all` | `helpdesk-notification-templates.html` |
| `GET` | `/helpdesk/notification-templates/{templateId}` | `helpdesk.notifications.view` | `resource` | `helpdesk-notification-template.html` |
| `PUT` | `/helpdesk/notification-templates/{templateId}` | `helpdesk.notifications.manage` | `resource` | `helpdesk-notification-template.html` |
| `GET` | `/helpdesk/notification-deliveries` | `helpdesk.notifications.view` | `effective` | `helpdesk-notification-delivery.html` |
| `GET` | `/helpdesk/notification-settings` | `helpdesk.notifications.view` | `all` | `helpdesk-notification-settings.html` |
| `PUT` | `/helpdesk/notification-settings` | `helpdesk.notifications.manage` | `all` | `helpdesk-notification-settings.html` |
| `POST` | `/helpdesk/notification-tests` | `helpdesk.notifications.manage` | `all` | `helpdesk-notification-settings.html` |
| `GET` | `/helpdesk/knowledge` | `helpdesk.kb.view` | `effective` | `knowledge-base.html` |
| `GET` | `/helpdesk/reports` | `helpdesk.reports.view` | `effective` | `helpdesk-reports.html` |
| `GET` | `/helpdesk/automation-rules` | `helpdesk.automation.view` | `all` | `helpdesk-automation.html` |
| `GET` | `/helpdesk/automation-rules/{ruleId}` | `helpdesk.automation.view` | `resource` | `helpdesk-automation-rule.html` |
| `PUT` | `/helpdesk/automation-rules/{ruleId}` | `helpdesk.automation.manage` | `resource` | `helpdesk-automation-rule.html` |
| `POST` | `/helpdesk/attachments` | `helpdesk.ticket.create` | `self` | `ticket-new.html`, `ticket-detail.html` |
| `POST` | `/helpdesk/notification-rules` | `helpdesk.notifications.manage` | `all` | `helpdesk-notifications.html`, `helpdesk-notification-rule.html` |
| `POST` | `/helpdesk/notification-templates` | `helpdesk.notifications.manage` | `all` | `helpdesk-notification-templates.html`, `helpdesk-notification-template.html` |
| `POST` | `/helpdesk/automation-rules` | `helpdesk.automation.manage` | `all` | `helpdesk-automation.html`, `helpdesk-automation-rule.html` |

### Meeting

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/meeting/overview` | `meeting.view` | `effective` | `meeting.html` |
| `GET` | `/meeting/meetings` | `meeting.view` | `effective` | `meeting-list.html` |
| `GET` | `/meeting/upcoming` | `meeting.view` | `self` | `meeting-upcoming.html` |
| `GET` | `/meeting/meetings/{meetingId}` | `meeting.view` | `resource` | `meeting-detail.html` |
| `POST` | `/meeting/meetings` | `meeting.create` | `self` | `meeting-new.html` |
| `POST` | `/meeting/meetings/{meetingId}/recordings` | `meeting.record` | `resource` | `meeting-new.html` |
| `POST` | `/meeting/meetings/{meetingId}/audio` | `meeting.create` | `resource` | `meeting-new.html` |
| `POST` | `/meeting/meetings/{meetingId}/shares` | `meeting.share` | `resource` | `meeting-detail.html` |
| `POST` | `/meeting/meetings/{meetingId}/exports` | `meeting.view` | `resource` | `meeting-detail.html` |
| `POST` | `/meeting/meetings/{meetingId}/files` | `meeting.files.manage` | `resource` | `meeting-detail.html` |

### Admin

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/admin/overview` | `admin.access` | `all` | `admin.html` |
| `GET` | `/admin/organization/tree` | `admin.organization.view` | `all` | `organization.html`, `access-scope-browser.html` |
| `POST` | `/admin/organization/units` | `admin.organization.manage` | `all` | `organization.html` |
| `PUT` | `/admin/organization/units/{unitId}` | `admin.organization.manage` | `resource` | `organization.html` |
| `GET` | `/admin/locations/tree` | `admin.locations.view` | `all` | `organization-locations.html` |
| `POST` | `/admin/locations` | `admin.locations.manage` | `all` | `organization-locations.html` |
| `PUT` | `/admin/locations/{locationId}` | `admin.locations.manage` | `resource` | `organization-locations.html` |
| `GET` | `/admin/positions` | `admin.positions.view` | `all` | `organization-positions.html`, `user-edit.html` |
| `POST` | `/admin/positions` | `admin.positions.manage` | `all` | `organization-positions.html` |
| `PUT` | `/admin/positions/{positionId}` | `admin.positions.manage` | `resource` | `organization-positions.html` |
| `GET` | `/admin/users` | `admin.users.view` | `effective` | `users.html` |
| `GET` | `/admin/users/{userId}` | `admin.users.view` | `resource` | `user-detail.html` |
| `POST` | `/admin/users` | `admin.users.manage` | `all` | `user-edit.html` |
| `PUT` | `/admin/users/{userId}` | `admin.users.manage` | `resource` | `user-edit.html` |
| `GET` | `/admin/apps` | `admin.apps.view` | `all` | `modules.html` |
| `PATCH` | `/admin/apps/{appId}` | `admin.apps.manage` | `all` | `modules.html` |
| `GET` | `/admin/roles` | `admin.roles.view` | `all` | `roles-permissions-v2.html`, `access-scope-edit.html` |
| `GET` | `/admin/permissions` | `admin.roles.view` | `all` | `roles-permissions-v2.html` |
| `GET` | `/admin/access-assignments` | `admin.access_scopes.view` | `all` | `access-scopes.html` |
| `GET` | `/admin/access-assignments/{assignmentId}` | `admin.access_scopes.view` | `resource` | `access-scope-edit.html` |
| `PUT` | `/admin/access-assignments/{assignmentId}` | `admin.access_scopes.manage` | `resource` | `access-scope-edit.html` |
| `GET` | `/admin/access-scopes/effective-tree` | `admin.access_scopes.view` | `effective` | `access-scope-browser.html` |
| `POST` | `/admin/access-scopes/evaluate` | `admin.access_scopes.evaluate` | `all` | `access-scope-evaluate.html` |

### Agent

| Method | Path | Permission / Auth | Scope | Source UI |
| --- | --- | --- | --- | --- |
| `GET` | `/agent/context` | auth:`agent-device` | `self` | `helpdesk-agent-request.html`, `agent-ownership-confirmation.html` |
| `POST` | `/agent/ownership-confirmations` | auth:`agent-device` | `self` | `agent-ownership-confirmation.html` |
| `GET` | `/agent/remote-consent/requests/current` | auth:`agent-device` | `self` | `helpdesk-agent-request.html` |
| `POST` | `/agent/remote-consent/requests/{requestId}/decision` | auth:`agent-device` | `self` | `helpdesk-agent-request.html` |


## Step 15 implementation checkpoint — 2026-09-26

API Contract **0.2.0** remains semantically unchanged. Step 15 now implements three already-declared operations in the production skeleton:

- `platform.me.get` → `GET /api/v1/platform/me`
- `devices.list` → `GET /api/v1/devices`
- `devices.get` → `GET /api/v1/devices/{deviceId}`

Runtime verification confirms:
- unauthenticated requests are rejected before business data access,
- `devices.view` is resolved server-side,
- effective Organization/Location/Device Group scope filters the Device query before `totalItems` is counted,
- an out-of-scope Device detail returns 403,
- a missing Device returns 404,
- opaque `dev_...` identifiers are public while MeshCentral external IDs remain private,
- search, Status filter, OS filter and pagination are functional.

The remaining API catalog is still planning-only until later vertical slices implement those operations.


## Step 26 additive API contract

Software baseline definitions add GET/POST /assets/software-baselines and GET/PATCH /assets/software-baselines/{baselineId}.
Reading requires assets.view; writing requires assets.baseline.manage. Updates require If-Match and return 412 on stale or missing ETag. The list is global configuration, not an Asset compliance count. Each response reports evaluationStatus=awaiting_inventory until a trustworthy Devices software-inventory contract exists.


## Step 27 additive boundary — Devices installed software

`GET /devices/{deviceId}/software-inventory` returns the latest Devices-owned observation. `PUT` records a newer immutable snapshot with completeness and provenance. Read uses `devices.view`; ingest uses `devices.manage`; both enforce effective Device scope. Partial observations never prove absence. Assets consumes `IDeviceSoftwareInventoryReader`; package rows are not exposed through direct database access.


## Step 28 additive boundary — software baseline evaluation

`GET /assets/software-baselines/{baselineId}/results` returns the latest scoped result projection. `POST /assets/software-baselines/{baselineId}/evaluate` evaluates an active definition using the Devices software-inventory reader. Read uses `assets.view`; evaluation uses `assets.baseline.manage`. Missing, stale or partial evidence returns Unknown.


## Step45R additive boundary — Device hardware inventory

`GET /devices/{deviceId}/hardware-inventory` returns the latest Devices-owned normalized hardware observation for the requested device. Read requires `devices.view` and enforces effective Device resource scope.

The response carries observation evidence, not a live vendor DTO:

- `inventoryStatus = not_reported | complete | partial`
- `snapshotId`
- `observedAt`
- `receivedAt`
- `source` and optional `sourceInstance`
- `isStale`
- normalized manufacturer/model/serial/processor/BIOS/OS/memory/network identity fields.

Step45R defines hardware evidence older than 24 hours as stale. Cached evidence remains readable while the device is offline. Secret material such as a full OS product key or credentials is not part of this response.

The persisted source is `devices.device_inventory_snapshots`, already reserved by Data Model Contract 0.6.0. Step45R activates that planned table in the Devices EF model and backfills one partial observation from the existing canonical Device row during migration so upgrades do not silently lose previously known inventory.

The planned `POST /devices/{deviceId}/inventory-refreshes` command remains intentionally unavailable in Step45R because the Endpoint Agent inventory command channel is not implemented yet. The Web UI therefore does not expose a fake Refresh action. The command is promoted only when a real endpoint execution path exists.


## Step45S additive boundary — Device performance and network telemetry

Step45S activates the Performance and Network Device Detail contracts frozen by Step45Q and adds one Endpoint Agent ingestion boundary.

### Device performance

`GET /devices/{deviceId}/performance?window=<window>&interval=<seconds>`

- Permission: `devices.view`
- Scope: Device resource scope
- Supported windows: `5m`, `15m`, `1h`
- Supported intervals: `5`, `15`, `30`, `60` seconds
- Default Product view: 5 minutes / 5 seconds

The response contains a bounded series of CPU, memory and disk samples plus latest-sample metadata.

A sample is **Live** only when all are true:

1. the Device is currently online,
2. the latest sample source is `endpoint_agent`,
3. the latest observation is no older than 60 seconds.

Historical/backfilled values may remain visible but are never promoted to Live.

### Device network inventory

`GET /devices/{deviceId}/network-inventory`

- Permission: `devices.view`
- Scope: Device resource scope
- Freshness threshold: 15 minutes

The response is a normalized network observation containing only facts the Endpoint Agent actually reports, including IP/MAC identity, subnet, gateway, DNS and adapter identity. Optional latency/packet-loss fields remain null when the Agent did not measure them; Product UI must not infer a Healthy state from missing evidence.

Network observation time/provenance is independent from general Hardware observation time so a network refresh cannot make old Hardware evidence appear fresh.

### Endpoint Agent telemetry ingestion

`POST /agent/devices/{deviceId}/telemetry`

- Auth boundary: Agent/self surface
- Current implementation authenticates the signed-in Endpoint Agent user and additionally requires the requested Device to be owned by that user.
- Observations more than five minutes in the future or more than one hour old are rejected.
- CPU, memory, disk, latency and packet-loss ranges are validated before persistence.
- Performance samples are written with source `endpoint_agent`.
- Network observations are projected into the Devices-owned inventory snapshot with their own timestamps and provenance.

The Endpoint Agent publishes Performance every 5 seconds while it is running, authenticated, associated with an online managed Device and executing inside the native Tauri runtime. Network configuration is collected every 12 Performance ticks (approximately 60 seconds).

Performance persistence is operational and bounded. The runtime opportunistically deletes samples older than one hour for the observed Device.

MeshCentral is not used as a performance telemetry source because the current adapter does not provide these metrics.


## Step45T additive boundary — Live Processes and Services

Step45T keeps INNO.One as the Product/API/Data/Permission/Audit owner while using MeshCentral 1.2.6 + MeshAgent as the endpoint execution engine for live process and service operations.

Public operations:

- `POST /devices/{deviceId}/processes/snapshots` — `devices.view`; creates a 60-second ephemeral live snapshot operation.
- `GET /devices/{deviceId}/processes/snapshots/{snapshotId}` — `devices.view`; reads the normalized INNO.One snapshot.
- `POST /devices/{deviceId}/processes/{processKey}/terminate` — `devices.manage`; warning-confirmed interruptive action.
- `POST /devices/{deviceId}/services/snapshots` — `devices.view`; creates a 60-second ephemeral live snapshot operation.
- `GET /devices/{deviceId}/services/snapshots/{snapshotId}` — `devices.view`; reads the normalized INNO.One snapshot.
- `POST /devices/{deviceId}/services/{serviceName}/actions` — `devices.manage`; body action is `start | stop | restart`.

The public contract never exposes MeshCentral node IDs or vendor DTOs. Device-to-MeshCentral mapping remains internal to the Devices adapter.

### Execution semantics

The MeshCentral adapter uses native MeshAgent message types:

- `ps`
- `pskill`
- `services`
- `serviceStart`
- `serviceStop`
- `serviceRestart`

A MeshCentral route acknowledgement is **not** treated as endpoint execution success. Process termination is verified by fetching a new live process list until the PID disappears. Service actions are verified by fetching live service state until the expected state appears. If verification does not succeed, INNO.One marks the operation failed rather than reporting false success.

### State and persistence

Process/service snapshots are volatile live state. They are held in the Platform API process for at most 60 seconds and are not persisted to a permanent Devices process/service history table.

Offline Devices return `RESOURCE_OFFLINE`. Missing MeshCentral mappings return a conflict state. An unavailable remote engine returns dependency-unavailable behavior.

Process termination and service actions write restricted `security_long` audit records using the canonical actions:

- `devices.process.terminate`
- `devices.service.action`

The audit stores canonical Device/action/result evidence, not MeshCentral credentials or raw vendor payloads.


## Step45U additive boundary — Device Activity + related Helpdesk Tickets

Step45U completes the frozen nine-tab Device Detail contract without creating a second ticket owner or a duplicate Device activity history store.

### Device Activity

`GET /devices/{deviceId}/activity?page=<page>&pageSize=<pageSize>`

- Permission: `devices.view`
- Scope: Device resource scope
- Response: paged Device activity projection
- Authoritative source: `audit.audit_records`
- Filter: `module = devices`, `target_type = device`, canonical opaque Device target ID

The projection resolves user actor IDs through the Platform Directory before returning Product data. Audit metadata remains structured and can be rendered by the Web without exposing MeshCentral/vendor identifiers.

Step45U intentionally does **not** create `devices.device_activity_items`. The Step45Q planned read-model table is deferred because the canonical audit ledger already satisfies the current Product query without duplication. A materialized read model may be introduced later only if measured scale/latency requires it.

### Related Helpdesk Tickets

Existing operation:

`GET /helpdesk/tickets`

adds the optional query:

`relatedDeviceId=<canonical Device ID>`

The filter:

- remains Helpdesk-owned,
- preserves existing Helpdesk effective-scope enforcement,
- validates the canonical `dev_...` identifier,
- does not perform a direct Devices-to-Helpdesk table read,
- does not grant ticket access based on `devices.view`.

Device Detail evaluates `helpdesk.ticket.view` independently. A user may view the Device while the Tickets tab renders Permission Denied.

Create Ticket deep links may provide:

`/helpdesk/tickets/new?relatedDeviceId=<deviceId>`

The Helpdesk create surface consumes the canonical Device ID as the initial related-device selection.
