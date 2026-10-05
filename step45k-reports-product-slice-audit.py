from pathlib import Path
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
checks = 0
failures: list[str] = []

def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        failures.append(message)

def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")

program = text("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
reports_module = text("production/services/platform-api/src/Modules/Reports/ReportsModule.cs")
db_context = text("production/services/platform-api/src/Modules/Reports/Persistence/ReportsDbContext.cs")
api = text("production/services/platform-api/src/Modules/Reports/Api/ReportsEndpoints.cs")
generator = text("production/services/platform-api/src/Modules/Reports/Application/ReportGenerationService.cs")
schedule_clock = text("production/services/platform-api/src/Modules/Reports/Application/ReportScheduleClock.cs")
schedule_worker = text("production/services/platform-api/src/Modules/Reports/Infrastructure/ReportScheduleWorker.cs")
ledger = text("production/services/platform-api/src/Modules/Reports/Infrastructure/ReportsLedgerWriter.cs")
contracts = text("production/services/platform-api/src/INNO.One.Contracts/Reports/ReportContracts.cs")
device_reader = text("production/services/platform-api/src/Modules/Devices/Application/DeviceReportSourceReader.cs")
asset_reader = text("production/services/platform-api/src/Modules/Assets/Application/AssetReportSourceReader.cs")
helpdesk_reader = text("production/services/platform-api/src/Modules/Helpdesk/Application/HelpdeskReportSourceReader.cs")
devices_module = text("production/services/platform-api/src/Modules/Devices/DevicesModule.cs")
assets_module = text("production/services/platform-api/src/Modules/Assets/AssetsModule.cs")
helpdesk_module = text("production/services/platform-api/src/Modules/Helpdesk/HelpdeskModule.cs")
seed = text("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
manifest = json.loads(text("production/module-manifests.json"))
app_root = text("production/apps/web-portal/src/app/AppRoot.tsx")
app_shell = text("production/apps/web-portal/src/app/AppShell.tsx")
list_page = text("production/apps/web-portal/src/pages/ReportsPage.tsx")
editor = text("production/apps/web-portal/src/pages/ReportEditorPage.tsx")
runs = text("production/apps/web-portal/src/pages/ReportRunsPage.tsx")
schedules = text("production/apps/web-portal/src/pages/ReportSchedulesPage.tsx")
client = text("production/apps/web-portal/src/api/client.ts")
types = text("production/apps/web-portal/src/api/types.ts")
i18n_runtime = text("production/packages/i18n/src/index.tsx")
matrix = json.loads(text("inno-step44a-screen-interaction-matrix.json"))
roadmap = json.loads(text("inno-step45a-production-gap-roadmap.json"))
broad = text("step42-production-ux-browser-qa.py")

# Module/persistence/API wiring.
for marker in [
    ".AddReportsModule(coreDatabase)",
    "reportsDb.Database.MigrateAsync()",
    "api.MapReportsEndpoints()",
]:
    check(marker in program, "Platform API Reports wiring missing: " + marker)
for marker in [
    "AddDbContext<ReportsDbContext>",
    "AddScoped<ReportsLedgerWriter>",
    "AddScoped<IReportGenerationService, ReportGenerationService>",
    "AddHostedService<ReportScheduleWorker>",
]:
    check(marker in reports_module, "Reports module registration missing: " + marker)
for marker in [
    "DbSet<ReportDefinition>",
    "DbSet<ReportRun>",
    "DbSet<ReportSchedule>",
    'ToTable("report_definitions")',
    'ToTable("report_runs")',
    'ToTable("report_schedules")',
]:
    check(marker in db_context, "Reports persistence contract missing: " + marker)
for migration in [
    "production/services/platform-api/src/Modules/Reports/Persistence/Migrations/20261005035512_Step45KReportsProductSlice.cs",
    "production/services/platform-api/src/Modules/Reports/Persistence/Migrations/ReportsDbContextModelSnapshot.cs",
]:
    check((ROOT / migration).exists(), "Reports migration missing: " + migration)

# Public API and permissions.
for marker in [
    'MapGet("/reports/sources"',
    'MapGet("/reports"',
    'MapGet("/reports/{reportId}"',
    'MapPost("/reports"',
    'MapPut("/reports/{reportId}"',
    'MapDelete("/reports/{reportId}"',
    'MapPost("/reports/{reportId}/runs"',
    'MapGet("/reports/{reportId}/runs"',
    'MapGet("/reports/{reportId}/runs/{runId}"',
    'MapGet("/reports/{reportId}/runs/{runId}/download"',
    'MapGet("/reports/schedules"',
    'MapPost("/reports/schedules"',
    'MapPut("/reports/schedules/{scheduleId}"',
    'MapDelete("/reports/schedules/{scheduleId}"',
]:
    check(marker in api, "Reports endpoint missing: " + marker)
for permission in ["reports.view", "reports.create", "reports.manage"]:
    check(permission in api, "Reports API permission missing: " + permission)
check("ValidateIfMatch" in api and "StatusCodes.Status412PreconditionFailed" in api,
      "Reports optimistic concurrency guard missing")
check("ValidateDefinitionAsync" in api and "descriptor.RequiredPermission" in api,
      "Report definition source permission preflight missing")
check("run.RequestedByUserId != access.UserId" in api,
      "Generated output download is not owner-scoped")
check("Generated report output is available only to the user whose current scope produced it." in api,
      "Generated output owner denial contract missing")

# Generation/runtime contract.
for marker in [
    'EvaluateAsync(',
    '"reports.create"',
    "reportAccess.UserId != request.RequestedByUserId",
    "DefinitionSnapshotJson",
    'Trigger = NormalizeTrigger(request.Trigger)',
    'OutputMimeType = "text/csv; charset=utf-8"',
    "BuildCsv(result)",
    '"reports.run.completed"',
]:
    check(marker in generator, "Report generation guard missing: " + marker)
check("source.ReadAsync(" in generator,
      "Report generator does not cross the module-owned source boundary")
check("ReportSourceAccessException" in generator,
      "Report source permission/scope failure is not persisted")
for marker in [
    "ReportSourceDescriptor",
    "IReportSourceReader",
    "ReportGenerationRequest",
    "IReportGenerationService",
]:
    check(marker in contracts, "Shared Reports contract missing: " + marker)
for marker in [
    "daily",
    "weekly",
    "monthly",
    "TimeZoneInfo.FindSystemTimeZoneById",
]:
    check(marker in schedule_clock, "Schedule clock contract missing: " + marker)
for marker in [
    "PeriodicTimer",
    "x.NextRunAt <= now",
    "schedule.CreatedByUserId",
    "schedule.CreatedBySubject",
    '"schedule"',
    "ReportScheduleClock.NextOccurrence",
]:
    check(marker in schedule_worker, "Schedule worker guard missing: " + marker)
check('"reports.definition.created"' in api,
      "Reports definition audit action missing")
check('"reports.run.completed"' in generator,
      "Reports run audit action missing")
for marker in [
    "INSERT INTO audit.audit_records",
    "'reports'",
    "correlation_id",
    "trace_id",
    "metadata_json",
]:
    check(marker in ledger, "Reports audit ledger contract missing: " + marker)

# Module-owned source readers and scope enforcement.
source_contracts = [
    (device_reader, "devices.inventory", "devices.view"),
    (asset_reader, "assets.inventory", "assets.view"),
    (helpdesk_reader, "helpdesk.tickets", "helpdesk.ticket.view"),
]
for source, source_key, permission in source_contracts:
    check(source_key in source, "Report source key missing: " + source_key)
    check(permission in source, "Report source permission missing: " + permission)
    check("accessEvaluator.EvaluateAsync" in source,
          "Source reader does not re-check access: " + source_key)
    check("ReportSourceAccessException" in source,
          "Source reader does not fail closed: " + source_key)
    check("Matches(row, filters)" in source,
          "Source reader filter evaluation missing: " + source_key)
check("access.DeviceGroupIds" in device_reader
      and "access.OrganizationIds" in device_reader
      and "access.LocationIds" in device_reader,
      "Devices report source scope guards incomplete")
check("access.DeviceGroupIds" in asset_reader
      and "access.OrganizationIds" in asset_reader
      and "access.LocationIds" in asset_reader,
      "Assets report source scope guards incomplete")
check("ticket.RequesterUserId == access.UserId" in helpdesk_reader
      and "ticket.AssigneeUserId == access.UserId" in helpdesk_reader
      and "access.OrganizationIds.Contains" in helpdesk_reader,
      "Helpdesk report source scope guards incomplete")
check("AddScoped<IReportSourceReader, DeviceReportSourceReader>" in devices_module,
      "Devices report source reader is not registered")
check("AddScoped<IReportSourceReader, AssetReportSourceReader>" in assets_module,
      "Assets report source reader is not registered")
check("AddScoped<IReportSourceReader, HelpdeskReportSourceReader>" in helpdesk_module,
      "Helpdesk report source reader is not registered")

# Permissions, manifest, routes and shell.
for permission in ["reports.view", "reports.create", "reports.manage"]:
    check(permission in seed, "Development seed missing Reports permission: " + permission)
check("Step45KPermissions" in seed, "Step45K permission group missing")
check('AppId = "reports"' in seed and "Installed = true" in seed and "Enabled = true" in seed,
      "Reports app is not installed/enabled in development seed")
reports_manifest = next((x for x in manifest["modules"] if x["id"] == "reports"), None)
check(reports_manifest is not None, "Reports manifest missing")
if reports_manifest:
    check(reports_manifest.get("launcher") is True, "Reports launcher must be enabled")
    check(reports_manifest.get("entryPermission") == "reports.view",
          "Reports entry permission is wrong")
    for permission in ["reports.view", "reports.create", "reports.manage"]:
        check(permission in reports_manifest.get("permissions", []),
              "Reports manifest permission missing: " + permission)
    nav = {x["route"]: x for x in reports_manifest.get("navigation", [])}
    check(nav.get("/reports", {}).get("permission") == "reports.view",
          "Reports list navigation permission wrong")
    check(nav.get("/reports/schedules", {}).get("permission") == "reports.view",
          "Reports schedules navigation permission wrong")

for marker in [
    'path="reports"',
    'path="reports/new"',
    'path="reports/schedules"',
    'path="reports/:reportId/runs"',
    'path="reports/:reportId"',
    "canViewReports",
    "canCreateReports",
    "canManageReports",
]:
    check(marker in app_root, "Reports Product route/permission missing: " + marker)
check(app_root.index('path="reports/schedules"') < app_root.index('path="reports/:reportId"'),
      "Reports schedules route must precede dynamic report detail route")
for marker in [
    "const canViewReports = usePermission('reports.view')",
    "const inReports = location.pathname.startsWith('/reports')",
    'to="/reports"',
    'to="/reports/schedules"',
    "inReports ? t('reports.title')",
]:
    check(marker in app_shell, "Reports shell integration missing: " + marker)

# Web Product behavior.
for marker in [
    "getReports",
    "startReportRun",
    "INNOCollectionToolbar",
    "INNORowActions",
    "reports.action.generate",
    "reports.action.runs",
    "reports.action.edit",
    "reports.source.",
]:
    check(marker in list_page, "Reports P02 list missing: " + marker)
for marker in [
    "getReportSources",
    "getReport",
    "createReport",
    "updateReport",
    "ReportFilter",
    "reports.editor.columns",
    "reports.editor.filters",
    "reports.column.",
    "reports.dataType.",
    "INNOEditorFooter",
]:
    check(marker in editor, "Reports P06 editor missing: " + marker)
for marker in [
    "getReportRuns",
    "startReportRun",
    "downloadReportRun",
    "reports.runs.title",
    "reports.action.download",
    "INNOPagination",
]:
    check(marker in runs, "Reports P10 run history missing: " + marker)
for marker in [
    "getReportSchedules",
    "createReportSchedule",
    "updateReportSchedule",
    "deleteReportSchedule",
    "INNODialog",
    'role="switch"',
    "reports.schedules.deleteConfirm",
]:
    check(marker in schedules, "Reports schedule management missing: " + marker)
for marker in [
    "getReportSources",
    "getReports",
    "getReport",
    "createReport",
    "updateReport",
    "deleteReport",
    "startReportRun",
    "getReportRuns",
    "getReportRun",
    "downloadReportRun",
    "getReportSchedules",
    "createReportSchedule",
    "updateReportSchedule",
    "deleteReportSchedule",
]:
    check(marker in client, "Reports Web API client missing: " + marker)
for marker in [
    "ReportSourceDescriptor",
    "ReportDetail",
    "ReportRunListItem",
    "ReportRunDetail",
    "ReportSchedule",
    "ReportMutationInput",
    "ReportScheduleMutationInput",
]:
    check(marker in types, "Reports Web type missing: " + marker)

# Screen matrix / roadmap.
routes = {x["route"]: x for x in matrix["routes"]}
check(len(routes) == 75, "Current Product route matrix must contain 75 screens after Step45K")
expected = {
    "reports": ("ReportsPage", "P02"),
    "reports/new": ("ReportEditorPage", "P06"),
    "reports/:reportId": ("ReportEditorPage", "P06"),
    "reports/:reportId/runs": ("ReportRunsPage", "P10"),
    "reports/schedules": ("ReportSchedulesPage", "P05"),
}
for route, (page, pattern) in expected.items():
    item = routes.get(route, {})
    check(item.get("page") == page, route + " page classification wrong")
    check(item.get("pattern") == pattern, route + " interaction pattern wrong")
surface = {x["id"]: x for x in roadmap["surfaces"]}
check(surface.get("reports", {}).get("status") == "implemented",
      "Step45K roadmap does not mark Reports implemented")
check(surface.get("reports", {}).get("missing") == [],
      "Step45K roadmap still lists missing Reports Product scope")

# Bilingual parity/registration.
en = json.loads(text("production/packages/i18n/src/locales/en-US/reports.json"))
th = json.loads(text("production/packages/i18n/src/locales/th-TH/reports.json"))
check(set(en) == set(th), "Reports locale key parity failed")
check(all(str(v).strip() for v in en.values()), "Reports English catalog has blank values")
check(all(str(v).strip() for v in th.values()), "Reports Thai catalog has blank values")
check("enReports" in i18n_runtime and "thReports" in i18n_runtime,
      "Reports locale catalog is not registered")
for key in [
    "reports.title",
    "reports.editor.eyebrow",
    "reports.runs.eyebrow",
    "reports.schedules.eyebrow",
    "reports.source.devices.inventory",
    "reports.source.assets.inventory",
    "reports.source.helpdesk.tickets",
    "reports.column.hostname",
    "reports.column.assetTag",
    "reports.column.ticketNumber",
    "reports.schedules.deleteConfirm",
]:
    check(key in en and key in th, "Reports translation missing: " + key)

# Broad Product QA coverage.
flat_broad = broad.replace("\n", " ")
for route in ['"/reports"', '"/reports/new"', '"/reports/schedules"']:
    check(route in flat_broad, "Broad Product QA static Reports route missing: " + route)
check('"/reports"' in broad and '"/helpdesk/automation", "/assets/automation", "/reports"' in broad,
      "Broad Product QA does not discover Reports dynamic edit/history routes")

print(f"step45k_checks={checks}")
print(f"step45k_failures={len(failures)}")
for failure in failures:
    print(" -", failure)
sys.exit(1 if failures else 0)
