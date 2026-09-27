#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
HELPDESK = PROD / "services/platform-api/src/Modules/Helpdesk"
issues = []

manifest = json.loads((ROOT / "inno-step18-helpdesk-sla-automation.json").read_text())
impl = json.loads((ROOT / "inno-implementation-contract.json").read_text())

expected_operations = [
    "helpdesk.sla_policies.list",
    "helpdesk.sla_policies.update",
    "helpdesk.sla_monitor.get",
    "helpdesk.calendar.get",
    "helpdesk.calendar.update",
    "helpdesk.automation.list",
    "helpdesk.automation.get",
    "helpdesk.automation.create",
    "helpdesk.automation.upsert",
]
expected_routes = [
    "/helpdesk/sla",
    "/helpdesk/calendar",
    "/helpdesk/automation",
    "/helpdesk/automation/new",
    "/helpdesk/automation/:ruleId",
]
new_tables = [
    "helpdesk.business_calendar",
    "helpdesk.business_calendar_entries",
    "helpdesk.automation_rules",
    "helpdesk.automation_executions",
]
extended_tables = ["helpdesk.sla_policies", "helpdesk.ticket_sla"]

if manifest.get("contractVersion") != "0.9.0":
    issues.append("Step 18 manifest must be version 0.9.0")
if impl.get("contractVersion") != "0.13.0":
    issues.append("current Implementation Contract must be 0.13.0")
if manifest.get("operations") != expected_operations:
    issues.append("Step 18 operation catalog mismatch")
if manifest.get("webRoutes") != expected_routes:
    issues.append("Step 18 Web route catalog mismatch")
if manifest.get("persistence", {}).get("newTables") != new_tables:
    issues.append("Step 18 new-table catalog mismatch")
if manifest.get("persistence", {}).get("extendedTables") != extended_tables:
    issues.append("Step 18 extended-table catalog mismatch")
if manifest.get("persistence", {}).get("crossModuleForeignKeys") is not False:
    issues.append("Step 18 must forbid cross-module database foreign keys")
if manifest.get("deferredStep16Revalidation") is not True:
    issues.append("Step 16 fresh re-validation must remain deferred")

slice_ref = impl.get("helpdeskSlaAutomationSlice", {})
if slice_ref.get("version") != "0.9.0":
    issues.append("Implementation Contract must reference Step 18 version 0.9.0")
if slice_ref.get("implementedOperations") != expected_operations:
    issues.append("Implementation Contract Step 18 operation catalog mismatch")
if slice_ref.get("webRoutes") != expected_routes:
    issues.append("Implementation Contract Step 18 route catalog mismatch")
if slice_ref.get("featureImplementationStarted") is not True:
    issues.append("Implementation Contract must mark Step 18 implementation started")

for ref in (
    "INNO-One-Step18-Helpdesk-SLA-Automation.md",
    "inno-step18-helpdesk-sla-automation.json",
    "step18-helpdesk-sla-automation-audit.py",
    "production/scripts/step18-local-smoke.py",
):
    if not (ROOT / ref).exists():
        issues.append(f"missing Step 18 source-of-truth file: {ref}")
api_path = HELPDESK / "Api/HelpdeskSlaAutomationEndpoints.cs"
api_text = api_path.read_text()
for operation in expected_operations:
    if f'.WithName("{operation}")' not in api_text:
        issues.append(f"Step 18 API operation marker missing: {operation}")

for marker in (
    '"/helpdesk/sla-policies"',
    '"/helpdesk/sla-policies/{policyId}"',
    '"/helpdesk/sla-monitor"',
    '"/helpdesk/business-calendar"',
    '"/helpdesk/automation-rules"',
    '"/helpdesk/automation-rules/{ruleId}"',
):
    if marker not in api_text:
        issues.append(f"Step 18 API route missing: {marker}")

for permission in (
    "helpdesk.sla.manage",
    "helpdesk.automation.view",
    "helpdesk.automation.manage",
):
    if permission not in api_text:
        issues.append(f"Step 18 API permission missing: {permission}")
db_text = (HELPDESK / "Persistence/HelpdeskDbContext.cs").read_text()
for table in [x.split(".", 1)[1] for x in new_tables + extended_tables]:
    if f'ToTable("{table}")' not in db_text:
        issues.append(f"HelpdeskDbContext missing mapping: {table}")

migration_files = list(
    (HELPDESK / "Persistence/Migrations").glob("*_Step18HelpdeskSlaAutomation.cs")
)
if len(migration_files) != 1:
    issues.append(
        f"expected one Step18HelpdeskSlaAutomation migration, found {len(migration_files)}"
    )

entities = (HELPDESK / "Domain/HelpdeskSlaAutomationEntities.cs").read_text()
for marker in (
    "BusinessCalendar",
    "BusinessCalendarEntry",
    "AutomationRule",
    "AutomationExecution",
):
    if marker not in entities:
        issues.append(f"Step 18 domain entity missing: {marker}")

legacy_entities = (HELPDESK / "Domain/HelpdeskEntities.cs").read_text()
for marker in (
    "BusinessCalendarId",
    "PauseOnRequesterWait",
    "ReassignOnBreach",
    "EscalationLevelsJson",
    "PausedAt",
    "AccumulatedPausedSeconds",
    "RiskEmittedAt",
    "EscalationLevel",
    "LastEvaluatedAt",
):
    if marker not in legacy_entities:
        issues.append(f"Step 18 SLA extension missing: {marker}")

worker_text = (
    HELPDESK / "Infrastructure/HelpdeskSlaAutomationWorker.cs"
).read_text()
for marker in (
    "sla.at_risk",
    "sla.escalated",
    "assign_team",
    "set_priority",
    "escalate_manager_chain",
):
    if marker not in worker_text:
        issues.append(f"Step 18 worker marker missing: {marker}")

module_text = (HELPDESK / "HelpdeskModule.cs").read_text()
if "AddHostedService<HelpdeskSlaAutomationWorker>()" not in module_text:
    issues.append("Helpdesk module must register HelpdeskSlaAutomationWorker")

program_text = (
    PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs"
).read_text()
if "MapHelpdeskSlaAutomationEndpoints()" not in program_text:
    issues.append("Platform API composition missing Step 18 endpoint registration")
for marker in (
    "helpdesk.sla_policy.updated",
    "helpdesk.automation_rule.updated",
):
    if marker not in api_text:
        issues.append(f"Step 18 audit action missing: {marker}")
for marker in ("sla.at_risk", "sla.escalated"):
    if marker not in worker_text:
        issues.append(f"Step 18 event marker missing: {marker}")

helpdesk_csproj = (HELPDESK / "INNO.One.Modules.Helpdesk.csproj").read_text()
for forbidden in (
    "Modules/Platform",
    "Modules/Devices",
    "INNO.One.Infrastructure",
):
    if forbidden in helpdesk_csproj:
        issues.append(f"forbidden Helpdesk project reference: {forbidden}")

helpdesk_source = "\n".join(
    source.read_text()
    for source in HELPDESK.rglob("*.cs")
    if "/obj/" not in str(source) and "/bin/" not in str(source)
)
for forbidden_namespace in (
    "INNO.One.Modules.Platform",
    "INNO.One.Modules.Devices",
):
    if forbidden_namespace in helpdesk_source:
        issues.append(
            f"Helpdesk directly imports another module: {forbidden_namespace}"
        )
for forbidden_vendor_marker in (
    "node/",
    "MeshCentralRemote",
    "IRemoteDeviceEngine",
):
    if forbidden_vendor_marker in helpdesk_source:
        issues.append(
            f"Helpdesk leaks vendor implementation marker: {forbidden_vendor_marker}"
        )

platform_seed = (
    PROD
    / "services/platform-api/src/Modules/Platform/Infrastructure/"
    / "PlatformDevelopmentSeed.cs"
).read_text()
for marker in (
    '"helpdesk.sla.manage"',
    '"helpdesk.automation.view"',
    '"helpdesk.automation.manage"',
):
    if marker not in platform_seed:
        issues.append(f"Platform seed missing Step 18 permission: {marker}")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
app_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
for route in (
    'path="helpdesk/sla"',
    'path="helpdesk/calendar"',
    'path="helpdesk/automation"',
    'path="helpdesk/automation/new"',
    'path="helpdesk/automation/:ruleId"',
):
    if route not in app_root:
        issues.append(f"AppRoot missing Step 18 route {route}")
for nav in (
    'to="/helpdesk/sla"',
    'to="/helpdesk/calendar"',
    'to="/helpdesk/automation"',
):
    if nav not in app_shell:
        issues.append(f"AppShell missing Step 18 navigation {nav}")

for page in (
    "HelpdeskSlaPage.tsx",
    "BusinessCalendarPage.tsx",
    "AutomationRulesPage.tsx",
    "AutomationRulePage.tsx",
):
    if not (PROD / "apps/web-portal/src/pages" / page).exists():
        issues.append(f"Step 18 Web page missing: {page}")

api_client = (PROD / "apps/web-portal/src/api/client.ts").read_text()
for fn in (
    "getSlaPolicies",
    "updateSlaPolicy",
    "getSlaMonitor",
    "getBusinessCalendar",
    "updateBusinessCalendar",
    "getAutomationRules",
    "getAutomationRule",
    "createAutomationRule",
    "updateAutomationRule",
):
    if f"function {fn}" not in api_client:
        issues.append(f"Web API client missing {fn}")

doc_text = (ROOT / "INNO-One-Step18-Helpdesk-SLA-Automation.md").read_text()
if "fresh Step 16 re-validation is deferred" not in doc_text:
    issues.append(
        "Step 18 documentation must preserve deferred Step 16 re-validation"
    )
print(f"step18_contract_version={manifest.get('contractVersion')}")
print(f"operations={len(expected_operations)}")
print(f"web_routes={len(expected_routes)}")
print(f"new_helpdesk_tables={len(new_tables)}")
print(f"extended_helpdesk_tables={len(extended_tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
