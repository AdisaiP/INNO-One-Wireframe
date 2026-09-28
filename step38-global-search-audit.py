from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

contracts = read("production/services/platform-api/src/INNO.One.Contracts/Search/SearchContracts.cs")
endpoint = read("production/services/platform-api/src/Modules/Platform/Api/GlobalSearchEndpoints.cs")
devices = read("production/services/platform-api/src/Modules/Devices/Application/DevicesGlobalSearchProvider.cs")
assets = read("production/services/platform-api/src/Modules/Assets/Application/AssetsGlobalSearchProvider.cs")
helpdesk = read("production/services/platform-api/src/Modules/Helpdesk/Application/HelpdeskGlobalSearchProvider.cs")
devices_module = read("production/services/platform-api/src/Modules/Devices/DevicesModule.cs")
assets_module = read("production/services/platform-api/src/Modules/Assets/AssetsModule.cs")
helpdesk_module = read("production/services/platform-api/src/Modules/Helpdesk/HelpdeskModule.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
page = read("production/apps/web-portal/src/pages/SearchPage.tsx")
styles = read("production/apps/web-portal/src/shell.css")

for marker in [
    "public sealed record GlobalSearchResult",
    "public interface IGlobalSearchProvider",
    "ClaimsPrincipal principal",
    "string Type",
    "string Id",
    "string Title",
    "string Subtitle",
    "string Route",
]:
    if marker not in contracts:
        issues.append("contracts " + marker)

for marker in [
    'api.MapGet("/search"',
    '"platform.search.use"',
    "IEnumerable<IGlobalSearchProvider> providers",
    "provider.SearchAsync(",
    "Search query is required",
    "Math.Clamp(limit, 1, 50)",
]:
    if marker not in endpoint:
        issues.append("endpoint " + marker)

for forbidden in [
    "DevicesDbContext",
    "AssetsDbContext",
    "HelpdeskDbContext",
    "Modules.Devices",
    "Modules.Assets",
    "Modules.Helpdesk",
]:
    if forbidden in endpoint:
        issues.append("cross-module shortcut " + forbidden)

provider_checks = [
    ("devices", devices, "devices.view", "DeviceGroupMembers", 'OpaqueId.Format("dev"', '"/devices/"'),
    ("assets", assets, "assets.view", "IDeviceDirectoryReader", 'OpaqueId.Format("asset"', '"/assets/"'),
    ("helpdesk", helpdesk, "helpdesk.ticket.view", "RequesterOrganizationUnitId", 'OpaqueId.Format("ticket"', '"/helpdesk/tickets/"'),
]
for name, source, permission, scope_marker, id_marker, route_marker in provider_checks:
    for marker in [
        "IGlobalSearchProvider",
        permission,
        scope_marker,
        id_marker,
        route_marker,
    ]:
        if marker not in source:
            issues.append(name + " provider " + marker)

for name, module_source, provider_name in [
    ("devices", devices_module, "DevicesGlobalSearchProvider"),
    ("assets", assets_module, "AssetsGlobalSearchProvider"),
    ("helpdesk", helpdesk_module, "HelpdeskGlobalSearchProvider"),
]:
    if "AddScoped<IGlobalSearchProvider, " + provider_name + ">" not in module_source:
        issues.append(name + " provider registration")

for marker in [
    "Step38Permissions",
    '("platform.search.use", "platform", "Use global search")',
]:
    if marker not in seed:
        issues.append("seed " + marker)

if seed.count(".Concat(Step38Permissions)") != 2:
    issues.append("step38 permission ensure chain")
if seed.count('"platform.search.use"') != 7:
    issues.append("step38 seeded persona grants")
if "MapGlobalSearchEndpoints()" not in program:
    issues.append("program global search map")

for marker in [
    "GlobalSearchResult",
    "GlobalSearchResponse",
]:
    if marker not in types:
        issues.append("types " + marker)

for marker in [
    "getGlobalSearch",
    "'/search?'",
]:
    if marker not in client:
        issues.append("client " + marker)

for marker in [
    "SearchPage",
    "platform.search.use",
    'path="search"',
]:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    "platform.search.use",
    "canUseSearch",
    "navigate('/search?q='",
    'placeholder="Search devices, assets and tickets…"',
    'aria-label="Search INNO.One resources"',
]:
    if marker not in shell:
        issues.append("shell " + marker)

if "searchTargets" in shell:
    issues.append("legacy shell page search targets remain")

for marker in [
    'title="Search"',
    "Search authorized resources across enabled INNO.One modules.",
    "Search across your workspace",
    "No results",
    "Authorization stays authoritative",
    "getGlobalSearch",
    "global-search-results",
]:
    if marker not in page and marker not in styles:
        issues.append("page " + marker)

for forbidden in [
    "Search apps, devices, tickets and actions",
    "action result",
    "fake result",
]:
    if forbidden.lower() in page.lower():
        issues.append("unsupported global search result " + forbidden)

for marker in [
    ".global-search-results",
    ".global-search-result",
    ".global-search-summary",
]:
    if marker not in styles:
        issues.append("styles " + marker)

if 'DesignSystem = "V1.26"' not in versions:
    issues.append("design system version")
if 'UiContract = "1.20.0"' not in versions:
    issues.append("ui contract version")
version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 28, 0):
    issues.append("implementation contract")

print("step38_scope=global-search,module-provider-orchestration,authorization-filtering")
print("step38_providers=devices,assets,helpdesk")
print("step38_permission=platform.search.use")
print("step38_implementation_contract=0.28.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
