from pathlib import Path

ROOT = Path(__file__).resolve().parent
issues = []

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def require(text: str, marker: str, label: str):
    if marker not in text:
        issues.append(f"{label}: missing {marker}")

def forbid(text: str, marker: str, label: str):
    if marker in text:
        issues.append(f"{label}: forbidden {marker}")

shell = read("production/apps/web-portal/src/shell.css")
ui = read("production/packages/ui/src/styles.css")
frozen = read("INNO-One-Design-System-V1-Frozen.md")

require(frozen, "UI should use border and surface separation first; strong shadows are reserved for overlays.", "frozen surface rule")

for marker in [
    "/* Step 42.2B: Page -> Section/Collection -> Inset surface hierarchy. */",
    "--prod-surface-page: transparent;",
    "--prod-surface-section: #fff;",
    "--prod-surface-collection: #fff;",
    "--prod-surface-inset: var(--ds-surface-subtle);",
    "--prod-surface-radius: 12px;",
    "--prod-inset-radius: 8px;",
]:
    require(shell, marker, "surface hierarchy")

require(shell, ".prod-panel {", "section surface")
require(shell, "background: var(--prod-surface-section);", "section surface")
require(shell, "background: var(--prod-surface-collection);", "collection surface")
require(shell, "background: var(--prod-surface-inset);", "inset surface")
require(shell, ".summary-grid > div {", "summary inset")
require(shell, "border: 0;", "summary inset")
require(shell, "box-shadow: none;", "standard surfaces")

require(ui, ".inno-collection {", "shared collection")
require(ui, "box-shadow: none;", "shared collection")

for marker in [
    ".notification-stat-strip",
    ".notification-feed",
    ".branding-shell-preview",
]:
    require(shell, marker, "flat standard surface")

forbid(shell, "box-shadow: 0 1px 2px rgba(20, 27, 40, .035);", "legacy panel shadow")
forbid(ui, "box-shadow: var(--ds-shadow-sm);", "shared collection shadow")

require(shell, ".collection-state > .inno-state.compact", "collection-local state")
require(shell, "background: transparent;", "collection-local state")
require(shell, "border-radius: 0;", "collection-local state")

print("step42_2b_surface_hierarchy=page-section-collection-inset")
print("standard_surface_shadow=none")
print("inset_surface=borderless-subtle")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE:", issue)

raise SystemExit(1 if issues else 0)
