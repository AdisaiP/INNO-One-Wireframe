#!/usr/bin/env python3
import json
from pathlib import Path
r=Path(__file__).resolve().parent
m=json.loads((r/'inno-step28-software-baseline-evaluation.json').read_text())
api=json.loads((r/'inno-api-contract.json').read_text())
imp=json.loads((r/'inno-implementation-contract.json').read_text())
ev=json.loads((r/'inno-event-audit-contract.json').read_text())
data=json.loads((r/'inno-data-model-contract.json').read_text())
source=(r/'production/services/platform-api/src/Modules/Assets/Api/SoftwareBaselineEvaluationEndpoints.cs').read_text()
definitions=(r/'production/services/platform-api/src/Modules/Assets/Api/SoftwareBaselineEndpoints.cs').read_text()
db=(r/'production/services/platform-api/src/Modules/Assets/Persistence/AssetsDbContext.cs').read_text()
ui=(r/'production/apps/web-portal/src/pages/SoftwareBaselinesPage.tsx').read_text()
issues=[]
ops=m['operations']
if imp.get('contractVersion')!='0.19.0':issues.append('implementation version')
if api.get('contractVersion')!='0.5.0':issues.append('API version')
if [x['id'] for x in api['endpoints'] if x['id'] in ops]!=ops:issues.append('API operations')
if imp.get('softwareBaselineEvaluationSlice',{}).get('implementedOperations')!=ops:issues.append('implementation operations')
for op in ops:
 if f'.WithName("{op}")' not in source:issues.append('source '+op)
for marker in ['IDeviceSoftwareInventoryReader','FreshnessWindow = TimeSpan.FromHours(24)','partial_inventory','stale_inventory','no_inventory','no_linked_device','baseline.drift','IsEvidenceBacked','assets.baseline.evaluated']:
 if marker not in source:issues.append('source marker '+marker)
if 'ToTable("baseline_results")' not in db:issues.append('table mapping')
if 'baseline_results' not in {x['name'] for x in data['schemas']['assets']['tables']}:issues.append('data contract')
if 'not_evaluated' not in definitions or '"stale"' not in definitions:issues.append('definition status')
if 'Evaluate Now' not in ui or 'Missing, stale or partial inventory remains Unknown.' not in ui:issues.append('UI evaluation boundary')
if 'baseline.drift' not in {x['type'] for x in ev['events']}:issues.append('drift event')
if 'assets.baseline.evaluated' not in {x['action'] for x in ev['auditActions']}:issues.append('audit action')
migrations=list((r/'production/services/platform-api/src/Modules/Assets/Persistence/Migrations').glob('*_Step28SoftwareBaselineEvaluation.cs'))
if len(migrations)!=1:issues.append('migration count')
elif 'name: "baseline_results"' not in migrations[0].read_text():issues.append('migration table')
print('step28_operations='+str(len(ops)))
print('freshness_hours='+str(m['freshnessHours']))
print('issues='+str(len(issues)))
for x in issues:print('ISSUE: '+x)
raise SystemExit(bool(issues))
