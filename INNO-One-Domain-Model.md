# INNO.One — Domain Model

**Status:** Planning contract  
**Date:** 2026-09-25  
**UI source:** 83 Web Portal routes from UI Contract 1.12.0  
**Backend code:** Not implemented

## 1. Modeling rules

1. Each business entity has exactly one owning module.
2. Cross-module references use INNO.One canonical IDs, never provider IDs.
3. A module may query another module only through a declared contract/read model.
4. A module must not write another module's tables.
5. Long-running operations are modeled as jobs/resources with explicit lifecycle state.
6. Provider-specific fields live in adapter metadata/mapping entities.
7. Audit history is platform-owned; business activity timelines may additionally be module-owned.
8. Organization/tenant context is present on all tenant-owned aggregates.

## 2. Bounded contexts

```
Platform Core
  ├─ Identity & Organization
  ├─ Authorization & Access Scope
  ├─ Module Registry
  ├─ Notifications
  └─ Audit

Devices
  ├─ Device Inventory
  ├─ Groups / Queries
  ├─ Remote / Consent
  ├─ Alerts
  ├─ Deployment / Maintenance
  └─ Endpoint Policies

Assets
  ├─ Asset Register
  ├─ Ownership
  ├─ QR
  ├─ Licenses
  └─ Contracts / Warranty

Helpdesk
  ├─ Tickets
  ├─ Catalog / Status
  ├─ Requester Groups
  ├─ SLA / Calendar
  ├─ Notifications
  ├─ Knowledge Base
  └─ Reports

Meeting
  ├─ Meeting
  ├─ Recording
  ├─ Transcript
  ├─ Summary
  └─ Action Items

Reports
  ├─ Report Definition
  ├─ Report Run
  └─ Export
```

## 3. Platform Core

### 3.1 Organization

**Aggregate:** `Organization`

Fields:
- `OrganizationId`
- `Code`
- `Name`
- `Status`
- `DefaultTimeZone`
- `CreatedAt`
- `UpdatedAt`

Related entities:
- `OrganizationUnit`
- `Location`
- `Team`

Rules:
- all tenant-owned data belongs to one Organization,
- organizational hierarchy may be nested,
- disabling an organization blocks access but does not delete business records.

### 3.2 User

**Aggregate:** `User`

Fields:
- `UserId`
- `OrganizationId`
- `ExternalSubject` — Keycloak `sub`
- `Email`
- `DisplayName`
- `Status`
- `Locale`
- `TimeZone`

Related:
- `GroupMembership`
- `UserPreference`
- `PinnedModule`

Keycloak credentials are not stored in INNO.One.

### 3.3 Authorization

Core entities:
- `Role`
- `Permission`
- `RolePermission`
- `RoleAssignment`
- `AccessScope`
- `AccessScopeResource`
- `AccessScopeActionOverride`

`RoleAssignment` links:
- principal/user/group,
- role,
- access scope,
- organization.

`AccessScope` describes resource visibility boundaries such as:
- organization/subtree,
- location,
- device group,
- team.

Permission answers **what** an actor may do.
Access scope answers **where/to what resource** it may be done.

### 3.4 Module Registry

**Aggregate:** `ModuleInstallation`

Fields:
- `ModuleId` e.g. `devices`
- `InstalledVersion`
- `Installed`
- `Enabled`
- `HealthStatus`
- `Configuration`
- `InstalledAt`
- `UpdatedAt`

Static module definition/manifest contains:
- ID,
- name,
- icon token,
- entry route,
- permissions,
- navigation declaration,
- dependencies,
- emitted events.

Per-user state:
- `UserModulePreference`
- pinned,
- ordering.

### 3.5 Platform Notification

**Aggregate:** `Notification`

Fields:
- `NotificationId`
- `UserId`
- `Type`
- `Title`
- `Body`
- `DeepLink`
- `ReadAt`
- `CreatedAt`
- `ExpiresAt`

Notifications do not own source business state.

### 3.6 Audit

**Append-only entity:** `AuditEntry`

Fields:
- `AuditId`
- `OrganizationId`
- `ActorUserId`
- `Action`
- `Module`
- `TargetType`
- `TargetId`
- `Timestamp`
- `CorrelationId`
- `Metadata`

## 4. Devices domain

### 4.1 Device

**Aggregate:** `Device`

Fields:
- `DeviceId` — canonical INNO.One ID
- `OrganizationId`
- `ComputerName`
- `DisplayName`
- `DeviceType`
- `OperatingSystem`
- `OsVersion`
- `SerialNumber`
- `Status`
- `LastSeenAt`
- `AgentVersion`
- `PrimaryUserId` optional
- `LocationId` optional
- `CreatedAt`
- `UpdatedAt`

Provider mapping:
- `DeviceProviderMapping`
  - `DeviceId`
  - `Provider` = meshcentral
  - `ProviderDeviceId`
  - `ProviderGroupId` optional
  - `ProviderMetadata`

The provider ID is not exposed as a product route identifier.

### 4.2 Device Group

**Aggregate:** `DeviceGroup`

Fields:
- `DeviceGroupId`
- `Name`
- `Type` = Static / Dynamic
- `Description`
- `QueryId` optional
- `Status`

Related:
- `DeviceGroupMembership` for static groups.

Dynamic membership is evaluated from a saved query/rule.

### 4.3 Inventory Query

**Aggregate:** `DeviceQuery`

Fields:
- `DeviceQueryId`
- `Name`
- `ScopeReference`
- `MatchLogic`
- `Conditions`
- `CreatedBy`
- `UpdatedAt`

Initial implementation may support one condition while the model permits multiple ordered conditions.

### 4.4 Remote Session

**Aggregate:** `RemoteSession`

Fields:
- `RemoteSessionId`
- `DeviceId`
- `RequestedBy`
- `Status`
- `Mode`
- `ProviderSessionId`
- `RequestedAt`
- `StartedAt`
- `EndedAt`
- `EndReason`

Child/activity:
- chat metadata,
- file-transfer metadata,
- collaborator joins/leaves.

Provider transport mechanics stay outside the aggregate.

### 4.5 Remote Consent

Entities:
- `RemoteConsentPolicy`
- `RemoteConsentRule`
- `RemoteConsentDecision`
- `RemoteConsentMessageTemplate`

Policy owns default behavior.
Rules define bypass/trusted exceptions.
Decision is immutable history tied to a session/request.

### 4.6 Device Alert

**Aggregate:** `DeviceAlert`

Fields:
- `DeviceAlertId`
- `RuleId`
- `DeviceId` optional for fleet alerts
- `Severity`
- `Type`
- `Title`
- `Status` = Active / Acknowledged / Resolved
- `DetectedAt`
- `AcknowledgedBy`
- `AcknowledgedAt`
- `ResolvedAt`
- `Evidence`

Configuration entities:
- `DeviceAlertRule`
- `AlertChannelSettings`

### 4.7 Deployment and maintenance

Aggregates:
- `DeploymentJob`
- `AgentRollout`
- `SoftwareMaintenanceJob`
- `RestartJob`

Shared job semantics:
- Requested,
- Queued,
- Running,
- PartiallySucceeded,
- Succeeded,
- Failed,
- Cancelled.

Child items track per-device execution.

Supporting entities:
- `SoftwarePackage`
- `AgentRelease`
- `MaintenanceExecution`.

### 4.8 Endpoint Policy

**Aggregate:** `EndpointPolicy`

Fields:
- `EndpointPolicyId`
- `Name`
- `PolicyType`
- `Status`
- `Configuration`
- `UpdatedBy`
- `UpdatedAt`

Related:
- `EndpointPolicyAssignment`
- `EndpointPolicyException`

Policy assignments reference Device Groups / organizational scopes, not provider groups.
## 5. Assets domain

### 5.1 Asset

**Aggregate:** `Asset`

Fields:
- `AssetId`
- `OrganizationId`
- `AssetNumber`
- `AssetType`
- `Brand`
- `Model`
- `SerialNumber`
- `Status`
- `PurchaseDate`
- `LocationId`
- `LinkedDeviceId` optional
- `CreatedAt`
- `UpdatedAt`

The Asset ID and Device ID remain different concepts even when one physical computer maps one-to-one.

### 5.2 Ownership

Entities:
- `AssetAssignment`
- `AssetOwnershipSubmission`

Assignment fields:
- AssetId,
- UserId,
- AssignedAt,
- ReturnedAt,
- AssignmentType,
- Notes.

Submission represents agent/mobile/user ownership confirmation before approval.

### 5.3 Custom fields

Entities:
- `AssetCustomFieldDefinition`
- `AssetCustomFieldValue`

Definitions own:
- key,
- label,
- value type,
- required flag,
- options,
- status.

### 5.4 QR

**Aggregate:** `AssetQrToken`

Fields:
- `AssetQrTokenId`
- `AssetId`
- `TokenHash`
- `Status`
- `IssuedAt`
- `RevokedAt`
- `IssuedBy`

The printed QR contains an opaque random token, not an Asset ID, serial number or owner.

The raw token is not stored after issuance.

Lookup:
1. Mobile sends scanned token over authenticated API.
2. Server hashes token.
3. Resolve active `AssetQrToken`.
4. Permission/scope check.
5. Return allowed Asset view.

### 5.5 Software License

**Aggregate:** `SoftwareLicense`

Fields:
- Product,
- Vendor,
- LicenseType,
- PurchasedSeats,
- AssignedSeats,
- Renewal/expiry,
- Cost metadata.

Optional child:
- `SoftwareLicenseAssignment`.

### 5.6 Contract / Warranty

**Aggregate:** `AssetContract`

Fields:
- contract number,
- vendor,
- type,
- start/end,
- covered resource metadata,
- status,
- renewal reminder.

Warranty may be represented by the same contract aggregate with a type or by a dedicated child when requirements justify it.

## 6. Helpdesk domain

### 6.1 Ticket

**Aggregate:** `Ticket`

Fields:
- `TicketId`
- `TicketNumber`
- `OrganizationId`
- `Subject`
- `Description`
- `RequesterUserId`
- `AssigneeUserId`
- `AssignedTeamId`
- `CategoryId`
- `StatusId`
- `Priority`
- `Impact`
- `Urgency`
- `RelatedDeviceId` optional
- `RelatedAssetId` optional
- `CreatedAt`
- `UpdatedAt`
- `ResolvedAt`
- `ClosedAt`

Children:
- `TicketMessage`
- `TicketAttachment`
- `TicketActivity`

Rules:
- status changes follow configured transition rules,
- assignment requires visibility to target team/assignee,
- priority may be calculated from Impact/Urgency but stored for traceability,
- Related Device/Asset are references only.

### 6.2 Ticket Category

**Aggregate:** `TicketCategory`

Fields:
- hierarchical ParentCategoryId,
- Name,
- Code,
- DefaultTeamId,
- DefaultSlaPolicyId,
- Active.

### 6.3 Ticket Status

**Aggregate/configuration:** `TicketStatusDefinition`

Fields:
- Name,
- SemanticType,
- Color token,
- Terminal flag,
- SLA pause behavior,
- SortOrder.

Business code should use semantic status category where possible instead of relying on display labels.

### 6.4 Requester Group

**Aggregate:** `RequesterGroup`

Fields:
- Name,
- MatchLogic,
- Conditions,
- Active.

Conditions can target user/org attributes such as:
- location,
- department,
- VIP marker.

### 6.5 SLA

Entities:
- `SlaPolicy`
- `SlaTarget`
- `TicketSlaState`
- `BusinessCalendar`
- `BusinessCalendarHoliday`

Policy defines:
- applicability,
- first-response target,
- resolution target,
- calendar,
- escalation levels.

Ticket SLA state stores:
- deadlines,
- elapsed business duration,
- paused state,
- breach/escalation state.

Do not recalculate historical SLA solely from current policy values.

### 6.6 Knowledge

**Aggregate:** `KnowledgeArticle`

Fields:
- Title,
- Slug,
- Body/ContentRef,
- Category,
- Status,
- Author,
- PublishedAt,
- UpdatedAt.

### 6.7 Helpdesk notification

Entities:
- `TicketNotificationRule`
- `NotificationTemplate`
- `NotificationDelivery`
- `HelpdeskNotificationSettings`

Rule defines:
- trigger,
- timing,
- recipients,
- template,
- duplicate suppression.

Delivery is immutable attempt/result history.

Transport credentials/settings are infrastructure secrets and are not returned to normal clients.

## 7. Meeting domain

### 7.1 Meeting

**Aggregate:** `Meeting`

Fields:
- `MeetingId`
- `OrganizationId`
- `Title`
- `ScheduledStartAt` optional
- `ScheduledEndAt` optional
- `Language`
- `Status`
- `CreatedBy`
- `CreatedAt`

Status example:
- Draft,
- Scheduled,
- Capturing,
- Uploaded,
- Processing,
- Ready,
- Failed.

### 7.2 Recording

**Entity:** `MeetingRecording`

Fields:
- RecordingId,
- MeetingId,
- Source = Agent / Upload,
- ObjectKey,
- MimeType,
- Duration,
- Size,
- Sha256,
- CapturedAt.

### 7.3 Transcript

**Entity:** `MeetingTranscript`

Fields:
- MeetingId,
- Status,
- Language,
- ContentRef or content,
- Provider,
- ProviderJobId,
- StartedAt,
- CompletedAt,
- Error.

### 7.4 Summary / actions

Entities:
- `MeetingSummary`
- `MeetingActionItem`

Summary stores generated content and generation metadata/version.

Action items are first-class records if they need status/ownership later.

## 8. Reports domain

### 8.1 ReportDefinition

**Aggregate:** `ReportDefinition`

Fields:
- ReportDefinitionId,
- Name,
- DatasetKey,
- Columns,
- Filters,
- Grouping,
- Sorting,
- OwnerUserId,
- Visibility,
- CreatedAt,
- UpdatedAt.

### 8.2 ReportRun

Tracks:
- definition/snapshot,
- requested by,
- requested at,
- status,
- row count,
- duration,
- failure.

### 8.3 ReportExport

Tracks asynchronous PDF/XLSX generation.

The output file lives in object storage.

## 9. Cross-module reference contract

Allowed references:

| Source | Reference | Owner |
| --- | --- | --- |
| Asset | LinkedDeviceId | Devices |
| Ticket | RelatedDeviceId | Devices |
| Ticket | RelatedAssetId | Assets |
| Device | PrimaryUserId | Platform Core |
| AssetAssignment | UserId | Platform Core |
| Ticket | Requester/Assignee UserId | Platform Core |
| Meeting | CreatedBy | Platform Core |
| Any module | OrganizationId | Platform Core |

A reference does not allow direct table access.

For display data:
- use query contract,
- denormalized snapshot where historical text must remain unchanged,
- reporting projection for bulk/report queries.
## 10. Route ownership mapping

Every current Web route has one primary domain owner.

### Platform Core / Workspace — 14 routes

- `workspace-v2.html`
- `workspace-continue.html`
- `workspace-attention.html`
- `workspace-recent.html`
- `app-launcher-v2.html`
- `notifications.html`
- `profile.html`
- `admin.html`
- `modules.html`
- `roles-permissions-v2.html`
- `access-scopes.html`
- `access-scope-edit.html`
- `access-scope-browser.html`
- `access-scope-evaluate.html`

### Devices — 31 routes

- `devices-overview-v2.html`
- `devices.html`
- `device-detail-v2.html`
- `device-add.html`
- `device-discovery.html`
- `device-groups.html`
- `remote-operations.html`
- `remote-session.html`
- `remote-consent.html`
- `remote-consent-policy.html`
- `remote-consent-message.html`
- `remote-consent-rules.html`
- `remote-consent-history.html`
- `device-query.html`
- `deployment-jobs.html`
- `deployment-new.html`
- `deployment-job-detail.html`
- `agent-maintenance.html`
- `agent-updates.html`
- `agent-rollout-new.html`
- `software-maintenance.html`
- `software-maintenance-new.html`
- `restart-operations.html`
- `restart-schedule.html`
- `maintenance-history.html`
- `endpoint-policies.html`
- `device-alerts.html`
- `device-alert-rules.html`
- `device-alert-rule.html`
- `device-alert-channels.html`
- `device-alert-history.html`

### Assets — 11 routes

- `assets-overview.html`
- `asset-inventory.html`
- `asset-detail.html`
- `asset-ownership.html`
- `asset-users.html`
- `asset-user-detail.html`
- `asset-ownership-submissions.html`
- `asset-custom-fields.html`
- `asset-qr.html`
- `software-licenses.html`
- `contracts-warranty.html`

The Assets route set above contains 11 current Web pages. The twelfth Assets-facing capability is the separate Android Mobile asset scanner surface and is not a Web Portal route.

### Helpdesk — 20 routes

- `helpdesk.html`
- `helpdesk-tickets.html`
- `helpdesk-assigned.html`
- `helpdesk-team.html`
- `ticket-new.html`
- `ticket-detail.html`
- `helpdesk-sla.html`
- `helpdesk-settings.html`
- `helpdesk-categories.html`
- `helpdesk-statuses.html`
- `helpdesk-requester-groups.html`
- `helpdesk-calendar.html`
- `helpdesk-notifications.html`
- `helpdesk-notification-rule.html`
- `helpdesk-notification-templates.html`
- `helpdesk-notification-template.html`
- `helpdesk-notification-delivery.html`
- `helpdesk-notification-settings.html`
- `knowledge-base.html`
- `helpdesk-reports.html`

### Meeting — 5 routes

- `meeting.html`
- `meeting-list.html`
- `meeting-upcoming.html`
- `meeting-new.html`
- `meeting-detail.html`

### Reports — 2 routes

- `reports-overview.html`
- `report-builder.html`

Total Web routes: **83**.

## 11. Surface ownership beyond Web

### Endpoint Agent

Owns:
- Helpdesk Request Agent flow,
- Asset ownership confirmation,
- endpoint consent dialog/runtime interactions.

It does not own Platform navigation.

### Android Assets Mobile

Owns:
- QR scan,
- authenticated asset lookup,
- mobile Hardware/Software view,
- scan history if required.

The Web Assets module owns token generation/administration.

## 12. Aggregate transaction boundaries

Prefer a single aggregate mutation per command.

Examples:

`CreateTicket`
- creates Ticket,
- initial TicketActivity,
- TicketSlaState,
- outbox events,
- one transaction in Helpdesk.

`StartRemoteSession`
- creates RemoteSession request,
- creates outbox/provider command,
- one Devices transaction,
- provider connection occurs after commit.

`GenerateAssetQrToken`
- revokes previous active token if policy requires,
- creates new AssetQrToken,
- emits event,
- one Assets transaction.

## 13. Domain decisions requiring review before code

- whether Device inventory attributes are authoritative in Devices DB or partially projected live from MeshCentral,
- whether Ticket status transitions are fully configurable in V1,
- whether Meeting transcript body is stored directly or in object storage for large content,
- whether Report datasets are fixed contracts or admin-configurable,
- whether Organization is true multi-tenant isolation or one organization per installation.

None of these decisions should block the core route/API/permission ownership defined above.
