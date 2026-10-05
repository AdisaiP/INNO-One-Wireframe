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
    checks+=1
    print(("PASS " if ok else "FAIL ")+name)
    if not ok: issues.append(name)

api=json.loads(read("inno-api-contract.json"))
openapi=json.loads(read("openapi-inno-one-v1.json"))
data=json.loads(read("inno-data-model-contract.json"))
q=json.loads(read("inno-step45q-devices-tor-contract.json"))
domain=read("production/services/platform-api/src/Modules/Devices/Domain/DeviceEntities.cs")
db=read("production/services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs")
program=read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
endpoint=read("production/services/platform-api/src/Modules/Devices/Api/DeviceHardwareInventoryEndpoints.cs")
seed=read("production/services/platform-api/src/Modules/Devices/Infrastructure/DevicesDevelopmentSeed.cs")
client=read("production/apps/web-portal/src/api/client.ts")
types=read("production/apps/web-portal/src/api/types.ts")
page=read("production/apps/web-portal/src/pages/DeviceDetailPage.tsx")
en=json.loads(read("production/packages/i18n/src/locales/en-US/devices.json"))
th=json.loads(read("production/packages/i18n/src/locales/th-TH/devices.json"))

migrations=list((ROOT/"production/services/platform-api/src/Modules/Devices/Persistence/Migrations").glob("*_Step45RDeviceHardwareInventory.cs"))
check("one Step45R migration", len(migrations)==1)
migration=migrations[0].read_text(encoding="utf-8") if migrations else ""

ops={x["id"]:x for x in api["endpoints"]}
check("hardware API promoted", "devices.hardware_inventory.get" in ops)
if "devices.hardware_inventory.get" in ops:
    op=ops["devices.hardware_inventory.get"]
    check("hardware API path", op["method"]=="GET" and op["path"]=="/devices/{deviceId}/hardware-inventory")
    check("hardware API permission", op["permission"]=="devices.view" and op["scope"]=="resource")
check("hardware OpenAPI promoted", "/devices/{deviceId}/hardware-inventory" in openapi["paths"])
check("device-detail coverage promoted", "devices.hardware_inventory.get" in api["screenCoverage"]["device-detail-v2.html"])
check("Step45Q operation matches implementation", any(x["id"]=="devices.hardware_inventory.get" and x["path"]=="/devices/{deviceId}/hardware-inventory" for x in q["plannedOperations"]))

check("hardware snapshot entity exists", "class DeviceInventorySnapshot" in domain)
check("hardware snapshot DbSet exists", "DeviceInventorySnapshots" in db)
check("hardware snapshot table mapped", 'ToTable("device_inventory_snapshots")' in db)
check("hardware snapshot planned table exists globally", any(x["name"]=="device_inventory_snapshots" for x in data["schemas"]["devices"]["tables"]))
check("migration creates snapshot table", 'name: "device_inventory_snapshots"' in migration)
check("migration backfills legacy evidence", "legacy_device_row" in migration and "step45r-backfill" in migration)
check("migration preserves observation time", "COALESCE(d.last_seen_at, d.updated_at)" in migration)
check("development seed hardware evidence", "SeedHardwareInventoryAsync" in seed and 'Source = "development_seed"' in seed)

check("hardware endpoint mapped", "MapDeviceHardwareInventoryEndpoints" in program)
check("hardware endpoint resource scope", "CanAccessDeviceAsync" in endpoint and '"devices.view"' in endpoint)
check("hardware stale threshold 24h", "AddHours(-24)" in endpoint)
check("hardware not reported state", '"not_reported"' in endpoint)
check("hardware response hides product keys", "ProductKey" not in endpoint and "Password" not in endpoint)

check("web hardware type exists", "interface DeviceHardwareInventory" in types)
check("web hardware client exists", "getDeviceHardwareInventory" in client)
check("detail uses query-string tabs", "useSearchParams" in page and "next.set('tab', tab)" in page)
check("Step45R active tab set", "['overview', 'hardware', 'software']" in page)
check("hardware query wired", "getDeviceHardwareInventory" in page and "hardware-inventory" in page)
check("hardware panel present", "device-hardware-grid" in page)
check("overview prefers hardware evidence", "hardware?.serialNumber ?? device.serialNumber" in page)
check("software stale evidence visible", "softwareIsStale" in page and "softwareStaleDescription" in page)
check("unknown tab falls back overview", ": 'overview';" in page)
check("no fake refresh action", "Refresh Inventory" not in page and "inventory-refreshes" not in endpoint)
check("Device Automation remains retired", "/devices/automation" not in page and "DevicesAutomation" not in page)

keys=[
 "devices.step45r.deviceDetail.hardware",
 "devices.step45r.deviceDetail.hardwareInventory",
 "devices.step45r.deviceDetail.stale",
 "devices.step45r.deviceDetail.partialEvidence",
 "devices.step45r.deviceDetail.gbValue",
 "devices.shared.deviceType.desktop",
 "devices.shared.status.online",
 "devices.shared.status.offline",
]
for key in keys:
    check("locale pair "+key, key in en and key in th)

print("step45r_checks="+str(checks))
print("step45r_issues="+str(len(issues)))
for issue in issues: print("ISSUE: "+issue)
raise SystemExit(1 if issues else 0)
