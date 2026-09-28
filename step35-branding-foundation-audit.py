from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

branding = read("production/apps/web-portal/src/app/branding.ts")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
main = read("production/apps/web-portal/src/main.tsx")
page = read("production/apps/web-portal/src/pages/AdminBrandingPage.tsx")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
overview = read("production/apps/web-portal/src/pages/AdminOverviewPage.tsx")
styles = read("production/apps/web-portal/src/shell.css")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")

for marker in [
    "PRODUCT_BRAND",
    "productName: 'INNO.One'",
    "compactMark: 'I1'",
    "browserTitle: 'INNO.One'",
    "BRAND_TOKEN_DEFINITIONS",
    "'--ds-primary'",
    "'--ds-primary-hover'",
    "'--ds-primary-soft'",
    "'--ds-bg'",
    "'--ds-surface'",
    "'--ds-text'",
    "BRAND_FONT_TOKEN",
    "'--ds-font'",
    "applyProductDocumentBrand",
    "readBrandCssVariable",
]:
    if marker not in branding:
        issues.append("branding source " + marker)

for marker in [
    "PRODUCT_BRAND.compactMark",
    "PRODUCT_BRAND.productNamePrefix",
    "PRODUCT_BRAND.productNameEmphasis",
    "PRODUCT_BRAND.productName",
]:
    if marker not in shell:
        issues.append("shell brand source " + marker)

for forbidden in [
    '<span className="prod-logo-mark">I1</span>',
    '<span className="prod-brand-name">INNO.<b>One</b></span>',
]:
    if forbidden in shell:
        issues.append("shell hardcoded brand " + forbidden)

if "applyProductDocumentBrand();" not in main:
    issues.append("document brand initialization")

for marker in [
    'title="Branding"',
    "Brand customization is not editable yet",
    "Effective Product Identity",
    "Frozen Brand Tokens",
    "Future customization boundary",
    "BRAND_TOKEN_DEFINITIONS",
    "readBrandCssVariable",
]:
    if marker not in page:
        issues.append("branding page " + marker)

for forbidden in [
    "Save Branding",
    "Upload Logo",
    "Change Logo",
    "Primary Color",
    "Login Page Branding",
    'type="file"',
    'type="color"',
]:
    if forbidden in page:
        issues.append("fake branding mutation " + forbidden)

for marker in [
    "AdminBrandingPage",
    "admin.branding.manage",
    'path="admin/branding"',
]:
    if marker not in root:
        issues.append("branding route " + marker)

for marker in [
    "admin.branding.manage",
    'to="/admin/branding">Branding</NavLink>',
    "{ label: 'Branding', path: '/admin/branding' }",
]:
    if marker not in shell:
        issues.append("branding shell " + marker)

if 'to="/admin/branding"' not in overview:
    issues.append("branding overview link")

for marker in [
    "branding-foundation-layout",
    "branding-preview-stage",
    "branding-token-grid",
    "branding-token-card",
    "@media (max-width: 768px)",
]:
    if marker not in styles:
        issues.append("branding style " + marker)

for marker in [
    "Step35Permissions",
    '("admin.branding.manage", "admin", "Manage platform branding")',
]:
    if marker not in seed:
        issues.append("branding permission " + marker)

if seed.count(".Concat(Step35Permissions)") != 2:
    issues.append("step35 permission ensure chain")

version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 25, 0):
    issues.append("implementation contract")

print("step35_scope=branding-foundation,effective-product-identity,design-token-preview")
print("step35_mutable_branding=false")
print("step35_implementation_contract=0.25.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
