from pathlib import Path

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
directory = read("production/services/platform-api/src/Modules/Platform/Api/AdminDirectoryEndpoints.cs")
access = read("production/services/platform-api/src/Modules/Platform/Api/AdminAccessEndpoints.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
styles = read("production/apps/web-portal/src/shell.css")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")

for marker in ["api.MapAdminDirectoryEndpoints();", "api.MapAdminAccessEndpoints();"]:
    if marker not in program:
        issues.append("program " + marker)

permissions = [
    "admin.access",
    "admin.organization.view",
    "admin.organization.manage",
    "admin.locations.view",
    "admin.locations.manage",
    "admin.positions.view",
    "admin.positions.manage",
    "admin.users.view",
    "admin.users.manage",
    "admin.roles.view",
    "admin.roles.manage",
    "admin.access_scopes.view",
    "admin.access_scopes.manage",
    "admin.access_scopes.evaluate",
]
for permission in permissions:
    if permission not in seed:
        issues.append("seed " + permission)

directory_routes = [
    'api.MapGet("/admin/overview"',
    'api.MapGet("/admin/organization/tree"',
    'api.MapPost("/admin/organization/units"',
    'api.MapPut("/admin/organization/units/{unitId}"',
    'api.MapGet("/admin/locations/tree"',
    'api.MapPost("/admin/locations"',
    'api.MapPut("/admin/locations/{locationId}"',
    'api.MapGet("/admin/positions"',
    'api.MapPost("/admin/positions"',
    'api.MapPut("/admin/positions/{positionId}"',
    'api.MapGet("/admin/users"',
    'api.MapGet("/admin/users/{userId}"',
    'api.MapPost("/admin/users"',
    'api.MapPut("/admin/users/{userId}"',
]
for marker in directory_routes:
    if marker not in directory:
        issues.append("directory endpoint " + marker)

for marker in [
    '"platform.organization.created"',
    '"platform.organization.updated"',
    '"platform.location.created"',
    '"platform.location.updated"',
    '"platform.position.created"',
    '"platform.position.updated"',
    '"platform.user.created"',
    '"platform.user.updated"',
    '"platform.user.status_changed"',
    "ValidateIfMatch",
]:
    if marker not in directory:
        issues.append("directory behavior " + marker)

access_routes = [
    'api.MapGet("/admin/roles"',
    'api.MapGet("/admin/permissions"',
    'api.MapGet("/admin/access-assignments"',
    'api.MapGet("/admin/access-assignments/{assignmentId}"',
    'api.MapPut("/admin/access-assignments/{assignmentId}"',
    'api.MapGet("/admin/access-scopes/effective-tree"',
    'api.MapPost("/admin/access-scopes/evaluate"',
]
for marker in access_routes:
    if marker not in access:
        issues.append("access endpoint " + marker)

for marker in [
    '"platform.access_assignment.updated"',
    '"platform.access_evaluated"',
    "ValidateIfMatch",
]:
    if marker not in access:
        issues.append("access behavior " + marker)

for marker in [
    "AdminOverview",
    "AdminHierarchyItem",
    "AdminUserDetail",
    "AdminRole",
    "AdminPermission",
    "AdminAccessAssignment",
    "AdminAccessEvaluation",
]:
    if marker not in types:
        issues.append("types " + marker)

for marker in [
    "getAdminOverview",
    "getAdminOrganizationTree",
    "getAdminLocations",
    "getAdminPositions",
    "getAdminUsers",
    "getAdminUser",
    "getAdminRoles",
    "getAdminPermissions",
    "getAdminAccessAssignments",
    "updateAdminAccessAssignment",
    "evaluateAdminAccess",
]:
    if marker not in client:
        issues.append("client " + marker)

routes = [
    'path="admin" element={canAdmin ? <AdminOverviewPage />',
    'path="admin/organization" element={canAdminOrganization ? <AdminOrganizationPage />',
    'path="admin/locations" element={canAdminLocations ? <AdminLocationsPage />',
    'path="admin/positions" element={canAdminPositions ? <AdminPositionsPage />',
    'path="admin/users" element={canAdminUsers ? <AdminUsersPage />',
    'path="admin/users/:userId" element={canAdminUsers ? <AdminUserDetailPage />',
    'path="admin/roles" element={canAdminRoles ? <AdminRolesPage />',
    'path="admin/access-scopes" element={canAdminScopes ? <AdminAccessScopesPage />',
    'path="admin/apps" element={canAdminApps ? <AdminAppsPage />',
]
for marker in routes:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    'to="/admin">Overview</NavLink>',
    'to="/admin/organization">Structure</NavLink>',
    'to="/admin/locations">Locations</NavLink>',
    'to="/admin/positions">Positions</NavLink>',
    'to="/admin/users">Users</NavLink>',
    'to="/admin/roles">Roles & Permissions</NavLink>',
    'to="/admin/access-scopes">Access Scopes</NavLink>',
    'to="/admin/apps">Apps & Modules</NavLink>',
]:
    if marker not in shell:
        issues.append("shell " + marker)

for marker in [
    "admin-master-detail",
    "admin-overview-grid",
    "admin-role-grid",
    "admin-evaluate-panel",
]:
    if marker not in styles:
        issues.append("style " + marker)

import re
version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 21, 0):
    issues.append("implementation contract")

for page in [
    "AdminOverviewPage.tsx",
    "AdminHierarchyPage.tsx",
    "AdminPositionsPage.tsx",
    "AdminUsersPage.tsx",
    "AdminUserDetailPage.tsx",
    "AdminRolesPage.tsx",
    "AdminAccessScopesPage.tsx",
]:
    page_text = read("production/apps/web-portal/src/pages/" + page)
    if "INNOPage" not in page_text:
        issues.append("page shell " + page)
    if "alert(" in page_text or "confirm(" in page_text or "prompt(" in page_text:
        issues.append("native dialog " + page)

roles_page = read("production/apps/web-portal/src/pages/AdminRolesPage.tsx")
if ">Edit<" in roles_page or "New Role" in roles_page:
    issues.append("fake role mutation")

access_page = read("production/apps/web-portal/src/pages/AdminAccessScopesPage.tsx")
if "New Assignment" in access_page:
    issues.append("fake assignment create")

print("step31_scope=overview,organization,locations,positions,users,roles,access-scopes")
print("step31_implementation_contract=0.21.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
