#!/usr/bin/env python3
"""Run against a temporary development API with its current PostgreSQL/Keycloak stack."""
from pathlib import Path
import json, time, urllib.parse, urllib.request, urllib.error

root=Path(__file__).resolve().parents[1]
realm=json.loads((root/'infrastructure/docker/keycloak/realm-inno-one.json').read_text())
base='http://127.0.0.1:5080/api/v1'
keycloak='http://localhost:8080/realms/inno-one'

def token(name):
    user=next(x for x in realm['users'] if x['username']==name)
    body=urllib.parse.urlencode(dict(client_id='inno-one-e2e',grant_type='password',
        username=name,password=user['credentials'][0]['value'])).encode()
    request=urllib.request.Request(keycloak+'/protocol/openid-connect/token',data=body,
        headers={'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(request,timeout=12) as response:return json.load(response)['access_token']

def call(method,path,bearer,body=None,etag=None,expected=200):
    headers={'Authorization':'Bearer '+bearer,'Accept':'application/json'}
    if body is not None:headers['Content-Type']='application/json'
    if etag:headers['If-Match']=etag
    request=urllib.request.Request(base+path,method=method,headers=headers,
        data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(request,timeout=15) as response:
            status=response.status;payload=json.load(response);response_etag=response.headers.get('ETag')
    except urllib.error.HTTPError as error:
        status=error.code;payload=json.loads(error.read() or '{}');response_etag=None
    assert status==expected,(method,path,status,payload)
    return payload,response_etag

admin=token('adisai')
viewer=token('hr.viewer')
suffix=str(int(time.time()))
code='QA-STEP26-'+suffix
draft=dict(code=code,name='Step 26 Baseline QA',targetCategory='Computer',
    requiredPackages=['Endpoint Protection','Microsoft 365 Apps'],status='draft')
call('POST','/assets/software-baselines',viewer,draft,expected=403)
call('POST','/assets/software-baselines',admin,{**draft,'requiredPackages':[]},expected=400)
print('permission_validation=PASS')
created,etag=call('POST','/assets/software-baselines',admin,draft,expected=201)
id=created['data']['id']
assert id.startswith('baseline_') and created['data']['evaluationStatus']=='awaiting_inventory'
assert etag=='W/"1"'
call('POST','/assets/software-baselines',admin,draft,expected=409)
call('GET','/assets/software-baselines?search='+code,viewer,expected=403)
listed,_=call('GET','/assets/software-baselines?search='+code,admin)
assert listed['totalItems']==1 and listed['items'][0]['id']==id
detail,_=call('GET','/assets/software-baselines/'+id,admin)
assert detail['data']['requiredPackages']==draft['requiredPackages']
print('create_list_read=PASS')
update={**draft,'name':'Step 26 Updated','status':'active'}
call('PATCH','/assets/software-baselines/'+id,admin,update,expected=412)
updated,new_etag=call('PATCH','/assets/software-baselines/'+id,admin,update,etag=etag)
assert updated['data']['name']=='Step 26 Updated' and new_etag=='W/"2"'
call('PATCH','/assets/software-baselines/'+id,admin,update,etag=etag,expected=412)
assert updated['data']['evaluationStatus']=='awaiting_inventory'
print('etag_update=PASS')
print('STEP26_DEFINITIONS_SMOKE_PASS',code,id)
