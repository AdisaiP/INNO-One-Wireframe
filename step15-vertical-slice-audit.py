#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"

manifest = json.loads((ROOT / "inno-step15-vertical-slice.json").read_text())
impl = json.loads((ROOT / "inno-implementation-contract.json").read_text())
api = json.loads((ROOT / "inno-api-contract.json").read_text())
issues = []

if manifest.get("contractVersion") != "0.6.0":
    issues.append("Step 15 manifest must be version 0.6.0")
if impl.get("contractVersion") != "0.10.0":
    issues.append("current Implementation Contract must be 0.10.0 after Step 19")
if impl.get("status") != "implementation-in-progress":
    issues.append("implementation status must be implementation-in-progress after Step 15")

vertical = impl.get("verticalSlice", {})
if vertical.get("version") != "0.6.0":
    issues.append("implementation contract does not reference Step 15 0.6.0")
for key in ("documentation", "manifest", "audit"):
    value = vertical.get(key)
    if not value or not (ROOT / value).exists():
        issues.append(f"missing vertical-slice source: {key}={value}")

expected_ops = ["platform.me.get", "devices.list", "devices.get"]
if manifest.get("scope", {}).get("implementedOperations") != expected_ops:
    issues.append("implemented operation manifest mismatch")

api_by_id = {entry["id"]: entry for entry in api.get("endpoints", [])}
for operation_id in expected_ops:
    if operation_id not in api_by_id:
        issues.append(f"implemented operation missing from API Contract: {operation_id}")

platform_endpoints = (PROD / "services/platform-api/src/Modules/Platform/Api/PlatformEndpoints.cs").read_text()
device_endpoints = (PROD / "services/platform-api/src/Modules/Devices/Api/DevicesEndpoints.cs").read_text()
program = (PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs").read_text()
access = (PROD / "services/platform-api/src/Modules/Platform/Application/AccessEvaluator.cs").read_text()
device_context = (PROD / "services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs").read_text()
platform_context = (PROD / "services/platform-api/src/Modules/Platform/Persistence/PlatformDbContext.cs").read_text()

for route in ('"/platform/me"', '"/devices"', '"/devices/{deviceId}"'):
    source = platform_endpoints if "platform" in route else device_endpoints
    if route not in source:
        issues.append(f"missing implemented route source {route}")

if 'MapInboundClaims = false' not in program:
    issues.append("Keycloak sub claim must remain unmapped in Platform API")
if "UseAuthentication();" not in program or "UseAuthorization();" not in program:
    issues.append("Platform API authentication/authorization middleware missing")
if ".RequireAuthorization()" not in program:
    issues.append("/api/v1 group must require authentication")
if "MapPlatformEndpoints()" not in program or "MapDevicesEndpoints()" not in program:
    issues.append("Step 15 endpoints not mapped by composition root")

# Authorization contract checks.
required_access_markers = [
    "PROFILE_NOT_FOUND",
    "PROFILE_NOT_ACTIVE",
    "MODULE_DISABLED",
    "PERMISSION_NOT_GRANTED",
    "ACTION_OVERRIDE_DENIED",
    'case "organization"',
    'case "location"',
    'case "device_group"',
    "IncludeChildren",
]
for marker in required_access_markers:
    if marker not in access:
        issues.append(f"AccessEvaluator missing contract marker: {marker}")

if "module is null || !module.Installed || !module.Enabled" not in access:
    issues.append("missing/disabled module must deny access")
if "ExpandOrganizationDescendantsAsync" not in access or "ExpandLocationDescendantsAsync" not in access:
    issues.append("includeChildren hierarchy expansion missing")

# Device authorization must be applied before collection count.
scope_pos = device_endpoints.find("if (!access.AllResources)")
count_pos = device_endpoints.find("var totalItems = await query.CountAsync")
if scope_pos < 0 or count_pos < 0 or scope_pos > count_pos:
    issues.append("device scope filtering must happen before total count")
if 'EvaluateAsync(httpContext.User, "devices.view"' not in device_endpoints:
    issues.append("Devices endpoints must evaluate devices.view")
if "OUTSIDE_ASSIGNED_SCOPE" not in device_endpoints:
    issues.append("resource detail scope denial missing")

# External provider IDs must remain private.
if "ExternalId" in device_endpoints or "externalId" in device_endpoints:
    issues.append("Devices API source exposes vendor ExternalId")
if "DeviceExternalMappings" not in device_endpoints:
    issues.append("Device detail does not use provider mapping boundary")
if '"MeshCentral"' not in device_endpoints:
    issues.append("Device detail does not normalize MeshCentral provider label")

# Persistence and migrations.
if "UseSnakeCaseNamingConvention" not in (PROD / "services/platform-api/src/Modules/Platform/PlatformModule.cs").read_text():
    issues.append("Platform persistence naming convention is not snake_case")
if "UseSnakeCaseNamingConvention" not in (PROD / "services/platform-api/src/Modules/Devices/DevicesModule.cs").read_text():
    issues.append("Devices persistence naming convention is not snake_case")

platform_migrations = list((PROD / "services/platform-api/src/Modules/Platform/Persistence/Migrations").glob("*_Step15IdentityAccess.cs"))
device_migrations = list((PROD / "services/platform-api/src/Modules/Devices/Persistence/Migrations").glob("*_Step15DeviceCatalog.cs"))
if len(platform_migrations) != 1:
    issues.append(f"expected one Platform Step 15 migration, found {len(platform_migrations)}")
if len(device_migrations) != 1:
    issues.append(f"expected one Devices Step 15 migration, found {len(device_migrations)}")

if platform_migrations:
    text = platform_migrations[0].read_text()
    for marker in ('name: "user_profiles"', 'name: "access_assignments"', 'keycloak_subject = table.Column'):
        if marker not in text:
            issues.append(f"Platform migration missing {marker}")
if device_migrations:
    text = device_migrations[0].read_text()
    for marker in ('name: "devices"', 'name: "device_external_mappings"', 'organization_unit_id = table.Column', 'last_seen_at = table.Column'):
        if marker not in text:
            issues.append(f"Devices migration missing {marker}")
    if 'principalSchema: "platform"' in text:
        issues.append("Devices migration must not create cross-module Platform FK")

# No compile-time module coupling.
devices_project = (PROD / "services/platform-api/src/Modules/Devices/INNO.One.Modules.Devices.csproj").read_text()
if re.search(r"ProjectReference[^\n]*Modules[\\/]Platform", devices_project):
    issues.append("Devices project directly references Platform module")
for source in (PROD / "services/platform-api/src/Modules/Devices").rglob("*.cs"):
    if "INNO.One.Modules.Platform" in source.read_text():
        issues.append(f"Devices source directly imports Platform module: {source.relative_to(PROD)}")

# Web implementation.
web_package = json.loads((PROD / "apps/web-portal/package.json").read_text())
deps = web_package.get("dependencies", {})
if deps.get("keycloak-js") != "26.2.4":
    issues.append("Web must pin keycloak-js 26.2.4 at Step 15")
if deps.get("@tanstack/react-query") != "5.104.0":
    issues.append("Web must pin React Query 5.104.0 at Step 15")

auth_source = (PROD / "apps/web-portal/src/auth/keycloak.ts").read_text()
for marker in ("login-required", "pkceMethod: 'S256'", "inno-one-web"):
    if marker not in auth_source:
        issues.append(f"Web Keycloak auth missing {marker}")

main_source = (PROD / "apps/web-portal/src/main.tsx").read_text()
if "initializeAuthentication()" not in main_source:
    issues.append("Web boot does not initialize Keycloak authentication")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
for route in ('path="profile"', 'path="devices"', 'path="devices/:deviceId"'):
    if route not in app_root:
        issues.append(f"Web route missing {route}")

devices_page = (PROD / "apps/web-portal/src/pages/DevicesPage.tsx").read_text()
for marker in ("Search devices", "Status filter", "Operating system filter", "No devices found"):
    if marker not in devices_page:
        issues.append(f"Devices collection missing {marker}")
for unavailable in ("Add Device", "Discover Devices", "Remote Desktop"):
    if unavailable in devices_page:
        issues.append(f"unimplemented high-emphasis action is visible: {unavailable}")

detail_page = (PROD / "apps/web-portal/src/pages/DeviceDetailPage.tsx").read_text()
if "Resource offline" not in detail_page or "latest cached inventory" not in detail_page:
    issues.append("Device detail offline cached state missing")
if "externalId" in detail_page or "mesh-step15" in detail_page:
    issues.append("Web device detail leaks vendor identifier")

profile_page = (PROD / "apps/web-portal/src/pages/ProfilePage.tsx").read_text()
for marker in ("Profile & Settings", "Single Sign-On", "Business authorization"):
    if marker not in profile_page:
        issues.append(f"Profile page missing {marker}")

# Local Keycloak normal sign-in vs smoke-only client.
realm = json.loads((PROD / "infrastructure/docker/keycloak/realm-inno-one.json").read_text())
clients = {client["clientId"]: client for client in realm.get("clients", [])}
web_client = clients.get("inno-one-web", {})
if web_client.get("publicClient") is not True or web_client.get("standardFlowEnabled") is not True:
    issues.append("normal Web Keycloak client must use standard flow")
if web_client.get("directAccessGrantsEnabled") is not False:
    issues.append("normal Web client must not enable direct access grants")
if web_client.get("attributes", {}).get("pkce.code.challenge.method") != "S256":
    issues.append("normal Web client must require PKCE S256")
e2e_client = clients.get("inno-one-e2e", {})
if e2e_client.get("directAccessGrantsEnabled") is not True:
    issues.append("local E2E client missing direct-grant smoke capability")

# Smoke QA source must cover the critical runtime assertions.
smoke = (PROD / "scripts/step15-local-smoke.py").read_text()
for marker in (
    "unauthenticated=401",
    "search_filter=ok",
    "status_filter=ok",
    "os_filter=ok",
    "pagination=ok",
    "vendor_external_id_hidden=ok",
    "hr_scope_devices=1",
    "out_of_scope_detail=403",
    "missing_resource=404",
    "step15_local_smoke=PASS",
):
    if marker not in smoke:
        issues.append(f"Step 15 smoke coverage missing {marker}")

print(f"step15_contract_version={manifest.get('contractVersion')}")
print(f"implemented_operations={len(expected_ops)}")
print(f"platform_migrations={len(platform_migrations)}")
print(f"devices_migrations={len(device_migrations)}")
print(f"web_routes=3")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
