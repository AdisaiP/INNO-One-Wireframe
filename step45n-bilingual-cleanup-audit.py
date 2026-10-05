from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parent
PROD = ROOT / "production"
WEB = PROD / "apps/web-portal/src"
LOCALES = PROD / "packages/i18n/src/locales"
issues = []
checks = 0

def check(condition, message):
    global checks
    checks += 1
    if not condition:
        issues.append(message)

def read(path):
    return path.read_text(encoding="utf-8")

manifest = json.loads(read(PROD / "module-manifests.json"))
module_ids = {m["id"] for m in manifest["modules"]}
check("workflows" not in module_ids, "Standalone workflows Product module remains in module-manifests.json")

workflow_endpoints = read(PROD / "services/platform-api/src/Modules/Workflows/Api/WorkflowEndpoints.cs")
check('MapGet("/workflows"' not in workflow_endpoints, "Generic GET /workflows API remains")
check('MapPost("/workflows"' not in workflow_endpoints, "Generic POST /workflows API remains")
check('"workflows.view"' not in workflow_endpoints and '"workflows.manage"' not in workflow_endpoints,
      "Generic workflow permissions remain in WorkflowEndpoints")

workflow_entities = read(PROD / "services/platform-api/src/Modules/Workflows/Domain/WorkflowEntities.cs")
workflow_db = read(PROD / "services/platform-api/src/Modules/Workflows/Persistence/WorkflowsDbContext.cs")
check('legacy_unassigned' not in workflow_entities, "Workflow domain still defaults owner to legacy_unassigned")
check('HasDefaultValue("legacy_unassigned")' not in workflow_db, "Workflow EF model still defaults owner to legacy_unassigned")

web_client = read(WEB / "api/client.ts")
check("getWorkflowDefinitions" not in web_client, "Generic workflow Web client remains")
check("'/workflows" not in web_client and '"/workflows' not in web_client, "Generic workflow Web API path remains")

notification_entity = read(PROD / "services/platform-api/src/Modules/Platform/Domain/PlatformEntities.cs")
notification_api = read(PROD / "services/platform-api/src/Modules/Platform/Api/PlatformNotificationEndpoints.cs")
notification_page = read(WEB / "pages/NotificationsPage.tsx")
notification_types = read(WEB / "api/types.ts")
check("TitleEn" in notification_entity and "TitleTh" in notification_entity,
      "Durable notification title is not bilingual")
check("MessageEn" in notification_entity and "MessageTh" in notification_entity,
      "Durable notification message is not bilingual")
check("ResolveLocaleAsync" in notification_api and "ContentLocale" in notification_api,
      "Notification API does not resolve effective locale/content locale")
check("contentLocale" in notification_types, "Web notification contract lacks contentLocale")
check("lang={contentLang}" in notification_page,
      "Notification localized content does not declare its content language")

# Translation catalogs must be structurally symmetric.
locale_files = sorted(p.name for p in (LOCALES / "en-US").glob("*.json"))
check(locale_files == sorted(p.name for p in (LOCALES / "th-TH").glob("*.json")),
      "EN/TH locale file sets differ")
translation_key_count = 0
for filename in locale_files:
    en = json.loads(read(LOCALES / "en-US" / filename))
    th = json.loads(read(LOCALES / "th-TH" / filename))
    translation_key_count += len(en)
    check(set(en) == set(th), f"Locale keys differ: {filename}")
    for key, value in en.items():
        check(isinstance(value, str) and value.strip(), f"Empty EN translation: {key}")
        check(isinstance(th.get(key), str) and th[key].strip(), f"Empty TH translation: {key}")

# Active Product pages should consume runtime i18n. Internal Design System is a developer reference.
pages = sorted((WEB / "pages").glob("*.tsx"))
excluded_pages = {
    "InternalDesignSystemPage.tsx",
}
for page in pages:
    if page.name in excluded_pages:
        continue
    source = read(page)
    check("useI18n" in source, f"Page does not consume runtime i18n: {page.name}")

# Use the TypeScript AST copy scanner instead of regex so ternary/operator syntax is never
# misclassified as visible Product copy.
copy_scan = subprocess.run(
    ["node", str(PROD / "scripts/step45n-copy-scan.cjs")],
    cwd=PROD,
    capture_output=True,
    text=True,
)
check(copy_scan.returncode == 0, "Step45N AST copy scanner failed")
unique_match = re.search(r"unique=(\d+)", copy_scan.stdout)
occurrence_match = re.search(r"occurrences=(\d+)", copy_scan.stdout)
raw_copy_unique = int(unique_match.group(1)) if unique_match else -1
raw_copy_occurrences = int(occurrence_match.group(1)) if occurrence_match else -1
check(raw_copy_unique == 0, f"Raw Product copy remains in TSX: {raw_copy_unique} unique")
check(raw_copy_occurrences == 0, f"Raw Product copy occurrences remain in TSX: {raw_copy_occurrences}")

print(f"step45n_checks={checks}")
print(f"step45n_translation_keys={translation_key_count}")
print(f"step45n_raw_copy_offenders={raw_copy_occurrences}")
print(f"step45n_failures={len(issues)}")
for issue in issues[:400]:
    print("FAIL:", issue)
if len(issues) > 400:
    print(f"... {len(issues)-400} more issues")
raise SystemExit(1 if issues else 0)
