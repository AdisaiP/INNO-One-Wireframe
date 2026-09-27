#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
ASSETS = PROD / "services/platform-api/src/Modules/Assets"
issues = []

manifest = json.loads((ROOT / "inno-step20-asset-custom-fields.json").read_text())
implementation = json.loads((ROOT / "inno-implementation-contract.json").read_text())

operations = [
    "assets.custom_fields.list",
    "assets.custom_fields.update",
]
routes = ["/assets/custom-fields"]
tables = [
    "assets.custom_field_definitions",
    "assets.custom_field_values",
]

if manifest.get("contractVersion") != "0.11.0":
    issues.append("Step 20 manifest must be version 0.11.0")
if implementation.get("contractVersion") != "0.13.0":
    issues.append("Implementation Contract must be version 0.13.0")
if manifest.get("operations") != operations:
    issues.append("Step 20 operation catalog mismatch")
if manifest.get("webRoutes") != routes:
    issues.append("Step 20 route catalog mismatch")
if manifest.get("persistence", {}).get("newTables") != tables:
    issues.append("Step 20 persistence catalog mismatch")
if manifest.get("persistence", {}).get("crossModuleForeignKeys") is not False:
    issues.append("Step 20 must forbid cross-module database foreign keys")
if manifest.get("deferredStep16Revalidation") is not True:
    issues.append("Step 16 fresh re-validation must remain deferred")

slice_ref = implementation.get("assetCustomFieldsSlice", {})
if slice_ref.get("version") != "0.11.0":
    issues.append("Implementation Contract missing Step 20 version 0.11.0")
if slice_ref.get("implementedOperations") != operations:
    issues.append("Implementation Contract Step 20 operations mismatch")
if slice_ref.get("extendedOperations") != ["assets.get", "assets.update"]:
    issues.append("Step 20 must extend only assets.get/assets.update for values")
if slice_ref.get("webRoutes") != routes:
    issues.append("Implementation Contract Step 20 routes mismatch")
if slice_ref.get("featureImplementationStarted") is not True:
    issues.append("Implementation Contract must mark Step 20 started")

for ref in (
    "INNO-One-Step20-Asset-Custom-Fields.md",
    "inno-step20-asset-custom-fields.json",
    "step20-asset-custom-fields-audit.py",
    "production/scripts/step20-local-smoke.py",
):
    if not (ROOT / ref).exists():
        issues.append(f"missing Step 20 source-of-truth file: {ref}")

api = (ASSETS / "Api/AssetsCustomFieldEndpoints.cs").read_text()
for operation in operations:
    if f'.WithName("{operation}")' not in api:
        issues.append(f"custom-field API operation marker missing: {operation}")
for route in ('"/assets/custom-fields"',):
    if route not in api:
        issues.append(f"custom-field API route missing: {route}")
for marker in (
    '"assets.view"',
    '"assets.manage"',
    '"assets.custom_fields.updated"',
    'classification: "internal"',
    "FieldKeyPattern",
    "SupportedTypes",
    "Existing fields cannot be removed",
):
    if marker not in api:
        issues.append(f"custom-field API boundary missing: {marker}")

context = (ASSETS / "Persistence/AssetsDbContext.cs").read_text()
for table in ("custom_field_definitions", "custom_field_values"):
    if f'ToTable("{table}")' not in context:
        issues.append(f"AssetsDbContext mapping missing: {table}")

migration_files = list(
    (ASSETS / "Persistence/Migrations").glob("*_Step20AssetCustomFields.cs")
)
if len(migration_files) != 1:
    issues.append(f"expected one Step20AssetCustomFields migration, found {len(migration_files)}")
else:
    migration = migration_files[0].read_text()
    for table in ("custom_field_definitions", "custom_field_values"):
        if f'name: "{table}"' not in migration:
            issues.append(f"Step 20 migration missing table: {table}")
    for line in migration.splitlines():
        if "principalSchema:" in line and '"assets"' not in line:
            issues.append("Step 20 migration introduces a cross-module foreign key")
            break

entities = (ASSETS / "Domain/AssetEntities.cs").read_text()
for marker in (
    "class AssetCustomFieldDefinition",
    "class AssetCustomFieldValue",
):
    if marker not in entities:
        issues.append(f"custom-field entity missing: {marker}")

value_service = (
    ASSETS / "Infrastructure/AssetCustomFieldValueService.cs"
).read_text()
for marker in (
    "ReadForAssetAsync",
    "ApplyAsync",
    "This field is required.",
    "Select one of the configured options.",
):
    if marker not in value_service:
        issues.append(f"custom-field value service missing: {marker}")

seed = (ASSETS / "Infrastructure/AssetsDevelopmentSeed.cs").read_text()
for marker in (
    "EnsureCustomFieldsAsync",
    '"cost_center"',
    '"office_zone"',
    '"asset_criticality"',
    '"maintenance_note"',
):
    if marker not in seed:
        issues.append(f"Step 20 seed fixture missing: {marker}")

module = (ASSETS / "AssetsModule.cs").read_text()
if "AddScoped<AssetCustomFieldValueService>()" not in module:
    issues.append("Assets module must register AssetCustomFieldValueService")

asset_api = (ASSETS / "Api/AssetsEndpoints.cs").read_text()
for marker in (
    "AssetCustomFieldValueService customFieldService",
    "request.CustomFields",
    "customFieldService.ReadForAssetAsync",
    "customFieldService.ApplyAsync",
    "IReadOnlyDictionary<string, JsonElement>? CustomFields",
    "IReadOnlyList<AssetCustomFieldResponse> CustomFields",
):
    if marker not in asset_api:
        issues.append(f"Asset detail/update custom-field integration missing: {marker}")

ledger = (ASSETS / "Infrastructure/AssetsLedgerWriter.cs").read_text()
if 'string classification = "restricted"' not in ledger:
    issues.append("Assets ledger must support contract audit classification")

project = (ASSETS / "INNO.One.Modules.Assets.csproj").read_text()
for forbidden in ("Modules/Platform", "Modules\\Platform", "Modules/Devices", "Modules\\Devices"):
    if forbidden in project:
        issues.append(f"Assets project directly references another module: {forbidden}")

program = (
    PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs"
).read_text()
if "MapAssetsCustomFieldEndpoints()" not in program:
    issues.append("Platform API composition missing custom-field endpoints")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
app_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
if 'path="assets/custom-fields"' not in app_root:
    issues.append("AppRoot missing /assets/custom-fields")
if 'to="/assets/custom-fields"' not in app_shell:
    issues.append("AppShell missing Custom Fields navigation")
if not (PROD / "apps/web-portal/src/pages/AssetCustomFieldsPage.tsx").exists():
    issues.append("AssetCustomFieldsPage.tsx missing")

client = (PROD / "apps/web-portal/src/api/client.ts").read_text()
types = (PROD / "apps/web-portal/src/api/types.ts").read_text()
detail = (PROD / "apps/web-portal/src/pages/AssetDetailPage.tsx").read_text()
for fn in ("getAssetCustomFields", "updateAssetCustomFields"):
    if f"function {fn}" not in client:
        issues.append(f"Web API client missing: {fn}")
for marker in ("AssetCustomFieldDefinition", "AssetCustomFieldSchema", "customFields: AssetCustomFieldValue[]"):
    if marker not in types:
        issues.append(f"Web type missing: {marker}")
for marker in ("Custom fields", "customPayload", "customErrors", 'to="/assets/custom-fields"'):
    if marker not in detail:
        issues.append(f"Asset Detail custom-field UX missing: {marker}")

doc = (ROOT / "INNO-One-Step20-Asset-Custom-Fields.md").read_text()
doc_lower = doc.lower()
for marker in (
    "platform user profiles are read-only",
    "endpoint agent",
    "android mobile",
    "qr",
    "software",
    "contracts/warranty",
):
    if marker not in doc_lower:
        issues.append(f"Step 20 documentation boundary missing: {marker}")

print(f"step20_contract_version={manifest.get('contractVersion')}")
print(f"operations={len(operations)}")
print(f"web_routes={len(routes)}")
print(f"new_assets_tables={len(tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
