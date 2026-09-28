from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

contract = read("production/services/platform-api/src/INNO.One.Contracts/Security/ISecurityPostureProvider.cs")
keycloak = read("production/services/platform-api/src/Integrations/Keycloak/KeycloakSecurityPostureProvider.cs")
keycloak_reg = read("production/services/platform-api/src/Integrations/Keycloak/KeycloakIntegrationRegistration.cs")
mesh = read("production/services/platform-api/src/Integrations/MeshCentral/MeshCentralSecurityPostureProvider.cs")
mesh_reg = read("production/services/platform-api/src/Integrations/MeshCentral/MeshCentralIntegrationRegistration.cs")
platform = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformSecurityPostureProvider.cs")
platform_reg = read("production/services/platform-api/src/Modules/Platform/PlatformModule.cs")
endpoint = read("production/services/platform-api/src/Modules/Platform/Api/AdminSecurityEndpoints.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
overview = read("production/apps/web-portal/src/pages/AdminOverviewPage.tsx")
page = read("production/apps/web-portal/src/pages/AdminSecurityPage.tsx")

for marker in [
    "ISecurityPostureProvider",
    "SecurityPostureSnapshot",
    "SecurityControlSnapshot",
]:
    if marker not in contract:
        issues.append("contract " + marker)

for marker in [
    "identity.authority.transport",
    "identity.metadata.https",
    "identity.api.audience",
    "identity.discovery",
    "identity.issuer.match",
    "identity.authorization-code",
    "identity.pkce.s256",
]:
    if marker not in keycloak:
        issues.append("keycloak control " + marker)

for forbidden in ["Password", "ClientSecret", "client_secret"]:
    if forbidden in keycloak:
        issues.append("keycloak secret field " + forbidden)

if "ISecurityPostureProvider, KeycloakSecurityPostureProvider" not in keycloak_reg:
    issues.append("keycloak provider registration")

for marker in [
    "remote-management.transport",
    "remote-management.tls-validation",
    "remote-management.credentials",
]:
    if marker not in mesh:
        issues.append("mesh control " + marker)

if "ISecurityPostureProvider, MeshCentralSecurityPostureProvider" not in mesh_reg:
    issues.append("mesh provider registration")

for marker in [
    "platform.security-permissions",
    "platform.admin-role",
    "platform.audit-ledger",
    "platform.authorization-model",
]:
    if marker not in platform:
        issues.append("platform control " + marker)

if "ISecurityPostureProvider, PlatformSecurityPostureProvider" not in platform_reg:
    issues.append("platform provider registration")

for marker in [
    'api.MapGet("/admin/security"',
    '"admin.security.view"',
    "IEnumerable<ISecurityPostureProvider>",
    'configurationMode = "deployment-managed"',
    "mutablePolicies = false",
]:
    if marker not in endpoint:
        issues.append("endpoint " + marker)

for forbidden in [
    'MapPost("/admin/security',
    'MapPut("/admin/security',
    'MapPatch("/admin/security',
    'MapDelete("/admin/security',
]:
    if forbidden in endpoint:
        issues.append("security mutation endpoint " + forbidden)

for marker in [
    '("admin.security.view", "admin", "View security posture")',
    '("admin.security.manage", "admin", "Manage security policies")',
    "Step34Permissions",
]:
    if marker not in seed:
        issues.append("seed " + marker)

if "MapAdminSecurityEndpoints()" not in program:
    issues.append("program security endpoint")

for marker in [
    "AdminSecurityStatus",
    "AdminSecurityControl",
    "AdminSecurityPostureItem",
    "AdminSecurityResponse",
]:
    if marker not in types:
        issues.append("types " + marker)

if "getAdminSecurity" not in client or "'/admin/security'" not in client:
    issues.append("client security api")

for marker in [
    "AdminSecurityPage",
    "admin.security.view",
    'path="admin/security"',
]:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    "admin.security.view",
    'to="/admin/security">Security</NavLink>',
    "Security",
]:
    if marker not in shell:
        issues.append("shell " + marker)

if 'to="/admin/security"' not in overview:
    issues.append("overview security card")

for marker in [
    'title="Security"',
    "Refresh Posture",
    "Security Posture",
    "Security policy changes are not exposed yet",
    "Observed value",
    "Needs attention",
]:
    if marker not in page:
        issues.append("page " + marker)

for forbidden in [
    "Save Security",
    "Edit Security",
    "Configure MFA",
    "Password Policy",
    "Session Policy",
]:
    if forbidden in page:
        issues.append("fake security action " + forbidden)

version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 24, 0):
    issues.append("implementation contract")

print("step34_scope=security-posture,identity,remote-management,authorization-audit")
print("step34_providers=identity,platform-controls,remote-management")
print("step34_implementation_contract=0.24.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
