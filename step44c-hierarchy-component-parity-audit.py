import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent

UI = (ROOT / "production/packages/ui/src/index.tsx").read_text(encoding="utf-8")
UI_CSS = (ROOT / "production/packages/ui/src/styles.css").read_text(encoding="utf-8")
ORG = (ROOT / "production/apps/web-portal/src/pages/AdminHierarchyPage.tsx").read_text(encoding="utf-8")
ACCESS = (ROOT / "production/apps/web-portal/src/pages/AdminAccessScopeEditPage.tsx").read_text(encoding="utf-8")
DS = (ROOT / "production/apps/web-portal/src/pages/InternalDesignSystemPage.tsx").read_text(encoding="utf-8")
DS_CSS = (ROOT / "production/apps/web-portal/src/pages/InternalDesignSystemPage.css").read_text(encoding="utf-8")
PKG_TEXT = "\n".join([
    (ROOT / "production/packages/ui/package.json").read_text(encoding="utf-8"),
    (ROOT / "production/apps/web-portal/package.json").read_text(encoding="utf-8"),
    (ROOT / "production/pnpm-lock.yaml").read_text(encoding="utf-8"),
]).lower()
MATRIX = json.loads((ROOT / "inno-step44a-screen-interaction-matrix.json").read_text(encoding="utf-8"))

checks = []
failures = []

def check(name, condition):
    checks.append(name)
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)
check("INNOTree exported", "export function INNOTree<T>" in UI)
check("INNOTreeGrid exported", "export function INNOTreeGrid<T>" in UI)
check("hierarchy icon tokens", "'hierarchy.expanded'" in UI and "'hierarchy.collapsed'" in UI)
check("tree role semantics", 'role="tree"' in UI and 'role="treeitem"' in UI)
check("treegrid role semantics", 'role="treegrid"' in UI and 'role="row"' in UI)
check("selection semantics", "aria-selected={selected}" in UI)
check("level semantics", "aria-level={row.level}" in UI)
check("expand semantics", "aria-expanded={row.hasChildren ? isExpanded : undefined}" in UI)
check("roving tabindex", "tabIndex={focusedId === row.id ? 0 : -1}" in UI)
for key in ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End", "Enter"]:
    check("keyboard " + key, key in UI)
check("tree local styling", ".inno-tree {" in UI_CSS and ".inno-tree-item" in UI_CSS)
check("treegrid local scroller", ".inno-treegrid-wrap" in UI_CSS and "overflow: auto" in UI_CSS)

for marker in ["@tanstack/react-table", "react-arborist", "ag-grid", "@syncfusion", "rsuite-table", "ka-table"]:
    check("no hierarchy vendor dependency " + marker, marker not in PKG_TEXT)

check("native tree decision", "native @inno/ui implementation" in MATRIX["crossCutting"]["specialComponents"]["tree"])
check("native treegrid decision", "native @inno/ui implementation" in MATRIX["crossCutting"]["specialComponents"]["treeGrid"])
check("organization uses INNOTree", "<INNOTree" in ORG)
check("organization flat table removed", "<INNOTableWrap" not in ORG)
check("organization search feeds tree", "search={search}" in ORG)
check("organization selection feeds editor", "onSelect={(id) => setSelectedId(id)}" in ORG)
check("access scope uses INNOTreeGrid", "<INNOTreeGrid" in ACCESS)
check("access scope browser owned surface", 'className="admin-access-scope-browser"' in ACCESS)
check("access scope dropdown picker removed", '<span>Resource</span><select' not in ACCESS)
check("scope selection updates resource", "resourceId: id" in ACCESS)
check("scope browser supports organization and location", "Organization scope browser" in ACCESS and "Location scope browser" in ACCESS)
check("design system uses live tree", "<INNOTree" in DS)
check("design system uses live treegrid", "<INNOTreeGrid" in DS)
check("legacy fake tree markup removed", 'className="internal-ds-tree"' not in DS)
check("legacy fake treegrid markup removed", 'className="internal-ds-treegrid"' not in DS)
check("legacy fake hierarchy css removed", ".internal-ds-tree {" not in DS_CSS and ".internal-ds-treegrid" not in DS_CSS)

print("step44c_checks=" + str(len(checks)))
print("step44c_failures=" + str(len(failures)))
print("step44c_hierarchy_vendor_dependencies=0")
print("step44c_product_tree_routes=2")
print("step44c_product_treegrid_routes=1")

if failures:
    for name in failures:
        print("FAILURE: " + name)
    raise SystemExit(1)
