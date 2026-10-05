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
run_api = text("production/services/platform-api/src/Modules/Workflows/Api/AssetsAutomationRunEndpoints.cs")
worker = text("production/services/platform-api/src/Modules/Workflows/Infrastructure/WorkflowExecutionWorker.cs")
executor = text("production/services/platform-api/src/Modules/Assets/Infrastructure/AssetsAutomationNodeExecutor.cs")
asset_contracts = text("production/services/platform-api/src/INNO.One.Contracts/Assets/AssetAutomationContracts.cs")
helpdesk_contracts = text("production/services/platform-api/src/INNO.One.Contracts/Helpdesk/HelpdeskAutomationContracts.cs")
ticket_creator = text("production/services/platform-api/src/Modules/Helpdesk/Infrastructure/HelpdeskAutomationTicketCreator.cs")
assets_module = text("production/services/platform-api/src/Modules/Assets/AssetsModule.cs")
helpdesk_module = text("production/services/platform-api/src/Modules/Helpdesk/HelpdeskModule.cs")
seed = text("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
manifest = json.loads(text("production/module-manifests.json"))
app_root = text("production/apps/web-portal/src/app/AppRoot.tsx")
app_shell = text("production/apps/web-portal/src/app/AppShell.tsx")
list_page = text("production/apps/web-portal/src/pages/AssetsAutomationRulesPage.tsx")
editor = text("production/apps/web-portal/src/pages/AssetsAutomationRulePage.tsx")
history = text("production/apps/web-portal/src/pages/AssetsAutomationRunsPage.tsx")
client = text("production/apps/web-portal/src/api/client.ts")
types = text("production/apps/web-portal/src/api/types.ts")
i18n_runtime = text("production/packages/i18n/src/index.tsx")
matrix = json.loads(text("inno-step44a-screen-interaction-matrix.json"))
broad = text("step42-production-ux-browser-qa.py")

# Definition ownership/API.
for marker in [
    "AssetsScope",
    '"/assets/automations"',
    '"/assets/automations/{automationId}"',
    '"/assets/automations/{automationId}/versions"',
    '"assets.automation.view"',
    '"assets.automation.manage"',
    '"assets.automation.definition"',
    '"Assets automation"',
    "MapAssetsAutomationRunEndpoints",
]:
    check(marker in definition_api, "Assets definition facade missing: " + marker)

# Permissions + manifest.
for permission in [
    "assets.automation.view",
    "assets.automation.manage",
    "assets.automation.run.view",
]:
    check(permission in seed, "Development seed missing: " + permission)
check("Step45IPermissions" in seed, "Step45I permission group missing")
assets_manifest = next((x for x in manifest["modules"] if x["id"] == "assets"), None)
check(assets_manifest is not None, "Assets manifest missing")
if assets_manifest:
    for permission in [
        "assets.automation.view",
        "assets.automation.manage",
        "assets.automation.run.view",
    ]:
        check(permission in assets_manifest.get("permissions", []),
              "Assets manifest permission missing: " + permission)
    nav = {x["route"]: x for x in assets_manifest.get("navigation", [])}
    check(nav.get("/assets/automation", {}).get("permission") == "assets.automation.view",
          "Assets Automation navigation permission wrong")

# Shared runtime owner mapping.
check('"assets" => "assets.automation.manage"' in worker,
      "Worker does not re-check Assets automation manage permission")
check('"assets" => "assets.automation.run"' in worker,
      "Worker audit prefix is not Assets-owned")

# Run facade and current-context preflight.
for marker in [
    'MapPost("/assets/automations/{automationId}/runs"',
    'MapGet("/assets/automations/{automationId}/runs"',
    'MapGet("/assets/automations/{automationId}/runs/{runId}"',
    '"assets.automation.manage"',
    '"assets.automation.run.view"',
    "IAssetsAutomationContextReader",
    "ValidateRuleContextAsync",
    "ValidateActionPermissionAsync",
    '"assets.view"',
    '"assets.license.manage"',
    '"helpdesk.ticket.create"',
    '"assets.asset.lifecycle_status"',
    '"assets.asset.owner_unassigned"',
    '"assets.asset.warranty_expiring"',
    '"assets.asset.baseline_drift"',
    '"assets.license.overused"',
    '"ASSETS_LIFECYCLE_CONTEXT_MISMATCH"',
    '"ASSETS_OWNER_CONTEXT_MISMATCH"',
    '"ASSETS_WARRANTY_THRESHOLD_NOT_REACHED"',
    '"ASSETS_BASELINE_DRIFT_NOT_PRESENT"',
    '"ASSETS_LICENSE_THRESHOLD_NOT_REACHED"',
    '"ASSETS_RULE_CONDITION_NOT_MATCHED"',
    '"ASSETS_ACTION_CONTEXT_MISMATCH"',
    '"ASSETS_VIEW_PERMISSION_DENIED"',
    "WorkflowExecutionPlanner.TryCreate",
    "DefinitionSnapshotJson = snapshot",
    '"assets.automation.run.queued"',
]:
    check(marker in run_api, "Assets run contract missing: " + marker)
check("BeginTransactionAsync" in run_api, "Assets enqueue + ledger is not transactional")

# Context reader contract.
for marker in [
    "AssetAutomationAssetContext",
    "AssetAutomationLicenseContext",
    "AssetAutomationBaselineContext",
    "IAssetsAutomationContextReader",
    "CanAccessAssetAsync",
    "ReadLicenseAsync",
    "ReadLatestBaselineResultAsync",
]:
    check(marker in asset_contracts, "Assets shared automation contract missing: " + marker)

# Module executor.
for marker in [
    "IAutomationNodeExecutor",
    'public string OwnerModule => "assets"',
    '"assets.asset.set_lifecycle_status"',
    '"helpdesk.ticket.create"',
    '"assets.manage"',
    '"assets.view"',
    '"assets.license.manage"',
    '"ASSETS_OUTSIDE_ASSIGNED_SCOPE"',
    '"assets.automation.lifecycle_updated"',
    '"asset.changed"',
    "idempotentReplay = true",
]:
    check(marker in executor, "Assets executor guard missing: " + marker)
check("AddScoped<IAutomationNodeExecutor, AssetsAutomationNodeExecutor>" in assets_module,
      "Assets executor is not registered")
check("AddScoped<IAssetsAutomationContextReader, AssetsAutomationContextReader>" in assets_module,
      "Assets context reader is not registered")

# Cross-module Helpdesk action boundary and Asset link.
for marker in [
    "RelatedAssetId",
    "IHelpdeskAutomationTicketCreator",
]:
    check(marker in helpdesk_contracts, "Helpdesk automation contract missing: " + marker)
for marker in [
    '"helpdesk.ticket.create"',
    "access.UserId != request.ActorUserId",
    "automationIdempotencyKey",
    "RelatedAssetId = request.RelatedAssetId",
    "relatedAssetId = request.RelatedAssetId.HasValue",
    '"helpdesk.ticket.automation_created"',
    '"ticket.created"',
]:
    check(marker in ticket_creator, "Helpdesk automation creator guard missing: " + marker)
check("AddScoped<IHelpdeskAutomationTicketCreator, HelpdeskAutomationTicketCreator>" in helpdesk_module,
      "Helpdesk automation ticket creator is not registered")
check("relatedAssetId = assetId" in executor,
      "Asset source is not linked into cross-module Helpdesk ticket request")

# Web routes and navigation.
for marker in [
    'path="assets/automation"',
    'path="assets/automation/new"',
    'path="assets/automation/:automationId"',
    'path="assets/automation/:automationId/runs"',
    "assets.automation.view",
    "assets.automation.manage",
    "assets.automation.run.view",
]:
    check(marker in app_root, "Assets Product route/permission missing: " + marker)
check(app_root.index('path="assets/automation"') < app_root.index('path="assets/:assetId"'),
      "Assets automation route must precede dynamic Asset detail route")
check('to="/assets/automation"' in app_shell and "canViewAssetsAutomation" in app_shell,
      "Assets contextual navigation missing Automation")
check("'/assets/automation'" in app_shell and "inAssetDetail" in app_shell,
      "Assets Automation is not excluded from Asset-detail matching")

# Focused Product UI.
check("getAssetsAutomationDefinitions" in list_page, "Assets list is not API-backed")
for marker in [
    "getAssetsAutomationDefinition",
    "createAssetsAutomationDefinition",
    "updateAssetsAutomationDefinition",
    "assets.asset.lifecycle_status",
    "assets.asset.owner_unassigned",
    "assets.asset.warranty_expiring",
    "assets.asset.baseline_drift",
    "assets.license.overused",
    "assets.asset.set_lifecycle_status",
    "helpdesk.ticket.create",
    "conditionEnabled",
    "canViewAssets",
    "canManageAssets",
    "canManageLicenses",
    "canCreateTicket",
    "availableTriggers.includes(trigger)",
]:
    check(marker in editor, "Assets focused editor missing: " + marker)
check("INNOWorkflowCanvas" not in editor, "Assets editor must not expose React Flow canvas")
check("@inno/ui/workflow.css" not in editor, "Assets editor must not load React Flow CSS")

for marker in [
    "getAssetsAutomationRuns",
    "getAssetsAutomationRun",
    "startAssetsAutomationRun",
    "getAssets",
    "getSoftwareLicenses",
    "INNODrawer",
    "definitionSnapshot.nodes",
    "refetchInterval",
]:
    check(marker in history, "Assets P10 run history missing: " + marker)

# Client/types.
for marker in [
    "getAssetsAutomationDefinitions",
    "getAssetsAutomationDefinition",
    "createAssetsAutomationDefinition",
    "updateAssetsAutomationDefinition",
    "deleteAssetsAutomationDefinition",
    "getAssetsAutomationVersions",
    "getAssetsAutomationRuns",
    "getAssetsAutomationRun",
    "startAssetsAutomationRun",
]:
    check(marker in client, "Assets Web API client missing: " + marker)
for marker in [
    "AssetsAutomationRunSummary",
    "AssetsAutomationRunDetail",
    "AssetsAutomationRunListResponse",
]:
    check(marker in types, "Assets Web runtime type missing: " + marker)

# Screen matrix.
routes = {x["route"]: x for x in matrix["routes"]}
check(len(routes) == 70, "Current Product matrix must contain 70 screens after Step45I")
expected = {
    "assets/automation": ("AssetsAutomationRulesPage", "P02"),
    "assets/automation/new": ("AssetsAutomationRulePage", "P04"),
    "assets/automation/:automationId": ("AssetsAutomationRulePage", "P04"),
    "assets/automation/:automationId/runs": ("AssetsAutomationRunsPage", "P10"),
}
for route, (page, pattern) in expected.items():
    item = routes.get(route, {})
    check(item.get("page") == page, route + " page classification wrong")
    check(item.get("pattern") == pattern, route + " interaction pattern wrong")
check(routes["assets/automation/new"].get("specialComponent") is None,
      "Focused Assets editor must not declare workflow canvas")

# Bilingual parity/registration.
en = json.loads(text("production/packages/i18n/src/locales/en-US/assets.json"))
th = json.loads(text("production/packages/i18n/src/locales/th-TH/assets.json"))
check(set(en) == set(th), "Assets locale key parity failed")
check(all(str(v).strip() for v in en.values()), "Assets English catalog has blank values")
check(all(str(v).strip() for v in th.values()), "Assets Thai catalog has blank values")
check("enAssets" in i18n_runtime and "thAssets" in i18n_runtime,
      "Assets locale catalog is not registered")
for key in [
    "assets.automation.title",
    "assets.automation.editor.when",
    "assets.automation.editor.if",
    "assets.automation.editor.then",
    "assets.automation.runs.title",
    "assets.automation.runs.status.completed",
    "assets.automation.runs.error.ASSETS_ACTION_CONTEXT_MISMATCH",
    "assets.automation.runs.error.HELPDESK_CREATE_PERMISSION_DENIED",
]:
    check(key in en and key in th, "Assets translation missing: " + key)

# Broad Product QA baseline.
check('"/assets/automation", "/assets/automation/new"' in broad.replace("\n", " "),
      "Broad Product QA does not include Assets Automation static routes")
check('"/assets/automation"' in broad and '"/helpdesk/automation", "/assets/automation"' in broad,
      "Broad Product QA does not discover Assets Automation dynamic routes")

print(f"step45i_checks={checks}")
print(f"step45i_failures={len(failures)}")
for failure in failures:
    print(" -", failure)

sys.exit(1 if failures else 0)
