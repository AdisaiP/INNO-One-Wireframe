#!/usr/bin/env python3
import json
from pathlib import Path

root=Path(__file__).resolve().parent
manifest=json.loads((root/'inno-step29-react-ui-parity.json').read_text())
shell=(root/'production/apps/web-portal/src/app/AppShell.tsx').read_text()
css=(root/'production/apps/web-portal/src/shell.css').read_text()
issues=[]

if manifest.get('step') != 29: issues.append('step number')
if manifest.get('frozenDesignSystem') != 'V1.26': issues.append('design system baseline')
if manifest.get('frozenUiContract') != '1.20.0': issues.append('ui contract baseline')
for marker in ['ShellIcon','prod-global-search','prod-context-toggle','prod-side-backdrop']:
    if marker not in shell: issues.append('shell marker '+marker)
for stale in ['aria-label="Devices">D</NavLink>','aria-label="Assets">A</NavLink>','aria-label="Helpdesk">H</NavLink>']:
    if stale in shell: issues.append('letter rail '+stale)
for marker in ['--prod-header-h: 56px','--prod-rail-w: 60px','--prod-side-w: 216px','@media (max-width: 1180px)','prod-side.open']:
    if marker not in css: issues.append('css marker '+marker)
if 'grid-template-columns: var(--prod-rail-w) minmax(0, 1fr)' not in css:
    issues.append('overlay shell grid')

print('step29_phase=shell_parity')
print('frozen_design_system='+manifest['frozenDesignSystem'])
print('frozen_ui_contract='+manifest['frozenUiContract'])
print('issues='+str(len(issues)))
for issue in issues: print('ISSUE: '+issue)
raise SystemExit(bool(issues))
