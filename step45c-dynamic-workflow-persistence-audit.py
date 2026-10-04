from pathlib import Path
import json, sys

ROOT=Path(__file__).resolve().parent
checks=0
failures=[]

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok:
        failures.append((name,detail))

def text(rel):
    return (ROOT/rel).read_text(encoding="utf-8-sig")

program=text("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
proj=text("production/services/platform-api/src/INNO.One.PlatformApi/INNO.One.PlatformApi.csproj")
module=text("production/services/platform-api/src/Modules/Workflows/WorkflowsModule.cs")
entities=text("production/services/platform-api/src/Modules/Workflows/Domain/WorkflowEntities.cs")
db=text("production/services/platform-api/src/Modules/Workflows/Persistence/WorkflowsDbContext.cs")
api=text("production/services/platform-api/src/Modules/Workflows/Api/WorkflowEndpoints.cs")
ledger=text("production/services/platform-api/src/Modules/Workflows/Infrastructure/WorkflowLedgerWriter.cs")
seed=text("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
manifest=json.loads(text("production/module-manifests.json"))
approot=text("production/apps/web-portal/src/app/AppRoot.tsx")
shell=text("production/apps/web-portal/src/app/AppShell.tsx")
client=text("production/apps/web-portal/src/api/client.ts")
types=text("production/apps/web-portal/src/api/types.ts")
helpdesk_list=text("production/apps/web-portal/src/pages/AutomationRulesPage.tsx")
helpdesk_builder=text("production/apps/web-portal/src/pages/AutomationRulePage.tsx")

wf=next((x for x in manifest.get("modules", []) if x.get("id")=="workflows"),None)
migrations=list((ROOT/"production/services/platform-api/src/Modules/Workflows/Persistence/Migrations").glob("*Step45CWorkflowPersistence.cs"))

check("workflow module project exists",(ROOT/"production/services/platform-api/src/Modules/Workflows/INNO.One.Modules.Workflows.csproj").exists())
check("workflow module wired into host","AddWorkflowsModule(coreDatabase)" in program)
check("workflow endpoints mapped","MapWorkflowEndpoints()" in program)
check("workflow db migrates on startup","WorkflowsDbContext" in program and "workflowsDb.Database.MigrateAsync()" in program)
check("host references workflow project","INNO.One.Modules.Workflows.csproj" in proj)
check("workflow schema is dedicated",'Schema = "workflows"' in db)
check("definition table exists",'ToTable("workflow_definitions")' in db)
check("version table exists",'ToTable("workflow_definition_versions")' in db)
check("definition graph uses jsonb",'HasColumnType("jsonb")' in db)
check("definition has explicit version","public long Version" in entities)
check("immutable version entity exists","WorkflowDefinitionVersion" in entities)
check("version uniqueness frozen","x.WorkflowId, x.Version" in db and "IsUnique()" in db)
check("definition version is EF concurrency token","Property(x => x.Version).IsConcurrencyToken()" in db)
check("Step45C migration generated",len(migrations)==1,len(migrations))

for route in [
    'api.MapGet("/workflows", ListLegacyAsync)',
    'api.MapGet("/workflows/{workflowId}", GetLegacyAsync)',
    'api.MapPost("/workflows", CreateLegacyAsync)',
    'api.MapPut("/workflows/{workflowId}", UpdateLegacyAsync)',
    'api.MapDelete("/workflows/{workflowId}", DeleteLegacyAsync)',
    'api.MapGet("/workflows/{workflowId}/versions", ListLegacyVersionsAsync)',
]:
    check("workflow API route "+route.split("(")[0].split(".")[-1], route in api)

check("legacy view permission retained",'"workflows.view"' in api and '"legacy_unassigned"' in api)
check("legacy manage permission retained",'"workflows.manage"' in api and '"legacy_unassigned"' in api)
check("opaque workflow IDs used",'OpaqueId.Format("wf"' in api and 'OpaqueId.TryParse(workflowId, "wf"' in api)
check("create snapshots version", "WorkflowDefinitionVersions.Add(version)" in api)
check("update snapshots version","WorkflowDefinitionVersions.Add(Snapshot" in api)
check("update increments version","row.Version++" in api)
check("ETag response emitted","Response.Headers.ETag" in api)
check("If-Match required","Headers.IfMatch" in api and "428" in api)
check("stale ETag returns 412","Status412PreconditionFailed" in api)
check("create update delete are transactional",api.count("BeginTransactionAsync")>=3 and api.count("CommitAsync")>=3)
check("audit writer accepts module ownership","string module" in ledger and "string targetType" in ledger and "audit.audit_records" in ledger)
check("create audit action remains scope-derived",'scope.AuditActionPrefix + ".created"' in api and '"workflow.definition"' in api)
check("update audit action remains scope-derived",'scope.AuditActionPrefix + ".updated"' in api and '"workflow.definition"' in api)
check("delete audit action remains scope-derived",'scope.AuditActionPrefix + ".deleted"' in api and '"workflow.definition"' in api)
check("concurrency exception maps to 412","DbUpdateConcurrencyException" in api and "ConcurrencyConflict()" in api)
check("execution endpoint absent","/runs" not in api and "Execute" not in api)
check("publish endpoint absent","publish" not in api.lower())

check("workflow view permission seeded","workflows.view" in seed)
check("workflow manage permission seeded","workflows.manage" in seed)
check("platform admin receives workflow permissions","Step45CPermissions.Select" in seed)
check("workflow app installed in development seed",'AppId = "workflows"' in seed and '70000000-0000-0000-0000-000000000004' in seed)
check("workflow manifest exists",wf is not None)
check("workflow persistence core hidden from launcher after 45F",bool(wf and wf.get("launcher") is False and wf.get("name")=="Automation Core"))
check("workflow entry permission is view",bool(wf and wf.get("entryPermission")=="workflows.view"))
check("workflow manifest permissions",bool(wf and wf.get("permissions")==["workflows.view","workflows.manage"]))

check("AppRoot retires generic workflow view permission","profile.permissions.includes('workflows.view')" not in approot and 'path="workflows/*"' in approot)
check("AppRoot retires generic workflow manage permission","profile.permissions.includes('workflows.manage')" not in approot and 'Navigate to="/helpdesk/automation"' in approot)
check("admin preview gate removed","canPreviewWorkflows" not in approot)
check("session draft provider removed","WorkflowDraftProvider" not in approot)
check("session draft context file removed",not (ROOT/"production/apps/web-portal/src/app/WorkflowDraftContext.tsx").exists())
check("workflow shell has no standalone Product context","canViewWorkflows" not in shell and "inWorkflows" not in shell and "canPreviewWorkflows" not in shell)
check("workflow client lists definitions","getWorkflowDefinitions" in client)
check("workflow client gets definition","getWorkflowDefinition" in client)
check("workflow client creates definition","createWorkflowDefinition" in client)
check("workflow client updates with If-Match","updateWorkflowDefinition" in client and "'If-Match': eTag" in client)
check("workflow API types include ETag","WorkflowDefinitionDetail" in types and "eTag: string" in types)

check("Helpdesk list uses persisted server query","getHelpdeskAutomationDefinitions" in helpdesk_list and "useQuery" in helpdesk_list)
check("Helpdesk list no session language","session draft" not in helpdesk_list.lower())
check("Helpdesk list declares module-owned persisted boundary","helpdesk.automation.list.description" in helpdesk_list)
check("Helpdesk builder gets persisted definition","getHelpdeskAutomationDefinition" in helpdesk_builder)
check("Helpdesk builder creates persisted definition","createHelpdeskAutomationDefinition" in helpdesk_builder)
check("Helpdesk builder updates persisted definition","updateHelpdeskAutomationDefinition" in helpdesk_builder)
check("Helpdesk builder exposes version state","query.data?.version" in helpdesk_builder)
check("Helpdesk builder save creates new version","helpdesk.automation.builder.save" in helpdesk_builder)
check("Helpdesk builder has no Run Workflow","Run Workflow" not in helpdesk_builder)
check("Helpdesk builder has no Publish action","onClick={publish" not in helpdesk_builder and ">Publish<" not in helpdesk_builder and "'Publish'" not in helpdesk_builder)
check("Helpdesk builder retains shared canvas","INNOWorkflowCanvas" in helpdesk_builder)
check("standalone Workflow Product page files removed",not (ROOT/"production/apps/web-portal/src/pages/WorkflowListPage.tsx").exists() and not (ROOT/"production/apps/web-portal/src/pages/WorkflowBuilderPage.tsx").exists())

print(f"step45c_checks={checks}")
print(f"step45c_failures={len(failures)}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
