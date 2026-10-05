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
data=json.loads(read("inno-data-model-contract.json"))
q=json.loads(read("inno-step45q-devices-tor-contract.json"))
program=read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
domain=read("production/services/platform-api/src/Modules/Devices/Domain/DeviceEntities.cs")
db=read("production/services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs")
endpoint=read("production/services/platform-api/src/Modules/Devices/Api/DevicePerformanceNetworkEndpoints.cs")
ingest=read("production/services/platform-api/src/Modules/Devices/Api/AgentTelemetryEndpoints.cs")
seed=read("production/services/platform-api/src/Modules/Devices/Infrastructure/DevicesDevelopmentSeed.cs")
agent_main=read("production/apps/endpoint-agent/src/main.tsx")
agent_api=read("production/apps/endpoint-agent/src/api.ts")
agent_native=read("production/apps/endpoint-agent/src-tauri/src/main.rs")
agent_manifest=read("production/apps/endpoint-agent/src-tauri/Cargo.toml")
page=read("production/apps/web-portal/src/pages/DeviceDetailPage.tsx")
client=read("production/apps/web-portal/src/api/client.ts")
types=read("production/apps/web-portal/src/api/types.ts")
css=read("production/apps/web-portal/src/shell.css")
en=json.loads(read("production/packages/i18n/src/locales/en-US/devices.json"))
th=json.loads(read("production/packages/i18n/src/locales/th-TH/devices.json"))

ops={x["id"]:x for x in api["endpoints"]}
for op_id,method,path in [
    ("devices.performance.get","GET","/devices/{deviceId}/performance"),
    ("devices.network_inventory.get","GET","/devices/{deviceId}/network-inventory"),
    ("agent.telemetry.ingest","POST","/agent/devices/{deviceId}/telemetry"),
]:
    check("API "+op_id, op_id in ops and ops[op_id]["method"]==method and ops[op_id]["path"]==path)

check("performance read permission", ops["devices.performance.get"]["permission"]=="devices.view" and ops["devices.performance.get"]["scope"]=="resource")
check("network read permission", ops["devices.network_inventory.get"]["permission"]=="devices.view" and ops["devices.network_inventory.get"]["scope"]=="resource")
check("agent telemetry self boundary", ops["agent.telemetry.ingest"].get("scope")=="self" and ops["agent.telemetry.ingest"].get("authMode")=="agent-device")

device_tables={x["name"] for x in data["schemas"]["devices"]["tables"]}
check("performance table promoted", "device_performance_samples" in device_tables)
check("inventory snapshot retained", "device_inventory_snapshots" in device_tables)
check("Step45Q performance operation matches", any(x["id"]=="devices.performance.get" for x in q["plannedOperations"]))
check("Step45Q network operation matches", any(x["id"]=="devices.network_inventory.get" for x in q["plannedOperations"]))

check("performance entity", "class DevicePerformanceSample" in domain)
check("performance DbSet", "DevicePerformanceSamples" in db)
check("performance table mapping", 'ToTable("device_performance_samples")' in db)
check("network observation independently timestamped", all(x in domain for x in ["NetworkObservedAt","NetworkReceivedAt","NetworkSource","NetworkSourceInstance"]))
check("network fields normalized", all(x in domain for x in ["SubnetMask","Gateway","DnsServers","NetworkAdapterName","AgentLatencyMs","PacketLossPercent"]))

migrations=list((ROOT/"production/services/platform-api/src/Modules/Devices/Persistence/Migrations").glob("*_Step45SPerformanceNetwork.cs"))
check("one Step45S migration", len(migrations)==1)
migration=migrations[0].read_text(encoding="utf-8") if migrations else ""
check("migration creates performance table", 'name: "device_performance_samples"' in migration)
check("migration adds independent network fields", all(x in migration for x in ["network_observed_at","network_received_at","network_source","subnet_mask","gateway","dns_servers","network_adapter_name"]))
check("migration backfills historical performance", "device_performance_samples" in migration and "legacy_device_row" in migration)

check("runtime maps Step45S endpoints", "MapAgentTelemetryEndpoints" in program and "MapDevicePerformanceNetworkEndpoints" in program)
check("performance resource scope enforced", "CanAccessDeviceAsync" in endpoint and '"devices.view"' in endpoint)
check("live requires endpoint agent", 'latest.Source == "endpoint_agent"' in endpoint)
check("live threshold 60 seconds", "AddSeconds(-60)" in endpoint)
check("network stale threshold 15 minutes", "AddMinutes(-15)" in endpoint)
check("network does not invent missing observation", '"not_reported"' in endpoint)
check("agent telemetry owns user device only", "AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER" in ingest)
check("telemetry future time rejected", "AddMinutes(5)" in ingest)
check("telemetry old sample rejected", "AddHours(-1)" in ingest)
check("performance validation bounds", "CPU percent must be between 0 and 100." in ingest)
check("network validation bounds", "Packet loss percent must be between 0 and 100." in ingest)
check("endpoint source persisted", 'Source = "endpoint_agent"' in ingest and 'NetworkSource = "endpoint_agent"' in ingest)
check("bounded performance retention", "AddHours(-1)" in ingest and "ExecuteDeleteAsync" in ingest)

check("agent native sysinfo dependency", 'sysinfo = "0.37.2"' in agent_manifest)
check("agent native performance command", "collect_performance_telemetry" in agent_native and "System::new_all()" in agent_native)
check("agent native network command", "collect_network_telemetry" in agent_native and "Get-NetIPConfiguration" in agent_native)
check("agent telemetry only in native runtime", "isNativeAgentRuntime()" in agent_main)
check("agent requires online managed device", "if (!profile || !device || !online || !isNativeAgentRuntime()) return;" in agent_main)
check("agent publishes every 5 seconds", "}, 5000);" in agent_main)
check("network cadence every 12 ticks", "ticks % 12 === 0" in agent_main)
check("agent telemetry best effort", "Telemetry is best-effort" in agent_main)
check("agent telemetry API client", "/telemetry" in agent_api and "submitTelemetry" in agent_api)

check("web performance client", "getDevicePerformance" in client)
check("web network client", "getDeviceNetworkInventory" in client)
check("web performance type", "interface DevicePerformance" in types)
check("web network type", "interface DeviceNetworkInventory" in types)
check("five implemented tabs only", "['overview', 'hardware', 'software', 'performance', 'network']" in page)
check("future tabs remain unavailable", "'processes'" not in page and "'services'" not in page and "'activity'" not in page and "'tickets'" not in page)
check("performance query active only in performance tab", "activeTab === 'performance'" in page)
check("network query active only in network tab", "activeTab === 'network'" in page)
check("performance chart renders real points", "performance-sparkline" in page and "performance?.points.map" in page and "performanceCpuPoints" in page)
check("network UI does not claim Healthy", "Healthy" not in page)
check("tab loading is local not page-level", "device-tab-loading-wrap" in page and "device-tab-loading-wrap" in css)
check("Step45S tab loaders do not use page loader", 'page-loading-wrap"><LoadingState label={t45n(\'devices.step45s' not in page)

keys=[
    "devices.step45s.deviceDetail.performance",
    "devices.step45s.deviceDetail.network",
    "devices.step45s.deviceDetail.live",
    "devices.step45s.deviceDetail.noPerformanceData",
    "devices.step45s.deviceDetail.networkNotReported",
    "devices.step45s.deviceDetail.networkConfiguration",
]
for key in keys:
    check("locale pair "+key, key in en and key in th)

print("step45s_checks="+str(checks))
print("step45s_issues="+str(len(issues)))
for issue in issues:
    print("ISSUE: "+issue)
raise SystemExit(1 if issues else 0)
