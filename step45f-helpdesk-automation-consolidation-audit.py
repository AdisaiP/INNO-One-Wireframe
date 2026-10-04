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

entities = text("production/services/platform-api/src/Modules/Workflows/Domain/WorkflowEntities.cs")
db = text("production/services/platform-api/src/Modules/Workflows/Persistence/WorkflowsDbContext.cs")
api = text("production/services/platform-api/src/Modules/Workflows/Api/WorkflowEndpoints.cs")
ledger = text("production/services/platform-api/src/Modules/Workflows/Infrastructure/WorkflowLedgerWriter.cs")
legacy_seed = text("production/services/platform-api/src/Modules/Helpdesk/Infrastructure/HelpdeskDevelopmentSeed.cs")
legacy_worker = text("production/services/platform-api/src/Modules/Helpdesk/Infrastructure/HelpdeskSlaAutomationWorker.cs")
legacy_api = text("production/services/platform-api/src/Modules/Helpdesk/Api/HelpdeskSlaAutomationEndpoints.cs")
manifest = json.loads(text("production/module-manifests.json"))
app_root = text("production/apps/web-portal/src/app/AppRoot.tsx")
shell = text("production/apps/web-portal/src/app/AppShell.tsx")
list_page = text("production/apps/web-portal/src/pages/AutomationRulesPage.tsx")
builder = text("production/apps/web-portal/src/pages/AutomationRulePage.tsx")
client = text("production/apps/web-portal/src/api/client.ts")
types = text("production/apps/web-portal/src/api/types.ts")
canvas = text("production/packages/ui/src/workflow.tsx")
i18n_runtime = text("production/packages/i18n/src/index.tsx")
screen_matrix = json.loads(text("inno-step44a-screen-interaction-matrix.json"))

# Product route matrix.
matrix_routes = {item["route"]: item for item in screen_matrix["routes"]}
check(len(screen_matrix["routes"]) == 66, "Current Product screen matrix must contain 66 screens after Step45H Devices automation")
check("workflows" not in matrix_routes and "workflows/new" not in matrix_routes and "workflows/:workflowId" not in matrix_routes, "standalone workflow Product screens remain in the matrix")
check(matrix_routes.get("helpdesk/automation", {}).get("pattern") == "P02", "Helpdesk Automation list must be P02")
check(matrix_routes.get("helpdesk/automation/new", {}).get("pattern") == "P06", "Helpdesk new automation must be P06")
check(matrix_routes.get("helpdesk/automation/:automationId", {}).get("pattern") == "P06", "Helpdesk edit automation must be P06")
check(matrix_routes.get("helpdesk/automation/new", {}).get("specialComponent") == "INNOWorkflowCanvas", "Helpdesk builder matrix does not declare shared canvas")

# Domain ownership.
check(entities.count("OwnerModule") >= 2, "definition and version must both persist OwnerModule")
check('= "legacy_unassigned"' in entities, "legacy owner default is missing")
check('entity.Property(x => x.OwnerModule)' in db, "OwnerModule EF mapping missing")
check('HasIndex(x => new { x.OwnerModule, x.UpdatedAt })' in db, "owner-aware definition index missing")
check('HasIndex(x => new { x.WorkflowId, x.Version }).IsUnique()' in db, "immutable version uniqueness changed")

# Migration.
migrations = list((ROOT / "production/services/platform-api/src/Modules/Workflows/Persistence/Migrations").glob("*_Step45FHelpdeskAutomationOwnership.cs"))
check(len(migrations) == 1, "Step45F ownership migration missing or duplicated")
if migrations:
    migration = migrations[0].read_text(encoding="utf-8-sig")
    check(migration.count('name: "owner_module"') >= 2, "migration does not add owner_module to both tables")
    check('defaultValue: "legacy_unassigned"' in migration, "migration does not preserve legacy definitions as legacy_unassigned")
    check('ix_workflow_definitions_owner_module_updated_at' in migration, "owner-aware index migration missing")
    check('FROM helpdesk.automation_rules r' in migration, "legacy simple rules are not migrated into visual definitions")
    check("'helpdesk.ticket.assign_team'" in migration, "legacy assignment action mapping missing")
    check("'helpdesk.ticket.escalate'" in migration, "legacy escalation action mapping missing")
    check("'helpdesk.ticket.status_changed'" in migration, "legacy status trigger mapping missing")
    check("WHERE d.owner_module = 'helpdesk'" in migration, "legacy version migration is not Helpdesk-owned")

# Legacy runtime transition.
check("db.AutomationRules.AddRange" not in legacy_seed, "new installations still seed legacy simple automation rules")
check('Helpdesk:LegacyAutomationExecutionEnabled' in legacy_worker, "legacy automation evaluator is not behind an explicit compatibility switch")
check('GetValue("Helpdesk:LegacyAutomationExecutionEnabled", false)' in legacy_worker, "legacy automation execution is not disabled by default")
check("await EvaluateSlaAsync" in legacy_worker, "SLA evaluation was removed while retiring legacy automation")
check('api.MapGet("/helpdesk/automation-rules"' not in legacy_api, "legacy simple-rule list API is still mapped")
check('api.MapPost("/helpdesk/automation-rules"' not in legacy_api, "legacy simple-rule create API is still mapped")
check('api.MapPut("/helpdesk/automation-rules/{ruleId}"' not in legacy_api, "legacy simple-rule update API is still mapped")

# API ownership facade.
for marker in [
    'api.MapGet("/helpdesk/automations"',
    'api.MapGet("/helpdesk/automations/{automationId}"',
    'api.MapPost("/helpdesk/automations"',
    'api.MapPut("/helpdesk/automations/{automationId}"',
    'api.MapDelete("/helpdesk/automations/{automationId}"',
    'api.MapGet("/helpdesk/automations/{automationId}/versions"',
]:
    check(marker in api, "Helpdesk automation API route missing: " + marker)

for marker in [
    '"helpdesk"',
    '"helpdesk.automation.view"',
    '"helpdesk.automation.manage"',
    '"helpdesk.automation.definition"',
    '"automation_definition"',
    '"/api/v1/helpdesk/automations"',
]:
    check(marker in api, "Helpdesk workflow scope missing: " + marker)

check('x.OwnerModule == scope.OwnerModule' in api, "resource queries are not owner-scoped")
check('.Where(x => x.OwnerModule == scope.OwnerModule && x.Status != "deleted")' in api, "list is not owner-scoped")
check('OwnerModule = scope.OwnerModule' in api, "create does not stamp module owner")
check('OwnerModule = row.OwnerModule' in api, "version snapshot does not retain owner")
check('.Where(x => x.WorkflowId == id && x.OwnerModule == scope.OwnerModule)' in api, "version history is not owner-scoped")
check('ownerModule = row.OwnerModule' in api, "audit metadata does not include owner module")
check('StatusCodes.Status428PreconditionRequired' in api, "If-Match 428 contract missing")
check('StatusCodes.Status412PreconditionFailed' in api, "stale/race 412 contract missing")
check('DbUpdateConcurrencyException' in api, "database race handling missing")
check('scope.AuditModule' in api and 'scope.TargetType' in api, "audit ownership is not scope-aware")

# Generic facade remains migration-only and isolated from Helpdesk definitions.
check('"legacy_unassigned"' in api, "legacy generic scope is missing")
check('"workflows.view"' in api and '"workflows.manage"' in api, "legacy generic scope permissions missing")
check('api.MapGet("/workflows"' in api, "legacy migration facade unexpectedly removed")
check("module, targetType" in ledger or "string module" in ledger, "workflow ledger is still hard-coded to workflows")

# Manifest: technical core, not Product app.
workflows = next((m for m in manifest["modules"] if m["id"] == "workflows"), None)
helpdesk = next((m for m in manifest["modules"] if m["id"] == "helpdesk"), None)
check(workflows is not None, "Automation Core manifest missing")
if workflows:
    check(workflows.get("name") == "Automation Core", "workflows manifest is still named Dynamic Workflows")
    check(workflows.get("launcher") is False, "Automation Core must not appear in Apps launcher")
    check(workflows.get("navigation") == [], "Automation Core must not own end-user navigation")
    check("audit" in workflows.get("capabilities", []), "Automation Core audit capability missing")
if helpdesk:
    perms = set(helpdesk.get("permissions", []))
    check("helpdesk.automation.view" in perms, "Helpdesk automation view permission missing")
    check("helpdesk.automation.manage" in perms, "Helpdesk automation manage permission missing")
    nav = {x["id"]: x for x in helpdesk.get("navigation", [])}
    check(nav.get("automation", {}).get("route") == "/helpdesk/automation", "Helpdesk Automation navigation missing")

# Product routing and navigation.
check('path="workflows/*" element={<Navigate to="/helpdesk/automation" replace />}' in app_root, "legacy workflow Product route does not redirect")
check("WorkflowListPage" not in app_root, "standalone Workflow list is still mounted")
check("WorkflowBuilderPage" not in app_root, "standalone Workflow builder is still mounted")
check(not (ROOT / "production/apps/web-portal/src/pages/WorkflowListPage.tsx").exists(), "dead standalone Workflow list file still exists")
check(not (ROOT / "production/apps/web-portal/src/pages/WorkflowBuilderPage.tsx").exists(), "dead standalone Workflow builder file still exists")
check("canViewWorkflows" not in app_root, "generic workflow Product view permission still drives UI")
check("canManageWorkflows" not in app_root, "generic workflow Product manage permission still drives UI")
check("canManageAutomation = profile.permissions.includes('helpdesk.automation.manage')" in app_root, "Helpdesk manage permission gate missing")
check('path="helpdesk/automation/new"' in app_root, "Helpdesk new automation route missing")
check('path="helpdesk/automation/:automationId"' in app_root, "Helpdesk edit automation route missing")
check("AutomationRulePage = lazy" in app_root, "React Flow builder is not lazy-loaded")
check("inWorkflows" not in shell, "standalone workflow context remains in AppShell")
check("canViewWorkflows" not in shell, "generic workflow view permission remains in AppShell")
check("canManageWorkflows" not in shell, "generic workflow manage permission remains in AppShell")
check("Dynamic Workflows" not in shell, "standalone Dynamic Workflows navigation text remains in AppShell")

# Helpdesk list.
check("getHelpdeskAutomationDefinitions" in list_page, "Helpdesk list is not backed by workflow persistence")
check("getAutomationRules" not in list_page, "legacy rule API still powers Helpdesk Product list")
check("helpdesk.automation.manage" in list_page, "Helpdesk list manage permission missing")
check("/helpdesk/automation/new" in list_page, "Helpdesk list New action route missing")
check("useI18n()" in list_page, "Helpdesk list is not bilingual")
check("formatDateTime" in list_page, "Helpdesk list does not use locale-aware date formatting")
check("import './WorkflowProductPages.css';" in list_page, "Helpdesk list does not load shared workflow Product styling")

# Helpdesk builder.
check("INNOWorkflowCanvas" in builder, "Helpdesk editor does not use shared React Flow canvas")
check("HELP_DESK_CATALOG" in builder, "Helpdesk-specific node catalog missing")
for catalog_key in [
    "helpdesk.ticket.created",
    "helpdesk.ticket.updated",
    "helpdesk.sla.at_risk",
    "helpdesk.requester.reply",
    "helpdesk.ticket.condition",
    "helpdesk.manager.approval",
    "helpdesk.ticket.assign_team",
    "helpdesk.ticket.update",
    "helpdesk.requester.notify",
]:
    check(catalog_key in builder, "Helpdesk catalog missing: " + catalog_key)
check("catalogKey: item.key" in builder, "stable catalog key is not persisted")
check("labelKey: item.labelKey" in builder, "localized label key is not persisted")
check("descriptionKey: item.descriptionKey" in builder, "localized description key is not persisted")
check("configuration: {}" in builder, "business configuration container missing")
check("createHelpdeskAutomationDefinition" in builder, "Helpdesk builder does not create through module facade")
check("updateHelpdeskAutomationDefinition" in builder, "Helpdesk builder does not update through module facade")
check("createAutomationRule" not in builder, "legacy simple rule create API remains in Product builder")
check("updateAutomationRule" not in builder, "legacy simple rule update API remains in Product builder")
check("getAutomationRule" not in builder, "legacy simple rule get API remains in Product builder")
check("useI18n()" in builder, "Helpdesk builder is not bilingual")
check("kindLabels={kindLabels}" in builder, "localized node kind labels are not supplied")
check("severityLabels={severityLabels}" in builder, "localized validation severity labels are not supplied")
check("Publish" not in builder, "Step45F builder exposes Publish prematurely")
check("Run Workflow" not in builder and ">Run<" not in builder, "Step45F builder exposes execution prematurely")

# Shared node model supports stable business metadata without localizing business values.
for marker in [
    "labelKey?: string",
    "descriptionKey?: string",
    "catalogKey?: string",
    "configuration?: Record<string, unknown>",
    "kindLabels?:",
    "severityLabels?:",
]:
    check(marker in canvas, "shared workflow contract missing: " + marker)

# Client and response owner awareness.
for marker in [
    "getHelpdeskAutomationDefinitions",
    "getHelpdeskAutomationDefinition",
    "createHelpdeskAutomationDefinition",
    "updateHelpdeskAutomationDefinition",
    "deleteHelpdeskAutomationDefinition",
    "getHelpdeskAutomationVersions",
]:
    check(marker in client, "Helpdesk workflow client missing: " + marker)
check("ownerModule: string" in types, "workflow API types do not expose ownerModule")
for legacy_client_marker in [
    "getAutomationRules",
    "getAutomationRule(",
    "createAutomationRule",
    "updateAutomationRule",
    "AutomationRuleDetail",
    "AutomationRuleSummary",
]:
    check(legacy_client_marker not in client and legacy_client_marker not in types, "legacy simple-rule Web client/type remains: " + legacy_client_marker)

# Bilingual catalog parity.
for filename in ["helpdesk.json", "workflow.json"]:
    en = json.loads(text("production/packages/i18n/src/locales/en-US/" + filename))
    th = json.loads(text("production/packages/i18n/src/locales/th-TH/" + filename))
    check(set(en) == set(th), filename + " locale key parity failed")
    check(all(v.strip() for v in en.values()), filename + " has blank English translations")
    check(all(v.strip() for v in th.values()), filename + " has blank Thai translations")
check("enHelpdesk" in i18n_runtime and "thHelpdesk" in i18n_runtime, "Helpdesk catalogs not loaded by i18n runtime")
check("enWorkflow" in i18n_runtime and "thWorkflow" in i18n_runtime, "Workflow catalogs not loaded by i18n runtime")

print(f"step45f_checks={checks}")
print(f"step45f_failures={len(failures)}")
for failure in failures:
    print(" -", failure)

sys.exit(1 if failures else 0)
