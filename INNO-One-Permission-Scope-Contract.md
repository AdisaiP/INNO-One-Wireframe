# INNO.One — Permission & Scope Contract

**Date:** 2026-09-26  
**Status:** Implementation planning contract  
**UX/UI baseline:** Design System V1.26 / UI Contract 1.20.0  
**Scope:** Step 10 — Permission & Scope Contract  
**Backend implementation:** Not started by this document

## 1. Purpose

This contract defines how INNO.One production authorization should represent:

- application access,
- actions/permissions,
- resource scope,
- role composition,
- effective-access evaluation,
- cross-module authorization checks.

It is derived from the frozen Roles & Permissions and Access Scopes UX, plus the current module registry permission names.

## 2. Core authorization model

Authorization is resolved from separate concepts:

```text
Authenticated User
      │
      ▼
Platform User Profile
      │
      ├── Role(s)
      │     └── Permission(s)
      │
      └── Access Assignment(s)
            └── Resource Scope

Permission + Scope + Resource Context
              │
              ▼
      Effective Access Decision
```

A role answers **what actions may this user perform?**

A scope answers **where may those actions apply?**

Do not encode organization/resource scope into the permission string.

Good:

```text
devices.remote + scope=organization:head-office
```

Avoid:

```text
devices.remote.head_office
```

## 3. Permission naming convention

Canonical form:

```text
<module>.<resource-or-capability>.<action>
```

Short module-level capabilities may remain two-part when already frozen:

```text
devices.view
devices.remote
assets.view
assets.manage
meeting.view
meeting.create
reports.view
reports.create
```

Rules:

- lowercase only,
- dot-separated,
- stable semantic names,
- no UI labels in permission IDs,
- no organization names,
- no role names,
- no environment names,
- permission IDs are additive and should not be silently renamed after production use.

## 4. Existing frozen permission catalog

These names already exist in `platform-registry.js` and remain valid implementation inputs.

### Devices

```text
devices.view
devices.remote
devices.remote.collaborate
devices.remote.consent.manage
devices.alert.view
devices.alert.manage
devices.manage
devices.scope.manage
devices.policy.manage
```

### Assets

```text
assets.view
assets.manage
assets.baseline.manage
assets.license.manage
assets.contract.manage
assets.qr.print
assets.qr.scan
```

### Helpdesk

```text
helpdesk.ticket.view
helpdesk.ticket.create
helpdesk.ticket.assign
helpdesk.ticket.resolve
helpdesk.sla.manage
helpdesk.catalog.manage
helpdesk.status.manage
helpdesk.requester_group.manage
helpdesk.kb.manage
helpdesk.notifications.view
helpdesk.notifications.manage
helpdesk.reports.view
```

### Meeting

```text
meeting.view
meeting.create
meeting.record
meeting.summary.generate
meeting.share
```

### Reports

```text
reports.view
reports.create
reports.manage
reports.export.pdf
reports.export.xlsx
```

### Future modules already represented in registry

```text
workflow.view
workflow.design
workflow.publish

forms.view
forms.design
```

These remain future capabilities until their modules are enabled.

## 5. Production permission additions required by the frozen UI

The current prototype has frozen capabilities whose production permission names are not yet represented in the prototype registry. Step 10 reserves the following names for implementation without changing the frozen UI contract.

### Devices capability gap

The Access Assignment UI exposes Deploy as an explicit effective action, so production needs a distinct deploy permission rather than silently treating deployment as generic Manage.

```text
devices.deploy
```

### Platform workspace

```text
platform.workspace.access
platform.apps.view
platform.notifications.view
platform.search.use
```

### Organization

```text
admin.organization.view
admin.organization.manage
admin.locations.view
admin.locations.manage
admin.positions.view
admin.positions.manage
```

### Users

```text
admin.users.view
admin.users.manage
```

### Roles and access

```text
admin.roles.view
admin.roles.manage
admin.access_scopes.view
admin.access_scopes.manage
admin.access_scopes.evaluate
```

### Apps & Modules

```text
admin.apps.view
admin.apps.manage
```

### Platform administration reserved for future visible modules

```text
admin.integrations.view
admin.integrations.manage
admin.security.view
admin.security.manage
admin.audit.view
admin.branding.manage
admin.settings.manage
```

Reserved permissions do not make a Coming Soon surface visible by themselves. Availability/module state remains a separate product decision.

## 6. Scope model

The frozen UI exposes two related scope concepts:

### 6.1 Logical scope shorthand

Used by role/permission reasoning:

```text
own
team
org
all
```

Meaning:

- **own** — resources directly owned/requested/assigned to the subject.
- **team** — resources assigned to a team the subject belongs to.
- **org** — resources inside permitted organization boundaries.
- **all** — unrestricted within the enabled application/module.

These are logical evaluation categories, not database keys.

### 6.2 Concrete access-assignment scope types

The frozen Access Assignment editor exposes:

```text
Organization
Location
Device Group
```

Canonical implementation IDs:

```text
organization
location
device_group
```

Organization scopes may include descendants:

```text
includeChildren = true | false
```

A scope assignment therefore resembles:

```json
{
  "scopeType": "organization",
  "resourceIds": ["org-head-office"],
  "includeChildren": true
}
```

## 7. Access assignment model

Recommended production shape:

```json
{
  "assignmentId": "asg_...",
  "subjectType": "user",
  "subjectId": "user_...",
  "roleId": "support_agent",
  "scope": {
    "type": "organization",
    "resourceIds": ["org_head_office"],
    "includeChildren": true
  },
  "actionOverrides": [
    "devices.view",
    "devices.remote"
  ],
  "status": "active"
}
```

`actionOverrides` is optional.

When absent, the role's permission set applies inside the assignment scope.

When present, it may only reduce or explicitly select permissions already granted by the role; it must not grant a permission the role does not contain.

## 8. Role model

Roles are reusable permission bundles.

Prototype roles currently include:

### Platform Admin

```text
permissions = *
```

Production guidance:

- wildcard may exist as a built-in immutable system role,
- custom roles should store explicit permission IDs,
- audit every role/permission assignment change.

### Support Agent

Current prototype intent includes:

```text
devices.view
devices.remote
devices.remote.collaborate
devices.alert.view
assets.view
assets.qr.scan
helpdesk.ticket.view
helpdesk.ticket.create
helpdesk.ticket.assign
helpdesk.ticket.resolve
helpdesk.notifications.view
helpdesk.reports.view
meeting.view
```

### Employee

Current prototype intent includes:

```text
devices.view
helpdesk.ticket.view
helpdesk.ticket.create
meeting.view
meeting.create
```

These are baseline role examples, not a requirement that production only has three roles.

## 9. Route/capability permission mapping

This mapping is the implementation starting point for the frozen route families. A route may require additional action permission when the user executes a privileged operation.

| UI capability | Base permission | Additional action permission |
| --- | --- | --- |
| Workspace / App Launcher | `platform.workspace.access` | `platform.apps.view` |
| Notification Center | `platform.notifications.view` | — |
| Global Search | `platform.search.use` | destination permission still required |
| Devices overview/list/detail/query/groups | `devices.view` | `devices.manage` for mutations |
| Remote Operations / Remote Session | `devices.view` | `devices.remote` |
| Collaborative remote operations | `devices.remote` | `devices.remote.collaborate` |
| Remote Consent configuration | `devices.view` | `devices.remote.consent.manage` |
| Endpoint Policies | `devices.view` | `devices.policy.manage` |
| Deployment Jobs | `devices.view` | `devices.deploy` |
| Device Alerts | `devices.alert.view` | `devices.alert.manage` |
| Assets overview/inventory/detail/users/ownership | `assets.view` | `assets.manage` |
| Software Baselines | `assets.view` | `assets.baseline.manage` |
| Software Licenses | `assets.view` | `assets.license.manage` |
| Contracts & Warranty | `assets.view` | `assets.contract.manage` |
| QR label generation | `assets.view` | `assets.qr.print` |
| Mobile QR scanning | authenticated mobile user | `assets.qr.scan` |
| Helpdesk ticket queues/detail | `helpdesk.ticket.view` | assign/resolve permissions by action |
| Create Ticket / Agent Request Help | authenticated user | `helpdesk.ticket.create` |
| SLA | `helpdesk.ticket.view` | `helpdesk.sla.manage` |
| Categories | `helpdesk.ticket.view` | `helpdesk.catalog.manage` |
| Status configuration | `helpdesk.ticket.view` | `helpdesk.status.manage` |
| Requester Groups | `helpdesk.ticket.view` | `helpdesk.requester_group.manage` |
| Knowledge Base | `helpdesk.kb.manage` for management | read policy to be defined with API contract |
| Helpdesk Notifications | `helpdesk.notifications.view` | `helpdesk.notifications.manage` |
| Helpdesk Reports | `helpdesk.reports.view` | — |
| Meeting list/detail | `meeting.view` | — |
| Create/record meeting | `meeting.view` | `meeting.create` / `meeting.record` |
| Generate summary | `meeting.view` | `meeting.summary.generate` |
| Share meeting | `meeting.view` | `meeting.share` |
| Reports catalog/saved reports | `reports.view` | `reports.create` / `reports.manage` |
| Report export | `reports.view` | `reports.export.pdf` / `reports.export.xlsx` |
| Organization Structure | `admin.organization.view` | `admin.organization.manage` |
| Locations | `admin.locations.view` | `admin.locations.manage` |
| Positions | `admin.positions.view` | `admin.positions.manage` |
| Users | `admin.users.view` | `admin.users.manage` |
| Roles & Permissions | `admin.roles.view` | `admin.roles.manage` |
| Access Scopes / Scope Browser | `admin.access_scopes.view` | `admin.access_scopes.manage` |
| Evaluate Access | `admin.access_scopes.view` | `admin.access_scopes.evaluate` |
| Apps & Modules | `admin.apps.view` | `admin.apps.manage` |

## 10. Module access

A module's launcher/navigation visibility requires all of:

```text
installed
AND enabled
AND requiredPermission granted
```

This follows current prototype behavior.

Examples:

```text
Devices  → devices.view
Helpdesk → helpdesk.ticket.view
Meeting  → meeting.view
Reports  → reports.view
Assets   → assets.view
```

Future module visibility remains false while `installed=false` or `enabled=false`, even if a user has a reserved permission.

## 11. Effective access evaluation

Recommended decision sequence:

```text
1. Is user authenticated?
2. Is INNO.One profile active?
3. Is module installed/enabled?
4. Does role grant required permission?
5. Does an active access assignment cover this resource?
6. Does action override permit the action, if overrides exist?
7. Is there a deny/availability/business rule?
8. Return Allowed / Denied with trace.
```

The frozen Evaluate Access UI already represents:

- role permission,
- resource scope,
- policy,
- final result.

Production should preserve this explainability.

## 12. Authorization decision result

Recommended internal result:

```json
{
  "allowed": true,
  "permission": "devices.remote",
  "resourceType": "device",
  "resourceId": "dev_...",
  "matchedRoleIds": ["support_agent"],
  "matchedAssignmentIds": ["asg_..."],
  "scope": {
    "type": "organization",
    "resourceId": "org_head_office",
    "inherited": true
  },
  "reason": "ROLE_AND_SCOPE_MATCH"
}
```

For denied decisions:

```json
{
  "allowed": false,
  "permission": "devices.remote",
  "resourceId": "dev_...",
  "reason": "OUTSIDE_ASSIGNED_SCOPE"
}
```

Never send internal security-sensitive policy details to unauthorized clients; the detailed trace is primarily for trusted Admin evaluation/audit.

## 13. Resource ownership and scope resolution

Canonical resource relationships used for authorization:

### User

May belong to:

- Organization Unit,
- Position,
- Location,
- Team/operational group where later modeled.

### Device

May reference:

- owner User ID,
- Organization Unit ID,
- Location ID,
- Device Group IDs.

### Asset

May reference:

- owner User ID,
- Organization Unit ID,
- Location ID,
- linked Device ID.

### Helpdesk Ticket

May reference:

- requester User ID,
- assignee User ID/team,
- requester Organization Unit,
- related Device ID,
- related Asset ID.

Scope resolution uses these references; Helpdesk must not own copies of organization/device authorization data.

## 14. Scope inheritance

### Organization

When `includeChildren=true`, an assignment on a parent organization applies to descendants.

### Location

Location hierarchy may inherit only when a location assignment explicitly opts into descendant behavior in a future UI/contract. The current frozen editor only exposes the generic Include child units switch; implementation must map this carefully instead of assuming every location has descendants.

### Device Group

A Device Group scope applies to current group membership. Dynamic group membership changes effective access as group membership changes.

Group membership changes must be auditable.

## 15. Permission enforcement locations

Authorization must be enforced server-side.

Client checks are only UX helpers.

```text
React permission guard
      │
      │ improves UX only
      ▼
API authorization policy  ← authoritative
      │
      ▼
Application command/query
```

The Endpoint Agent and Android Mobile use the same principle.

Do not trust:

- hidden buttons,
- route guards alone,
- client role claims without token/server validation.

## 16. Keycloak boundary

Keycloak token should establish identity and coarse platform claims.

Recommended mapping:

```text
Keycloak subject (sub)
        │
        ▼
INNO.One User Profile
        │
        ├── roles
        ├── access assignments
        └── effective permissions/scopes
```

INNO.One authorization data should remain in INNO.One persistence, not be duplicated as hundreds of resource-specific Keycloak roles/groups.

## 17. API authorization convention

Step 11 APIs should annotate/document required permission and scope behavior.

Conceptually:

```text
GET /api/devices
requires: devices.view
scope: filter result to effective resource scope

GET /api/devices/{id}
requires: devices.view
scope: requested device must resolve inside effective scope

POST /api/devices/{id}/remote-sessions
requires: devices.remote
scope: requested device must resolve inside effective scope
```

List endpoints must filter server-side. They must not return all rows and rely on React to hide unauthorized records.

## 18. Cross-module permission rules

- Helpdesk opening a related Device still requires Devices permission.
- A Helpdesk role does not automatically imply `devices.remote`.
- Reports may display only data the report execution context is authorized to query.
- Global Search only returns resources visible to the current user's effective scopes.
- Notification deep links do not bypass destination authorization.
- Audit visibility requires an explicit admin/audit permission.

## 19. Audit requirements

At minimum audit:

- role created/changed/deleted,
- permission added/removed from role,
- access assignment created/changed/deleted,
- scope/resource changed,
- module enabled/disabled,
- privileged action authorization failure where security value justifies it,
- Device Group membership changes that affect authorization.

Suggested envelope fields:

```text
actorId
action
module
targetType
targetId
timestamp
metadata
correlationId
```

Detailed event contract is Step 12.

## 20. Permission migration/versioning rules

1. Permission IDs are stable public implementation contracts.
2. Renaming a permission requires migration and compatibility handling.
3. Removing a permission requires checking all roles/assignments first.
4. New permissions default to not granted except built-in wildcard admin.
5. UI capability checks must use the same catalog as API policies.
6. Permission catalog changes are reviewed separately from Design System versioning.

## 21. Step 10 decisions frozen

1. Permission and resource scope are separate.
2. Server-side authorization is authoritative.
3. Existing registry permission IDs are retained.
4. Admin/Platform permission namespaces are reserved as listed in this document.
5. Concrete v1 scope types are Organization, Location and Device Group.
6. Organization scope supports descendant inheritance.
7. Role permissions may be narrowed by scoped assignment actions but not expanded beyond the role.
8. Module visibility requires installation + enablement + access permission.
9. Cross-module deep links never bypass destination permissions.
10. Keycloak authenticates; INNO.One owns business authorization.
11. Permission IDs are versioned implementation contracts.

## 22. Deferred authorization decisions

To decide during API/data implementation:

- multiple-role conflict resolution beyond additive allow,
- explicit deny rules vs allow-only model,
- team domain model,
- direct per-resource scope assignments,
- time-bound assignments,
- delegation/temporary access,
- privileged-access approval,
- service-account permissions,
- external API/client credentials,
- row-level database enforcement strategy.

Do not add these to v1 unless a concrete requirement needs them.
