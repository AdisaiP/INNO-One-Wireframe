import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
MATRIX = json.loads((ROOT / "inno-step44a-screen-interaction-matrix.json").read_text(encoding="utf-8"))
APP_ROOT = (ROOT / "production/apps/web-portal/src/app/AppRoot.tsx").read_text(encoding="utf-8")
UI_INDEX = (ROOT / "production/packages/ui/src/index.tsx").read_text(encoding="utf-8")
WORKFLOW_UI = (ROOT / "production/packages/ui/src/workflow.tsx").read_text(encoding="utf-8") if (ROOT / "production/packages/ui/src/workflow.tsx").exists() else ""
UI_PACKAGE = json.loads((ROOT / "production/packages/ui/package.json").read_text(encoding="utf-8"))
WEB_PACKAGE = json.loads((ROOT / "production/apps/web-portal/package.json").read_text(encoding="utf-8"))
SHELL_CSS = (ROOT / "production/apps/web-portal/src/shell.css").read_text(encoding="utf-8")
UI_CSS = (ROOT / "production/packages/ui/src/styles.css").read_text(encoding="utf-8")
HIERARCHY = (ROOT / "production/apps/web-portal/src/pages/AdminHierarchyPage.tsx").read_text(encoding="utf-8")
POSITIONS = (ROOT / "production/apps/web-portal/src/pages/AdminPositionsPage.tsx").read_text(encoding="utf-8")
USERS = (ROOT / "production/apps/web-portal/src/pages/AdminUsersPage.tsx").read_text(encoding="utf-8")
CUSTOM_FIELDS = (ROOT / "production/apps/web-portal/src/pages/AssetCustomFieldsPage.tsx").read_text(encoding="utf-8")
ACCESS = (ROOT / "production/apps/web-portal/src/pages/AdminAccessScopesPage.tsx").read_text(encoding="utf-8")
INTEGRATIONS = (ROOT / "production/apps/web-portal/src/pages/AdminIntegrationsPage.tsx").read_text(encoding="utf-8")
CONTRACTS = (ROOT / "production/apps/web-portal/src/pages/ContractsWarrantyPage.tsx").read_text(encoding="utf-8")
APP_SHELL = (ROOT / "production/apps/web-portal/src/app/AppShell.tsx").read_text(encoding="utf-8")
SPECIAL = (ROOT / "production/design-system/frozen/v1.26/INNO-One-Special-UI-Components.md").read_text(encoding="utf-8")

checks = []
failures = []

def check(name, condition, detail=""):
    checks.append(name)
    if condition:
        print("PASS " + name + ((" :: " + str(detail)) if detail else ""))
    else:
        failures.append((name, detail))
        print("FAIL " + name + ((" :: " + str(detail)) if detail else ""))

routes = [
    route for route in re.findall(r'<Route path="([^"]+)"', APP_ROOT)
    if "*" not in route
]
matrix_routes = [item["route"] for item in MATRIX["routes"]]
by_route = {item["route"]: item for item in MATRIX["routes"]}

check("route count is 61", len(routes) == 61, len(routes))
check("matrix count is 61", len(matrix_routes) == 61, len(matrix_routes))
check("matrix routes are unique", len(set(matrix_routes)) == len(matrix_routes))
check("production routes are unique", len(set(routes)) == len(routes))
check("matrix covers exact production routes", set(matrix_routes) == set(routes),
      sorted(set(routes) ^ set(matrix_routes)))

valid_patterns = {f"P{i:02d}" for i in range(1, 11)}
check("all patterns are canonical P01-P10",
      all(item["pattern"] in valid_patterns for item in MATRIX["routes"]))
check("all routes have interaction surface",
      all(bool(item.get("surface")) for item in MATRIX["routes"]))
check("all routes have remediation decision",
      all(bool(item.get("remediation")) for item in MATRIX["routes"]))
check("all routes have priority",
      all(item.get("priority") in {"low", "medium", "high", "critical"} for item in MATRIX["routes"]))
check("all route decisions have wireframe reference marker",
      all("wireframe" in item for item in MATRIX["routes"]))

expected = {
    "admin/organization": ("P02", "hierarchy-list+drawer", "INNOTree", "critical"),
    "admin/locations": ("P02", "hierarchy-list+drawer", "INNOTree", "critical"),
    "admin/positions": ("P02", "list+modal", None, "high"),
    "admin/roles": ("P02", "role-list+drawer+permission-matrix", "INNODrawer", "high"),
    "admin/apps": ("P02", "registry-list+inspect-drawer", "INNODrawer", "medium"),
    "admin/access-scopes": ("P02", "list+utility-dialog", None, "critical"),
    "admin/integrations": ("P07", "health-monitor", None, "high"),
    "assets/software-baselines": ("P02", "list", None, "high"),
    "assets/software-baselines/new": ("P04", "create-route", None, "high"),
    "assets/software-baselines/:baselineId/edit": ("P04", "edit-route", None, "high"),
    "assets/software-baselines/:baselineId": ("P03", "detail-route", None, "high"),
    "assets/software-licenses": ("P02", "list", None, "high"),
    "assets/software-licenses/:licenseId": ("P03", "detail-route+edit-dialog", "INNODialog", "high"),
    "assets/contracts": ("P02", "list", None, "critical"),
    "helpdesk/calendar": ("P05", "settings-page", None, "high"),
    "devices/query": ("P06", "builder+saved-query-drawer", "INNODrawer", "high"),
    "devices/groups": ("P02", "list+create-dialog", "INNODialog", "high"),
    "devices/groups/:groupId": ("P03", "detail-route+edit-dialog", "INNODialog", "high"),
    "assets/:assetId/edit": ("P04", "edit-route", None, "critical"),
    "assets/:assetId": ("P03", "detail-route+owner-dialog", "INNODialog", "critical"),
    "helpdesk/tickets/:ticketId": ("P03", "detail-route+reassign-dialog", "INNODialog", "high"),
    "helpdesk/automation/new": ("P04", "edit-route", None, "medium"),
}
for route, (pattern, surface, special, priority) in expected.items():
    item = by_route[route]
    check(route + " pattern", item["pattern"] == pattern, item)
    check(route + " surface", item["surface"] == surface, item)
    check(route + " priority", item["priority"] == priority, item)
    if special:
        check(route + " special component", item.get("specialComponent") == special, item)

# Detect the nine user-reported classes of problems in the current Production source.
detected = {}

# 1: permanent side editor used where route/form classification needs review.
detected["form-detail-side-card"] = (
    "admin-master-detail" in POSITIONS
    or "admin-master-detail" in ACCESS
    or "contract-record-panel" in CONTRACTS
    or "selectedId" in CONTRACTS
    or "create-panel" in USERS
    or "custom-field-editor-row" in CUSTOM_FIELDS
)

# 2: editor footer exists as its own rounded bordered surface rather than an integrated action bar.
detected["editor-footer-floating-card"] = (
    ".inno-editor-footer" in UI_CSS
    and "border: 1px solid var(--ds-border)" in UI_CSS
    and "border-radius: 12px" in UI_CSS
)

# 3: passive explanatory copy incorrectly uses state component.
detected["state-used-for-explanation"] = (
    re.search(
        r'<INNOState[\s\S]{0,260}title="Configuration remains deployment-managed"',
        INTEGRATIONS,
    ) is not None
)

# 4: row actions have multiple verbs/semantics and no shared row-action component.
all_pages = "\n".join(
    path.read_text(encoding="utf-8")
    for path in (ROOT / "production/apps/web-portal/src/pages").glob("*.tsx")
)
detected["row-action-inconsistency"] = (
    'className="inno-row-action"' in all_pages
    and re.search(r">\s*Select\s*<", all_pages) is not None
    and re.search(r">\s*Open\s*<", all_pages) is not None
)

# 5: baseline spacing is still overridden page-locally in shell.css.
detected["spacing-drift"] = (
    ".deployment-card .inno-editor-footer" in SHELL_CSS
    and ".ticket-create-main > .inno-editor-footer" in SHELL_CSS
    and ".baseline-editor-footer" in SHELL_CSS
)

# 6: wireframe hero assets were not migrated to production.
illustration_dir = ROOT / "production/apps/web-portal/public/illustrations"
production_illustrations = {p.name for p in illustration_dir.glob("*") if p.is_file()}
detected["hero-illustration-parity-gap"] = (
    production_illustrations == {"device-setup.svg", "workspace-welcome.svg"}
)

# 7: workflow canvas is frozen in design contract but not implemented in @inno/ui/deps.
deps = {}
deps.update(UI_PACKAGE.get("dependencies", {}))
deps.update(WEB_PACKAGE.get("dependencies", {}))
workflow_exported = (
    "INNOWorkflowCanvas" in WORKFLOW_UI
    and "./workflow" in UI_PACKAGE.get("exports", {})
)
detected["workflow-canvas-missing"] = (
    "INNOWorkflowCanvas" in SPECIAL
    and not workflow_exported
    and "INNOWorkflowCanvas" not in UI_INDEX
    and "@xyflow/react" not in deps
    and "elkjs" not in deps
)

# 8: Tree/TreeGrid contract exists but production shared components are absent.
detected["tree-treegrid-missing"] = (
    "INNOTreeGrid" in SPECIAL
    and "INNOTree" not in UI_INDEX
    and "INNOTreeGrid" not in UI_INDEX
)

# 9: Assets navigation uses generic User Profiles wording that competes with Admin Users.
detected["assets-user-profiles-ia"] = (
    'token="section.userProfiles">User Profiles<' in APP_SHELL
    and 'to="/admin/users"' in APP_SHELL
)

for key, value in detected.items():
    print("INFO current gap " + key + "=" + ("PRESENT" if value else "REMEDIATED"))

check("all nine reported gap classes are modeled", len(detected) == 9)

cross = MATRIX["crossCutting"]
check("row action remediation is frozen", cross["rowActions"]["target"] == "INNORowActions")
check("editor footer remediation is frozen",
      "integrated editor action bar" in cross["editorFooter"]["target"])
check("state vs explanation rule is frozen",
      "INNOState is reserved for actual state" in cross["passiveExplanations"]["rule"])
check("spacing ownership rule is frozen",
      "shared tokens/components" in cross["spacing"]["rule"])
check("illustration restore candidates are frozen",
      set(cross["illustrations"]["restoreCandidates"]) == {"apps", "assets", "devices/add"})
check("workflow canvas boundary is frozen",
      "React Flow + ELK.js" in cross["specialComponents"]["workflowCanvas"])
check("treegrid production direction is native",
      "native @inno/ui implementation" in cross["specialComponents"]["treeGrid"]
      and "vendor dependency" in cross["specialComponents"]["treeGrid"])
check("assets identity ownership boundary is frozen",
      cross["assetInformationArchitecture"]["identityOwner"] == "Admin Center > Users")

priorities = {}
patterns = {}
for item in MATRIX["routes"]:
    priorities[item["priority"]] = priorities.get(item["priority"], 0) + 1
    patterns[item["pattern"]] = patterns.get(item["pattern"], 0) + 1

check("critical remediation count", priorities.get("critical") == 9, priorities)
check("high remediation count", priorities.get("high") == 24, priorities)

print("step44a_routes=" + str(len(matrix_routes)))
print("step44a_patterns=" + json.dumps(patterns, sort_keys=True))
print("step44a_priorities=" + json.dumps(priorities, sort_keys=True))
print("step44a_reported_gap_classes=9")
print("step44a_current_gap_classes=" + str(sum(1 for v in detected.values() if v)))
print("step44a_checks=" + str(len(checks)))
print("step44a_failures=" + str(len(failures)))

if failures:
    for name, detail in failures:
        print("FAILURE: " + name + " :: " + str(detail))
    raise SystemExit(1)
