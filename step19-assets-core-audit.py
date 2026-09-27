#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
ASSETS = PROD / "services/platform-api/src/Modules/Assets"
issues = []

manifest = json.loads((ROOT / "inno-step19-assets-core.json").read_text())
implementation = json.loads((ROOT / "inno-implementation-contract.json").read_text())

operations = [
    "assets.overview.get",
    "assets.list",
    "assets.get",
    "assets.update",
    "assets.ownership.list",
    "assets.ownership.change",
    "assets.owners.list",
    "assets.owners.get",
    "assets.ownership_submissions.list",
    "assets.ownership_submissions.decide",
]
routes = [
    "/assets",
    "/assets/inventory",
    "/assets/:assetId",
    "/assets/ownership",
    "/assets/owners",
    "/assets/owners/:userId",
    "/assets/ownership/submissions",
]
tables = [
    "assets.assets",
    "assets.asset_ownership_history",
    "assets.ownership_submissions",
]

if manifest.get("contractVersion") != "0.10.0":
    issues.append("Step 19 manifest must be version 0.10.0")
if implementation.get("contractVersion") != "0.16.0":
    issues.append("Implementation Contract must be version 0.16.0")
if manifest.get("operations") != operations:
    issues.append("Step 19 operation catalog mismatch")
if manifest.get("webRoutes") != routes:
    issues.append("Step 19 Web route catalog mismatch")
if manifest.get("persistence", {}).get("newTables") != tables:
    issues.append("Step 19 persistence table catalog mismatch")
if manifest.get("persistence", {}).get("crossModuleForeignKeys") is not False:
    issues.append("Step 19 must forbid cross-module database foreign keys")
if manifest.get("deferredStep16Revalidation") is not True:
    issues.append("Step 16 fresh re-validation must remain deferred")

slice_ref = implementation.get("assetsCoreSlice", {})
if slice_ref.get("version") != "0.10.0":
    issues.append("Implementation Contract missing Step 19 version 0.10.0")
if slice_ref.get("implementedOperations") != operations:
    issues.append("Implementation Contract Step 19 operations mismatch")
if slice_ref.get("webRoutes") != routes:
    issues.append("Implementation Contract Step 19 routes mismatch")
if slice_ref.get("featureImplementationStarted") is not True:
    issues.append("Implementation Contract must mark Step 19 started")

for ref in (
    "INNO-One-Step19-Assets-Core.md",
    "inno-step19-assets-core.json",
    "step19-assets-core-audit.py",
    "production/scripts/step19-local-smoke.py",
):
    if not (ROOT / ref).exists():
        issues.append(f"missing Step 19 source-of-truth file: {ref}")

api = (ASSETS / "Api/AssetsEndpoints.cs").read_text()
for operation in operations:
    if f'.WithName("{operation}")' not in api:
        issues.append(f"Assets API operation marker missing: {operation}")
for marker in (
    '"assets.view"',
    '"assets.manage"',
    '"assets.asset.updated"',
    '"assets.ownership.changed"',
    '"asset.changed"',
    '"ownership.changed"',
):
    if marker not in api:
        issues.append(f"Assets API/ledger marker missing: {marker}")

context = (ASSETS / "Persistence/AssetsDbContext.cs").read_text()
for table in ("assets", "asset_ownership_history", "ownership_submissions"):
    if f'ToTable("{table}")' not in context:
        issues.append(f"AssetsDbContext mapping missing: {table}")

migrations = list(
    (ASSETS / "Persistence/Migrations").glob("*_Step19AssetsCore.cs")
)
if len(migrations) != 1:
    issues.append(f"expected one Step19AssetsCore migration, found {len(migrations)}")
else:
    migration = migrations[0].read_text()
    for line in migration.splitlines():
        if "principalSchema:" in line and '"assets"' not in line:
            issues.append("Step 19 migration introduces a cross-module foreign key")
            break

entities = (ASSETS / "Domain/AssetEntities.cs").read_text()
for marker in ("class Asset", "class AssetOwnershipHistory", "class OwnershipSubmission"):
    if marker not in entities:
        issues.append(f"Assets domain entity missing: {marker}")

seed = (ASSETS / "Infrastructure/AssetsDevelopmentSeed.cs").read_text()
for marker in ("AST-PC-000142", "AST-NB-000003", "AST-MON-000311"):
    if marker not in seed:
        issues.append(f"Assets development seed missing fixture: {marker}")

ledger = (ASSETS / "Infrastructure/AssetsLedgerWriter.cs").read_text()
for marker in ("audit.audit_records", "integration.outbox_messages", "'assets'"):
    if marker not in ledger:
        issues.append(f"Assets ledger boundary missing: {marker}")

project = (ASSETS / "INNO.One.Modules.Assets.csproj").read_text()
if 'FrameworkReference Include="Microsoft.AspNetCore.App"' not in project:
    issues.append("Assets module must reference ASP.NET Core framework")
for forbidden in ("Modules/Platform", "Modules\\Platform", "Modules/Devices", "Modules\\Devices"):
    if forbidden in project:
        issues.append(f"Assets project directly references another module: {forbidden}")

assets_source = "\n".join(
    path.read_text()
    for path in ASSETS.rglob("*.cs")
    if "/obj/" not in str(path) and "/bin/" not in str(path)
)
for forbidden in ("INNO.One.Modules.Platform", "INNO.One.Modules.Devices"):
    if forbidden in assets_source:
        issues.append(f"Assets directly imports another module: {forbidden}")
for allowed in ("IPlatformDirectoryReader", "IDeviceDirectoryReader"):
    if allowed not in api:
        issues.append(f"Assets missing shared directory contract read: {allowed}")

program = (
    PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs"
).read_text()
for marker in (
    "MapAssetsEndpoints()",
    "GetRequiredService<AssetsDbContext>()",
    "AssetsDevelopmentSeed.SeedAsync",
):
    if marker not in program:
        issues.append(f"Platform composition missing Step 19 marker: {marker}")

platform_seed = (
    PROD
    / "services/platform-api/src/Modules/Platform/Infrastructure/"
    / "PlatformDevelopmentSeed.cs"
).read_text()
for marker in ('"assets.view"', '"assets.manage"', 'AppId = "assets"'):
    if marker not in platform_seed:
        issues.append(f"Platform seed missing Assets marker: {marker}")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
for route in (
    'path="assets"',
    'path="assets/inventory"',
    'path="assets/:assetId"',
    'path="assets/ownership"',
    'path="assets/owners"',
    'path="assets/owners/:userId"',
    'path="assets/ownership/submissions"',
):
    if route not in app_root:
        issues.append(f"AppRoot missing Step 19 route: {route}")

app_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
for nav in (
    'to="/assets"',
    'to="/assets/inventory"',
    'to="/assets/ownership"',
    'to="/assets/owners"',
    'to="/assets/ownership/submissions"',
):
    if nav not in app_shell:
        issues.append(f"AppShell missing Assets navigation: {nav}")

for page in (
    "AssetsOverviewPage.tsx",
    "AssetInventoryPage.tsx",
    "AssetDetailPage.tsx",
    "AssetOwnershipPage.tsx",
    "AssetOwnersPage.tsx",
    "AssetOwnerDetailPage.tsx",
    "AssetOwnershipSubmissionsPage.tsx",
):
    if not (PROD / "apps/web-portal/src/pages" / page).exists():
        issues.append(f"Step 19 page missing: {page}")

client = (PROD / "apps/web-portal/src/api/client.ts").read_text()
for fn in (
    "getAssetOverview",
    "getAssets",
    "getAsset",
    "updateAsset",
    "getAssetOwnership",
    "changeAssetOwnership",
    "getAssetOwners",
    "getAssetOwner",
    "getOwnershipSubmissions",
    "decideOwnershipSubmission",
):
    if f"function {fn}" not in client:
        issues.append(f"Web API client missing: {fn}")

doc = (ROOT / "INNO-One-Step19-Assets-Core.md").read_text()
for deferred in (
    "Custom Fields",
    "QR label",
    "Software baselines",
    "Software licenses",
    "Contracts / Warranty",
    "Android Assets Mobile",
):
    if deferred not in doc:
        issues.append(f"Step 19 documentation missing deferred boundary: {deferred}")

print(f"step19_contract_version={manifest.get('contractVersion')}")
print(f"operations={len(operations)}")
print(f"web_routes={len(routes)}")
print(f"assets_tables={len(tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
