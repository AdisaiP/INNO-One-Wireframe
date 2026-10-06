#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
issues=[]
checks=0

def read(rel):
    return (ROOT/rel).read_text(encoding="utf-8")

def check(name, ok):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name)
    if not ok:
        issues.append(name)

api=json.loads(read("inno-api-contract.json"))
openapi=json.loads(read("openapi-inno-one-v1.json"))
data=json.loads(read("inno-data-model-contract.json"))
q=json.loads(read("inno-step45q-devices-tor-contract.json"))
activity=read("production/services/platform-api/src/Modules/Devices/Api/DeviceActivityEndpoints.cs")
helpdesk=read("production/services/platform-api/src/Modules/Helpdesk/Api/HelpdeskEndpoints.cs")
ledger=read("production/services/platform-api/src/Modules/Devices/Infrastructure/DeviceLedgerWriter.cs")
live_ops=read("production/services/platform-api/src/Modules/Devices/Api/DeviceLiveOperationsEndpoints.cs")
program=read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
client=read("production/apps/web-portal/src/api/client.ts")
types=read("production/apps/web-portal/src/api/types.ts")
page=read("production/apps/web-portal/src/pages/DeviceDetailPage.tsx")
ticket_create=read("production/apps/web-portal/src/pages/TicketCreatePage.tsx")
en=json.loads(read("production/packages/i18n/src/locales/en-US/devices.json"))
th=json.loads(read("production/packages/i18n/src/locales/th-TH/devices.json"))

ops={x["id"]:x for x in api["endpoints"]}
check("activity API promoted", "devices.activity.list" in ops)
if "devices.activity.list" in ops:
    op=ops["devices.activity.list"]
    check("activity path", op["method"]=="GET" and op["path"]=="/devices/{deviceId}/activity")
    check("activity permission scope", op["permission"]=="devices.view" and op["scope"]=="resource")
    check("activity paged", op["response"]=="paged")
check("activity OpenAPI promoted", "/devices/{deviceId}/activity" in openapi["paths"])
check("activity Device Detail coverage", "devices.activity.list" in api["screenCoverage"]["device-detail-v2.html"])
check("Step45Q activity matches", any(x["id"]=="devices.activity.list" for x in q["plannedOperations"]))

tickets=ops["helpdesk.tickets.list"]
check("ticket list remains Helpdesk", tickets["module"]=="helpdesk")
check("ticket permission unchanged", tickets["permission"]=="helpdesk.ticket.view")
check("ticket relatedDevice query frozen", "relatedDeviceId" in tickets.get("optionalQuery",[]))
check("ticket Device Detail coverage", "helpdesk.tickets.list" in api["screenCoverage"]["device-detail-v2.html"])
ticket_params=openapi["paths"]["/helpdesk/tickets"]["get"].get("parameters",[])
check("ticket OpenAPI relatedDeviceId", any(x.get("name")=="relatedDeviceId" for x in ticket_params))

device_tables={x["name"] for x in data["schemas"]["devices"]["tables"]}
check("no duplicate activity table promoted", "device_activity_items" not in device_tables)
helpdesk_tickets=next(x for x in data["schemas"]["helpdesk"]["tables"] if x["name"]=="tickets")
check("Helpdesk owns ticket related device", any(x.get("column")=="related_device_id" and x.get("target")=="devices.devices" for x in helpdesk_tickets.get("crossModuleRefs",[])))

check("activity endpoint mapped", "MapDeviceActivityEndpoints" in program)
check("activity reads audit ledger", "audit.audit_records" in activity)
check("activity targets Devices audit only", "module = 'devices'" in activity and "target_type = 'device'" in activity)
check("activity does not read Helpdesk", "helpdesk." not in activity.lower())
check("activity scope enforced", '"devices.view"' in activity and "CanAccessDeviceAsync" in activity)
check("activity remains readable while device offline", "isOffline" not in activity)
check("activity actor directory resolution", "IPlatformDirectoryReader" in activity and "ReadUsersAsync" in activity)
check("activity resolves opaque user IDs", 'OpaqueId.TryParse(actorId, "user"' in activity)
check("audit writer supports classification", 'string classification = "internal"' in ledger and "normalizedClassification" in ledger)
check("Step45T sensitive actions write restricted audit", live_ops.count('"restricted"') >= 2)
check("activity paginates", "LIMIT @limit OFFSET @offset" in activity)
check("activity metadata is canonical allowlist", "JsonElement Metadata" in activity and "ProjectMetadata" in activity and "switch (action)" in activity)
check("activity never returns raw audit metadata", "return document.RootElement.Clone()" not in activity)

check("Helpdesk list accepts relatedDeviceId", "string? relatedDeviceId = null" in helpdesk)
check("Helpdesk validates opaque device id", 'OpaqueId.TryParse(relatedDeviceId.Trim(), "dev"' in helpdesk)
check("Helpdesk filters own relation", "x.RelatedDeviceId == parsedRelatedDeviceId" in helpdesk)
check("Helpdesk scope still applied first", "ApplyTicketScope" in helpdesk and '"helpdesk.ticket.view"' in helpdesk)
check("Helpdesk list does not read Devices tables", "DevicesDbContext" not in helpdesk)

check("web DeviceActivity type", "interface DeviceActivityItem" in types)
check("web activity client", "getDeviceActivity" in client and "/activity?" in client)
check("web ticket query relatedDeviceId", "relatedDeviceId?: string" in client and "params.set('relatedDeviceId'" in client)
check("web exact nine tabs", "['overview', 'hardware', 'software', 'performance', 'processes', 'services', 'network', 'activity', 'tickets']" in page)
check("activity query active tab only", "activeTab === 'activity'" in page)
check("tickets query active tab only", "activeTab === 'tickets' && canViewTickets" in page)
check("tickets are independent of device connectivity", "enabled: Boolean(deviceId) && activeTab === 'tickets' && canViewTickets," in page)
check("tickets uses Helpdesk permission", "usePermission('helpdesk.ticket.view')" in page)
check("ticket creation uses separate permission", "usePermission('helpdesk.ticket.create')" in page and "canCreateTicket ?" in page)
check("tickets permission state local", 'kind="permission"' in page and "ticketsPermissionDenied" in page)
check("activity UI audit backed", "auditBacked" in page and "activityQuery.data.items" in page)
check("ticket UI Helpdesk owned", "helpdeskOwned" in page and "ticketsQuery.data.items" in page)
check("create ticket deep link related device", "/helpdesk/tickets/new?relatedDeviceId=" in page)
check("TicketCreate reads query param", "useSearchParams" in ticket_create and "searchParams.get('relatedDeviceId')" in ticket_create)
check("activity pagination wired", "onPageChange={setActivityPage}" in page and "activityPage" in page)
check("ticket pagination wired", "onPageChange={setTicketPage}" in page and "ticketPage" in page)
check("no Device-owned ticket endpoint", "/devices/{deviceId}/tickets" not in read("inno-api-contract.json"))
check("no direct Helpdesk DB read in Device page backend", "HelpdeskDbContext" not in activity)

keys=[
 "devices.step45u.deviceDetail.activity",
 "devices.step45u.deviceDetail.tickets",
 "devices.step45u.deviceDetail.auditBacked",
 "devices.step45u.deviceDetail.ticketsPermissionDenied",
 "devices.step45u.deviceDetail.noTickets",
 "devices.step45u.deviceDetail.createTicket",
 "devices.step45u.deviceDetail.softwareInventoryObserved",
 "devices.step45u.deviceDetail.processTerminated",
 "devices.step45u.deviceDetail.serviceChanged",
]
for key in keys:
    check("locale pair "+key, key in en and key in th)

print("step45u_checks="+str(checks))
print("step45u_issues="+str(len(issues)))
for issue in issues:
    print("ISSUE: "+issue)
raise SystemExit(1 if issues else 0)
