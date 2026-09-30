from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

contracts = read("production/services/platform-api/src/INNO.One.Contracts/Operations/OperationContracts.cs")
reader = read("production/services/platform-api/src/INNO.One.Infrastructure/Operations/OperationReader.cs")
registration = read("production/services/platform-api/src/INNO.One.Infrastructure/InfrastructureRegistration.cs")
endpoint = read("production/services/platform-api/src/Modules/Platform/Api/OperationEndpoints.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
devices = read("production/services/platform-api/src/Modules/Devices/Api/DeviceManagementEndpoints.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
page = read("production/apps/web-portal/src/pages/DiscoveryPage.tsx")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
api_contract = read("inno-api-contract.json")
data_contract = read("INNO-One-Data-Ownership-Database-Contract.md")
for marker in [
    "public sealed record OperationSnapshot",
    "public interface IOperationReader",
    "RequiredPermission",
    "RequestedByActorId",
    "ExpiresAt",
]:
    if marker not in contracts:
        issues.append("operation contract " + marker)

for marker in [
    "public sealed class OperationReader",
    "db.Operations",
    "AsNoTracking()",
    "ReadPermission(record.PermissionContext)",
]:
    if marker not in reader:
        issues.append("operation reader " + marker)

for forbidden in ["ResultRef", "SubjectId"]:
    if forbidden in contracts:
        issues.append("sensitive/internal field leaked into public reader contract: " + forbidden)

if "AddScoped<IOperationReader, OperationReader>()" not in registration:
    issues.append("operation reader registration")
for marker in [
    'api.MapGet("/operations/{operationId}", GetOperationAsync)',
    'WithName("platform.operations.get")',
    'OpaqueId.TryParse(operationId, "op"',
    'operation.RequestedByActorId, callerId',
    "operation.RequiredPermission",
    "accessEvaluator.EvaluateAsync",
    '"queued"',
    '"running"',
    '"succeeded"',
    '"failed"',
    '"partial"',
]:
    if marker not in endpoint:
        issues.append("operation endpoint " + marker)

for forbidden in [
    "PermissionContext",
    "ResultRef",
    "SubjectId",
    "RequestedByActorId,",
]:
    response_match = endpoint.split("private sealed record OperationResourceResponse", 1)[-1]
    if forbidden in response_match:
        issues.append("public operation response leaks " + forbidden)

if "api.MapOperationEndpoints();" not in program:
    issues.append("program operation mapping")
for marker in [
    'var statusUrl = $"/api/v1/operations/{operationId}"',
    "string StatusUrl",
    "Results.Accepted(",
]:
    if marker not in devices:
        issues.append("async producer " + marker)

for marker in [
    "export type OperationState",
    "export interface OperationStatus",
    "statusUrl: string",
]:
    if marker not in types:
        issues.append("web operation type " + marker)

for marker in [
    "export async function getOperation",
    "'/operations/' + encodeURIComponent(operationId)",
]:
    if marker not in client:
        issues.append("web operation client " + marker)

for marker in [
    "getOperation",
    "operationId",
    "Canonical progress from the shared INNO.One operation resource.",
    "Operation {operation.data.operationId}",
]:
    if marker not in page:
        issues.append("discovery shared operation integration " + marker)
if '"id": "platform.operations.get"' not in api_contract:
    issues.append("frozen API operation id")
if '"path": "/operations/{operationId}"' not in api_contract:
    issues.append("frozen API operation path")
if "### integration.operations" not in data_contract:
    issues.append("frozen integration.operations ownership")

if 'DesignSystem = "V1.26"' not in versions:
    issues.append("design system version")
if 'UiContract = "1.20.0"' not in versions:
    issues.append("ui contract version")

version_match = re.search(
    r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"',
    versions,
)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 31, 0):
    issues.append("implementation contract")

print("step41_scope=shared-asynchronous-operation-resource")
print("step41_endpoint=GET /api/v1/operations/{operationId}")
print("step41_authorization=operation-owner+origin-permission")
print("step41_persistence=integration.operations-existing")
print("step41_implementation_contract=0.31.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
