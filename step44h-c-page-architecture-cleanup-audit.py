from pathlib import Path
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
WEB = ROOT / "production/apps/web-portal/src"
PAGES = WEB / "pages"

def read(path):
    return path.read_text(encoding="utf-8")

APP = read(WEB / "app/AppRoot.tsx")
MATRIX = json.loads(read(ROOT / "inno-step44a-screen-interaction-matrix.json"))
BASELINES = read(PAGES / "SoftwareBaselinesPage.tsx")
BASELINE_DETAIL = read(PAGES / "SoftwareBaselineDetailPage.tsx")
BASELINE_EDITOR = read(PAGES / "SoftwareBaselineEditorPage.tsx")
GROUPS = read(PAGES / "DeviceGroupsPage.tsx")
GROUP_DETAIL = read(PAGES / "DeviceGroupDetailPage.tsx")
ASSET_DETAIL = read(PAGES / "AssetDetailPage.tsx")
ASSET_EDIT = read(PAGES / "AssetEditPage.tsx")
TICKET = read(PAGES / "TicketDetailPage.tsx")
APPS = read(PAGES / "AdminAppsPage.tsx")
SLA = read(PAGES / "HelpdeskSlaPage.tsx")
SHELL = read(WEB / "shell.css")
CLIENT = read(WEB / "api/client.ts")

checks = 0
failures = []
def check(name, condition, detail=""):
    global checks
    checks += 1
    print(("PASS " if condition else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not condition:
        failures.append((name, detail))

routes = {item["route"]: item for item in MATRIX["routes"]}

# Software Baselines: list/detail/editor ownership.
check("baseline list is collection-only", "selectedId" not in BASELINES and "Evaluation results" not in BASELINES and "Save Baseline" not in BASELINES)
check("baseline list New navigates to create route", 'to="/assets/software-baselines/new"' in BASELINES)
check("baseline list row opens resource detail", "RouterRowAction" in BASELINES and "'/assets/software-baselines/' + item.id" in BASELINES)
check("baseline detail loads one baseline", "getSoftwareBaseline" in BASELINE_DETAIL and "useParams" in BASELINE_DETAIL)
check("baseline detail owns evaluation results", 'title="Evaluation results"' in BASELINE_DETAIL and "getSoftwareBaselineResults" in BASELINE_DETAIL)
check("baseline detail edit navigates away", "'/assets/software-baselines/' + item.id + '/edit'" in BASELINE_DETAIL)
check("baseline detail has no definition editor", "updateSoftwareBaseline" not in BASELINE_DETAIL and "<form" not in BASELINE_DETAIL)
check("baseline editor owns create update", "createSoftwareBaseline" in BASELINE_EDITOR and "updateSoftwareBaseline" in BASELINE_EDITOR)
check("baseline editor has canonical footer", "INNOEditorFooter" in BASELINE_EDITOR and "Save Baseline" in BASELINE_EDITOR and "Create Baseline" in BASELINE_EDITOR)
check("baseline editor excludes evaluation result surface", 'title="Evaluation results"' not in BASELINE_EDITOR and "getSoftwareBaselineResults" not in BASELINE_EDITOR)
check("baseline client has singular GET", "export async function getSoftwareBaseline(" in CLIENT)
check("baseline create route registered", 'path="assets/software-baselines/new"' in APP)
check("baseline detail route registered", 'path="assets/software-baselines/:baselineId"' in APP)
check("baseline edit route registered", 'path="assets/software-baselines/:baselineId/edit"' in APP)

# Device Groups: compact create/edit forms are dialogs.
check("device groups create uses dialog", "INNODialog" in GROUPS and 'title="New Device Group"' in GROUPS)
check("device groups no embedded create panel", "create-panel" not in GROUPS and "INNOEditorFooter" not in GROUPS)
check("device groups collection remains primary", "<INNOCollection>" in GROUPS and "<INNOTableWrap" in GROUPS)
check("device group detail edit uses dialog", "INNODialog" in GROUP_DETAIL and 'title="Edit Device Group"' in GROUP_DETAIL)
check("device group detail no inline editor branch", "{editing ? (" not in GROUP_DETAIL and "INNOEditorFooter" not in GROUP_DETAIL)
check("device group tabs stay unconditional", "<INNOSurfaceTabs" in GROUP_DETAIL and "!editing ?" not in GROUP_DETAIL)

# Asset Detail: read-only detail + P04 editor + owner dialog.
check("asset detail no generic editing state", "setEditing" not in ASSET_DETAIL and "updateAsset" not in ASSET_DETAIL)
check("asset detail edit navigates to P04", "'/assets/' + asset.id + '/edit'" in ASSET_DETAIL)
check("asset detail change owner uses dialog", "INNODialog" in ASSET_DETAIL and 'title="Change Asset Owner"' in ASSET_DETAIL)
check("asset detail keeps ownership mutation separate", "changeAssetOwnership" in ASSET_DETAIL and "updateAsset" not in ASSET_DETAIL)
check("asset edit route registered", 'path="assets/:assetId/edit"' in APP)
check("asset edit owns updateAsset", "updateAsset" in ASSET_EDIT and "getAsset" in ASSET_EDIT)
check("asset edit is multi-section", ASSET_EDIT.count('className="editor-section"') >= 2)
check("asset edit has canonical footer", "INNOEditorFooter" in ASSET_EDIT and ">Save Asset</INNOButton>" in ASSET_EDIT)
check("asset edit excludes ownership mutation", "changeAssetOwnership" not in ASSET_EDIT and "getAssetOwners" not in ASSET_EDIT)
check("asset editor section spacing is shared", ".editor-section {" in SHELL and ".editor-section + .editor-section" in SHELL)

# Ticket Reassign.
check("ticket reassign uses dialog", "INNODialog" in TICKET and 'title="Reassign Ticket"' in TICKET)
check("ticket reassign inline panel removed", "ticket-assign-panel" not in TICKET)
check("ticket reassign form footer removed", "INNOEditorFooter" not in TICKET)
check("ticket reassign mutation retained", "reassignTicket" in TICKET and "assignMutation.mutate()" in TICKET)

# Admin Apps inspect.
check("admin apps inspect uses drawer", "INNODrawer" in APPS and "setSelected(app)" in APPS)
check("admin apps native details removed", "<details" not in APPS and "<summary" not in APPS)
check("admin apps drawer owns technical manifest", "Entry permission" in APPS and "Dependencies" in APPS and "Capabilities" in APPS and "Events" in APPS)

# SLA deliberate keep.
check("sla remains settings primary job", "Save Policy" in SLA and "Live SLA monitor" in SLA)
check("sla matrix records deliberate P05 keep", routes["helpdesk/sla"]["pattern"] == "P05" and "reviewed in Step 44H-C" in routes["helpdesk/sla"]["remediation"])

# Matrix current decisions.
expected = {
    "admin/apps": ("P02", "registry-list+inspect-drawer"),
    "devices/groups": ("P02", "list+create-dialog"),
    "devices/groups/:groupId": ("P03", "detail-route+edit-dialog"),
    "assets/software-baselines": ("P02", "list"),
    "assets/software-baselines/new": ("P04", "create-route"),
    "assets/software-baselines/:baselineId/edit": ("P04", "edit-route"),
    "assets/software-baselines/:baselineId": ("P03", "detail-route"),
    "assets/:assetId/edit": ("P04", "edit-route"),
    "assets/:assetId": ("P03", "detail-route+owner-dialog"),
    "helpdesk/tickets/:ticketId": ("P03", "detail-route+reassign-dialog"),
}
for route, (pattern, surface) in expected.items():
    check(route + " matrix decision", routes[route]["pattern"] == pattern and routes[route]["surface"] == surface, routes[route])

check("no P09 routes remain after cleanup", all(item["pattern"] != "P09" for item in MATRIX["routes"]))
check("matrix route count is 61", len(MATRIX["routes"]) == 61, len(MATRIX["routes"]))

print(f"step44h_c_checks={checks}")
print(f"step44h_c_failures={len(failures)}")
for item in failures:
    print("FAILED", item)
sys.exit(1 if failures else 0)
