from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "production/apps/web-portal/src/pages"
UI = ROOT / "production/packages/ui/src"
issues = []

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def require(text: str, marker: str, label: str):
    if marker not in text:
        issues.append(f"{label}: missing {marker}")

def forbid(text: str, marker: str, label: str):
    if marker in text:
        issues.append(f"{label}: forbidden {marker}")

ui = read(UI / "index.tsx")
ui_css = read(UI / "styles.css")
shell_css = read(ROOT / "production/apps/web-portal/src/shell.css")

for marker in [
    "export function INNOEditorFooter(",
    "export function INNOEditorFooterStart(",
    "export function INNOEditorFooterEnd(",
    "export function INNOEditorFooterNote(",
]:
    require(ui, marker, "shared editor footer")

for marker in [
    ".inno-editor-footer-start",
    ".inno-editor-footer-end",
    ".inno-editor-footer-note",
]:
    require(ui_css, marker, "shared editor footer styles")

for marker in [
    ".footer-helper",
    ".license-record-footer",
    ".contract-record-footer",
    ".profile-edit-actions",
]:
    forbid(shell_css, marker, "obsolete page-local editor footer CSS")

structured = [
    "ProfilePage.tsx",
    "AssetDetailPage.tsx",
    "AutomationRulePage.tsx",
    "BusinessCalendarPage.tsx",
    "HelpdeskSlaPage.tsx",
    "SoftwareLicensesPage.tsx",
    "ContractEditPage.tsx",
    "SoftwareBaselinesPage.tsx",
    "TicketCreatePage.tsx",
    "AdminHierarchyPage.tsx",
    "AdminUserEditorPage.tsx",
    "AdminAccessScopeEditPage.tsx",
    "DeviceGroupsPage.tsx",
]

for name in structured:
    source = read(WEB / name)
    for marker in ["<INNOEditorFooter", "<INNOEditorFooterStart", "<INNOEditorFooterEnd"]:
        require(source, marker, name)

for name in [
    "AssetDetailPage.tsx",
    "BusinessCalendarPage.tsx",
    "HelpdeskSlaPage.tsx",
    "SoftwareLicensesPage.tsx",
    "ContractEditPage.tsx",
]:
    require(read(WEB / name), "<INNOEditorFooterNote", name)

# Step 44D short forms use shared dialog footers instead of page editor footers.
for name in ["AdminPositionsPage.tsx", "AssetCustomFieldsPage.tsx"]:
    source = read(WEB / name)
    require(source, "<INNODialog", name + " focused dialog")
    forbid(source, 'className="admin-master-detail"', name + " permanent editor")

profile = read(WEB / "ProfilePage.tsx")
require(profile, "Discard changes", "Profile settings")
forbid(profile, "profile-edit-actions", "Profile settings")

for name, old_toggle in [
    ("DeviceGroupsPage.tsx", "showCreate ? 'Cancel'"),
]:
    source = read(WEB / name)
    forbid(source, old_toggle, name + " page header")
    require(source, "variant=\"secondary\"", name + " footer cancel")

users = read(WEB / "AdminUsersPage.tsx")
forbid(users, "showCreate", "AdminUsersPage dedicated create route")
forbid(users, "<INNOEditorFooter", "AdminUsersPage list ownership")
require(users, 'to="/admin/users/new"', "AdminUsersPage create navigation")
require(read(WEB / "AdminUserEditorPage.tsx"), 'variant="secondary"', "AdminUserEditorPage footer cancel")

for name in structured:
    source = read(WEB / name)
    for block in re.findall(r"<INNOEditorFooter[\s\S]*?</INNOEditorFooter>", source):
        if 'variant="danger"' in block:
            issues.append(f"{name}: destructive action competes inside editor footer")
        if "standalone-editor-footer" in block or "license-record-footer" in block or "contract-record-footer" in block:
            issues.append(f"{name}: page-local footer class remains")

print("step42_2d_editor_anatomy=shared")
print("structured_editor_pages=" + str(len(structured)))
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE:", issue)

raise SystemExit(1 if issues else 0)
