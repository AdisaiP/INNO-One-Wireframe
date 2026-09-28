from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

contracts = read("production/services/platform-api/src/INNO.One.Contracts/Workspace/WorkspaceContracts.cs")
endpoint = read("production/services/platform-api/src/Modules/Platform/Api/WorkspaceEndpoints.cs")
devices = read("production/services/platform-api/src/Modules/Devices/Application/DevicesWorkspaceAttentionProvider.cs")
assets = read("production/services/platform-api/src/Modules/Assets/Application/AssetsWorkspaceAttentionProvider.cs")
helpdesk = read("production/services/platform-api/src/Modules/Helpdesk/Application/HelpdeskWorkspaceAttentionProvider.cs")
platform_entities = read("production/services/platform-api/src/Modules/Platform/Domain/PlatformEntities.cs")
platform_db = read("production/services/platform-api/src/Modules/Platform/Persistence/PlatformDbContext.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
page = read("production/apps/web-portal/src/pages/WorkspacePages.tsx")
styles = read("production/apps/web-portal/src/shell.css")
prototype = read("workspace-v2.html")
architecture = read("INNO-One-Workspace-Architecture-Plan.md")

for marker in [
    "public sealed record WorkspaceAttentionItem",
    "public interface IWorkspaceAttentionProvider",
    "ClaimsPrincipal principal",
    "string Severity",
    "string Route",
]:
    if marker not in contracts:
        issues.append("workspace contract " + marker)

for marker in [
    'api.MapGet("/platform/workspace"',
    'api.MapGet("/platform/workspace/continue"',
    'api.MapGet("/platform/workspace/attention"',
    'api.MapGet("/platform/activity"',
    '"platform.workspace.access"',
    "ModuleManifestCatalog catalog",
    "IEnumerable<IWorkspaceAttentionProvider> attentionProviders",
    "GetVisibleActivityAsync",
    "GetEffectiveAppsAsync",
]:
    if marker not in endpoint:
        issues.append("workspace endpoint " + marker)

for forbidden in [
    "DevicesDbContext",
    "AssetsDbContext",
    "HelpdeskDbContext",
    "Modules.Devices",
    "Modules.Assets",
    "Modules.Helpdesk",
]:
    if forbidden in endpoint:
        issues.append("platform cross-module shortcut " + forbidden)

provider_checks = [
    ("devices", devices, "devices.view", "ConnectivityState", "/devices"),
    ("assets", assets, "assets.view", "AssetContractLinks", "/assets/contracts"),
    ("helpdesk", helpdesk, "helpdesk.ticket.view", "TicketSla", "/helpdesk/assigned"),
]
for name, source, permission, scope_marker, route in provider_checks:
    for marker in [
        "IWorkspaceAttentionProvider",
        permission,
        scope_marker,
        route,
    ]:
        if marker not in source:
            issues.append(name + " attention provider " + marker)

for source, provider in [
    (read("production/services/platform-api/src/Modules/Devices/DevicesModule.cs"), "DevicesWorkspaceAttentionProvider"),
    (read("production/services/platform-api/src/Modules/Assets/AssetsModule.cs"), "AssetsWorkspaceAttentionProvider"),
    (read("production/services/platform-api/src/Modules/Helpdesk/HelpdeskModule.cs"), "HelpdeskWorkspaceAttentionProvider"),
]:
    if "AddScoped<IWorkspaceAttentionProvider, " + provider + ">" not in source:
        issues.append("provider registration " + provider)

for marker in [
    "public sealed class PlatformActivityItem",
    "SourceModule",
    "ResourceType",
    "ResourceId",
    "DestinationPath",
    "OccurredAt",
]:
    if marker not in platform_entities:
        issues.append("activity entity " + marker)

for marker in [
    'DbSet<PlatformActivityItem> ActivityItems',
    'entity.ToTable("activity_items")',
    "x.UserId, x.OccurredAt",
]:
    if marker not in platform_db:
        issues.append("activity persistence " + marker)

for marker in [
    "Step39ActivityItems",
    "EnsureStep39ActivityAsync",
    "NOTEBOOK-IT-003",
    "HD-2026-001050",
    "AST-NB-000003",
]:
    if marker not in seed:
        issues.append("seed " + marker)

if "MapWorkspaceEndpoints()" not in program:
    issues.append("program workspace map")

for marker in [
    "WorkspaceHomeResponse",
    "WorkspaceContinueResponse",
    "WorkspaceAttentionResponse",
    "WorkspaceActivityResponse",
]:
    if marker not in types:
        issues.append("web types " + marker)

for marker in [
    "getWorkspaceHome",
    "getWorkspaceContinue",
    "getWorkspaceAttention",
    "getWorkspaceActivity",
]:
    if marker not in client:
        issues.append("web client " + marker)

for marker in [
    "WorkspaceHomePage",
    'path="workspace/continue"',
    'path="workspace/attention"',
    'path="workspace/recent"',
    "platform.workspace.access",
]:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    "Workspace Home",
    'to="/"',
    "Continue Working",
    "Needs Attention",
    "Recent",
    "inWorkspace",
]:
    if marker not in shell:
        issues.append("shell " + marker)

for marker in [
    "Good ",
    "Your Apps",
    "Continue Working",
    "Needs Attention",
    "Recent Activity",
    "getWorkspaceHome",
    "workspace-home-columns",
    "workspace-app-grid",
]:
    if marker not in page and marker not in styles:
        issues.append("workspace page " + marker)

for forbidden in [
    "Device CPU chart",
    "Meeting analytics",
    "SLA dashboard",
    "Daily Product Sync",
]:
    if forbidden in page:
        issues.append("home operational/fake content " + forbidden)

for marker in [
    ".workspace-welcome",
    ".workspace-app-grid",
    ".workspace-home-columns",
    ".workspace-feed-item",
    ".workspace-attention-item",
]:
    if marker not in styles:
        issues.append("workspace styles " + marker)

if "Start Page" not in architecture:
    issues.append("architecture start-page contract")
if "Continue working" not in prototype:
    issues.append("prototype continue working")
if "Needs attention" not in prototype:
    issues.append("prototype needs attention")

if 'DesignSystem = "V1.26"' not in versions:
    issues.append("design system version")
if 'UiContract = "1.20.0"' not in versions:
    issues.append("ui contract version")
version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 29, 0):
    issues.append("implementation contract")

print("step39_scope=workspace-home,continue-working,attention,recent-activity")
print("step39_permission=platform.workspace.access")
print("step39_attention_providers=devices,assets,helpdesk")
print("step39_activity_read_model=platform.activity_items")
print("step39_implementation_contract=0.29.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
