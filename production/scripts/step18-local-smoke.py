#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
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
            try:
                payload = json.loads(raw or b'{}')
            except json.JSONDecodeError:
                payload = {'raw': raw.decode('utf-8', errors='replace')}
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
    result = subprocess.run(
        ['docker', 'exec', 'inno-one-local-postgres-1',
         'psql', '-U', 'inno', '-d', 'inno_core', '-Atc', sql],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=15,
        check=True)
    return result.stdout.strip()

def opaque_uuid(value, prefix):
    raw = value.removeprefix(prefix + '_')
    return (
        raw[0:8] + '-' + raw[8:12] + '-' + raw[12:16] + '-'
        + raw[16:20] + '-' + raw[20:32]
    )

def wait_until(fn, seconds=20, interval=.5, label='condition'):
    deadline = time.time() + seconds
    last = None
    while time.time() < deadline:
        last = fn()
        if last:
            return last
        time.sleep(interval)
    raise AssertionError(f'timed out waiting for {label}; last={last!r}')

api('GET', '/helpdesk/sla-policies', expected=401)
print('unauthenticated=PASS')

admin = token('adisai')
hr = token('hr.viewer')

_, profile, _ = api('GET', '/platform/me', admin, expected=200)
permissions = set(profile['data']['permissions'])
for required in (
    'helpdesk.sla.manage',
    'helpdesk.automation.view',
    'helpdesk.automation.manage',
):
    assert required in permissions, required
print('admin_permissions=PASS')

_, policies_payload, _ = api('GET', '/helpdesk/sla-policies', admin, expected=200)
policies = policies_payload['items']
assert len(policies) >= 4
p1 = next(x for x in policies if x['priority'] == 'P1')
original_policy = json.loads(json.dumps(p1))
assert p1['businessCalendar']['timeZoneId'] == 'Asia/Bangkok'
print('sla_policies=PASS count=' + str(len(policies)))

api(
    'PUT',
    '/helpdesk/sla-policies/' + p1['id'],
    hr,
    {
        'responseMinutes': p1['responseMinutes'],
        'resolutionMinutes': p1['resolutionMinutes'],
        'businessCalendarId': p1['businessCalendar']['id'],
        'appliesTo': p1['appliesTo'],
        'pauseOnRequesterWait': p1['pauseOnRequesterWait'],
        'notifyRequesterOnStatusChange': p1['notifyRequesterOnStatusChange'],
        'reassignOnBreach': p1['reassignOnBreach'],
        'escalationLevels': p1['escalationLevels'],
        'isActive': p1['isActive'],
    },
    headers={'If-Match': p1['eTag']},
    expected=403)
api('GET', '/helpdesk/automation-rules', hr, expected=403)
print('manage_permissions=PASS')

_, calendar_payload, _ = api('GET', '/helpdesk/business-calendar', admin, expected=200)
calendar = calendar_payload['data']
original_calendar = json.loads(json.dumps(calendar))
assert len(calendar['workingDays']) >= 5
assert len(calendar['holidays']) >= 2
print('business_calendar=PASS')

_, rules, _ = api('GET', '/helpdesk/automation-rules?page=1&pageSize=100', admin, expected=200)
assert rules['totalItems'] >= 3
print('automation_list=PASS total=' + str(rules['totalItems']))

suffix = str(int(time.time()))[-7:]
rule_input = {
    'name': 'Step18 QA Critical Routing ' + suffix,
    'ruleType': 'Assignment',
    'trigger': 'ticket_created',
    'scopeType': 'all',
    'scopeValue': None,
    'conditionField': 'priority',
    'conditionOperator': 'equals',
    'conditionValue': 'P1',
    'actionType': 'assign_team',
    'actionValue': 'Step18 QA Team',
    'status': 'active',
    'sortOrder': 90,
}
_, created_rule, _ = api(
    'POST',
    '/helpdesk/automation-rules',
    admin,
    rule_input,
    expected=201)
created_rule = created_rule['data']
rule_id = created_rule['id']
assert rule_id.startswith('auto_')
print('automation_create=PASS id=' + rule_id)

# ETag update and stale write rejection.
updated_rule_input = dict(rule_input)
updated_rule_input['status'] = 'active'
_, updated_rule, _ = api(
    'PUT',
    '/helpdesk/automation-rules/' + rule_id,
    admin,
    updated_rule_input,
    headers={'If-Match': created_rule['eTag']},
    expected=200)
updated_rule = updated_rule['data']
assert updated_rule['eTag'] != created_rule['eTag']
api(
    'PUT',
    '/helpdesk/automation-rules/' + rule_id,
    admin,
    updated_rule_input,
    headers={'If-Match': created_rule['eTag']},
    expected=412)
print('automation_etag=PASS')

# Create a P1 ticket after the rule so ticket_created is deterministic.
_, categories, _ = api('GET', '/helpdesk/categories/tree', admin, expected=200)
access_category = next(x for x in categories['items'] if x['code'] == 'access')
subject = 'Step18 SLA automation ' + suffix
_, created_ticket, _ = api(
    'POST',
    '/helpdesk/tickets',
    admin,
    {
        'subject': subject,
        'description': 'Step 18 SLA and automation runtime verification.',
        'categoryId': access_category['id'],
        'impact': 'Individual',
        'urgency': 'Critical',
    },
    expected=201)
ticket = created_ticket['data']
ticket_id = ticket['id']
ticket_uuid = opaque_uuid(ticket_id, 'ticket')
assert ticket['priority'] == 'P1'

# Business calendar due date should land inside an enabled Bangkok working day.
due = datetime.fromisoformat(ticket['responseDueAt']).astimezone(ZoneInfo('Asia/Bangkok'))
assert due.weekday() < 5
assert (due.hour, due.minute) >= (8, 30)
assert (due.hour, due.minute) <= (17, 30)
print('business_time_ticket_due=PASS due=' + due.isoformat())

def automation_applied():
    _, detail, _ = api('GET', '/helpdesk/automation-rules/' + rule_id, admin, expected=200)
    executions = detail['data']['recentExecutions']
    return next((x for x in executions if x['ticketId'] == ticket_id and x['result'] == 'applied'), None)

wait_until(automation_applied, seconds=15, label='automation execution')

def ticket_team():
    _, detail, _ = api('GET', '/helpdesk/tickets/' + ticket_id, admin, expected=200)
    return detail['data'] if detail['data'].get('team') == 'Step18 QA Team' else None

wait_until(ticket_team, seconds=15, label='automation team assignment')
print('automation_execution=PASS')

try:
    # Switch calendar to 24/7 temporarily so pause and escalation can be tested quickly.
    all_days = [
        {'dayOfWeek': day, 'startMinute': 0, 'endMinute': 1440, 'isWorking': True}
        for day in range(7)
    ]
    _, calendar_24x7, _ = api(
        'PUT',
        '/helpdesk/business-calendar',
        admin,
        {
            'name': calendar['name'],
            'timeZoneId': calendar['timeZoneId'],
            'workingDays': all_days,
        },
        headers={'If-Match': calendar['eTag']},
        expected=200)
    calendar_24x7 = calendar_24x7['data']
    api(
        'PUT',
        '/helpdesk/business-calendar',
        admin,
        {
            'name': calendar['name'],
            'timeZoneId': calendar['timeZoneId'],
            'workingDays': all_days,
        },
        headers={'If-Match': calendar['eTag']},
        expected=412)
    print('calendar_etag=PASS')

    # Tight P1 target for worker behavior test.
    _, policies_payload, _ = api('GET', '/helpdesk/sla-policies', admin, expected=200)
    current_p1 = next(x for x in policies_payload['items'] if x['id'] == p1['id'])
    fast_levels = [
        {'level': 1, 'percent': 50, 'targetType': 'team', 'targetId': 'team_lead', 'reassignTeam': 'Network Support'},
        {'level': 2, 'percent': 75, 'targetType': 'role', 'targetId': 'service_manager', 'reassignTeam': 'Service Management'},
        {'level': 3, 'percent': 100, 'targetType': 'role', 'targetId': 'platform_admin', 'reassignTeam': 'Critical Support'},
    ]
    _, fast_policy, _ = api(
        'PUT',
        '/helpdesk/sla-policies/' + p1['id'],
        admin,
        {
            'responseMinutes': 1,
            'resolutionMinutes': 2,
            'businessCalendarId': current_p1['businessCalendar']['id'],
            'appliesTo': current_p1['appliesTo'],
            'pauseOnRequesterWait': True,
            'notifyRequesterOnStatusChange': True,
            'reassignOnBreach': True,
            'escalationLevels': fast_levels,
            'isActive': True,
        },
        headers={'If-Match': current_p1['eTag']},
        expected=200)
    fast_policy = fast_policy['data']
    api(
        'PUT',
        '/helpdesk/sla-policies/' + p1['id'],
        admin,
        {
            'responseMinutes': 1,
            'resolutionMinutes': 2,
            'businessCalendarId': current_p1['businessCalendar']['id'],
            'appliesTo': current_p1['appliesTo'],
            'pauseOnRequesterWait': True,
            'notifyRequesterOnStatusChange': True,
            'reassignOnBreach': True,
            'escalationLevels': fast_levels,
            'isActive': True,
        },
        headers={'If-Match': current_p1['eTag']},
        expected=412)
    print('sla_policy_etag=PASS')

    waiting_id = psql("select id from helpdesk.statuses where code='waiting' limit 1;")
    open_id = psql("select id from helpdesk.statuses where code='open' limit 1;")
    psql(
        "update helpdesk.tickets set status_id='" + waiting_id + "'::uuid, updated_at=now() "
        "where id='" + ticket_uuid + "'::uuid;")

    wait_until(
        lambda: psql(
            "select case when paused_at is not null then 'yes' else '' end "
            "from helpdesk.ticket_sla where ticket_id='" + ticket_uuid + "'::uuid;") == 'yes',
        seconds=12,
        label='SLA pause')

    # Backdate the pause marker to avoid a one-minute real-time wait in the QA harness.
    psql(
        "update helpdesk.ticket_sla set paused_at=now()-interval '5 minutes' "
        "where ticket_id='" + ticket_uuid + "'::uuid;")
    due_before_resume = psql(
        "select extract(epoch from resolution_due_at)::bigint "
        "from helpdesk.ticket_sla where ticket_id='" + ticket_uuid + "'::uuid;")
    psql(
        "update helpdesk.tickets set status_id='" + open_id + "'::uuid, updated_at=now() "
        "where id='" + ticket_uuid + "'::uuid;")

    wait_until(
        lambda: int(psql(
            "select accumulated_paused_seconds from helpdesk.ticket_sla "
            "where ticket_id='" + ticket_uuid + "'::uuid;") or '0') >= 240
        and psql(
            "select case when paused_at is null then 'yes' else '' end "
            "from helpdesk.ticket_sla where ticket_id='" + ticket_uuid + "'::uuid;") == 'yes',
        seconds=12,
        label='SLA resume')

    due_after_resume = psql(
        "select extract(epoch from resolution_due_at)::bigint "
        "from helpdesk.ticket_sla where ticket_id='" + ticket_uuid + "'::uuid;")
    assert int(due_after_resume) > int(due_before_resume)
    print('sla_pause_resume=PASS')

    # Backdate far enough to cross every threshold after the accumulated pause is deducted.
    psql(
        "update helpdesk.tickets set created_at=now()-interval '10 minutes', updated_at=now() "
        "where id='" + ticket_uuid + "'::uuid;")

    def breached():
        return psql(
            "select state || ':' || escalation_level from helpdesk.ticket_sla "
            "where ticket_id='" + ticket_uuid + "'::uuid;") == 'breached:3'

    wait_until(breached, seconds=15, label='SLA breach escalation')

    risk_count = int(psql(
        "select count(*) from integration.outbox_messages "
        "where event_type='sla.at_risk' and subject_id='" + ticket_id + "';") or '0')
    escalation_count = int(psql(
        "select count(*) from integration.outbox_messages "
        "where event_type='sla.escalated' and subject_id='" + ticket_id + "';") or '0')
    assert risk_count >= 1
    assert escalation_count >= 3

    _, breached_ticket, _ = api('GET', '/helpdesk/tickets/' + ticket_id, admin, expected=200)
    assert breached_ticket['data']['team'] == 'Critical Support'

    _, monitor, _ = api(
        'GET',
        '/helpdesk/sla-monitor?page=1&pageSize=100&state=breached',
        admin,
        expected=200)
    row = next(x for x in monitor['items'] if x['ticketId'] == ticket_id)
    assert row['escalationLevel'] == 3
    assert row['elapsedPercent'] >= 100
    print('sla_risk_escalation=PASS events=' + str(escalation_count))

finally:
    # Restore shared development configuration even when a later assertion fails.
    try:
        _, fresh_calendar_payload, _ = api(
            'GET', '/helpdesk/business-calendar', admin, expected=200)
        fresh_calendar = fresh_calendar_payload['data']
        api(
            'PUT',
            '/helpdesk/business-calendar',
            admin,
            {
                'name': original_calendar['name'],
                'timeZoneId': original_calendar['timeZoneId'],
                'workingDays': original_calendar['workingDays'],
            },
            headers={'If-Match': fresh_calendar['eTag']},
            expected=200)
    except Exception as exc:
        print('calendar_restore_warning=' + str(exc))

    try:
        _, fresh_policies_payload, _ = api(
            'GET', '/helpdesk/sla-policies', admin, expected=200)
        fresh_p1 = next(x for x in fresh_policies_payload['items'] if x['id'] == original_policy['id'])
        api(
            'PUT',
            '/helpdesk/sla-policies/' + original_policy['id'],
            admin,
            {
                'responseMinutes': original_policy['responseMinutes'],
                'resolutionMinutes': original_policy['resolutionMinutes'],
                'businessCalendarId': original_policy['businessCalendar']['id'],
                'appliesTo': original_policy['appliesTo'],
                'pauseOnRequesterWait': original_policy['pauseOnRequesterWait'],
                'notifyRequesterOnStatusChange': original_policy['notifyRequesterOnStatusChange'],
                'reassignOnBreach': original_policy['reassignOnBreach'],
                'escalationLevels': original_policy['escalationLevels'],
                'isActive': original_policy['isActive'],
            },
            headers={'If-Match': fresh_p1['eTag']},
            expected=200)
    except Exception as exc:
        print('policy_restore_warning=' + str(exc))

audit_policy = int(psql(
    "select count(*) from audit.audit_records "
    "where action='helpdesk.sla_policy.updated';") or '0')
audit_automation = int(psql(
    "select count(*) from audit.audit_records "
    "where action='helpdesk.automation_rule.updated';") or '0')
execution_count = int(psql(
    "select count(*) from helpdesk.automation_executions "
    "where rule_id='" + opaque_uuid(rule_id, 'auto') + "'::uuid;") or '0')
cross_module_fk_count = int(psql(
    "select count(*) from pg_constraint c "
    "join pg_class t on t.oid=c.conrelid "
    "join pg_namespace n on n.oid=t.relnamespace "
    "join pg_class rt on rt.oid=c.confrelid "
    "join pg_namespace rn on rn.oid=rt.relnamespace "
    "where c.contype='f' and n.nspname='helpdesk' "
    "and rn.nspname in ('platform','devices','assets');") or '0')

assert audit_policy >= 1
assert audit_automation >= 2
assert execution_count >= 1
assert cross_module_fk_count == 0
print('audit_and_execution_history=PASS')
print('cross_module_fk=PASS')
print('STEP18_RUNTIME_SMOKE_PASS')
