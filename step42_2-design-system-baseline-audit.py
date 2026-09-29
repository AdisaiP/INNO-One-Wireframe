from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent
FROZEN = ROOT / "production/design-system/frozen/v1.26"
WEB = ROOT / "production/apps/web-portal/src"
issues = []

required = [
    "design-system.html",
    "workspace-v2.css",
    "inno-design-system.css",
    "inno-design-contract.js",
    "inno-inputs.js",
    "inno-interactions.js",
    "inno-states.js",
    "platform-shell.js",
    "inno-responsive.js",
    "inno-navigation.js",
    "inno-icons.js",
    "INNO-One-Design-System-V1-Frozen.md",
    "INNO-One-Final-Visual-QA-Baseline.md",
    "INNO-One-Action-Layout-Contract.md",
    "INNO-One-State-Coverage-Contract.md",
    "INNO-One-Table-List-Density-Contract.md",
    "README.md",
    "manifest.sha256",
]

for name in required:
    if not (FROZEN / name).is_file():
        issues.append("missing frozen reference: " + name)

contract = (FROZEN / "inno-design-contract.js").read_text(encoding="utf-8", errors="replace")
for marker in [
    'contractVersion:"1.20.0"',
    'documentationVersion:"1.26"',
    'status:"frozen"',
    'P02:{name:"List"',
    'P03:{name:"Resource Detail"',
    'P04:{name:"Create/Edit"',
    'desktopSidebar:"inline and collapsible"',
    'compactSidebar:"off-canvas"',
]:
    if marker not in contract:
        issues.append("frozen contract marker missing: " + marker)

manifest = FROZEN / "manifest.sha256"
if manifest.is_file():
    for line in manifest.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        digest, name = line.split("  ", 1)
        file_path = FROZEN / name
        if not file_path.is_file():
            issues.append("manifest file missing: " + name)
            continue
        current = hashlib.sha256(file_path.read_bytes()).hexdigest()
        if current != digest:
            issues.append("frozen manifest mismatch: " + name)

page = WEB / "pages/InternalDesignSystemPage.tsx"
page_css = WEB / "pages/InternalDesignSystemPage.css"
app_root = WEB / "app/AppRoot.tsx"
app_shell = WEB / "app/AppShell.tsx"

for file_path in [page, page_css, app_root, app_shell]:
    if not file_path.is_file():
        issues.append("production design-system file missing: " + str(file_path.relative_to(ROOT)))

if page.is_file():
    text = page.read_text(encoding="utf-8")
    for marker in [
        'title="Production Design System"',
        'id="foundations"',
        'id="actions"',
        'id="forms"',
        'id="data"',
        'id="states"',
        'id="patterns"',
        'id="navigation"',
        'id="responsive"',
        'P02',
        'P03',
        'P04',
        'production/design-system/frozen/v1.26',
        'INNOCollection',
        'INNOResourceHeader',
        'INNOEditorFooter',
    ]:
        if marker not in text:
            issues.append("React design-system marker missing: " + marker)

if app_root.is_file():
    text = app_root.read_text(encoding="utf-8")
    if 'path="internal/design-system"' not in text:
        issues.append("internal design-system route missing")
    if 'element={canAdmin ? (' not in text or '<InternalDesignSystemPage />' not in text:
        issues.append("internal design-system route is not admin gated")
    if "lazy(async () =>" not in text or "import('../pages/InternalDesignSystemPage')" not in text:
        issues.append("internal design-system route is not lazy loaded")

if app_shell.is_file():
    text = app_shell.read_text(encoding="utf-8")
    if "inDesignSystem" not in text:
        issues.append("internal design-system route does not inherit Admin shell ownership")
    if 'to="/internal/design-system"' in text:
        issues.append("internal design-system leaked into normal shell navigation")

for source in WEB.rglob("*"):
    if source.suffix not in {".ts", ".tsx", ".css"}:
        continue
    text = source.read_text(encoding="utf-8", errors="replace")
    if "design-system/frozen/v1.26" in text and source != page:
        issues.append("runtime source imports or references frozen prototype: " + str(source.relative_to(ROOT)))

print("step42_2_scope=production-design-system-baseline")
print("frozen_reference=production/design-system/frozen/v1.26")
print("react_reference=/internal/design-system")
print("documentation_version=V1.26")
print("ui_contract=1.20.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)
raise SystemExit(1 if issues else 0)
