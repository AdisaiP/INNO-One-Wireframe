from pathlib import Path
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
WEB = PROD / "apps/web-portal/src"
API = PROD / "services/platform-api/src"
ROADMAP = json.loads((ROOT / "inno-step45a-production-gap-roadmap.json").read_text(encoding="utf-8"))
MATRIX = json.loads((ROOT / "inno-step44a-screen-interaction-matrix.json").read_text(encoding="utf-8"))
MANIFEST = json.loads((PROD / "module-manifests.json").read_text(encoding="utf-8"))

checks = 0
failures = []

def check(name, condition, detail=""):
    global checks
    checks += 1
    ok = bool(condition)
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

def read(path):
    return Path(path).read_text(encoding="utf-8")

app_root = read(WEB / "app/AppRoot.tsx")
app_shell = read(WEB / "app/AppShell.tsx")
program = read(API / "INNO.One.PlatformApi/Program.cs")
seed = read(API / "Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
workflow = read(PROD / "packages/ui/src/workflow.tsx")
design_system = read(WEB / "pages/InternalDesignSystemPage.tsx")
reports_module = read(API / "Modules/Reports/ReportsModule.cs")
mobile_app = read(PROD / "apps/assets-mobile/App.tsx")
agent_readme = read(PROD / "apps/endpoint-agent/README.md")
agent_main = read(PROD / "apps/endpoint-agent/src/main.tsx")
agent_auth = read(PROD / "apps/endpoint-agent/src/auth.ts")
agent_api = read(PROD / "apps/endpoint-agent/src/api.ts")
agent_tauri = read(PROD / "apps/endpoint-agent/src-tauri/tauri.conf.json")
agent_device_api = read(API / "Modules/Devices/Api/AgentDeviceEndpoints.cs")
agent_assets_api = read(API / "Modules/Assets/Api/AgentAssetsEndpoints.cs")
agent_prompt_contract = read(API / "INNO.One.Contracts/Agent/AgentPromptContracts.cs")
meeting_program = read(PROD / "services/meeting-service/src/INNO.One.MeetingService/Program.cs")
meeting_readme = read(PROD / "services/meeting-service/README.md")

modules = {item["id"]: item for item in MANIFEST["modules"]}
surface = {item["id"]: item for item in ROADMAP["surfaces"]}
roadmap = {item["step"]: item for item in ROADMAP["roadmap"]}
decisions = {item["id"]: item for item in ROADMAP["frozenDecisions"]}

check("roadmap schema is 1", ROADMAP["schemaVersion"] == 1)
check("step id is 45A", ROADMAP["step"] == "45A")
check("frozen design system remains V1.26", ROADMAP["baseline"]["designSystem"] == "V1.26")
check("frozen UI contract remains 1.20.0", ROADMAP["baseline"]["uiContract"] == "1.20.0")
check("current Product route matrix is 75 after Step 45K Reports", len(MATRIX["routes"]) == 75, len(MATRIX["routes"]))
check("45A baseline records 61 route definitions", ROADMAP["baseline"]["productionRouteDefinitions"] == 61)
check("implemented route groups sum to 61", sum(ROADMAP["baseline"]["implementedRouteGroups"].values()) == 61)

# Current implemented Web modules.
for module_id in ("devices", "assets", "helpdesk", "reports"):
    check(module_id + " production manifest exists", module_id in modules)
    check(module_id + " roadmap status implemented", surface[module_id]["status"] == "implemented")

check("platform core classified implemented", surface["platform-core"]["status"] == "implemented")
check("workspace and admin routes remain real Product routes",
      'path="admin"' in app_root and 'path="devices"' in app_root and 'path="assets"' in app_root and 'path="helpdesk"' in app_root)

# Registry alignment closed by 45A.
device_nav = {item["route"]: item["label"] for item in modules["devices"]["navigation"]}
asset_nav = {item["route"]: item["label"] for item in modules["assets"]["navigation"]}
check("Devices manifest includes Inventory Query", device_nav.get("/devices/query") == "Inventory Query", device_nav)
check("Assets ownership manifest uses canonical label", asset_nav.get("/assets/ownership") == "Ownership Overview", asset_nav)
check("Assets owner manifest uses canonical label", asset_nav.get("/assets/owners") == "Asset Owners", asset_nav)
check("legacy Ownership & Users label removed from production manifest", "Ownership & Users" not in read(PROD / "module-manifests.json"))
check("legacy User Profiles label removed from production manifest", '"User Profiles"' not in read(PROD / "module-manifests.json"))

# Step 45A froze Workflow as foundation-only; Step 45B now adds hidden Product IA routes
# without changing the 45A historical classification or adding persistence.
check("workflow classified foundation-only at 45A", surface["workflow"]["status"] == "foundation-only")
check("workflow canvas foundation exists", "INNOWorkflowCanvas" in workflow and "@xyflow/react" in workflow)
check("workflow proof remains in internal design system", "INNOWorkflowCanvas" in design_system and 'id="workflow"' in design_system)
check("45F retires standalone workflow Product routes", 'path="workflows/*" element={<Navigate to="/helpdesk/automation" replace />}' in app_root and 'path="helpdesk/automation/new"' in app_root and 'path="helpdesk/automation/:automationId"' in app_root)
check("45B workflow module contract now exists", "workflows" in modules)
check("45F workflow module becomes hidden Automation Core", modules["workflows"]["launcher"] is False and modules["workflows"]["name"] == "Automation Core")
check("45B workflow future permissions are declared", set(modules["workflows"]["permissions"]) == {"workflows.view", "workflows.manage"})
check("workflow standalone module decision frozen", decisions["workflow-ownership"]["decision"].startswith("Dynamic Workflow is a standalone Web application"))
check("Helpdesk owns Automation and P10 Run History routes", 'path="helpdesk/automation"' in app_root and 'path="helpdesk/automation/:automationId/runs"' in app_root)

# Step45K promotes Reports from skeleton to a real Product slice.
check("reports classified implemented", surface["reports"]["status"] == "implemented")
check("reports manifest exists", "reports" in modules)
check("reports service is wired into DI", ".AddReportsModule(coreDatabase)" in program)
check("reports generation service is registered", "IReportGenerationService" in reports_module)
check("reports API is mapped", "MapReportsEndpoints" in program)
report_api_cs = [p for p in (API / "Modules/Reports/Api").glob("*.cs")]
check("reports API has endpoint implementation", any(p.name == "ReportsEndpoints.cs" for p in report_api_cs), report_api_cs)
check("reports Web has concrete Product routes",
      all(marker in app_root for marker in [
          'path="reports"',
          'path="reports/new"',
          'path="reports/schedules"',
          'path="reports/:reportId/runs"',
          'path="reports/:reportId"',
      ]))

# Meeting has a dedicated health/persistence service skeleton, while Product feature routes remain deferred.
check("meeting classified backend-skeleton", surface["meeting"]["status"] == "backend-skeleton")
check("meeting manifest exists", "meeting" in modules)
check("meeting service skeleton exists", (PROD / "services/meeting-service/src/INNO.One.MeetingService/Program.cs").exists())
check("meeting service exposes health only", 'MapHealthChecks("/health/live")' in meeting_program and 'MapGet("/health/ready"' in meeting_program and "Recording, transcription, summary and action-item feature logic starts in later vertical slices." in meeting_readme)
check("meeting service has no feature API routes yet", meeting_program.count("app.Map") == 2)
check("meeting Web remains deferred", 'path="meeting/*" element={<DeferredPage name="Meeting"' in app_root)
for file_name in ("meeting.html", "meeting-list.html", "meeting-new.html", "meeting-detail.html", "meeting-upcoming.html"):
    check("meeting prototype exists " + file_name, (ROOT / file_name).exists())

# Installed development modules must not expose deferred Web apps.
check("development seed installs devices", 'AppId = "devices"' in seed)
check("development seed installs assets", 'AppId = "assets"' in seed)
check("development seed installs helpdesk", 'AppId = "helpdesk"' in seed)
check("development seed installs workflows after 45C persistence", 'AppId = "workflows"' in seed)
check("development seed does not install meeting", 'AppId = "meeting"' not in seed)
check("development seed installs reports after Step45K", 'AppId = "reports"' in seed)

# Cross-surface state. Step45L promotes Endpoint Agent from boundary-only to a real runtime.
check("Endpoint Agent classified implemented after Step45L", surface["endpoint-agent"]["status"] == "implemented")
check("Endpoint Agent runtime choice is Tauri 2", "Tauri 2" in agent_readme and '"productName": "INNO.One Agent"' in agent_tauri)
check("Endpoint Agent has React runtime shell", "function App()" in agent_main and "bottom-nav" in agent_main)
check("Endpoint Agent owns Request Help client", "createHelpRequest" in agent_main and "/agent/help-requests" in agent_api)
check("Endpoint Agent owns ownership confirmation client", "submitOwnership" in agent_main and "/agent/ownership-submissions" in agent_api)
check("Endpoint Agent owns remote consent runtime", "getPendingConsent" in agent_main and "/agent/remote-consent/pending" in agent_api)
check("Endpoint Agent uses PKCE", "pkceMethod: 'S256'" in agent_auth)
check("Endpoint Agent exposes module-owned Agent APIs", "MapAgentDeviceEndpoints" in program and "MapAgentAssetsEndpoints" in program)
check("Endpoint Agent prompt contract exists", "IAgentPromptService" in agent_prompt_contract and "getPendingPrompt" in agent_main)
check("Endpoint Agent self-owned device guard exists", "AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER" in agent_device_api and "AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER" in agent_assets_api)
check("Endpoint Agent stays out of Web routes", 'path="agent"' not in app_root and 'to="/agent"' not in app_shell)
check("Assets Mobile classified implemented cross-surface", surface["assets-mobile"]["status"] == "implemented-cross-surface")
check("Assets Mobile has real camera runtime", "CameraView" in mobile_app and "useCameraPermissions" in mobile_app)
check("Assets Mobile has OIDC runtime", "AuthSession.useAuthRequest" in mobile_app and "SecureStore" in mobile_app)

# Forms stays unscheduled backlog.
check("Forms classified backlog-only", surface["forms"]["status"] == "backlog-only")
check("Forms absent from production manifest", "forms" not in modules)
check("Forms has no numbered roadmap step", all(item["name"] != "Forms" for item in ROADMAP["roadmap"]))

# Frozen roadmap sequence.
for step in ("45B", "45C", "45D", "46", "47", "48"):
    check("roadmap contains " + step, step in roadmap)
check("45B is UI/IA only", roadmap["45B"]["backend"] is False)
check("45C adds workflow persistence", roadmap["45C"]["backend"] is True and "45B" in roadmap["45C"]["dependsOn"])
check("45D depends on workflow persistence", "45C" in roadmap["45D"]["dependsOn"])
check("Reports vertical slice historical roadmap entry remains", roadmap["46"]["name"] == "Reports Production Vertical Slice")
check("Endpoint Agent runtime scheduled before Meeting", roadmap["47"]["name"] == "Endpoint Agent Runtime Foundation" and "47" in roadmap["48"]["dependsOn"])
check("Meeting production scheduled after Agent runtime", roadmap["48"]["name"] == "Meeting Production Module")

# Availability: 45B may own contextual Workflow navigation after direct entry,
# but there is still no normal launcher/rail entry until persistence exists.
rail = app_shell.split('<aside className="prod-rail"', 1)[1].split('</aside>', 1)[0]
check("App rail does not expose Workflow module", 'to="/workflows"' not in rail)
check("Workflow contextual navigation moves into Helpdesk", "canViewWorkflows" not in app_shell and 'to="/helpdesk/automation"' in app_shell)
check("App shell does not expose Meeting nav", 'to="/meeting"' not in app_shell)
check("App shell exposes permission-gated Reports nav", 'to="/reports"' in app_shell and "canViewReports" in app_shell)

print(f"step45a_checks={checks}")
print(f"step45a_failures={len(failures)}")
if failures:
    for item in failures:
        print("FAILED", item)
sys.exit(1 if failures else 0)
