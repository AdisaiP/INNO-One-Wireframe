# INNO.One — API Contract

**Status:** Planning contract  
**Version prefix:** `/api/v1`  
**Date:** 2026-09-25  
**Backend implementation:** Not started

## 1. API principles

- Product APIs use INNO.One resource IDs, never provider IDs.
- Route shape follows the owning domain, not the HTML filename.
- Reads and commands are explicit.
- Cross-module data is resolved through contracts, not database joins from controllers.
- Long-running work returns a job/resource immediately.
- Errors use Problem Details.
- List APIs have consistent pagination/filter metadata.
- Commands that may be retried accept an idempotency key.
- Editable resources support optimistic concurrency.
- Timestamps are UTC ISO-8601; UI localizes them.
- JSON property names use camelCase.

## 2. Common headers

Request:
- `Authorization: Bearer <token>` for service/API clients where applicable,
- browser/BFF may authenticate through secure session cookie,
- `X-Correlation-Id` optional; server creates if absent,
- `Idempotency-Key` required for selected create/execute commands,
- `If-Match` for concurrency-sensitive PATCH/PUT where applicable.

Response:
- `X-Correlation-Id`,
- `ETag` on editable resources where applicable.

## 3. Common identifiers

Use opaque UUID identifiers for APIs.

Examples:
- `deviceId`
- `ticketId`
- `assetId`
- `meetingId`

Human-facing numbers are separate:
- Ticket `HD-001048`,
- Asset `AST-PC-000142`.

Do not accept MeshCentral node ID in public product routes.

## 4. List response

Default list shape:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 25,
  "total": 128,
  "sort": "updatedAt:desc",
  "filters": {}
}
```

Use cursor pagination later only when a dataset requires it.

Common query parameters:
- `q`
- `page`
- `pageSize`
- `sort`
- module-specific filters.

Server validates sortable/filterable fields.

## 5. Error contract

Use RFC Problem Details:

```json
{
  "type": "https://inno.one/problems/validation",
  "title": "Validation failed",
  "status": 400,
  "code": "validation_failed",
  "detail": "One or more fields are invalid.",
  "correlationId": "...",
  "errors": {
    "subject": ["Subject is required."]
  }
}
```

Standard codes:
- `validation_failed`
- `unauthenticated`
- `permission_denied`
- `scope_denied`
- `not_found`
- `conflict`
- `concurrency_conflict`
- `provider_unavailable`
- `provider_timeout`
- `job_failed`
- `module_disabled`

Never return provider stack traces or MeshCentral/Keycloak raw errors to normal clients.

## 6. Current-user / Platform Core

### Session/bootstrap

- `GET /api/v1/me`
  - profile,
  - organization,
  - roles,
  - effective top-level permissions,
  - enabled/visible modules,
  - preferences.

- `PATCH /api/v1/me/preferences`
  - locale,
  - timezone,
  - notification preferences,
  - table density.

- `GET /api/v1/me/recent`
- `GET /api/v1/me/attention`
- `GET /api/v1/me/continue-working`

### Notifications

- `GET /api/v1/notifications`
- `POST /api/v1/notifications/{notificationId}/read`
- `POST /api/v1/notifications/read-all`

### Modules

- `GET /api/v1/modules`
- `GET /api/v1/modules/{moduleId}`
- `POST /api/v1/modules/{moduleId}/enable`
- `POST /api/v1/modules/{moduleId}/disable`
- `PATCH /api/v1/me/modules/{moduleId}` — pin/order preference.

Install/upgrade APIs are deferred until package lifecycle is defined.

### Roles / permissions

- `GET /api/v1/roles`
- `GET /api/v1/permissions`
- `GET /api/v1/roles/{roleId}`
- `PUT /api/v1/roles/{roleId}/permissions`
- `POST /api/v1/role-assignments`
- `DELETE /api/v1/role-assignments/{assignmentId}`

### Access scopes

- `GET /api/v1/access-scopes`
- `GET /api/v1/access-scopes/{scopeId}`
- `POST /api/v1/access-scopes`
- `PATCH /api/v1/access-scopes/{scopeId}`
- `GET /api/v1/access-scopes/{scopeId}/resources`
- `POST /api/v1/access/evaluate`

Evaluate request:

```json
{
  "principalId": "...",
  "permission": "devices.remote",
  "resourceType": "device",
  "resourceId": "..."
}
```

## 7. Devices APIs

### Devices

- `GET /api/v1/devices/overview`
- `GET /api/v1/devices`
- `POST /api/v1/devices` — register/add when manual registration is supported.
- `GET /api/v1/devices/{deviceId}`
- `PATCH /api/v1/devices/{deviceId}`
- `GET /api/v1/devices/{deviceId}/activity`
- `GET /api/v1/devices/{deviceId}/inventory`

Filters:
- status,
- groupId,
- organizationUnitId,
- locationId,
- operatingSystem,
- agentVersion.

### Discovery

- `POST /api/v1/device-discovery/runs`
- `GET /api/v1/device-discovery/runs/{runId}`
- `POST /api/v1/device-discovery/runs/{runId}/import`

Discovery is modeled as a run/job, not a synchronous giant scan response.

### Groups

- `GET /api/v1/device-groups`
- `POST /api/v1/device-groups`
- `GET /api/v1/device-groups/{groupId}`
- `PATCH /api/v1/device-groups/{groupId}`
- `GET /api/v1/device-groups/{groupId}/members`
- `POST /api/v1/device-groups/{groupId}/members`
- `DELETE /api/v1/device-groups/{groupId}/members/{deviceId}`

### Inventory queries

- `GET /api/v1/device-queries`
- `POST /api/v1/device-queries`
- `GET /api/v1/device-queries/{queryId}`
- `PATCH /api/v1/device-queries/{queryId}`
- `POST /api/v1/device-queries/preview`
- `POST /api/v1/device-queries/{queryId}/execute`

### Remote sessions

- `GET /api/v1/remote-sessions`
- `POST /api/v1/devices/{deviceId}/remote-sessions`
- `GET /api/v1/remote-sessions/{sessionId}`
- `POST /api/v1/remote-sessions/{sessionId}/end`
- `POST /api/v1/remote-sessions/{sessionId}/collaborators`
- `POST /api/v1/remote-sessions/{sessionId}/file-transfers`

Remote-control transport negotiation may return a provider-neutral connection descriptor.

### Remote consent

- `GET /api/v1/remote-consent/policy`
- `PUT /api/v1/remote-consent/policy`
- `GET /api/v1/remote-consent/message`
- `PUT /api/v1/remote-consent/message`
- `GET /api/v1/remote-consent/rules`
- `POST /api/v1/remote-consent/rules`
- `PATCH /api/v1/remote-consent/rules/{ruleId}`
- `DELETE /api/v1/remote-consent/rules/{ruleId}`
- `GET /api/v1/remote-consent/history`
### Alerts

- `GET /api/v1/device-alerts`
- `GET /api/v1/device-alerts/{alertId}`
- `POST /api/v1/device-alerts/{alertId}/acknowledge`
- `GET /api/v1/device-alert-rules`
- `POST /api/v1/device-alert-rules`
- `GET /api/v1/device-alert-rules/{ruleId}`
- `PATCH /api/v1/device-alert-rules/{ruleId}`
- `GET /api/v1/device-alert-channels`
- `PUT /api/v1/device-alert-channels`
- `POST /api/v1/device-alert-channels/test`
- `GET /api/v1/device-alert-history`

### Deployment

- `GET /api/v1/deployment-jobs`
- `POST /api/v1/deployment-jobs`
- `GET /api/v1/deployment-jobs/{jobId}`
- `POST /api/v1/deployment-jobs/{jobId}/cancel`
- `POST /api/v1/deployment-jobs/{jobId}/retry-failed`
- `GET /api/v1/software-packages`

Create returns `202 Accepted` with job representation when execution is asynchronous.

### Agent maintenance

- `GET /api/v1/agent-maintenance/overview`
- `GET /api/v1/agent-releases`
- `GET /api/v1/agent-rollouts`
- `POST /api/v1/agent-rollouts`
- `GET /api/v1/agent-rollouts/{rolloutId}`

### Software maintenance

- `GET /api/v1/software-maintenance-jobs`
- `POST /api/v1/software-maintenance-jobs`
- `GET /api/v1/software-maintenance-jobs/{jobId}`

### Restart operations

- `GET /api/v1/restart-jobs`
- `POST /api/v1/restart-jobs`
- `GET /api/v1/restart-jobs/{jobId}`
- `POST /api/v1/restart-jobs/{jobId}/cancel`

### Maintenance history

- `GET /api/v1/maintenance-history`

This is a Devices read model combining completed deployment/agent/software/restart work.

### Endpoint policies

- `GET /api/v1/endpoint-policies`
- `GET /api/v1/endpoint-policies/{policyId}`
- `POST /api/v1/endpoint-policies`
- `PATCH /api/v1/endpoint-policies/{policyId}`
- `PUT /api/v1/endpoint-policies/{policyId}/assignments`
- `GET /api/v1/endpoint-policies/{policyId}/effective-devices`

## 8. Assets APIs

### Overview / register

- `GET /api/v1/assets/overview`
- `GET /api/v1/assets`
- `POST /api/v1/assets`
- `GET /api/v1/assets/{assetId}`
- `PATCH /api/v1/assets/{assetId}`
- `GET /api/v1/assets/{assetId}/activity`

Filters:
- type,
- status,
- ownerUserId,
- locationId,
- linkedDeviceId,
- warranty state.

### Ownership

- `GET /api/v1/asset-assignments`
- `POST /api/v1/assets/{assetId}/assign`
- `POST /api/v1/assets/{assetId}/return`
- `GET /api/v1/asset-users`
- `GET /api/v1/asset-users/{userId}`
- `GET /api/v1/asset-ownership-submissions`
- `POST /api/v1/asset-ownership-submissions/{submissionId}/approve`
- `POST /api/v1/asset-ownership-submissions/{submissionId}/reject`

### Custom fields

- `GET /api/v1/asset-custom-fields`
- `POST /api/v1/asset-custom-fields`
- `PATCH /api/v1/asset-custom-fields/{fieldId}`

### QR

Web:
- `POST /api/v1/assets/qr-tokens`
- `POST /api/v1/assets/qr-label-jobs`
- `POST /api/v1/assets/{assetId}/qr-token/revoke`

Mobile:
- `POST /api/v1/mobile/assets/qr/lookup`

Lookup request contains only scanned opaque token.

### Licenses

- `GET /api/v1/software-licenses`
- `POST /api/v1/software-licenses`
- `GET /api/v1/software-licenses/{licenseId}`
- `PATCH /api/v1/software-licenses/{licenseId}`

### Contracts / warranty

- `GET /api/v1/asset-contracts`
- `POST /api/v1/asset-contracts`
- `GET /api/v1/asset-contracts/{contractId}`
- `PATCH /api/v1/asset-contracts/{contractId}`

## 9. Helpdesk APIs

### Overview / queues

- `GET /api/v1/helpdesk/overview`
- `GET /api/v1/tickets`
- `GET /api/v1/tickets?assignedTo=me`
- `GET /api/v1/helpdesk/team-queue`

### Ticket

- `POST /api/v1/tickets`
- `GET /api/v1/tickets/{ticketId}`
- `PATCH /api/v1/tickets/{ticketId}`
- `POST /api/v1/tickets/{ticketId}/messages`
- `POST /api/v1/tickets/{ticketId}/attachments`
- `POST /api/v1/tickets/{ticketId}/assign`
- `POST /api/v1/tickets/{ticketId}/status-transitions`
- `POST /api/v1/tickets/{ticketId}/resolve`
- `POST /api/v1/tickets/{ticketId}/reopen`
- `GET /api/v1/tickets/{ticketId}/activity`

Assignment body:

```json
{
  "assigneeUserId": "...",
  "teamId": "...",
  "reason": "optional"
}
```

Status transition uses semantic transition key, not arbitrary display text.

### SLA

- `GET /api/v1/sla-policies`
- `GET /api/v1/sla-policies/{policyId}`
- `POST /api/v1/sla-policies`
- `PATCH /api/v1/sla-policies/{policyId}`
- `GET /api/v1/tickets/{ticketId}/sla`

### Categories

- `GET /api/v1/ticket-categories`
- `POST /api/v1/ticket-categories`
- `PATCH /api/v1/ticket-categories/{categoryId}`

### Status definitions

- `GET /api/v1/ticket-statuses`
- `PATCH /api/v1/ticket-statuses/{statusId}`

### Requester groups

- `GET /api/v1/requester-groups`
- `POST /api/v1/requester-groups`
- `PATCH /api/v1/requester-groups/{groupId}`
- `POST /api/v1/requester-groups/preview`

### Business calendar

- `GET /api/v1/business-calendars`
- `GET /api/v1/business-calendars/{calendarId}`
- `PATCH /api/v1/business-calendars/{calendarId}`

### Notification rules

- `GET /api/v1/helpdesk/notification-rules`
- `POST /api/v1/helpdesk/notification-rules`
- `GET /api/v1/helpdesk/notification-rules/{ruleId}`
- `PATCH /api/v1/helpdesk/notification-rules/{ruleId}`

### Templates

- `GET /api/v1/helpdesk/notification-templates`
- `POST /api/v1/helpdesk/notification-templates`
- `GET /api/v1/helpdesk/notification-templates/{templateId}`
- `PATCH /api/v1/helpdesk/notification-templates/{templateId}`

### Delivery history/settings

- `GET /api/v1/helpdesk/notification-deliveries`
- `POST /api/v1/helpdesk/notification-deliveries/{deliveryId}/retry`
- `GET /api/v1/helpdesk/notification-settings`
- `PUT /api/v1/helpdesk/notification-settings`
- `POST /api/v1/helpdesk/notification-settings/test-email`

Secrets are accepted only through privileged configuration endpoints and never echoed back.

### Knowledge base

- `GET /api/v1/knowledge-articles`
- `POST /api/v1/knowledge-articles`
- `GET /api/v1/knowledge-articles/{articleId}`
- `PATCH /api/v1/knowledge-articles/{articleId}`

### Helpdesk reporting

- `GET /api/v1/helpdesk/reports/summary`
- detailed analytics should flow through Reports/read models when cross-app.
## 10. Meeting APIs

### Overview / lists

- `GET /api/v1/meetings/overview`
- `GET /api/v1/meetings`
- `GET /api/v1/meetings?view=upcoming`

### Create/capture/upload

- `POST /api/v1/meetings`
- `POST /api/v1/meetings/{meetingId}/recordings/upload-url`
- `POST /api/v1/meetings/{meetingId}/recordings`
- `POST /api/v1/meetings/{meetingId}/capture-sessions`

Upload flow:
1. create Meeting,
2. request signed upload URL,
3. upload directly to object storage,
4. register completed recording,
5. start processing.

### Detail / processing

- `GET /api/v1/meetings/{meetingId}`
- `GET /api/v1/meetings/{meetingId}/transcript`
- `GET /api/v1/meetings/{meetingId}/summary`
- `GET /api/v1/meetings/{meetingId}/action-items`
- `POST /api/v1/meetings/{meetingId}/process`
- `POST /api/v1/meetings/{meetingId}/summary/regenerate`

Processing returns a job/status representation.

## 11. Reports APIs

### Catalog / overview

- `GET /api/v1/report-datasets`
- `GET /api/v1/reports/overview`

Dataset definitions are server-owned contracts describing allowed fields/filters.

### Report definitions

- `GET /api/v1/report-definitions`
- `POST /api/v1/report-definitions`
- `GET /api/v1/report-definitions/{reportId}`
- `PATCH /api/v1/report-definitions/{reportId}`
- `POST /api/v1/report-definitions/preview`

### Runs / exports

- `POST /api/v1/report-runs`
- `GET /api/v1/report-runs/{runId}`
- `POST /api/v1/report-runs/{runId}/exports`
- `GET /api/v1/report-exports/{exportId}`

## 12. Route-to-API mapping

The UI page remains a composition boundary; one page may call multiple APIs.

### Platform / Workspace

| Route | Primary reads | Primary commands |
| --- | --- | --- |
| `workspace-v2.html` | `/me`, `/me/continue-working`, `/me/attention` | none |
| `workspace-continue.html` | `/me/continue-working` | none |
| `workspace-attention.html` | `/me/attention` | none |
| `workspace-recent.html` | `/me/recent` | none |
| `app-launcher-v2.html` | `/me`, `/modules` | `PATCH /me/modules/{id}` |
| `notifications.html` | `/notifications` | read/read-all |
| `profile.html` | `/me` | `PATCH /me/preferences` |
| `admin.html` | admin summary/read models | none |
| `modules.html` | `/modules` | enable/disable |
| `roles-permissions-v2.html` | `/roles`, `/permissions` | role permission update |
| `access-scopes.html` | `/access-scopes` | none |
| `access-scope-edit.html` | scope/roles/principals | create/update scope assignment |
| `access-scope-browser.html` | scope resources | none |
| `access-scope-evaluate.html` | principals/permissions | access evaluate |

### Devices

| Route family | Primary API |
| --- | --- |
| Overview / Devices / Detail | `/devices/overview`, `/devices`, `/devices/{id}` |
| Add / Discovery | `/devices`, `/device-discovery/runs` |
| Groups | `/device-groups` |
| Query | `/device-queries` |
| Remote Operations / Session | `/remote-sessions`, `/devices/{id}/remote-sessions` |
| Remote Consent pages | `/remote-consent/*` |
| Deployment pages | `/deployment-jobs` |
| Agent maintenance pages | `/agent-* ` |
| Software maintenance pages | `/software-maintenance-jobs` |
| Restart pages | `/restart-jobs` |
| Maintenance History | `/maintenance-history` |
| Endpoint Policies | `/endpoint-policies` |
| Device Alert pages | `/device-alerts`, `/device-alert-rules`, `/device-alert-channels` |

### Assets

| Route family | Primary API |
| --- | --- |
| Overview / Inventory / Detail | `/assets/overview`, `/assets`, `/assets/{id}` |
| Ownership / Users | `/asset-assignments`, `/asset-users` |
| Ownership submissions | `/asset-ownership-submissions` |
| Custom fields | `/asset-custom-fields` |
| QR | `/assets/qr-tokens`, `/assets/qr-label-jobs` |
| Licenses | `/software-licenses` |
| Contracts / Warranty | `/asset-contracts` |

### Helpdesk

| Route family | Primary API |
| --- | --- |
| Overview | `/helpdesk/overview` |
| Tickets / Assigned / Team | `/tickets`, `/helpdesk/team-queue` |
| Create / Detail | `/tickets`, `/tickets/{id}` |
| SLA | `/sla-policies` |
| Settings overview | configuration summary |
| Categories | `/ticket-categories` |
| Statuses | `/ticket-statuses` |
| Requester Groups | `/requester-groups` |
| Calendar | `/business-calendars` |
| Notification rules | `/helpdesk/notification-rules` |
| Templates | `/helpdesk/notification-templates` |
| Delivery | `/helpdesk/notification-deliveries` |
| Notification settings | `/helpdesk/notification-settings` |
| Knowledge | `/knowledge-articles` |
| Reports | `/helpdesk/reports/summary` |

### Meeting

| Route | Primary API |
| --- | --- |
| `meeting.html` | `/meetings/overview` |
| `meeting-list.html` | `/meetings` |
| `meeting-upcoming.html` | `/meetings?view=upcoming` |
| `meeting-new.html` | `POST /meetings`, recording/upload endpoints |
| `meeting-detail.html` | `/meetings/{id}` + transcript/summary/actions |

### Reports

| Route | Primary API |
| --- | --- |
| `reports-overview.html` | `/reports/overview`, `/report-datasets` |
| `report-builder.html` | report definition/preview/run APIs |

## 13. Long-running command response

Example:

```json
{
  "jobId": "uuid",
  "resourceType": "deploymentJob",
  "status": "queued",
  "requestedAt": "2026-09-25T10:30:00Z",
  "links": {
    "self": "/api/v1/deployment-jobs/uuid"
  }
}
```

HTTP status:
- `202 Accepted`.

## 14. Concurrency

Editable configuration resources should return ETag/version.

Examples:
- Remote Consent Policy,
- Alert Rule,
- Endpoint Policy,
- SLA Policy,
- Category,
- Notification Rule,
- Module configuration.

A stale update returns:
- HTTP 409 or 412,
- `concurrency_conflict`,
- latest version metadata.

## 15. Search

Global search is Platform Core.

`GET /api/v1/search?q=...&types=device,ticket,meeting,asset`

Search delegates to registered module search providers/read models.

Response contains:
- type,
- resourceId,
- title,
- subtitle,
- module,
- deepLink,
- matched highlights.

Search does not return raw provider IDs.

## 16. API decisions still open

- page vs cursor pagination for very large device/activity datasets,
- exact signed upload flow for object storage,
- SignalR hub paths,
- versioning mechanism for configurable ticket transitions,
- whether module installation APIs are needed in V1 or modules are deployment-time packages.

These are implementation decisions, not reasons to start coding before permission/event/database contracts are reviewed.


## 17. Exact Web route → API ownership appendix

This appendix gives every frozen Web route an explicit primary API ownership key. It is intentionally route-level so UI changes can be audited against the backend plan.

| Web route | Primary API ownership |
| --- | --- |
| `workspace-v2.html` | `GET /api/v1/me + /me/continue-working + /me/attention` |\n| `workspace-continue.html` | `GET /api/v1/me/continue-working` |\n| `workspace-attention.html` | `GET /api/v1/me/attention` |\n| `workspace-recent.html` | `GET /api/v1/me/recent` |\n| `app-launcher-v2.html` | `GET /api/v1/modules; PATCH /api/v1/me/modules/{moduleId}` |\n| `notifications.html` | `GET /api/v1/notifications` |\n| `profile.html` | `GET /api/v1/me; PATCH /api/v1/me/preferences` |\n| `admin.html` | `Platform Admin summary read model` |\n| `modules.html` | `/api/v1/modules` |\n| `roles-permissions-v2.html` | `/api/v1/roles + /api/v1/permissions` |\n| `access-scopes.html` | `/api/v1/access-scopes` |\n| `access-scope-edit.html` | `/api/v1/access-scopes + /api/v1/role-assignments` |\n| `access-scope-browser.html` | `GET /api/v1/access-scopes/{scopeId}/resources` |\n| `access-scope-evaluate.html` | `POST /api/v1/access/evaluate` |\n| `devices-overview-v2.html` | `GET /api/v1/devices/overview` |\n| `devices.html` | `GET /api/v1/devices` |\n| `device-detail-v2.html` | `GET/PATCH /api/v1/devices/{deviceId}` |\n| `device-add.html` | `POST /api/v1/devices` |\n| `device-discovery.html` | `/api/v1/device-discovery/runs` |\n| `device-groups.html` | `/api/v1/device-groups` |\n| `remote-operations.html` | `GET /api/v1/remote-sessions` |\n| `remote-session.html` | `/api/v1/remote-sessions/{sessionId}` |\n| `remote-consent.html` | `GET /api/v1/remote-consent/policy + rules summary` |\n| `remote-consent-policy.html` | `GET/PUT /api/v1/remote-consent/policy` |\n| `remote-consent-message.html` | `GET/PUT /api/v1/remote-consent/message` |\n| `remote-consent-rules.html` | `/api/v1/remote-consent/rules` |\n| `remote-consent-history.html` | `GET /api/v1/remote-consent/history` |\n| `device-query.html` | `/api/v1/device-queries` |\n| `deployment-jobs.html` | `GET /api/v1/deployment-jobs` |\n| `deployment-new.html` | `POST /api/v1/deployment-jobs` |\n| `deployment-job-detail.html` | `GET /api/v1/deployment-jobs/{jobId}` |\n| `agent-maintenance.html` | `GET /api/v1/agent-maintenance/overview` |\n| `agent-updates.html` | `GET /api/v1/agent-releases + /agent-rollouts` |\n| `agent-rollout-new.html` | `POST /api/v1/agent-rollouts` |\n| `software-maintenance.html` | `GET /api/v1/software-maintenance-jobs` |\n| `software-maintenance-new.html` | `POST /api/v1/software-maintenance-jobs` |\n| `restart-operations.html` | `GET /api/v1/restart-jobs` |\n| `restart-schedule.html` | `POST /api/v1/restart-jobs` |\n| `maintenance-history.html` | `GET /api/v1/maintenance-history` |\n| `endpoint-policies.html` | `/api/v1/endpoint-policies` |\n| `device-alerts.html` | `GET /api/v1/device-alerts` |\n| `device-alert-rules.html` | `GET /api/v1/device-alert-rules` |\n| `device-alert-rule.html` | `GET/PATCH /api/v1/device-alert-rules/{ruleId}` |\n| `device-alert-channels.html` | `GET/PUT /api/v1/device-alert-channels` |\n| `device-alert-history.html` | `GET /api/v1/device-alert-history` |\n| `assets-overview.html` | `GET /api/v1/assets/overview` |\n| `asset-inventory.html` | `GET /api/v1/assets` |\n| `asset-detail.html` | `GET/PATCH /api/v1/assets/{assetId}` |\n| `asset-ownership.html` | `GET /api/v1/asset-assignments` |\n| `asset-users.html` | `GET /api/v1/asset-users` |\n| `asset-user-detail.html` | `GET /api/v1/asset-users/{userId}` |\n| `asset-ownership-submissions.html` | `GET /api/v1/asset-ownership-submissions` |\n| `asset-custom-fields.html` | `/api/v1/asset-custom-fields` |\n| `asset-qr.html` | `/api/v1/assets/qr-tokens + /assets/qr-label-jobs` |\n| `software-licenses.html` | `/api/v1/software-licenses` |\n| `contracts-warranty.html` | `/api/v1/asset-contracts` |\n| `helpdesk.html` | `GET /api/v1/helpdesk/overview` |\n| `helpdesk-tickets.html` | `GET /api/v1/tickets` |\n| `helpdesk-assigned.html` | `GET /api/v1/tickets?assignedTo=me` |\n| `helpdesk-team.html` | `GET /api/v1/helpdesk/team-queue` |\n| `ticket-new.html` | `POST /api/v1/tickets` |\n| `ticket-detail.html` | `GET /api/v1/tickets/{ticketId} + command endpoints` |\n| `helpdesk-sla.html` | `/api/v1/sla-policies` |\n| `helpdesk-settings.html` | `Helpdesk configuration summary read model` |\n| `helpdesk-categories.html` | `/api/v1/ticket-categories` |\n| `helpdesk-statuses.html` | `/api/v1/ticket-statuses` |\n| `helpdesk-requester-groups.html` | `/api/v1/requester-groups` |\n| `helpdesk-calendar.html` | `/api/v1/business-calendars` |\n| `helpdesk-notifications.html` | `GET /api/v1/helpdesk/notification-rules` |\n| `helpdesk-notification-rule.html` | `GET/PATCH /api/v1/helpdesk/notification-rules/{ruleId}` |\n| `helpdesk-notification-templates.html` | `GET /api/v1/helpdesk/notification-templates` |\n| `helpdesk-notification-template.html` | `GET/PATCH /api/v1/helpdesk/notification-templates/{templateId}` |\n| `helpdesk-notification-delivery.html` | `GET /api/v1/helpdesk/notification-deliveries` |\n| `helpdesk-notification-settings.html` | `GET/PUT /api/v1/helpdesk/notification-settings` |\n| `knowledge-base.html` | `/api/v1/knowledge-articles` |\n| `helpdesk-reports.html` | `GET /api/v1/helpdesk/reports/summary` |\n| `meeting.html` | `GET /api/v1/meetings/overview` |\n| `meeting-list.html` | `GET /api/v1/meetings` |\n| `meeting-upcoming.html` | `GET /api/v1/meetings?view=upcoming` |\n| `meeting-new.html` | `POST /api/v1/meetings + recording/upload endpoints` |\n| `meeting-detail.html` | `GET /api/v1/meetings/{meetingId} + transcript/summary/actions` |\n| `reports-overview.html` | `GET /api/v1/reports/overview + /report-datasets` |\n| `report-builder.html` | `/api/v1/report-definitions + preview/run/export` |\n
Route/API coverage is enforced by `backend-planning-audit.py`.
