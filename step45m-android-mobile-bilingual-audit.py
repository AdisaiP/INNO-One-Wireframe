from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent
APP = ROOT / "production/apps/assets-mobile"
checks = 0
failures = []

def check(condition, message):
    global checks
    checks += 1
    if not condition:
        failures.append(message)
        print("FAIL:", message)

def text(path):
    return path.read_text(encoding="utf-8")

app = text(APP / "App.tsx")
api = text(APP / "src/api.ts")
i18n = text(APP / "src/i18n.ts")
app_json = json.loads(text(APP / "app.json"))
readme = text(APP / "README.md")
handoff = text(ROOT / "INNO-One-Step45M-Next-Chat-Handoff.md")
contract = text(ROOT / "INNO-One-Language-Terminology-Contract.md")

check("implementation/step45m-android-mobile-bilingual" not in app, "Branch name leaked into runtime source")
check("export type Locale = 'th-TH' | 'en-US'" in i18n, "Mobile locale type is missing")
check("'th-TH': {" in i18n and "'en-US': {" in i18n, "Both Mobile locale catalogs are required")
check("deviceLocale()" in app, "Mobile boot does not use device locale fallback")
check("getMobileProfile" in app and "/platform/me" in api, "Mobile does not load profile locale")
check("locale: Locale" in api and "organizationDefaultLocale" in api, "Mobile profile locale contract is incomplete")
check("setMobilePreferredLocale" in app and "/platform/me/profile" in api, "Mobile language preference cannot be persisted")
check("preferredLocale: locale" in api, "Mobile locale write does not persist preferredLocale")
check("profile.locale" in app, "Mobile runtime does not apply effective locale")
check("formatDate(props.locale" in app, "Result dates are not locale-aware")
check("formatRelativeTime(props.locale" in app, "History relative times are not locale-aware")
check("offlineError" in i18n and "profileOffline" in i18n, "Offline/profile fallback copy is incomplete")
check("catch {" in api and "MobileApiError(0" in api, "Network failures are not mapped to Mobile offline errors")
check("resolveAssetQr(token, accessToken, locale)" in app, "Scanner does not pass active locale to QR error handling")
check("locale={locale}" in app, "Mobile screens are not receiving the active locale")
check("accessibilityLabel={tx('language')}" in app, "Language control lacks an accessible name")
check("accessibilityRole=\"button\"" in app, "Mobile controls lack native button semantics")
check("QR payloads are never written" in readme, "QR security boundary documentation regressed")
check("/assets/qr/resolve" in api, "Assets Mobile QR resolve boundary changed unexpectedly")
check("platform-shell" not in app.lower(), "Assets Mobile must not import Web Portal navigation")
check("MeshCentral" not in app and "MeshCentral" not in api, "Assets Mobile must not bypass Assets API through MeshCentral")
check("Android Mobile" in contract and "en-US" in contract and "th-TH" in contract, "Language contract no longer covers bilingual Mobile")
check("Android Mobile bilingual" in handoff, "Step45M handoff scope is missing")
check("ANDROID DEVICE VISUAL QA PENDING" in handoff, "Step45M handoff must preserve the Android visual QA gate")
check("cameraPermission" not in json.dumps(app_json, ensure_ascii=False), "Android camera plugin must not hard-code a fixed UI language")
thai_outside_catalog = re.search(r"[\u0E00-\u0E7F]", app + api)
check(thai_outside_catalog is None, "Hard-coded Thai UI copy remains outside the Mobile locale catalog")

th_block = i18n.split("'th-TH': {", 1)[1].split("},\n  'en-US': {", 1)[0]
en_block = i18n.split("'en-US': {", 1)[1].split("},\n} as const", 1)[0]
key_re = re.compile(r"^\s*([A-Za-z][A-Za-z0-9]*):", re.MULTILINE)
th_keys = set(key_re.findall(th_block))
en_keys = set(key_re.findall(en_block))
check(th_keys == en_keys, "Thai/English Mobile catalog keys differ")
check(len(th_keys) >= 60, "Mobile catalog is unexpectedly incomplete")

for key in (
    "signInTitle", "scannerTitle", "historyTitle", "assetOverview",
    "errorTitle", "offlineError", "profileSaveError", "headerSub",
):
    check(f"{key}:" in i18n, "Mobile translation key missing: " + key)

check("## Language runtime" in readme, "Assets Mobile README does not document runtime localization")
check("Step45M Android Mobile runtime override" in contract, "Language contract lacks Step45M Mobile override")

print(f"step45m_checks={checks}")
print(f"step45m_failures={len(failures)}")
if failures:
    raise SystemExit(1)
