#!/usr/bin/env python3
import json
from pathlib import Path

root=Path(__file__).resolve().parent
manifest=json.loads((root/'inno-step29-react-ui-parity.json').read_text())
shell=(root/'production/apps/web-portal/src/app/AppShell.tsx').read_text()
css=(root/'production/apps/web-portal/src/shell.css').read_text()
ui=(root/'production/packages/ui/src/index.tsx').read_text()
ui_css=(root/'production/packages/ui/src/styles.css').read_text()
devices=(root/'production/apps/web-portal/src/pages/DevicesPage.tsx').read_text()
assets=(root/'production/apps/web-portal/src/pages/AssetInventoryPage.tsx').read_text()
automation=(root/'production/apps/web-portal/src/pages/AutomationRulesPage.tsx').read_text()
device_detail=(root/'production/apps/web-portal/src/pages/DeviceDetailPage.tsx').read_text()
ticket_create=(root/'production/apps/web-portal/src/pages/TicketCreatePage.tsx').read_text()
feedback=(root/'production/apps/web-portal/src/components/Feedback.tsx').read_text()
issues=[]

if manifest.get('step') != 29: issues.append('step number')
if manifest.get('frozenDesignSystem') != 'V1.26': issues.append('design system baseline')
if manifest.get('frozenUiContract') != '1.20.0': issues.append('ui contract baseline')
if manifest.get('completedPhases') != ['shell', 'shared_primitives']: issues.append('completed phases')
if manifest.get('nextPhase') != 'devices': issues.append('next phase')

for marker in ['ShellIcon','prod-global-search','prod-context-toggle','prod-side-backdrop']:
    if marker not in shell: issues.append('shell marker '+marker)
for stale in ['aria-label="Devices">D</NavLink>','aria-label="Assets">A</NavLink>','aria-label="Helpdesk">H</NavLink>']:
    if stale in shell: issues.append('letter rail '+stale)
for marker in ['--prod-header-h: 56px','--prod-rail-w: 60px','--prod-side-w: 216px','@media (max-width: 1180px)','prod-side.open']:
    if marker not in css: issues.append('shell css marker '+marker)
if 'grid-template-columns: var(--prod-rail-w) minmax(0, 1fr)' not in css:
    issues.append('overlay shell grid')

primitive_markers=[
    'INNOStatus','INNOCollection','INNOCollectionHeader','INNOCollectionToolbar',
    'INNOSearchField','INNOSelectField','INNOTableWrap','INNOPagination',
    'INNOResourceHeader','INNOEditorFooter'
]
for marker in primitive_markers:
    if ('export function '+marker) not in ui: issues.append('shared primitive '+marker)
for marker in ['.inno-collection {','.inno-collection-toolbar {','.inno-table-wrap--xwide > table',
               '.inno-resource-head {','.inno-editor-footer {','.inno-state {']:
    if marker not in ui_css: issues.append('shared ui css '+marker)

for name,source in [('devices',devices),('assets',assets),('automation',automation)]:
    for marker in ['INNOCollection','INNOCollectionToolbar','INNOTableWrap']:
        if marker not in source: issues.append(name+' missing '+marker)
    for legacy in ['collection-card','collection-toolbar','production-table-wrap','page-helper']:
        if legacy in source: issues.append(name+' legacy '+legacy)

if 'INNOResourceHeader' not in device_detail: issues.append('device detail resource header')
for legacy in ['production-resource-head','resource-title-line','resource-meta-line']:
    if legacy in device_detail: issues.append('device detail legacy '+legacy)

if 'INNOEditorFooter' not in ticket_create: issues.append('ticket create editor footer')
if 'className="editor-footer"' in ticket_create: issues.append('ticket create legacy editor footer')
if 'busy={mutation.isPending}' not in ticket_create: issues.append('ticket create busy state')
if 'kind="loading"' not in feedback: issues.append('loading state kind')
if "'permission'" not in feedback or "'error'" not in feedback: issues.append('error state kinds')

print('step29_completed_phases='+','.join(manifest.get('completedPhases',[])))
print('step29_next_phase='+str(manifest.get('nextPhase')))
print('shared_primitives='+str(len(manifest.get('sharedPrimitives',[]))))
print('frozen_design_system='+manifest['frozenDesignSystem'])
print('frozen_ui_contract='+manifest['frozenUiContract'])
print('issues='+str(len(issues)))
for issue in issues: print('ISSUE: '+issue)
raise SystemExit(bool(issues))
