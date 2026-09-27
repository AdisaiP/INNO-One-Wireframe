#!/usr/bin/env python3
import json
from pathlib import Path
r=Path(__file__).resolve().parent
m=json.loads((r/'inno-step26-software-baselines.json').read_text())
api=json.loads((r/'inno-api-contract.json').read_text())
imp=json.loads((r/'inno-implementation-contract.json').read_text())
source=(r/'production/services/platform-api/src/Modules/Assets/Api/SoftwareBaselineEndpoints.cs').read_text()
issues=[]
ops=m['operations']
if imp.get('contractVersion')!='0.18.0':issues.append('implementation version')
if api.get('contractVersion')!='0.4.0':issues.append('API version')
if [e['id'] for e in api['endpoints'] if e['id'].startswith('assets.baselines.')]!=ops:issues.append('API operation catalog')
if imp.get('softwareBaselineDefinitionsSlice',{}).get('implementedOperations')!=ops:issues.append('implementation operation catalog')
for op in ops:
    if f'.WithName("{op}")' not in source:issues.append('missing '+op)
for marker in ['"assets.baseline.manage"','"assets.view"','Status412PreconditionFailed','"awaiting_inventory"','assets.baseline.created','assets.baseline.updated']:
    if marker not in source:issues.append('missing '+marker)
db=(r/'production/services/platform-api/src/Modules/Assets/Persistence/AssetsDbContext.cs').read_text()
if 'ToTable("software_baselines")' not in db:issues.append('missing table')
if 'ToTable("baseline_results")' in db:issues.append('fabricated result model')
if 'baseline.drift' in source:issues.append('drift without inventory')
migrations=list((r/'production/services/platform-api/src/Modules/Assets/Persistence/Migrations').glob('*_Step26SoftwareBaselineDefinitions.cs'))
if len(migrations)!=1:issues.append('migration count')
elif 'name: "software_baselines"' not in migrations[0].read_text():issues.append('migration table')
print('step26_operations='+str(len(ops)))
print('evaluation_status='+m['evaluationStatus'])
print('issues='+str(len(issues)))
for issue in issues:print('ISSUE: '+issue)
raise SystemExit(bool(issues))
