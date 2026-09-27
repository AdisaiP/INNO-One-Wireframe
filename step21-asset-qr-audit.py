#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
ASSETS = PROD / "services/platform-api/src/Modules/Assets"
PLATFORM = PROD / "services/platform-api/src/Modules/Platform"
issues = []

manifest = json.loads((ROOT / "inno-step21-asset-qr.json").read_text())
implementation = json.loads((ROOT / "inno-implementation-contract.json").read_text())

operations = ["assets.qr_label.create", "assets.qr_resolve"]
routes = ["/assets/qr-labels"]
tables = ["assets.qr_labels", "assets.qr_scans"]

if manifest.get("contractVersion") != "0.12.0":
    issues.append("Step 21 manifest must be version 0.12.0")
if implementation.get("contractVersion") != "0.16.0":
    issues.append("Implementation Contract must be version 0.16.0")
if manifest.get("operations") != operations:
    issues.append("Step 21 operation catalog mismatch")
if manifest.get("webRoutes") != routes:
    issues.append("Step 21 route catalog mismatch")
if manifest.get("persistence", {}).get("newTables") != tables:
    issues.append("Step 21 persistence catalog mismatch")
if manifest.get("persistence", {}).get("crossModuleForeignKeys") is not False:
    issues.append("Step 21 must forbid cross-module database foreign keys")
if manifest.get("deferredStep16Revalidation") is not True:
    issues.append("Step 16 fresh re-validation must remain deferred")

slice_ref = implementation.get("assetQrSlice", {})
if slice_ref.get("version") != "0.12.0":
    issues.append("Implementation Contract missing Step 21 version 0.12.0")
if slice_ref.get("implementedOperations") != operations:
    issues.append("Implementation Contract Step 21 operations mismatch")
if slice_ref.get("webRoutes") != routes:
    issues.append("Implementation Contract Step 21 route mismatch")
if slice_ref.get("featureImplementationStarted") is not True:
    issues.append("Implementation Contract must mark Step 21 started")

for ref in (
    "INNO-One-Step21-Asset-QR.md",
    "inno-step21-asset-qr.json",
    "step21-asset-qr-audit.py",
    "production/scripts/step21-local-smoke.py",
):
    if not (ROOT / ref).exists():
        issues.append(f"missing Step 21 source-of-truth file: {ref}")

api = (ASSETS / "Api/AssetsQrEndpoints.cs").read_text()
for operation in operations:
    if f'.WithName("{operation}")' not in api:
        issues.append(f"QR API operation marker missing: {operation}")
for marker in (
    '"/assets/{assetId}/qr-label"',
    '"/assets/qr/resolve"',
    '"assets.qr.print"',
    '"assets.qr.scan"',
    '"assets.qr.generated"',
    '"assets.qr.scanned"',
    'RandomNumberGenerator.GetBytes(32)',
    'SHA256.HashData',
    'TokenPrefix = "inno1_qr_"',
    'previous.Status = "revoked"',
    'classification: "internal"',
):
    if marker not in api:
        issues.append(f"QR security/API marker missing: {marker}")

if "QrValue" not in api:
    issues.append("QR generation response must return the raw token once")
if "TokenFingerprint = Fingerprint(token)" not in api:
    issues.append("QR labels must persist a fingerprint rather than the raw token")
if "token," in api.split("AppendAuditAsync", 1)[-1].split("CommitAsync", 1)[0]:
    issues.append("raw QR token appears inside generation audit block")

context = (ASSETS / "Persistence/AssetsDbContext.cs").read_text()
for table in ("qr_labels", "qr_scans"):
    if f'ToTable("{table}")' not in context:
        issues.append(f"AssetsDbContext mapping missing: {table}")
if "TokenFingerprint" not in context:
    issues.append("QR fingerprint uniqueness mapping missing")

entities = (ASSETS / "Domain/AssetEntities.cs").read_text()
for marker in ("class AssetQrLabel", "class AssetQrScan"):
    if marker not in entities:
        issues.append(f"QR entity missing: {marker}")

migration_files = list(
    (ASSETS / "Persistence/Migrations").glob("*_Step21AssetQr.cs")
)
if len(migration_files) != 1:
    issues.append(f"expected one Step21AssetQr migration, found {len(migration_files)}")
else:
    migration = migration_files[0].read_text()
    for table in ("qr_labels", "qr_scans"):
        if f'name: "{table}"' not in migration:
            issues.append(f"Step 21 migration missing table: {table}")
    for line in migration.splitlines():
        if "principalSchema:" in line and '"assets"' not in line:
            issues.append("Step 21 migration introduces a cross-module foreign key")
            break

seed = (PLATFORM / "Infrastructure/PlatformDevelopmentSeed.cs").read_text()
for marker in (
    '("assets.qr.print", "assets"',
    '("assets.qr.scan", "assets"',
    "Step21Permissions",
    "EnsureStep16To23Async",
):
    if marker not in seed:
        issues.append(f"Platform permission seed missing: {marker}")

program = (
    PROD / "services/platform-api/src/INNO.One.PlatformApi/Program.cs"
).read_text()
if "MapAssetsQrEndpoints()" not in program:
    issues.append("Platform API composition missing QR endpoints")

app_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
app_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
page_path = PROD / "apps/web-portal/src/pages/AssetQrLabelsPage.tsx"
if 'path="assets/qr-labels"' not in app_root:
    issues.append("AppRoot missing /assets/qr-labels")
if 'to="/assets/qr-labels"' not in app_shell:
    issues.append("AppShell missing QR Labels navigation")
if "/asset-mobile" in app_root or "AssetMobile" in app_root:
    issues.append("Android scanner must not be exposed as normal Web navigation")
if not page_path.exists():
    issues.append("AssetQrLabelsPage.tsx missing")
else:
    page = page_path.read_text()
    for marker in (
        "Select assets",
        "Label setup",
        "Print preview",
        "Print Selected",
        "QRCode.toDataURL",
        "createAssetQrLabel",
        "window.print()",
        "Opaque token",
        "Authenticated lookup",
        "Audited scan",
    ):
        if marker not in page:
            issues.append(f"QR Labels UX missing: {marker}")

client = (PROD / "apps/web-portal/src/api/client.ts").read_text()
types = (PROD / "apps/web-portal/src/api/types.ts").read_text()
for fn in ("createAssetQrLabel", "resolveAssetQr"):
    if f"function {fn}" not in client:
        issues.append(f"Web API client missing: {fn}")
for marker in ("AssetQrLabel", "AssetQrResolvedAsset"):
    if marker not in types:
        issues.append(f"Web QR type missing: {marker}")

package = json.loads((PROD / "apps/web-portal/package.json").read_text())
if "qrcode" not in package.get("dependencies", {}):
    issues.append("Web QR page must use a real QR encoder dependency")

doc = (ROOT / "INNO-One-Step21-Asset-QR.md").read_text().lower()
for marker in (
    "opaque 256-bit",
    "sha-256 token fingerprint",
    "raw qr token",
    "regenerating a label revokes",
    "android scanning remains a separate surface",
    "no cross-module database foreign key",
):
    if marker not in doc:
        issues.append(f"Step 21 documentation boundary missing: {marker}")

print(f"step21_contract_version={manifest.get('contractVersion')}")
print(f"operations={len(operations)}")
print(f"web_routes={len(routes)}")
print(f"new_assets_tables={len(tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
