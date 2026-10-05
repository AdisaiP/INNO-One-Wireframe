from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parent
failures: list[str] = []
checks = 0

def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        failures.append(message)

def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")

definition_api = text("production/services/platform-api/src/Modules/Workflows/Api/WorkflowEndpoints.cs")
run_api = text("production/services/platform-api/src/Modules/Workflows/Api/DeviceAutomationRunEndpoints.cs")
worker = text("production/services/platform-api/src/Modules/Workflows/Infrastructure/WorkflowExecutionWorker.cs")
planner = text("production/services/platform-api/src/Modules/Workflows/Application/WorkflowExecutionPlan.cs")
executor = text("production/services/platform-api/src/Modules/Devices/Infrastructure/DeviceAutomationNodeExecutor.cs")
devices_module = text("production/services/platform-api/src/Modules/Devices/DevicesModule.cs")
seed = text("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
manifest = json.loads(text("production/module-manifests.json"))
app_root = text("production/apps/web-portal/src/app/AppRoot.tsx")
app_shell = text("production/apps/web-portal/src/app/AppShell.tsx")
list_page = text("production/apps/web-portal/src/pages/DevicesAutomationRulesPage.tsx")
editor = text("production/apps/web-portal/src/pages/DevicesAutomationRulePage.tsx")
history = text("production/apps/web-portal/src/pages/DevicesAutomationHistoryPage.tsx")
client = text("production/apps/web-portal/src/api/client.ts")
types = text("production/apps/web-portal/src/api/types.ts")
i18n_runtime = text("production/packages/i18n/src/index.tsx")
matrix = json.loads(text("inno-step44a-screen-interaction-matrix.json"))
api_qa = text("step45h-devices-automation-api-qa.py")
browser_qa = text("step45h-devices-automation-browser-qa.py")
broad_browser_qa = text("step42-production-ux-browser-qa.py")

# QA gate contracts.
check("step45h_api_checks=" in api_qa, "Step45H API runtime QA summary marker missing")
check("DEVICES_GROUP_PROVIDER_OWNED" in api_qa, "Step45H API QA does not prove provider-owned group guard")
check("step45h_browser_checks=" in browser_qa, "Step45H browser QA summary marker missing")
check("WIDTHS=(1366,1024,768)" in browser_qa, "Step45H browser QA does not cover canonical Web widths")
check("set_profile_locale(c,\"th-TH\")" in browser_qa, "Step45H browser QA does not cover Thai")
check('"/devices/automation", "/devices/automation/new"' in broad_browser_qa,
      "Broad Product browser QA does not include Devices Automation static routes")

# Owner-scoped definition persistence.
for marker in [
    '"/devices/automations"',
    '"/devices/automations/{automationId}"',
    '"/devices/automations/{automationId}/versions"',
    '"devices.automation.view"',
    '"devices.automation.manage"',
    '"devices.automation.definition"',
    '"Devices automation"',
]:
    check(marker in definition_api, "Devices definition facade missing: " + marker)
check('"devices"' in definition_api and "DevicesScope" in definition_api, "Devices owner scope missing")
check("MapDeviceAutomationRunEndpoints" in definition_api, "Devices run endpoints are not mapped")

# Permissions and manifest.
for permission in [
    "devices.automation.view",
    "devices.automation.manage",
    "devices.automation.run.view",
]:
    check(permission in seed, "Development seed missing permission: " + permission)
check("Step45HPermissions" in seed, "Step45H permission evolution group missing")
devices = next((item for item in manifest["modules"] if item["id"] == "devices"), None)
check(devices is not None, "Devices manifest missing")
if devices:
    for permission in [
        "devices.automation.view",
        "devices.automation.manage",
        "devices.automation.run.view",
    ]:
        check(permission in devices.get("permissions", []), "Devices manifest permission missing: " + permission)
    nav = {item["route"]: item for item in devices.get("navigation", [])}
    check("/devices/automation" in nav, "Devices Automation navigation missing")
    check(nav.get("/devices/automation", {}).get("permission") == "devices.automation.view",
          "Devices Automation navigation permission is wrong")
    check("device.group.membership.added" in devices.get("events", []),
          "Devices remediation event missing from manifest")

# Shared runtime owner integration.
check('"devices" => "devices.automation.manage"' in worker,
      "Worker does not re-check Devices automation permission")
check('"devices" => "devices.automation.run"' in worker,
      "Worker audit prefix is not Devices-owned")
check("The shared runtime currently executes" in planner,
      "Shared planner still exposes Helpdesk/Step45G-only wording")

# Run API and current-context preflight.
for marker in [
    'MapPost("/devices/automations/{automationId}/runs"',
    'MapGet("/devices/automations/{automationId}/runs"',
    'MapGet("/devices/automations/{automationId}/runs/{runId}"',
    '"devices.automation.manage"',
    '"devices.automation.run.view"',
    "IDeviceDirectoryReader",
    "ValidateRuleContext",
    '"device.online"',
    '"device.offline"',
    '"DEVICES_TRIGGER_CONTEXT_MISMATCH"',
    '"DEVICES_RULE_CONDITION_NOT_MATCHED"',
    "CanAccessDevice",
    "WorkflowExecutionPlanner.TryCreate",
    "DefinitionSnapshotJson = snapshot",
    '"devices.automation.run.queued"',
    '"automation.run.queued"',
]:
    check(marker in run_api, "Devices run contract missing: " + marker)
check("/helpdesk/" not in run_api, "Devices run API leaks Helpdesk routes")
check("condition" in run_api and "operatingSystem" in run_api and "groupId" in run_api,
      "Focused IF preflight contract missing")
check("BeginTransactionAsync" in run_api, "Devices run queue + ledger is not transactional")

# Devices remediation provider.
for marker in [
    "IAutomationNodeExecutor",
    'public string OwnerModule => "devices"',
    '"devices.device.add_to_group"',
    '"devices.manage"',
    "DeviceGroupMembers",
    'group.GroupType, "static"',
    "group.ExternalProvider",
    "group.ExternalGroupId",
    '"DEVICES_GROUP_PROVIDER_OWNED"',
    '"DEVICES_OUTSIDE_ASSIGNED_SCOPE"',
    "idempotentReplay",
    '"devices.automation.remediation.group_added"',
    '"device.group.membership.added"',
]:
    check(marker in executor, "Devices executor guard missing: " + marker)
check("IRemoteDeviceEngine" not in executor,
      "Step45H safe remediation must not invoke remote high-impact engine actions")
for risky in ["Restart", "Shutdown", "ExecuteScript", "RemoteSession"]:
    check(risky not in executor, "High-impact remediation leaked into executor: " + risky)
check("AddScoped<IAutomationNodeExecutor, DeviceAutomationNodeExecutor>" in devices_module,
      "Devices automation executor is not registered")

# Web Product routing and focused editor.
for marker in [
    'path="devices/automation"',
    'path="devices/automation/new"',
    'path="devices/automation/:automationId"',
    'path="devices/automation/:automationId/history"',
    "devices.automation.view",
    "devices.automation.manage",
    "devices.automation.run.view",
]:
    check(marker in app_root, "Devices Product route/permission missing: " + marker)
check('to="/devices/automation"' in app_shell and "canViewDeviceAutomation" in app_shell,
      "Devices contextual navigation missing Automation")
check("'/devices/automation'" in app_shell and "inDeviceDetail" in app_shell,
      "Devices Automation is not excluded from device-detail matching")

check("getDeviceAutomationDefinitions" in list_page, "Devices list does not use persisted API")
check("getDeviceAutomationDefinition" in editor, "Devices editor does not load persisted definition")
check("createDeviceAutomationDefinition" in editor, "Devices editor cannot create")
check("updateDeviceAutomationDefinition" in editor, "Devices editor cannot version-update")
check("device.online" in editor and "device.offline" in editor, "WHEN trigger choices missing")
check("conditionEnabled" in editor and "conditionField" in editor, "Focused IF editor missing")
check("devices.device.add_to_group" in editor, "Safe THEN action missing")
check("INNOWorkflowCanvas" not in editor, "Devices editor must not expose full React Flow canvas")
check("@inno/ui/workflow.css" not in editor, "Devices editor must not load workflow canvas CSS")
for risky in ["Restart", "Shutdown", "Execute Script", "Run Script"]:
    check(risky not in editor, "High-impact fake control leaked into Devices editor: " + risky)

check("getDeviceAutomationRuns" in history, "Devices P10 history does not use module run API")
check("startDeviceAutomationRun" in history, "Devices manual test-run action missing")
check("getDevices" in history, "Managed-device context selector missing")
check("INNODrawer" in history, "Run detail drawer missing")
check("definitionSnapshot.nodes" in history, "Run detail does not render immutable node labels")
check("refetchInterval" in history, "Active run polling missing")
check("useI18n()" in history and "useI18n()" in editor and "useI18n()" in list_page,
      "Devices Automation Product is not localized")

# API client/types.
for marker in [
    "getDeviceAutomationDefinitions",
    "getDeviceAutomationDefinition",
    "createDeviceAutomationDefinition",
    "updateDeviceAutomationDefinition",
    "getDeviceAutomationRuns",
    "getDeviceAutomationRun",
    "startDeviceAutomationRun",
]:
    check(marker in client, "Web Devices automation client missing: " + marker)
for marker in [
    "DeviceAutomationRunSummary",
    "DeviceAutomationRunDetail",
    "DeviceAutomationRunListResponse",
]:
    check(marker in types, "Web Devices run type missing: " + marker)

# Product interaction matrix.
routes = {item["route"]: item for item in matrix["routes"]}
check(len(routes) == 70, "Current Product matrix must contain 70 screen patterns after Step45I")
expected = {
    "devices/automation": ("DevicesAutomationRulesPage", "P02"),
    "devices/automation/new": ("DevicesAutomationRulePage", "P04"),
    "devices/automation/:automationId": ("DevicesAutomationRulePage", "P04"),
    "devices/automation/:automationId/history": ("DevicesAutomationHistoryPage", "P10"),
}
for route, (page, pattern) in expected.items():
    item = routes.get(route, {})
    check(item.get("page") == page, route + " page classification is wrong")
    check(item.get("pattern") == pattern, route + " interaction pattern is wrong")
check(routes["devices/automation/new"].get("specialComponent") is None,
      "Focused Devices editor must not declare workflow canvas")

# Bilingual catalog parity / registration.
en = json.loads(text("production/packages/i18n/src/locales/en-US/devices.json"))
th = json.loads(text("production/packages/i18n/src/locales/th-TH/devices.json"))
check(set(en) == set(th), "Devices locale key parity failed")
check(all(str(value).strip() for value in en.values()), "Devices English catalog has blank values")
check(all(str(value).strip() for value in th.values()), "Devices Thai catalog has blank values")
check("enDevices" in i18n_runtime and "thDevices" in i18n_runtime,
      "Devices locale catalog is not registered")
for key in [
    "devices.automation.title",
    "devices.automation.editor.when",
    "devices.automation.editor.if",
    "devices.automation.editor.then",
    "devices.automation.runs.title",
    "devices.automation.runs.status.completed",
    "devices.automation.runs.error.DEVICES_GROUP_PROVIDER_OWNED",
]:
    check(key in en and key in th, "Devices translation missing: " + key)

print(f"step45h_checks={checks}")
print(f"step45h_failures={len(failures)}")
for failure in failures:
    print(" -", failure)

sys.exit(1 if failures else 0)
