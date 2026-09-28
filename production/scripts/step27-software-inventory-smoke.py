#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime, timezone, timedelta
import json, urllib.parse, urllib.request, urllib.error
root=Path(__file__).resolve().parents[1]
realm=json.loads((root/'infrastructure/docker/keycloak/realm-inno-one.json').read_text())
base='http://127.0.0.1:5080/api/v1'
keycloak='http://localhost:8080/realms/inno-one'
def token(name):
    user=next(x for x in realm['users'] if x['username']==name)
    body=urllib.parse.urlencode(dict(client_id='inno-one-e2e',grant_type='password',username=name,password=user['credentials'][0]['value'])).encode()
    request=urllib.request.Request(keycloak+'/protocol/openid-connect/token',data=body,headers={'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(request,timeout=12) as response:return json.load(response)['access_token']
def call(method,path,bearer,body=None,expected=200):
    headers={'Authorization':'Bearer '+bearer,'Accept':'application/json'}
    if body is not None:headers['Content-Type']='application/json'
    request=urllib.request.Request(base+path,method=method,headers=headers,data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(request,timeout=15) as response:status=response.status;payload=json.load(response)
    except urllib.error.HTTPError as error:status=error.code;payload=json.loads(error.read() or '{}')
    assert status==expected,(method,path,status,payload)
    return payload
admin=token('adisai')
viewer=token('hr.viewer')
devices=call('GET','/devices?page=1&pageSize=10&search=DESKTOP-HR-014',admin)
device_id=devices['items'][0]['id']
before=call('GET','/devices/'+device_id+'/software-inventory',admin)['data']
assert before['inventoryStatus'] in ('complete','partial')
now=datetime.now(timezone.utc).replace(microsecond=0)
report={'observedAt':now.isoformat().replace('+00:00','Z'),'completeness':'partial','source':'manual_import','sourceInstance':'step27-smoke','packages':[{'productKey':'qa:step27-tool','displayName':'Step 27 QA Tool','version':'1.0','publisher':'INNO.One QA','architecture':'x64'},{'displayName':'Derived Product Key','version':'2.0','publisher':'INNO.One QA','architecture':'universal'}]}
call('PUT','/devices/'+device_id+'/software-inventory',viewer,report,expected=403)
bad={**report,'observedAt':(now+timedelta(minutes=10)).isoformat().replace('+00:00','Z')}
call('PUT','/devices/'+device_id+'/software-inventory',admin,bad,expected=400)
dupe={**report,'packages':[report['packages'][0],report['packages'][0]]}
call('PUT','/devices/'+device_id+'/software-inventory',admin,dupe,expected=400)
saved=call('PUT','/devices/'+device_id+'/software-inventory',admin,report)['data']
assert saved['inventoryStatus']=='partial' and saved['packageCount']==2 and saved['snapshotId'].startswith('swi_')
latest=call('GET','/devices/'+device_id+'/software-inventory',admin)['data']
assert latest['snapshotId']==saved['snapshotId'] and latest['packages'][0]['productKey']
call('PUT','/devices/'+device_id+'/software-inventory',admin,report,expected=409)
print('permission_validation=PASS')
print('read_write_stale=PASS')
print('STEP27_SOFTWARE_INVENTORY_SMOKE_PASS',device_id,saved['snapshotId'])
