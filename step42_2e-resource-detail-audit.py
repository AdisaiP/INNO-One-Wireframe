from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "production/apps/web-portal/src/pages"
UI = ROOT / "production/packages/ui/src"
issues = []

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def require(text: str, marker: str, label: str):
    if marker not in text:
        issues.append(f"{label}: missing {marker}")

def forbid(text: str, marker: str, label: str):
    if marker in text:
        issues.append(f"{label}: forbidden {marker}")

ui = read(UI / "index.tsx")
ui_css = read(UI / "styles.css")
shell_css = read(ROOT / "production/apps/web-portal/src/shell.css")

for marker in [
    "export function INNOResourceHeader(",
    "export function INNOResourceSummary(",
    "export function INNOResourceSummaryItem(",
]:
    require(ui, marker, "shared P03 primitives")

for marker in [
    ".inno-resource-head",
    ".inno-resource-summary",
    ".inno-resource-summary-item",
    ".inno-surface-tabs",
]:
    require(ui_css, marker, "shared P03 styles")

require(shell_css, ".ticket-detail-tabs [hidden]", "Ticket inactive tab visibility")
require(shell_css, "display: none !important;", "Ticket inactive tab visibility")

for marker in [
    ".admin-user-layout",
    ".ticket-detail-grid",
    ".helpdesk-detail-stats",
    ".ticket-resource-actions",
    ".helpdesk-resource-head",
]:
    forbid(shell_css, marker, "obsolete detail-specific CSS")

pages = {
    "AdminUserDetailPage.tsx": ["Edit Profile", "Overview", "Access"],
    "DeviceDetailPage.tsx": ["Overview", "Software", "Resource offline"],
    "DeviceGroupDetailPage.tsx": ["Edit Group", "Overview", "Members"],
    "AssetDetailPage.tsx": ["Edit Asset", "Overview", "Custom Fields", "Ownership"],
    "AssetOwnerDetailPage.tsx": ["Overview", "Assets"],
    "TicketDetailPage.tsx": ["Conversation", "Activity", "Details"],
}

for name, markers in pages.items():
    source = read(WEB / name)
    for marker in [
        "resource-breadcrumb",
        "<INNOResourceHeader",
        "<INNOResourceSummary>",
        "<INNOResourceSummaryItem",
        "<INNOSurfaceTabs",
    ]:
        require(source, marker, name)
    if source.count("<INNOResourceSummaryItem") != 4:
        issues.append(f"{name}: expected exactly four summary items")
    forbid(source, "production-stat-strip", name)
    for marker in markers:
        require(source, marker, name)

admin = read(WEB / "AdminUserDetailPage.tsx")
asset = read(WEB / "AssetDetailPage.tsx")
group = read(WEB / "DeviceGroupDetailPage.tsx")
ticket = read(WEB / "TicketDetailPage.tsx")

for name, source, action in [
    ("AdminUserDetailPage.tsx", admin, "Edit Profile"),
    ("AssetDetailPage.tsx", asset, "Edit Asset"),
    ("DeviceGroupDetailPage.tsx", group, "Edit Group"),
]:
    require(source, "const [editing, setEditing] = useState(false)", name)
    require(source, action, name)
    require(source, "<INNOEditorFooterStart>", name)
    require(source, "<INNOEditorFooterEnd>", name)
    require(source, ">Cancel</INNOButton>", name)

forbid(admin, "<INNOPage", "Admin user resource detail")
require(admin, "!editing ? (", "Admin user tabs while viewing")
require(group, "!editing ? (", "Device group tabs while viewing")
require(asset, "...(!editing ? [{ id: 'ownership', label: 'Ownership' }] : [])", "Asset edit-safe tabs")

for marker in [
    "hidden={activeTab !== 'conversation'}",
    "hidden={activeTab !== 'activity'}",
    "hidden={activeTab !== 'details'}",
    "ticket-detail-tabs",
]:
    require(ticket, marker, "Ticket detail tabs")
forbid(ticket, "ticket-detail-grid", "Ticket detail tabs")

print("step42_2e_resource_detail=p03-normalized")
print("resource_detail_pages=" + str(len(pages)))
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE:", issue)

raise SystemExit(1 if issues else 0)
