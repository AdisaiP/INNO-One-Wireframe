import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent

def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

APP = read("production/apps/web-portal/src/app/AppRoot.tsx")
POSITIONS = read("production/apps/web-portal/src/pages/AdminPositionsPage.tsx")
USERS = read("production/apps/web-portal/src/pages/AdminUsersPage.tsx")
USER_DETAIL = read("production/apps/web-portal/src/pages/AdminUserDetailPage.tsx")
USER_EDITOR = read("production/apps/web-portal/src/pages/AdminUserEditorPage.tsx")
ACCESS = read("production/apps/web-portal/src/pages/AdminAccessScopesPage.tsx")
ACCESS_EDIT = read("production/apps/web-portal/src/pages/AdminAccessScopeEditPage.tsx")
CUSTOM = read("production/apps/web-portal/src/pages/AssetCustomFieldsPage.tsx")
CONTRACTS = read("production/apps/web-portal/src/pages/ContractsWarrantyPage.tsx")
CONTRACT_DETAIL = read("production/apps/web-portal/src/pages/ContractDetailPage.tsx")
CONTRACT_EDIT = read("production/apps/web-portal/src/pages/ContractEditPage.tsx")
CLIENT = read("production/apps/web-portal/src/api/client.ts")

checks = []
failures = []
def check(name, condition):
    checks.append(name)
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)
# Positions: list + focused dialog.
check("positions uses focused dialog", "<INNODialog" in POSITIONS)
check("positions no permanent master detail", "admin-master-detail" not in POSITIONS and "admin-editor-panel" not in POSITIONS)
check("positions has edit action", "INNORowActions" in POSITIONS and "label: 'Edit'" in POSITIONS)
check("positions no selected row state", "selectedId" not in POSITIONS)

# Users: list -> dedicated create/edit -> read-only detail.
check("users list links create route", 'to="/admin/users/new"' in USERS)
check("users list has no inline create editor", "showCreate" not in USERS and "create-panel" not in USERS and "createAdminUser" not in USERS)
check("user detail is read-only", "updateAdminUser" not in USER_DETAIL and "setEditing" not in USER_DETAIL and "<form" not in USER_DETAIL)
check("user detail links edit route", "'/edit'" in USER_DETAIL)
check("user editor owns create and update", "createAdminUser" in USER_EDITOR and "updateAdminUser" in USER_EDITOR)
check("user editor canonical footer", "<INNOEditorFooter" in USER_EDITOR and "<INNOEditorFooterStart" in USER_EDITOR and "<INNOEditorFooterEnd" in USER_EDITOR)
# Access Scopes: list -> dedicated editor; TreeGrid belongs to editor.
check("access scopes list no permanent master detail", "admin-master-detail" not in ACCESS and "admin-editor-panel" not in ACCESS)
check("access scopes list no TreeGrid editor", "INNOTreeGrid" not in ACCESS and "updateAdminAccessAssignment" not in ACCESS)
check("access scopes list links edit route", "'/admin/access-scopes/' + item.id + '/edit'" in ACCESS)
check("access scope editor gets assignment", "getAdminAccessAssignment" in ACCESS_EDIT)
check("access scope editor updates assignment", "updateAdminAccessAssignment" in ACCESS_EDIT)
check("access scope editor uses TreeGrid", "<INNOTreeGrid" in ACCESS_EDIT)
check("access scope editor canonical footer", "<INNOEditorFooter" in ACCESS_EDIT and "<INNOEditorFooterStart" in ACCESS_EDIT and "<INNOEditorFooterEnd" in ACCESS_EDIT)

# Custom Fields: settings list + dialog, not a permanent row editor.
check("custom fields uses focused dialog", "<INNODialog" in CUSTOM)
check("custom fields no permanent inline editor rows", "custom-field-editor-row" not in CUSTOM)
check("custom fields persists schema via dialog", "updateAssetCustomFields" in CUSTOM and 'form="custom-field-dialog-form"' in CUSTOM)
# Contracts: list -> detail -> edit.
check("contracts list no selected inline detail", "selectedId" not in CONTRACTS and "contract-detail-grid" not in CONTRACTS and "contract-record-panel" not in CONTRACTS)
check("contracts list no update mutation", "updateAssetContract" not in CONTRACTS)
check("contracts list links detail route", "'/assets/contracts/' + item.id" in CONTRACTS)
check("contract detail uses resource header", "<INNOResourceHeader" in CONTRACT_DETAIL)
check("contract detail links edit route", "'/edit'" in CONTRACT_DETAIL)
check("contract detail shows covered assets", "Covered assets" in CONTRACT_DETAIL)
check("contract edit updates contract", "updateAssetContract" in CONTRACT_EDIT)
check("contract edit canonical footer", "<INNOEditorFooter" in CONTRACT_EDIT and "<INNOEditorFooterStart" in CONTRACT_EDIT and "<INNOEditorFooterEnd" in CONTRACT_EDIT)
check("contract lookup adapter exists without backend invention", "export async function getAssetContract" in CLIENT and "getAssetContracts({ page, pageSize: 100 })" in CLIENT)
# Route registration.
for route in [
    'path="admin/users/new"',
    'path="admin/users/:userId/edit"',
    'path="admin/access-scopes/:assignmentId/edit"',
    'path="assets/contracts/:contractId"',
    'path="assets/contracts/:contractId/edit"',
]:
    check("route registered " + route, route in APP)

print("step44d_checks=" + str(len(checks)))
print("step44d_failures=" + str(len(failures)))
print("step44d_new_routes=5")
print("step44d_remediated_surfaces=5")
if failures:
    for name in failures:
        print("FAILURE: " + name)
    raise SystemExit(1)
