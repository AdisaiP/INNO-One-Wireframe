from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
endpoint = read("production/services/platform-api/src/Modules/Platform/Api/AdminIntegrationsEndpoints.cs")
contract = read("production/services/platform-api/src/INNO.One.Contracts/Integrations/IIntegrationHealthProvider.cs")
keycloak = read("production/services/platform-api/src/Integrations/Keycloak/KeycloakIntegrationHealthProvider.cs")
keycloak_registration = read("production/services/platform-api/src/Integrations/Keycloak/KeycloakIntegrationRegistration.cs")
mesh = read("production/services/platform-api/src/Integrations/MeshCentral/MeshCentralIntegrationHealthProvider.cs")
mesh_registration = read("production/services/platform-api/src/Integrations/MeshCentral/MeshCentralIntegrationRegistration.cs")
database = read("production/services/platform-api/src/INNO.One.Infrastructure/IntegrationHealth/PostgreSqlIntegrationHealthProvider.cs")
infrastructure_registration = read("production/services/platform-api/src/INNO.One.Infrastructure/InfrastructureRegistration.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
overview = read("production/apps/web-portal/src/pages/AdminOverviewPage.tsx")
page = read("production/apps/web-portal/src/pages/AdminIntegrationsPage.tsx")
styles = read("production/apps/web-portal/src/shell.css")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")

for permission in ["admin.integrations.view", "admin.integrations.manage"]:
    if permission not in seed:
        issues.append("seed " + permission)

for marker in [
    "IIntegrationHealthProvider",
    "IntegrationHealthSnapshot",
    "Task<IntegrationHealthSnapshot> CheckAsync",
]:
    if marker not in contract:
        issues.append("contract " + marker)

for marker in [
    "AddKeycloakIntegration(builder.Configuration)",
    "AddMeshCentralIntegration(builder.Configuration)",
    "MapAdminIntegrationsEndpoints()",
]:
    if marker not in program:
        issues.append("program " + marker)

for marker in [
    'api.MapGet("/admin/integrations"',
    'api.MapPost("/admin/integrations/{integrationId}/test"',
    '"admin.integrations.view"',
    '"admin.integrations.manage"',
    "IEnumerable<IIntegrationHealthProvider>",
    '"platform.integration.tested"',
]:
    if marker not in endpoint:
        issues.append("endpoint " + marker)

providers = {
    "keycloak": (keycloak, keycloak_registration),
    "meshcentral": (mesh, mesh_registration),
    "core-database": (database, infrastructure_registration),
}
for provider_id, (implementation, registration) in providers.items():
    if provider_id not in implementation:
        issues.append("provider id " + provider_id)
    if "IIntegrationHealthProvider" not in implementation:
        issues.append("provider contract " + provider_id)
    if "IIntegrationHealthProvider" not in registration:
        issues.append("provider registration " + provider_id)

for forbidden in [
    "_options.Password",
    "connection.Password",
    "Username=",
    "Password=",
]:
    if forbidden in endpoint:
        issues.append("secret leakage endpoint " + forbidden)

for marker in [
    "AdminIntegrationStatus",
    "AdminIntegrationsResponse",
]:
    if marker not in types:
        issues.append("types " + marker)

for marker in [
    "getAdminIntegrations",
    "testAdminIntegration",
]:
    if marker not in client:
        issues.append("client " + marker)

for marker in [
    "AdminIntegrationsPage",
    "admin.integrations.view",
    'path="admin/integrations"',
]:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    "admin.integrations.view",
    'to="/admin/integrations">Integrations</NavLink>',
    "Integrations",
]:
    if marker not in shell:
        issues.append("shell " + marker)

if 'to="/admin/integrations"' not in overview:
    issues.append("overview integration card")

for marker in [
    "Integration Registry",
    "Refresh Health",
    "Configuration remains deployment-managed",
    "admin.integrations.manage",
    "testAdminIntegration",
    "integration-endpoint",
]:
    if marker not in page and marker not in styles:
        issues.append("page " + marker)

for forbidden in [
    "password",
    "secret",
    "api key",
    "client secret",
]:
    if f'<span>{forbidden}' in page.lower():
        issues.append("secret ui " + forbidden)

if "New Integration" in page or "Save Integration" in page:
    issues.append("fake integration mutation")

version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 22, 0):
    issues.append("implementation contract")

print("step32_providers=core-database,keycloak,meshcentral")
print("step32_implementation_contract_min=0.22.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
