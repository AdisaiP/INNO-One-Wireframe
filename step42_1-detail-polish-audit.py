from pathlib import Path

ROOT = Path(__file__).resolve().parent
issues = []

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

shell = read("production/apps/web-portal/src/app/AppShell.tsx")
shell_css = read("production/apps/web-portal/src/shell.css")
ui = read("production/packages/ui/src/index.tsx")
ui_css = read("production/packages/ui/src/styles.css")
tickets = read("production/apps/web-portal/src/pages/TicketsPage.tsx")
contracts = read("production/apps/web-portal/src/pages/ContractsWarrantyPage.tsx")
contract_edit = read("production/apps/web-portal/src/pages/ContractEditPage.tsx")

def require(text: str, marker: str, label: str):
    if marker not in text:
        issues.append(label + ": missing " + marker)

def forbid(text: str, marker: str, label: str):
    if marker in text:
        issues.append(label + ": forbidden " + marker)

# Frozen contextual-navigation ownership.
for marker in [
    "inno.ui.sidebar.collapsed",
    "prod-side-collapse",
    "prod-context-reveal",
    "openContextNavigation",
    "closeContextNavigation",
    "action.collapse",
    "action.expand",
]:
    require(shell if marker not in ("action.collapse","action.expand") else ui, marker, "context navigation")

forbid(shell, 'className="prod-context-toggle"', "global header")
require(shell_css, ".prod-context-toggle { display: none !important; }", "global header")
require(shell_css, ".inno-production-shell.side-collapsed", "desktop collapse")
require(shell_css, "@media (max-width: 1180px)", "overlay breakpoint")
require(shell_css, "/* Step 42.2A: application shell owns the viewport; main content owns page scroll. */", "shell scroll ownership")
require(shell_css, "height: 100dvh;", "shell viewport ownership")
require(shell_css, ".prod-shell-body { height: 100%; min-height: 0; overflow: hidden; }", "shell body ownership")
require(shell_css, "overflow-y: auto; overscroll-behavior: contain;", "main scroll ownership")
require(shell_css, "position: fixed;", "responsive contextual sidebar")
# Frozen page / collection / state density.
for marker in [
    ".inno-page { padding: 24px 16px 32px; }",
    ".inno-page { padding: 16px 12px 32px; }",
    ".inno-page { padding: 12px 8px 24px; }",
    "padding: var(--ds-surface-padding-y) var(--ds-surface-padding-x);",
    "border-bottom: 1px solid #edf0f3;",
    ".inno-state.compact { min-height: 150px; padding: 22px 16px;",
]:
    require(ui_css, marker, "shared density")

for marker in [
    "border: 0;",
    "background: transparent;",
]:
    require(ui_css, marker, "flat state")

# Collection-local empty state must stay flat and owned by the shared collection-state primitive.
require(tickets, "INNOCollectionState", "ticket empty state")
require(tickets, "No tickets in this queue", "ticket empty state")
require(ui, "export function INNOCollectionState(", "collection local state")
require(ui_css, ".inno-collection-state", "collection local state")
require(ui_css, ".inno-state.compact", "collection local state")
require(ui_css, "border: 0;", "collection local state")
require(ui_css, "background: transparent;", "collection local state")

# Canonical editor footer. Step 44B supersedes the old floating-card footer
# while preserving section ownership and opt-in docking for long dirty editors.
for marker in [
    "min-height: 50px;",
    "margin-top: var(--ds-space-4);",
    "border-top: 1px solid var(--ds-border);",
    "border-radius: 0;",
    "background: transparent;",
    "box-shadow: none;",
    ".inno-editor-footer.is-docked",
]:
    require(ui_css, marker, "editor footer")

forbid(shell_css, ".standalone-editor-footer {", "standalone footer")
forbid(shell_css, ".qr-action-footer {", "QR footer")
qr = read("production/apps/web-portal/src/pages/AssetQrLabelsPage.tsx")
require(qr, "<INNOEditorFooter>", "QR footer")
require(qr, "<INNOEditorFooterStart>", "QR footer")
require(qr, "<INNOEditorFooterEnd>", "QR footer")
require(qr, "<INNOEditorFooterNote>", "QR footer")
require(shell_css, ".license-stat-strip { margin-bottom: 16px; }", "license stats")
require(shell_css, ".contract-stat-strip { margin-bottom: 16px; }", "contract stats")
require(contract_edit, "<INNOEditorFooter>", "contract edit footer")
require(contract_edit, "<INNOEditorFooterStart>", "contract edit footer")
require(contract_edit, "<INNOEditorFooterEnd>", "contract edit footer")
forbid(contracts, "<INNOEditorFooter", "contract list footer ownership")

print("step42_1_detail_polish=wireframe-micro-fidelity")
print("context_navigation=desktop-collapse+tablet-hamburger")
print("empty_state=collection-local-flat")
print("micro_spacing=1366+1024+768")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE:", issue)

raise SystemExit(1 if issues else 0)
