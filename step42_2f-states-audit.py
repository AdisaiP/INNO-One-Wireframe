from pathlib import Path

ROOT = Path(__file__).resolve().parent
UI = ROOT / "production/packages/ui/src/index.tsx"
UI_CSS = ROOT / "production/packages/ui/src/styles.css"
WEB = ROOT / "production/apps/web-portal/src"
issues = []

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def require(text: str, marker: str, label: str):
    if marker not in text:
        issues.append(f"{label}: missing {marker}")

def forbid(text: str, marker: str, label: str):
    if marker in text:
        issues.append(f"{label}: forbidden {marker}")

ui = read(UI)
ui_css = read(UI_CSS)
feedback = read(WEB / "components/Feedback.tsx")
deferred = read(WEB / "pages/DeferredPage.tsx")
shell = read(WEB / "shell.css")
device = read(WEB / "pages/DeviceDetailPage.tsx")
workspace = read(WEB / "pages/WorkspacePages.tsx")
design = read(WEB / "pages/InternalDesignSystemPage.tsx")

for marker in [
    "export function INNOCollectionState(",
    "role={role}",
    "aria-live={kind === 'loading' ? 'polite' : undefined}",
    "aria-label={kind === 'loading' ? 'Loading content' : undefined}",
    "aria-busy={kind === 'loading' || undefined}",
    '<span className="inno-sr-only">Loading content</span>',
    "<span>0 matching results</span>",
    "totalItems === 0 ? '0 matching results'",
    "{totalItems > 0 ? (",
]:
    require(ui, marker, "shared state runtime")

for marker in [
    ".inno-state.banner",
    ".inno-collection-state",
    ".inno-pagination--state",
    "@keyframes inno-state-spin",
]:
    require(ui_css, marker, "shared state styles")

for marker in [
    'title="You do not have access"',
    'title="Module is not available"',
    "export function CollectionLoadingState(",
    "export function CollectionErrorState(",
]:
    require(feedback, marker, "production state feedback")

for marker in [
    "Back to Workspace",
    "Open Apps",
    "<PermissionState",
    "<ModuleDisabledState",
]:
    require(deferred, marker, "permission/disabled route state")

require(device, 'kind="offline"', "device offline context")
require(device, "banner", "device offline context")
require(device, "Showing the latest cached inventory", "device offline context")
forbid(shell, ".offline-banner", "obsolete page-local offline CSS")

require(workspace, 'kind="partial"', "workspace partial failure")
require(workspace, "banner", "workspace partial failure")
require(workspace, "Available workspace data is preserved", "workspace partial failure")

for kind in ["empty", "no-results", "loading", "error", "permission", "disabled", "offline", "partial"]:
    require(design, f'kind="{kind}"', "design-system canonical state preview")
for marker in ["Retry failed", "Retry completed", "8 succeeded, 2 failed"]:
    require(design, marker, "partial failure retry reference")

collection_pages = [
    "DevicesPage.tsx",
    "DeviceGroupsPage.tsx",
    "AssetInventoryPage.tsx",
    "AssetOwnersPage.tsx",
    "AdminUsersPage.tsx",
    "TicketsPage.tsx",
    "AutomationRulesPage.tsx",
    "AdminAuditPage.tsx",
    "AdminAccessScopesPage.tsx",
    "AdminHierarchyPage.tsx",
    "AdminPositionsPage.tsx",
    "AdminRolesPage.tsx",
    "DiscoveryPage.tsx",
    "SoftwareBaselinesPage.tsx",
    "DeviceDetailPage.tsx",
    "DeviceGroupDetailPage.tsx",
    "AppsPage.tsx",
]
for name in collection_pages:
    source = read(WEB / "pages" / name)
    require(source, "INNOCollectionState", name)

for name in [
    "DevicesPage.tsx",
    "DeviceGroupsPage.tsx",
    "AssetInventoryPage.tsx",
    "AssetOwnersPage.tsx",
    "AdminUsersPage.tsx",
    "TicketsPage.tsx",
    "AutomationRulesPage.tsx",
]:
    source = read(WEB / "pages" / name)
    require(source, "CollectionLoadingState", name)
    require(source, "CollectionErrorState", name)

print("step42_2f_states=normalized")
print("canonical_state_kinds=8")
print("normalized_collection_pages=" + str(len(collection_pages)))
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE:", issue)

raise SystemExit(1 if issues else 0)
