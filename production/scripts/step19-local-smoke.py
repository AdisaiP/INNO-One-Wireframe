#!/usr/bin/env python3
from pathlib import Path
import json
import shlex
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = 'http://127.0.0.1:5080/api/v1'
KEYCLOAK = 'http://localhost:8080/realms/inno-one'
realm = json.loads((ROOT / 'infrastructure/docker/keycloak/realm-inno-one.json').read_text())

def token(username):
    user = next(x for x in realm['users'] if x['username'] == username)
    body = urllib.parse.urlencode({
        'client_id': 'inno-one-e2e',
        'grant_type': 'password',
        'username': username,
        'password': user['credentials'][0]['value'],
    }).encode()
    request = urllib.request.Request(
        KEYCLOAK + '/protocol/openid-connect/token',
        data=body,
        headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)['access_token']

def api(method, path, access_token=None, body=None, headers=None, expected=None):
    data = None if body is None else json.dumps(body).encode()
    merged = {'Accept': 'application/json'}
    if access_token:
        merged['Authorization'] = 'Bearer ' + access_token
    if body is not None:
        merged['Content-Type'] = 'application/json'
    if headers:
        merged.update(headers)
    request = urllib.request.Request(API + path, data=data, headers=merged, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status = response.status
            raw = response.read()
            payload = json.loads(raw or b'{}')
            response_headers = dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read()
        try:
            payload = json.loads(raw or b'{}')
        except json.JSONDecodeError:
            payload = {'raw': raw.decode('utf-8', errors='replace')}
        response_headers = dict(exc.headers.items())
    if expected is not None and status != expected:
        raise AssertionError(f'{method} {path}: expected {expected}, got {status}: {payload}')
    return status, payload, response_headers
def psql(sql):
    remote = (
        "docker exec inno-one-step18-postgres-1 "
        "psql -U inno -d inno_core -Atc " + shlex.quote(sql)
    )
    command = [
        'ssh', '-o', 'StrictHostKeyChecking=no',
        'inno360@172.10.1.58', remote
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=20, check=True)
    return result.stdout.strip()

def opaque_uuid(value, prefix):
    raw = value.removeprefix(prefix + '_')
    return raw[0:8] + '-' + raw[8:12] + '-' + raw[12:16] + '-' + raw[16:20] + '-' + raw[20:32]

api('GET', '/assets?page=1&pageSize=25', expected=401)
print('unauthenticated=PASS')

admin = token('adisai')
hr = token('hr.viewer')

_, profile, _ = api('GET', '/platform/me', admin, expected=200)
permissions = set(profile['data']['permissions'])
assert 'assets.view' in permissions
assert 'assets.manage' in permissions
print('admin_permissions=PASS')

api('GET', '/assets?page=1&pageSize=25', hr, expected=403)
print('scope_permission=PASS')

_, overview_payload, _ = api('GET', '/assets/overview', admin, expected=200)
overview = overview_payload['data']
assert overview['totalAssets'] >= 5
assert overview['unassigned'] >= 1
print('overview=PASS total=' + str(overview['totalAssets']))

_, list_payload, _ = api('GET', '/assets?page=1&pageSize=100', admin, expected=200)
assets = list_payload['items']
assert len(assets) >= 5
monitor = next(x for x in assets if x['assetTag'] == 'AST-MON-000311')
asset_id = monitor['id']
print('inventory=PASS count=' + str(list_payload['totalItems']))

_, detail_payload, _ = api('GET', '/assets/' + asset_id, admin, expected=200)
original = detail_payload['data']
assert original['owner'] is None
original_name = original['name']
print('detail=PASS id=' + asset_id)
smoke_note = 'Step19 runtime smoke'
submission_id = None
try:
    # Asset update + optimistic concurrency.
    _, updated_payload, _ = api(
        'PATCH',
        '/assets/' + asset_id,
        admin,
        {'name': original_name + ' QA'},
        headers={'If-Match': original['eTag']},
        expected=200)
    updated = updated_payload['data']
    assert updated['name'].endswith(' QA')
    api(
        'PATCH',
        '/assets/' + asset_id,
        admin,
        {'name': original_name},
        headers={'If-Match': original['eTag']},
        expected=412)
    print('asset_update_etag=PASS')

    # Restore the asset name using the latest version.
    _, latest_payload, _ = api('GET', '/assets/' + asset_id, admin, expected=200)
    latest = latest_payload['data']
    api(
        'PATCH',
        '/assets/' + asset_id,
        admin,
        {'name': original_name},
        headers={'If-Match': latest['eTag']},
        expected=200)

    # Ownership mutation and restore.
    _, current_payload, _ = api('GET', '/assets/' + asset_id, admin, expected=200)
    current = current_payload['data']
    _, owners_payload, _ = api('GET', '/assets/owners?page=1&pageSize=100', admin, expected=200)
    owners = owners_payload['items']
    assert owners
    owner = owners[0]
    _, changed_payload, _ = api(
        'POST',
        '/assets/' + asset_id + '/ownership',
        admin,
        {'ownerUserId': owner['id'], 'reasonCode': 'qa_verification', 'note': smoke_note},
        headers={'If-Match': current['eTag']},
        expected=200)
    changed = changed_payload['data']
    assert changed['ownerUserId'] == owner['id']

    _, assigned_payload, _ = api('GET', '/assets/' + asset_id, admin, expected=200)
    assigned = assigned_payload['data']
    assert assigned['owner']['id'] == owner['id']
    api(
        'POST',
        '/assets/' + asset_id + '/ownership',
        admin,
        {'reasonCode': 'qa_restore', 'note': smoke_note},
        headers={'If-Match': assigned['eTag']},
        expected=200)
    print('ownership_change=PASS')

    _, ownership_payload, _ = api('GET', '/assets/ownership', admin, expected=200)
    assert 'recentChanges' in ownership_payload['data']
    _, owner_payload, _ = api('GET', '/assets/owners/' + owner['id'], admin, expected=200)
    assert owner_payload['data']['id'] == owner['id']
    print('ownership_views=PASS')

    # Submission decision success + stale write guard.
    _, submissions_payload, _ = api(
        'GET',
        '/assets/ownership-submissions?status=pending&page=1&pageSize=100',
        admin,
        expected=200)
    pending = submissions_payload['items']
    assert pending
    submission = pending[0]
    submission_id = submission['id']
    api(
        'POST',
        '/assets/ownership-submissions/' + submission_id + '/decision',
        admin,
        {'decision': 'rejected', 'note': smoke_note},
        headers={'If-Match': submission['eTag']},
        expected=200)
    api(
        'POST',
        '/assets/ownership-submissions/' + submission_id + '/decision',
        admin,
        {'decision': 'confirmed'},
        headers={'If-Match': submission['eTag']},
        expected=412)
    print('submission_decision_etag=PASS')
finally:
    # Restore durable QA records so the smoke is repeatable.
    if submission_id:
        submission_uuid = opaque_uuid(submission_id, 'submission')
        psql(
            "update assets.ownership_submissions "
            "set status='pending', reviewed_by_user_id=null, reviewed_at=null, "
            "decision_note=null, version=1 "
            "where id='" + submission_uuid + "'::uuid;")
    psql(
        "delete from assets.asset_ownership_history "
        "where note='" + smoke_note + "';")
audit_asset = int(psql(
    "select count(*) from audit.audit_records "
    "where action='assets.asset.updated';") or '0')
audit_owner = int(psql(
    "select count(*) from audit.audit_records "
    "where action='assets.ownership.changed';") or '0')
asset_events = int(psql(
    "select count(*) from integration.outbox_messages "
    "where event_type='asset.changed';") or '0')
ownership_events = int(psql(
    "select count(*) from integration.outbox_messages "
    "where event_type='ownership.changed';") or '0')
cross_module_fk_count = int(psql(
    "select count(*) from pg_constraint c "
    "join pg_class t on t.oid=c.conrelid "
    "join pg_namespace n on n.oid=t.relnamespace "
    "join pg_class rt on rt.oid=c.confrelid "
    "join pg_namespace rn on rn.oid=rt.relnamespace "
    "where c.contype='f' and n.nspname='assets' "
    "and rn.nspname in ('platform','devices','helpdesk');") or '0')

assert audit_asset >= 1
assert audit_owner >= 2
assert asset_events >= 1
assert ownership_events >= 2
assert cross_module_fk_count == 0
print('audit_events=PASS')
print('cross_module_fk=PASS')
print('STEP19_RUNTIME_SMOKE_PASS')
