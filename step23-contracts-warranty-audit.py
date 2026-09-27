#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
ASSETS = PROD / "services/platform-api/src/Modules/Assets"
PLATFORM = PROD / "services/platform-api/src/Modules/Platform"
issues = []

manifest = json.loads((ROOT / "inno-step23-contracts-warranty.json").read_text())
implementation = json.loads((ROOT / "inno-implementation-contract.json").read_text())

operations = ["assets.contracts.list", "assets.contracts.update"]
routes = ["/assets/contracts"]
tables = ["assets.contracts", "assets.asset_contract_links"]

if manifest.get("contractVersion") != "0.14.0":
    issues.append("Step 23 manifest must be version 0.14.0")
if implementation.get("contractVersion") != "0.16.0":
    issues.append("Implementation Contract must be version 0.16.0")
if manifest.get("operations") != operations:
    issues.append("Step 23 operation catalog mismatch")
if manifest.get("webRoutes") != routes:
    issues.append("Step 23 route catalog mismatch")
if manifest.get("persistence", {}).get("newTables") != tables:
    issues.append("Step 23 persistence catalog mismatch")
if manifest.get("persistence", {}).get("crossModuleForeignKeys") is not False:
    issues.append("Step 23 must forbid cross-module database foreign keys")
if manifest.get("activeEvents") != ["contract.expiring"]:
    issues.append("Step 23 active event catalog mismatch")
if manifest.get("auditActions") != ["assets.contract.updated"]:
    issues.append("Step 23 audit action catalog mismatch")

slice_ref = implementation.get("assetContractsWarrantySlice", {})
if slice_ref.get("version") != "0.14.0":
    issues.append("Implementation Contract missing Step 23 slice")
if slice_ref.get("implementedOperations") != operations:
    issues.append("Implementation Contract Step 23 operations mismatch")
if slice_ref.get("webRoutes") != routes:
    issues.append("Implementation Contract Step 23 route mismatch")
if slice_ref.get("activeEvents") != ["contract.expiring"]:
    issues.append("Implementation Contract Step 23 event mismatch")

for ref in (
    "INNO-One-Step23-Contracts-Warranty.md",
    "inno-step23-contracts-warranty.json",
    "step23-contracts-warranty-audit.py",
    "production/scripts/step23-local-smoke.py",
):
    if not (ROOT / ref).exists():
        issues.append(f"missing Step 23 source-of-truth file: {ref}")

api_path = ASSETS / "Api/ContractsWarrantyEndpoints.cs"
api = api_path.read_text() if api_path.exists() else ""
for marker in (
    '.WithName("assets.contracts.list")',
    '.WithName("assets.contracts.update")',
    '"/assets/contracts"',
    '"/assets/contracts/{contractId}"',
    '"assets.view"',
    '"assets.contract.manage"',
    '"assets.contract.updated"',
    '"contract.expiring"',
    "ValidateIfMatch",
    "StatusCodes.Status412PreconditionFailed",
    'classification: "internal"',
    '"expiring"',
    "CanAccessAsset",
):
    if marker not in api:
        issues.append(f"Contracts API boundary missing: {marker}")

context = (ASSETS / "Persistence/AssetsDbContext.cs").read_text()
for table in ("contracts", "asset_contract_links"):
    if f'ToTable("{table}")' not in context:
        issues.append(f"AssetsDbContext mapping missing: {table}")

entities = (ASSETS / "Domain/AssetEntities.cs").read_text()
for marker in ("class AssetContract", "class AssetContractLink"):
    if marker not in entities:
        issues.append(f"Contract entity missing: {marker}")

migrations = list((ASSETS / "Persistence/Migrations").glob("*_Step23ContractsWarranty.cs"))
if len(migrations) != 1:
    issues.append(f"expected one Step23ContractsWarranty migration, found {len(migrations)}")
else:
    migration = migrations[0].read_text()
    for table in ("contracts", "asset_contract_links"):
        if f'name: "{table}"' not in migration:
            issues.append(f"Step 23 migration missing table: {table}")
    for line in migration.splitlines():
        if "principalSchema:" in line and '"assets"' not in line:
            issues.append("Step 23 migration introduces a cross-module foreign key")
            break

asset_seed = (ASSETS / "Infrastructure/AssetsDevelopmentSeed.cs").read_text()
for marker in (
    "EnsureContractsAsync",
    '"CTR-2568-IT-014"',
    '"CTR-2567-NB-006"',
    '"CTR-2566-PRN-002"',
):
    if marker not in asset_seed:
        issues.append(f"Contract seed missing: {marker}")

platform_seed = (PLATFORM / "Infrastructure/PlatformDevelopmentSeed.cs").read_text()
for marker in (
    '("assets.contract.manage", "assets"',
    "Step23Permissions",
    "EnsureStep16To23Async",
):
    if marker not in platform_seed:
        issues.append(f"Platform permission seed missing: {marker}")

program = (PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs").read_text()
if "MapContractsWarrantyEndpoints()" not in program:
    issues.append("Platform API composition missing Contracts endpoints")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
app_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
page_path = PROD / "apps/web-portal/src/pages/ContractsWarrantyPage.tsx"
if 'path="assets/contracts"' not in app_root:
    issues.append("AppRoot missing /assets/contracts")
if 'to="/assets/contracts"' not in app_shell:
    issues.append("AppShell missing Contracts & Warranty navigation")
if not page_path.exists():
    issues.append("ContractsWarrantyPage.tsx missing")
else:
    page = page_path.read_text()
    for marker in (
        "Contracts & Warranty",
        "Active contracts",
        "Expiring ≤ 90 days",
        "Covered assets",
        "Uncovered assets",
        "Status: All",
        "Fiscal year: All",
        "Contract record",
        "Save Contract",
        "getAssetContracts",
        "updateAssetContract",
    ):
        if marker not in page:
            issues.append(f"Contracts UX missing: {marker}")

client = (PROD / "apps/web-portal/src/api/client.ts").read_text()
types = (PROD / "apps/web-portal/src/api/types.ts").read_text()
for fn in ("getAssetContracts", "updateAssetContract"):
    if f"function {fn}" not in client:
        issues.append(f"Web Contracts API client missing: {fn}")
for marker in (
    "AssetContractItem",
    "AssetContractSummary",
    "AssetContractListResponse",
    "CoveredAssetContractItem",
):
    if marker not in types:
        issues.append(f"Web Contracts type missing: {marker}")

doc = (ROOT / "INNO-One-Step23-Contracts-Warranty.md").read_text().lower()
for marker in (
    "contract.expiring",
    "assets.contract.updated",
    "etag / if-match",
    "no cross-module database foreign key",
    "within 90 days",
):
    if marker not in doc:
        issues.append(f"Step 23 documentation boundary missing: {marker}")

print(f"step23_contract_version={manifest.get('contractVersion')}")
print(f"operations={len(operations)}")
print(f"web_routes={len(routes)}")
print(f"new_assets_tables={len(tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
