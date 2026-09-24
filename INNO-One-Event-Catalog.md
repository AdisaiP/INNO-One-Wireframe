# INNO.One — Event Catalog

**Status:** Planning contract  
**Date:** 2026-09-25  
**Delivery:** At-least-once through transactional outbox  
**Backend implementation:** Not started

## 1. Event categories

INNO.One distinguishes:

### Domain event
Internal to one module transaction/process.

Example:
- TicketAssignedDomainEvent.

May be handled in-process before producing integration events.

### Integration event
Stable message that another module, worker or external integration may consume.

Example:
- `ticket.assigned`.

Only integration events belong in this catalog.

## 2. Event envelope

Every integration event uses the same envelope:

```json
{
  "eventId": "uuid",
  "eventType": "ticket.assigned",
  "eventVersion": 1,
  "occurredAt": "2026-09-25T10:30:00Z",
  "producer": "helpdesk",
  "organizationId": "uuid",
  "actor": {
    "userId": "uuid"
  },
  "subject": {
    "type": "ticket",
    "id": "uuid"
  },
  "correlationId": "uuid",
  "causationId": "uuid",
  "data": {}
}
```

Rules:
- event names use lowercase dot notation,
- an existing semantic event is not silently repurposed,
- breaking payload changes increment `eventVersion`,
- consumer logic must ignore unknown optional fields,
- provider IDs are not event subjects.

## 3. Delivery contract

- Producer writes business state and outbox row in the same database transaction.
- Worker publishes outbox messages after commit.
- Delivery is at-least-once.
- Consumers must be idempotent by `eventId`.
- Consumer stores processed event IDs/inbox state where duplicate side effects matter.
- Ordering is guaranteed only where explicitly implemented per aggregate/partition.
- Poison messages move to a dead-letter/error state with operator visibility.
- Events are not a replacement for synchronous authorization or validation.

## 4. Platform Core events

### `user.profile.updated`

Producer: Platform Core  
Subject: user  
Consumers:
- Search projection,
- Audit,
- modules with denormalized display snapshots where needed.

Data:
- userId,
- changedFields.

### `role.assignment.changed`

Producer: Platform Authorization  
Consumers:
- permission cache invalidation,
- Audit,
- notification if required.

### `access.scope.updated`

Producer: Platform Authorization  
Consumers:
- scope cache invalidation,
- Audit.

### `module.enabled`

Producer: Module Registry  
Consumers:
- Navigation/app registry cache,
- Audit.

Data:
- moduleId,
- version.

### `module.disabled`

Same ownership as above.

### `notification.created`

Producer: Platform Notification Hub or module adapter  
Consumers:
- realtime Web push.

### `audit.entry.created`

Do not make Audit consume itself recursively.

This event is optional for external audit shipping; normal audit writes happen through the platform audit contract.

## 5. Devices events

The prototype registry already declares several Devices events. Preserve those names where practical.

### Connectivity

#### `device.online`

Producer: Devices adapter/synchronizer  
Subject: Device  
Data:
- deviceId,
- observedAt,
- previousStatus.

Consumers:
- Alerts evaluation,
- Workspace attention projection,
- realtime Device list,
- Audit only when policy requires.

#### `device.offline`

Same shape as online.

### Remote

#### `remote.started`

Producer: Devices Remote  
Subject: RemoteSession  
Data:
- remoteSessionId,
- deviceId,
- requestedBy,
- mode,
- startedAt.

Consumers:
- Audit,
- operational realtime,
- activity projection.

#### `remote.ended`

Data:
- remoteSessionId,
- deviceId,
- endedAt,
- endReason,
- durationSeconds.

#### `remote.consent.updated`

Producer: Devices configuration  
Subject: policy/rule  
Consumers:
- Audit,
- Agent configuration projection if needed.

#### `remote.consent.decided`

Producer: Remote Consent runtime  
Data:
- remoteSessionId,
- deviceId,
- decision = approved / declined / timeout / bypassed,
- policy/rule reference.

Consumers:
- Audit,
- Remote Session workflow.

#### `remote.chat.message`

Only publish if chat needs a platform event outside the session transport.

Avoid using the integration bus for high-frequency streaming traffic.

#### `remote.file.sent`
#### `remote.file.received`

Publish metadata only:
- transferId,
- sessionId,
- deviceId,
- file name,
- size,
- result.

Never place file content on the event bus.

### Alerts

#### `device.alert.created`

Data:
- alertId,
- ruleId,
- deviceId optional,
- severity,
- type.

Consumers:
- Notification Hub,
- Workspace Attention,
- realtime Alert Center,
- Audit.

#### `device.alert.acknowledged`

Data:
- alertId,
- acknowledgedBy,
- acknowledgedAt.

#### `device.alert.resolved`

Add this canonical lifecycle event even though the prototype registry currently only lists created/acknowledged.

#### `device.alert.rule.updated`

Consumers:
- rule evaluator reload/cache,
- Audit.

#### `device.alert.email.sent`

Prefer a generic notification-delivery event long-term; retain if existing integration relies on it.

### Deployment / maintenance

#### `deployment.job.created`
#### `deployment.job.started`
#### `deployment.job.progressed`
#### `deployment.job.completed`
#### `deployment.job.failed`

Progress events should be throttled/coalesced for Web realtime consumers.

#### `agent.rollout.created`
#### `agent.rollout.completed`

#### `software.maintenance.created`
#### `software.maintenance.completed`

#### `restart.job.created`
#### `restart.job.completed`

### Policy

#### `endpoint.policy.updated`
#### `endpoint.policy.assignment.updated`

Consumers:
- Agent/provider sync worker,
- Audit.
## 6. Assets events

Prototype-declared names:

### `asset.changed`

Use for meaningful register changes when a more specific event is not required.

Payload:
- assetId,
- changedFields.

### `baseline.drift`

Producer: Assets/Inventory comparison  
Consumers:
- Device/Asset alert projection,
- Workspace Attention,
- Notification Hub.

### `license.overused`

Data:
- licenseId,
- purchasedSeats,
- assignedSeats.

### `contract.expiring`

Data:
- contractId,
- expiresAt,
- daysRemaining.

Consumers:
- Workspace Attention,
- Notifications.

### `ownership.changed`

Data:
- assetId,
- previousUserId,
- userId,
- assignmentId.

### `asset.qr.generated`

Data:
- assetId,
- qrTokenId,
- issuedBy.

Do not include raw QR token.

### `asset.qr.scanned`

Data:
- assetId,
- scanningUserId,
- scannedAt,
- client surface.

Do not include raw token.

Additional useful events:

### `asset.created`
### `asset.updated`
### `asset.ownership.submitted`
### `asset.ownership.approved`

## 7. Helpdesk events

Prototype-declared events are the starting contract.

### `ticket.created`

Data:
- ticketId,
- ticketNumber,
- requesterUserId,
- categoryId,
- priority,
- relatedDeviceId optional,
- relatedAssetId optional.

Consumers:
- SLA state initialization if not done in command transaction,
- notification-rule evaluator,
- Workspace Attention/Recent,
- Search projection,
- Audit.

### `ticket.assigned`

Data:
- ticketId,
- assigneeUserId,
- teamId,
- previous assignee/team.

Consumers:
- Notification rules,
- Assigned-to-Me projection,
- Audit.

### `ticket.status.changed`

Data:
- ticketId,
- fromStatus,
- toStatus,
- changedBy,
- changedAt.

Consumers:
- SLA state,
- notification rules,
- reporting projection.

### `ticket.resolved`

Data:
- ticketId,
- resolvedAt,
- resolution code optional.

### `ticket.reopened`

Add as distinct lifecycle event.

### `ticket.message.created`

Useful for notification/search/activity consumers.

### `sla.at_risk`

Data:
- ticketId,
- targetType,
- remainingBusinessSeconds,
- escalationLevel.

### `sla.escalated`

Data:
- ticketId,
- fromLevel,
- toLevel,
- escalatedAt.

### `sla.breached`

Add explicit breach event.

### `ticket.email.sent`
### `ticket.email.failed`

These may later be normalized into `notification.delivery.succeeded/failed`.

### `ticket.notification.rule.updated`

Producer: Helpdesk configuration.

### Configuration events

- `helpdesk.category.updated`
- `helpdesk.status.updated`
- `helpdesk.requester-group.updated`
- `helpdesk.calendar.updated`
- `helpdesk.sla-policy.updated`
- `helpdesk.notification-template.updated`

Consumers are usually cache/config reload + Audit, not every module.

## 8. Meeting events

Prototype-declared:

### `meeting.created`

Data:
- meetingId,
- title,
- scheduledStartAt optional,
- createdBy.

### `transcript.completed`

Data:
- meetingId,
- transcriptId,
- language,
- completedAt.

Consumers:
- summary processing workflow,
- realtime Meeting UI,
- Audit.

### `summary.completed`

Data:
- meetingId,
- summaryId,
- completedAt,
- actionItemCount.

Consumers:
- Notification Hub,
- Workspace Attention/Recent,
- realtime Meeting UI.

Additional lifecycle:

### `meeting.recording.registered`
### `meeting.processing.started`
### `meeting.processing.failed`

Provider-specific job IDs stay in infrastructure metadata and should not be required by consumers.

## 9. Reports events

Prototype-declared:

### `report.created`

Data:
- reportDefinitionId,
- ownerUserId,
- datasetKey.

### `report.exported`

Data:
- reportExportId,
- reportDefinitionId optional,
- format,
- objectKey/reference,
- requestedBy.

Additional:

### `report.run.completed`
### `report.run.failed`

## 10. Notification events

Platform-level canonical delivery events:

### `notification.delivery.requested`

Producer: module notification rules  
Data:
- channel,
- templateKey/templateId,
- recipient references,
- source module/resource.

### `notification.delivery.succeeded`

### `notification.delivery.failed`

Helpdesk-specific `ticket.email.sent/failed` may be emitted as compatibility/domain events while the provider layer uses the generic delivery events.

## 11. Cross-module event consumers

| Event | Typical consumers |
| --- | --- |
| device.offline | Devices Alerts, Workspace Attention |
| device.alert.created | Notifications, Workspace Attention |
| contract.expiring | Notifications, Workspace Attention |
| ticket.assigned | Helpdesk projections, Notifications, Workspace Attention |
| ticket.status.changed | SLA, Reports, Notifications |
| summary.completed | Notifications, Workspace Recent/Attention |
| asset.qr.scanned | Assets Audit/History |
| module.disabled | Platform navigation/access cache |
| role.assignment.changed | Authorization cache |

Reports should generally consume stable projection events rather than call every module synchronously for historical analytics.

## 12. Outbox schema contract

Minimum fields:

- `outbox_id`
- `event_id`
- `event_type`
- `event_version`
- `aggregate_type`
- `aggregate_id`
- `organization_id`
- `occurred_at`
- `correlation_id`
- `causation_id`
- `payload_json`
- `published_at`
- `attempt_count`
- `last_error`

The payload is immutable after commit.

## 13. Inbox/idempotency contract

For consumers with side effects:

- `consumer_name`
- `event_id`
- `processed_at`
- `result`

Unique key:
- `(consumer_name, event_id)`.

## 14. Realtime mapping

Not every event is pushed to Web clients.

SignalR candidates:
- device.online/offline,
- device.alert.created/acknowledged/resolved,
- remote.started/ended,
- deployment job progress/completed,
- ticket.assigned/status.changed,
- sla.at_risk/escalated,
- transcript.completed,
- summary.completed.

Web realtime payloads may be smaller projections of integration events.

## 15. Event retention

Outbox:
- keep published rows long enough for operational diagnostics,
- archive/delete by policy after successful delivery.

Audit:
- independent retention policy,
- usually longer.

Business activity:
- owned by each module and governed by business retention.

Do not use the event bus as permanent business history.

## 16. Event review checklist

Before publishing a new event:

1. Is another module actually expected to react?
2. Is the event a business fact, not a UI click?
3. Does it expose only canonical INNO.One IDs?
4. Can a consumer process it twice safely?
5. Is payload minimal but sufficient?
6. Does a breaking change require a new version?
7. Is sensitive/provider data excluded?


## 17. Future module manifest events

The current App Registry reserves these events even though the modules are not installed.

### Workflow

- `workflow.published`
- `workflow.started`
- `workflow.completed`

Forms currently declares no integration events.

These names remain reserved; they do not imply an implemented Workflow backend in this planning branch.
