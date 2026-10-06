#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
issues = []
checks = 0

def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

def check(name, condition):
    global checks
    checks += 1
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        issues.append(name)

api = json.loads(read("inno-api-contract.json"))
data = json.loads(read("inno-data-model-contract.json"))
event = json.loads(read("inno-event-audit-contract.json"))
impl = json.loads(read("inno-implementation-contract.json"))
domain = read("production/services/platform-api/src/Modules/Devices/Domain/DeviceEntities.cs")
db = read("production/services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs")
governance = read("production/services/platform-api/src/Modules/Devices/Api/DeviceGovernanceEndpoints.cs")
alerts = read("production/services/platform-api/src/Modules/Devices/Api/DeviceAlertEndpoints.cs")
worker = read("production/services/platform-api/src/Modules/Devices/Infrastructure/DeviceGovernanceWorker.cs")
module = read("production/services/platform-api/src/Modules/Devices/DevicesModule.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
overview_page = read("production/apps/web-portal/src/pages/DevicesOverviewPage.tsx")
policy_page = read("production/apps/web-portal/src/pages/EndpointPoliciesPage.tsx")
alert_page = read("production/apps/web-portal/src/pages/DeviceAlertsPages.tsx")
app = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")

ops = {x["id"]: x for x in api["endpoints"]}
expected_ops = {
    "devices.overview.get": ("GET", "/devices/overview", "devices.view", "effective"),
    "devices.policies.list": ("GET", "/devices/policies", "devices.view", "effective"),
    "devices.policies.get": ("GET", "/devices/policies/{policyId}", "devices.view", "resource"),
    "devices.policies.update": ("PUT", "/devices/policies/{policyId}", "devices.policy.manage", "resource"),
    "devices.policy_compliance.list": ("GET", "/devices/policies/{policyId}/compliance", "devices.view", "resource"),
    "devices.alerts.list": ("GET", "/devices/alerts", "devices.alert.view", "effective"),
    "devices.alerts.ack": ("POST", "/devices/alerts/{alertId}/acknowledge", "devices.alert.manage", "resource"),
    "devices.alerts.ack_all": ("POST", "/devices/alerts/acknowledge-all", "devices.alert.manage", "effective"),
    "devices.alert_rules.list": ("GET", "/devices/alert-rules", "devices.alert.view", "effective"),
    "devices.alert_rules.get": ("GET", "/devices/alert-rules/{ruleId}", "devices.alert.view", "resource"),
    "devices.alert_rules.create": ("POST", "/devices/alert-rules", "devices.alert.manage", "effective"),
    "devices.alert_rules.update": ("PUT", "/devices/alert-rules/{ruleId}", "devices.alert.manage", "resource"),
    "devices.alert_channels.get": ("GET", "/devices/alert-channels", "devices.alert.view", "all"),
    "devices.alert_channels.update": ("PUT", "/devices/alert-channels", "devices.alert.manage", "all"),
    "devices.alert_channels.test": ("POST", "/devices/alert-channels/tests", "devices.alert.manage", "all"),
    "devices.alert_history.list": ("GET", "/devices/alert-history", "devices.alert.view", "effective"),
}

for op_id, expected in expected_ops.items():
    check("frozen API " + op_id, op_id in ops)
    if op_id in ops:
        item = ops[op_id]
        check(op_id + " method", item["method"] == expected[0])
        check(op_id + " path", item["path"] == expected[1])
        check(op_id + " permission", item["permission"] == expected[2])
        check(op_id + " scope", item["scope"] == expected[3])

device_tables = {x["name"] for x in data["schemas"]["devices"]["tables"]}
for table in [
    "endpoint_policies",
    "policy_assignments",
    "policy_compliance",
    "device_alerts",
    "device_alert_rules",
    "alert_channels",
    "alert_delivery_history",
]:
    check("data contract table " + table, table in device_tables)
    check("EF table " + table, f'ToTable("{table}")' in db)

for entity in [
    "EndpointPolicy",
    "PolicyAssignment",
    "PolicyCompliance",
    "DeviceAlert",
    "DeviceAlertRule",
    "AlertChannel",
    "AlertDeliveryHistory",
]:
    check("domain entity " + entity, f"class {entity}" in domain)

for permission in [
    "devices.policy.manage",
    "devices.alert.view",
    "devices.alert.manage",
]:
    check("permission promoted to Platform seed " + permission, permission in seed)
    known = set(impl.get("existingPermissions", [])) | set(impl.get("reservedImplementationPermissions", []))
    check("permission remains implementation-contract known " + permission, permission in known)

check("PlatformAdmin receives Step45X permissions", "Step45XPermissions.Select(x => new RolePermission" in seed)
check("Step45X permission repair path", ".Concat(Step45XPermissions)" in seed)

check("governance endpoints mapped", "MapDeviceGovernanceEndpoints" in program)
check("alert endpoints mapped", "MapDeviceAlertEndpoints" in program)
check("governance worker registered", "AddHostedService<DeviceGovernanceWorker>" in module)

for marker in [
    'MapGet("/devices/overview"',
    'MapGet("/devices/policies"',
    'MapGet("/devices/policies/{policyId}"',
    'MapPut("/devices/policies/{policyId}"',
    'MapGet("/devices/policies/{policyId}/compliance"',
]:
    check("runtime governance API " + marker, marker in governance)

for marker in [
    'MapGet("/devices/alerts"',
    'MapPost("/devices/alerts/{alertId}/acknowledge"',
    'MapPost("/devices/alerts/acknowledge-all"',
    'MapGet("/devices/alert-rules"',
    'MapGet("/devices/alert-rules/{ruleId}"',
    'MapPost("/devices/alert-rules"',
    'MapPut("/devices/alert-rules/{ruleId}"',
    'MapGet("/devices/alert-channels"',
    'MapPut("/devices/alert-channels"',
    'MapPost("/devices/alert-channels/tests"',
    'MapGet("/devices/alert-history"',
]:
    check("runtime alert API " + marker, marker in alerts)

check("overview uses effective Device scope", "ApplyDeviceScope" in governance and "OrganizationIds" in governance and "LocationIds" in governance and "DeviceGroupIds" in governance)
check("overview KPI reads DB not constants", "db.Devices.AsNoTracking()" in governance and "db.DeviceAlerts.AsNoTracking()" in governance)
check("overview exposes OS distribution", "OperatingSystems" in governance and "OsBucket" in governance)
check("overview exposes manufacturer distribution", "Manufacturers" in governance)

check("policy update requires devices.policy.manage", '"devices.policy.manage"' in governance)
check("policy compliance scoped to accessible Devices", "join device in accessibleDevices" in governance)
check("policy update audit", '"devices.policy.updated"' in governance)
check("policy evidence remains explicit", "EvidenceSource" in domain and "EvidenceSource" in governance)

check("default policy USB", '"USB Storage Control"' in worker)
check("default policy Remote Consent", '"Remote Consent"' in worker)
check("default policy Screen Capture", '"Screen Capture"' in worker)
check("default policy Agent Update", '"Agent Update"' in worker)
check("USB evidence missing stays pending", '"endpoint_evidence_missing"' in worker)
check("Remote Consent per-device state stays pending", '"product_control_plane"' in worker and '"pending"' in worker)
check("Agent update evaluates reported version", 'policy.PolicyType == "agent_update"' in worker and "device.AgentVersion" in worker)
check("Agent update has non-compliant path", '"non_compliant"' in worker)
check("compliance rows are materialized", "db.PolicyCompliance.Add" in worker)
check("stale compliance removed", "db.PolicyCompliance.RemoveRange" in worker)

check("offline anomaly is active evaluator", 'RuleType == "offline_anomaly"' in worker or 'x.RuleType == "offline_anomaly"' in worker)
check("offline threshold uses real group membership", "DeviceGroupMembers" in worker and "ConnectivityState" in worker)
check("hardware rule exists but not fabricated", '"Hardware change detected"' in worker and 'RuleType == "hardware_change"' not in worker)
check("software rule exists but not fabricated", '"Software inventory changed"' in worker and 'RuleType == "software_change"' not in worker)
check("baseline rule exists but not fabricated", '"Asset baseline drift"' in worker and 'RuleType == "baseline_drift"' not in worker)
check("alert resolve lifecycle", 'alert.Status = "resolved"' in worker)
check("alert create outbox", '"device.alert.created"' in worker)
check("console delivery history", 'ChannelType = "console"' in worker and 'AlertDeliveryHistory' in worker)
check("email default disabled", 'ChannelType = "email"' in worker and "Enabled = false" in worker)
check("email default explicitly not configured", 'Status = "not_configured"' in worker)

check("alert list permission", '"devices.alert.view"' in alerts)
check("alert manage permission", '"devices.alert.manage"' in alerts)
check("alert acknowledgement audit", '"devices.alert.acknowledged"' in alerts)
check("alert acknowledgement outbox", '"device.alert.acknowledged"' in alerts)
check("alert rule create audit", '"devices.alert_rule.created"' in alerts)
check("alert rule update audit", '"devices.alert_rule.updated"' in alerts)
check("alert rule event", '"device.alert.rule.updated"' in alerts)
check("channel update audit", '"devices.alert_channels.updated"' in alerts)
check("email channel validates recipients", "not_configured" in alerts and "HasEmailRecipients" in alerts)
check("channel test uses operation ledger", '"devices.alert_channels.test"' in alerts and "CreateOperationAsync" in alerts)
check("history is effective-scope filtered", "ApplyAlertScope" in alerts and "ListHistoryAsync" in alerts)

audit_actions = {x["action"] for x in event.get("auditActions", [])}
for action in [
    "devices.policy.updated",
    "devices.alert.acknowledged",
    "devices.alert_rule.created",
    "devices.alert_rule.updated",
    "devices.alert_channels.updated",
]:
    check("audit contract " + action, action in audit_actions)

event_types = {x["type"] for x in event.get("events", event.get("eventTypes", []))}
for event_type in [
    "device.alert.created",
    "device.alert.acknowledged",
    "device.alert.rule.updated",
]:
    check("event contract " + event_type, event_type in event_types)

for web_type in [
    "DeviceOverview",
    "EndpointPolicySummary",
    "EndpointPolicyDetail",
    "PolicyComplianceItem",
    "DeviceAlertItem",
    "DeviceAlertRule",
    "DeviceAlertChannels",
    "AlertHistoryItem",
]:
    check("web type " + web_type, f"interface {web_type}" in types)

for client_fn in [
    "getDeviceOverview",
    "getEndpointPolicies",
    "getEndpointPolicy",
    "updateEndpointPolicy",
    "getPolicyCompliance",
    "getDeviceAlerts",
    "acknowledgeDeviceAlert",
    "acknowledgeAllDeviceAlerts",
    "getDeviceAlertRules",
    "getDeviceAlertRule",
    "createDeviceAlertRule",
    "updateDeviceAlertRule",
    "getDeviceAlertChannels",
    "updateDeviceAlertChannels",
    "testDeviceAlertChannels",
    "getDeviceAlertHistory",
]:
    check("web client " + client_fn, client_fn in client)

for page_name, source in [
    ("DevicesOverviewPage", overview_page),
    ("EndpointPoliciesPage", policy_page),
    ("EndpointPolicyDetailPage", policy_page),
    ("EndpointPolicyCompliancePage", policy_page),
    ("DeviceAlertsPage", alert_page),
    ("DeviceAlertRulesPage", alert_page),
    ("DeviceAlertRuleEditorPage", alert_page),
    ("DeviceAlertChannelsPage", alert_page),
    ("DeviceAlertHistoryPage", alert_page),
]:
    check("web page " + page_name, f"function {page_name}" in source)

for route in [
    'path="devices/overview"',
    'path="devices/policies"',
    'path="devices/policies/:policyId"',
    'path="devices/policies/:policyId/compliance"',
    'path="devices/alerts"',
    'path="devices/alerts/rules"',
    'path="devices/alerts/rules/new"',
    'path="devices/alerts/rules/:ruleId"',
    'path="devices/alerts/channels"',
    'path="devices/alerts/history"',
]:
    check("web route " + route, route in app)

canonical_nav = [
    'to="/devices/overview"',
    'to="/devices"',
    'to="/devices/discovery"',
    'to="/devices/groups"',
    'to="/devices/remote-operations"',
    'to="/devices/remote-consent"',
    'to="/devices/query"',
    'to="/devices/deployments"',
    'to="/devices/maintenance"',
    'to="/devices/policies"',
    'to="/devices/alerts"',
]
devices_nav = shell.split(") : inDevices ? (", 1)[1] if ") : inDevices ? (" in shell else ""
positions = [devices_nav.find(marker) for marker in canonical_nav]
check("final TOR nav all eleven entries", all(position >= 0 for position in positions))
check("final TOR nav canonical order", positions == sorted(positions))
check("legacy Agent Deployment hidden", 'to="/devices/add"' not in shell)
check("Device Automation still retired", "/devices/automation" not in shell)

check("Overview has no hard-coded sample KPI", "128" not in overview_page and "118" not in overview_page)
check("Policy UI labels Pending honestly", "Pending" in policy_page and "evidence" in policy_page.lower())
check("Alerts UI labels evidence-backed behavior", "evidence" in alert_page.lower() and "does not create" in alert_page.lower())
check("Email UI says not configured truthfully", "Not configured" in alert_page and "does not fabricate external mail delivery" in alert_page)
check("No browser-native confirm", "window.confirm" not in overview_page + policy_page + alert_page and "confirm(" not in overview_page + policy_page + alert_page)
check("No browser-native alert", "window.alert" not in overview_page + policy_page + alert_page)

migrations = list((ROOT / "production/services/platform-api/src/Modules/Devices/Persistence/Migrations").glob("*Step45XPoliciesAlertsOverview*.cs"))
check("Step45X migration exists", len(migrations) >= 1)

print("step45x_checks=" + str(checks))
print("step45x_operations=" + str(len(expected_ops)))
print("step45x_tables=7")
print("step45x_issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)
raise SystemExit(1 if issues else 0)
