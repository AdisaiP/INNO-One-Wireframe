from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

endpoint = read("production/services/platform-api/src/Modules/Platform/Api/PlatformEndpoints.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
client = read("production/apps/web-portal/src/api/client.ts")
page = read("production/apps/web-portal/src/pages/ProfilePage.tsx")
styles = read("production/apps/web-portal/src/shell.css")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
api_contract = read("inno-api-contract.json")
prototype = read("profile.html")

for marker in [
    'api.MapPatch("/platform/me/profile", UpdateProfileAsync)',
    '"platform.workspace.access"',
    "ProfileUpdateRequest",
    "profile.Version += 1",
    "profile.UpdatedAt = DateTimeOffset.UtcNow",
]:
    if marker not in endpoint:
        issues.append("profile endpoint " + marker)

request_match = re.search(
    r"private sealed record ProfileUpdateRequest\(([^)]*)\);",
    endpoint,
)
if not request_match:
    issues.append("profile update request missing")
else:
    request_fields = request_match.group(1)
    for marker in ["string? Phone", "string? Office"]:
        if marker not in request_fields:
            issues.append("profile editable field " + marker)
    for forbidden in [
        "FullName",
        "Email",
        "EmployeeId",
        "Organization",
        "Position",
        "Location",
        "Role",
        "TimeZone",
        "Sso",
    ]:
        if forbidden in request_fields:
            issues.append("organization-managed field became self editable: " + forbidden)

for marker in [
    "request.Phone is { Length: > 64 }",
    "request.Office is { Length: > 120 }",
    "Phone or office must be supplied.",
]:
    if marker not in endpoint:
        issues.append("profile validation " + marker)

for marker in [
    "updateCurrentProfile",
    "'/platform/me/profile'",
    "method: 'PATCH'",
]:
    if marker not in client:
        issues.append("web client " + marker)

for marker in [
    "Personal contact details",
    "Save profile",
    "Phone",
    "Office",
    "Organization-managed fields stay read only.",
    "Personal preferences are not exposed in this production slice.",
    "updateCurrentProfile",
]:
    if marker not in page:
        issues.append("profile page " + marker)
for forbidden in [
    "Email notifications",
    "Desktop notifications",
    "Compact tables",
    "Interface language",
]:
    if forbidden in page:
        issues.append("unpersisted preference exposed: " + forbidden)

for marker in [
    ".profile-edit-form",
    ".profile-edit-grid",
    ".profile-edit-actions",
    ".profile-save-error",
    ".profile-save-success",
]:
    if marker not in styles:
        issues.append("profile style " + marker)

if 'path="profile"' not in root:
    issues.append("profile route missing")

if '"id": "platform.profile.update"' not in api_contract:
    issues.append("API contract profile update operation missing")
if '"path": "/platform/me/profile"' not in api_contract:
    issues.append("API contract profile path missing")

for marker in [
    "Profile & Settings",
    "Profile & Security",
    "Preferences",
]:
    if marker not in prototype:
        issues.append("prototype reference " + marker)

if 'DesignSystem = "V1.26"' not in versions:
    issues.append("design system version")
if 'UiContract = "1.20.0"' not in versions:
    issues.append("ui contract version")
version_match = re.search(
    r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"',
    versions,
)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 30, 0):
    issues.append("implementation contract")

print("step40_scope=profile-settings")
print("step40_permission=platform.workspace.access")
print("step40_self_editable_fields=phone,office")
print("step40_identity_provider=keycloak")
print("step40_implementation_contract=0.30.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
