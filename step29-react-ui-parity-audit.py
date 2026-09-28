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
assets_overview=(root/'production/apps/web-portal/src/pages/AssetsOverviewPage.tsx').read_text()
asset_detail=(root/'production/apps/web-portal/src/pages/AssetDetailPage.tsx').read_text()
asset_ownership=(root/'production/apps/web-portal/src/pages/AssetOwnershipPage.tsx').read_text()
asset_owners=(root/'production/apps/web-portal/src/pages/AssetOwnersPage.tsx').read_text()
asset_owner_detail=(root/'production/apps/web-portal/src/pages/AssetOwnerDetailPage.tsx').read_text()
asset_submissions=(root/'production/apps/web-portal/src/pages/AssetOwnershipSubmissionsPage.tsx').read_text()
asset_custom_fields=(root/'production/apps/web-portal/src/pages/AssetCustomFieldsPage.tsx').read_text()
asset_qr=(root/'production/apps/web-portal/src/pages/AssetQrLabelsPage.tsx').read_text()
software_baselines=(root/'production/apps/web-portal/src/pages/SoftwareBaselinesPage.tsx').read_text()
software_licenses=(root/'production/apps/web-portal/src/pages/SoftwareLicensesPage.tsx').read_text()
contracts=(root/'production/apps/web-portal/src/pages/ContractsWarrantyPage.tsx').read_text()
helpdesk_overview=(root/'production/apps/web-portal/src/pages/HelpdeskOverviewPage.tsx').read_text()
tickets=(root/'production/apps/web-portal/src/pages/TicketsPage.tsx').read_text()
ticket_detail=(root/'production/apps/web-portal/src/pages/TicketDetailPage.tsx').read_text()
helpdesk_sla=(root/'production/apps/web-portal/src/pages/HelpdeskSlaPage.tsx').read_text()
business_calendar=(root/'production/apps/web-portal/src/pages/BusinessCalendarPage.tsx').read_text()
automation=(root/'production/apps/web-portal/src/pages/AutomationRulesPage.tsx').read_text()
automation_rule=(root/'production/apps/web-portal/src/pages/AutomationRulePage.tsx').read_text()
device_detail=(root/'production/apps/web-portal/src/pages/DeviceDetailPage.tsx').read_text()
discovery=(root/'production/apps/web-portal/src/pages/DiscoveryPage.tsx').read_text()
device_groups=(root/'production/apps/web-portal/src/pages/DeviceGroupsPage.tsx').read_text()
device_group_detail=(root/'production/apps/web-portal/src/pages/DeviceGroupDetailPage.tsx').read_text()
agent_deployment=(root/'production/apps/web-portal/src/pages/AgentDeploymentPage.tsx').read_text()
ticket_create=(root/'production/apps/web-portal/src/pages/TicketCreatePage.tsx').read_text()
profile_page=(root/'production/apps/web-portal/src/pages/ProfilePage.tsx').read_text()
deferred_page=(root/'production/apps/web-portal/src/pages/DeferredPage.tsx').read_text()
app_root=(root/'production/apps/web-portal/src/app/AppRoot.tsx').read_text()
feedback=(root/'production/apps/web-portal/src/components/Feedback.tsx').read_text()
issues=[]

if manifest.get('step') != 29: issues.append('step number')
if manifest.get('status') != 'completed': issues.append('step status')
if manifest.get('frozenDesignSystem') != 'V1.26': issues.append('design system baseline')
if manifest.get('frozenUiContract') != '1.20.0': issues.append('ui contract baseline')
if manifest.get('completedPhases') != ['shell', 'shared_primitives', 'devices', 'assets', 'helpdesk', 'remaining_routes']: issues.append('completed phases')
if manifest.get('nextPhase') is not None: issues.append('next phase')
remaining_validation = manifest.get('remainingRoutesValidation', {})
if remaining_validation.get('browserQa') != 'passed' or remaining_validation.get('browserQaFailures') != 0:
    issues.append('remaining routes browser qa status')
if remaining_validation.get('browserQaChecks') != 60:
    issues.append('remaining routes browser qa count')

final_validation = manifest.get('finalValidation', {})
if final_validation.get('fullBrowserRegression') != 'passed' or final_validation.get('fullBrowserFailures') != 0:
    issues.append('final browser regression')
if final_validation.get('fullBrowserChecks') != 456:
    issues.append('final browser check count')
if [final_validation.get('shellChecks'), final_validation.get('devicesChecks'), final_validation.get('assetsChecks'),
    final_validation.get('helpdeskChecks'), final_validation.get('remainingRoutesChecks')] != [23, 73, 141, 159, 60]:
    issues.append('final browser suite counts')
if final_validation.get('finalVisualCapture') != 'passed' or final_validation.get('finalVisualReview') != 'passed':
    issues.append('final visual validation')
if final_validation.get('finalVisualScreenshots') != 33 or final_validation.get('finalVisualIssues') != 0:
    issues.append('final visual counts')
if final_validation.get('finalVisualViewports') != [1366, 1024, 768]:
    issues.append('final visual viewports')
helpdesk_validation = manifest.get('helpdeskValidation', {})
if helpdesk_validation.get('browserQa') != 'passed' or helpdesk_validation.get('browserQaFailures') != 0:
    issues.append('helpdesk browser qa status')
if helpdesk_validation.get('browserQaChecks') != 159:
    issues.append('helpdesk browser qa count')
assets_validation = manifest.get('assetsValidation', {})
if assets_validation.get('browserQa') != 'passed' or assets_validation.get('browserQaFailures') != 0:
    issues.append('assets browser qa status')
if assets_validation.get('browserQaChecks') != 141:
    issues.append('assets browser qa count')

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

if manifest.get('devicesParityRoutes') != ['/devices','/devices/discovery','/devices/groups','/devices/groups/:groupId','/devices/add','/devices/:deviceId']:
    issues.append('devices parity routes')
for marker in ['to="/devices/discovery"','to="/devices/add"','device-columns-menu','DeviceTypeGlyph','device-row-action']:
    if marker not in devices: issues.append('devices parity '+marker)
for marker in ['actions={canManage','INNOCollection','INNOCollectionToolbar','INNOTableWrap']:
    if marker not in discovery: issues.append('discovery parity '+marker)
for legacy in ['collection-card','collection-toolbar','production-table-wrap','page-intro-row','page-helper','className="editor-footer"']:
    if legacy in discovery: issues.append('discovery legacy '+legacy)
for marker in ['actions={canManage','INNOEditorFooter','INNOCollection','INNOPagination','INNOTableWrap']:
    if marker not in device_groups: issues.append('device groups parity '+marker)
for legacy in ['collection-card','collection-toolbar','production-table-wrap','page-intro-row','page-helper','className="editor-footer"']:
    if legacy in device_groups: issues.append('device groups legacy '+legacy)
for marker in ['<main className="inno-page">','INNOResourceHeader','INNOEditorFooter','INNOCollection','INNOTableWrap']:
    if marker not in device_group_detail: issues.append('group detail parity '+marker)
if '<INNOPage' in device_group_detail: issues.append('group detail duplicate page header')
for legacy in ['production-resource-head','resource-title-line','resource-meta-line','collection-card','collection-toolbar','production-table-wrap','className="editor-footer"']:
    if legacy in device_group_detail: issues.append('group detail legacy '+legacy)
for marker in ['description="Generate a time-limited enrollment link','INNOEditorFooter','busy={generate.isPending}','INNOStatus']:
    if marker not in agent_deployment: issues.append('agent deployment parity '+marker)
for legacy in ['page-helper','className="editor-footer"']:
    if legacy in agent_deployment: issues.append('agent deployment legacy '+legacy)
for marker in ['icon={<span aria-hidden="true">▣</span>}','INNOCollection className="device-software-card"','INNOSearchField','INNOSelectField','INNOTableWrap']:
    if marker not in device_detail: issues.append('device detail parity '+marker)
for marker in ['inDeviceDetail','isActive || inDeviceDetail']:
    if marker not in shell: issues.append('device detail navigation '+marker)
for marker in ['inAssetDetail','isActive || inAssetDetail']:
    if marker not in shell: issues.append('asset detail navigation '+marker)


expected_asset_routes = [
    '/assets','/assets/inventory','/assets/:assetId','/assets/ownership','/assets/owners','/assets/owners/:userId',
    '/assets/ownership/submissions','/assets/custom-fields','/assets/qr-labels','/assets/software-baselines',
    '/assets/software-licenses','/assets/contracts'
]
if manifest.get('assetsParityRoutes') != expected_asset_routes:
    issues.append('assets parity routes')
if '/assets/software-baselines' not in manifest.get('assetsProductionOnlyMapping', {}):
    issues.append('software baselines production-only mapping')

asset_pages = [
    ('assets overview', assets_overview),
    ('asset inventory', assets),
    ('asset detail', asset_detail),
    ('asset ownership', asset_ownership),
    ('asset owners', asset_owners),
    ('asset owner detail', asset_owner_detail),
    ('asset submissions', asset_submissions),
    ('asset custom fields', asset_custom_fields),
    ('asset qr', asset_qr),
    ('software baselines', software_baselines),
    ('software licenses', software_licenses),
    ('contracts', contracts),
]
for name, source in asset_pages:
    for legacy in ['collection-card','production-table-wrap','page-helper','production-resource-head','resource-title-line']:
        if legacy in source: issues.append(name+' legacy '+legacy)

for name, source in [
    ('assets overview', assets_overview), ('asset inventory', assets), ('asset ownership', asset_ownership),
    ('asset owners', asset_owners), ('asset submissions', asset_submissions), ('asset qr', asset_qr),
    ('software baselines', software_baselines), ('software licenses', software_licenses), ('contracts', contracts)
]:
    if 'INNOCollection' not in source: issues.append(name+' missing INNOCollection')

for name, source in [('asset inventory', assets), ('asset owners', asset_owners), ('asset submissions', asset_submissions),
                     ('asset qr', asset_qr), ('software baselines', software_baselines),
                     ('software licenses', software_licenses), ('contracts', contracts)]:
    if 'INNOCollectionToolbar' not in source: issues.append(name+' missing INNOCollectionToolbar')
    if 'INNOTableWrap' not in source: issues.append(name+' missing INNOTableWrap')

for name, source in [('asset detail', asset_detail), ('asset owner detail', asset_owner_detail)]:
    if 'INNOResourceHeader' not in source: issues.append(name+' missing INNOResourceHeader')
    if 'INNOTableWrap' not in source: issues.append(name+' missing INNOTableWrap')

for name, source in [('asset detail', asset_detail), ('asset custom fields', asset_custom_fields),
                     ('asset qr', asset_qr), ('software baselines', software_baselines),
                     ('software licenses', software_licenses), ('contracts', contracts)]:
    if 'INNOEditorFooter' not in source: issues.append(name+' missing INNOEditorFooter')

for marker in ['Evaluation uses Devices observations from the last 24 hours',
               "item.status === 'compliant' ? 'success' : item.status === 'missing' ? 'danger' : 'warning'"]:
    if marker not in software_baselines: issues.append('software baseline evidence ui '+marker)


expected_helpdesk_routes = [
    '/helpdesk','/helpdesk/tickets','/helpdesk/assigned','/helpdesk/team',
    '/helpdesk/tickets/new','/helpdesk/tickets/:ticketId','/helpdesk/sla',
    '/helpdesk/calendar','/helpdesk/automation','/helpdesk/automation/new',
    '/helpdesk/automation/:ruleId'
]
if manifest.get('helpdeskParityRoutes') != expected_helpdesk_routes:
    issues.append('helpdesk parity routes')

helpdesk_pages = [
    ('helpdesk overview', helpdesk_overview), ('tickets', tickets), ('ticket create', ticket_create),
    ('ticket detail', ticket_detail), ('sla', helpdesk_sla), ('business calendar', business_calendar),
    ('automation', automation), ('automation rule', automation_rule)
]
for name, source in helpdesk_pages:
    for legacy in ['collection-card','production-table-wrap','page-helper','production-resource-head',
                   'resource-title-line','className="editor-footer"','compact-empty']:
        if legacy in source: issues.append(name+' legacy '+legacy)

for marker in ['INNOCollection','INNOCollectionToolbar','INNOPagination']:
    if marker not in tickets: issues.append('tickets missing '+marker)
if 'helpdesk-operational-queue' not in tickets: issues.append('tickets missing operational queue')
for marker in ['INNOResourceHeader','INNOEditorFooter','busy={resolveMutation.isPending}',
               'busy={assignMutation.isPending}','busy={replyMutation.isPending}']:
    if marker not in ticket_detail: issues.append('ticket detail missing '+marker)
if '<INNOPage' in ticket_detail: issues.append('ticket detail duplicate page header')
for marker in ['INNOEditorFooter','busy={mutation.isPending}']:
    if marker not in ticket_create: issues.append('ticket create missing '+marker)
for marker in ['INNOEditorFooter','Business Calendar','INNOState compact kind="error"']:
    if marker not in helpdesk_sla: issues.append('sla missing '+marker)
for marker in ['INNOEditorFooter','INNOTableWrap','INNOStatus']:
    if marker not in business_calendar: issues.append('calendar missing '+marker)
for marker in ['INNOCollection','INNOCollectionToolbar','INNOTableWrap','INNOPagination']:
    if marker not in automation: issues.append('automation missing '+marker)
for marker in ['INNOEditorFooter','INNOStatus','INNOState compact kind="empty"']:
    if marker not in automation_rule: issues.append('automation rule missing '+marker)
for marker in ['inTicketWorkspace','isActive || inTicketWorkspace']:
    if marker not in shell: issues.append('ticket workspace navigation '+marker)


expected_remaining_routes = ['/profile','/apps/*','/assets/manage/*','/meeting/*','/reports/*','/admin/*','*']
if manifest.get('remainingParityRoutes') != expected_remaining_routes:
    issues.append('remaining parity routes')
state_policy = manifest.get('remainingRouteStatePolicy', {})
if state_policy.get('profile') != 'implemented':
    issues.append('profile route policy')
if state_policy.get('futureModuleBoundaries') != 'disabled':
    issues.append('future module state policy')
if state_policy.get('unauthorizedImplementedRoutes') != 'permission':
    issues.append('permission route state policy')
if state_policy.get('unknownRoutes') != 'no-results':
    issues.append('unknown route state policy')

for legacy in ['page-helper','prod-tag','collection-card','production-table-wrap','className="editor-footer"']:
    if legacy in profile_page: issues.append('profile legacy '+legacy)
for marker in ['description="Your workspace profile and organization-managed sign-in."','INNOStatus tone="success"','Personal preferences are not exposed']:
    if marker not in profile_page: issues.append('profile parity '+marker)

for marker in ["kind = 'disabled'","kind?: Extract<INNOStateKind, 'permission' | 'disabled' | 'no-results'>",
               "kind={kind}",'Permission denied','Module not available yet','Page not found']:
    if marker not in deferred_page: issues.append('deferred state '+marker)

if app_root.count('kind="permission"') < 20:
    issues.append('permission fallbacks incomplete')
for marker in [
    '<Route path="apps/*" element={<DeferredPage name="Apps" kind="no-results" />} />',
    '<Route path="meeting/*" element={<DeferredPage name="Meeting" />} />',
    '<Route path="reports/*" element={<DeferredPage name="Reports" />} />',
    '<Route path="admin/*" element={<DeferredPage name="Admin Center" />} />',
    '<Route path="*" element={<DeferredPage name="Not Found" kind="no-results" />} />'
]:
    if marker not in app_root: issues.append('remaining route mapping '+marker)

print('step29_completed_phases='+','.join(manifest.get('completedPhases',[])))
print('step29_next_phase='+str(manifest.get('nextPhase')))
print('shared_primitives='+str(len(manifest.get('sharedPrimitives',[]))))
print('frozen_design_system='+manifest['frozenDesignSystem'])
print('frozen_ui_contract='+manifest['frozenUiContract'])
print('issues='+str(len(issues)))
for issue in issues: print('ISSUE: '+issue)
raise SystemExit(bool(issues))
