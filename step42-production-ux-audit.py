from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

ui = read("production/packages/ui/src/index.tsx")
ui_css = read("production/packages/ui/src/styles.css")
ui_pkg = json.loads(read("production/packages/ui/package.json"))
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
shell_css = read("production/apps/web-portal/src/shell.css")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
flow_contract = read("INNO-One-Special-UI-Components.md")
automation = read("production/apps/web-portal/src/pages/AutomationRulePage.tsx")
web_pkg = json.loads(read("production/apps/web-portal/package.json"))
for marker in [
    "const INNO_ICON_MAP",
    "export type INNOIconToken",
    "export function INNOIcon",
    "'nav.workspace': House",
    "'nav.devices': Monitor",
    "'nav.assets': Package",
    "'nav.helpdesk': Headphones",
    "'action.next': ChevronRight",
    "'status.loading': LoaderCircle",
    "'device.server': Server",
    "'device.laptop': Laptop",
]:
    if marker not in ui:
        issues.append("shared icon system missing " + marker)

if "lucide-react" not in ui_pkg.get("dependencies", {}):
    issues.append("lucide-react missing from @inno/ui dependencies")

for marker in [
    "<INNOIcon token={iconToken}",
    '<INNOIcon token="action.search"',
]:
    if marker not in ui:
        issues.append("shared primitive icon missing " + marker)
for forbidden in [
    ".inno-state-icon::before",
    ".inno-search-icon::before",
    ".inno-search-icon::after",
]:
    if forbidden in ui_css:
        issues.append("legacy pseudo icon remains " + forbidden)

for marker in [
    "function SideNavLabel",
    "prod-side-link-content",
    '<NavIcon token="nav.workspace"',
    '<NavIcon token="nav.apps"',
    '<NavIcon token="nav.devices"',
    '<NavIcon token="nav.assets"',
    '<NavIcon token="nav.helpdesk"',
    '<NavIcon token="nav.admin"',
]:
    if marker not in shell:
        issues.append("shell semantic icon coverage " + marker)

if "function ShellIcon" in shell or "<svg" in shell:
    issues.append("hand-authored shell SVG remains")

if ".prod-side-link-content" not in shell_css:
    issues.append("side navigation icon layout missing")
tsx_roots = [
    ROOT / "production/apps/web-portal/src",
    ROOT / "production/packages/ui/src",
]
tsx_files = []
for root in tsx_roots:
    tsx_files.extend(root.rglob("*.tsx"))

for file_path in tsx_files:
    text = file_path.read_text(encoding="utf-8")
    relative = file_path.relative_to(ROOT).as_posix()
    if "<svg" in text:
        issues.append("raw svg in production React " + relative)
    for glyph in ("▦", "▱", "◇", "▣", "▧", "◉", "◫"):
        if glyph in text:
            issues.append("legacy UI glyph " + glyph + " in " + relative)

page_root = ROOT / "production/apps/web-portal/src/pages"
for file_path in page_root.glob("*.tsx"):
    text = file_path.read_text(encoding="utf-8")
    relative = file_path.relative_to(ROOT).as_posix()
    for line in text.splitlines():
        if "device-row-action" in line and "›" in line:
            issues.append("row action text arrow " + relative)
        if "production-app-open" in line and "›" in line:
            issues.append("app action text arrow " + relative)
if "@xyflow/react" in web_pkg.get("dependencies", {}):
    issues.append("React Flow installed before a branching workflow production slice")
if "elkjs" in web_pkg.get("dependencies", {}):
    issues.append("ELK installed before a branching workflow production slice")

for marker in ["@xyflow/react", "ELK.js", "INNOWorkflowCanvas"]:
    if marker not in flow_contract:
        issues.append("workflow contract missing " + marker)

for forbidden in ["ReactFlow", "@xyflow/react", "elkjs"]:
    if forbidden in automation:
        issues.append("bounded Helpdesk automation incorrectly uses workflow canvas: " + forbidden)

for marker in ["Trigger", "Condition", "Primary action"]:
    if marker not in automation:
        issues.append("bounded automation editor marker missing " + marker)

if 'DesignSystem = "V1.26"' not in versions:
    issues.append("design system drift")
if 'UiContract = "1.20.0"' not in versions:
    issues.append("UI contract drift")
implementation_match = re.search(
    r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"',
    versions,
)
implementation_version = tuple(map(int, implementation_match.groups())) if implementation_match else (0, 0, 0)
if implementation_version < (0, 31, 0):
    issues.append("implementation contract must remain at least 0.31.0 after UX-only Step 42")
print("step42_scope=production-ux-reconciliation")
print("step42_icons=semantic-lucide-shared-layer")
print("step42_flow=react-flow-reserved-for-branching-workflow")
print("step42_helpdesk_automation=bounded-trigger-condition-action-no-react-flow")
print("step42_design_system=V1.26")
print("step42_ui_contract=1.20.0")
print("step42_implementation_contract_min=0.31.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
