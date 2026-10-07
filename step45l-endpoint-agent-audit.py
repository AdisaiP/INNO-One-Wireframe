from pathlib import Path
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
API = PROD / "services/platform-api/src"
AGENT = PROD / "apps/endpoint-agent"

checks = 0
failures: list[str] = []

def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        failures.append(message)

def text(path: Path | str) -> str:
    return Path(path).read_text(encoding="utf-8-sig")

package = json.loads(text(AGENT / "package.json"))
workspace = text(PROD / "pnpm-workspace.yaml")
root_package = json.loads(text(PROD / "package.json"))
readme = text(AGENT / "README.md")
main = text(AGENT / "src/main.tsx")
agent_api = text(AGENT / "src/api.ts")
machine_auth = text(AGENT / "src/machineAuth.ts")
agent_telemetry = text(AGENT / "src/telemetry.ts")
auth = text(AGENT / "src/auth.ts")
i18n = text(AGENT / "src/i18n.ts")
styles = text(AGENT / "src/styles.css")
tauri_config = json.loads(text(AGENT / "src-tauri/tauri.conf.json"))
cargo = text(AGENT / "src-tauri/Cargo.toml")
tauri_main = text(AGENT / "src-tauri/src/main.rs")
program = text(API / "INNO.One.PlatformApi/Program.cs")
devices_module = text(API / "Modules/Devices/DevicesModule.cs")
device_api = text(API / "Modules/Devices/Api/AgentDeviceEndpoints.cs")
enrollment_api = text(API / "Modules/Devices/Api/DeviceEnrollmentEndpoints.cs")
machine_authenticator = text(API / "Modules/Devices/Infrastructure/DeviceMachineAuthenticator.cs")
telemetry_api = text(API / "Modules/Devices/Api/AgentTelemetryEndpoints.cs")
activity_api = text(API / "Modules/Devices/Api/DeviceActivityEndpoints.cs")
device_entities = text(API / "Modules/Devices/Domain/DeviceEntities.cs")
device_db = text(API / "Modules/Devices/Persistence/DevicesDbContext.cs")
prompt_service = text(API / "Modules/Devices/Application/AgentPromptService.cs")
prompt_contract = text(API / "INNO.One.Contracts/Agent/AgentPromptContracts.cs")
assets_api = text(API / "Modules/Assets/Api/AgentAssetsEndpoints.cs")
helpdesk_api = text(API / "Modules/Helpdesk/Api/HelpdeskEndpoints.cs")
roadmap = json.loads(text(ROOT / "inno-step45a-production-gap-roadmap.json"))
app_root = text(PROD / "apps/web-portal/src/app/AppRoot.tsx")
app_shell = text(PROD / "apps/web-portal/src/app/AppShell.tsx")
browser_qa = text(ROOT / "step45l-endpoint-agent-browser-qa.py")
broad_qa = text(ROOT / "step42-production-ux-browser-qa.py")

# Workspace/runtime technology.
check(package["name"] == "@inno/endpoint-agent", "Endpoint Agent package name is wrong")
for script in ("dev", "build", "typecheck"):
    check(script in package.get("scripts", {}), "Endpoint Agent package script missing: " + script)
for dep in ("react", "react-dom", "keycloak-js"):
    check(dep in package.get("dependencies", {}), "Endpoint Agent dependency missing: " + dep)
check("@tauri-apps/cli" in package.get("devDependencies", {}), "Tauri CLI dev dependency missing")
for script in ("tauri", "dev:native", "build:native"):
    check(script in package.get("scripts", {}), "Endpoint Agent native script missing: " + script)
check("apps/endpoint-agent" in workspace, "Endpoint Agent is not a pnpm workspace package")
for script in ("dev:agent", "typecheck:agent", "build:agent"):
    check(script in root_package.get("scripts", {}), "Root Agent script missing: " + script)
check("Tauri 2" in readme and "Windows-first" in readme, "Runtime choice is not frozen to Tauri 2 Windows-first")
check(tauri_config.get("productName") == "INNO.One Agent", "Tauri product name is wrong")
check(tauri_config.get("identifier") == "com.innovationssolutionsservice.innoone.agent", "Tauri identifier is wrong")
window = tauri_config.get("app", {}).get("windows", [{}])[0]
check(window.get("width") == 820 and window.get("height") == 900, "Tauri canonical Agent viewport is wrong")
check(window.get("minWidth") == 390 and window.get("minHeight") == 640, "Tauri Agent minimum viewport is wrong")
check('tauri = { version = "2"' in cargo, "Tauri 2 Rust dependency missing")
check("tauri::Builder::default()" in tauri_main, "Tauri native host entrypoint missing")
bundle_icons = tauri_config.get("bundle", {}).get("icon", [])
check("icons/icon.ico" in bundle_icons, "Tauri Windows bundle icon missing")
check((AGENT / "src-tauri/icons/icon.ico").exists(), "Tauri Windows ICO file missing")
check("native packaging has been verified" in readme, "Native Windows packaging verification is not documented")
check("not code-signed" in readme, "Native development signing status is not documented")
check("must never call MeshCentral" in readme, "MeshCentral boundary warning missing")

# Authentication and locale.
check("login-required" in auth, "Agent does not require Keycloak login")
check("pkceMethod: 'S256'" in auth, "Agent does not use PKCE S256")
check("checkLoginIframe: false" in auth, "Agent auth iframe behavior not explicit")
check("password" not in auth.lower(), "Agent auth contains password-grant logic")
check("await initializeAuthentication();" in auth, "Agent access-token helper does not self-initialize Keycloak")
check("locale:" in agent_api and "organizationDefaultLocale" in agent_api, "Agent profile locale contract incomplete")
check("setPreferredLocale" in agent_api and "/platform/me/profile" in agent_api, "Agent cannot persist locale preference")
check("document.documentElement.lang" in main, "Agent does not synchronize document lang")
check("locale === 'th-TH' ? 'th' : 'en'" in main, "Agent document language mapping is wrong")
check("locale === 'th-TH' ? 'en-US' : 'th-TH'" in main, "Agent runtime language toggle missing")

# Bilingual catalog parity.
th_block = i18n.split("'th-TH': {", 1)[1].split("},\n  'en-US': {", 1)[0]
en_block = i18n.split("'en-US': {", 1)[1].split("},\n} satisfies", 1)[0]
key_re = re.compile(r"^\s*([A-Za-z][A-Za-z0-9]*):", re.MULTILINE)
th_keys = set(key_re.findall(th_block))
en_keys = set(key_re.findall(en_block))
check(th_keys == en_keys, "Agent Thai/English translation key parity failed")
check(len(th_keys) >= 45, "Agent bilingual catalog is unexpectedly small")
for key in (
    "help", "ownership", "remoteTitle", "remoteApprove", "remoteDecline",
    "loading", "loadError", "acknowledge", "accept", "decline", "language"
):
    check(key in th_keys and key in en_keys, "Agent locale key missing: " + key)

# Renderer/Product states.
for marker in (
    "type View = 'home' | 'help' | 'ownership'",
    "navigator.onLine",
    "window.addEventListener('offline'",
    "window.addEventListener('online'",
    "getPendingConsent()",
    "getPendingPrompt()",
    "setInterval(() => void poll(), 3000)",
    "createHelpRequest",
    "submitOwnership",
    "answerConsent",
    "answerPrompt",
):
    check(marker in main, "Agent runtime state/flow missing: " + marker)
for marker in (
    "className=\"offline-banner\"",
    "role=\"dialog\"",
    "aria-modal=\"true\"",
    "bottom-nav",
):
    check(marker in main, "Agent accessibility/state surface missing: " + marker)
for width in ("820px", "640px", "390px"):
    check(width in styles, "Agent responsive breakpoint/width missing: " + width)
check("modal-backdrop" in styles and "consent-dialog" in styles, "Agent consent/prompt modal styles missing")
check("primary.full" in styles, "Agent full-width notice acknowledgement action missing")

# Agent client API.
for marker in (
    "/agent/help-requests",
    "/agent/ownership/context",
    "/agent/ownership-submissions",
    "/agent/remote-consent/pending",
    "/agent/remote-consent/requests/",
    "/agent/prompts/pending",
    "/agent/prompts/",
):
    check(marker in agent_api, "Agent client API route missing: " + marker)
check("/agent/enroll" in machine_auth, "Agent enrollment API route missing")
check("/agent/machine/context" in machine_auth, "Agent machine context API route missing")
check("ensureMachineCredential" in machine_auth, "Agent machine credential bootstrap missing")
check("initializeAuthentication" not in main, "Agent startup still requires interactive user authentication")
check("VITE_API_BASE_URL" in agent_api and "VITE_API_BASE_URL" in machine_auth,
      "Packaged Agent production API base config missing")
check("save_machine_credential" in tauri_main and "load_machine_credential" in tauri_main,
      "Native machine credential persistence missing")
check("DataProtectionScope]::LocalMachine" in tauri_main,
      "Native machine credential protection missing")
check('MapPost("/agent/enroll"' in enrollment_api and 'MapGet("/agent/machine/context"' in enrollment_api,
      "Platform machine enrollment endpoints missing")
check("DeviceMachineAuthenticator" in machine_authenticator and "FixedTimeEquals" in machine_authenticator,
      "Platform machine credential authenticator missing")
for marker in (
    "collectPerformanceTelemetry",
    "collectNetworkTelemetry",
    "collectHardwareTelemetry",
    "collectSoftwareInventory",
):
    check(marker in main, "Agent telemetry publisher missing collector: " + marker)
for marker in (
    "collect_hardware_telemetry",
    "collect_software_inventory",
    "Win32_ComputerSystem",
    "Win32_PhysicalMemory",
    "CurrentVersion\\Uninstall",
):
    check(marker in tauri_main, "Agent native telemetry collector missing: " + marker)
for marker in (
    "AgentHardwareTelemetry",
    "AgentSoftwareTelemetry",
    "HardwareStored",
    "SoftwareStored",
    "devices.hardware_inventory.observed",
    "devices.software_inventory.observed",
):
    check(marker in telemetry_api, "Agent telemetry ingest contract missing: " + marker)
check("target_type = 'remote_session'" in activity_api and "devices.remote_sessions" in activity_api,
      "Device Activity does not include related RemoteSession audits")

# Platform routing and module ownership.
check("MapAgentDeviceEndpoints" in program, "Platform API does not map Devices Agent endpoints")
check("MapAgentAssetsEndpoints" in program, "Platform API does not map Assets Agent endpoints")
check('MapPost("/agent/help-requests", CreateTicketAsync)' in helpdesk_api, "Helpdesk Agent Request Help facade missing")
check("selfOwnedDevice = device.OwnerUserId == access.UserId" in helpdesk_api, "Request Help self-owned device guard missing")
check("!selfOwnedDevice" in helpdesk_api and '"devices.view"' in helpdesk_api, "Request Help non-self device scope guard missing")

# Device context + consent security.
for marker in (
    'MapGet("/agent/device-context/{deviceId}"',
    'MapGet("/agent/remote-consent/pending"',
    'MapPost("/agent/remote-consent/requests/{requestId}/decision"',
    'MapPost("/devices/{deviceId}/remote-consent-requests"',
    '"platform.workspace.access"',
    '"devices.remote"',
    "device.OwnerUserId != access.UserId",
    "AGENT_DEVICE_NOT_OWNED_BY_CURRENT_USER",
):
    check(marker in device_api, "Devices Agent/consent guard missing: " + marker)
for marker in (
    "devices.remote.consent_requested",
    "devices.remote.consent_decided",
    "remote.consent.decided",
):
    check(marker in device_api, "Remote consent audit/outbox evidence missing: " + marker)
check("DurationSeconds ?? 60" in device_api and "15, 300" in device_api, "Remote consent expiry bounds missing")
check("entity.ExpiresAt <= DateTimeOffset.UtcNow" in device_api, "Remote consent expiry re-check missing")

# Durable consent persistence.
for marker in (
    "class RemoteConsentRequest",
    "RequestedByUserId",
    "MessageTh",
    "MessageEn",
    "DecidedByUserId",
    "ExpiresAt",
):
    check(marker in device_entities, "Remote consent entity contract missing: " + marker)
check("DbSet<RemoteConsentRequest>" in device_db, "Remote consent DbSet missing")
check('ToTable("remote_consent_requests")' in device_db, "Remote consent table mapping missing")
migrations = [p.name for p in (API / "Modules/Devices/Persistence/Migrations").glob("*Step45LAgentRemoteConsent*.cs")]
check(len(migrations) == 2, "Remote consent migration/designer pair missing")

# Explicit Agent prompt contract and durable runtime.
for marker in (
    "AgentPromptCreateRequest",
    "AgentPromptCreateResult",
    "interface IAgentPromptService",
    "Task<AgentPromptCreateResult> CreateAsync",
    "string CorrelationId",
    "string? TraceId",
):
    check(marker in prompt_contract, "Agent prompt shared contract missing: " + marker)
check("IAgentPromptService, AgentPromptService" in devices_module, "Agent prompt service is not registered")
for marker in (
    "class AgentPromptService",
    "SourceModule",
    "PromptType",
    "TitleTh",
    "TitleEn",
    "MessageTh",
    "MessageEn",
    "BeginTransactionAsync",
    "devices.agent.prompt_created",
    "agent.prompt.created",
):
    check(marker in prompt_service, "Agent prompt service contract missing: " + marker)
for marker in (
    'MapGet("/agent/prompts/pending"',
    'MapPost("/agent/prompts/{promptId}/response"',
    'MapPost("/devices/{deviceId}/agent-prompts"',
    '"devices.manage"',
    "device.OwnerUserId != access.UserId",
    "devices.agent.prompt_responded",
    "agent.prompt.responded",
):
    check(marker in device_api, "Agent prompt API/guard missing: " + marker)
check("DbSet<AgentPrompt>" in device_db, "Agent prompt DbSet missing")
check('ToTable("agent_prompts")' in device_db, "Agent prompt table mapping missing")
prompt_migrations = [p.name for p in (API / "Modules/Devices/Persistence/Migrations").glob("*Step45LAgentPrompts*.cs")]
check(len(prompt_migrations) == 2, "Agent prompt migration/designer pair missing")

# Assets ownership Agent boundary.
for marker in (
    'MapGet("/agent/ownership/context"',
    'MapPost("/agent/ownership-submissions"',
    '"platform.workspace.access"',
    "device.OwnerUserId != access.UserId",
    "x.LinkedDeviceId == parsedDeviceId",
    "x.ShowInAgent && x.Status == \"active\"",
    "new OwnershipSubmission",
    "assets.ownership.submitted",
    "asset.ownership.submitted",
):
    check(marker in assets_api, "Assets Agent ownership contract missing: " + marker)
check("append-only" in assets_api.lower(), "Ownership evidence is not explicitly append-only")
check("pendingExists" not in assets_api, "Agent ownership incorrectly blocks new append-only confirmations")

# Cross-surface architecture.
endpoint_surface = next(x for x in roadmap["surfaces"] if x["id"] == "endpoint-agent")
check(endpoint_surface["status"] == "implemented", "Roadmap does not mark Endpoint Agent implemented")
check(endpoint_surface.get("runtimeDecision", "").startswith("Tauri 2"), "Roadmap runtime choice missing")
check(endpoint_surface.get("missing") == [], "Roadmap still lists Step45L core gaps")
check("Meeting recording client integration" in endpoint_surface.get("deferredToMeeting", []), "Meeting Agent recording defer boundary missing")
check('path="agent"' not in app_root and 'path="endpoint-agent"' not in app_root, "Endpoint Agent leaked into Web routes")
check('to="/agent"' not in app_shell and 'to="/endpoint-agent"' not in app_shell, "Endpoint Agent leaked into Web navigation")
check("@inno/ui" not in package.get("dependencies", {}), "Endpoint Agent incorrectly depends on Web UI package")
check("web-portal" not in main.lower(), "Endpoint Agent renderer imports/references Web Portal internals")
check("MeshCentral" not in main and "MeshCentral" not in agent_api, "Endpoint Agent client bypasses INNO.One API through MeshCentral")

# Runtime/browser QA must be deterministic and clean up its own evidence.
check('"client_id":"inno-one-e2e"' in browser_qa, "Step45L runtime QA does not use the dedicated E2E client")
check("Request Help QA ticket resolved" in browser_qa, "Step45L runtime QA does not resolve its created Helpdesk Ticket")
check("Interrupted ownership QA rows cleaned" in browser_qa, "Step45L runtime QA does not clean interrupted ownership evidence")
check("broad QA forces English locale" in broad_qa, "Broad Product QA does not force its expected locale")
check("broad QA restores user locale" in broad_qa, "Broad Product QA does not restore user locale")

print(f"step45l_checks={checks}")
print(f"step45l_failures={len(failures)}")
for failure in failures:
    print(" -", failure)
sys.exit(1 if failures else 0)
