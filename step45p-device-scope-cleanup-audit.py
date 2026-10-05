from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parent
failures = []
checks = 0

def check(name, condition, detail=""):
    global checks
    checks += 1
    if condition:
        print("PASS " + name)
    else:
        print("FAIL " + name + (" :: " + detail if detail else ""))
        failures.append((name, detail))

def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

app_root = read("production/apps/web-portal/src/app/AppRoot.tsx")
app_shell = read("production/apps/web-portal/src/app/AppShell.tsx")
client = read("production/apps/web-portal/src/api/client.ts")
types = read("production/apps/web-portal/src/api/types.ts")
workflow = read("production/services/platform-api/src/Modules/Workflows/Api/WorkflowEndpoints.cs")
worker = read("production/services/platform-api/src/Modules/Workflows/Infrastructure/WorkflowExecutionWorker.cs")
devices_module = read("production/services/platform-api/src/Modules/Devices/DevicesModule.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
manifest = json.loads(read("production/module-manifests.json"))
en = json.loads(read("production/packages/i18n/src/locales/en-US/devices.json"))
th = json.loads(read("production/packages/i18n/src/locales/th-TH/devices.json"))

devices = next(x for x in manifest["modules"] if x["id"] == "devices")

check("device automation nav removed", "/devices/automation" not in app_shell)
check("device automation pages not imported", "DevicesAutomation" not in app_root)
check("legacy device automation bookmarks redirect", 'path="devices/automation/*"' in app_root and 'to="/devices"' in app_root)
check("device automation permissions removed from web", "devices.automation." not in app_root and "devices.automation." not in app_shell)
check("device automation web client removed", "getDeviceAutomation" not in client and "createDeviceAutomation" not in client and "updateDeviceAutomation" not in client)
check("device automation web types removed", "DeviceAutomationRun" not in types)
check("device automation api facade removed", "/devices/automations" not in workflow and "DevicesScope" not in workflow)
check("device automation run mapper removed", "MapDeviceAutomationRunEndpoints" not in workflow)
check("device automation worker permission removed", "devices.automation." not in worker)
check("device automation executor registration removed", "DeviceAutomationNodeExecutor" not in devices_module)
check("device automation permissions removed from seed", "devices.automation." not in seed and "Step45HPermissions" not in seed)
check("device manifest permissions retired", not any(x.startswith("devices.automation.") for x in devices["permissions"]))
check("device manifest automation nav retired", not any(x.get("route","").startswith("/devices/automation") for x in devices["navigation"]))
check("device automation locale namespace retired", not any(x.startswith("devices.automation.") for x in en) and not any(x.startswith("devices.automation.") for x in th))
check("generic device labels retained", all(k in en and k in th for k in [
    "devices.shared.field.deviceGroup",
    "devices.shared.field.operatingSystem",
    "devices.shared.deviceType.notebook",
    "devices.shared.status.online",
    "devices.shared.status.offline",
]))
check("assets automation preserved", "/assets/automations" in workflow)
check("helpdesk automation preserved", "/helpdesk/automations" in workflow)
check("assets automation permission preserved", "assets.automation.manage" in worker)
check("helpdesk automation permission preserved", "helpdesk.automation.manage" in worker)

for rel in [
    "production/apps/web-portal/src/pages/DevicesAutomationRulesPage.tsx",
    "production/apps/web-portal/src/pages/DevicesAutomationRulePage.tsx",
    "production/apps/web-portal/src/pages/DevicesAutomationHistoryPage.tsx",
    "production/services/platform-api/src/Modules/Devices/Infrastructure/DeviceAutomationNodeExecutor.cs",
    "production/services/platform-api/src/Modules/Workflows/Api/DeviceAutomationRunEndpoints.cs",
]:
    check("retired file absent " + Path(rel).name, not (ROOT / rel).exists())

print("step45p_checks=" + str(checks))
print("step45p_failures=" + str(len(failures)))
sys.exit(1 if failures else 0)
