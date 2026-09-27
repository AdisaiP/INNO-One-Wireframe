#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parent
contract=json.loads((ROOT/'inno-event-audit-contract.json').read_text())
impl=json.loads((ROOT/'inno-implementation-contract.json').read_text())
api=json.loads((ROOT/'inno-api-contract.json').read_text())
registry=(ROOT/'platform-registry.js').read_text()

issues=[]

if contract.get('contractVersion')!='0.3.0':
    issues.append(f"expected Event/Audit Contract 0.3.0, found {contract.get('contractVersion')}")
if impl.get('contractVersion')!='0.12.0':
    issues.append(f"expected current Implementation Contract 0.12.0, found {impl.get('contractVersion')}")

ref=impl.get('eventAuditContract',{})
if ref.get('version')!='0.3.0':
    issues.append('implementation contract must reference Event/Audit Contract 0.3.0')
for key in ('source','documentation','audit'):
    value=ref.get(key)
    if not value or not (ROOT/value).exists():
        issues.append(f"missing Event/Audit contract reference: {key}={value}")

# Parse registry event declarations.
registry_events=[]
module_events={}
for m in re.finditer(r'(\w+):\{[^\n]*?events:\[([^]]*)\]',registry):
    module=m.group(1)
    values=re.findall(r'"([^"]+)"',m.group(2))
    module_events[module]=values
    registry_events.extend(values)

events=contract.get('events',[])
types=[e.get('type') for e in events]
if len(types)!=len(set(types)):
    issues.append('duplicate integration event type')
if set(types)!=set(registry_events):
    missing=sorted(set(registry_events)-set(types))
    extra=sorted(set(types)-set(registry_events))
    if missing: issues.append(f"registry events missing from contract: {missing}")
    if extra: issues.append(f"contract events not declared by registry: {extra}")

event_re=re.compile(r'^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$')
for e in events:
    t=e.get('type')
    if not t or not event_re.match(t):
        issues.append(f"invalid event type: {t}")
    if not isinstance(e.get('version'),int) or e.get('version',0)<1:
        issues.append(f"{t}: eventVersion must be positive integer")
    producer=e.get('producer')
    if producer not in module_events:
        issues.append(f"{t}: producer {producer} not in platform registry")
    elif t not in module_events[producer]:
        issues.append(f"{t}: not declared by producer module {producer}")
    expected_phase='future' if producer=='workflow' else 'active'
    if e.get('phase')!=expected_phase:
        issues.append(f"{t}: expected phase {expected_phase}, found {e.get('phase')}")
    if e.get('delivery')!='at-least-once':
        issues.append(f"{t}: integration delivery must be at-least-once")
    if not e.get('subjectType'):
        issues.append(f"{t}: missing subjectType")

envelope=contract.get('eventEnvelope',{})
required_envelope={'eventId','eventType','eventVersion','occurredAt','producer','subject','actor','correlationId','data'}
actual_required=set(envelope.get('requiredFields',[]))
if not required_envelope.issubset(actual_required):
    issues.append(f"event envelope missing fields: {sorted(required_envelope-actual_required)}")

delivery=contract.get('delivery',{})
for key in ('crossModuleRequiresOutbox','outboxSameTransactionAsDomainWrite','consumerMustBeIdempotent'):
    if delivery.get(key) is not True:
        issues.append(f"delivery.{key} must be true")
if delivery.get('deliveryGuarantee')!='at-least-once':
    issues.append('delivery guarantee must be at-least-once')
if delivery.get('consumerInboxDedupeKey')!='eventId':
    issues.append('consumer inbox dedupe key must be eventId')
if delivery.get('globalOrderingGuaranteed') is not False:
    issues.append('global ordering must not be guaranteed')
if delivery.get('distributedTransaction')!='forbidden':
    issues.append('distributed transaction must be forbidden')

# Privacy / payload guard.
privacy=contract.get('privacy',{})
forbidden={x.lower() for x in privacy.get('neverPersistInEventsOrAudit',[])}
for e in events:
    bad=[f for f in e.get('payloadFields',[]) if f.lower() in forbidden]
    if bad:
        issues.append(f"{e.get('type')}: forbidden payload fields {bad}")

# Audit contract.
audit=contract.get('audit',{})
if audit.get('permissionToRead')!='admin.audit.view':
    issues.append('audit read permission must be admin.audit.view')
if audit.get('appendOnly') is not True:
    issues.append('audit must be append-only')
if audit.get('sameTransactionForPrivilegedMutations') is not True:
    issues.append('privileged audit write should be same transaction where practical')
if audit.get('recordDeniedPrivilegedAuthorization') is not True:
    issues.append('denied privileged authorization must be auditable')

known_permissions=set(impl.get('existingPermissions',[]))|set(impl.get('reservedImplementationPermissions',[]))
if audit.get('permissionToRead') not in known_permissions:
    issues.append('audit read permission is not in implementation permission catalog')

actions=contract.get('auditActions',[])
action_ids=[a.get('action') for a in actions]
if len(action_ids)!=len(set(action_ids)):
    issues.append('duplicate audit action')
retention=set(audit.get('retentionClasses',[]))
for a in actions:
    action=a.get('action')
    if not action or not event_re.match(action):
        issues.append(f"invalid audit action: {action}")
    if a.get('retentionClass') not in retention:
        issues.append(f"{action}: unknown retention class {a.get('retentionClass')}")
    if a.get('sensitivity') not in {'internal','restricted'}:
        issues.append(f"{action}: invalid sensitivity {a.get('sensitivity')}")

required_actions={
    'platform.access_assignment.updated',
    'platform.role.permissions_changed',
    'devices.remote.started',
    'devices.remote.consent_decided',
    'devices.remote.file_transferred',
    'devices.group.membership_changed',
    'assets.ownership.changed',
    'assets.qr.scanned',
    'helpdesk.ticket.assigned',
    'helpdesk.ticket.resolved',
    'meeting.shared',
    'reports.report.exported',
    'security.authorization.denied',
}
missing_actions=required_actions-set(action_ids)
if missing_actions:
    issues.append(f"required audit actions missing: {sorted(missing_actions)}")

# API correlation compatibility.
headers=api.get('headers',{})
if 'X-Correlation-Id' not in headers.get('request',[]) or 'X-Correlation-Id' not in headers.get('response',[]):
    issues.append('API contract must carry X-Correlation-Id in request/response')
error_fields=set(api.get('errorShape',{}).get('fields',[]))
for field in ('traceId','correlationId'):
    if field not in error_fields:
        issues.append(f"API error shape missing {field}")

active=sum(1 for e in events if e.get('phase')=='active')
future=sum(1 for e in events if e.get('phase')=='future')

print(f"event_audit_contract_version={contract.get('contractVersion')}")
print(f"registry_event_types={len(registry_events)}")
print(f"contract_event_types={len(events)}")
print(f"active_events={active}")
print(f"future_events={future}")
print(f"audit_actions={len(actions)}")
print(f"retention_classes={len(retention)}")
print(f"issues={len(issues)}")
for issue in issues:
    print('ISSUE: '+issue)
raise SystemExit(1 if issues else 0)
