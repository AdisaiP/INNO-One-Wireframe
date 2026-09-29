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
require(shell_css, "/* Step 42.1 micro-fidelity: shell body already starts below the sticky 56px header. */", "shell top correction")
require(shell_css, "position: sticky;", "shell sticky rails")
require(shell_css, "top: 0;", "shell top correction")
# Frozen page / collection / state density.
for marker in [
    ".inno-page { padding: 24px 16px 32px; }",
    ".inno-page { padding: 16px 12px 32px; }",
    ".inno-page { padding: 12px 8px 24px; }",
    "padding: 12px 16px;",
    "border-bottom: 1px solid #edf0f3;",
    ".inno-state.compact { min-height: 150px; padding: 22px 16px;",
]:
    require(ui_css, marker, "shared density")

for marker in [
    "border: 0;",
    "background: transparent;",
]:
    require(ui_css, marker, "flat state")

# Collection-local empty state must not become a nested card.
require(tickets, "compact", "ticket empty state")
require(tickets, "No tickets in this queue", "ticket empty state")
require(shell_css, ".collection-state > .inno-state.compact", "collection local state")
require(shell_css, "border: 0;", "collection local state")
require(shell_css, "background: transparent;", "collection local state")

# Canonical editor footer.
for marker in [
    "min-height: 58px;",
    "margin-top: 14px;",
    "padding: 10px 12px;",
    "border-radius: 12px;",
]:
    require(ui_css, marker, "editor footer")

require(shell_css, ".standalone-editor-footer {", "standalone footer")
require(shell_css, "border-radius: 12px;", "standalone footer")
require(shell_css, ".qr-action-footer { margin-top: 14px; }", "QR footer")
require(shell_css, ".license-stat-strip { margin-bottom: 16px; }", "license stats")
require(shell_css, ".contract-stat-strip { margin-bottom: 16px; }", "contract stats")
require(shell_css, ".contract-record-footer", "contract footer")

print("step42_1_detail_polish=wireframe-micro-fidelity")
print("context_navigation=desktop-collapse+tablet-hamburger")
print("empty_state=collection-local-flat")
print("micro_spacing=1366+1024+768")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE:", issue)

raise SystemExit(1 if issues else 0)
