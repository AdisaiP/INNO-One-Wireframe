from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []
checks = 0

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

def check(name, condition):
    global checks
    checks += 1
    if not condition:
        issues.append(name)

endpoint = read("production/services/platform-api/src/Modules/Devices/Api/InventoryQueryEndpoints.cs")
worker = read("production/services/platform-api/src/Modules/Devices/Infrastructure/InventoryQueryWorker.cs")
entities = read("production/services/platform-api/src/Modules/Devices/Domain/DeviceEntities.cs")
db = read("production/services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs")
module = read("production/services/platform-api/src/Modules/Devices/DevicesModule.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
page = read("production/apps/web-portal/src/pages/InventoryQueryPage.tsx")
css = read("production/apps/web-portal/src/pages/InventoryQueryPage.css")
client = read("production/apps/web-portal/src/api/client.ts")
types = read("production/apps/web-portal/src/api/types.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
api_contract = read("inno-api-contract.json")
data_contract = read("inno-data-model-contract.json")

for marker in [
    'api.MapGet("/devices/inventory-queries", ListSavedQueriesAsync)',
    'WithName("devices.inventory_queries.list")',
    'api.MapPost("/devices/inventory-queries", CreateSavedQueryAsync)',
    'WithName("devices.inventory_queries.save")',
    'api.MapPost("/devices/inventory-queries/runs", CreateRunAsync)',
    'WithName("devices.inventory_queries.run")',
    'api.MapGet("/devices/inventory-queries/runs/{runId}/results", ListResultsAsync)',
    'WithName("devices.inventory_query_results.list")',
    'httpContext.User, "devices.manage"',
    'httpContext.User, "devices.view"',
]:
    check("endpoint marker " + marker, marker in endpoint)

check("no public run detail endpoint", 'MapGet("/devices/inventory-queries/runs/{runId}",' not in endpoint)
check("software fact validation", 'normalizedFact != "software"' in endpoint)
check("group scope validation", 'normalizedScope is not ("all" or "group")' in endpoint)
check("saved query self ownership", "x.CreatedByUserId == access.UserId" in endpoint)
check("run result ownership", "x.RequestedByUserId == access.UserId" in endpoint)
check("results reapply current effective scope", "var accessibleDevices = ApplyAccessScope(" in endpoint)
check("shared operation producer", '"devices.inventory_query"' in endpoint and "CreateOperationAsync" in endpoint)
for marker in [
    "db.SoftwareInventorySnapshots",
    "db.InstalledSoftware",
    "ApplyAccessScope",
    "UpdateOperationAsync",
    '"succeeded"',
    '"INVENTORY_QUERY_FAILED"',
]:
    check("worker marker " + marker, marker in worker)

for marker in ["InventoryQuery", "InventoryQueryRun", "InventoryQueryResult"]:
    check("entity " + marker, "class " + marker in entities)

for table in ["inventory_queries", "inventory_query_runs", "inventory_query_results"]:
    check("db table " + table, f'ToTable("{table}")' in db)
    check("frozen data table " + table, f'"name": "{table}"' in data_contract)

check("worker registration", "AddHostedService<InventoryQueryWorker>()" in module)
check("endpoint registration", "api.MapInventoryQueryEndpoints();" in program)

for op_id, path in [
    ("devices.inventory_queries.list", "/devices/inventory-queries"),
    ("devices.inventory_queries.save", "/devices/inventory-queries"),
    ("devices.inventory_queries.run", "/devices/inventory-queries/runs"),
    ("devices.inventory_query_results.list", "/devices/inventory-queries/runs/{runId}/results"),
]:
    check("frozen api id " + op_id, f'"id": "{op_id}"' in api_contract)
    check("frozen api path " + path, f'"path": "{path}"' in api_contract)
for marker in [
    "Saved Queries",
    "Query Builder",
    "Run Query",
    "Save Query",
    "Matching Devices",
    "getOperation",
    "getInventoryQueryResults",
    "Process, Service, File and Folder remain unavailable",
]:
    check("web page marker " + marker, marker in page)

check("web route", 'path="devices/query"' in root and "<InventoryQueryPage" in root)
check("devices nav", 'to="/devices/query"' in shell and "Inventory Query" in shell)
check("device detail exclusion", "'/devices/query'" in shell)
check("client saved queries", "getInventoryQueries" in client)
check("client save", "saveInventoryQuery" in client)
check("client run", "runInventoryQuery" in client)
check("client results", "getInventoryQueryResults" in client)
check("web operation reuse", "getOperation" in page)
check("typed definition", "interface InventoryQueryDefinition" in types)
check("software-only typed fact", "factType: 'software'" in types)
check("builder-first narrow css", "@media (max-width: 850px)" in css and "order: 1" in css and "order: 2" in css)
check("no react flow page", "ReactFlow" not in page and "react-flow" not in page.lower())
check("design system frozen", 'DesignSystem = "V1.26"' in versions)
check("ui contract frozen", 'UiContract = "1.20.0"' in versions)
version = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation = tuple(map(int, version.groups())) if version else (0, 0, 0)
check("implementation contract 0.32+", implementation >= (0, 32, 0))

migration_files = list(
    (ROOT / "production/services/platform-api/src/Modules/Devices/Persistence/Migrations")
    .glob("*_Step43InventoryQuery.cs")
)
check("step43 migration exists", len(migration_files) == 1)
if migration_files:
    migration = migration_files[0].read_text(encoding="utf-8-sig")
    for table in ["inventory_queries", "inventory_query_runs", "inventory_query_results"]:
        check("migration table " + table, f'name: "{table}"' in migration)

print("step43_scope=inventory-query")
print("step43_source=devices-software-inventory")
print("step43_operation=shared-platform-operation")
print("step43_static_checks=" + str(checks))
print("step43_static_failures=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)
raise SystemExit(1 if issues else 0)
