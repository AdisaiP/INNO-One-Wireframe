#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
APP = PROD / "apps/assets-mobile"
issues = []

manifest = json.loads((ROOT / "inno-step24-assets-mobile.json").read_text())
implementation = json.loads((ROOT / "inno-implementation-contract.json").read_text())
api_contract = json.loads((ROOT / "inno-api-contract.json").read_text())
realm = json.loads((PROD / "infrastructure/docker/keycloak/realm-inno-one.json").read_text())

if manifest.get("contractVersion") != "0.15.0":
    issues.append("Step 24 manifest must be version 0.15.0")
if implementation.get("contractVersion") != "0.17.0":
    issues.append("Implementation Contract must be version 0.17.0")
if manifest.get("surface") != "android-mobile":
    issues.append("Step 24 surface must be android-mobile")
if manifest.get("reusedOperations") != ["assets.qr_resolve"]:
    issues.append("Step 24 must reuse only assets.qr_resolve")
if manifest.get("newApiOperations") != []:
    issues.append("Step 24 must not invent a new API operation")
if manifest.get("newDatabaseTables") != []:
    issues.append("Step 24 must not create database tables")
if manifest.get("persistedQrTokens") is not False:
    issues.append("Step 24 must not persist QR tokens")

slice_ref = implementation.get("assetsMobileSlice", {})
for key, expected in (
    ("version", "0.15.0"),
    ("runtimeSurface", "android-mobile"),
    ("appPath", "production/apps/assets-mobile"),
    ("reusedOperations", ["assets.qr_resolve"]),
    ("permissions", ["assets.qr.scan"]),
    ("oidcClient", "inno-one-assets-mobile"),
    ("persistedQrTokens", False),
):
    if slice_ref.get(key) != expected:
        issues.append(f"Implementation Contract mobile slice mismatch: {key}")

resolve = next(
    (x for x in api_contract.get("endpoints", []) if x.get("id") == "assets.qr_resolve"),
    None,
)
if resolve is None:
    issues.append("Frozen assets.qr_resolve operation missing")
else:
    if resolve.get("path") != "/assets/qr/resolve":
        issues.append("Frozen QR resolve path changed")
    if resolve.get("permission") != "assets.qr.scan":
        issues.append("Frozen QR resolve permission changed")
    if "asset-mobile.html" not in resolve.get("screens", []):
        issues.append("Frozen QR resolve mobile surface mapping missing")

for rel in (
    "package.json",
    "app.json",
    "App.tsx",
    "src/api.ts",
    "src/config.ts",
    "src/history.ts",
    "src/types.ts",
    ".env.example",
    "README.md",
):
    if not (APP / rel).exists():
        issues.append(f"Mobile runtime file missing: {rel}")

if not (PROD / "scripts/step24-live-mobile-smoke.py").exists():
    issues.append("Step 24 live mobile smoke script missing")

package = json.loads((APP / "package.json").read_text())
if package.get("engines", {}).get("node") != ">=20.19.4":
    issues.append("Mobile Node engine must be >=20.19.4")
for dep in (
    "expo",
    "expo-auth-session",
    "expo-camera",
    "expo-secure-store",
    "expo-web-browser",
    "react-native",
):
    if dep not in package.get("dependencies", {}):
        issues.append(f"Mobile dependency missing: {dep}")

app_json = json.loads((APP / "app.json").read_text()).get("expo", {})
if app_json.get("scheme") != "innoone-assets":
    issues.append("Mobile OIDC scheme mismatch")
if app_json.get("android", {}).get("package") != "com.innovations.innoone.assets":
    issues.append("Android package mismatch")
if "CAMERA" not in app_json.get("android", {}).get("permissions", []):
    issues.append("Android CAMERA permission missing")

app = (APP / "App.tsx").read_text()
api = (APP / "src/api.ts").read_text()
history = (APP / "src/history.ts").read_text()
config = (APP / "src/config.ts").read_text()
for marker in (
    "useCameraPermissions",
    "CameraView",
    "barcodeTypes: ['qr']",
    "AuthSession.useAuthRequest",
    "ResponseType.Code",
    "usePKCE: true",
    "expo-secure-store",
    "สแกน Asset Label",
    "ประวัติการสแกน",
    "QR Code",
):
    if marker not in app and marker not in history:
        issues.append(f"Mobile runtime marker missing: {marker}")

if "/assets/qr/resolve" not in api:
    issues.append("Mobile API client must use frozen QR resolve operation")
if "Authorization: 'Bearer ' + accessToken" not in api:
    issues.append("Mobile API client bearer token missing")
if "token" in history.lower():
    issues.append("Local recent-scan persistence must not contain token fields")
if "inno-one-assets-mobile" not in config:
    issues.append("Mobile OIDC client id missing")

client = next(
    (x for x in realm.get("clients", []) if x.get("clientId") == "inno-one-assets-mobile"),
    None,
)
if client is None:
    issues.append("Keycloak mobile public client missing")
else:
    if client.get("publicClient") is not True:
        issues.append("Mobile OIDC client must be public")
    if client.get("standardFlowEnabled") is not True:
        issues.append("Mobile OIDC client standard flow must be enabled")
    if client.get("directAccessGrantsEnabled") is not False:
        issues.append("Mobile OIDC client direct grants must stay disabled")
    if client.get("attributes", {}).get("pkce.code.challenge.method") != "S256":
        issues.append("Mobile OIDC client PKCE S256 missing")

workspace = (PROD / "pnpm-workspace.yaml").read_text()
if "apps/assets-mobile" not in workspace:
    issues.append("Mobile app missing from pnpm workspace")

web_root = (PROD / "apps/web-portal/src/app/AppRoot.tsx").read_text()
web_shell = (PROD / "apps/web-portal/src/app/AppShell.tsx").read_text()
if "assets-mobile" in web_root or "assets-mobile" in web_shell:
    issues.append("Android Mobile must not be exposed as Web navigation")

doc = (ROOT / "INNO-One-Step24-Assets-Mobile.md").read_text().lower()
for marker in (
    "authorization code + pkce",
    "device-local",
    "never persisted",
    "no web portal route",
    "does not add an unfrozen scan-history api",
):
    if marker not in doc:
        issues.append(f"Step 24 documentation boundary missing: {marker}")

print(f"step24_contract_version={manifest.get('contractVersion')}")
print("surface=android-mobile")
print("reused_operations=1")
print("new_api_operations=0")
print("new_database_tables=0")
print(f"issues={len(issues)}")
for issue in issues:
    print("ISSUE: " + issue)
raise SystemExit(1 if issues else 0)
