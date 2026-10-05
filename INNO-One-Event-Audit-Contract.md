# INNO.One — Event & Audit Contract

**Date:** 2026-09-26
**Status:** Implementation planning contract
**Event & Audit Contract:** 0.5.0
**API Contract:** 0.5.0
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0
**Scope:** Step 12 — Event & Audit Contract
**Backend implementation:** Not started by this document

## 1. Purpose

This contract defines how INNO.One records facts that happen inside the system and how those facts are propagated across module/service boundaries.

It separates three concepts that must not be conflated:

1. **Domain Event** — an internal fact used inside one owning module.
2. **Integration Event** — a durable cross-module/service fact.
3. **Audit Record** — an append-only security/compliance/operator-history record.

The machine-readable source is `inno-event-audit-contract.json`.

## 2. Core rule

```text
Business mutation
      │
      ├─ Domain Event
      │   └─ same owning module
      │
      ├─ Integration Event
      │   └─ cross-module/service subscribers
      │      via transactional outbox
      │
      └─ Audit Record
          └─ append-only operator/security history
```

Do not use the audit store as a business event bus.

Do not use integration events as a substitute for a complete audit trail.

Not every domain event becomes an integration event, and not every audit action needs to be published as an integration event.

## 3. Domain vs Integration vs Audit

### 3.1 Domain Event

Purpose:

- decouple application/domain logic inside a module,
- trigger same-module reactions,
- remain an implementation detail unless promoted.

Example:

```text
TicketPriorityCalculated
```

A domain event may stay in-process and does not automatically require the outbox.

### 3.2 Integration Event

Purpose:

- tell another module/service that a committed fact happened,
- support projections, notifications, automation and read models,
- remain stable enough to be consumed independently.

Examples already present in the prototype registry:

```text
device.offline
ticket.assigned
sla.escalated
ownership.changed
summary.completed
```

Integration events use the durable event envelope and transactional outbox rules in this contract.

### 3.3 Audit Record

Purpose:

- answer who did what, to which resource, when, from where, and with what result,
- support privileged-action review,
- support security/compliance investigation,
- provide operator-visible history later when Audit UI becomes available.

Example:

```text
actor: user_123
action: platform.access_assignment.updated
target: asg_456
result: success
correlationId: corr_...
```

## 4. Event naming

Canonical integration-event names use lowercase dot-separated facts:

```text
<subject-or-capability>.<past-fact>
```

Existing prototype event IDs are preserved as v1 compatibility inputs.

Examples:

```text
device.online
device.offline
remote.started
ticket.created
ticket.assigned
ticket.status.changed
sla.at_risk
meeting.created
summary.completed
ownership.changed
```

Rules:

- lowercase only,
- dot-separated,
- describe a fact that already happened,
- do not put organization names, user names or environment names in event types,
- do not silently rename a published event type,
- breaking payload semantics increment `eventVersion`.

## 5. Event envelope

Canonical integration-event shape:

```json
{
  "eventId": "evt_01...",
  "eventType": "ticket.assigned",
  "eventVersion": 1,
  "occurredAt": "2026-09-26T08:30:00Z",
  "producer": {
    "module": "helpdesk",
    "service": "platform-api"
  },
  "subject": {
    "type": "ticket",
    "id": "ticket_..."
  },
  "actor": {
    "type": "user",
    "id": "user_..."
  },
  "correlationId": "corr_...",
  "causationId": "evt_or_operation_...",
  "traceId": "otel-trace-id",
  "data": {
    "teamId": "team_network",
    "assigneeUserId": "user_..."
  },
  "metadata": {}
}
```

Required fields:

- `eventId`
- `eventType`
- `eventVersion`
- `occurredAt`
- `producer`
- `subject`
- `actor`
- `correlationId`
- `data`

Optional:

- `causationId`
- `traceId`
- `metadata`

## 6. Actor types

Canonical actor types:

```text
user
agent
service
system
```

Examples:

- Web admin changing a role → `user`.
- Endpoint Agent confirming ownership → `agent`.
- Meeting processor completing transcription → `service`.
- SLA timer escalation → `system`.

A system actor may omit a human identifier but must still identify the producing module/service.

## 7. Correlation, causation and tracing

### Correlation

HTTP requests accept/return:

```http
X-Correlation-Id: corr_...
```

All events and audit records produced from that request carry the same `correlationId`.

If the boundary receives no correlation ID, it generates one.

### Causation

`causationId` points to the direct trigger:

- triggering `eventId`,
- command ID,
- async `operationId`.

Example:

```text
ticket.assigned
  causes
ticket.email.sent
```

The email event should use the assignment event/notification command as its causation reference while keeping the same correlation chain.

### Trace

`traceId` propagates the observability trace where available.

Correlation is a business/support chain. Trace is an observability execution chain. They are related but not interchangeable.

## 8. Transactional outbox

Cross-module/service integration events generated by a database-backed mutation use the transactional outbox.

```text
Application transaction
├─ update aggregate
├─ append audit record when required
└─ insert outbox row
       │
       COMMIT
       │
       ▼
Outbox Dispatcher
       │
       ▼
Event Transport
       │
       ▼
Consumer Inbox / Dedupe
```

Required rule:

> The business write and its outbox row commit atomically in the owning module database transaction.

Do not:

- update business data then publish directly before commit,
- use distributed 2-phase commit between modules,
- silently drop an event when transport is unavailable.

## 9. Outbox record

Minimum record:

```json
{
  "outboxId": "out_...",
  "eventId": "evt_...",
  "eventType": "ticket.assigned",
  "eventVersion": 1,
  "payload": {},
  "occurredAt": "2026-09-26T08:30:00Z",
  "status": "pending",
  "attempts": 0
}
```

Statuses:

```text
pending
publishing
published
failed
```

Optional delivery fields:

- `nextAttemptAt`
- `publishedAt`
- `lastErrorCode`

The outbox must never contain secrets such as access tokens, passwords, cookies or vendor credentials.

## 10. Delivery semantics

Integration delivery is:

```text
at-least-once
```

Therefore duplicates are expected.

Every integration-event consumer must be idempotent.

Recommended inbox rule:

```text
consumer + eventId = processed once
```

A duplicate event with the same `eventId` must not re-apply a non-idempotent business mutation.

## 11. Ordering

There is no global event ordering guarantee.

Where transport supports partitioning, use:

```text
<subject.type>:<subject.id>
```

Example:

```text
ticket:ticket_123
device:dev_456
```

This provides best-effort per-subject ordering.

Consumers must not assume events for two different subjects are globally ordered.

## 12. Retry and dead-letter

Transient delivery failures retry with:

```text
exponential backoff + jitter
```

The exact retry count/interval is deployment policy and is not frozen in Step 12.

After the configured maximum:

- mark the message failed/dead-lettered,
- retain enough metadata to diagnose/replay,
- alert operations when appropriate,
- never silently discard.

Business consumers must distinguish permanent schema/business rejection from transient infrastructure failure.

## 13. Event compatibility

Compatibility rules:

- Event type is a stable contract.
- `eventVersion` is a positive integer.
- Adding an optional field is normally backward compatible.
- Removing/renaming required fields is breaking.
- Changing field meaning/type is breaking.
- Breaking change increments `eventVersion`.
- Consumers ignore unknown optional fields.
- Consumers reject unsupported breaking versions explicitly.
- Renaming an event type requires a new type + migration window.

Do not place version suffixes in normal event names unless a compatibility migration specifically requires a parallel type.

## 14. Integration-event payload minimization

Events carry enough data to react without becoming snapshots of entire aggregates.

Prefer:

```json
{
  "ticketId": "ticket_...",
  "teamId": "team_network",
  "assigneeUserId": "user_..."
}
```

Avoid:

```text
whole ticket object
whole user profile
whole device inventory
full meeting transcript
raw file
raw QR token
```

Consumers needing authoritative current state use the owning module API/read model.

## 15. Privacy and secret handling

Never persist in integration events or generic audit metadata:

- passwords,
- access tokens,
- refresh tokens,
- ID tokens,
- client secrets,
- API keys,
- private keys,
- session cookies,
- Authorization headers,
- SMTP passwords,
- MeshCentral credentials,
- raw QR tokens.

Content rules:

- Ticket descriptions/reply bodies remain in Helpdesk storage; events reference ticket/reply IDs.
- Meeting audio/transcript/summary content remains in Meeting storage; events reference IDs/status.
- Remote chat event uses `messageId`, not chat body.
- File events use `fileId` and safe metadata, not file contents.
- QR scan event uses `assetId/scanId`; raw token is not retained in generic event/audit payload.
- PII is limited to identifiers and minimum operational context.

## 16. Audit record envelope

Canonical audit record:

```json
{
  "auditId": "aud_...",
  "occurredAt": "2026-09-26T08:30:00Z",
  "actor": {
    "type": "user",
    "id": "user_..."
  },
  "action": "platform.access_assignment.updated",
  "module": "platform",
  "target": {
    "type": "access_assignment",
    "id": "asg_..."
  },
  "result": "success",
  "correlationId": "corr_...",
  "traceId": "otel-trace-id",
  "source": {
    "surface": "web"
  },
  "reasonCode": "ADMIN_CHANGE",
  "changes": [
    {
      "field": "scope.resourceIds",
      "before": ["org_a"],
      "after": ["org_a", "org_b"]
    }
  ],
  "metadata": {}
}
```

Required:

- `auditId`
- `occurredAt`
- `actor`
- `action`
- `module`
- `target`
- `result`
- `correlationId`

Optional:

- `traceId`
- `causationId`
- `source`
- `reasonCode`
- `changes`
- `metadata`

## 17. Audit action naming

Audit actions use:

```text
<module>.<resource-or-capability>.<verb-or-fact>
```

Examples:

```text
platform.user.updated
platform.access_assignment.updated
devices.remote.started
devices.policy.updated
assets.ownership.changed
helpdesk.ticket.assigned
meeting.shared
reports.report.exported
security.authorization.denied
```

Audit action IDs are implementation contracts and must not be silently renamed after production data exists.

## 18. Audit results

Canonical result values:

```text
success
denied
failure
```

Use:

- `success` — authorized operation completed.
- `denied` — authorization/policy prevented the action.
- `failure` — authorized operation attempted but failed technically/business-wise.

A validation error on an ordinary form does not necessarily require a security audit record. Privileged/security-significant failures do.

## 19. What must be audited

At minimum audit:

### Platform / Admin

- user create/update/status change,
- organization/location/position create/update,
- role and permission changes,
- access assignment create/update/delete,
- privileged access evaluation,
- app/module enable/disable.

### Devices

- remote session start/end,
- consent decisions and consent-policy/bypass-rule changes,
- remote file transfer,
- Device Group membership changes affecting authorization,
- deployment creation,
- endpoint policy changes,
- alert acknowledgement/rule changes.

### Assets

- asset update,
- ownership change,
- QR generation/scan,
- license/contract changes,
- custom-field configuration change.

### Helpdesk

- ticket create/reply/assignment/status/resolve,
- SLA policy change,
- taxonomy/status/requester-group config changes,
- notification config/template/rule changes,
- automation-rule changes.

### Meeting

- meeting creation,
- recording start,
- audio/file upload,
- summary generation,
- sharing.

### Reports

- saved report create/update,
- report run,
- report export.

### Security

- privileged authorization denied when security value justifies retention.

## 20. Audit append-only rule

Audit records are logically immutable.

Normal application code must not:

- update an audit record in place,
- delete a single audit record because a business resource was edited,
- reuse an audit ID for another action.

Retention/archival is controlled by governance policy, not resource CRUD.

If legal/privacy requirements require deletion or anonymization, that process must be separately governed and itself auditable.

## 21. Audit transaction rule

For privileged mutations backed by the same database:

> Persist the audit record in the same transaction as the successful business mutation whenever practical.

This prevents:

```text
business change succeeded
but audit write was lost
```

For denied actions or cross-service failures where no business transaction exists, use a reliable security/audit pipeline that does not block on an unavailable external broker.

## 22. Audit source

Canonical surfaces:

```text
web
agent
mobile
api
system
```

Optional source context may include:

- route/endpoint template,
- client application ID,
- device/agent ID,
- IP/network context when justified,
- user-agent/client version.

Do not store raw request/response bodies by default.

## 23. Change capture

Use field-level safe changes:

```json
{
  "field": "status",
  "before": "pending",
  "after": "active"
}
```

Do not store full entity snapshots unless a specific compliance requirement demands it.

Sensitive fields are redacted before persistence.

## 24. Retention classes

Step 12 defines semantic retention classes, not exact durations:

```text
security_long
admin_long
operational_standard
data_access_standard
```

Exact days/years are deployment/governance decisions and are deferred.

A future retention policy can map each class to a concrete duration without renaming audit actions.

## 25. Audit access

Audit visibility requires:

```text
admin.audit.view
```

The current frozen Admin navigation still treats Audit as a future/unavailable surface.

Defining the audit contract does not make a hidden future UI route visible.

When Audit UI/API becomes enabled later, it must enforce server-side scope and permission filtering.

## 26. Event and audit are separate

Example: Ticket assignment.

Integration event:

```text
ticket.assigned
```

Purpose:

- notification,
- SLA/automation reaction,
- projections.

Audit record:

```text
helpdesk.ticket.assigned
```

Purpose:

- who assigned it,
- from which team/assignee,
- result,
- correlation/trace.

The integration event may be retried/consumed multiple times.

The audit record remains one immutable history fact for the executed action.

## 27. Notifications are consumers, not event owners

Notification behavior should consume domain/integration facts.

Example:

```text
sla.at_risk
    │
    ▼
Notification rule evaluation
    │
    ▼
Email delivery
    │
    ├─ ticket.email.sent
    └─ ticket.email.failed
```

A notification failure does not roll back the original SLA fact.

Retry/delivery state belongs to the notification subsystem.

## 28. Reports and search projections

Reports/Search may build read models from integration events when useful.

Rules:

- projection lag must be tolerated,
- authoritative writes still go to the owning module,
- projections do not become the source of truth,
- authorization rules still apply to query results.

The initial implementation may query module APIs/read models directly before a broker/projection architecture is justified.

## 29. Broker decision

An external broker is **not required** to start implementation.

Initial shape may be:

```text
module DB transaction
   │
   └─ outbox
       │
       ▼
background dispatcher
       │
       ├─ in-process consumer
       └─ service HTTP/internal transport
```

When scale/reliability requires a broker, the event envelope remains unchanged.

The broker product is intentionally deferred.

## 30. Event catalog source

The Step 12 integration catalog preserves all event IDs currently declared by `platform-registry.js`:

- Devices,
- Helpdesk,
- Meeting,
- Reports,
- Assets,
- reserved future Workflow events.

Current count:

```text
37 event types
34 active
3 future/reserved Workflow events
```

Forms currently declares no events.

## 31. Step 12 decisions frozen

1. Domain events, integration events and audit records are separate concepts.
2. Cross-module/service integration events use the canonical envelope.
3. Integration events are at-least-once; consumers are idempotent.
4. Database-backed cross-module events use a transactional outbox.
5. Consumer dedupe uses `eventId`.
6. Global ordering is not guaranteed; best-effort ordering is per subject partition.
7. Retry uses exponential backoff + jitter; failed events are never silently discarded.
8. Event names stay stable; breaking payload changes increment `eventVersion`.
9. Correlation ID propagates from API to event and audit.
10. Causation identifies the direct event/command/operation trigger.
11. Audit is append-only and is not the business event bus.
12. Privileged successful mutations write audit in the same transaction where practical.
13. Secrets/raw content are excluded from generic event/audit payloads.
14. `admin.audit.view` is the future Audit read permission.
15. Exact broker and retention durations remain deferred.

## 32. Deferred Event/Audit decisions

Not frozen in Step 12:

- broker product,
- exact retry attempt counts/intervals,
- exact retention durations,
- immutable/WORM storage requirement,
- SIEM vendor/export format,
- cross-region event replication,
- public webhook/event API,
- external partner subscriptions,
- event replay operator UI,
- Agent credential provisioning,
- legal-hold workflow.

## 33. Data Model Contract checkpoint

Step 13 Data Ownership / Database Model is now complete in 'INNO-One-Data-Ownership-Database-Contract.md' and 'inno-data-model-contract.json'.

The event/audit layer now has a concrete persistence boundary:

- PostgreSQL is the production relational engine.
- Core transactional outbox/inbox/operation data lives in 'inno_core.integration'.
- Core append-only audit history lives in 'inno_core.audit'.
- Meeting owns 'inno_meeting' and writes its own local durable outbox; central audit consumes the published durable fact without a cross-database transaction.
- Reports/Search use query contracts/read models rather than direct cross-module table reads.
- Cross-module references use stable IDs without database foreign keys.
- No universal soft-delete strategy is introduced.

Next: **Step 14 Production Project Skeleton**.

## 34. Canonical integration-event catalog

Machine-readable source: `inno-event-audit-contract.json`.

| Event type | v | Producer | Phase | Subject | Payload fields |
| --- | ---: | --- | --- | --- | --- |
| `device.online` | 1 | `devices` | `active` | `device` | `deviceId`, `onlineAt`, `source` |
| `device.offline` | 1 | `devices` | `active` | `device` | `deviceId`, `offlineAt`, `lastSeenAt`, `source` |
| `remote.started` | 1 | `devices` | `active` | `remote_session` | `sessionId`, `deviceId`, `operatorUserId`, `mode`, `consentDecisionId` |
| `remote.ended` | 1 | `devices` | `active` | `remote_session` | `sessionId`, `deviceId`, `operatorUserId`, `endedAt`, `reason` |
| `remote.consent.updated` | 1 | `devices` | `active` | `remote_consent_config` | `configId`, `changeType` |
| `remote.consent.decided` | 1 | `devices` | `active` | `remote_session` | `requestId`, `sessionId`, `deviceId`, `decision`, `decidedByActorType` |
| `remote.chat.message` | 1 | `devices` | `active` | `remote_session` | `sessionId`, `messageId`, `senderActorType`, `senderId` |
| `remote.file.sent` | 1 | `devices` | `active` | `remote_session` | `sessionId`, `fileTransferId`, `deviceId`, `fileId`, `sizeBytes` |
| `remote.file.received` | 1 | `devices` | `active` | `remote_session` | `sessionId`, `fileTransferId`, `deviceId`, `fileId`, `sizeBytes` |
| `device.alert.created` | 1 | `devices` | `active` | `device_alert` | `alertId`, `deviceId`, `ruleId`, `severity`, `detectedAt` |
| `device.alert.acknowledged` | 1 | `devices` | `active` | `device_alert` | `alertId`, `acknowledgedByUserId`, `acknowledgedAt` |
| `device.alert.rule.updated` | 1 | `devices` | `active` | `device_alert_rule` | `ruleId`, `changeType` |
| `device.alert.email.sent` | 1 | `devices` | `active` | `device_alert` | `alertId`, `deliveryId`, `templateId`, `recipientCount` |
| `ticket.created` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `ticketNumber`, `requesterUserId`, `priority`, `categoryId` |
| `ticket.assigned` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `teamId`, `assigneeUserId`, `assignedByUserId` |
| `ticket.status.changed` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `fromStatus`, `toStatus`, `changedByUserId` |
| `ticket.resolved` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `resolvedByUserId`, `resolvedAt`, `resolutionCode` |
| `sla.at_risk` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `slaPolicyId`, `targetType`, `elapsedPercent`, `dueAt` |
| `sla.escalated` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `slaPolicyId`, `level`, `escalatedToType`, `escalatedToId` |
| `ticket.email.sent` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `deliveryId`, `templateId`, `recipientCount` |
| `ticket.email.failed` | 1 | `helpdesk` | `active` | `ticket` | `ticketId`, `deliveryId`, `templateId`, `failureCode`, `retryable` |
| `ticket.notification.rule.updated` | 1 | `helpdesk` | `active` | `notification_rule` | `ruleId`, `changeType` |
| `meeting.created` | 1 | `meeting` | `active` | `meeting` | `meetingId`, `createdByUserId`, `language` |
| `transcript.completed` | 1 | `meeting` | `active` | `meeting` | `meetingId`, `transcriptId`, `language`, `durationSeconds` |
| `summary.completed` | 1 | `meeting` | `active` | `meeting` | `meetingId`, `summaryId`, `templateId` |
| `workflow.published` | 1 | `workflow` | `future` | `workflow` | `workflowId`, `version`, `publishedByUserId` |
| `workflow.started` | 1 | `workflow` | `future` | `workflow_run` | `workflowId`, `runId`, `subjectType`, `subjectId` |
| `workflow.completed` | 1 | `workflow` | `future` | `workflow_run` | `workflowId`, `runId`, `result` |
| `report.created` | 1 | `reports` | `active` | `saved_report` | `reportId`, `ownerUserId`, `dataset` |
| `report.exported` | 1 | `reports` | `active` | `report_export` | `exportId`, `reportId`, `format`, `requestedByUserId`, `rowCount` |
| `asset.changed` | 1 | `assets` | `active` | `asset` | `assetId`, `changeType` |
| `baseline.drift` | 1 | `assets` | `active` | `asset` | `assetId`, `baselineId`, `driftType`, `detectedAt` |
| `license.overused` | 1 | `assets` | `active` | `software_license` | `licenseId`, `entitledSeats`, `usedSeats`, `detectedAt` |
| `contract.expiring` | 1 | `assets` | `active` | `contract` | `contractId`, `assetId`, `expiresAt`, `daysRemaining` |
| `ownership.changed` | 1 | `assets` | `active` | `asset` | `assetId`, `previousOwnerUserId`, `ownerUserId`, `effectiveAt`, `reasonCode` |
| `asset.qr.generated` | 1 | `assets` | `active` | `asset` | `assetId`, `qrLabelId`, `generatedByUserId` |
| `asset.qr.scanned` | 1 | `assets` | `active` | `asset` | `assetId`, `scanId`, `scannerUserId`, `scannerDeviceId`, `scannedAt` |

## 35. Canonical audit-action catalog

| Audit action | Module | Target | Retention class | Sensitivity |
| --- | --- | --- | --- | --- |
| `platform.user.created` | `platform` | `user` | `admin_long` | `internal` |
| `platform.user.updated` | `platform` | `user` | `admin_long` | `internal` |
| `platform.user.status_changed` | `platform` | `user` | `admin_long` | `internal` |
| `platform.organization.created` | `platform` | `organization_unit` | `admin_long` | `internal` |
| `platform.organization.updated` | `platform` | `organization_unit` | `admin_long` | `internal` |
| `platform.location.created` | `platform` | `location` | `admin_long` | `internal` |
| `platform.location.updated` | `platform` | `location` | `admin_long` | `internal` |
| `platform.position.created` | `platform` | `position` | `admin_long` | `internal` |
| `platform.position.updated` | `platform` | `position` | `admin_long` | `internal` |
| `platform.role.updated` | `platform` | `role` | `admin_long` | `restricted` |
| `platform.role.permissions_changed` | `platform` | `role` | `admin_long` | `restricted` |
| `platform.access_assignment.created` | `platform` | `access_assignment` | `admin_long` | `restricted` |
| `platform.access_assignment.updated` | `platform` | `access_assignment` | `admin_long` | `restricted` |
| `platform.access_assignment.deleted` | `platform` | `access_assignment` | `admin_long` | `restricted` |
| `platform.access_evaluated` | `platform` | `authorization_decision` | `admin_long` | `restricted` |
| `platform.app.availability_changed` | `platform` | `app_module` | `admin_long` | `internal` |
| `devices.device.updated` | `devices` | `device` | `operational_standard` | `internal` |
| `devices.group.created` | `devices` | `device_group` | `operational_standard` | `internal` |
| `devices.group.updated` | `devices` | `device_group` | `operational_standard` | `internal` |
| `devices.group.membership_changed` | `devices` | `device_group` | `operational_standard` | `internal` |
| `devices.remote.started` | `devices` | `remote_session` | `security_long` | `restricted` |
| `devices.remote.ended` | `devices` | `remote_session` | `security_long` | `restricted` |
| `devices.remote.consent_decided` | `devices` | `remote_session` | `security_long` | `restricted` |
| `devices.remote.file_transferred` | `devices` | `remote_session` | `security_long` | `restricted` |
| `devices.process.terminate` | `devices` | `device` | `security_long` | `restricted` |
| `devices.service.action` | `devices` | `device` | `security_long` | `restricted` |
| `devices.deployment.created` | `devices` | `deployment` | `operational_standard` | `internal` |
| `devices.policy.updated` | `devices` | `endpoint_policy` | `security_long` | `internal` |
| `devices.alert.acknowledged` | `devices` | `device_alert` | `operational_standard` | `internal` |
| `devices.alert_rule.created` | `devices` | `device_alert_rule` | `operational_standard` | `internal` |
| `devices.alert_rule.updated` | `devices` | `device_alert_rule` | `operational_standard` | `internal` |
| `devices.remote_consent.policy_updated` | `devices` | `remote_consent_policy` | `security_long` | `restricted` |
| `devices.remote_consent.bypass_rule_updated` | `devices` | `remote_consent_bypass_rule` | `security_long` | `restricted` |
| `assets.asset.updated` | `assets` | `asset` | `operational_standard` | `internal` |
| `assets.ownership.changed` | `assets` | `asset` | `data_access_standard` | `restricted` |
| `assets.qr.generated` | `assets` | `asset` | `operational_standard` | `internal` |
| `assets.qr.scanned` | `assets` | `asset` | `data_access_standard` | `restricted` |
| `assets.license.updated` | `assets` | `software_license` | `operational_standard` | `internal` |
| `assets.contract.updated` | `assets` | `contract` | `operational_standard` | `internal` |
| `assets.custom_fields.updated` | `assets` | `asset_custom_field` | `operational_standard` | `internal` |
| `helpdesk.ticket.created` | `helpdesk` | `ticket` | `operational_standard` | `restricted` |
| `helpdesk.ticket.replied` | `helpdesk` | `ticket` | `operational_standard` | `restricted` |
| `helpdesk.ticket.assigned` | `helpdesk` | `ticket` | `operational_standard` | `restricted` |
| `helpdesk.ticket.status_changed` | `helpdesk` | `ticket` | `operational_standard` | `restricted` |
| `helpdesk.ticket.resolved` | `helpdesk` | `ticket` | `operational_standard` | `restricted` |
| `helpdesk.sla_policy.updated` | `helpdesk` | `sla_policy` | `admin_long` | `internal` |
| `helpdesk.catalog.updated` | `helpdesk` | `category` | `admin_long` | `internal` |
| `helpdesk.status_config.updated` | `helpdesk` | `ticket_status` | `admin_long` | `internal` |
| `helpdesk.requester_group.updated` | `helpdesk` | `requester_group` | `admin_long` | `internal` |
| `helpdesk.notification_rule.updated` | `helpdesk` | `notification_rule` | `admin_long` | `internal` |
| `helpdesk.notification_template.updated` | `helpdesk` | `notification_template` | `admin_long` | `internal` |
| `helpdesk.notification_settings.updated` | `helpdesk` | `notification_settings` | `admin_long` | `internal` |
| `helpdesk.automation_rule.updated` | `helpdesk` | `automation_rule` | `admin_long` | `internal` |
| `meeting.meeting.created` | `meeting` | `meeting` | `data_access_standard` | `restricted` |
| `meeting.recording.started` | `meeting` | `meeting` | `data_access_standard` | `restricted` |
| `meeting.audio.uploaded` | `meeting` | `meeting` | `data_access_standard` | `restricted` |
| `meeting.summary.generated` | `meeting` | `meeting` | `data_access_standard` | `restricted` |
| `meeting.shared` | `meeting` | `meeting` | `data_access_standard` | `restricted` |
| `meeting.file.uploaded` | `meeting` | `meeting` | `data_access_standard` | `restricted` |
| `reports.report.created` | `reports` | `saved_report` | `data_access_standard` | `internal` |
| `reports.report.updated` | `reports` | `saved_report` | `data_access_standard` | `internal` |
| `reports.report.run` | `reports` | `report_run` | `data_access_standard` | `internal` |
| `reports.report.exported` | `reports` | `report_export` | `data_access_standard` | `restricted` |
| `security.authorization.denied` | `platform` | `authorization_decision` | `security_long` | `restricted` |


## Step 27 additive event — software inventory observed

`device.software_inventory.observed` carries only Device ID, snapshot ID, observation time, completeness, source and package count. The complete package list stays in Devices persistence and is retrieved through the owning module contract. `devices.software_inventory.observed` records the privileged ingest action in the same transaction.


## Step 28 implemented drift policy

`baseline.drift` is emitted only when an existing evidence-backed result changes between Compliant and Missing. Initial evaluation and transitions involving Unknown do not emit drift. `assets.baseline.evaluated` records the evaluation summary in the same transaction.
