#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parent
PROD=ROOT/'production'
manifest=json.loads((ROOT/'inno-step16-devices-management.json').read_text())
impl=json.loads((ROOT/'inno-implementation-contract.json').read_text())
api=json.loads((ROOT/'inno-api-contract.json').read_text())
issues=[]

expected_ops=[
    'devices.groups.list',
    'devices.groups.create',
    'devices.groups.get',
    'devices.groups.update',
    'devices.group_members.list',
    'devices.discovery_scan.create',
    'devices.discovery_scan.get',
    'devices.discovery_results.list',
    'devices.agent_installer.create',
]

if manifest.get('contractVersion')!='0.7.0':
    issues.append('Step 16 manifest must be version 0.7.0')
if impl.get('contractVersion')!='0.9.0':
    issues.append('current Implementation Contract must be 0.9.0')
ref=impl.get('devicesManagementSlice',{})
if ref.get('version')!='0.7.0':
    issues.append('implementation contract does not reference Step 16 0.7.0')
for key in ('documentation','manifest','audit'):
    value=ref.get(key)
    if not value or not (ROOT/value).exists():
        issues.append(f'missing Step 16 source: {key}={value}')
if ref.get('implementedOperations')!=expected_ops:
    issues.append('implementation contract Step 16 operation list mismatch')
if manifest.get('scope',{}).get('implementedOperations')!=expected_ops:
    issues.append('Step 16 manifest operation list mismatch')

api_ids={entry['id'] for entry in api.get('endpoints',[])}
for op in expected_ops:
    if op not in api_ids:
        issues.append(f'Step 16 operation missing from frozen API Contract: {op}')

endpoints=(PROD/'services/platform-api/src/Modules/Devices/Api/DeviceManagementEndpoints.cs').read_text()
program=(PROD/'services/platform-api/src/INNO.One.PlatformApi/Program.cs').read_text()
device_context=(PROD/'services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs').read_text()
engine=(PROD/'services/platform-api/src/Integrations/MeshCentral/MeshCentralRemoteDeviceEngine.cs').read_text()
engine_contract=(PROD/'services/platform-api/src/INNO.One.Contracts/Integrations/IRemoteDeviceEngine.cs').read_text()
sync_worker=(PROD/'services/platform-api/src/Modules/Devices/Infrastructure/MeshCentralSyncWorker.cs').read_text()
discovery_worker=(PROD/'services/platform-api/src/Modules/Devices/Infrastructure/DiscoveryScanWorker.cs').read_text()
ledger=(PROD/'services/platform-api/src/Modules/Devices/Infrastructure/DeviceLedgerWriter.cs').read_text()
web_root=(PROD/'apps/web-portal/src/app/AppRoot.tsx').read_text()
web_shell=(PROD/'apps/web-portal/src/app/AppShell.tsx').read_text()

routes=[
    '"/devices/groups"',
    '"/devices/groups/{groupId}"',
    '"/devices/groups/{groupId}/members"',
    '"/devices/discovery-scans"',
    '"/devices/discovery-scans/{scanId}"',
    '"/devices/discovery-scans/{scanId}/results"',
    '"/devices/agent-installers"',
]
for route in routes:
    if route not in endpoints:
        issues.append(f'missing Step 16 endpoint route: {route}')
if 'MapDeviceManagementEndpoints()' not in program:
    issues.append('Step 16 endpoints are not mapped by Platform API composition root')

for permission in ('"devices.view"','"devices.manage"','"devices.deploy"'):
    if permission not in endpoints:
        issues.append(f'missing server-side permission check: {permission}')
for marker in ('IfMatch','Status428PreconditionRequired','Status412PreconditionFailed','BeginTransactionAsync'):
    if marker not in endpoints:
        issues.append(f'group mutation missing concurrency/transaction marker: {marker}')
for action in ('devices.group.created','devices.group.updated'):
    if action not in endpoints:
        issues.append(f'missing group audit action: {action}')

for table in ('"device_groups"','"device_group_members"','"discovery_scans"','"discovery_results"'):
    if table not in device_context:
        issues.append(f'Devices DbContext missing table mapping: {table}')

for marker in ('/control.ashx','x-meshauth','createmesh','editmesh','createInviteLink','"nodes"'):
    if marker not in engine:
        issues.append(f'MeshCentral adapter missing protocol marker: {marker}')
for method in ('ListGroupsAsync','CreateGroupAsync','UpdateGroupAsync','ListNodesAsync','CreateEnrollmentLinkAsync'):
    if method not in engine_contract or method not in engine:
        issues.append(f'remote device engine method missing: {method}')

if 'device.online' not in sync_worker or 'device.offline' not in sync_worker:
    issues.append('live sync worker must emit frozen connectivity facts through outbox')
if 'DeviceExternalMappings' not in sync_worker:
    issues.append('live sync must persist vendor mapping behind canonical Device ID')
if 'ExternalId' not in sync_worker:
    issues.append('live sync does not consume remote vendor identifier internally')
if 'PrivateNetworkRange.TryExpand' not in discovery_worker:
    issues.append('discovery worker does not use bounded private-network validation')
if 'integration.operations' not in ledger or 'integration.outbox_messages' not in ledger or 'audit.audit_records' not in ledger:
    issues.append('execution/audit/outbox ledger boundary incomplete')

infra_migrations=list((PROD/'services/platform-api/src/INNO.One.Infrastructure/Persistence/Migrations').glob('*_Step16ExecutionLedger.cs'))
device_migrations=list((PROD/'services/platform-api/src/Modules/Devices/Persistence/Migrations').glob('*_Step16DevicesManagement.cs'))
if len(infra_migrations)!=1:
    issues.append(f'expected one Step16ExecutionLedger migration, found {len(infra_migrations)}')
if len(device_migrations)!=1:
    issues.append(f'expected one Step16DevicesManagement migration, found {len(device_migrations)}')

compose=(PROD/'infrastructure/docker/compose.yml').read_text()
if 'ghcr.io/ylianst/meshcentral:1.2.6' not in compose:
    issues.append('local development must pin the Step 16 MeshCentral checkpoint image')
if '8443:443' not in compose:
    issues.append('local MeshCentral HTTPS port checkpoint missing')

for route,component in [
    ('path="devices/discovery"','<DiscoveryPage'),
    ('path="devices/groups"','<DeviceGroupsPage'),
    ('path="devices/groups/:groupId"','<DeviceGroupDetailPage'),
    ('path="devices/add"','<AgentDeploymentPage'),
]:
    if route not in web_root or component not in web_root:
        issues.append(f'missing production Web route/component: {route}')
for label in ('Discovery','Device Groups','Agent Deployment'):
    if label not in web_shell:
        issues.append(f'missing implemented Devices navigation item: {label}')

for file in (
    'apps/web-portal/src/pages/DeviceGroupsPage.tsx',
    'apps/web-portal/src/pages/DeviceGroupDetailPage.tsx',
    'apps/web-portal/src/pages/DiscoveryPage.tsx',
    'apps/web-portal/src/pages/AgentDeploymentPage.tsx',
):
    if not (PROD/file).exists():
        issues.append(f'missing Step 16 Web page: {file}')

# Public API response records in the endpoint source must not expose vendor IDs.
for match in re.finditer(r'private sealed record (\w+Response)\((.*?)\);',endpoints,re.S):
    if 'ExternalId' in match.group(2) or 'ExternalGroupId' in match.group(2):
        issues.append(f'public response leaks vendor identifier: {match.group(1)}')

if manifest.get('scope',{}).get('dynamicDeviceGroupsImplemented') is not False:
    issues.append('dynamic groups must remain hidden until their rule engine is implemented')
if manifest.get('scope',{}).get('canonicalDeviceIdBoundary') is not True:
    issues.append('Step 16 must preserve canonical Device IDs')

print('step16_contract_version='+str(manifest.get('contractVersion')))
print('implemented_operations='+str(len(expected_ops)))
print('web_routes='+str(len(manifest.get('scope',{}).get('webRoutes',[]))))
print('infrastructure_migrations='+str(len(infra_migrations)))
print('devices_step16_migrations='+str(len(device_migrations)))
print('issues='+str(len(issues)))
for issue in issues:
    print('ISSUE: '+issue)
raise SystemExit(1 if issues else 0)
