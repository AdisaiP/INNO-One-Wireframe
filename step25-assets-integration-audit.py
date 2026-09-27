#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
issues = []

manifest = json.loads(
    (ROOT / "inno-step25-assets-final-integration.json").read_text()
)
implementation = json.loads(
    (ROOT / "inno-implementation-contract.json").read_text()
)

if manifest.get("contractVersion") != "0.16.0":
    issues.append("Step 25 manifest must be version 0.16.0")
if implementation.get("contractVersion") != "0.17.0":
    issues.append("Implementation Contract must be version 0.17.0")
if manifest.get("newApiOperations") != []:
    issues.append("Step 25 must not invent API operations")
if manifest.get("newDatabaseTables") != []:
    issues.append("Step 25 must not create database tables")
if manifest.get("crossModuleForeignKeys") is not False:
    issues.append("Step 25 must forbid cross-module database FKs")

slice_ref = implementation.get("assetsFinalIntegrationPass", {})
if slice_ref.get("version") != "0.16.0":
    issues.append("Implementation Contract missing Step 25 integration pass")
if slice_ref.get("newApiOperations") != []:
    issues.append("Implementation Contract Step 25 API delta must be empty")
if slice_ref.get("newDatabaseTables") != []:
    issues.append("Implementation Contract Step 25 DB delta must be empty")

required = [
    "INNO-One-Step25-Assets-Final-Integration.md",
    "inno-step25-assets-final-integration.json",
    "step25-assets-integration-audit.py",
    "production/scripts/step25-assets-integration-smoke.py",
]
for path in required:
    if not (ROOT / path).exists():
        issues.append("missing Step 25 source-of-truth file: " + path)

assets = (
    PROD / "services/platform-api/src/Modules/Assets/Api/AssetsEndpoints.cs"
).read_text()
qr = (
    PROD / "services/platform-api/src/Modules/Assets/Api/AssetsQrEndpoints.cs"
).read_text()
licenses = (
    PROD / "services/platform-api/src/Modules/Assets/Api/SoftwareLicenseEndpoints.cs"
).read_text()
contracts = (
    PROD / "services/platform-api/src/Modules/Assets/Api/ContractsWarrantyEndpoints.cs"
).read_text()
devices = (
    PROD / "services/platform-api/src/Modules/Devices/Api/DevicesEndpoints.cs"
).read_text()
helpdesk = (
    PROD / "services/platform-api/src/Modules/Helpdesk/Api/HelpdeskEndpoints.cs"
).read_text()

for marker, text in (
    ("device.AssetReference", devices),
    ("asset.LinkedDeviceId", assets),
    ("linkedDevice.Id", qr),
    ("x.AssetId.HasValue", licenses),
    ("OpaqueId.Format(\"asset\", asset.Id)", contracts),
    ("ticket.RelatedDeviceId", helpdesk),
):
    if marker not in text:
        issues.append("integration boundary missing: " + marker)

for operation in (
    "devices.get",
    "assets.get",
    "assets.qr_resolve",
    "assets.licenses.list",
    "assets.contracts.list",
    "helpdesk.tickets.get",
):
    contract = json.loads((ROOT / "inno-api-contract.json").read_text())
    if not any(x.get("id") == operation for x in contract.get("endpoints", [])):
        issues.append("frozen API operation missing: " + operation)

doc = (ROOT / "INNO-One-Step25-Assets-Final-Integration.md").read_text().lower()
for marker in (
    "devices endpoint",
    "helpdesk related device",
    "qr resolve",
    "software license allocation",
    "contract coverage",
    "no new api operation",
    "no cross-module database foreign key",
):
    if marker not in doc:
        issues.append("Step 25 documentation boundary missing: " + marker)

print("step25_contract_version=" + str(manifest.get("contractVersion")))
print("modules=3")
print("new_api_operations=0")
print("new_database_tables=0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)
raise SystemExit(1 if issues else 0)
