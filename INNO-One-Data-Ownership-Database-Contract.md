# INNO.One — Data Ownership & Database Model Contract

**Date:** 2026-09-26  
**Status:** Implementation planning contract  
**Data Model Contract:** 0.4.0  
**Event & Audit Contract:** 0.3.0  
**API Contract:** 0.2.0  
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0  
**Scope:** Step 13 — Data Ownership / Database Model  
**Backend implementation:** Not started by this document

## 1. Purpose

This contract converts the final-frozen UI, API, permission and event/audit boundaries into a production data-ownership model.

It freezes:

- the relational database engine,
- physical/logical database boundaries,
- module schemas,
- entity/table ownership,
- cross-module reference rules,
- primary/public identifier strategy,
- optimistic-concurrency storage,
- outbox/inbox/operation storage,
- audit storage,
- read-model ownership,
- JSONB boundaries,
- deletion/archival strategy,
- migration ownership,
- indexing principles,
- object-storage boundary,
- Keycloak/MeshCentral persistence boundaries.

The machine-readable source is 'inno-data-model-contract.json'.

## 2. Database engine decision

INNO.One v1 uses **PostgreSQL** as the production relational database engine.

The exact supported major version is selected at deployment time; the product contract is PostgreSQL rather than a specific major release.

Reasons:

- strong ACID transactions for the modular-monolith core,
- native schema separation for module ownership,
- recursive CTE support for Organization / Location / Category hierarchies,
- JSONB for bounded extensible configuration while retaining relational ownership,
- partial and GIN indexes where query behavior justifies them,
- good fit for transactional outbox, inbox/dedupe and append-only audit data,
- straightforward migration ownership per module.

This decision supersedes the earlier deferred “exact database engine” item in the Architecture Contract.

## 3. Physical database topology

Initial production topology:

~~~text
PostgreSQL Cluster
│
├── inno_core
│   ├── platform
│   ├── devices
│   ├── assets
│   ├── helpdesk
│   ├── reports
│   ├── integration
│   ├── audit
│   └── readmodel
│
├── inno_meeting
│   ├── meeting
│   └── integration
│
└── keycloak
    └── owned by Keycloak
~~~

MeshCentral owns its own persistence and is treated as an external engine.

INNO.One application code must never query MeshCentral persistence directly.

## 4. Why Meeting has its own database

Meeting already has a valid separately deployable processing boundary because:

- recording/audio workloads differ from ordinary CRUD,
- transcription/summary jobs are long-running,
- large media belongs outside the relational core,
- Meeting may use a runtime stack different from the .NET Platform API,
- future independent scaling should not require extracting tables from the modular monolith.

Therefore:

~~~text
Platform API modules -> inno_core
Meeting service       -> inno_meeting
~~~

No cross-database transaction is allowed.

Meeting references Platform User IDs as opaque cross-database IDs.

## 5. Database ownership rule

Each table has exactly one owning module.

Only the owner may mutate it.

Allowed:

~~~text
Devices module -> devices.devices
Assets module  -> assets.assets
Helpdesk       -> helpdesk.tickets
~~~

Forbidden:

~~~text
Helpdesk UPDATE devices.devices
Assets SELECT * FROM platform.user_profiles as business logic
Reports JOIN helpdesk.tickets directly in production code
Meeting FK -> inno_core.platform.user_profiles
~~~

Cross-module reads use:

- API/query contract,
- authorization-aware read model,
- integration-event-fed projection where justified.

## 6. Schema ownership

### platform

Owns canonical shared business identity and authorization data:

- User Profile
- Organization Unit
- Location
- Position
- Role
- Permission
- Access Assignment
- App Module registry state
- user notifications
- recent-activity read model

Keycloak credentials are not stored here.

### devices

Owns:

- Device
- MeshCentral/external mapping
- inventory snapshot
- Device Group membership
- remote session
- consent configuration/decisions
- discovery
- inventory query execution
- deployment/maintenance
- endpoint policy/compliance
- alerts/channels/history

### assets

Owns:

- Asset
- ownership history/submission
- custom fields
- QR label/scan metadata
- software baseline/license
- contract/warranty

### helpdesk

Owns:

- Ticket
- replies/attachments
- assignment/status history
- SLA
- Category / Status / Requester Group
- business calendar
- notification config/delivery
- Knowledge Base
- automation rules/execution history

### reports

Owns:

- saved report definition
- report run metadata
- report export metadata

Reports does not own source business data.

### integration

Owns shared infrastructure records inside each database:

- asynchronous operation state,
- transactional outbox,
- consumer inbox/dedupe.

### audit

Owns append-only core audit records.

### readmodel

Owns rebuildable cross-module projections for:

- global search,
- Workspace attention,
- Workspace continue/recent support.

These projections are never authoritative sources of business state.

### meeting

Owns Meeting service data in 'inno_meeting'.

## 7. Identifier strategy

Database primary keys use PostgreSQL 'uuid'.

Generation happens in application/service code before insert so an ID is available for:

- audit,
- outbox event,
- relationships inside the same transaction.

Public APIs expose stable opaque identifiers and may serialize them with resource prefixes such as:

~~~text
dev_...
ticket_...
asset_...
user_...
meeting_...
~~~

The database primary key remains UUID.

Business/display identifiers remain separate unique columns where needed:

~~~text
employee_id
ticket_number
asset_tag
organization code
location code
~~~

Never use a mutable display identifier as the primary key.

## 8. Cross-module references

Cross-module references store the owning resource's stable ID but **do not create a database FK**.

Example:

~~~text
devices.devices.owner_user_id
    -> logical reference to platform.user_profiles
    -> NO cross-schema FK

helpdesk.tickets.related_device_id
    -> logical reference to devices.devices
    -> NO cross-schema FK
~~~

Why:

- preserves module extraction,
- avoids migration coupling,
- prevents one module from relying on another module's physical schema,
- aligns with API/Event contracts.

The owning module validates the relationship through the appropriate contract/read model when required.

Within one module/schema, normal database foreign keys are allowed and expected where aggregate relationships are stable.

## 9. Cross-database references

Cross-database FK constraints are forbidden.

Meeting fields such as:

~~~text
created_by_user_id
assignee_user_id
shared_with_user_id
~~~

contain Platform User IDs as opaque values only.

Consistency is maintained through application validation and events/read models.

## 10. Concurrency and ETag

Mutable entities use an explicit:

~~~text
version bigint not null
~~~

The API ETag serializes this version.

Conceptual update:

~~~sql
UPDATE ...
SET ..., version = version + 1
WHERE id = @id
  AND version = @expected_version;
~~~

Zero updated rows means stale state and maps to:

~~~text
HTTP 412 PRECONDITION_FAILED
~~~

Do not use a hidden database implementation detail as the public concurrency contract.

## 11. Timestamp policy

Use PostgreSQL:

~~~text
timestamptz
~~~

Store canonical timestamps in UTC.

Mutable entities normally have:

~~~text
created_at
updated_at
~~~

History/event-style entities use semantic timestamps such as:

~~~text
occurred_at
effective_at
assigned_at
resolved_at
detected_at
~~~

The UI converts these values to the user's local display timezone.

## 12. No universal soft delete

INNO.One does **not** add 'is_deleted' to every table.

Rules:

### Master data

Prefer:

~~~text
status
archived_at
~~~

when historical identity must remain.

### Operational resources

Use domain lifecycle status and 'archived_at' only when the domain requires archival.

### Immutable history

Normal CRUD cannot delete/update:

- audit records,
- ownership history,
- ticket assignment/status history,
- consent decision history.

Retention policy owns later archival/purge.

### Read models

Read models are rebuildable and may be truncated/rebuilt.

### Transient execution data

Retention-managed results may be hard-deleted after policy expiry.

## 13. JSONB policy

JSONB is allowed, but only within bounded areas.

Good uses:

- integration-event payload,
- safe audit metadata/change details,
- saved report filters/grouping,
- automation-rule conditions/actions,
- extension metadata not worthy of first-class relational columns.

Bad uses:

- storing a whole Device/User/Ticket object in another module,
- canonical many-to-many relationships,
- access/refresh tokens,
- passwords/secrets,
- large files/audio,
- replacing a clearly relational model just to avoid migrations.

GIN/index JSONB only for proven query workloads.

## 14. Binary/object data

Relational PostgreSQL stores metadata only for:

- Helpdesk attachments,
- Meeting recording/audio/files,
- Report exports.

Binary content goes to object storage.

Database fields should contain:

- object/storage key,
- safe original filename,
- content type,
- size,
- checksum,
- lifecycle/status metadata.

Never expose the raw storage path as the business/public resource ID.

## 15. Keycloak persistence boundary

Keycloak owns:

- credentials,
- password state,
- identity-provider federation state,
- sessions/tokens,
- Keycloak internal client/realm data.

INNO.One stores only the mapping:

~~~text
platform.user_profiles.keycloak_subject
~~~

INNO.One modules must not read Keycloak tables.

Authentication integration uses Keycloak protocols/API.

## 16. MeshCentral persistence boundary

MeshCentral remains an external engine.

Devices stores a provider mapping such as:

~~~text
device_id
provider = meshcentral
external_id = <node-id>
~~~

The rest of INNO.One refers to the canonical INNO.One Device ID.

No INNO.One module may directly join/query the MeshCentral datastore.

## 17. Core infrastructure tables

### integration.operations

Stores async-operation lifecycle for Step 11 operation APIs.

Key fields conceptually:

~~~text
operation_id
operation_type
origin_module
subject_type
subject_id
requested_by_actor_type
requested_by_actor_id
permission_context
status
progress
result_ref
error_code
created_at
updated_at
expires_at
~~~

### integration.outbox_messages

Transactional Event/Audit Contract outbox.

Important indexes:

~~~text
(status, next_attempt_at, occurred_at)
event_id unique
~~~

### integration.inbox_messages

Consumer dedupe:

~~~text
consumer
event_id
processed_at
result
~~~

Primary/unique key:

~~~text
(consumer, event_id)
~~~

### audit.audit_records

Append-only audit history.

Important indexes:

~~~text
occurred_at desc
(actor_type, actor_id, occurred_at desc)
(target_type, target_id, occurred_at desc)
(action, occurred_at desc)
correlation_id
~~~

## 18. Meeting outbox/audit rule

'inno_meeting' cannot participate in a transaction with 'inno_core'.

Therefore a Meeting mutation:

~~~text
Meeting DB transaction
├─ update meeting data
└─ append Meeting outbox record
       │
       COMMIT
       │
       ▼
dispatcher
       │
       ├─ integration event consumers
       └─ central audit projection
~~~

This preserves durable audit/event facts without distributed transactions.

## 19. Read-model rule

Cross-module lists/search/report projections are read models, not source tables.

Examples:

- Global Search
- Workspace Attention
- Workspace Continue
- future cross-module reporting projections

Rules:

- projection may lag,
- projection can be rebuilt,
- writes never target projections as canonical business writes,
- authorization still applies to query results.

## 20. Report data access

Reports may use:

1. module query contracts,
2. dedicated authorized read models,
3. event-fed projections.

Reports must not directly join business tables from other modules as a shortcut.

This keeps ownership boundaries intact.

## 21. EF Core / migration ownership

Initial .NET modular-monolith direction:

~~~text
PlatformDbContext       -> platform
DevicesDbContext        -> devices
AssetsDbContext         -> assets
HelpdeskDbContext       -> helpdesk
ReportsDbContext        -> reports
InfrastructureDbContext -> integration / audit / readmodel
~~~

Meeting service owns its own migrations for 'inno_meeting'.

Rules:

- a module migration cannot alter another module's table,
- shared deployment orders module migrations explicitly,
- production changes follow expand -> backfill -> contract where needed,
- no manual production schema editing as normal release procedure.

## 22. Indexing rules

Index:

- all same-module FK columns used by joins,
- cross-module opaque IDs used by filters/scope checks,
- queue/list status + sort columns,
- resource + timestamp columns for histories,
- unique business identifiers,
- outbox/inbox processing keys.

Do not:

- index every column,
- GIN every JSONB column,
- create indexes only because a field appears on a detail screen.

Indexes follow actual list/filter/sort workloads from the frozen UI/API.

## 23. Critical initial indexes

Examples frozen as planning targets:

~~~text
platform.user_profiles(keycloak_subject) UNIQUE
platform.organization_units(parent_unit_id, status)

devices.devices(connectivity_state, organization_unit_id, last_seen_at)
devices.device_external_mappings(provider, external_id) UNIQUE
devices.device_group_members(group_id, device_id) UNIQUE
devices.device_alerts(status, severity, detected_at DESC)

assets.assets(asset_tag) UNIQUE
assets.assets(owner_user_id, lifecycle_status)

helpdesk.tickets(status_id, priority, created_at DESC)
helpdesk.tickets(assignee_user_id, status_id, updated_at DESC)

integration.outbox_messages(status, next_attempt_at, occurred_at)
integration.inbox_messages(consumer, event_id) UNIQUE

audit.audit_records(occurred_at DESC)
audit.audit_records(actor_type, actor_id, occurred_at DESC)
audit.audit_records(target_type, target_id, occurred_at DESC)
~~~

## 24. Tree/hierarchy data

Organization Unit, Location and Helpdesk Category use self-referencing parent IDs inside their owning schema.

Examples:

~~~text
platform.organization_units.parent_unit_id
platform.locations.parent_location_id
helpdesk.categories.parent_category_id
~~~

Use recursive CTE/query patterns for Tree/TreeGrid API results.

Do not store hierarchy as display indentation or serialized HTML.

Closure tables/materialized-path optimization may be introduced later only if real scale requires it.

## 25. Device Group membership

Static/dynamic membership resolves into:

~~~text
devices.device_group_members
~~~

This provides a stable query target for:

- Access Scope evaluation,
- Device Group detail,
- policy assignment,
- deployment target resolution.

Dynamic-rule definitions remain on the Device Group configuration, while the resolved membership table reflects current effective membership.

Membership changes affecting authorization emit/audit the appropriate Step 12 facts.

## 26. Permission data

Permissions are normalized:

~~~text
platform.permissions
platform.roles
platform.role_permissions
platform.access_assignments
platform.access_assignment_actions
~~~

Do not store a comma-separated permission string on User.

Access Assignment owns:

- subject,
- role,
- scope type,
- scope resource IDs/association,
- includeChildren behavior,
- status.

For scopes requiring multiple resources, use relational assignment-resource rows in implementation rather than an unindexed JSON array when the query path is authorization-critical.

## 27. Sensitive configuration

Do not place secrets in business configuration tables.

Examples excluded:

- SMTP password
- Keycloak client secret
- MeshCentral credential
- API keys
- signing private keys

Configuration tables store only non-secret settings and a secret reference if needed.

Secrets live in deployment secret management.

## 28. Multi-tenancy

INNO.One v1 does **not** introduce a generic SaaS 'tenant_id'.

An Organization Unit is a business hierarchy element, not a tenant boundary.

If future deployments need true multi-tenancy, create a dedicated tenancy contract before adding tenant IDs to production data.

This avoids mixing organization hierarchy with security tenant isolation.

## 29. Security model at database level

Primary authorization remains:

~~~text
API permission + scope evaluation
~~~

PostgreSQL Row Level Security is not the primary v1 authorization mechanism.

Why:

- authorization spans Organization, Device Group and multiple modules,
- business decisions need explainability for Evaluate Access,
- API contract already owns permission/scope semantics.

RLS may later add defense-in-depth for selected tables after the authorization model is stable.

## 30. Backup and restore boundary

Backup/restore policy must treat ownership boundaries explicitly.

At minimum:

- 'inno_core' backed up consistently,
- 'inno_meeting' backed up independently,
- object storage lifecycle/backup aligns with metadata,
- Keycloak database backed up under Keycloak operations,
- MeshCentral backup follows vendor-engine operations.

Restore testing must include outbox/inbox consistency and not replay published messages unintentionally.

Exact RPO/RTO values remain deployment/operations requirements.

## 31. Table-count baseline

Current planning catalog:

~~~text
inno_core
  platform      13
  devices       27
  assets        13
  helpdesk      20
  reports        3
  integration    3
  audit          1
  readmodel      3
                --
                83 tables

inno_meeting
  meeting        9
                --
Total planning catalog: 92 tables
~~~

These are logical production tables, not a requirement to create every table on day one.

Implementation should create tables by vertical slice/module migration while preserving the frozen ownership map.

## 32. Step 13 decisions frozen

1. Production relational engine is PostgreSQL.
2. Core modular-monolith data uses 'inno_core'.
3. Meeting owns separate 'inno_meeting'.
4. Keycloak owns its own database.
5. MeshCentral persistence is external and never queried directly by INNO.One.
6. Core module schemas are platform/devices/assets/helpdesk/reports.
7. Integration/audit/readmodel are infrastructure-owned schemas.
8. Database PKs use UUID; API identifiers remain opaque.
9. Cross-module/cross-database references do not use DB foreign keys.
10. Same-module relationships use normal DB constraints where appropriate.
11. Mutable resources use explicit bigint version for ETag concurrency.
12. No universal soft-delete column.
13. JSONB is bounded; core relationships remain relational.
14. Binary/audio/export contents live in object storage.
15. Cross-module events use database-local transactional outbox.
16. Audit is append-only; Meeting projects audit through its durable outbox.
17. Each module owns its migrations/DbContext.
18. Reports/Search use read models/query contracts rather than direct cross-module table access.
19. v1 is not generic SaaS multi-tenant.
20. PostgreSQL RLS is not the primary v1 authorization layer.

## 33. Deferred data decisions

Not frozen in Step 13:

- exact PostgreSQL major release,
- cloud/managed PostgreSQL vendor,
- exact RPO/RTO,
- concrete retention durations,
- table partitioning thresholds,
- read-replica strategy,
- PgBouncer/pooling topology,
- object-storage provider,
- field-level encryption requirements,
- archival/WORM tier,
- full-text search engine vs PostgreSQL projection,
- data warehouse/analytics platform.

## 34. Production Skeleton checkpoint

Step 14 Production Project Skeleton is now complete under 'production/'.

The data contract now has buildable DbContext/migration ownership boundaries for Platform, Devices, Assets, Helpdesk, Reports, shared infrastructure, Meeting and Meeting integration. Local PostgreSQL bootstrap creates the frozen databases/schemas, while business tables remain intentionally ungenerated until vertical slices implement real aggregates.

Next: **Step 15 First Vertical Slice**.

## 35. Canonical table ownership catalog

Machine-readable source: 'inno-data-model-contract.json'.

### inno_core.platform

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'user_profiles' | 'entity' | Canonical INNO.One business profile mapped to Keycloak subject | — |
| 'organization_units' | 'entity' | Organization hierarchy | — |
| 'locations' | 'entity' | Location hierarchy | — |
| 'positions' | 'entity' | Position master | — |
| 'roles' | 'entity' | Reusable role definitions | — |
| 'permissions' | 'entity' | Canonical permission catalog | — |
| 'role_permissions' | 'join' | Role-to-permission membership | — |
| 'access_assignments' | 'entity' | Role + scoped assignment to a subject | — |
| 'access_assignment_resources' | 'join' | Concrete scoped resource rows for an access assignment | — |
| 'access_assignment_actions' | 'join' | Optional action narrowing for an access assignment | — |
| 'app_modules' | 'entity' | App registry availability/configuration | — |
| 'notifications' | 'entity' | User-targeted platform notification records | user_id -> platform.user_profiles (same-module) |
| 'activity_items' | 'read-model' | Workspace recent-activity read model | — |

### inno_core.devices

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'devices' | 'entity' | Canonical INNO.One managed device | owner_user_id -> platform.user_profiles (cross-module), organization_unit_id -> platform.organization_units (cross-module), location_id -> platform.locations (cross-module) |
| 'device_external_mappings' | 'entity' | Vendor engine identifiers for a device | — |
| 'device_inventory_snapshots' | 'entity' | Last/current normalized inventory snapshot | — |
| 'device_groups' | 'entity' | Static/dynamic device groups | — |
| 'device_group_members' | 'join' | Resolved group membership | — |
| 'remote_sessions' | 'entity' | Remote support session lifecycle | operator_user_id -> platform.user_profiles (cross-module) |
| 'remote_consent_policies' | 'entity' | Global/default remote consent policy | — |
| 'remote_consent_messages' | 'entity' | Localized consent prompt text | — |
| 'remote_consent_bypass_rules' | 'entity' | Scoped consent bypass configuration | — |
| 'remote_consent_decisions' | 'history' | Immutable consent decision history | — |
| 'discovery_scans' | 'entity' | Network discovery execution | — |
| 'discovery_results' | 'entity' | Discovered endpoint candidates | — |
| 'inventory_queries' | 'entity' | Saved inventory query definitions | — |
| 'inventory_query_runs' | 'entity' | Inventory query executions | — |
| 'inventory_query_results' | 'read-model' | Materialized query run results | — |
| 'deployment_jobs' | 'entity' | Deployment command/job | — |
| 'deployment_items' | 'entity' | Per-target deployment result | — |
| 'agent_rollouts' | 'entity' | Agent rollout/update job | — |
| 'maintenance_jobs' | 'entity' | Software/restart/screenshot/wake maintenance jobs | — |
| 'maintenance_items' | 'entity' | Per-target maintenance result | — |
| 'endpoint_policies' | 'entity' | Managed endpoint policy definitions | — |
| 'policy_assignments' | 'entity' | Policy-to-scope assignments | — |
| 'policy_compliance' | 'read-model' | Latest/device compliance result | — |
| 'device_alerts' | 'entity' | Raised device alerts | — |
| 'device_alert_rules' | 'entity' | Alert rule definitions | — |
| 'alert_channels' | 'entity' | Alert delivery channel configuration | — |
| 'alert_delivery_history' | 'history' | Alert notification delivery history | — |

### inno_core.assets

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'assets' | 'entity' | Canonical asset inventory record | owner_user_id -> platform.user_profiles (cross-module), organization_unit_id -> platform.organization_units (cross-module), location_id -> platform.locations (cross-module), linked_device_id -> devices.devices (cross-module) |
| 'asset_ownership_history' | 'history' | Immutable ownership change history | — |
| 'ownership_submissions' | 'entity' | Ownership confirmation/submission queue | user_id -> platform.user_profiles (cross-module) |
| 'custom_field_definitions' | 'entity' | Asset custom-field schema | — |
| 'custom_field_values' | 'entity' | Typed/custom asset values | — |
| 'qr_labels' | 'entity' | Opaque/signed QR label metadata | — |
| 'qr_scans' | 'history' | Auditable QR scan events | scanner_user_id -> platform.user_profiles (cross-module) |
| 'software_baselines' | 'entity' | Software baseline definitions | — |
| 'baseline_results' | 'read-model' | Asset/device baseline comparison results | — |
| 'software_licenses' | 'entity' | Software license entitlement | — |
| 'license_allocations' | 'entity' | License allocation/usage detail | — |
| 'contracts' | 'entity' | Contract/warranty records | — |
| 'asset_contract_links' | 'join' | Asset-to-contract relationship | — |

### inno_core.helpdesk

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'tickets' | 'entity' | Canonical support ticket | requester_user_id -> platform.user_profiles (cross-module), assignee_user_id -> platform.user_profiles (cross-module), requester_organization_unit_id -> platform.organization_units (cross-module), related_device_id -> devices.devices (cross-module), related_asset_id -> assets.assets (cross-module) |
| 'ticket_replies' | 'entity' | Ticket conversation entries | author_user_id -> platform.user_profiles (cross-module) |
| 'ticket_attachments' | 'entity' | Attachment metadata; binary stored externally | — |
| 'ticket_assignments' | 'history' | Immutable assignment history | — |
| 'ticket_status_history' | 'history' | Immutable status transition history | — |
| 'sla_policies' | 'entity' | SLA policy definitions | — |
| 'ticket_sla' | 'entity' | Resolved SLA targets/state per ticket | — |
| 'categories' | 'entity' | Hierarchical ticket categories | — |
| 'statuses' | 'entity' | Ticket status configuration | — |
| 'requester_groups' | 'entity' | Requester group configuration | — |
| 'requester_group_members' | 'join' | Resolved requester group members | user_id -> platform.user_profiles (cross-module) |
| 'business_calendar' | 'entity' | Business-calendar header/configuration | — |
| 'business_calendar_entries' | 'entity' | Working day/holiday/time window entries | — |
| 'notification_rules' | 'entity' | Helpdesk notification rules | — |
| 'notification_templates' | 'entity' | Notification templates | — |
| 'notification_deliveries' | 'history' | Email/notification delivery records | — |
| 'notification_settings' | 'entity' | Helpdesk notification/global delivery settings | — |
| 'knowledge_articles' | 'entity' | Knowledge base articles | — |
| 'automation_rules' | 'entity' | Helpdesk automation rule definitions | — |
| 'automation_executions' | 'history' | Automation execution history | — |

### inno_core.reports

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'saved_reports' | 'entity' | Saved report definitions | owner_user_id -> platform.user_profiles (cross-module) |
| 'report_runs' | 'entity' | Report execution metadata | — |
| 'report_exports' | 'entity' | Generated export metadata; binary stored externally | — |

### inno_core.integration

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'operations' | 'entity' | Shared async-operation status and authorization origin | — |
| 'outbox_messages' | 'entity' | Transactional integration-event outbox | — |
| 'inbox_messages' | 'entity' | Consumer/event dedupe state | — |

### inno_core.audit

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'audit_records' | 'append-only' | Append-only audit history | — |

### inno_core.readmodel

| Table | Kind | Purpose | Cross-module references |
| --- | --- | --- | --- |
| 'search_documents' | 'read-model' | Authorization-filterable global-search projection | — |
| 'workspace_attention' | 'read-model' | Workspace attention projection | — |
| 'workspace_continue' | 'read-model' | Workspace continue-work projection | — |

### inno_meeting.meeting

| Table | Kind | Purpose | Cross-database references |
| --- | --- | --- | --- |
| 'meetings' | 'entity' | Canonical meeting record | created_by_user_id -> platform.user_profiles (cross-database) |
| 'recordings' | 'entity' | Recording metadata; binary in object storage | — |
| 'transcripts' | 'entity' | Transcript metadata/content reference | — |
| 'summaries' | 'entity' | Generated meeting summary metadata/content reference | — |
| 'meeting_participants' | 'entity' | Meeting participants and speaker/time share metadata | user_id -> platform.user_profiles (cross-database) |
| 'action_items' | 'entity' | Meeting action items | assignee_user_id -> platform.user_profiles (cross-database) |
| 'meeting_files' | 'entity' | Attached file metadata; binary in object storage | — |
| 'shares' | 'entity' | Meeting share/access records | shared_with_user_id -> platform.user_profiles (cross-database) |
| 'processing_jobs' | 'entity' | Transcription/summary/export processing state | — |

## 36. Contract source files

- 'INNO-One-Data-Ownership-Database-Contract.md' — human-readable data ownership contract.
- 'inno-data-model-contract.json' — machine-readable ownership/table/index/migration contract.
- 'data-model-contract-audit.py' — regression guard for Step 13.
