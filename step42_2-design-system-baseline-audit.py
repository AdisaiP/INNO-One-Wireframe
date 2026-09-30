from pathlib import Path
import hashlib

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

section_ids = [
    "freeze", "foundations", "buttons", "forms", "data", "hierarchy",
    "states", "interactions", "overlays", "responsive", "navigation",
    "icons", "guidelines",
]

if page.is_file():
    text = page.read_text(encoding="utf-8")
    for marker in [
        'Design System V1.26',
        'UI Contract 1.20.0 is frozen',
        'Frozen UI contract',
        'What is frozen',
        'Source of truth',
        'React consumes the contract, not prototype internals.',
        'Hierarchy components',
        'Interaction standards',
        'Dialog & overlays',
        'Navigation architecture',
        'Icon vocabulary',
        'Implementation map',
        'INNOCollection',
        'INNOState',
        'INNOEditorFooter',
        'INNOIcon',
    ]:
        if marker not in text:
            issues.append("React design-system marker missing: " + marker)
    for section_id in section_ids:
        if f'id="{section_id}"' not in text:
            issues.append("React design-system section missing: " + section_id)

if page_css.is_file():
    css = page_css.read_text(encoding="utf-8")
    for marker in [
        ".internal-ds-section",
        "margin: 28px 0",
        ".internal-ds-grid",
        "grid-template-columns: repeat(2, minmax(0, 1fr))",
        ".internal-ds-card",
        "padding: 18px",
        ".internal-ds-freeze-banner",
        ".internal-ds-freeze-grid",
        ".internal-ds-rules",
        ".internal-ds-responsive-table",
    ]:
        if marker not in css:
            issues.append("React design-system fidelity CSS missing: " + marker)

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
    for marker in [
        "inDesignSystem",
        "designSystemHash",
        "'Design System'",
        '<div className="prod-side-title">Design System</div>',
        'href="#freeze"',
        'href="#foundations"',
        'href="#guidelines"',
    ]:
        if marker not in text:
            issues.append("Design System shell ownership marker missing: " + marker)
    if 'to="/internal/design-system"' in text:
        issues.append("internal design-system leaked into normal shell navigation")

for source in WEB.rglob("*"):
    if source.suffix not in {".ts", ".tsx", ".css"}:
        continue
    text = source.read_text(encoding="utf-8", errors="replace")
    if "@import" in text and "design-system/frozen/v1.26" in text:
        issues.append("runtime source imports frozen prototype CSS: " + str(source.relative_to(ROOT)))
    if "production/design-system/frozen/v1.26" in text and source != page:
        issues.append("runtime source references frozen prototype unexpectedly: " + str(source.relative_to(ROOT)))

print("step42_2_scope=production-design-system-fidelity")
print("frozen_reference=production/design-system/frozen/v1.26")
print("react_reference=/internal/design-system")
print("section_parity=13")
print("documentation_version=V1.26")
print("ui_contract=1.20.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)
raise SystemExit(1 if issues else 0)
