# INNO.One — TOR UI Coverage Audit

Date: 2026-09-24
Scope: UI/UX prototype only. This document does not certify backend implementation or TOR acceptance.

Legend:
- ✅ Represented — the UI/interaction is explicitly represented in the prototype.
- 🟡 Partial — some of the required UI is represented, but an important control/flow is still missing.
- 🔴 Missing — no dedicated UI representation found yet.
- ⚪ Non-UI / cannot be proven by prototype alone.

Surface notation: Web Portal, Endpoint Agent and Android Mobile are separate product surfaces. A TOR capability may span more than one surface.

## Section 4

| TOR | Status | Current UI | Gap / next action |
| --- | --- | --- | --- |
| 4.5 | ✅ | device-discovery.html, device-add.html | Network discovery + Agent deployment represented. |
| 4.6 | ✅ | roles-permissions-v2.html, access-scopes.html | Administrator action permissions + Organization/Location/Device Group scope assignment are represented. |
| 4.7 | ✅ | remote-consent.html, remote-operations.html | Editable central consent message, endpoint preview, prompt rules and bypass scopes are represented. |
| 4.8 | ✅ | remote-session.html | Administrator session chat and send/receive file-transfer UI are represented inside the control screen. |
| 4.9 | ⚪ | Thai labels/search/report UI exist across prototype | End-to-end Thai completeness cannot be proven by static UI alone. |

## Section 5

| TOR | Status | Current UI | Gap / next action |
| --- | --- | --- | --- |
| 5.1 | ✅ | devices-overview-v2.html | Online/offline state represented. |
| 5.2 | ✅ | devices-overview-v2.html | Notebook/Desktop/Virtual/Server type views represented. |
| 5.3 | ✅ | device-alerts.html, devices-overview-v2.html | Time-window/group offline anomaly rules, warning symbols and console sound configuration are represented. |
| 5.4 | ✅ | devices-overview-v2.html | Executive overview represented. |
| 5.5 | ✅ | device-detail-v2.html | Realtime CPU/Memory charts represented. |
| 5.6 | ✅ | device-detail-v2.html | Process list/details represented. |
| 5.7 | ✅ | device-detail-v2.html | Services and current state represented. |
| 5.8 | ✅ | devices-overview-v2.html | Search by hostname/IP/brand/user/serial represented. |
| 5.9 | ✅ | device-query.html | Process/Service/Software/File/Folder condition query represented. |

## Section 6

| TOR | Status | Current UI | Gap / next action |
| --- | --- | --- | --- |
| 6.1 | ✅ | remote-operations.html | Wake on LAN represented. |
| 6.2 | ✅ | remote-session.html, remote-operations.html | Active screen workspace plus mouse/keyboard control, view-only mode and secure command controls are represented. |
| 6.3 | ✅ | access-scopes.html, roles-permissions-v2.html | Remote permission is explicitly evaluated together with assigned resource scope. |
| 6.4 | ✅ | remote-operations.html | Multi-device Screen Wall represented. |
| 6.5 | ✅ | remote-operations.html | Screenshot job, interval and JPG represented. |
| 6.6 | ✅ | device-detail-v2.html | Process/service control actions represented. |
| 6.7 | ✅ | deployment-jobs.html | File distribution represented. |
| 6.8 | ✅ | deployment-jobs.html | Remote software deployment represented. |
| 6.9 | ✅ | endpoint-policies.html | USB read/write policy represented. |
| 6.10 | ✅ | endpoint-policies.html | Registered USB allowlist represented. |

## Section 7

| TOR | Status | Current UI | Gap / next action |
| --- | --- | --- | --- |
| 7.1 | ✅ | device-groups.html | Static/dynamic conditional groups represented. |
| 7.2 | ✅ | device-detail-v2.html, asset-detail.html | Hardware inventory fields represented. |
| 7.3 | ✅ | device-detail-v2.html, asset-detail.html | Installed software inventory represented. |
| 7.4 | ✅ | device-alerts.html, asset-detail.html | Hardware/Software change detection rules plus Console and Email notification configuration are represented. |
| 7.5 | ✅ | asset-detail.html | Baseline + current differences represented. |
| 7.6 | ✅ | software-licenses.html | License record fields represented. |
| 7.7 | ✅ | software-licenses.html | Purchased/installed/overuse/gap value represented. |
| 7.8 | ✅ | software-licenses.html | Installed devices + last-used represented. |
| 7.9 | ✅ | asset-inventory.html, asset-detail.html | Additional asset categories and ownership relation represented. |
| 7.10 | ✅ | contracts-warranty.html | Contract/warranty/service/contact data represented. |
| 7.11 | ✅ | asset-ownership.html | User/custom fields represented. |
| 7.12 | ✅ | agent-ownership-confirmation.html (Endpoint Agent), asset-ownership.html (Web review) | Thai ownership confirmation is represented on the managed endpoint; Web Assets reviews/stores the submitted ownership data. |
| 7.13 | ✅ | asset-qr.html (Web), asset-mobile.html (Android Mobile) | Web owns QR selection/printing; the separate Android surface owns scanning and Hardware/Software lookup. |

## Section 8

| TOR | Status | Current UI | Gap / next action |
| --- | --- | --- | --- |
| 8.1 | ✅ | reports-overview.html | Hardware/software/usage/asset change/contracts/helpdesk report catalog represented. |
| 8.2 | ✅ | reports-overview.html | Browser reporting UI represented. |
| 8.3 | ✅ | report-builder.html | Add/custom report builder represented. |
| 8.4 | ✅ | reports-overview.html, report-builder.html | PDF/Excel export controls represented. |

## Section 9

| TOR | Status | Current UI | Gap / next action |
| --- | --- | --- | --- |
| 9.1 | ✅ | agent-maintenance.html | Central Agent update + staged rollout represented. |
| 9.2 | ✅ | agent-maintenance.html, deployment-jobs.html | Central install/uninstall represented. |
| 9.3 | ✅ | agent-maintenance.html | Scheduled restart represented. |

## Section 10

| TOR | Status | Current UI | Gap / next action |
| --- | --- | --- | --- |
| 10.1 | ✅ | ticket-new.html (Web console), helpdesk-agent-request.html (Endpoint Agent) | Central-console ticket creation and separate managed-endpoint Request Help flow are represented. |
| 10.2 | ✅ | helpdesk-notifications.html, ticket-detail.html, helpdesk.html | Ticket tracking plus automatic status-email rules, templates, recipients and delivery history are represented. |
| 10.3 | ✅ | helpdesk.html, ticket-detail.html | Auto Ticket ID represented. |
| 10.4 | ✅ | ticket-new.html | Smart/automatic routing concept represented. |
| 10.5 | ✅ | ticket-detail.html | Create/assign/progress/resolution timestamps represented. |
| 10.6 | ✅ | helpdesk-sla.html | 3-level escalation represented. |
| 10.7 | ✅ | ticket-new.html, ticket-detail.html | Priority and Urgency are separate. |
| 10.8 | ✅ | roles-permissions-v2.html | Helpdesk role permissions represented. |
| 10.9 | ✅ | helpdesk-settings.html | Work calendar/time/holiday represented. |
| 10.10 | ✅ | helpdesk-settings.html | Category/Subcategory represented. |
| 10.11 | ✅ | helpdesk-settings.html | Add/edit status UI represented. |
| 10.12 | ✅ | helpdesk-settings.html | Open/In Progress/Resolved/Closed and custom status represented. |
| 10.13 | ✅ | ticket-detail.html | Related Device + Asset inventory context represented. |
| 10.14 | ✅ | helpdesk-settings.html | Requester-group rules represented. |
| 10.15 | ✅ | knowledge-base.html | Searchable Knowledge Base represented. |
| 10.16 | ✅ | helpdesk-reports.html | Problem/agent/priority/department/date reporting represented. |

## Current UI gap order

No remaining partial functional UI clauses in Sections 4.5–10.16. TOR 4.9 remains ⚪ because end-to-end Thai-language completeness cannot be proven by static UI alone.

Next work should be a full-system visual/interaction consistency pass and explicit Coming Soon / placeholder cleanup, not additional TOR feature screens.
