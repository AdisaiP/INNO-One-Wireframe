#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
data=json.loads((ROOT/'inno-data-model-contract.json').read_text())
impl=json.loads((ROOT/'inno-implementation-contract.json').read_text())
api=json.loads((ROOT/'inno-api-contract.json').read_text())
events=json.loads((ROOT/'inno-event-audit-contract.json').read_text())

issues=[]

if impl.get('contractVersion')!='0.19.0':
    issues.append(f"expected current Implementation Contract 0.19.0, found {impl.get('contractVersion')}")
data_ref=impl.get('dataModelContract',{})
if data_ref.get('version')!='0.6.0':
    issues.append('implementation contract must reference Data Model Contract 0.6.0')
for key in ('documentation','source','audit'):
    value=data_ref.get(key)
    if not value or not (ROOT/value).exists():
        issues.append(f"missing Data Model contract reference: {key}={value}")

if data.get('contractVersion')!='0.6.0':
    issues.append(f"expected Data Model Contract 0.6.0, found {data.get('contractVersion')}")
if data.get('databaseEngine',{}).get('product')!='PostgreSQL':
    issues.append('production relational engine must be PostgreSQL')

expected_core=['platform','devices','assets','helpdesk','reports','integration','audit','readmodel']
actual_core=list(data.get('schemas',{}).keys())
if actual_core!=expected_core:
    issues.append(f"core schema order/ownership mismatch: {actual_core}")

core_db=data.get('deployment',{}).get('coreDatabase',{})
if core_db.get('name')!='inno_core':
    issues.append('core database must be inno_core')
if core_db.get('schemas')!=expected_core:
    issues.append('inno_core schema list mismatch')
meeting_db=data.get('deployment',{}).get('meetingDatabase',{})
if meeting_db.get('name')!='inno_meeting':
    issues.append('meeting database must be inno_meeting')
if data.get('meeting',{}).get('database')!='inno_meeting':
    issues.append('meeting ownership must point to inno_meeting')

# Table uniqueness/counts.
core_tables=[]
for schema,meta in data.get('schemas',{}).items():
    names=[t.get('name') for t in meta.get('tables',[])]
    if len(names)!=len(set(names)):
        issues.append(f"{schema}: duplicate table name")
    for t in meta.get('tables',[]):
        core_tables.append((schema,t))
meeting_tables=data.get('meeting',{}).get('tables',[])
meeting_names=[t.get('name') for t in meeting_tables]
if len(meeting_names)!=len(set(meeting_names)):
    issues.append('meeting: duplicate table name')

if len(core_tables)!=85:
    issues.append(f"expected 85 core tables, found {len(core_tables)}")
if len(meeting_tables)!=9:
    issues.append(f"expected 9 meeting tables, found {len(meeting_tables)}")
if len(core_tables)+len(meeting_tables)!=94:
    issues.append(f"expected 94 total planning tables, found {len(core_tables)+len(meeting_tables)}")

required_tables={
    'platform':{'user_profiles','organization_units','locations','positions','roles','permissions','role_permissions','access_assignments','access_assignment_resources','access_assignment_actions','app_modules'},
    'devices':{'devices','device_external_mappings','device_groups','device_group_members','remote_sessions','deployment_jobs','endpoint_policies','device_alerts','device_alert_rules','software_inventory_snapshots','installed_software'},
    'assets':{'assets','asset_ownership_history','ownership_submissions','qr_labels','qr_scans','software_licenses','contracts'},
    'helpdesk':{'tickets','ticket_replies','ticket_attachments','ticket_assignments','ticket_status_history','sla_policies','categories','statuses','automation_rules','knowledge_articles'},
    'reports':{'saved_reports','report_runs','report_exports'},
    'integration':{'operations','outbox_messages','inbox_messages'},
    'audit':{'audit_records'},
    'readmodel':{'search_documents','workspace_attention','workspace_continue'},
}
for schema,required in required_tables.items():
    actual={t['name'] for t in data['schemas'][schema]['tables']}
    missing=required-actual
    if missing:
        issues.append(f"{schema}: missing required tables {sorted(missing)}")

required_meeting={'meetings','recordings','transcripts','summaries','meeting_participants','action_items','meeting_files','shares','processing_jobs'}
missing_meeting=required_meeting-set(meeting_names)
if missing_meeting:
    issues.append(f"meeting: missing required tables {sorted(missing_meeting)}")

# Ownership/reference boundaries.
rules=data.get('ownershipRules',{})
if rules.get('crossModuleForeignKeys')!='forbidden':
    issues.append('cross-module foreign keys must be forbidden')
if rules.get('crossDatabaseForeignKeys')!='forbidden':
    issues.append('cross-database foreign keys must be forbidden')
if 'forbidden' not in str(rules.get('reads','')).lower():
    issues.append('direct cross-module table reads must be forbidden')

known_schema=set(expected_core)|{'meeting'}
for schema,t in core_tables:
    for ref in t.get('crossModuleRefs',[]):
        typ=ref.get('type')
        target=ref.get('target','')
        root=target.split('.',1)[0] if '.' in target else ''
        if typ=='cross-module':
            if root not in known_schema or root==schema:
                issues.append(f"{schema}.{t['name']}: invalid cross-module target {target}")
        elif typ=='same-module':
            if root!=schema:
                issues.append(f"{schema}.{t['name']}: same-module ref points to {target}")
        elif typ=='cross-database':
            issues.append(f"{schema}.{t['name']}: core table must not declare cross-database ref {target}")
        else:
            issues.append(f"{schema}.{t['name']}: unknown ref type {typ}")

for t in meeting_tables:
    for ref in t.get('crossModuleRefs',[]):
        if ref.get('type')!='cross-database':
            issues.append(f"meeting.{t['name']}: meeting external refs must be cross-database")
        if not ref.get('target','').startswith('platform.'):
            issues.append(f"meeting.{t['name']}: unexpected cross-database target {ref.get('target')}")

# Infrastructure aligns with Event/Audit contract.
infra=data.get('infrastructureTables',{})
for key in ('coreOutbox','coreInbox','coreOperations','coreAudit','meetingOutbox','meetingInbox'):
    if not infra.get(key):
        issues.append(f"missing infrastructure mapping {key}")
if events.get('delivery',{}).get('crossModuleRequiresOutbox') is not True:
    issues.append('Event contract no longer requires outbox')
if events.get('delivery',{}).get('consumerInboxDedupeKey')!='eventId':
    issues.append('Event contract inbox dedupe key must stay eventId')
if events.get('audit',{}).get('appendOnly') is not True:
    issues.append('Audit contract must remain append-only')

# Identity/concurrency/storage.
identity=data.get('identity',{})
if identity.get('databasePrimaryKey')!='uuid':
    issues.append('database PK strategy must use uuid')
conc=data.get('concurrency',{})
if 'bigint version' not in str(conc.get('mutableEntities','')).lower():
    issues.append('mutable entity concurrency must use explicit bigint version')
if conc.get('staleResult')!='HTTP 412 PRECONDITION_FAILED':
    issues.append('stale write must map to HTTP 412 PRECONDITION_FAILED')

if data.get('multiTenancy',{}).get('tenantIdColumn')!='not introduced until an explicit multi-tenant requirement/contract exists':
    issues.append('generic tenant_id must not be introduced in v1')

obj=data.get('deployment',{}).get('objectStorage',{})
expected_object_uses={'helpdesk attachments','meeting recordings/audio/files','report exports'}
if set(obj.get('usage',[]))!=expected_object_uses:
    issues.append('object-storage usage set mismatch')

# API modules have an owning persistence/query boundary.
api_modules={e['module'] for e in api.get('endpoints',[])}
expected_api_modules={'platform','devices','assets','helpdesk','meeting','reports','admin','agent'}
if api_modules!=expected_api_modules:
    issues.append(f"API module set mismatch: {sorted(api_modules)}")

# External engine boundaries.
if data.get('deployment',{}).get('keycloakDatabase',{}).get('owner')!='Keycloak':
    issues.append('Keycloak must own its database')
mesh_rule=data.get('deployment',{}).get('meshCentralPersistence',{}).get('rule','').lower()
if 'never queries' not in mesh_rule:
    issues.append('MeshCentral persistence must not be queried directly')

# Migration ownership.
migration=data.get('migration',{})
for key in ('platform','devices','assets','helpdesk','reports','infrastructure','meeting'):
    if not migration.get(key):
        issues.append(f"missing migration owner {key}")
if 'may not alter another module' not in migration.get('rule',''):
    issues.append('migration rule must forbid altering another module tables')

# Read model / reporting boundary.
if data['schemas']['readmodel']['owner']!='platform-infrastructure':
    issues.append('readmodel schema must be infrastructure-owned')
if 'not source tables' not in data.get('ownershipRules',{}).get('reporting',''):
    issues.append('reporting must use read models/query contracts rather than source tables')

print(f"data_model_contract_version={data.get('contractVersion')}")
print(f"database_engine={data.get('databaseEngine',{}).get('product')}")
print(f"core_schemas={len(actual_core)}")
print(f"core_tables={len(core_tables)}")
print(f"meeting_tables={len(meeting_tables)}")
print(f"total_tables={len(core_tables)+len(meeting_tables)}")
print(f"cross_module_refs={sum(len(t.get('crossModuleRefs',[])) for _,t in core_tables)}")
print(f"meeting_cross_db_refs={sum(len(t.get('crossModuleRefs',[])) for t in meeting_tables)}")
print(f"issues={len(issues)}")
for issue in issues:
    print('ISSUE: '+issue)
raise SystemExit(1 if issues else 0)
