# INNO.One — Permission Matrix

**Status:** Planning contract  
**Date:** 2026-09-25  
**UI baseline:** 83 Web Portal routes  
**Identity provider:** Keycloak for authentication; INNO.One for application authorization

## 1. Authorization model

Authorization is evaluated in four layers:

```
Authenticated?
   ↓
Module enabled?
   ↓
Permission granted?
   ↓
Resource inside effective scope?
   ↓
Business state allows action?
```

Do not treat Keycloak authentication as permission to operate on all INNO.One resources.

## 2. Permission naming

Format:

`<module>.<resource>.<action>`

Examples:
- `devices.device.view`
- `devices.remote.start`
- `helpdesk.ticket.assign`
- `assets.qr.print`
- `platform.module.manage`

The existing prototype permissions such as `devices.view` and `helpdesk.ticket.view` can be accepted as aliases during migration, but production code should use one canonical namespace.

## 3. Scope model

Permissions answer **what**.
Scopes answer **where**.

Supported scope dimensions initially:
- Organization,
- Organization subtree,
- Location,
- Device Group,
- Team,
- Own.

Effective scope is the union/intersection defined by role assignments.

A permission without scope does not imply global visibility unless the assignment explicitly grants organization/global scope.

## 4. Platform permissions

- `platform.workspace.view`
- `platform.notification.view`
- `platform.notification.manage-own`
- `platform.profile.view`
- `platform.profile.manage-own`
- `platform.admin.view`
- `platform.module.view`
- `platform.module.manage`
- `platform.role.view`
- `platform.role.manage`
- `platform.access-scope.view`
- `platform.access-scope.manage`
- `platform.access-scope.evaluate`
- `platform.audit.view`

## 5. Devices permissions

Compatibility aliases from current prototype:
- `devices.view` → `devices.device.view`
- `devices.manage` → `devices.device.manage`
- `devices.remote` → `devices.remote.start`
- `devices.remote.collaborate` → same canonical name
- `devices.remote.consent.manage` → `devices.consent.manage`
- `devices.alert.view`
- `devices.alert.manage`
- `devices.scope.manage` → `devices.group.manage`
- `devices.policy.manage`

Canonical set:
- `devices.overview.view`
- `devices.device.view`
- `devices.device.manage`
- `devices.discovery.run`
- `devices.group.view`
- `devices.group.manage`
- `devices.query.view`
- `devices.query.manage`
- `devices.remote.view`
- `devices.remote.start`
- `devices.remote.end`
- `devices.remote.collaborate`
- `devices.remote.file-transfer`
- `devices.consent.view`
- `devices.consent.manage`
- `devices.deployment.view`
- `devices.deployment.manage`
- `devices.maintenance.view`
- `devices.maintenance.manage`
- `devices.policy.view`
- `devices.policy.manage`
- `devices.alert.view`
- `devices.alert.acknowledge`
- `devices.alert.manage`

## 6. Assets permissions

Compatibility aliases:
- `assets.view` → `assets.asset.view`
- `assets.manage` → `assets.asset.manage`
- `assets.qr.print`
- `assets.qr.scan`
- `assets.baseline.manage` — compatibility permission for inventory/baseline configuration
- `assets.license.manage`
- `assets.contract.manage`

Canonical set:
- `assets.overview.view`
- `assets.asset.view`
- `assets.asset.manage`
- `assets.ownership.view`
- `assets.ownership.manage`
- `assets.custom-field.view`
- `assets.custom-field.manage`
- `assets.qr.print`
- `assets.qr.manage`
- `assets.qr.scan`
- `assets.license.view`
- `assets.license.manage`
- `assets.contract.view`
- `assets.contract.manage`

## 7. Helpdesk permissions

Existing prototype permissions are retained where already well-shaped:
- `helpdesk.ticket.view`
- `helpdesk.ticket.create`
- `helpdesk.ticket.assign`
- `helpdesk.ticket.resolve`
- `helpdesk.sla.manage`
- `helpdesk.catalog.manage`
- `helpdesk.status.manage`
- `helpdesk.requester_group.manage`
- `helpdesk.kb.manage`
- `helpdesk.notifications.view`
- `helpdesk.notifications.manage`
- `helpdesk.reports.view`

Add:
- `helpdesk.ticket.comment`
- `helpdesk.ticket.manage`
- `helpdesk.calendar.manage`
- `helpdesk.kb.view`

## 8. Meeting permissions

Existing:
- `meeting.view`
- `meeting.create`
- `meeting.record`
- `meeting.summary.generate`
- `meeting.share`

Add:
- `meeting.manage`
- `meeting.transcript.view`

## 9. Reports permissions

Existing:
- `reports.view`
- `reports.create`
- `reports.manage`
- `reports.export.pdf`
- `reports.export.xlsx`

## 10. Route-level matrix — Platform / Workspace

| Route | Minimum route permission | Important action permissions |
| --- | --- | --- |
| `workspace-v2.html` | `platform.workspace.view` | none |
| `workspace-continue.html` | `platform.workspace.view` | none |
| `workspace-attention.html` | `platform.workspace.view` | none |
| `workspace-recent.html` | `platform.workspace.view` | none |
| `app-launcher-v2.html` | `platform.workspace.view` | pin own app preference: `platform.profile.manage-own` |
| `notifications.html` | `platform.notification.view` | read/read-all: `platform.notification.manage-own` |
| `profile.html` | `platform.profile.view` | update preference: `platform.profile.manage-own` |
| `admin.html` | `platform.admin.view` | none |
| `modules.html` | `platform.module.view` | enable/disable: `platform.module.manage` |
| `roles-permissions-v2.html` | `platform.role.view` | modify role: `platform.role.manage` |
| `access-scopes.html` | `platform.access-scope.view` | none |
| `access-scope-edit.html` | `platform.access-scope.manage` | create/update assignment |
| `access-scope-browser.html` | `platform.access-scope.view` | none |
| `access-scope-evaluate.html` | `platform.access-scope.evaluate` | evaluate |

## 11. Route-level matrix — Devices

| Route | Minimum permission | Important action permissions |
| --- | --- | --- |
| `devices-overview-v2.html` | `devices.overview.view` | none |
| `devices.html` | `devices.device.view` | bulk actions require their own command permission |
| `device-detail-v2.html` | `devices.device.view` | edit: `devices.device.manage`; remote: `devices.remote.start` |
| `device-add.html` | `devices.device.manage` | create/register |
| `device-discovery.html` | `devices.discovery.run` | run/import discovery |
| `device-groups.html` | `devices.group.view` | create/update membership: `devices.group.manage` |
| `remote-operations.html` | `devices.remote.view` | start: `devices.remote.start` |
| `remote-session.html` | `devices.remote.start` | end/collaborate/file transfer use specific permissions |
| `remote-consent.html` | `devices.consent.view` | none |
| `remote-consent-policy.html` | `devices.consent.manage` | update policy |
| `remote-consent-message.html` | `devices.consent.manage` | update message |
| `remote-consent-rules.html` | `devices.consent.manage` | rule CRUD |
| `remote-consent-history.html` | `devices.consent.view` | none |
| `device-query.html` | `devices.query.view` | save query: `devices.query.manage` |
| `deployment-jobs.html` | `devices.deployment.view` | none |
| `deployment-new.html` | `devices.deployment.manage` | create job |
| `deployment-job-detail.html` | `devices.deployment.view` | cancel/retry: `devices.deployment.manage` |
| `agent-maintenance.html` | `devices.maintenance.view` | none |
| `agent-updates.html` | `devices.maintenance.view` | none |
| `agent-rollout-new.html` | `devices.maintenance.manage` | create rollout |
| `software-maintenance.html` | `devices.maintenance.view` | none |
| `software-maintenance-new.html` | `devices.maintenance.manage` | create job |
| `restart-operations.html` | `devices.maintenance.view` | none |
| `restart-schedule.html` | `devices.maintenance.manage` | create restart job |
| `maintenance-history.html` | `devices.maintenance.view` | none |
| `endpoint-policies.html` | `devices.policy.view` | modify/assign: `devices.policy.manage` |
| `device-alerts.html` | `devices.alert.view` | acknowledge: `devices.alert.acknowledge` |
| `device-alert-rules.html` | `devices.alert.view` | rule CRUD: `devices.alert.manage` |
| `device-alert-rule.html` | `devices.alert.manage` | save rule |
| `device-alert-channels.html` | `devices.alert.manage` | channel config/test |
| `device-alert-history.html` | `devices.alert.view` | none |
## 12. Route-level matrix — Assets

| Route | Minimum permission | Important action permissions |
| --- | --- | --- |
| `assets-overview.html` | `assets.overview.view` | none |
| `asset-inventory.html` | `assets.asset.view` | none |
| `asset-detail.html` | `assets.asset.view` | edit: `assets.asset.manage` |
| `asset-ownership.html` | `assets.ownership.view` | assign/return: `assets.ownership.manage` |
| `asset-users.html` | `assets.ownership.view` | none |
| `asset-user-detail.html` | `assets.ownership.view` | manage assignment: `assets.ownership.manage` |
| `asset-ownership-submissions.html` | `assets.ownership.manage` | approve/reject |
| `asset-custom-fields.html` | `assets.custom-field.view` | edit schema: `assets.custom-field.manage` |
| `asset-qr.html` | `assets.asset.view` | generate/print: `assets.qr.print`; revoke: `assets.qr.manage` |
| `software-licenses.html` | `assets.license.view` | manage: `assets.license.manage` |
| `contracts-warranty.html` | `assets.contract.view` | manage: `assets.contract.manage` |

Mobile QR lookup additionally requires `assets.qr.scan` plus Asset scope.

## 13. Route-level matrix — Helpdesk

| Route | Minimum permission | Important action permissions |
| --- | --- | --- |
| `helpdesk.html` | `helpdesk.ticket.view` | none |
| `helpdesk-tickets.html` | `helpdesk.ticket.view` | none |
| `helpdesk-assigned.html` | `helpdesk.ticket.view` | own queue |
| `helpdesk-team.html` | `helpdesk.ticket.view` | assignment actions require `helpdesk.ticket.assign` |
| `ticket-new.html` | `helpdesk.ticket.create` | create |
| `ticket-detail.html` | `helpdesk.ticket.view` | comment/assign/resolve use action permissions |
| `helpdesk-sla.html` | `helpdesk.sla.manage` | SLA CRUD |
| `helpdesk-settings.html` | Helpdesk config permission union | navigation/read summary |
| `helpdesk-categories.html` | `helpdesk.catalog.manage` | category CRUD |
| `helpdesk-statuses.html` | `helpdesk.status.manage` | status config |
| `helpdesk-requester-groups.html` | `helpdesk.requester_group.manage` | group/rule CRUD |
| `helpdesk-calendar.html` | `helpdesk.calendar.manage` | calendar update |
| `helpdesk-notifications.html` | `helpdesk.notifications.view` | none |
| `helpdesk-notification-rule.html` | `helpdesk.notifications.manage` | rule update |
| `helpdesk-notification-templates.html` | `helpdesk.notifications.view` | template create/edit requires manage |
| `helpdesk-notification-template.html` | `helpdesk.notifications.manage` | template update |
| `helpdesk-notification-delivery.html` | `helpdesk.notifications.view` | retry requires manage |
| `helpdesk-notification-settings.html` | `helpdesk.notifications.manage` | channel config/test |
| `knowledge-base.html` | `helpdesk.kb.view` | article manage: `helpdesk.kb.manage` |
| `helpdesk-reports.html` | `helpdesk.reports.view` | export may require Reports export permission |

## 14. Route-level matrix — Meeting

| Route | Minimum permission | Important action permissions |
| --- | --- | --- |
| `meeting.html` | `meeting.view` | none |
| `meeting-list.html` | `meeting.view` | none |
| `meeting-upcoming.html` | `meeting.view` | none |
| `meeting-new.html` | `meeting.create` | record: `meeting.record` |
| `meeting-detail.html` | `meeting.view` | regenerate summary: `meeting.summary.generate`; share: `meeting.share` |

## 15. Route-level matrix — Reports

| Route | Minimum permission | Important action permissions |
| --- | --- | --- |
| `reports-overview.html` | `reports.view` | exports require format permission |
| `report-builder.html` | `reports.create` | save/manage: `reports.manage`; export format permission |

## 16. Action-level examples

### Start remote session

Required:
- `devices.remote.start`,
- Device within effective scope,
- Devices module enabled,
- consent/business policy passes.

### Create Helpdesk ticket

Required:
- `helpdesk.ticket.create`.

Related Device/Asset:
- user must at least be allowed to reference/read the selected resource,
- creation must not leak details outside scope.

### Assign ticket

Required:
- `helpdesk.ticket.assign`,
- ticket visible,
- target assignee/team valid.

### Print Asset QR

Required:
- `assets.qr.print`,
- asset visible inside scope.

### Manage modules

Required:
- `platform.module.manage`.

Module disable must not bypass dependency validation.

## 17. Baseline roles

### Platform Admin

Permissions:
- `*`

Scope:
- organization/global.

### Support Agent

Baseline:
- Devices view,
- remote start/collaborate,
- alert view/acknowledge,
- Assets view/QR scan,
- Helpdesk ticket view/create/comment/assign/resolve,
- Helpdesk notification view,
- Helpdesk report view,
- Meeting view.

Scope:
- assigned support organizations/locations/groups/teams.

### Employee

Baseline:
- Workspace/profile/notification own access,
- limited Devices view if product requires own-assigned device,
- Helpdesk create/view own tickets,
- Meeting view/create for own/team meetings.

Scope:
- Own / Team.

Do not encode these role defaults into controllers.
Roles are data mapped to permission claims/policies.

## 18. Permission evaluation contract

Application code asks a central authorization service:

```
CanAsync(
  actor,
  permission: "devices.remote.start",
  resource: DeviceId
)
```

The evaluator:
1. verifies permission via effective role assignments,
2. loads effective access scopes,
3. resolves resource scope attributes through module resource-scope provider,
4. returns Allow/Deny + reason code.

Reason codes:
- missing_permission,
- outside_scope,
- module_disabled,
- resource_not_found,
- business_rule_denied.

Do not reveal existence of hidden resources where that would leak sensitive inventory.

## 19. Caching

Permission catalog and role definitions may be cached.

Resource-scope decisions must be invalidated when:
- role assignment changes,
- access scope changes,
- organization hierarchy changes,
- device group membership changes,
- module is disabled.

Short TTL is acceptable as a safety net, but authorization must have explicit invalidation events.

## 20. Audit requirements

Audit at minimum:
- role/permission changes,
- access-scope changes,
- module enable/disable,
- remote session start/end,
- consent policy/rule changes,
- deployment/maintenance job creation,
- endpoint policy changes,
- ticket assignment/status/resolve,
- SLA/calendar/config changes,
- notification rule/template/settings changes,
- asset ownership/QR changes,
- report export,
- meeting processing/regeneration/share.

Read-only page visits are not automatically business audit events.


## 21. Future module manifest permissions

The prototype registry already reserves permissions for modules that are not installed yet. Keep them documented so enabling a future module does not invent a parallel naming scheme.

### Workflow

- `workflow.view`
- `workflow.design`
- `workflow.publish`

### Forms

- `forms.view`
- `forms.design`

These future permissions do not create Web routes or backend implementation in the current planning phase.
