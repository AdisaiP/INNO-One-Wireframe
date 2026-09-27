#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
ASSETS = PROD / "services/platform-api/src/Modules/Assets"
PLATFORM = PROD / "services/platform-api/src/Modules/Platform"
issues = []

manifest = json.loads((ROOT / "inno-step22-software-licenses.json").read_text())
implementation = json.loads((ROOT / "inno-implementation-contract.json").read_text())

operations = ["assets.licenses.list", "assets.licenses.update"]
routes = ["/assets/software-licenses"]
tables = ["assets.software_licenses", "assets.license_allocations"]

if manifest.get("contractVersion") != "0.13.0":
    issues.append("Step 22 manifest must be version 0.13.0")
if implementation.get("contractVersion") != "0.16.0":
    issues.append("Implementation Contract must be version 0.16.0")
if manifest.get("operations") != operations:
    issues.append("Step 22 operation catalog mismatch")
if manifest.get("webRoutes") != routes:
    issues.append("Step 22 route catalog mismatch")
if manifest.get("persistence", {}).get("newTables") != tables:
    issues.append("Step 22 persistence catalog mismatch")
if manifest.get("persistence", {}).get("crossModuleForeignKeys") is not False:
    issues.append("Step 22 must forbid cross-module database foreign keys")
if manifest.get("activeEvents") != ["license.overused"]:
    issues.append("Step 22 active event catalog mismatch")
if manifest.get("auditActions") != ["assets.license.updated"]:
    issues.append("Step 22 audit action catalog mismatch")
if manifest.get("deferredStep16Revalidation") is not True:
    issues.append("Step 16 fresh re-validation must remain deferred")

slice_ref = implementation.get("assetSoftwareLicensesSlice", {})
if slice_ref.get("version") != "0.13.0":
    issues.append("Implementation Contract missing Step 22 version 0.13.0")
if slice_ref.get("implementedOperations") != operations:
    issues.append("Implementation Contract Step 22 operations mismatch")
if slice_ref.get("webRoutes") != routes:
    issues.append("Implementation Contract Step 22 route mismatch")
if slice_ref.get("persistence") != ["software_licenses", "license_allocations"]:
    issues.append("Implementation Contract Step 22 persistence mismatch")
if slice_ref.get("activeEvents") != ["license.overused"]:
    issues.append("Implementation Contract Step 22 event mismatch")
if slice_ref.get("featureImplementationStarted") is not True:
    issues.append("Implementation Contract must mark Step 22 started")

for ref in (
    "INNO-One-Step22-Software-Licenses.md",
    "inno-step22-software-licenses.json",
    "step22-software-licenses-audit.py",
    "production/scripts/step22-local-smoke.py",
):
    if not (ROOT / ref).exists():
        issues.append(f"missing Step 22 source-of-truth file: {ref}")

api_path = ASSETS / "Api/SoftwareLicenseEndpoints.cs"
if not api_path.exists():
    issues.append("SoftwareLicenseEndpoints.cs missing")
    api = ""
else:
    api = api_path.read_text()

for operation in operations:
    if f'.WithName("{operation}")' not in api:
        issues.append(f"Software License API operation marker missing: {operation}")
for marker in (
    '"/assets/software-licenses"',
    '"/assets/software-licenses/{licenseId}"',
    '"assets.license.manage"',
    '"assets.license.updated"',
    '"license.overused"',
    "ValidateIfMatch",
    "StatusCodes.Status412PreconditionFailed",
    'classification: "internal"',
    "EstimatedGapCost",
    "usedSeats > license.EntitledSeats",
):
    if marker not in api:
        issues.append(f"Software License API boundary missing: {marker}")

context = (ASSETS / "Persistence/AssetsDbContext.cs").read_text()
for table in ("software_licenses", "license_allocations"):
    if f'ToTable("{table}")' not in context:
        issues.append(f"AssetsDbContext mapping missing: {table}")

entities = (ASSETS / "Domain/AssetEntities.cs").read_text()
for marker in ("class SoftwareLicense", "class LicenseAllocation", "SeatCount"):
    if marker not in entities:
        issues.append(f"Software License entity marker missing: {marker}")

migration_files = list(
    (ASSETS / "Persistence/Migrations").glob("*_Step22SoftwareLicenses.cs")
)
if len(migration_files) != 1:
    issues.append(
        f"expected one Step22SoftwareLicenses migration, found {len(migration_files)}"
    )
else:
    migration = migration_files[0].read_text()
    for table in ("software_licenses", "license_allocations"):
        if f'name: "{table}"' not in migration:
            issues.append(f"Step 22 migration missing table: {table}")
    if "seat_count" not in migration:
        issues.append("Step 22 migration missing allocation seat_count")
    for line in migration.splitlines():
        if "principalSchema:" in line and '"assets"' not in line:
            issues.append("Step 22 migration introduces a cross-module foreign key")
            break

seed = (ASSETS / "Infrastructure/AssetsDevelopmentSeed.cs").read_text()
for marker in (
    "EnsureSoftwareLicensesAsync",
    '"Microsoft 365 Apps"',
    '"Adobe Acrobat Pro"',
    '"AutoCAD"',
    '"Endpoint Protection"',
):
    if marker not in seed:
        issues.append(f"Software License development seed missing: {marker}")

platform_seed = (
    PLATFORM / "Infrastructure/PlatformDevelopmentSeed.cs"
).read_text()
for marker in (
    '("assets.license.manage", "assets"',
    "Step22Permissions",
    "EnsureStep16To23Async",
):
    if marker not in platform_seed:
        issues.append(f"Platform permission seed missing: {marker}")

program = (
    PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs"
).read_text()
if "MapSoftwareLicenseEndpoints()" not in program:
    issues.append("Platform API composition missing Software License endpoints")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
app_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
page_path = PROD / "apps/web-portal/src/pages/SoftwareLicensesPage.tsx"
if 'path="assets/software-licenses"' not in app_root:
    issues.append("AppRoot missing /assets/software-licenses")
if 'to="/assets/software-licenses"' not in app_shell:
    issues.append("AppShell missing Software Licenses navigation")
if "/assets/software-baselines" in app_root:
    issues.append("Step 22 must not invent an unfrozen Software Baselines route")
if not page_path.exists():
    issues.append("SoftwareLicensesPage.tsx missing")
else:
    page = page_path.read_text()
    for marker in (
        "Software Licenses",
        "Purchased seats",
        "Estimated gap cost",
        "Compliance: All",
        "Vendor: All",
        "Installed endpoints & recent usage",
        "License record",
        "Save License",
        "getSoftwareLicenses",
        "updateSoftwareLicense",
    ):
        if marker not in page:
            issues.append(f"Software Licenses UX missing: {marker}")

client = (PROD / "apps/web-portal/src/api/client.ts").read_text()
types = (PROD / "apps/web-portal/src/api/types.ts").read_text()
for fn in ("getSoftwareLicenses", "updateSoftwareLicense"):
    if f"function {fn}" not in client:
        issues.append(f"Web API client missing: {fn}")
for marker in (
    "SoftwareLicenseItem",
    "SoftwareLicenseAllocation",
    "SoftwareLicenseSummary",
    "SoftwareLicenseListResponse",
):
    if marker not in types:
        issues.append(f"Web Software License type missing: {marker}")

doc = (ROOT / "INNO-One-Step22-Software-Licenses.md").read_text().lower()
for marker in (
    "purchased seats",
    "license.overused",
    "assets.license.updated",
    "etag / if-match",
    "no cross-module database foreign key",
    "no standalone software baseline api operation",
):
    if marker not in doc:
        issues.append(f"Step 22 documentation boundary missing: {marker}")

print(f"step22_contract_version={manifest.get('contractVersion')}")
print(f"operations={len(operations)}")
print(f"web_routes={len(routes)}")
print(f"new_assets_tables={len(tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
