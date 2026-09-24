# INNO.One — Database Plan

**Status:** Planning contract  
**Date:** 2026-09-25  
**Recommended primary database:** PostgreSQL  
**Implementation:** Not started

## 1. Database strategy

Use one PostgreSQL database initially with **schema ownership per module**.

```
inno_one
  ├─ core
  ├─ devices
  ├─ assets
  ├─ helpdesk
  ├─ meeting
  └─ reports
```

Benefits:
- one operational database/deployment initially,
- local transactions within a module,
- clear ownership,
- independent EF Core migrations per module,
- later extraction remains possible.

Schema ownership is a logical boundary, not permission to join/write anything from anywhere.

## 2. Module persistence rules

1. A module writes only tables in its schema.
2. Cross-module IDs may be stored as references.
3. Cross-schema foreign keys are avoided for business-module references unless there is a strong platform-level reason.
4. Cross-module validation uses application/query contracts.
5. Reports uses projections/read models rather than arbitrary joins from controllers.
6. Provider IDs live in mapping/infrastructure tables.
7. Blobs live in object storage.
8. Secrets live in secret/configuration storage, not normal business tables.
9. All tenant-owned records include `organization_id`.
10. All mutable records include created/updated timestamps and an optimistic-concurrency mechanism where needed.

## 3. ID strategy

Preferred:
- UUID generated server-side.
- UUIDv7 when supported consistently by the production .NET/PostgreSQL stack, otherwise standard random UUID.

Human-facing IDs are separate unique columns.

Examples:
- `ticket_id UUID`
- `ticket_number VARCHAR(32)` = `HD-001048`
- `asset_id UUID`
- `asset_number VARCHAR(64)` = `AST-PC-000142`

Never use a provider ID as a primary key.

## 4. Core schema

### `core.organizations`

Key columns:
- organization_id PK
- code
- name
- status
- default_time_zone
- created_at
- updated_at

### `core.organization_units`

- organization_unit_id
- organization_id
- parent_id nullable
- code
- name
- unit_type
- status
- path/depth optional projection

Index:
- organization_id,
- parent_id.

### `core.locations`

- location_id
- organization_id
- name
- code
- status

### `core.teams`

- team_id
- organization_id
- name
- code
- status

### `core.users`

- user_id
- organization_id
- external_subject unique within identity provider
- email
- display_name
- status
- locale
- time_zone
- created_at
- updated_at

Indexes:
- unique(external_subject),
- organization_id + email.

### `core.groups`
### `core.group_memberships`

For identity/application grouping.

### `core.roles`
### `core.permissions`
### `core.role_permissions`
### `core.role_assignments`

Role assignment columns:
- assignment_id
- organization_id
- principal_type
- principal_id
- role_id
- access_scope_id
- active
- valid_from/to optional.

### `core.access_scopes`

- access_scope_id
- organization_id
- name
- scope_type
- include_children
- status

### `core.access_scope_resources`

- access_scope_id
- resource_type
- resource_id

Resource ID may refer to an OrganizationUnit/Location/DeviceGroup through an explicit scope resolver.

### `core.module_installations`

- module_id PK
- installed_version
- installed
- enabled
- health_status
- configuration_json
- installed_at
- updated_at

Do not store secret values directly in `configuration_json`.

### `core.user_module_preferences`

- user_id
- module_id
- pinned
- sort_order.

### `core.user_preferences`

- user_id
- locale
- time_zone
- table_density
- notification preferences JSONB if small and user-owned.

### `core.notifications`

- notification_id
- organization_id
- user_id
- type
- title
- body
- deep_link
- read_at
- created_at
- expires_at

Indexes:
- user_id + read_at + created_at desc.

### `core.audit_entries`

Append-only.

Columns:
- audit_id
- organization_id
- actor_user_id
- action
- module
- target_type
- target_id
- correlation_id
- metadata_json
- occurred_at

Partitioning may be introduced later based on volume/retention.

## 5. Devices schema

### `devices.devices`

- device_id PK
- organization_id
- computer_name
- display_name
- device_type
- os_name
- os_version
- serial_number
- status
- last_seen_at
- agent_version
- primary_user_id
- location_id
- inventory_summary_json optional
- created_at
- updated_at
- version/concurrency token

Indexes:
- organization_id + status,
- organization_id + computer_name,
- serial_number where not null,
- last_seen_at.

### `devices.device_provider_mappings`

- device_id
- provider
- provider_device_id
- provider_group_id nullable
- provider_metadata_json
- synchronized_at

Unique:
- provider + provider_device_id.

This is the only place that should know the MeshCentral node identifier as a mapping key.

### `devices.device_groups`
### `devices.device_group_memberships`

Group:
- type static/dynamic,
- query_id optional.

Membership unique:
- group_id + device_id.

### `devices.device_queries`

- query_id
- organization_id
- name
- scope_json
- match_logic
- conditions_json
- created_by
- updated_at

Conditions may start in JSONB while the rule grammar is small; move to normalized rows if query editing/reporting demands it.

### `devices.remote_sessions`

- remote_session_id
- organization_id
- device_id
- requested_by
- mode
- status
- provider_session_id
- requested_at
- started_at
- ended_at
- end_reason
- metadata_json

Indexes:
- device_id + started_at desc,
- requested_by + started_at desc,
- active status partial index.

### `devices.remote_consent_policies`
### `devices.remote_consent_rules`
### `devices.remote_consent_decisions`
### `devices.remote_consent_message_templates`

Decision history is immutable.

### `devices.device_alerts`

- alert_id
- organization_id
- rule_id
- device_id nullable
- severity
- alert_type
- title
- status
- evidence_json
- detected_at
- acknowledged_by
- acknowledged_at
- resolved_at

Indexes:
- organization_id + status + severity,
- device_id + detected_at desc,
- detected_at desc.

### `devices.device_alert_rules`

- rule_id
- organization_id
- name
- rule_type
- severity
- scope_ref_json
- configuration_json
- enabled
- updated_at
- version

### `devices.alert_channel_settings`

One organization-level settings record initially.

### Job tables

- `devices.deployment_jobs`
- `devices.deployment_job_items`
- `devices.agent_rollouts`
- `devices.agent_rollout_items`
- `devices.software_maintenance_jobs`
- `devices.software_maintenance_items`
- `devices.restart_jobs`
- `devices.restart_job_items`

Common columns:
- job ID,
- organization,
- status,
- requested_by,
- requested_at,
- started_at,
- completed_at,
- target definition JSON/reference,
- options JSON,
- retry count,
- failure code/message.

Per-device items:
- job ID,
- device ID,
- status,
- attempt,
- started/completed,
- provider result metadata.

### `devices.software_packages`
### `devices.agent_releases`

Payload binaries live in object storage/package repository.

### `devices.endpoint_policies`
### `devices.endpoint_policy_assignments`
### `devices.endpoint_policy_exceptions`

Policy configuration may use typed JSONB per policy type initially, but every policy has common identity/version/assignment columns.
## 6. Assets schema

### `assets.assets`

- asset_id
- organization_id
- asset_number
- asset_type
- brand
- model
- serial_number
- status
- purchase_date
- location_id
- linked_device_id nullable
- created_at
- updated_at
- version

Unique:
- organization_id + asset_number.

Indexes:
- status,
- asset_type,
- linked_device_id,
- serial_number.

### `assets.asset_assignments`

- assignment_id
- asset_id
- user_id
- assignment_type
- assigned_at
- returned_at
- notes
- created_by

Only one active primary assignment per asset if business rules require it.

### `assets.ownership_submissions`

- submission_id
- asset_id
- proposed_user_id
- source_surface
- status
- submitted_at
- reviewed_by
- reviewed_at
- evidence_json

### `assets.custom_field_definitions`

- field_id
- organization_id
- key
- label
- value_type
- options_json
- required
- active
- sort_order

### `assets.custom_field_values`

- asset_id
- field_id
- value_text/value_number/value_date/value_json

Use one typed strategy consistently; do not hide all business fields in one unstructured JSON object.

### `assets.qr_tokens`

- qr_token_id
- asset_id
- token_hash
- status
- issued_by
- issued_at
- revoked_at
- last_scanned_at optional

Unique:
- token_hash.

The raw token is returned once for label generation, then discarded.

### `assets.software_licenses`

- license_id
- organization_id
- product_name
- vendor
- license_type
- purchased_seats
- assigned_seats
- start_date
- expiry_date
- cost
- currency
- status

### `assets.software_license_assignments`

Optional normalized assignment rows.

### `assets.contracts`

- contract_id
- organization_id
- contract_number
- vendor
- contract_type
- start_date
- end_date
- status
- cost/currency
- metadata_json

## 7. Helpdesk schema

### `helpdesk.tickets`

- ticket_id
- organization_id
- ticket_number
- subject
- description
- requester_user_id
- assignee_user_id
- assigned_team_id
- category_id
- status_id
- priority
- impact
- urgency
- related_device_id nullable
- related_asset_id nullable
- created_at
- updated_at
- resolved_at
- closed_at
- version

Indexes:
- organization_id + status_id + priority,
- assignee_user_id + status_id,
- assigned_team_id + status_id,
- requester_user_id + created_at desc,
- related_device_id,
- related_asset_id,
- created_at desc.

### `helpdesk.ticket_messages`

- message_id
- ticket_id
- author_user_id
- message_type public/internal/system
- body
- created_at

### `helpdesk.ticket_attachments`

- attachment_id
- ticket_id
- object_key
- file_name
- mime_type
- size_bytes
- sha256
- uploaded_by
- created_at

### `helpdesk.ticket_activity`

Business timeline projection:
- activity_id,
- ticket_id,
- event_type,
- actor,
- summary,
- metadata,
- occurred_at.

This is not a replacement for core.audit_entries.

### `helpdesk.categories`

- category_id
- parent_id
- name
- code
- default_team_id
- default_sla_policy_id
- active
- sort_order

### `helpdesk.status_definitions`

- status_id
- name
- semantic_type
- color_token
- terminal
- pause_sla
- sort_order
- active

### `helpdesk.requester_groups`

- requester_group_id
- name
- match_logic
- conditions_json
- active

### `helpdesk.sla_policies`

- sla_policy_id
- name
- active
- calendar_id
- applicability_json
- first_response_seconds
- resolution_seconds
- escalation_json
- version

### `helpdesk.ticket_sla_states`

- ticket_id PK
- sla_policy_id
- first_response_due_at
- resolution_due_at
- first_response_at
- paused_at
- accumulated_pause_seconds
- at_risk_level
- breached_at
- updated_at

Business-time calculations require the calendar and policy snapshot/version used when the SLA was attached.

### `helpdesk.business_calendars`
### `helpdesk.business_calendar_hours`
### `helpdesk.business_calendar_holidays`

Store weekday/time windows in normalized rows.

### `helpdesk.notification_rules`

- rule_id
- trigger_event
- timing
- recipient_config_json
- template_id
- language
- duplicate_suppression_seconds
- enabled
- version

### `helpdesk.notification_templates`

- template_id
- name
- subject_template
- body_template
- language
- active
- version

### `helpdesk.notification_deliveries`

- delivery_id
- rule_id
- ticket_id
- recipient
- channel
- status
- attempt_count
- provider_message_id
- requested_at
- delivered_at
- failure_code/message

### `helpdesk.notification_settings`

Configuration metadata only.

Secret SMTP credentials belong in a secret provider.

### `helpdesk.knowledge_articles`

- article_id
- title
- slug
- body/content_ref
- category
- status
- author_user_id
- published_at
- updated_at

## 8. Meeting schema

### `meeting.meetings`

- meeting_id
- organization_id
- title
- scheduled_start_at
- scheduled_end_at
- language
- status
- created_by
- created_at
- updated_at

### `meeting.recordings`

- recording_id
- meeting_id
- source
- object_key
- mime_type
- duration_seconds
- size_bytes
- sha256
- captured_at
- registered_at

### `meeting.transcripts`

- transcript_id
- meeting_id
- status
- language
- content_ref or body
- provider
- provider_job_id
- started_at
- completed_at
- failure_code/message
- version

### `meeting.summaries`

- summary_id
- meeting_id
- content/body
- generator_provider
- prompt/template version
- generated_at
- version

### `meeting.action_items`

- action_item_id
- meeting_id
- summary_id
- text
- owner_user_id nullable
- due_at nullable
- status
- sort_order

### `meeting.processing_jobs`

Durable processing state independent of external AI provider job state.

## 9. Reports schema

### `reports.report_definitions`

- report_definition_id
- organization_id
- name
- dataset_key
- columns_json
- filters_json
- grouping_json
- sorting_json
- owner_user_id
- visibility
- created_at
- updated_at
- version

### `reports.report_runs`

- report_run_id
- report_definition_id nullable
- definition_snapshot_json
- requested_by
- status
- row_count
- requested_at
- started_at
- completed_at
- failure_code/message

### `reports.report_exports`

- report_export_id
- report_run_id
- format
- object_key
- status
- requested_at
- completed_at
- expires_at

### Read-model/projection tables

May be added under `reports` for cross-module analytics.

They are rebuilt/projected from module contracts/events and are not authoritative business tables.

## 10. Outbox / inbox

Preferred: each module schema has an `outbox_messages` table so business rows and outbox event participate in the same transaction.

Example:
- `devices.outbox_messages`
- `assets.outbox_messages`
- `helpdesk.outbox_messages`
- `meeting.outbox_messages`
- `core.outbox_messages`

Consumers that need idempotency maintain inbox records in their owning schema.

## 11. EF Core ownership

Use one DbContext per module boundary:

- `CoreDbContext`
- `DevicesDbContext`
- `AssetsDbContext`
- `HelpdeskDbContext`
- `MeetingDbContext`
- `ReportsDbContext`

Each context:
- maps only its schema,
- owns its migration history/migration assembly,
- must not expose another module's entities.

A reporting query is not permission to inject multiple module DbContexts into arbitrary business handlers.

## 12. Migration strategy

Initial deployment:
1. Platform Core schema,
2. Devices,
3. Assets,
4. Helpdesk,
5. Meeting,
6. Reports.

Rules:
- migrations are forward-only in production,
- destructive migration requires explicit data migration plan,
- module deployment validates compatible schema version,
- module registry records installed application version, not database truth by itself.

## 13. Retention

Define policy before production for:
- audit entries,
- remote session history,
- alert history,
- ticket attachments,
- notification delivery,
- meeting audio/transcript/summary,
- report exports,
- job execution history.

Report export files should expire automatically unless explicitly retained.

Meeting audio often requires stricter retention/privacy policy than meeting metadata.

## 14. Backup and recovery

Minimum:
- scheduled PostgreSQL backups,
- object storage versioning/backup policy,
- restore test,
- database and object storage recovery point documented together.

A database restore without matching attachment/audio objects is incomplete recovery.

## 15. Sensitive data

Do not store:
- Keycloak passwords,
- raw long-lived tokens,
- SMTP passwords in normal config tables,
- raw Asset QR token after issuance,
- provider private keys in business tables.

Encrypt/protect:
- provider credentials,
- storage credentials,
- email credentials,
- AI provider secrets.

Use secret manager/environment-backed secure configuration appropriate to deployment.

## 16. Database decisions still open

- final PostgreSQL version/hosting topology,
- exact UUID generation method,
- whether production is multi-tenant in one database or one organization per deployment,
- whether large transcript bodies stay in PostgreSQL or object storage,
- whether high-volume Device inventory snapshots require partitioning,
- whether audit table is partitioned by month.

These choices do not change module ownership defined here.
