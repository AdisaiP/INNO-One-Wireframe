#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
contract = json.loads((ROOT / "inno-step45q-devices-tor-contract.json").read_text(encoding="utf-8"))
api = json.loads((ROOT / "inno-api-contract.json").read_text(encoding="utf-8"))
data = json.loads((ROOT / "inno-data-model-contract.json").read_text(encoding="utf-8"))
impl = json.loads((ROOT / "inno-implementation-contract.json").read_text(encoding="utf-8"))
wireframe = (ROOT / "device-detail-v2.html").read_text(encoding="utf-8")
doc = (ROOT / "INNO-One-Step45Q-Devices-TOR-Contract.md").read_text(encoding="utf-8")

issues = []
checks = 0

def check(name, condition):
    global checks
    checks += 1
    if not condition:
        issues.append(name)

check("contract version", contract.get("contractVersion") == "1.0.0")
check("status frozen", contract.get("status") == "frozen-planning")
check("base commit", contract.get("baseCommit") == "b541e90")
check("global API baseline", contract["globalContracts"]["api"] == api.get("contractVersion") == "0.5.0")
check("global data baseline", contract["globalContracts"]["dataModel"] == data.get("contractVersion") == "0.6.0")
check("automation retired", contract["scope"].get("deviceAutomationRetired") is True)
check("TOR required", contract["scope"].get("devicesTorRequired") is True)

expected_sidebar = [
    ("overview", "/devices/overview"),
    ("devices", "/devices"),
    ("discovery", "/devices/discovery"),
    ("groups", "/devices/groups"),
    ("remote-operations", "/devices/remote-operations"),
    ("remote-consent", "/devices/remote-consent"),
    ("inventory-query", "/devices/query"),
    ("deployment-jobs", "/devices/deployments"),
    ("agent-maintenance", "/devices/maintenance"),
    ("endpoint-policies", "/devices/policies"),
    ("active-alerts", "/devices/alerts"),
]
sidebar = contract["sidebar"]
check("sidebar count 11", len(sidebar) == 11)
check("sidebar order", [(x["id"], x["route"]) for x in sidebar] == expected_sidebar)
check("sidebar TOR wireframes exist", all(all((ROOT / wf).exists() for wf in x["wireframes"]) for x in sidebar))

expected_tabs = ["overview","hardware","software","performance","processes","services","network","activity","tickets"]
tabs = contract["deviceDetail"]["tabs"]
check("detail pattern P03", contract["deviceDetail"]["pattern"] == "P03")
check("detail deep link query", contract["deviceDetail"]["deepLink"] == {"queryParameter":"tab","default":"overview"})
check("tab count 9", len(tabs) == 9)
check("tab order", [x["id"] for x in tabs] == expected_tabs)
wireframe_tabs = re.findall(r'data-tab="([^"]+)"', wireframe)
check("wireframe tab order", wireframe_tabs[:9] == expected_tabs)

planned = contract["plannedOperations"]
planned_ids = [x["id"] for x in planned]
planned_pairs = [(x["method"], x["path"]) for x in planned]
check("planned operation ids unique", len(planned_ids) == len(set(planned_ids)))
check("planned method/path unique", len(planned_pairs) == len(set(planned_pairs)))
check("process terminate permission", next(x for x in planned if x["id"] == "devices.process.terminate")["permission"] == "devices.manage")
check("service action permission", next(x for x in planned if x["id"] == "devices.service.action")["permission"] == "devices.manage")
check("tickets stay Helpdesk", next(x for x in tabs if x["id"] == "tickets")["owner"] == "helpdesk")
check("processes ephemeral", next(x for x in tabs if x["id"] == "processes")["persistence"] == "none-ephemeral-result")
check("services ephemeral", next(x for x in tabs if x["id"] == "services")["persistence"] == "none-ephemeral-result")
check("hardware freshness 24h", "24h" in next(x for x in tabs if x["id"] == "hardware")["freshness"])
check("network freshness 15m", "15m" in next(x for x in tabs if x["id"] == "network")["freshness"])
check("performance live 60s", "60s" in next(x for x in tabs if x["id"] == "performance")["freshness"])

api_ops = {x["id"]: x for x in api["endpoints"]}
for op in [
    "devices.overview.get",
    "devices.list",
    "devices.discovery_scan.create",
    "devices.groups.list",
    "devices.remote_sessions.list",
    "devices.consent_policy.get",
    "devices.deployments.list",
    "devices.agent_rollouts.list",
    "devices.policies.list",
    "devices.alerts.list",
    "devices.software_inventory.get",
    "helpdesk.tickets.list",
]:
    check("global op " + op, op in api_ops)

known_permissions = set(impl.get("existingPermissions", [])) | set(impl.get("reservedImplementationPermissions", []))
for permission in [
    "devices.view",
    "devices.manage",
    "devices.remote",
    "devices.remote.consent.manage",
    "devices.deploy",
    "devices.policy.manage",
    "devices.alert.view",
    "devices.alert.manage",
    "helpdesk.ticket.view",
    "helpdesk.ticket.create",
]:
    check("known permission " + permission, permission in known_permissions)

device_tables = {x["name"] for x in data["schemas"]["devices"]["tables"]}
for table in [
    "devices",
    "device_inventory_snapshots",
    "software_inventory_snapshots",
    "installed_software",
    "remote_sessions",
    "deployment_jobs",
    "agent_rollouts",
    "maintenance_jobs",
    "endpoint_policies",
    "device_alerts",
]:
    check("global device table " + table, table in device_tables)

ticket_table = next(x for x in data["schemas"]["helpdesk"]["tables"] if x["name"] == "tickets")
check("ticket related device reference", any(x.get("column") == "related_device_id" and x.get("target") == "devices.devices" for x in ticket_table.get("crossModuleRefs", [])))

planned_tables = {x["table"] for x in contract["plannedPersistence"]}
check("planned performance table", "devices.device_performance_samples" in planned_tables)
check("planned activity table", "devices.device_activity_items" in planned_tables)
check("Step45S performance table promoted", "device_performance_samples" in device_tables)
check("Step45U activity table not prematurely global", "device_activity_items" not in device_tables)

states = " ".join(contract["stateRules"])
check("offline cached contract", "Cached Overview, Hardware, Software and Network" in states)
check("live tabs no fake cache", "Processes and Services never fabricate" in states)
check("tab local ticket permission", "tab-local Permission Denied" in states)

check("doc sidebar requirement", "TOR-required Devices navigation" in doc)
check("doc nine tabs", "nine Device Detail tabs" in doc)
check("doc automation excluded", "Device Automation remains retired" in doc)
check("doc no backend implementation", "does not:" in doc and "implement backend endpoints" in doc)

production_root = (ROOT / "production/apps/web-portal/src/app/AppRoot.tsx").read_text(encoding="utf-8")
production_shell = (ROOT / "production/apps/web-portal/src/app/AppShell.tsx").read_text(encoding="utf-8")
check("Step45V promotes Remote Operations route", 'path="devices/remote-operations"' in production_root)
check("Step45V promotes Remote Operations nav", 'to="/devices/remote-operations"' in production_shell)
check("Step45W promotes Deployment Jobs route", 'path="devices/deployments"' in production_root)
check("Step45W promotes Deployment Jobs nav", 'to="/devices/deployments"' in production_shell)
check("Step45W promotes Agent Maintenance route", 'path="devices/maintenance"' in production_root)
check("Step45W promotes Agent Maintenance nav", 'to="/devices/maintenance"' in production_shell)
check("Step45X routes remain hidden", 'path="devices/policies"' not in production_root and 'path="devices/alerts"' not in production_root)
check("Step45X nav remains hidden", 'to="/devices/policies"' not in production_shell and 'to="/devices/alerts"' not in production_shell)
check("Device Automation remains retired in Product", "/devices/automation" not in production_shell)

print("step45q_checks=" + str(checks))
print("step45q_sidebar_routes=" + str(len(sidebar)))
print("step45q_detail_tabs=" + str(len(tabs)))
print("step45q_planned_operations=" + str(len(planned)))
print("step45q_issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)
raise SystemExit(1 if issues else 0)
