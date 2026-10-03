from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parent
LICENSE_LIST=(ROOT/"production/apps/web-portal/src/pages/SoftwareLicensesPage.tsx").read_text(encoding="utf-8")
LICENSE_DETAIL=(ROOT/"production/apps/web-portal/src/pages/SoftwareLicenseDetailPage.tsx").read_text(encoding="utf-8")
ROLES=(ROOT/"production/apps/web-portal/src/pages/AdminRolesPage.tsx").read_text(encoding="utf-8")
QUERY=(ROOT/"production/apps/web-portal/src/pages/InventoryQueryPage.tsx").read_text(encoding="utf-8")
QUERY_CSS=(ROOT/"production/apps/web-portal/src/pages/InventoryQueryPage.css").read_text(encoding="utf-8")
APP=(ROOT/"production/apps/web-portal/src/app/AppRoot.tsx").read_text(encoding="utf-8")
CLIENT=(ROOT/"production/apps/web-portal/src/api/client.ts").read_text(encoding="utf-8")
ROLE_API=(ROOT/"production/services/platform-api/src/Modules/Platform/Api/AdminAccessEndpoints.cs").read_text(encoding="utf-8")
LICENSE_API=(ROOT/"production/services/platform-api/src/Modules/Assets/Api/SoftwareLicenseEndpoints.cs").read_text(encoding="utf-8")
SHELL=(ROOT/"production/apps/web-portal/src/shell.css").read_text(encoding="utf-8")

checks=0
fails=[]
def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok:
        fails.append((name, detail))

# Software licenses: list -> resource detail, entitlement terminology.
check("software license list no longer owns drawer", "INNODrawer" not in LICENSE_LIST and "selectedId" not in LICENSE_LIST)
check("software license list navigates to resource detail", "'/assets/software-licenses/' + item.id" in LICENSE_LIST)
check("software license detail route registered", 'path="assets/software-licenses/:licenseId"' in APP and "SoftwareLicenseDetailPage" in APP)
check("software license detail uses resource header", "INNOResourceHeader" in LICENSE_DETAIL)
check("software license detail names entitlement and renewal", "Entitlement & Renewal" in LICENSE_DETAIL)
check("software license detail exposes detected allocations", "Detected allocations" in LICENSE_DETAIL)
check("software license detail removes ambiguous license record wording", "License record" not in LICENSE_DETAIL and "License record" not in LICENSE_LIST)
check("software license entitlement edit is focused dialog", "INNODialog" in LICENSE_DETAIL and "Edit Entitlement & Renewal" in LICENSE_DETAIL)
check("software license detail API exists", 'MapGet("/assets/software-licenses/{licenseId}", GetSoftwareLicenseAsync)' in LICENSE_API)
check("software license detail API returns allocations", "GetSoftwareLicenseAsync" in LICENSE_API and "db.LicenseAllocations" in LICENSE_API and "ToResponse(license, usedSeats, allocations)" in LICENSE_API)
check("software license detail client exists", "export async function getSoftwareLicense" in CLIENT)

# Roles: real create/edit + permission assignment.
check("roles page exposes New Role", ">New Role</INNOButton>" in ROLES)
check("roles editor uses focused drawer", "INNODrawer" in ROLES and 'title={mode === \'create\' ? \'New Role\' : \'Edit Role\'}' in ROLES)
check("roles page supports permission assignment", "admin-permission-checklist" in ROLES and 'type="checkbox"' in ROLES)
check("roles page supports module selection", "toggleModule" in ROLES and "Select module" in ROLES and "Clear module" in ROLES)
check("roles page no longer says roles are read only", "System roles are read-only" not in ROLES)
check("roles client supports create", "export async function createAdminRole" in CLIENT and "method: 'POST'" in CLIENT)
check("roles client supports update with ETag", "export async function updateAdminRole" in CLIENT and "'If-Match': eTag" in CLIENT)
check("roles API exposes create", 'MapPost("/admin/roles", CreateRoleAsync)' in ROLE_API)
check("roles API exposes update", 'MapPut("/admin/roles/{roleId}", UpdateRoleAsync)' in ROLE_API)
check("roles mutation requires manage permission", ROLE_API.count('"admin.roles.manage"') >= 2)
check("roles mutation validates permission catalog", "validPermissionCount" in ROLE_API and "One or more permissions are invalid." in ROLE_API)
check("roles update replaces role-permission links", "db.RolePermissions.RemoveRange(existingLinks)" in ROLE_API and "db.RolePermissions.AddRange" in ROLE_API)
check("roles update uses optimistic concurrency", "ValidateRoleIfMatch" in ROLE_API and "If-Match is required" in ROLE_API)
check("platform admin guard prevents lockout", "Platform Admin must stay active" in ROLE_API and "protectedPlatformAdminPermissions" in ROLES)
check("role code normalized for stable identity", "ToLowerInvariant()" in ROLE_API)

# Inventory Query: builder-first, saved definitions are secondary.
check("inventory query no permanent two-column master detail", "inventory-query-layout" not in QUERY)
check("inventory query Saved Queries is page utility", 'Saved Queries</INNOButton>' in QUERY and "setSavedOpen(true)" in QUERY)
check("inventory query Saved Queries opens drawer", "INNODrawer" in QUERY and 'title="Saved Queries"' in QUERY)
check("inventory query uses full-width builder", 'className="inventory-query-builder prod-panel"' in QUERY)
check("inventory query uses light clause builder", "inventory-clause-block" in QUERY and "Match devices where" in QUERY)
check("inventory query removes disabled Fact selector", '<span>Fact</span>' not in QUERY and 'select value="software" disabled' not in QUERY)
check("inventory query removes dark code preview", "inventory-query-preview" not in QUERY)
check("inventory query has human-readable summary", "inventory-query-summary" in QUERY and "Condition" in QUERY and "Scope" in QUERY)
check("inventory query preserves Save as New semantics", "'Save as New'" in QUERY)
check("inventory query preserves Run as primary footer command", "INNOEditorFooter" in QUERY and "'Run Query'" in QUERY)
check("inventory query results remain separate collection", 'className="inventory-query-results"' in QUERY)
check("inventory query responsive builder rules exist", "@media (max-width: 850px)" in QUERY_CSS and "@media (max-width: 680px)" in QUERY_CSS)

# Styling ownership.
check("license entitlement grid has responsive styling", ".license-entitlement-grid" in SHELL and "@media (max-width: 1024px)" in SHELL)
check("dynamic role permission editor styling exists", ".admin-role-permissions" in SHELL and ".admin-permission-option" in SHELL)

print(f"step44h_b_checks={checks}")
print(f"step44h_b_failures={len(fails)}")
if fails:
    for item in fails:
        print("FAILED", item)
    sys.exit(1)
