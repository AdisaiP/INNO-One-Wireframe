#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"

manifest = json.loads((PROD / "production-skeleton.json").read_text())
impl = json.loads((ROOT / "inno-implementation-contract.json").read_text())
data = json.loads((ROOT / "inno-data-model-contract.json").read_text())

issues = []

if manifest.get("contractVersion") != "0.5.0":
    issues.append(f"expected skeleton contract 0.5.0, found {manifest.get('contractVersion')}")
if impl.get("contractVersion") != "0.5.0":
    issues.append(f"expected current Implementation Contract 0.5.0, found {impl.get('contractVersion')}")
ref = impl.get("productionSkeleton", {})
if ref.get("version") != "0.5.0":
    issues.append("implementation contract must reference Production Skeleton 0.5.0")

required_dirs = [
    "apps/web-portal",
    "apps/endpoint-agent",
    "apps/assets-mobile",
    "services/platform-api",
    "services/meeting-service",
    "packages/ui",
    "packages/contracts",
    "packages/auth",
    "packages/shared",
    "infrastructure/docker",
    "infrastructure/database",
    "infrastructure/reverse-proxy",
    "tests/unit",
    "tests/integration",
    "tests/contract",
    "tests/e2e",
]
for rel in required_dirs:
    if not (PROD / rel).is_dir():
        issues.append(f"missing production directory: {rel}")

required_files = [
    "INNO.One.sln",
    "global.json",
    "Directory.Build.props",
    "Directory.Packages.props",
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "apps/web-portal/package.json",
    "apps/web-portal/src/main.tsx",
    "services/platform-api/src/INNO.One.PlatformApi/Program.cs",
    "services/meeting-service/src/INNO.One.MeetingService/Program.cs",
    "infrastructure/docker/compose.yml",
    "infrastructure/database/init/001-bootstrap.sql",
    "infrastructure/docker/keycloak/realm-inno-one.json",
]
for rel in required_files:
    if not (PROD / rel).is_file():
        issues.append(f"missing production file: {rel}")

# .NET project shape.
projects = sorted(PROD.glob("services/**/*.csproj"))
if len(projects) != 12:
    issues.append(f"expected 12 .NET projects, found {len(projects)}")

for p in projects:
    text = p.read_text()
    if "<TargetFramework>net10.0</TargetFramework>" not in text:
        issues.append(f"{p.relative_to(PROD)} does not target net10.0")

module_projects = list((PROD / "services/platform-api/src/Modules").glob("*/*.csproj"))
module_names = {"Platform", "Devices", "Assets", "Helpdesk", "Reports"}
found_modules = {p.parent.name for p in module_projects}
if found_modules != module_names:
    issues.append(f"module project set mismatch: {sorted(found_modules)}")

for p in module_projects:
    text = p.read_text()
    # No module is allowed to compile-reference another module project.
    if re.search(r'ProjectReference Include="[^"]*Modules[\\/](?!' + re.escape(p.parent.name) + r')[^"]+"', text):
        issues.append(f"cross-module project reference detected: {p.relative_to(PROD)}")
    if "Npgsql.EntityFrameworkCore.PostgreSQL" not in text:
        issues.append(f"module missing PostgreSQL provider: {p.relative_to(PROD)}")

# DbContext/schema mapping must align with Step 13.
expected_contexts = {
    "PlatformDbContext": "platform",
    "DevicesDbContext": "devices",
    "AssetsDbContext": "assets",
    "HelpdeskDbContext": "helpdesk",
    "ReportsDbContext": "reports",
    "InfrastructureDbContext": "integration",
    "MeetingDbContext": "meeting",
    "MeetingIntegrationDbContext": "integration",
}
for context, schema in expected_contexts.items():
    matches = list(PROD.glob(f"services/**/{context}.cs"))
    if len(matches) != 1:
        issues.append(f"{context}: expected one context source, found {len(matches)}")
        continue
    text = matches[0].read_text()
    if f'"{schema}"' not in text:
        issues.append(f"{context}: expected schema {schema}")

manifest_contexts = {x["name"]: x["schema"] for x in manifest.get("dbContexts", [])}
if manifest_contexts != expected_contexts:
    issues.append(f"manifest DbContext mapping mismatch: {manifest_contexts}")

# Contract bridge.
contracts_source = (PROD / "services/platform-api/src/INNO.One.Contracts/ContractVersions.cs").read_text()
for version in ("V1.26", "1.20.0", "0.2.0", "0.3.0", "0.4.0", "0.5.0"):
    if version not in contracts_source:
        issues.append(f"ContractVersions.cs missing {version}")

# Web workspace/toolchain.
root_pkg = json.loads((PROD / "package.json").read_text())
web_pkg = json.loads((PROD / "apps/web-portal/package.json").read_text())
if root_pkg.get("packageManager") != "pnpm@10.17.0":
    issues.append("root package manager must remain pnpm@10.17.0 for this checkpoint")
expected_web = {
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "react-router-dom": "6.30.6",
}
for name, version in expected_web.items():
    if web_pkg.get("dependencies", {}).get(name) != version:
        issues.append(f"web dependency mismatch: {name}")
if web_pkg.get("devDependencies", {}).get("vite") != "6.4.3":
    issues.append("Vite checkpoint must be 6.4.3")
if web_pkg.get("devDependencies", {}).get("typescript") != "5.9.3":
    issues.append("TypeScript checkpoint must be 5.9.3")
if manifest.get("clients", {}).get("webPortal", {}).get("devPort") != 5180:
    issues.append("Web Portal development port must be 5180 for this checkpoint")
if "port: 5180" not in (PROD / "apps/web-portal/vite.config.ts").read_text():
    issues.append("Vite dev server must bind the INNO.One checkpoint port 5180")
realm_text = (PROD / "infrastructure/docker/keycloak/realm-inno-one.json").read_text()
if "http://localhost:5180/*" not in realm_text or "http://localhost:5180" not in realm_text:
    issues.append("Keycloak Web redirect/origin must use localhost:5180")

for pkg_name in ("ui", "contracts", "auth", "shared"):
    p = PROD / "packages" / pkg_name / "package.json"
    if not p.is_file():
        issues.append(f"missing shared package {pkg_name}")

# External-engine boundaries.
if "MeshCentral" not in (PROD / "services/platform-api/src/Integrations/MeshCentral/README.md").read_text():
    issues.append("MeshCentral adapter boundary documentation missing")
if "Keycloak" not in (PROD / "services/platform-api/src/Integrations/Keycloak/README.md").read_text():
    issues.append("Keycloak adapter boundary documentation missing")

# PostgreSQL local bootstrap must mirror frozen core schemas.
sql = (PROD / "infrastructure/database/init/001-bootstrap.sql").read_text()
for db in ("inno_core", "inno_meeting", "keycloak"):
    if db not in sql:
        issues.append(f"local database bootstrap missing {db}")
for schema in data["deployment"]["coreDatabase"]["schemas"]:
    if f"SCHEMA IF NOT EXISTS {schema}" not in sql:
        issues.append(f"local bootstrap missing core schema {schema}")

# Compose should not pretend to own MeshCentral.
compose = (PROD / "infrastructure/docker/compose.yml").read_text()
if re.search(r"^\s{2}meshcentral:", compose, re.M):
    issues.append("MeshCentral must remain external to the Step 14 local compose checkpoint")
if "postgres:17-alpine" not in compose:
    issues.append("local compose PostgreSQL checkpoint mismatch")
if "quay.io/keycloak/keycloak:26.4.0" not in compose:
    issues.append("local compose Keycloak checkpoint mismatch")

constraints = manifest.get("constraints", {})
for key in (
    "frozenPrototypeUntouched",
    "featureHeavyBackendImplemented",
    "directMeshCentralPersistence",
    "crossModuleProjectReferences",
    "crossModuleDatabaseForeignKeys",
):
    if key not in constraints:
        issues.append(f"manifest constraint missing: {key}")
if constraints.get("frozenPrototypeUntouched") is not True:
    issues.append("frozen prototype must remain untouched")
for key in (
    "featureHeavyBackendImplemented",
    "directMeshCentralPersistence",
    "crossModuleProjectReferences",
    "crossModuleDatabaseForeignKeys",
):
    if constraints.get(key) is not False:
        issues.append(f"constraint must remain false: {key}")

print(f"skeleton_contract_version={manifest.get('contractVersion')}")
print(f"dotnet_projects={len(projects)}")
print(f"module_projects={len(module_projects)}")
print(f"shared_packages=4")
print(f"db_contexts={len(expected_contexts)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
