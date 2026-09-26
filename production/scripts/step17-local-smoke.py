#!/usr/bin/env python3
from pathlib import Path
import json
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
    password = user['credentials'][0]['value']
    body = urllib.parse.urlencode({
        'client_id': 'inno-one-e2e',
        'grant_type': 'password',
        'username': username,
        'password': password,
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
    request = urllib.request.Request(
        API + path,
        data=data,
        headers=merged,
        method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status = response.status
            raw = response.read()
            payload = json.loads(raw or b'{}')
            response_headers = dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read()
        payload = json.loads(raw or b'{}')
        response_headers = dict(exc.headers.items())
    if expected is not None and status != expected:
        raise AssertionError(f'{method} {path}: expected {expected}, got {status}: {payload}')
    return status, payload, response_headers

def psql_scalar(sql):
    result = subprocess.run(
        ['docker', 'exec', 'inno-one-local-postgres-1',
         'psql', '-U', 'inno', '-d', 'inno_core', '-Atc', sql],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=15,
        check=True)
    return result.stdout.strip()

api('GET', '/helpdesk/overview', expected=401)
print('unauthenticated=PASS')

admin = token('adisai')
hr = token('hr.viewer')

_, profile, _ = api('GET', '/platform/me', admin, expected=200)
permissions = set(profile['data']['permissions'])
for required in (
    'helpdesk.ticket.view',
    'helpdesk.ticket.create',
    'helpdesk.ticket.reply',
    'helpdesk.ticket.assign',
    'helpdesk.ticket.resolve',
):
    assert required in permissions, required
print('admin_permissions=PASS')

_, overview, _ = api('GET', '/helpdesk/overview', admin, expected=200)
assert overview['data']['openTickets'] >= 3
assert len(overview['data']['priorityTickets']) >= 1
print('overview=PASS open=' + str(overview['data']['openTickets']))

_, categories, _ = api('GET', '/helpdesk/categories/tree', admin, expected=200)
assert categories['items']
_, statuses, _ = api('GET', '/helpdesk/statuses', admin, expected=200)
assert {x['code'] for x in statuses['items']} >= {'open', 'in_progress', 'resolved'}
print('catalog_reads=PASS')

_, admin_tickets, _ = api('GET', '/helpdesk/tickets?page=1&pageSize=100', admin, expected=200)
assert admin_tickets['totalItems'] >= 4
assert 'node/' not in json.dumps(admin_tickets)
print('admin_queue=PASS total=' + str(admin_tickets['totalItems']))

_, hr_tickets, _ = api('GET', '/helpdesk/tickets?page=1&pageSize=100', hr, expected=200)
assert hr_tickets['totalItems'] >= 2
assert all(
    item.get('organization') == 'Human Resources'
    or item.get('requester') == 'HR Scope Viewer'
    or item.get('assignee') == 'HR Scope Viewer'
    for item in hr_tickets['items'])
print('scoped_queue=PASS total=' + str(hr_tickets['totalItems']))

# HR Employee scope can create but cannot perform agent actions.
seed_hr_ticket = next(x for x in hr_tickets['items'] if x.get('organization') == 'Human Resources')
api('POST', f"/helpdesk/tickets/{seed_hr_ticket['id']}/replies", hr, {'body':'not allowed'}, expected=403)
api('POST', f"/helpdesk/tickets/{seed_hr_ticket['id']}/assignment", hr, {'team':'Support L1'}, expected=403)
api('POST', f"/helpdesk/tickets/{seed_hr_ticket['id']}/resolve", hr, {'resolutionCode':'fixed'}, expected=403)
print('employee_action_permissions=PASS')

suffix = str(int(time.time()))[-7:]
subject = 'Step17 HR VPN ' + suffix
related_device = 'dev_80000000000000000000000000000001'
leaf = categories['items'][0]['children'][0]
_, created, created_headers = api(
    'POST',
    '/helpdesk/tickets',
    hr,
    {
        'subject': subject,
        'description': 'Step 17 runtime ticket created from scoped HR account.',
        'categoryId': leaf['id'],
        'impact': 'Individual',
        'urgency': 'High',
        'relatedDeviceId': related_device,
    },
    expected=201)
created = created['data']
ticket_id = created['id']
assert ticket_id.startswith('ticket_')
assert created['priority'] == 'P2'
assert created['ticketNumber'].startswith('HD-')
print('ticket_create=PASS id=' + ticket_id)

_, hr_detail, _ = api('GET', '/helpdesk/tickets/' + ticket_id, hr, expected=200)
assert hr_detail['data']['relatedDevice']['id'] == related_device
assert hr_detail['data']['requester']['name'] == 'HR Scope Viewer'
assert hr_detail['data']['status'] == 'open'
assert '80000000-' not in json.dumps(hr_detail)
print('ticket_detail_cross_module=PASS')

# Admin can operate across the root Organization scope.
_, admin_detail, _ = api('GET', '/helpdesk/tickets/' + ticket_id, admin, expected=200)
detail = admin_detail['data']
support = next(x for x in detail['assigneeOptions'] if x['name'] == 'Narin Support')
initial_etag = detail['eTag']

_, assignment, _ = api(
    'POST',
    '/helpdesk/tickets/' + ticket_id + '/assignment',
    admin,
    {
        'assigneeUserId': support['id'],
        'team': 'Network Support',
        'note': 'Step 17 runtime assignment'
    },
    headers={'If-Match': initial_etag},
    expected=200)
assigned_etag = assignment['data']['eTag']
assert assigned_etag != initial_etag
print('assignment=PASS')

# Stale assignment is rejected.
api(
    'POST',
    '/helpdesk/tickets/' + ticket_id + '/assignment',
    admin,
    {'team': 'Support L1'},
    headers={'If-Match': initial_etag},
    expected=412)
print('etag_concurrency=PASS')

api(
    'POST',
    '/helpdesk/tickets/' + ticket_id + '/replies',
    admin,
    {'body': 'Support has started checking the VPN profile.', 'visibility': 'public'},
    expected=200)

_, after_reply, _ = api('GET', '/helpdesk/tickets/' + ticket_id, admin, expected=200)
after_reply = after_reply['data']
assert after_reply['status'] == 'in_progress'
assert after_reply['sla']['responseMetAt']
assert any(x['authorName'] == 'Adisai Plomlee' for x in after_reply['messages'])
print('reply_and_first_response=PASS')

resolve_etag = after_reply['eTag']
_, resolved, _ = api(
    'POST',
    '/helpdesk/tickets/' + ticket_id + '/resolve',
    admin,
    {'resolutionCode': 'fixed', 'note': 'VPN profile refreshed'},
    headers={'If-Match': resolve_etag},
    expected=200)
assert resolved['data']['status'] == 'resolved'

api(
    'POST',
    '/helpdesk/tickets/' + ticket_id + '/resolve',
    admin,
    {'resolutionCode': 'fixed'},
    headers={'If-Match': resolve_etag},
    expected=412)

_, final_detail, _ = api('GET', '/helpdesk/tickets/' + ticket_id, admin, expected=200)
assert final_detail['data']['status'] == 'resolved'
assert final_detail['data']['sla']['state'] in ('met', 'breached')
print('resolve=PASS')

ticket_uuid = ticket_id.removeprefix('ticket_')
ticket_uuid = (
    ticket_uuid[0:8] + '-' + ticket_uuid[8:12] + '-' + ticket_uuid[12:16] + '-'
    + ticket_uuid[16:20] + '-' + ticket_uuid[20:32]
)

audit_count = int(psql_scalar(
    "select count(*) from audit.audit_records "
    "where module='helpdesk' and target_id='" + ticket_id.replace("'", "''") + "';") or '0')
event_types = psql_scalar(
    "select string_agg(event_type, ',' order by occurred_at) "
    "from integration.outbox_messages "
    "where origin_module='helpdesk' and subject_id='" + ticket_id.replace("'", "''") + "';")
reply_count = int(psql_scalar(
    "select count(*) from helpdesk.ticket_replies "
    "where ticket_id='" + ticket_uuid + "'::uuid;") or '0')
history_count = int(psql_scalar(
    "select count(*) from helpdesk.ticket_status_history "
    "where ticket_id='" + ticket_uuid + "'::uuid;") or '0')
cross_module_fk_count = int(psql_scalar(
    "select count(*) from pg_constraint c "
    "join pg_class t on t.oid=c.conrelid "
    "join pg_namespace n on n.oid=t.relnamespace "
    "join pg_class rt on rt.oid=c.confrelid "
    "join pg_namespace rn on rn.oid=rt.relnamespace "
    "where c.contype='f' and n.nspname='helpdesk' and rn.nspname in ('platform','devices','assets');") or '0')

assert audit_count >= 4
assert 'ticket.created' in event_types
assert 'ticket.assigned' in event_types
assert 'ticket.status.changed' in event_types
assert 'ticket.resolved' in event_types
assert reply_count >= 1
assert history_count >= 3
assert cross_module_fk_count == 0
print('audit_outbox_history=PASS audits=' + str(audit_count))
print('cross_module_fk=PASS')

_, filtered, _ = api(
    'GET',
    '/helpdesk/tickets?page=1&pageSize=25&search=' + urllib.parse.quote(subject) + '&status=resolved&priority=P2',
    admin,
    expected=200)
assert filtered['totalItems'] == 1
assert filtered['items'][0]['id'] == ticket_id
print('queue_filters=PASS')

print('STEP17_RUNTIME_SMOKE_PASS')
