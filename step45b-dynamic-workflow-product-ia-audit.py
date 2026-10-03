from pathlib import Path
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
WEB = PROD / "apps/web-portal/src"
UI = PROD / "packages/ui"

def read(path):
    return Path(path).read_text(encoding="utf-8")

APP = read(WEB / "app/AppRoot.tsx")
SHELL = read(WEB / "app/AppShell.tsx")
LIST = read(WEB / "pages/WorkflowListPage.tsx")
BUILDER = read(WEB / "pages/WorkflowBuilderPage.tsx")
DRAFTS = read(WEB / "app/WorkflowDraftContext.tsx")
CSS = read(WEB / "pages/WorkflowProductPages.css")
HELPDESK = read(WEB / "pages/AutomationRulePage.tsx")
MANIFEST = json.loads(read(PROD / "module-manifests.json"))
MATRIX = json.loads(read(ROOT / "inno-step44a-screen-interaction-matrix.json"))
UI_PACKAGE = json.loads(read(UI / "package.json"))
WORKFLOW_UI = read(UI / "src/workflow.tsx")
SEED = read(PROD / "services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")

checks = 0
failures = []
def check(name, condition, detail=""):
    global checks
    checks += 1
    ok = bool(condition)
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

routes = {item["route"]: item for item in MATRIX["routes"]}
modules = {item["id"]: item for item in MANIFEST["modules"]}
workflow_module = modules["workflows"]

check("current architecture matrix has 64 routes", len(MATRIX["routes"]) == 64, len(MATRIX["routes"]))
check("workflow list route is P02", routes["workflows"]["pattern"] == "P02" and routes["workflows"]["surface"] == "list+session-drafts")
check("workflow new route is P06", routes["workflows/new"]["pattern"] == "P06" and routes["workflows/new"]["specialComponent"] == "INNOWorkflowCanvas")
check("workflow edit route is P06", routes["workflows/:workflowId"]["pattern"] == "P06" and routes["workflows/:workflowId"]["specialComponent"] == "INNOWorkflowCanvas")

# Module / availability contract.
check("workflow manifest exists", "workflows" in modules)
check("workflow manifest is standalone web module", workflow_module["surface"] == "web" and workflow_module["route"] == "/workflows")
check("workflow launcher stays hidden", workflow_module["launcher"] is False)
check("workflow entry permission frozen", workflow_module["entryPermission"] == "workflows.view")
check("workflow permissions frozen", set(workflow_module["permissions"]) == {"workflows.view", "workflows.manage"})
check("workflow depends only on platform", set(workflow_module["dependencies"]) == {"platform"})
check("workflow manifest has definitions navigation", any(item["route"] == "/workflows" for item in workflow_module["navigation"]))
check("workflow manifest has new navigation", any(item["route"] == "/workflows/new" for item in workflow_module["navigation"]))
check("development seed does not install workflow", 'AppId = "workflows"' not in SEED)
rail = SHELL.split('<aside className="prod-rail"', 1)[1].split('</aside>', 1)[0]
check("workflow has no normal rail entry", 'to="/workflows"' not in rail)
check("workflow has contextual navigation after direct entry", 'inWorkflows && canPreviewWorkflows' in SHELL and '>All Workflows<' in SHELL and '>New Workflow<' in SHELL)
check("workflow contextual navigation declares preview boundary", "Session-only authoring preview" in SHELL)

# Route / preview permission ownership.
check("workflow list route exists", '<Route path="workflows"' in APP)
check("workflow new route exists", '<Route path="workflows/new"' in APP)
check("workflow dynamic route exists", '<Route path="workflows/:workflowId"' in APP)
check("workflow routes use explicit preview gate", "const canPreviewWorkflows = canAdminApps" in APP)
check("workflow builder is lazy loaded", "const WorkflowBuilderPage = lazy" in APP and "import('../pages/WorkflowBuilderPage')" in APP)
check("workflow draft provider wraps routes", "<WorkflowDraftProvider>" in APP and "</WorkflowDraftProvider>" in APP)

# Bundle isolation.
check("workflow package remains subpath export", "./workflow" in UI_PACKAGE["exports"])
check("workflow engine remains shared primitive", "INNOWorkflowCanvas" in WORKFLOW_UI and "@xyflow/react" in WORKFLOW_UI and "ELK" in WORKFLOW_UI)
check("workflow list does not import heavy workflow engine", "@inno/ui/workflow" not in LIST)
check("workflow builder imports workflow subpath", "from '@inno/ui/workflow'" in BUILDER and "import '@inno/ui/workflow.css'" in BUILDER)

# Honest frontend-only session model.
check("session draft context uses React state", "useState<SessionWorkflowDraft[]>" in DRAFTS)
check("session draft context has create update lookup", all(marker in DRAFTS for marker in ["createDraft:", "updateDraft:", "getDraft:"]))
check("session draft context does not use browser persistence", "localStorage" not in DRAFTS and "sessionStorage" not in DRAFTS and "indexedDB" not in DRAFTS)
check("workflow pages do not call API client", "../api/client" not in LIST and "../api/client" not in BUILDER and "../api/client" not in DRAFTS)
check("workflow pages do not use fetch", "fetch(" not in LIST and "fetch(" not in BUILDER and "fetch(" not in DRAFTS)
check("workflow boundary explains session-only behavior", "Step 45B keeps drafts in this browser session only" in LIST and "No server persistence or execution in Step 45B" in BUILDER)
check("builder does not expose fake Publish action", ">Publish<" not in BUILDER and "Publish Workflow" not in BUILDER)
check("builder does not expose fake Run action", ">Run<" not in BUILDER and "Run Workflow" not in BUILDER)
check("builder action is honest session action", "Keep in Session" in BUILDER and "Update Session Draft" in BUILDER)

# P02 list.
check("workflow list owns page header create action", 'to="/workflows/new">New Workflow' in LIST)
check("workflow list uses shared collection", "INNOCollection" in LIST and "INNOTableWrap" in LIST)
check("workflow list uses shared row action", "RouterRowAction" in LIST)
check("workflow list has real empty state", 'kind="empty"' in LIST and "No session workflow drafts" in LIST)
check("workflow list identifies session draft status", "Session draft" in LIST)

# P06 builder.
check("builder has node palette", 'aria-label="Workflow node palette"' in BUILDER and "palette.map" in BUILDER)
check("builder has shared workflow canvas", "<INNOWorkflowCanvas" in BUILDER)
check("builder has properties pane", 'aria-label="Workflow properties"' in BUILDER)
check("builder has workflow name field", ">Workflow name<" in BUILDER)
check("builder supports selected node label editing", "selectedNode.label" in BUILDER)
check("builder supports selected node description editing", "selectedNode.description" in BUILDER)
check("builder supports graph connect", "onConnect={(edge)" in BUILDER)
check("builder supports node delete", "onDeleteNodes={(ids)" in BUILDER)
check("builder supports edge delete", "onDeleteEdges={(ids)" in BUILDER)
check("builder preserves layout metadata", "onLayoutChange={(layout)" in BUILDER and "layout[node.id]" in BUILDER)
check("builder supports horizontal and vertical layout", "setOrientation('horizontal')" in BUILDER and "setOrientation('vertical')" in BUILDER)
check("builder uses canonical editor footer", "INNOEditorFooter" in BUILDER and "INNOEditorFooterEnd" in BUILDER)
check("builder validates exactly one trigger", "must contain exactly one trigger" in BUILDER)
check("builder validates end node", "Add at least one End node" in BUILDER)
check("builder validates disconnected nodes", "Connect an incoming path" in BUILDER and "Connect an outgoing path" in BUILDER)
check("builder starter definition is real graph", "edge_trigger_action" in BUILDER and "edge_action_end" in BUILDER)
check("builder session edit route handles missing draft", "Session draft not found" in BUILDER)

# Responsive P06 layout.
check("workflow product layout has desktop three columns", "grid-template-columns: 176px minmax(0, 1fr) 264px" in CSS)
check("workflow product layout has 1180 breakpoint", "@media (max-width: 1180px)" in CSS)
check("workflow product layout has 850 breakpoint", "@media (max-width: 850px)" in CSS)
check("workflow product layout collapses to one column", "@media (max-width: 850px)" in CSS and "grid-template-columns: 1fr" in CSS)
check("workflow palette becomes compact grid", "repeat(4, minmax(0, 1fr))" in CSS)

# Helpdesk simple automation boundary remains intact.
check("Helpdesk Automation does not import workflow canvas", "@inno/ui/workflow" not in HELPDESK and "INNOWorkflowCanvas" not in HELPDESK)
check("Helpdesk simple automation route remains P04", routes["helpdesk/automation/new"]["pattern"] == "P04")

# No backend domain/persistence added in 45B.
check("no workflow backend module exists", not (PROD / "services/platform-api/src/Modules/Workflows").exists())
check("no workflow migration added", not any("workflow" in p.name.lower() for p in (PROD / "services/platform-api/src").rglob("*Migration*.cs")))

print(f"step45b_checks={checks}")
print(f"step45b_failures={len(failures)}")
if failures:
    for item in failures:
        print("FAILED", item)
sys.exit(1 if failures else 0)
