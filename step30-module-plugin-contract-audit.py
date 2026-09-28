import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
issues = []

manifest = json.loads((ROOT / "production/module-manifests.json").read_text(encoding="utf-8"))
modules = manifest.get("modules", [])

if manifest.get("schemaVersion") != 1:
    issues.append("manifest schemaVersion")
if not modules:
    issues.append("manifest modules empty")

ids = [m.get("id") for m in modules]
routes = [m.get("route") for m in modules]
if len(ids) != len(set(ids)):
    issues.append("duplicate module ids")
if len(routes) != len(set(routes)):
    issues.append("duplicate module routes")

expected = {"devices", "assets", "helpdesk", "meeting", "reports"}
if set(ids) != expected:
    issues.append("module catalog ids")

expected_dependencies = {
    "devices": {"platform"},
    "assets": {"platform", "devices"},
    "helpdesk": {"platform", "devices", "assets"},
    "meeting": {"platform"},
    "reports": {"platform", "devices", "assets", "helpdesk"},
}

known = set(ids) | {"platform"}
for module in modules:
    module_id = module["id"]
    entry = module.get("entryPermission", "")
    permissions = set(module.get("permissions", []))
    if entry not in permissions:
        issues.append(f"{module_id} entry permission")
    if not str(module.get("route", "")).startswith("/"):
        issues.append(f"{module_id} route")
    dependencies = set(module.get("dependencies", []))
    if dependencies != expected_dependencies.get(module_id, set()):
        issues.append(f"{module_id} dependency contract")
    for dependency in dependencies:
        if dependency not in known or dependency == module_id:
            issues.append(f"{module_id} dependency {dependency}")
    nav_routes = set()
    for nav in module.get("navigation", []):
        if nav.get("permission") not in permissions:
            issues.append(f"{module_id} navigation permission {nav.get('id')}")
        if not str(nav.get("route", "")).startswith(module["route"]):
            issues.append(f"{module_id} navigation route {nav.get('id')}")
        if nav.get("route") in nav_routes:
            issues.append(f"{module_id} duplicate navigation route")
        nav_routes.add(nav.get("route"))

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

endpoints = read("production/services/platform-api/src/Modules/Platform/Api/AppRegistryEndpoints.cs")
namespace = read("production/services/platform-api/src/Modules/Platform/Application/PermissionNamespace.cs")
evaluator = read("production/services/platform-api/src/Modules/Platform/Application/AccessEvaluator.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
app_root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
admin_page = read("production/apps/web-portal/src/pages/AdminAppsPage.tsx")
apps_page = read("production/apps/web-portal/src/pages/AppsPage.tsx")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
for marker in [
    'api.MapGet("/platform/apps"',
    'api.MapGet("/admin/apps"',
    'api.MapPatch("/admin/apps/{appId}"',
    '"platform.apps.view"',
    '"admin.apps.view"',
    '"admin.apps.manage"',
    '"platform.app.availability_changed"',
    'Module dependency unavailable',
    'Module is required by enabled applications',
    'ValidateIfMatch',
]:
    if marker not in endpoints:
        issues.append("endpoint " + marker)

for marker in ['"platform"', '"admin"', "RequiresModuleAvailability"]:
    if marker not in namespace:
        issues.append("permission namespace " + marker)

if "PermissionNamespace.RequiresModuleAvailability" not in evaluator:
    issues.append("access evaluator module availability")

for permission in ["platform.apps.view", "admin.apps.view", "admin.apps.manage"]:
    if permission not in seed:
        issues.append("seed permission " + permission)

for marker in [
    '<Route path="apps" element={canViewApps ? <AppsPage />',
    '<Route path="admin/apps" element={canAdminApps ? <AdminAppsPage />',
]:
    if marker not in app_root:
        issues.append("route " + marker)
for marker in [
    'to="/apps" aria-label="Apps"',
    'to="/admin/apps">Apps & Modules</NavLink>',
    "platform.apps.view",
    "admin.apps.view",
]:
    if marker not in shell:
        issues.append("shell " + marker)

for marker in ["getPlatformApps", "INNOSearchField", "production-app-grid"]:
    if marker not in apps_page:
        issues.append("apps page " + marker)

for marker in [
    "getAdminApps",
    "updateAdminApp",
    'role="switch"',
    "<summary>Inspect</summary>",
    "canManageApps",
]:
    if marker not in admin_page:
        issues.append("admin apps page " + marker)

if ">Install<" in admin_page or "Install</button>" in admin_page:
    issues.append("fake install action")

import re
version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 20, 0):
    issues.append("implementation contract version")

print("step30_modules=" + ",".join(ids))
print("step30_manifest_schema=" + str(manifest.get("schemaVersion")))
print("step30_implementation_contract_min=0.20.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
