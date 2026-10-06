#!/usr/bin/env python3
from pathlib import Path
import json

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
iface=read("production/services/platform-api/src/INNO.One.Contracts/Integrations/IRemoteDeviceEngine.cs")
mesh=read("production/services/platform-api/src/Integrations/MeshCentral/MeshCentralRemoteDeviceEngine.cs")
entity=read("production/services/platform-api/src/Modules/Devices/Domain/DeviceEntities.cs")
db=read("production/services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs")
remote=read("production/services/platform-api/src/Modules/Devices/Api/RemoteSessionEndpoints.cs")
agent=read("production/services/platform-api/src/Modules/Devices/Api/AgentDeviceEndpoints.cs")
program=read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
app=read("production/apps/web-portal/src/app/AppRoot.tsx")
shell=read("production/apps/web-portal/src/app/AppShell.tsx")
detail=read("production/apps/web-portal/src/pages/DeviceDetailPage.tsx")
ops_page=read("production/apps/web-portal/src/pages/RemoteOperationsPage.tsx")
consent_page=read("production/apps/web-portal/src/pages/RemoteConsentPage.tsx")
client=read("production/apps/web-portal/src/api/client.ts")
types=read("production/apps/web-portal/src/api/types.ts")

ops={x["id"]:x for x in api["endpoints"]}
for op_id in [
    "devices.remote_sessions.list",
    "devices.remote_sessions.create",
    "devices.remote_sessions.get",
    "devices.remote_sessions.disconnect",
    "devices.consent_history.list",
]:
    check("frozen API exists "+op_id, op_id in ops)

check("remote engine exposes create desktop share", "CreateDesktopShareAsync" in iface)
check("remote engine exposes remove desktop share", "RemoveDesktopShareAsync" in iface)
check("MeshCentral uses audited createDeviceShareLink", '"createDeviceShareLink"' in mesh)
check("MeshCentral desktop protocol p=2", '["p"] = 2' in mesh)
check("MeshCentral duplicate consent disabled after INNO consent", '["consent"] = 0' in mesh)
check("MeshCentral share is time limited", '["start"]' in mesh and '["end"]' in mesh)
check("MeshCentral remove uses removeDeviceShare", '"removeDeviceShare"' in mesh)
check("vendor share id stays integration field", "ExternalShareId" in entity and "externalShareId" not in types)

check("RemoteSession canonical entity", "class RemoteSession" in entity)
check("consent linked to session", "RemoteSessionId" in entity and "ConsentRequestId" in entity)
check("remote session DbSet", "DbSet<RemoteSession>" in db)
check("remote session persistence table", 'ToTable("remote_sessions")' in db)
check("remote endpoint mapped", "MapRemoteSessionEndpoints" in program)
check("remote create requires devices.remote", '"devices.remote"' in remote)
check("remote create requires online device", "RESOURCE_OFFLINE" in remote)
check("remote create requires MeshCentral mapping", "MESH_CENTRAL_MAPPING_MISSING" in remote)
check("remote create starts awaiting consent", 'Status = "awaiting_consent"' in remote)
check("remote create creates consent before execution", "RemoteConsentRequests.Add" in remote and "RemoteSessions.Add" in remote)
check("remote create does not call execution engine", "CreateDesktopShareAsync" not in remote)
check("session list honors effective scope", "OrganizationIds" in remote and "LocationIds" in remote and "DeviceGroupIds" in remote)
check("disconnect removes MeshCentral share", "RemoveDesktopShareAsync" in remote)
check("disconnect writes remote.ended", '"remote.ended"' in remote)
check("disconnect clears launch URL", "session.LaunchUrl = null" in remote)

check("agent decision owns user consent surface", 'platform.workspace.access' in agent and "AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER" in agent)
check("approval triggers MeshCentral only after approved", 'linkedSession is not null && decision == "approved"' in agent and "CreateDesktopShareAsync" in agent)
check("decline prevents launch", 'linkedSession.Status = "declined"' in agent)
check("consent timeout prevents launch", 'linkedSession.Status = "expired"' in agent)
check("execution failure is explicit", '"REMOTE_ENGINE_UNAVAILABLE"' in agent and 'linkedSession.Status = "failed"' in agent)
check("remote.started audit emitted", '"devices.remote.session_started"' in agent)
check("remote.started outbox emitted", '"remote.started"' in agent)
check("consent decided audit emitted", '"devices.remote.consent_decided"' in agent)
check("consent decided event emitted", '"remote.consent.decided"' in agent)

check("web route remote operations", 'path="devices/remote-operations"' in app)
check("web route remote consent", 'path="devices/remote-consent"' in app)
check("remote ops permission gated", "canRemoteDevices" in app and "devices.remote" in app)
check("Devices nav remote operations", 'to="/devices/remote-operations"' in shell)
check("Devices nav remote consent", 'to="/devices/remote-consent"' in shell)
check("Device Detail start remote permission", "usePermission('devices.remote')" in detail)
check("Device Detail starts canonical session", "createRemoteSession" in detail)
check("Device Detail blocks remote while offline", "disabled={device.isOffline}" in detail)
check("Remote Operations polls pending consent", "refetchInterval" in ops_page and "awaiting_consent" in ops_page)
check("Remote Operations opens URL only active", "item.status === 'active' && item.launchUrl" in ops_page)
check("Remote Operations disconnects canonical session", "disconnectRemoteSession" in ops_page)
check("Remote Consent is history/status surface", "getRemoteConsentHistory" in consent_page)
check("Remote Consent explains Endpoint Agent ownership", "Endpoint Agent" in consent_page)
check("web canonical RemoteSession type", "interface RemoteSession" in types and "launchUrl" in types)
check("web client create/list/get/disconnect", all(x in client for x in ["createRemoteSession","getRemoteSessions","getRemoteSession","disconnectRemoteSession"]))
check("web client consent history", "getRemoteConsentHistory" in client)

check("no vendor node id in remote API response", "externalNodeId" not in types and "nodeid" not in types)
check("no direct MeshCentral DB access", "meshcentral." not in remote.lower() and "meshcentral." not in agent.lower())
check("no live-success claim baked into UI", "noauth" not in ops_page.lower() and "live remote" not in ops_page.lower())

migrations=list((ROOT/"production/services/platform-api/src/Modules/Devices/Persistence/Migrations").glob("*Step45VRemoteSessions*.cs"))
check("Step45V migration exists", len(migrations)>=1)

print("step45v_checks="+str(checks))
print("step45v_issues="+str(len(issues)))
for issue in issues:
    print("ISSUE: "+issue)
raise SystemExit(1 if issues else 0)
