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
events=json.loads(read("inno-event-audit-contract.json"))
data=json.loads(read("inno-data-model-contract.json"))
q=json.loads(read("inno-step45q-devices-tor-contract.json"))
cap=json.loads(read("inno-step45t-meshcentral-capability-audit.json"))
remote=read("production/services/platform-api/src/INNO.One.Contracts/Integrations/IRemoteDeviceEngine.cs")
adapter=read("production/services/platform-api/src/Integrations/MeshCentral/MeshCentralRemoteDeviceEngine.cs")
endpoint=read("production/services/platform-api/src/Modules/Devices/Api/DeviceLiveOperationsEndpoints.cs")
store=read("production/services/platform-api/src/Modules/Devices/Application/DeviceLiveSnapshotStore.cs")
program=read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
module=read("production/services/platform-api/src/Modules/Devices/DevicesModule.cs")
page=read("production/apps/web-portal/src/pages/DeviceDetailPage.tsx")
client=read("production/apps/web-portal/src/api/client.ts")
types=read("production/apps/web-portal/src/api/types.ts")
agent_main=read("production/apps/endpoint-agent/src/main.tsx")
agent_native=read("production/apps/endpoint-agent/src-tauri/src/main.rs")
en=json.loads(read("production/packages/i18n/src/locales/en-US/devices.json"))
th=json.loads(read("production/packages/i18n/src/locales/th-TH/devices.json"))

check("capability audit exact version", cap["meshCentral"]["version"]=="1.2.6")
check("capability audit exact tag commit", cap["meshCentral"]["tagCommit"]=="029b7338ecfeeacc65da3b5a1a4cc069baeb2f65")
check("live MeshCentral health recorded", cap["meshCentral"]["liveHealth"]=={"httpStatus":200,"body":"ok"})
check("live control blocker recorded", cap["meshCentral"]["liveControl"]["cause"]=="noauth" and cap["meshCentral"]["liveControl"]["message"]=="noauth-2d")
check("INNO owns product contract", cap["architectureDecision"]["productApiDataPermissionAuditOwner"]=="INNO.One")
check("MeshCentral execution engine", cap["architectureDecision"]["endpointExecutionEngine"]=="MeshCentral/MeshAgent when capability is verified")
check("vendor IDs remain private", cap["architectureDecision"]["vendorIdsPublic"] is False)
check("no duplicate Endpoint Agent executor", cap["architectureDecision"]["endpointAgentDuplicateExecutor"] is False)

jobs={x["job"]:x for x in cap["capabilities"]}
for job, command in [
    ("list-processes","ps"),
    ("terminate-process","pskill"),
    ("list-services","services"),
    ("start-service","serviceStart"),
    ("stop-service","serviceStop"),
    ("restart-service","serviceRestart"),
]:
    check("capability "+job, job in jobs and jobs[job]["meshAgentMessageType"]==command and jobs[job]["step45tUse"] is True)
check("generic runcommands not used Step45T", jobs["run-command"]["step45tUse"] is False)

for token in ["ListProcessesAsync","TerminateProcessAsync","ListServicesAsync","ExecuteServiceActionAsync","RemoteProcessInfo","RemoteServiceInfo","RemoteServiceAction"]:
    check("remote engine contract "+token, token in remote)

for command in ['"ps"','"pskill"','"services"','"serviceStart"','"serviceStop"','"serviceRestart"']:
    check("adapter command "+command, command in adapter)
check("adapter routes agent messages", '["action"] = "msg"' in adapter and '["nodeid"] = externalNodeId' in adapter)
check("process action verifies disappearance", "processes.All(x => x.ProcessId != processId)" in adapter)
check("service action verifies live state", "ServiceStateMatches(service.Status, action)" in adapter)
check("restart requires observed transition", "restartTransitionObserved" in adapter and "restartNeedsTransition" in adapter)
check("Step45T executor does not use runcommands", '"runcommands"' not in adapter)
check("adapter handles noauth close", "MeshCentral closed the control connection" in adapter)
check("process parser normalizes vendor JSON", "ParseProcesses" in adapter and "ToProcess" in adapter)
check("service parser normalizes vendor JSON", "ParseServices" in adapter and "AddService" in adapter)

check("snapshot lifetime 60 seconds", "TimeSpan.FromSeconds(60)" in store)
check("snapshot store is memory only", "ConcurrentDictionary" in store and "DbContext" not in store)
check("snapshot store registered singleton", "AddSingleton<DeviceLiveSnapshotStore>" in module)
check("live endpoints mapped", "MapDeviceLiveOperationsEndpoints" in program)

ops={x["id"]:x for x in api["endpoints"]}
expected=[
    ("devices.process_snapshot.create","POST","/devices/{deviceId}/processes/snapshots","devices.view"),
    ("devices.process_snapshot.get","GET","/devices/{deviceId}/processes/snapshots/{snapshotId}","devices.view"),
    ("devices.process.terminate","POST","/devices/{deviceId}/processes/{processKey}/terminate","devices.manage"),
    ("devices.service_snapshot.create","POST","/devices/{deviceId}/services/snapshots","devices.view"),
    ("devices.service_snapshot.get","GET","/devices/{deviceId}/services/snapshots/{snapshotId}","devices.view"),
    ("devices.service.action","POST","/devices/{deviceId}/services/{serviceName}/actions","devices.manage"),
]
for opid,method,path,permission in expected:
    check("API "+opid, opid in ops and ops[opid]["method"]==method and ops[opid]["path"]==path and ops[opid]["permission"]==permission and ops[opid]["scope"]=="resource")

check("process snapshot endpoint calls remote engine", "remoteEngine.ListProcessesAsync" in endpoint)
check("service snapshot endpoint calls remote engine", "remoteEngine.ListServicesAsync" in endpoint)
check("process terminate endpoint calls remote engine", "remoteEngine.TerminateProcessAsync" in endpoint)
check("service action endpoint calls remote engine", "remoteEngine.ExecuteServiceActionAsync" in endpoint)
check("offline guarded", endpoint.count('device.ConnectivityState != "online"') >= 4)
check("MeshCentral mapping guarded", endpoint.count("GetMeshCentralNodeIdAsync") >= 5 and "MESH_CENTRAL_MAPPING_MISSING" in endpoint)
check("remote dependency failure explicit", "REMOTE_ENGINE_UNAVAILABLE" in endpoint and "Status503ServiceUnavailable" in endpoint)
check("unverified remote action explicit", "REMOTE_ACTION_UNVERIFIED" in endpoint and "Status502BadGateway" in endpoint)
check("expired snapshots 410", "Status410Gone" in endpoint and "LIVE_SNAPSHOT_EXPIRED" in endpoint)
check("process terminate audit", '"devices.process.terminate"' in endpoint)
check("service action audit", '"devices.service.action"' in endpoint)
check("audit records execution engine", 'executionEngine = "meshcentral"' in endpoint)

audit_actions={x["action"]:x for x in events["auditActions"]}
for action in ["devices.process.terminate","devices.service.action"]:
    check("event audit "+action, action in audit_actions and audit_actions[action]["retentionClass"]=="security_long" and audit_actions[action]["sensitivity"]=="restricted")

device_tables={x["name"] for x in data["schemas"]["devices"]["tables"]}
check("no process persistence table", not any("process" in x for x in device_tables))
check("no service persistence table", not any("service" in x for x in device_tables))

planned={x["id"]:x for x in q["plannedOperations"]}
for opid,_,_,_ in expected:
    check("Step45Q planned "+opid, opid in planned and planned[opid]["step"]=="45T")

check("web exact seven implemented tabs", "['overview', 'hardware', 'software', 'performance', 'processes', 'services', 'network']" in page)
check("future Activity/Tickets still hidden", "'activity'" not in page and "'tickets'" not in page)
check("process query only active tab and online", "activeTab === 'processes'" in page and "query.data?.isOffline === false" in page)
check("service query only active tab and online", "activeTab === 'services'" in page)
check("manage actions permission gated", "usePermission('devices.manage')" in page and "canManage" in page)
check("process warning dialog", "stopProcessWarning" in page and "INNODialog" in page)
check("service warning dialog", "serviceActionWarning" in page)
check("offline process state", "liveProcessesUnavailableOffline" in page)
check("offline service state", "liveServicesUnavailableOffline" in page)
check("no native browser confirm", "window.confirm" not in page and "confirm(" not in page)
check("client process live flow", "getLiveDeviceProcesses" in client and "createDeviceProcessSnapshot" in client)
check("client service live flow", "getLiveDeviceServices" in client and "createDeviceServiceSnapshot" in client)
check("client action APIs", "terminateDeviceProcess" in client and "executeDeviceServiceAction" in client)
check("web process types", "interface DeviceProcessSnapshot" in types and "interface DeviceProcessItem" in types)
check("web service types", "interface DeviceServiceSnapshot" in types and "interface DeviceServiceItem" in types)

keys=[
    "devices.step45t.deviceDetail.processes",
    "devices.step45t.deviceDetail.services",
    "devices.step45t.deviceDetail.liveFromMeshAgent",
    "devices.step45t.deviceDetail.stopProcessWarning",
    "devices.step45t.deviceDetail.serviceActionWarning",
    "devices.step45t.deviceDetail.liveProcessesUnavailableOffline",
    "devices.step45t.deviceDetail.liveServicesUnavailableOffline",
]
for key in keys:
    check("locale pair "+key, key in en and key in th)

check("Endpoint Agent has no Step45T process executor", "pskill" not in agent_main and "serviceStart" not in agent_main and "serviceStop" not in agent_main)
check("Endpoint native host has no Step45T process executor", "pskill" not in agent_native and "serviceStart" not in agent_native and "serviceStop" not in agent_native)

print("step45t_checks="+str(checks))
print("step45t_issues="+str(len(issues)))
for issue in issues:
    print("ISSUE: "+issue)
raise SystemExit(1 if issues else 0)
