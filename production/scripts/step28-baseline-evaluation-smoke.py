#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime, timezone
import json,time,urllib.parse,urllib.request,urllib.error
root=Path(__file__).resolve().parents[1]
realm=json.loads((root/'infrastructure/docker/keycloak/realm-inno-one.json').read_text())
base='http://127.0.0.1:5080/api/v1';keycloak='http://localhost:8080/realms/inno-one'
def token(name):
 u=next(x for x in realm['users'] if x['username']==name)
 b=urllib.parse.urlencode(dict(client_id='inno-one-e2e',grant_type='password',username=name,password=u['credentials'][0]['value'])).encode()
 with urllib.request.urlopen(urllib.request.Request(keycloak+'/protocol/openid-connect/token',data=b,headers={'Content-Type':'application/x-www-form-urlencoded'}),timeout=12) as r:return json.load(r)['access_token']
def call(method,path,bearer,body=None,etag=None,expected=200):
 h={'Authorization':'Bearer '+bearer,'Accept':'application/json'}
 if body is not None:h['Content-Type']='application/json'
 if etag:h['If-Match']=etag
 q=urllib.request.Request(base+path,method=method,headers=h,data=None if body is None else json.dumps(body).encode())
 try:
  with urllib.request.urlopen(q,timeout=15) as r:return r.status,json.load(r),r.headers.get('ETag')
 except urllib.error.HTTPError as e:
  payload=json.loads(e.read() or '{}');assert e.code==expected,(method,path,e.code,payload);return e.code,payload,None
admin=token('adisai');viewer=token('hr.viewer');suffix=str(int(time.time()))
definition={'code':'QA-EVAL-'+suffix,'name':'Step 28 Evaluation QA','targetCategory':None,'requiredPackages':['Microsoft 365 Apps','INNO.One Endpoint Agent'],'status':'active'}
_,created,_=call('POST','/assets/software-baselines',admin,definition,expected=201);bid=created['data']['id']
call('POST','/assets/software-baselines/'+bid+'/evaluate',viewer,expected=403)
device=next(x for x in call('GET','/devices?page=1&pageSize=10&search=DESKTOP-HR-014',admin)[1]['items'] if x['name']=='DESKTOP-HR-014')
complete={'observedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'completeness':'complete','source':'manual_import','sourceInstance':'step28-smoke','packages':[{'productKey':'inno:endpoint-agent','displayName':'INNO.One Endpoint Agent','version':'1.8.4','publisher':'INNO.One','architecture':'x64'},{'productKey':'microsoft:365-apps','displayName':'Microsoft 365 Apps','version':'2026.09','publisher':'Microsoft','architecture':'x64'}]}
_,snapshot_complete,_=call('PUT','/devices/'+device['id']+'/software-inventory',admin,complete)
_,first,_=call('POST','/assets/software-baselines/'+bid+'/evaluate',admin)
target_first=next(x for x in first['items'] if x['assetTag']=='AST-PC-000142')
assert target_first['status']=='compliant',target_first
assert first['compliantCount']>=1 and first['missingCount']>=1 and first['unknownCount']>=1,first
_,listed,_=call('GET','/assets/software-baselines/'+bid+'/results',admin)
assert listed['items'] and listed['baselineVersion']==1
time.sleep(1)
missing={'observedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'completeness':'complete','source':'manual_import','sourceInstance':'step28-smoke','packages':[{'productKey':'inno:endpoint-agent','displayName':'INNO.One Endpoint Agent','version':'1.8.4','publisher':'INNO.One','architecture':'x64'}]}
_,snapshot_missing,_=call('PUT','/devices/'+device['id']+'/software-inventory',admin,missing)
_,second,_=call('POST','/assets/software-baselines/'+bid+'/evaluate',admin)
target=next(x for x in second['items'] if x['assetTag']=='AST-PC-000142')
assert target['status']=='missing' and 'Microsoft 365 Apps' in target['missingPackages']
print('permission_scope=PASS')
print('complete_partial_unknown=PASS')
print('evidence_transition=PASS')
print('STEP28_BASELINE_EVALUATION_SMOKE_PASS',bid,snapshot_complete['data']['snapshotId'],snapshot_missing['data']['snapshotId'])
