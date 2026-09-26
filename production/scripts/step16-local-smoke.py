#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
API='http://127.0.0.1:5080/api/v1'
KEYCLOAK='http://localhost:8080/realms/inno-one'
realm=json.loads((ROOT/'infrastructure/docker/keycloak/realm-inno-one.json').read_text())

def credentials(username):
    user=next(x for x in realm['users'] if x['username']==username)
    return username,user['credentials'][0]['value']

def token(username):
    user,password=credentials(username)
    body=urllib.parse.urlencode({
        'client_id':'inno-one-e2e',
        'grant_type':'password',
        'username':user,
        'password':password,
    }).encode()
    request=urllib.request.Request(
        KEYCLOAK+'/protocol/openid-connect/token',
        data=body,
        headers={'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(request,timeout=10) as response:
        return json.load(response)['access_token']

def api(method,path,access_token,body=None,headers=None,expected=None):
    data=None if body is None else json.dumps(body).encode()
    merged={'Accept':'application/json','Authorization':'Bearer '+access_token}
    if body is not None:
        merged['Content-Type']='application/json'
    if headers:
        merged.update(headers)
    req=urllib.request.Request(API+path,data=data,headers=merged,method=method)
    try:
        with urllib.request.urlopen(req,timeout=15) as response:
            payload=json.loads(response.read() or b'{}')
            status=response.status
            response_headers=dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        status=exc.code
        raw=exc.read()
        payload=json.loads(raw or b'{}')
        response_headers=dict(exc.headers.items())
    if expected is not None and status != expected:
        raise AssertionError(f'{method} {path}: expected {expected}, got {status}: {payload}')
    return status,payload,response_headers

def mesh_groups():
    result=subprocess.run(
        ['node','scripts/step16-meshcontrol.mjs','groups'],
        cwd=ROOT,capture_output=True,text=True,timeout=15,check=True)
    return json.loads(result.stdout or '[]')

def psql_scalar(sql):
    result=subprocess.run(
        ['docker','exec','inno-one-local-postgres-1','psql','-U','inno','-d','inno_core','-Atc',sql],
        cwd=ROOT,capture_output=True,text=True,timeout=15,check=True)
    return result.stdout.strip()

admin=token('adisai')
viewer=token('hr.viewer')

_,profile,_=api('GET','/platform/me',admin,expected=200)
profile=profile['data']
assert 'devices.manage' in profile['permissions']
assert 'devices.deploy' in profile['permissions']
assert profile['organization'] and profile['location']
print('admin_profile=PASS')

_,groups,_=api('GET','/devices/groups?page=1&pageSize=100',admin,expected=200)
assert groups['totalItems'] >= 3
assert 'ExternalGroupId' not in json.dumps(groups)
print('groups_list=PASS total='+str(groups['totalItems']))

_,viewer_groups,_=api('GET','/devices/groups?page=1&pageSize=100',viewer,expected=200)
assert all(item.get('organization') == 'Human Resources' for item in viewer_groups['items'])
api(
    'POST','/devices/groups',viewer,
    {'name':'Should Not Create','groupType':'static',
     'organizationId':profile['organization']['id'],
     'locationId':profile['location']['id']},
    expected=403)
print('group_scope=PASS viewer_total='+str(viewer_groups['totalItems']))

suffix=str(int(time.time()))[-7:]
code='QA-'+suffix
name='Step16 QA '+suffix
_,created,created_headers=api(
    'POST','/devices/groups',admin,
    {
        'name':name,
        'code':code,
        'description':'Step 16 live integration verification',
        'groupType':'static',
        'organizationId':profile['organization']['id'],
        'locationId':profile['location']['id'],
    },
    expected=201)
group=created['data']
group_id=group['id']
assert group_id.startswith('grp_')
assert group['syncStatus'] in ('pending','synced')
assert 'External' not in json.dumps(group)
assert created_headers.get('ETag') or group.get('eTag')
print('group_create=PASS id='+group_id)

external=None
deadline=time.time()+15
while time.time()<deadline:
    for row in mesh_groups():
        if row.get('name') == name:
            external=row.get('_id') or row.get('id')
            break
    if external:
        break
    time.sleep(.5)
assert external and external.startswith('mesh/')
enrollment_external=external
print('mesh_group_provision=PASS')

_,detail,detail_headers=api('GET','/devices/groups/'+group_id,admin,expected=200)
detail=detail['data']
etag=detail_headers.get('ETag') or detail['eTag']
assert etag
_,updated,updated_headers=api(
    'PATCH','/devices/groups/'+group_id,admin,
    {'description':'Step 16 updated through ETag','status':'active'},
    headers={'If-Match':etag},
    expected=200)
new_etag=updated_headers.get('ETag') or updated['data']['eTag']
assert new_etag != etag
api(
    'PATCH','/devices/groups/'+group_id,admin,
    {'description':'stale update'},
    headers={'If-Match':etag},
    expected=412)
print('group_etag=PASS')

_,installer,_=api(
    'POST','/devices/agent-installers',admin,
    {'groupId':group_id,'operatingSystem':'windows','profile':'standard','expiresHours':24},
    expected=200)
installer=installer['data']
assert installer['id'].startswith('ins_')
assert installer['enrollmentUrl'].startswith(('https://','http://'))
assert external not in json.dumps(installer)
print('agent_enrollment=PASS')

api(
    'POST','/devices/discovery-scans',admin,
    {'ranges':['8.8.8.8/32']},
    expected=400)
_,accepted,_=api(
    'POST','/devices/discovery-scans',admin,
    {'ranges':['127.0.0.1/32']},
    expected=202)
scan_id=accepted['resource']['scanId']
assert scan_id.startswith('scan_')
deadline=time.time()+20
scan=None
while time.time()<deadline:
    _,payload,_=api('GET','/devices/discovery-scans/'+scan_id,admin,expected=200)
    scan=payload['data']
    if scan['status'] in ('succeeded','failed'):
        break
    time.sleep(.4)
assert scan and scan['status']=='succeeded', scan
assert scan['addressesScanned']==1
_,results,_=api('GET',f'/devices/discovery-scans/{scan_id}/results?page=1&pageSize=25',admin,expected=200)
assert results['totalItems'] >= 1
assert results['items'][0]['ipAddress']=='127.0.0.1'
print('discovery_async=PASS results='+str(results['totalItems']))

node_name='STEP16-LIVE-'+suffix
harness_name='Step16 Sync Harness '+suffix
harness_result=subprocess.run(
    ['node','scripts/step16-meshcontrol.mjs','create-agentless-group',
     '--name',harness_name,
     '--description','Step 16 live MeshCentral synchronization QA'],
    cwd=ROOT,capture_output=True,text=True,timeout=15,check=True)
harness=json.loads(harness_result.stdout)
harness_external=harness['meshid']
assert harness_external.startswith('mesh/')

canonical_group_uuid=str(uuid.UUID(group_id.removeprefix('grp_')))
subprocess.run(
    ['docker','exec','inno-one-local-postgres-1','psql','-U','inno','-d','inno_core','-v','ON_ERROR_STOP=1','-c',
     "update devices.device_groups set external_provider='meshcentral', external_group_id='"+
     harness_external.replace("'","''")+
     "', sync_status='pending', updated_at=now() where id='"+canonical_group_uuid+"'::uuid;"],
    cwd=ROOT,capture_output=True,text=True,timeout=15,check=True)

subprocess.run(
    ['node','scripts/step16-meshcontrol.mjs','add-local',
     '--group-id',harness_external,'--name',node_name,'--hostname','127.0.0.1','--type','4'],
    cwd=ROOT,capture_output=True,text=True,timeout=15,check=True)
print('mesh_local_node_created=PASS')

deadline=time.time()+25
canonical=None
while time.time()<deadline:
    _,payload,_=api(
        'GET','/devices?page=1&pageSize=25&search='+urllib.parse.quote(node_name),
        admin,expected=200)
    if payload['totalItems'] >= 1:
        canonical=payload['items'][0]
        break
    time.sleep(1)
assert canonical, 'MeshCentral node was not synchronized into canonical Devices'
assert canonical['id'].startswith('dev_')
assert 'node/' not in json.dumps(canonical)
_,device,_=api('GET','/devices/'+canonical['id'],admin,expected=200)
device=device['data']
assert device['managementEngine']=='MeshCentral'
assert 'node/' not in json.dumps(device)
assert enrollment_external not in json.dumps(device)
assert harness_external not in json.dumps(device)
print('live_mesh_sync=PASS device='+canonical['id'])

assert scan['operationId'].startswith('op_')
assert group_id in json.dumps(installer)

audit_count=int(psql_scalar(
    "select count(*) from audit.audit_records where action in ('devices.group.created','devices.group.updated');") or '0')
operation_state=psql_scalar(
    "select status from integration.operations where operation_type='devices.discovery_scan' order by created_at desc limit 1;")
mapping_count=int(psql_scalar(
    "select count(*) from devices.device_external_mappings m join devices.devices d on d.id=m.device_id where d.hostname='"+
    node_name.replace("'","''")+
    "' and m.provider='meshcentral';") or '0')
assert audit_count >= 2
assert operation_state == 'succeeded'
assert mapping_count == 1
print('durable_operation_contract=PASS operation='+scan['operationId']+' audits='+str(audit_count))

print('STEP16_RUNTIME_SMOKE_PASS')
