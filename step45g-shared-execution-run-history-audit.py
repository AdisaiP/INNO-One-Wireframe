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
planner = text("production/services/platform-api/src/Modules/Workflows/Application/WorkflowExecutionPlan.cs")
worker = text("production/services/platform-api/src/Modules/Workflows/Infrastructure/WorkflowExecutionWorker.cs")
run_api = text("production/services/platform-api/src/Modules/Workflows/Api/WorkflowRunEndpoints.cs")
definition_api = text("production/services/platform-api/src/Modules/Workflows/Api/WorkflowEndpoints.cs")
ledger = text("production/services/platform-api/src/Modules/Workflows/Infrastructure/WorkflowLedgerWriter.cs")
module = text("production/services/platform-api/src/Modules/Workflows/WorkflowsModule.cs")
contracts = text("production/services/platform-api/src/INNO.One.Contracts/Automation/AutomationExecutionContracts.cs")
helpdesk_executor = text("production/services/platform-api/src/Modules/Helpdesk/Infrastructure/HelpdeskAutomationNodeExecutor.cs")
helpdesk_module = text("production/services/platform-api/src/Modules/Helpdesk/HelpdeskModule.cs")
seed = text("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
manifest = json.loads(text("production/module-manifests.json"))
app_root = text("production/apps/web-portal/src/app/AppRoot.tsx")
list_page = text("production/apps/web-portal/src/pages/AutomationRulesPage.tsx")
builder = text("production/apps/web-portal/src/pages/AutomationRulePage.tsx")
runs_page = text("production/apps/web-portal/src/pages/AutomationRunsPage.tsx")
client = text("production/apps/web-portal/src/api/client.ts")
types = text("production/apps/web-portal/src/api/types.ts")
screen_matrix = json.loads(text("inno-step44a-screen-interaction-matrix.json"))

# Persistence/run model.
for marker in [
    "public sealed class WorkflowRun",
    "WorkflowVersion",
    "DefinitionSnapshotJson",
    "InputJson",
    "ActiveNodeIdsJson",
    "CompletedNodeIdsJson",
    "FailedNodeId",
    "NextAttemptAt",
    "RequestedBySubject",
    "MaxAttempts",
]:
    check(marker in entities, "WorkflowRun contract missing: " + marker)
for marker in [
    "public sealed class WorkflowRunStep",
    "CatalogKey",
    "Attempt",
    "OutputJson",
    "ErrorCode",
]:
    check(marker in entities, "WorkflowRunStep contract missing: " + marker)

check("public DbSet<WorkflowRun> WorkflowRuns" in db, "WorkflowRuns DbSet missing")
check("public DbSet<WorkflowRunStep> WorkflowRunSteps" in db, "WorkflowRunSteps DbSet missing")
check('entity.ToTable("workflow_runs")' in db, "workflow_runs mapping missing")
check('entity.ToTable("workflow_run_steps")' in db, "workflow_run_steps mapping missing")
check('HasForeignKey(x => x.RunId)' in db and 'DeleteBehavior.Cascade' in db, "run-step FK/cascade missing")
check('x.OwnerModule, x.WorkflowId, x.CreatedAt' in db, "owner-scoped run history index missing")
check('x.Status, x.NextAttemptAt, x.CreatedAt' in db, "worker queue index missing")
check('x.RunId, x.NodeId, x.Attempt' in db and '.IsUnique()' in db, "run-step idempotent attempt index missing")

migrations = list((ROOT / "production/services/platform-api/src/Modules/Workflows/Persistence/Migrations").glob("*_Step45GWorkflowExecutionRuns.cs"))
check(len(migrations) == 1, "Step45G migration missing or duplicated")
if migrations:
    migration = migrations[0].read_text(encoding="utf-8-sig")
    check('name: "workflow_runs"' in migration, "workflow_runs migration missing")
    check('name: "workflow_run_steps"' in migration, "workflow_run_steps migration missing")
    check('fk_workflow_run_steps_workflow_runs_run_id' in migration, "run-step FK migration missing")
    check('ReferentialAction.Cascade' in migration, "run-step cascade migration missing")

# Provider boundary.
check("interface IAutomationNodeExecutor" in contracts, "shared automation executor interface missing")
check("AutomationNodeExecutionContext" in contracts, "shared execution context missing")
check("AutomationNodeExecutionResult" in contracts, "shared execution result missing")
check("AutomationNodeValidationResult" in contracts, "module configuration preflight contract missing")
check("string OwnerModule" in contracts, "executor owner-module boundary missing")
check("Validate(" in contracts, "module executor validation contract missing")

# Planner intentionally deterministic in 45G.
for marker in [
    "AUTOMATION_BRANCHING_NOT_SUPPORTED",
    "AUTOMATION_CYCLE_NOT_SUPPORTED",
    "AUTOMATION_DISCONNECTED_GRAPH",
    "AUTOMATION_TRIGGER_REQUIRED",
    "AUTOMATION_END_REQUIRED",
    "AUTOMATION_NODE_NOT_EXECUTABLE",
]:
    check(marker in planner, "execution planner guard missing: " + marker)
check('x.Kind is "branch" or "condition"' in planner, "Branch/Condition must not fake execution in Step45G")
check("executor.Validate(node.CatalogKey, node.Configuration)" in planner, "module configuration preflight missing")
check("CoreKinds" in planner and '"trigger"' in planner and '"wait"' in planner and '"end"' in planner, "core executable node kinds changed")

# Worker semantics.
check("BackgroundService" in worker, "shared execution worker missing")
check("AddHostedService<WorkflowExecutionWorker>" in module, "execution worker not registered")
check("ResetInterruptedRunsAsync" in worker, "worker restart recovery missing")
check('"WORKER_INTERRUPTED"' in worker, "interrupted step evidence missing")
check('run.Status = "waiting"' in worker and "NextAttemptAt" in worker, "persisted Wait scheduling missing")
check("RetryDelaySeconds" in worker and '"retry_scheduled"' in worker, "retry policy missing")
check("nodeAttempt < run.MaxAttempts" in worker, "bounded retry guard missing")
check("IAccessEvaluator" in worker and "ManagePermission(run.OwnerModule)" in worker, "current actor permission re-check missing")
check("RequestedBySubject" in worker and 'new Claim("sub", subject)' in worker, "worker actor subject rehydration missing")
check("WorkflowExecutionPlanner.TryCreate" in worker, "worker does not revalidate immutable snapshot")
check("DefinitionSnapshotJson" in worker, "worker is not driven by run snapshot")
check("db.Database.BeginTransactionAsync" in worker, "run lifecycle transactions missing")
check("AppendRunLifecycleAsync" in worker, "execution lifecycle audit/event writer missing")
check('AuditActionPrefix(run.OwnerModule)' in worker, "lifecycle audit action is not owner-aware")
check('"automation.run." + transition' in worker, "run lifecycle integration events missing")
check("AUTOMATION_PERMISSION_REVOKED" in worker, "permission revocation failure missing")
check("catch (Exception ex)" in worker and "Automation execution worker iteration failed." in worker, "worker loop failure isolation missing")

# Helpdesk real side-effect provider.
check("IAutomationNodeExecutor" in helpdesk_executor, "Helpdesk executor missing")
check('public string OwnerModule => "helpdesk"' in helpdesk_executor, "Helpdesk executor ownership missing")
check('"helpdesk.ticket.assign_team"' in helpdesk_executor, "Assign Team executor missing")
check('"helpdesk.ticket.escalate"' in helpdesk_executor, "Escalate executor missing")
check('"helpdesk.ticket.assign"' in helpdesk_executor, "Helpdesk assignment authorization re-check missing")
check("CanAccessTicket" in helpdesk_executor, "ticket scope re-check missing")
check("TicketAssignments" in helpdesk_executor and "AssigneeTeam" in helpdesk_executor, "real ticket assignment side effect missing")
check("automationRunId" in helpdesk_executor, "automation attribution missing from Helpdesk ledger")
check('"ticket.assigned"' in helpdesk_executor, "canonical ticket assigned outbox event missing")
check("idempotentReplay" in helpdesk_executor, "side-effect idempotency evidence missing")
check("DbUpdateConcurrencyException" in helpdesk_executor, "Helpdesk concurrency retry boundary missing")
check("TryTeam" in helpdesk_executor and '"actionValue"' in helpdesk_executor, "legacy migrated team configuration compatibility missing")
check("AddScoped<IAutomationNodeExecutor, HelpdeskAutomationNodeExecutor>" in helpdesk_module, "Helpdesk executor not registered")

# Run API: module-scoped only.
for marker in [
    'MapPost("/helpdesk/automations/{automationId}/runs"',
    'MapGet("/helpdesk/automations/{automationId}/runs"',
    'MapGet("/helpdesk/automations/{automationId}/runs/{runId}"',
]:
    check(marker in run_api, "Helpdesk run API missing: " + marker)
check("/workflows/" not in run_api, "generic workflow run API must not exist")
check('"helpdesk"' in run_api and "OwnerModule" in run_api, "Helpdesk run owner scope missing")
check('"helpdesk.automation.manage"' in run_api, "run enqueue manage permission missing")
check('"helpdesk.automation.run.view"' in run_api, "run history permission missing")
check("WorkflowDefinitionVersions" in run_api and "definition.Version" in run_api, "run does not load immutable current version")
check("DefinitionSnapshotJson = snapshot" in run_api, "run snapshot persistence missing")
check("WorkflowExecutionPlanner.TryCreate" in run_api, "enqueue preflight missing")
check("StatusCodes.Status202Accepted" not in run_api or "Results.Accepted" in run_api, "enqueue should return accepted")
check("AppendAuditAsync" in run_api and '"helpdesk.automation.run.queued"' in run_api, "queued run audit missing")
check("AppendOutboxAsync" in run_api and '"automation.run.queued"' in run_api, "queued run event missing")
check("BeginTransactionAsync" in run_api, "queued run + ledger transaction missing")
check("api.MapWorkflowRunEndpoints()" in definition_api, "run endpoints not mapped by Automation Core")

# Permissions/module manifest.
check('"helpdesk.automation.run.view"' in seed, "run view permission not seeded")
check("Step45GPermissions" in seed, "Step45G permission evolution group missing")
helpdesk = next((m for m in manifest["modules"] if m["id"] == "helpdesk"), None)
check(helpdesk is not None, "Helpdesk manifest missing")
if helpdesk:
    check("helpdesk.automation.run.view" in helpdesk.get("permissions", []), "run view permission missing from Helpdesk manifest")

# Product routing/UI.
check("AutomationRunsPage = lazy" in app_root, "Run History page is not lazy-loaded")
check('path="helpdesk/automation/:automationId/runs"' in app_root, "P10 Run History route missing")
check("canViewAutomationRuns" in app_root and "helpdesk.automation.run.view" in app_root, "run history route permission gate missing")
check("/workflows" not in runs_page, "Run History leaks to standalone workflow Product")
check("getHelpdeskAutomationRuns" in runs_page, "Run History does not use module-owned API")
check("startHelpdeskAutomationRun" in runs_page, "Run action not wired")
check("getTickets" in runs_page, "ticket business context selector missing")
check("refetchInterval" in runs_page, "runtime polling missing")
check("INNODrawer" in runs_page, "persisted step detail drawer missing")
check("definitionSnapshot.nodes" in runs_page, "run detail does not render immutable snapshot labels")
check("useI18n()" in runs_page, "Run History is not bilingual")
check("helpdesk.automation.run.view" in list_page, "Automation list does not expose history by permission")
check("helpdesk.automation.run.view" in builder, "Builder does not gate Run History")
check("helpdesk.automation.builder.team" in builder, "Assign Team runtime configuration missing")
check("durationSeconds" in builder, "Wait runtime configuration missing")
check("Run Workflow" not in builder, "builder must not bypass ticket-context run surface")
check("Publish" not in builder, "Publish remains out of Step45G")

# API client/types.
for marker in [
    "getHelpdeskAutomationRuns",
    "getHelpdeskAutomationRun",
    "startHelpdeskAutomationRun",
]:
    check(marker in client, "Web run client missing: " + marker)
for marker in [
    "AutomationRunStatus",
    "AutomationRunSummary",
    "AutomationRunDetail",
    "AutomationRunStep",
]:
    check(marker in types, "Web run type missing: " + marker)

# Product interaction matrix.
routes = {item["route"]: item for item in screen_matrix["routes"]}
check(len(routes) == 66, "Current Product matrix must contain 66 screens after Step45H")
run_route = routes.get("helpdesk/automation/:automationId/runs", {})
check(run_route.get("page") == "AutomationRunsPage", "Run History matrix page missing")
check(run_route.get("pattern") == "P10", "Run History must use P10")
check(run_route.get("surface") == "history+run-detail", "Run History surface classification changed")
check("workflows" not in routes and "workflows/:workflowId" not in routes, "standalone workflow Product returned")

# Bilingual parity.
for filename in ["helpdesk.json", "workflow.json"]:
    en = json.loads(text("production/packages/i18n/src/locales/en-US/" + filename))
    th = json.loads(text("production/packages/i18n/src/locales/th-TH/" + filename))
    check(set(en) == set(th), filename + " locale key parity failed")
    check(all(str(v).strip() for v in en.values()), filename + " has blank English translations")
    check(all(str(v).strip() for v in th.values()), filename + " has blank Thai translations")
helpdesk_en = json.loads(text("production/packages/i18n/src/locales/en-US/helpdesk.json"))
for key in [
    "helpdesk.automation.runs.title",
    "helpdesk.automation.runs.run",
    "helpdesk.automation.runs.status.queued",
    "helpdesk.automation.runs.status.running",
    "helpdesk.automation.runs.status.waiting",
    "helpdesk.automation.runs.status.completed",
    "helpdesk.automation.runs.status.failed",
    "helpdesk.automation.runs.stepStatus.interrupted",
]:
    check(key in helpdesk_en, "runtime translation missing: " + key)

print(f"step45g_checks={checks}")
print(f"step45g_failures={len(failures)}")
for failure in failures:
    print(" -", failure)

sys.exit(1 if failures else 0)
