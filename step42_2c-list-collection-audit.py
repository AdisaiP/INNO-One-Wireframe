from pathlib import Path

ROOT = Path(__file__).resolve().parent
issues = []

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def require(text: str, marker: str, label: str):
    if marker not in text:
        issues.append(f"{label}: missing {marker}")

def forbid(text: str, marker: str, label: str):
    if marker in text:
        issues.append(f"{label}: forbidden {marker}")

ui = read("production/packages/ui/src/index.tsx")
ui_css = read("production/packages/ui/src/styles.css")

for marker in [
    "export function INNOCollection(",
    "export function INNOCollectionHeader(",
    "export function INNOCollectionToolbar(",
    "export function INNOToolbarMeta(",
    "export function INNOTableWrap(",
    "stickyAction = false",
    "export function INNOPagination(",
]:
    require(ui, marker, "shared collection primitive")

for marker in [
    ".inno-toolbar-meta {",
    ".inno-row-action {",
    ".inno-table-wrap .num {",
    ".inno-table-wrap--sticky-action th.action-column",
    ".inno-table-wrap--sticky-action td.action-column",
    ".inno-table-wrap th.action-column",
]:
    require(ui_css, marker, "shared collection styles")

primary = {
    "DevicesPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "inno-row-action", ">Action<"],
    "DeviceGroupsPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "INNOToolbarMeta", "inno-row-action", ">Action<"],
    "AssetInventoryPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "INNOToolbarMeta", "inno-row-action", ">Action<"],
    "TicketsPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "INNOToolbarMeta", "inno-row-action", "helpdesk-operational-queue", ">Action<"],
    "AdminUsersPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "inno-row-action", ">Action<"],
    "AutomationRulesPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "inno-row-action", ">Action<"],
    "SoftwareLicensesPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "INNOToolbarMeta", "inno-row-action", ">Action<"],
    "ContractsWarrantyPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "INNOTableWrap", "INNOPagination", "inno-row-action", ">Action<"],
}

for name, markers in primary.items():
    source = read("production/apps/web-portal/src/pages/" + name)
    for marker in markers:
        require(source, marker, name)
    forbid(source, 'className="collection-scope"', name + " toolbar meta")

# Step 44D removes invalid permanent side editors from Positions and Access Scopes.
# They remain collection-owned lists, but row actions now open a dialog or dedicated edit route.
remediated_lists = {
    "AdminAccessScopesPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOSelectField", "stickyAction", "inno-row-action", ">Edit<", ">Action<"],
    "AdminPositionsPage.tsx": ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "stickyAction", "inno-row-action", ">Edit<", ">Action<", "INNODialog"],
}

for name, markers in remediated_lists.items():
    source = read("production/apps/web-portal/src/pages/" + name)
    for marker in markers:
        require(source, marker, name)
    forbid(source, 'className="admin-master-detail"', name + " Step44D route architecture")
    forbid(source, 'className="admin-editor-panel"', name + " Step44D route architecture")

# Step 44C supersedes the old flat collection contract for Organization / Locations.
# The hierarchy master-detail surface keeps the shared collection header/toolbar/search
# but selection is owned by INNOTree rather than a sticky table Action column.
hierarchy = read("production/apps/web-portal/src/pages/AdminHierarchyPage.tsx")
for marker in ["INNOCollectionHeader", "INNOCollectionToolbar", "INNOSearchField", "INNOTree", "selectedId={selectedId}", "onSelect={(id) => setSelectedId(id)}"]:
    require(hierarchy, marker, "AdminHierarchyPage.tsx hierarchy contract")
forbid(hierarchy, 'className="inno-row-action"', "AdminHierarchyPage.tsx hierarchy contract")

for name in ["DevicesPage.tsx", "DeviceGroupsPage.tsx", "AssetInventoryPage.tsx", "AdminUsersPage.tsx"]:
    source = read("production/apps/web-portal/src/pages/" + name)
    if 'className="action-column"' in source:
        forbid(source, 'className="device-row-action"', name + " primary row action")

for name in ["AssetOwnersPage.tsx", "AssetOwnershipSubmissionsPage.tsx"]:
    source = read("production/apps/web-portal/src/pages/" + name)
    require(source, "INNOToolbarMeta", name)
    forbid(source, 'className="collection-scope"', name + " toolbar meta")

audit = read("production/apps/web-portal/src/pages/AdminAuditPage.tsx")
require(audit, 'className="inno-row-action"', "AdminAuditPage row action")
require(audit, ">Action<", "AdminAuditPage action header")

print("step42_2c_collection_anatomy=shared")
print("row_actions=named")
print("master_detail_action_ownership=sticky")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE:", issue)

raise SystemExit(1 if issues else 0)
