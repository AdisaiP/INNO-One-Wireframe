#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parent
api=json.loads((ROOT/'inno-api-contract.json').read_text())
impl=json.loads((ROOT/'inno-implementation-contract.json').read_text())
openapi=json.loads((ROOT/'openapi-inno-one-v1.json').read_text())
manifest=json.loads((ROOT/'qa-final-visual/manifest.json').read_text())

issues=[]
endpoints=api.get('endpoints',[])
ids=[e.get('id') for e in endpoints]
pairs=[(e.get('method'),e.get('path')) for e in endpoints]

if api.get('contractVersion')!='0.4.0':
    issues.append(f"expected API contract 0.4.0, found {api.get('contractVersion')}")
if api.get('basePath')!='/api/v1':
    issues.append(f"expected basePath /api/v1, found {api.get('basePath')}")
if len(ids)!=len(set(ids)):
    issues.append('duplicate endpoint id')
if len(pairs)!=len(set(pairs)):
    issues.append('duplicate method/path pair')

known_permissions=set(impl.get('existingPermissions',[]))|set(impl.get('reservedImplementationPermissions',[]))
method_set={'GET','POST','PUT','PATCH','DELETE'}
path_param_re=re.compile(r'\{[A-Za-z][A-Za-z0-9_]*\}')

for e in endpoints:
    eid=e.get('id')
    method=e.get('method')
    path=e.get('path','')
    perm=e.get('permission')
    if method not in method_set:
        issues.append(f"{eid}: unsupported HTTP method {method}")
    if not path.startswith('/'):
        issues.append(f"{eid}: path must start with /")
    if '/api/' in path:
        issues.append(f"{eid}: endpoint path must be relative to basePath")
    if 'meshcentral' in path.lower():
        issues.append(f"{eid}: vendor engine leaked into public API path")
    auth_mode=e.get('authMode')
    if not perm and auth_mode not in {'agent-device','operation-owner'}:
        issues.append(f"{eid}: missing permission/auth mode")
    elif perm and perm not in known_permissions:
        issues.append(f"{eid}: unknown permission {perm}")
    if not e.get('screens'):
        issues.append(f"{eid}: no source screen mapping")
    if e.get('asyncJob') and not (method=='POST' and e.get('response')=='operation'):
        issues.append(f"{eid}: async jobs must be POST + operation response")
    for part in re.findall(r'\{[^}]+\}',path):
        if not path_param_re.fullmatch(part):
            issues.append(f"{eid}: invalid path parameter {part}")

web=set(manifest.get('web',{}).keys())
coverage=set(api.get('screenCoverage',{}).keys())
missing_web=sorted(web-coverage)
if missing_web:
    issues.append(f"missing frozen Web route coverage: {missing_web}")

runtime_surfaces={'helpdesk-agent-request.html','agent-ownership-confirmation.html','asset-mobile.html'}
missing_surfaces=sorted(runtime_surfaces-coverage)
if missing_surfaces:
    issues.append(f"missing runtime surface coverage: {missing_surfaces}")

for screen in coverage:
    if screen in web or screen in runtime_surfaces:
        continue
    if not (ROOT/screen).exists():
        issues.append(f"mapped screen does not exist: {screen}")

# Design System is intentionally not a runtime API consumer.
if 'design-system.html' in coverage:
    issues.append('design-system.html should not be a runtime API consumer')

openapi_operations=sum(
    1 for p in openapi.get('paths',{}).values()
    for method in p.keys() if method.upper() in method_set
)
if openapi.get('openapi')!='3.1.0':
    issues.append('OpenAPI skeleton must use 3.1.0')
if openapi.get('info',{}).get('version')!='0.4.0':
    issues.append('OpenAPI version must match API contract 0.4.0')
if openapi_operations!=len(endpoints):
    issues.append(f"OpenAPI operation count {openapi_operations} != contract {len(endpoints)}")
if openapi.get('servers',[{}])[0].get('url')!='/api/v1':
    issues.append('OpenAPI server must be /api/v1')

required_errors={
    'VALIDATION_FAILED','UNAUTHENTICATED','PERMISSION_DENIED','RESOURCE_NOT_FOUND',
    'CONFLICT','PRECONDITION_FAILED','MODULE_DISABLED','RESOURCE_OFFLINE',
    'PARTIAL_FAILURE','DEPENDENCY_UNAVAILABLE','RATE_LIMITED'
}
actual_errors=set(api.get('errorShape',{}).get('canonicalCodes',[]))
if required_errors-actual_errors:
    issues.append(f"missing error codes: {sorted(required_errors-actual_errors)}")

required_gaps={'devices.deploy','admin.access','helpdesk.kb.view','helpdesk.ticket.reply','helpdesk.automation.view','helpdesk.automation.manage','meeting.files.manage'}
if required_gaps-known_permissions:
    issues.append(f"required implementation permissions not reserved: {sorted(required_gaps-known_permissions)}")

module_counts={}
for e in endpoints:
    module_counts[e['module']]=module_counts.get(e['module'],0)+1

print(f"api_contract_version={api.get('contractVersion')}")
print(f"base_path={api.get('basePath')}")
print(f"web_routes_covered={len(web & coverage)}/{len(web)}")
print(f"runtime_surfaces_covered={len(runtime_surfaces & coverage)}/{len(runtime_surfaces)}")
print(f"endpoints={len(endpoints)}")
print(f"unique_paths={len(set(e['path'] for e in endpoints))}")
print(f"openapi_operations={openapi_operations}")
print(f"async_operations={sum(1 for e in endpoints if e.get('asyncJob'))}")
print('module_counts='+json.dumps(module_counts,sort_keys=True))
print(f"issues={len(issues)}")
for issue in issues:
    print('ISSUE: '+issue)
raise SystemExit(1 if issues else 0)
