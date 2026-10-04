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
list_page=text("production/apps/web-portal/src/pages/WorkflowListPage.tsx")
builder=text("production/apps/web-portal/src/pages/WorkflowBuilderPage.tsx")
helpdesk=text("production/apps/web-portal/src/pages/AutomationRulePage.tsx")

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
    'api.MapGet("/workflows", ListAsync)',
    'api.MapGet("/workflows/{workflowId}", GetAsync)',
    'api.MapPost("/workflows", CreateAsync)',
    'api.MapPut("/workflows/{workflowId}", UpdateAsync)',
    'api.MapDelete("/workflows/{workflowId}", DeleteAsync)',
    'api.MapGet("/workflows/{workflowId}/versions", ListVersionsAsync)',
]:
    check("workflow API route "+route.split("(")[0].split(".")[-1], route in api)

check("view permission enforced",api.count('"workflows.view"')>=3)
check("manage permission enforced",api.count('"workflows.manage"')>=3)
check("opaque workflow IDs used",'OpaqueId.Format("wf"' in api and 'OpaqueId.TryParse(workflowId, "wf"' in api)
check("create snapshots version", "WorkflowDefinitionVersions.Add(version)" in api)
check("update snapshots version","WorkflowDefinitionVersions.Add(Snapshot" in api)
check("update increments version","row.Version++" in api)
check("ETag response emitted","Response.Headers.ETag" in api)
check("If-Match required","Headers.IfMatch" in api and "428" in api)
check("stale ETag returns 412","Status412PreconditionFailed" in api)
check("create update delete are transactional",api.count("BeginTransactionAsync")>=3 and api.count("CommitAsync")>=3)
check("audit writer targets workflow module","'workflows'" in ledger and "audit.audit_records" in ledger)
check("create audit action","workflow.definition.created" in api)
check("update audit action","workflow.definition.updated" in api)
check("delete audit action","workflow.definition.deleted" in api)
check("concurrency exception maps to 412","DbUpdateConcurrencyException" in api and "ConcurrencyConflict()" in api)
check("execution endpoint absent","/runs" not in api and "Execute" not in api)
check("publish endpoint absent","publish" not in api.lower())

check("workflow view permission seeded","workflows.view" in seed)
check("workflow manage permission seeded","workflows.manage" in seed)
check("platform admin receives workflow permissions","Step45CPermissions.Select" in seed)
check("workflow app installed in development seed",'AppId = "workflows"' in seed and '70000000-0000-0000-0000-000000000004' in seed)
check("workflow manifest exists",wf is not None)
check("workflow launcher enabled after persistence",bool(wf and wf.get("launcher") is True))
check("workflow entry permission is view",bool(wf and wf.get("entryPermission")=="workflows.view"))
check("workflow manifest permissions",bool(wf and wf.get("permissions")==["workflows.view","workflows.manage"]))

check("AppRoot uses workflow view permission","profile.permissions.includes('workflows.view')" in approot)
check("AppRoot uses workflow manage permission","profile.permissions.includes('workflows.manage')" in approot)
check("admin preview gate removed","canPreviewWorkflows" not in approot)
check("session draft provider removed","WorkflowDraftProvider" not in approot)
check("session draft context file removed",not (ROOT/"production/apps/web-portal/src/app/WorkflowDraftContext.tsx").exists())
check("workflow shell uses real permission","canViewWorkflows" in shell and "canPreviewWorkflows" not in shell)
check("workflow client lists definitions","getWorkflowDefinitions" in client)
check("workflow client gets definition","getWorkflowDefinition" in client)
check("workflow client creates definition","createWorkflowDefinition" in client)
check("workflow client updates with If-Match","updateWorkflowDefinition" in client and "'If-Match': eTag" in client)
check("workflow API types include ETag","WorkflowDefinitionDetail" in types and "eTag: string" in types)

check("list uses server query","getWorkflowDefinitions" in list_page and "useQuery" in list_page)
check("list no session language","session draft" not in list_page.lower())
check("list declares persisted boundary","Persisted definitions" in list_page)
check("builder gets persisted definition","getWorkflowDefinition" in builder)
check("builder creates persisted definition","createWorkflowDefinition" in builder)
check("builder updates persisted definition","updateWorkflowDefinition" in builder)
check("builder exposes version state","Version " in builder)
check("builder save creates new version","Save New Version" in builder)
check("builder has no Run Workflow","Run Workflow" not in builder)
check("builder has no Publish action","onClick={publish" not in builder and ">Publish<" not in builder and "'Publish'" not in builder)
check("builder retains shared canvas","INNOWorkflowCanvas" in builder)
check("Helpdesk simple automation remains separate","INNOWorkflowCanvas" not in helpdesk)

print(f"step45c_checks={checks}")
print(f"step45c_failures={len(failures)}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
