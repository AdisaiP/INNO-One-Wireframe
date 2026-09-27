#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"

manifest = json.loads((ROOT / "inno-step17-helpdesk-core.json").read_text())
impl = json.loads((ROOT / "inno-implementation-contract.json").read_text())
issues = []

expected_operations = [
    "helpdesk.overview.get",
    "helpdesk.tickets.list",
    "helpdesk.tickets.get",
    "helpdesk.tickets.create",
    "helpdesk.tickets.reply",
    "helpdesk.tickets.reassign",
    "helpdesk.tickets.resolve",
    "helpdesk.categories.tree",
    "helpdesk.statuses.list",
]
expected_routes = [
    "/helpdesk",
    "/helpdesk/tickets",
    "/helpdesk/assigned",
    "/helpdesk/team",
    "/helpdesk/tickets/new",
    "/helpdesk/tickets/:ticketId",
]
expected_tables = [
    "helpdesk.tickets",
    "helpdesk.ticket_replies",
    "helpdesk.ticket_assignments",
    "helpdesk.ticket_status_history",
    "helpdesk.sla_policies",
    "helpdesk.ticket_sla",
    "helpdesk.categories",
    "helpdesk.statuses",
]

if manifest.get("contractVersion") != "0.8.0":
    issues.append("Step 17 manifest must be version 0.8.0")
if impl.get("contractVersion") != "0.19.0":
    issues.append("current Implementation Contract must be 0.19.0")
if manifest.get("operations") != expected_operations:
    issues.append("Step 17 operation catalog mismatch")
if manifest.get("webRoutes") != expected_routes:
    issues.append("Step 17 Web route catalog mismatch")
if manifest.get("persistence", {}).get("tables") != expected_tables:
    issues.append("Step 17 table catalog mismatch")
if manifest.get("persistence", {}).get("crossModuleForeignKeys") is not False:
    issues.append("Step 17 must forbid cross-module database foreign keys")

for ref in (
    "INNO-One-Step17-Helpdesk-Core.md",
    "inno-step17-helpdesk-core.json",
    "production/scripts/step17-local-smoke.py",
):
    if not (ROOT / ref).exists():
        issues.append(f"missing Step 17 source-of-truth file: {ref}")

helpdesk_root = PROD / "services/platform-api/src/Modules/Helpdesk"
db_text = (helpdesk_root / "Persistence/HelpdeskDbContext.cs").read_text()
for table in [x.split(".", 1)[1] for x in expected_tables]:
    if f'ToTable("{table}")' not in db_text:
        issues.append(f"HelpdeskDbContext missing mapping: {table}")

migration_files = list((helpdesk_root / "Persistence/Migrations").glob("*_Step17HelpdeskCore.cs"))
if len(migration_files) != 1:
    issues.append(f"expected one Step17HelpdeskCore migration, found {len(migration_files)}")

helpdesk_csproj = (helpdesk_root / "INNO.One.Modules.Helpdesk.csproj").read_text()
for forbidden in ("Modules/Platform", "Modules\\Platform", "Modules/Devices", "Modules\\Devices",
                  "INNO.One.Infrastructure"):
    if forbidden in helpdesk_csproj:
        issues.append(f"forbidden Helpdesk project reference: {forbidden}")

contracts = (PROD / "services/platform-api/src/INNO.One.Contracts/Directory/PlatformDirectoryContracts.cs").read_text()
device_contracts = (PROD / "services/platform-api/src/INNO.One.Contracts/Directory/DeviceDirectoryContracts.cs").read_text()
if "IPlatformDirectoryReader" not in contracts or "ReadUsersAsync" not in contracts or "SearchUsersAsync" not in contracts:
    issues.append("Platform directory query contract incomplete")
if "IDeviceDirectoryReader" not in device_contracts:
    issues.append("Device directory query contract missing")

device_module = (PROD / "services/platform-api/src/Modules/Devices/DevicesModule.cs").read_text()
if "IDeviceDirectoryReader, DeviceDirectoryReader" not in device_module:
    issues.append("Devices module must register IDeviceDirectoryReader")

program = (PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs").read_text()
for marker in (
    "HelpdeskDbContext",
    "HelpdeskDevelopmentSeed.SeedAsync",
    "api.MapHelpdeskEndpoints()",
):
    if marker not in program:
        issues.append(f"Platform API composition missing {marker}")

api_text = (helpdesk_root / "Api/HelpdeskEndpoints.cs").read_text()
route_markers = [
    '"/helpdesk/overview"',
    '"/helpdesk/tickets"',
    '"/helpdesk/tickets/{ticketId}"',
    '"/helpdesk/tickets/{ticketId}/replies"',
    '"/helpdesk/tickets/{ticketId}/assignment"',
    '"/helpdesk/tickets/{ticketId}/resolve"',
    '"/helpdesk/categories/tree"',
    '"/helpdesk/statuses"',
]
for marker in route_markers:
    if marker not in api_text:
        issues.append(f"Helpdesk API route missing {marker}")

for permission in (
    "helpdesk.ticket.view",
    "helpdesk.ticket.create",
    "helpdesk.ticket.reply",
    "helpdesk.ticket.assign",
    "helpdesk.ticket.resolve",
):
    if permission not in api_text:
        issues.append(f"Helpdesk API permission missing {permission}")

# Privacy and architecture guards.
helpdesk_source = "\n".join(
    p.read_text()
    for p in helpdesk_root.rglob("*.cs")
    if "/obj/" not in str(p) and "/bin/" not in str(p)
)
for forbidden_namespace in ("INNO.One.Modules.Platform", "INNO.One.Modules.Devices"):
    if forbidden_namespace in helpdesk_source:
        issues.append(f"Helpdesk directly imports another module: {forbidden_namespace}")
for forbidden_vendor_marker in ("node/", "ExternalId", "MeshCentralRemote", "IRemoteDeviceEngine"):
    if forbidden_vendor_marker in helpdesk_source:
        issues.append(f"Helpdesk leaks vendor implementation marker: {forbidden_vendor_marker}")

ledger_text = (helpdesk_root / "Infrastructure/HelpdeskLedgerWriter.cs").read_text()
if "PayloadJson" in ledger_text:
    issues.append("Helpdesk ledger should not expose domain body through a generic PayloadJson property")
# Event/audit callers pass IDs/statuses only; bodies must stay out of metadata/event anonymous objects.
if "Body = request.Body" in api_text:
    pass
if "new\n            {\n                replyId" not in api_text:
    issues.append("reply audit metadata structure not found")

platform_seed = (PROD / "services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs").read_text()
for marker in (
    '"helpdesk.ticket.view"',
    '"helpdesk.ticket.create"',
    '"helpdesk.ticket.reply"',
    '"helpdesk.ticket.assign"',
    '"helpdesk.ticket.resolve"',
    'AppId = "helpdesk"',
):
    if marker not in platform_seed:
        issues.append(f"Platform seed missing {marker}")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
app_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
for route in (
    'path="helpdesk"',
    'path="helpdesk/tickets"',
    'path="helpdesk/assigned"',
    'path="helpdesk/team"',
    'path="helpdesk/tickets/new"',
    'path="helpdesk/tickets/:ticketId"',
):
    if route not in app_root:
        issues.append(f"AppRoot missing Helpdesk route {route}")
for nav in (">Overview<", ">Tickets<", ">Assigned to Me<", ">Team Queue<"):
    if nav not in app_shell:
        issues.append(f"AppShell missing Helpdesk navigation {nav}")

api_client = (PROD / "apps/web-portal/src/api/client.ts").read_text()
for fn in (
    "getHelpdeskOverview",
    "getTickets",
    "getTicket",
    "createTicket",
    "replyToTicket",
    "reassignTicket",
    "resolveTicket",
    "getTicketCategories",
    "getTicketStatuses",
):
    if f"function {fn}" not in api_client:
        issues.append(f"Web API client missing {fn}")

print(f"step17_contract_version={manifest.get('contractVersion')}")
print(f"operations={len(expected_operations)}")
print(f"web_routes={len(expected_routes)}")
print(f"helpdesk_tables={len(expected_tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
