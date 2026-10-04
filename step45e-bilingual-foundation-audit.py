from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parent
failures: list[str] = []
checks = 0

def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        failures.append(message)

def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")

def json_file(path: str) -> dict[str, str]:
    return json.loads(text(path))

locale_root = ROOT / "production/packages/i18n/src/locales"
catalog_files = ["common.json", "navigation.json", "feedback.json", "profile.json", "admin.json"]

check((ROOT / "production/packages/i18n/package.json").exists(), "@inno/i18n package is missing")
check((ROOT / "production/packages/i18n/src/index.tsx").exists(), "i18n runtime entrypoint is missing")

for filename in catalog_files:
    en_path = locale_root / "en-US" / filename
    th_path = locale_root / "th-TH" / filename
    check(en_path.exists(), f"en-US/{filename} is missing")
    check(th_path.exists(), f"th-TH/{filename} is missing")
    if not en_path.exists() or not th_path.exists():
        continue
    en = json.loads(en_path.read_text(encoding="utf-8-sig"))
    th = json.loads(th_path.read_text(encoding="utf-8-sig"))
    check(set(en) == set(th), f"translation key parity failed for {filename}")
    check(all(isinstance(value, str) and value.strip() for value in en.values()), f"blank en-US value in {filename}")
    check(all(isinstance(value, str) and value.strip() for value in th.values()), f"blank th-TH value in {filename}")

runtime = text("production/packages/i18n/src/index.tsx")
for expected in [
    "SUPPORTED_LOCALES = ['en-US', 'th-TH']",
    "export function normalizeLocale",
    "export function detectBrowserLocale",
    "export function resolveLocale",
    "export function formatDateTime",
    "th-TH-u-ca-gregory-nu-latn",
    "document.documentElement.lang",
    "export function I18nProvider",
    "export function useI18n",
]:
    check(expected in runtime, f"i18n runtime contract missing: {expected}")

package = text("production/package.json")
web_package = text("production/apps/web-portal/package.json")
check("@inno/i18n build" in package, "root build chain does not build @inno/i18n")
check('"@inno/i18n": "workspace:*"' in web_package, "web portal does not depend on @inno/i18n")

entities = text("production/services/platform-api/src/Modules/Platform/Domain/PlatformEntities.cs")
db_context = text("production/services/platform-api/src/Modules/Platform/Persistence/PlatformDbContext.cs")
platform_api = text("production/services/platform-api/src/Modules/Platform/Api/PlatformEndpoints.cs")
admin_settings = text("production/services/platform-api/src/Modules/Platform/Api/AdminSettingsEndpoints.cs")
seed = text("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")

for expected in [
    "PreferredLocale",
    "PlatformLocalizationSettings",
    "DefaultLocale",
]:
    check(expected in entities, f"platform locale domain missing: {expected}")

check('DbSet<PlatformLocalizationSettings> LocalizationSettings' in db_context, "localization settings DbSet missing")
check('entity.ToTable("localization_settings")' in db_context, "localization table mapping missing")
check('entity.Property(x => x.Version).IsConcurrencyToken()' in db_context, "localization version is not an EF concurrency token")
check('entity.Property(x => x.PreferredLocale).HasMaxLength(16)' in db_context, "preferred locale mapping missing")
check('DefaultLocale = "en-US"' in seed, "development seed does not default locale to en-US")

for expected in [
    'SupportedLocales = ["en-US", "th-TH"]',
    "organizationDefaultLocale",
    "profile.PreferredLocale",
    "UseOrganizationDefault",
    "Unsupported locale",
]:
    check(expected in platform_api, f"profile locale API missing: {expected}")

for expected in [
    'MapPatch("/admin/settings/localization"',
    "StatusCodes.Status428PreconditionRequired",
    "StatusCodes.Status412PreconditionFailed",
    "platform.localization.default_locale_changed",
    "DbUpdateConcurrencyException",
    "If-Match header required",
]:
    check(expected in admin_settings, f"admin localization API missing: {expected}")

migrations = list((ROOT / "production/services/platform-api/src/Modules/Platform/Persistence/Migrations").glob("*_Step45EBilingualFoundation.cs"))
check(len(migrations) == 1, "Step45E migration missing or duplicated")
if migrations:
    migration = migrations[0].read_text(encoding="utf-8-sig")
    check('name: "preferred_locale"' in migration, "migration does not add preferred_locale")
    check('name: "localization_settings"' in migration, "migration does not create localization_settings")

types = text("production/apps/web-portal/src/api/types.ts")
client = text("production/apps/web-portal/src/api/client.ts")
root = text("production/apps/web-portal/src/app/AppRoot.tsx")
main = text("production/apps/web-portal/src/main.tsx")
profile = text("production/apps/web-portal/src/pages/ProfilePage.tsx")
settings = text("production/apps/web-portal/src/pages/AdminPlatformSettingsPage.tsx")
shell = text("production/apps/web-portal/src/app/AppShell.tsx")
feedback = text("production/apps/web-portal/src/components/Feedback.tsx")

for expected in ["locale: 'en-US' | 'th-TH'", "preferredLocale", "organizationDefaultLocale", "supportedLocales"]:
    check(expected in types, f"Profile type missing locale field: {expected}")
check("AdminPlatformLocalization" in types, "Admin localization type missing")
check("useOrganizationDefault?: boolean" in client, "profile client cannot restore organization default")
check("updateAdminPlatformLocalization" in client, "admin localization client missing")
check("<I18nProvider locale={profile.locale}>" in root, "AppRoot does not bind locale to authenticated profile")
check("detectBrowserLocale" in main, "bootstrap browser locale fallback missing")
check("profile.preferredLocale ?? 'organization'" in profile, "Profile language inheritance UI missing")
check('value="organization"' in profile, "Profile has no organization-default option")
check("updateAdminPlatformLocalization" in settings, "Admin default-language UI missing")
check("query.data.localization.eTag" in settings, "Admin locale UI does not use ETag")
check("useI18n()" in shell, "AppShell is not connected to i18n")
check("useI18n()" in feedback, "shared Feedback states are not connected to i18n")

contract = text("INNO-One-Language-Terminology-Contract.md")
check("Current Production runtime override — Step 45E" in contract, "language contract does not supersede fixed-language Production rule")
check("explicit user preference -> organization/platform default -> browser/device locale" in contract, "locale resolution order missing from language contract")

print(f"step45e_checks={checks}")
print(f"step45e_failures={len(failures)}")
for failure in failures:
    print(" -", failure)

sys.exit(1 if failures else 0)
