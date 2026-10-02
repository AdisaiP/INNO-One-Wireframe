from pathlib import Path
import json, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
WEB=ROOT/"production/apps/web-portal/src"
UI=ROOT/"production/packages/ui/src"
checks=0
failures=[]

def read(path):
    return path.read_text(encoding="utf-8")

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

hierarchy=read(WEB/"pages/AdminHierarchyPage.tsx")
audit=read(WEB/"pages/AdminAuditPage.tsx")
roles=read(WEB/"pages/AdminRolesPage.tsx")
access=read(WEB/"pages/AdminAccessScopesPage.tsx")
inventory=read(WEB/"pages/InventoryQueryPage.tsx")
inventory_css=read(WEB/"pages/InventoryQueryPage.css")
licenses=read(WEB/"pages/SoftwareLicensesPage.tsx")
asset_detail=read(WEB/"pages/AssetDetailPage.tsx")
qr=read(WEB/"pages/AssetQrLabelsPage.tsx")
ownership=read(WEB/"pages/AssetOwnershipPage.tsx")
shell=read(WEB/"shell.css")
ui_index=read(UI/"index.tsx")
ui_css=read(UI/"styles.css")
matrix=json.loads(read(ROOT/"inno-step44a-screen-interaction-matrix.json"))
by_route={item["route"]:item for item in matrix["routes"]}

check("organization and locations use focused drawer", "INNODrawer" in hierarchy)
check("organization hierarchy no permanent master-detail grid", "admin-master-detail" not in hierarchy)
check("organization hierarchy no permanent editor panel", "admin-editor-panel" not in hierarchy)
check("hierarchy selection opens drawer", "open={createMode || Boolean(selected)}" in hierarchy)
check("hierarchy create remains page-header action", "New {isOrganization ? 'Unit' : 'Location'}" in hierarchy)
check("shared tree exposes hierarchy depth", "data-level={row.level}" in ui_index)
check("shared tree renders connector lines", ".inno-tree-row:not([data-level=\"1\"])::before" in ui_css and "border-left: 1px solid" in ui_css)

check("audit detail uses drawer", "INNODrawer" in audit)
check("audit no permanent side layout", "admin-audit-layout" not in audit and 'className="prod-panel admin-audit-detail"' not in audit)
check("audit row Open drives selection", "label: 'Open'" in audit)
check("audit remains read only", "Audit records are read-only" in audit)

check("roles explain read-only system role contract", "System roles are read-only" in roles and "Custom role creation" in roles)
check("roles catalog and matrix have separate spacing ownership", "admin-role-catalog" in roles and "admin-permission-collection" in roles)
check("role spacing is explicit", ".admin-role-catalog" in shell and ".admin-permission-collection" in shell)

check("access evaluate is utility dialog", "INNODialog" in access and 'title="Evaluate Access"' in access)
check("access page header exposes evaluate utility", "setEvaluateOpen(true)" in access)
check("access no second evaluate collection", '<INNOCollectionHeader title="Evaluate Access"' not in access)
check("access assignment edit stays route-owned", "/admin/access-scopes/" in access and "/edit" in access)

check("inventory removes standalone fact coverage card", "inventory-fact-coverage" not in inventory)
check("inventory fact coverage is lightweight note", "Available fact source" in inventory and "INNOPurposeNote" in inventory)
check("inventory New Query belongs to builder header", "inventory-builder-head-actions" in inventory and ">New Query</INNOButton>" in inventory)
check("inventory save semantics match POST-only API", "Save as New" in inventory and "Saving creates a new record" in inventory)
check("inventory footer keeps Run as primary command", "Run Query" in inventory and "INNOEditorFooterEnd" in inventory)
check("inventory responsive header action exists", ".inventory-builder-head-actions" in inventory_css)

check("software licenses use focused drawer", "INNODrawer" in licenses and "license-drawer-content" in licenses)
check("software licenses no permanent detail grid", "license-detail-grid" not in licenses and ".license-detail-grid" not in shell)
check("software row action is Open", "id: 'open', label: 'Open'" in licenses)
check("software list does not auto-open first item", "query.data.items[0].id" not in licenses)

check("asset current owner uses panel body padding", 'settings-stack"><div className="settings-row"><div><b>{asset.owner?.name' in asset_detail)
check("linked endpoint row uses panel body padding", 'asset.linkedDevice ? <div className="settings-stack"><div className="settings-row">' in asset_detail)
check("QR label setup owns bottom padding", ".qr-setup-section .editor-form" in shell and "padding-bottom: var(--ds-space-4)" in shell)
check("asset ownership uses domain-specific overview grid", "asset-ownership-overview-grid" in ownership and "helpdesk-overview-grid" not in ownership)
check("asset ownership overview separates recent history", ".asset-ownership-overview-grid" in shell and "margin-bottom: 16px" in shell)
check("asset ownership grid stacks responsively", ".asset-ownership-overview-grid," in shell and "@media (max-width: 1100px)" in shell)

check("matrix organization revised to list drawer", by_route["admin/organization"]["pattern"]=="P02" and by_route["admin/organization"]["surface"]=="hierarchy-list+drawer")
check("matrix locations revised to list drawer", by_route["admin/locations"]["pattern"]=="P02" and by_route["admin/locations"]["surface"]=="hierarchy-list+drawer")
check("matrix roles revised to reference matrix", by_route["admin/roles"]["pattern"]=="P02" and by_route["admin/roles"]["surface"]=="reference+permission-matrix")
check("matrix access scopes revised to utility dialog", by_route["admin/access-scopes"]["surface"]=="list+utility-dialog")
check("matrix software licenses revised to list drawer", by_route["assets/software-licenses"]["pattern"]=="P02" and by_route["assets/software-licenses"]["surface"]=="list+drawer")
check("audit matrix remains history table drawer", by_route["admin/audit"]["pattern"]=="P10" and by_route["admin/audit"]["surface"]=="history-table+drawer")

print("step44h_a_checks="+str(checks))
print("step44h_a_failures="+str(len(failures)))
for name,detail in failures:
    print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
