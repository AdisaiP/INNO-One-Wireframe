import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
UI = (ROOT / "production/packages/ui/src/index.tsx").read_text(encoding="utf-8")
UI_CSS = (ROOT / "production/packages/ui/src/styles.css").read_text(encoding="utf-8")
UI_PACKAGE = json.loads((ROOT / "production/packages/ui/package.json").read_text(encoding="utf-8"))
SHELL = (ROOT / "production/apps/web-portal/src/shell.css").read_text(encoding="utf-8")
BROAD_QA = (ROOT / "step42-production-ux-browser-qa.py").read_text(encoding="utf-8")
PAGES_DIR = ROOT / "production/apps/web-portal/src/pages"
PAGES = {path.name: path.read_text(encoding="utf-8") for path in PAGES_DIR.glob("*.tsx")}
ALL_PAGES = "\n".join(PAGES.values())
INTEGRATIONS = PAGES["AdminIntegrationsPage.tsx"]
DESIGN_SYSTEM = PAGES["InternalDesignSystemPage.tsx"]
DESIGN_SYSTEM_CSS = (PAGES_DIR / "InternalDesignSystemPage.css").read_text(encoding="utf-8")
QR = PAGES["AssetQrLabelsPage.tsx"]
CALENDAR = PAGES["BusinessCalendarPage.tsx"]

checks = []
failures = []

def check(name, condition, detail=""):
    checks.append(name)
    if condition:
        print("PASS " + name + ((" :: " + str(detail)) if detail else ""))
    else:
        failures.append((name, detail))
        print("FAIL " + name + ((" :: " + str(detail)) if detail else ""))

# Shared exports and dependencies.
for component in [
    "INNORowActions",
    "INNODialog",
    "INNODrawer",
    "INNOPurposeNote",
    "INNOInfoCallout",
]:
    check("shared component exists: " + component, ("export function " + component) in UI)

check("react-dom is a peer dependency",
      UI_PACKAGE.get("peerDependencies", {}).get("react-dom") == "^19.2.0")
check("react-dom type/build dependency exists",
      UI_PACKAGE.get("devDependencies", {}).get("react-dom") == "19.2.0"
      and UI_PACKAGE.get("devDependencies", {}).get("@types/react-dom") == "19.3.0")
check("portal foundation is used", "createPortal" in UI and "document.body" in UI)

# Row actions contract.
check("row actions supports direct single action", "items.length === 1" in UI)
check("row actions supports menu semantics", 'role="menu"' in UI and 'role="menuitem"' in UI)
check("row actions trigger declares popup", 'aria-haspopup="menu"' in UI)
check("row actions escape restores trigger focus",
      "event.key !== 'Escape'" in UI and "triggerRef.current?.focus()" in UI)
check("row actions keyboard navigation",
      all(token in UI for token in ["ArrowDown", "ArrowUp", "Home", "End"]))
check("row actions closes on viewport movement",
      "window.addEventListener('scroll', onViewportChange, true)" in UI
      and "window.addEventListener('resize', onViewportChange)" in UI)
check("row actions menu is portal-safe fixed positioning",
      ".inno-row-actions-menu" in UI_CSS and "position: fixed;" in UI_CSS)
check("row actions has destructive styling",
      ".inno-row-actions-item.is-danger" in UI_CSS and "var(--ds-danger)" in UI_CSS)

# Dialog/drawer accessibility and focus contract.
check("overlay uses dialog semantics",
      'role="dialog"' in UI and 'aria-modal="true"' in UI)
check("overlay has labelled/described semantics",
      "aria-labelledby={titleId}" in UI and "aria-describedby={description ? descriptionId : undefined}" in UI)
check("overlay escape close", "closeRef.current()" in UI)
check("overlay traps tab", "event.key !== 'Tab'" in UI and "document.activeElement === first" in UI)
check("overlay restores focus", "previous?.focus()" in UI)
check("overlay locks background scroll",
      "document.body.style.overflow = 'hidden'" in UI and "document.body.style.overflow = previousOverflow" in UI)
check("overlay supports explicit backdrop policy",
      "closeOnBackdrop = true" in UI and "event.target === event.currentTarget" in UI)
check("dialog/drawer responsive shell exists",
      ".inno-dialog--sm" in UI_CSS and ".inno-drawer--lg" in UI_CSS
      and "@media (max-width: 680px)" in UI_CSS)

# Editor action bar.
footer_block = re.search(r"\.inno-editor-footer \{(.*?)\n\}", UI_CSS, re.S)
footer_css = footer_block.group(1) if footer_block else ""
check("editor footer exists", bool(footer_block))
check("editor footer is integrated not floating card",
      "border-top: 1px solid var(--ds-border)" in footer_css
      and "border-radius: 0" in footer_css
      and "box-shadow: none" in footer_css
      and "background: transparent" in footer_css)
check("editor footer docking is opt-in",
      "docked = false" in UI and "docked && 'is-docked'" in UI
      and ".inno-editor-footer.is-docked" in UI_CSS)
check("legacy footer card overrides removed",
      ".deployment-card .inno-editor-footer" not in SHELL
      and ".ticket-create-main > .inno-editor-footer" not in SHELL
      and ".baseline-editor-footer" not in SHELL
      and ".standalone-editor-footer" not in SHELL)
check("qr labels uses shared footer anatomy",
      'className="standalone-editor-footer' not in QR
      and "INNOEditorFooterStart" in QR
      and "INNOEditorFooterEnd" in QR
      and "INNOEditorFooterNote" in QR)

# Purpose note vs application state.
check("purpose note is visually lightweight",
      ".inno-purpose-note" in UI_CSS
      and "border-left: 3px solid" in UI_CSS
      and "border-radius" not in re.search(r"\.inno-purpose-note \{(.*?)\n\}", UI_CSS, re.S).group(1))
check("legacy purpose note markup removed",
      'className="purpose-note"' not in ALL_PAGES and ".purpose-note {" not in SHELL)
# Step 44E keeps the Purpose Note primitive but removes redundant policy callouts
# when the same boundary can live in normal page/section description copy.
check("integrations policy is concise page description",
      "INNOPurposeNote" not in INTEGRATIONS
      and "Configuration remains deployment-managed" in INTEGRATIONS)
check("integrations test uses shared row action",
      "INNORowActions" in INTEGRATIONS and "label: 'Test'" in INTEGRATIONS)

audit_source = PAGES["AdminAuditPage.tsx"]
check("AdminAuditPage.tsx passive copy still uses purpose note where useful",
      "INNOPurposeNote" in audit_source and "Audit records are read-only" in audit_source)
check("AdminAuditPage.tsx passive copy no longer uses INNOState",
      re.search(r'<INNOState[\s\S]{0,240}title="Audit records are read-only"', audit_source) is None)

passive_titles = {
    "AdminBrandingPage.tsx": "Brand customization is not editable yet",
    "AdminPlatformSettingsPage.tsx": "Platform settings are deployment-managed",
    "AdminRolesPage.tsx": "Role definitions are read-only in this phase",
    "AdminSecurityPage.tsx": "Security policy changes are not exposed yet",
    "SearchPage.tsx": "Authorization stays authoritative",
}
for file_name, former_title in passive_titles.items():
    source = PAGES[file_name]
    check(file_name + " redundant passive callout removed",
          "INNOPurposeNote" not in source)
    check(file_name + " passive explanation title removed while real states remain allowed",
          former_title not in source)

# Shared spacing ownership.
for token in [
    "--ds-space-2",
    "--ds-space-3",
    "--ds-space-4",
    "--ds-surface-padding-x",
    "--ds-surface-padding-y",
    "--ds-field-gap",
    "--ds-table-cell-x",
    "--ds-table-cell-y",
]:
    check("spacing token exists: " + token, token in UI_CSS)

check("collection uses shared surface padding",
      "padding: var(--ds-surface-padding-y) var(--ds-surface-padding-x)" in UI_CSS)
check("table cells use shared spacing tokens",
      "padding: var(--ds-table-cell-y) var(--ds-table-cell-x)" in UI_CSS)
check("production editor grid uses shared spacing tokens",
      ".editor-form { padding: var(--ds-space-4) var(--ds-surface-padding-x) 0; }" in SHELL
      and "gap: var(--ds-field-gap)" in SHELL)
check("production form controls use shared height",
      "height: var(--ds-control-h)" in SHELL)

# Internal Design System proves the live primitives.
check("design system uses shared row actions", "INNORowActions" in DESIGN_SYSTEM)
check("design system uses shared dialog", "<INNODialog" in DESIGN_SYSTEM)
check("design system uses shared drawer", "<INNODrawer" in DESIGN_SYSTEM)
check("design system uses shared info callout", "<INNOInfoCallout" in DESIGN_SYSTEM)
check("design system custom dialog markup removed",
      'className="internal-ds-overlay"' not in DESIGN_SYSTEM
      and 'className="internal-ds-dialog"' not in DESIGN_SYSTEM
      and 'className="internal-ds-sheet"' not in DESIGN_SYSTEM)
check("design system obsolete overlay css removed",
      ".internal-ds-overlay {" not in DESIGN_SYSTEM_CSS
      and ".internal-ds-dialog {" not in DESIGN_SYSTEM_CSS
      and ".internal-ds-sheet {" not in DESIGN_SYSTEM_CSS
      and ".internal-ds-sheet-backdrop {" not in DESIGN_SYSTEM_CSS)
check("calendar supporting table avoids unnecessary wide preset",
      '<INNOTableWrap width="wide">' not in CALENDAR
      and "<INNOTableWrap>" in CALENDAR)
check("broad browser readiness waits for mounted production shell",
      ".inno-production-shell" in BROAD_QA
      and ".workspace-home-page" in BROAD_QA
      and "main.getBoundingClientRect().width > 0" in BROAD_QA
      and "timeout=20" in BROAD_QA)

print("step44b_checks=" + str(len(checks)))
print("step44b_failures=" + str(len(failures)))
print("step44b_foundations=5")
print("step44b_passive_state_migrations=" + str(len(passive_titles) + 1))

if failures:
    for name, detail in failures:
        print("FAILURE: " + name + " :: " + str(detail))
    raise SystemExit(1)
