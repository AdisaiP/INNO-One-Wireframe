#!/usr/bin/env python3
import json
from pathlib import Path
r=Path(__file__).resolve().parent
m=json.loads((r/'inno-step27-devices-software-inventory.json').read_text())
api=json.loads((r/'inno-api-contract.json').read_text())
imp=json.loads((r/'inno-implementation-contract.json').read_text())
events=json.loads((r/'inno-event-audit-contract.json').read_text())
data=json.loads((r/'inno-data-model-contract.json').read_text())
source=(r/'production/services/platform-api/src/Modules/Devices/Api/DeviceSoftwareInventoryEndpoints.cs').read_text()
db=(r/'production/services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs').read_text()
reader=(r/'production/services/platform-api/src/Modules/Devices/Application/DeviceSoftwareInventoryReader.cs').read_text()
ui=(r/'production/apps/web-portal/src/pages/DeviceDetailPage.tsx').read_text()
issues=[]
ops=m['operations']
if imp.get('contractVersion')!='0.19.0':issues.append('implementation version')
if api.get('contractVersion')!='0.5.0':issues.append('API version')
if [e['id'] for e in api['endpoints'] if e['id'].startswith('devices.software_inventory.')]!=ops:issues.append('API operations')
if imp.get('devicesSoftwareInventorySlice',{}).get('implementedOperations')!=ops:issues.append('implementation operations')
for op in ops:
    if f'.WithName("{op}")' not in source:issues.append('missing '+op)
for marker in ['"devices.view"','"devices.manage"','Status409Conflict','"complete"','"partial"','device.software_inventory.observed','devices.software_inventory.observed']:
    if marker not in source:issues.append('source marker '+marker)
for table in ['software_inventory_snapshots','installed_software']:
    if f'ToTable("{table}")' not in db:issues.append('mapping '+table)
    if table not in {x['name'] for x in data['schemas']['devices']['tables']}:issues.append('data contract '+table)
if 'IDeviceSoftwareInventoryReader' not in reader:issues.append('reader contract')
if 'Partial snapshot' not in ui:issues.append('partial UI boundary')
if 'device.software_inventory.observed' not in {x['type'] for x in events['events']}:issues.append('event')
if not any('whole device software inventory' in x for x in events['privacy']['contentRules']):issues.append('privacy guard')
migrations=list((r/'production/services/platform-api/src/Modules/Devices/Persistence/Migrations').glob('*_Step27DeviceSoftwareInventory.cs'))
if len(migrations)!=1:issues.append('migration count')
else:
    text=migrations[0].read_text()
    for table in ['software_inventory_snapshots','installed_software']:
        if f'name: "{table}"' not in text:issues.append('migration '+table)
print('step27_operations='+str(len(ops)))
print('inventory_tables=2')
print('issues='+str(len(issues)))
for issue in issues:print('ISSUE: '+issue)
raise SystemExit(bool(issues))
