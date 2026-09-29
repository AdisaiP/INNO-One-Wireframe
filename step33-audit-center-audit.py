from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
endpoint = read("production/services/platform-api/src/Modules/Platform/Api/AdminAuditEndpoints.cs")
contract = read("production/services/platform-api/src/INNO.One.Contracts/Audit/IAuditQueryService.cs")
service = read("production/services/platform-api/src/INNO.One.Infrastructure/Audit/AuditQueryService.cs")
infra = read("production/services/platform-api/src/INNO.One.Infrastructure/InfrastructureRegistration.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
overview = read("production/apps/web-portal/src/pages/AdminOverviewPage.tsx")
page = read("production/apps/web-portal/src/pages/AdminAuditPage.tsx")
styles = read("production/apps/web-portal/src/shell.css")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")

for marker in [
    '"admin.audit.view"',
    "Step33Permissions",
]:
    if marker not in seed:
        issues.append("seed " + marker)

for marker in [
    "IAuditQueryService",
    "AuditQuery",
    "AuditPageResult",
    "AuditRecordSnapshot",
    "AuditFacets",
]:
    if marker not in contract:
        issues.append("contract " + marker)

for marker in [
    "class AuditQueryService",
    "QueryAsync",
    "GetAsync",
    "GetFacetsAsync",
    "AsNoTracking",
]:
    if marker not in service:
        issues.append("service " + marker)

for marker in [
    "IAuditQueryService",
    "AuditQueryService",
]:
    if marker not in infra:
        issues.append("registration " + marker)

for marker in [
    "MapAdminAuditEndpoints()",
]:
    if marker not in program:
        issues.append("program " + marker)

for marker in [
    'api.MapGet("/admin/audit"',
    'api.MapGet("/admin/audit/facets"',
    'api.MapGet("/admin/audit/{auditId}"',
    '"admin.audit.view"',
    "PagedResponse<AuditListItemResponse>",
    "ResolveActorNamesAsync",
    "JsonDocument.Parse",
]:
    if marker not in endpoint:
        issues.append("endpoint " + marker)

for forbidden in [
    'MapPost("/admin/audit',
    'MapPut("/admin/audit',
    'MapPatch("/admin/audit',
    'MapDelete("/admin/audit',
]:
    if forbidden in endpoint:
        issues.append("audit mutation endpoint " + forbidden)

for marker in [
    "AdminAuditListItem",
    "AdminAuditDetail",
    "AdminAuditFacets",
]:
    if marker not in types:
        issues.append("types " + marker)

for marker in [
    "getAdminAudit",
    "getAdminAuditFacets",
    "getAdminAuditDetail",
]:
    if marker not in client:
        issues.append("client " + marker)

for marker in [
    "AdminAuditPage",
    "admin.audit.view",
    'path="admin/audit"',
]:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    "admin.audit.view",
    'to="/admin/audit"><SideNavLabel token="section.audit">Audit Log</SideNavLabel></NavLink>',
    "Audit Log",
]:
    if marker not in shell:
        issues.append("shell " + marker)

if 'to="/admin/audit"' not in overview:
    issues.append("overview audit card")

for marker in [
    'title="Audit Log"',
    "Audit Records",
    "Search audit records",
    "Actor ID",
    'type="datetime-local"',
    "Audit Detail",
    "Metadata",
    "INNOPagination",
]:
    if marker not in page:
        issues.append("page " + marker)

for forbidden in [
    "Export",
    "Delete Audit",
    "Edit Audit",
    "New Audit",
]:
    if forbidden in page:
        issues.append("fake audit action " + forbidden)

for marker in [
    "admin-audit-layout",
    "admin-audit-detail",
    "audit-metadata-block",
]:
    if marker not in styles:
        issues.append("style " + marker)

version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 23, 0):
    issues.append("implementation contract")

print("step33_scope=audit-list,filters,detail,pagination")
print("step33_implementation_contract=0.23.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
