from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

endpoint = read("production/services/platform-api/src/Modules/Platform/Api/AdminSettingsEndpoints.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
overview = read("production/apps/web-portal/src/pages/AdminOverviewPage.tsx")
page = read("production/apps/web-portal/src/pages/AdminPlatformSettingsPage.tsx")
styles = read("production/apps/web-portal/src/shell.css")

for marker in [
    'api.MapGet("/admin/settings"',
    '"admin.settings.manage"',
    'configurationMode = "contract-and-deployment-managed"',
    "mutableSettings = false",
    "ContractVersions.ApiBasePath",
    '"Bearer JWT"',
    '"Permission + resource scope"',
    '"Page-number pagination"',
    '"application/problem+json"',
    '"ETag / If-Match"',
    '"ISO 8601 with timezone"',
    "environment.EnvironmentName",
    "ContractVersions.DesignSystem",
    "ContractVersions.UiContract",
    "ContractVersions.ApiContract",
    "ContractVersions.EventAuditContract",
    "ContractVersions.DataModelContract",
    "ContractVersions.ImplementationContract",
]:
    if marker not in endpoint:
        issues.append("endpoint " + marker)

for forbidden in [
    'MapPost("/admin/settings',
    'MapPut("/admin/settings',
    'MapPatch("/admin/settings',
    'MapDelete("/admin/settings',
    "Authentication:Authority",
    "MeshCentral:Password",
    "ConnectionStrings",
]:
    if forbidden in endpoint:
        issues.append("unsafe settings endpoint " + forbidden)

for marker in [
    "Step36Permissions",
    '("admin.settings.manage", "admin", "Manage platform settings")',
]:
    if marker not in seed:
        issues.append("seed " + marker)

if seed.count(".Concat(Step36Permissions)") != 2:
    issues.append("step36 permission ensure chain")

if "MapAdminSettingsEndpoints()" not in program:
    issues.append("program settings endpoint")

for marker in [
    "AdminPlatformSetting",
    "AdminPlatformSettingsResponse",
    "mutableSettings",
    "configurationMode",
]:
    if marker not in types:
        issues.append("types " + marker)

for marker in [
    "getAdminPlatformSettings",
    "'/admin/settings'",
]:
    if marker not in client:
        issues.append("client " + marker)

for marker in [
    "AdminPlatformSettingsPage",
    "admin.settings.manage",
    'path="admin/settings"',
]:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    "admin.settings.manage",
    'to="/admin/settings">Platform Settings</NavLink>',
]:
    if marker not in shell:
        issues.append("shell " + marker)

if 'to="/admin/settings"' not in overview:
    issues.append("overview settings link")

for marker in [
    'title="Platform Settings"',
    "Refresh Settings",
    "Platform settings are deployment-managed",
    "Effective Platform Settings",
    "Future mutation boundary",
    "getAdminPlatformSettings",
    "platform-setting-value",
]:
    if marker not in page and marker not in styles:
        issues.append("page " + marker)

for forbidden in [
    "Save Settings",
    "Edit Settings",
    "Update Settings",
    "Default Time Zone",
    "Retention Days",
    'type="checkbox"',
    'type="number"',
]:
    if forbidden in page:
        issues.append("fake settings mutation " + forbidden)

version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 26, 0):
    issues.append("implementation contract")

print("step36_scope=platform-settings-foundation,effective-contracts,deployment-mode")
print("step36_mutable_settings=false")
print("step36_implementation_contract=0.26.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
