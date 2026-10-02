from pathlib import Path
import re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
PAGES=ROOT/"production/apps/web-portal/src/pages"
PUBLIC=ROOT/"production/apps/web-portal/public/illustrations"
SHELL=(ROOT/"production/apps/web-portal/src/shell.css").read_text(encoding="utf-8")
checks=0
failures=[]

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

def read(name):
    return (PAGES/name).read_text(encoding="utf-8")

apps=read("AppsPage.tsx")
assets=read("AssetsOverviewPage.tsx")
deploy=read("AgentDeploymentPage.tsx")
integrations=read("AdminIntegrationsPage.tsx")
calendar=read("BusinessCalendarPage.tsx")
branding=read("AdminBrandingPage.tsx")
platform=read("AdminPlatformSettingsPage.tsx")
roles=read("AdminRolesPage.tsx")
security=read("AdminSecurityPage.tsx")
automation=read("AutomationRulePage.tsx")
search=read("SearchPage.tsx")
ticket=read("TicketCreatePage.tsx")
all_pages="\n".join(x.read_text(encoding="utf-8") for x in PAGES.glob("*.tsx"))

assets_present={x.name for x in PUBLIC.glob("*.svg")}
check("apps hero asset migrated", "apps-ecosystem.svg" in assets_present)
check("assets hero asset migrated", "asset-inventory.svg" in assets_present)
check("device hero asset retained", "device-setup.svg" in assets_present)
check("workspace hero asset retained", "workspace-welcome.svg" in assets_present)
check("apps page uses approved hero", 'illustration={<img src="/illustrations/apps-ecosystem.svg"' in apps)
check("assets page uses approved hero", 'illustration={<img src="/illustrations/asset-inventory.svg"' in assets)
check("agent deployment retains approved hero", 'illustration={<img src="/illustrations/device-setup.svg"' in deploy)

check("legacy page-local row action markup removed", 'className="inno-row-action"' not in all_pages)
check("router row action adapter exists", (ROOT/"production/apps/web-portal/src/components/RouterRowAction.tsx").exists())
check("router row action delegates to shared component", "INNORowActions" in (ROOT/"production/apps/web-portal/src/components/RouterRowAction.tsx").read_text(encoding="utf-8"))
check("direct dialog/select actions use shared row actions", all(x in all_pages for x in [
    "INNORowActions ariaLabel={'Position ",
    "INNORowActions ariaLabel={'Custom field ",
    "INNORowActions ariaLabel={'Baseline ",
]))
check("route actions use shared router adapter", all(x in all_pages for x in [
    "<RouterRowAction to={'/admin/users/' + user.id}",
    "<RouterRowAction to={'/assets/' + asset.id}",
    "<RouterRowAction to={'/helpdesk/tickets/' + ticket.id}",
]))

banned=[
    'title="Configuration remains deployment-managed"',
    "This page owns working time only.",
    "Holiday maintenance remains read-only in this slice.",
    "Future mutation boundary",
    "Role definitions are read-only in this phase",
    "Automation is bounded to contracted actions.",
    "Authorization stays authoritative",
    "Related context stays canonical.",
]
for phrase in banned:
    check("redundant explanatory block removed: "+phrase, phrase not in all_pages)

check("integrations explains boundary in page description", "Configuration remains deployment-managed." in integrations)
check("calendar has no purpose note", "<INNOPurposeNote" not in calendar)
check("branding has no purpose note", "<INNOPurposeNote" not in branding)
check("platform settings has no purpose note", "<INNOPurposeNote" not in platform)
check("roles has no purpose note", "<INNOPurposeNote" not in roles)
check("security has no purpose note", "<INNOPurposeNote" not in security)
check("automation has no purpose note", "<INNOPurposeNote" not in automation)
check("search has no purpose note", "<INNOPurposeNote" not in search)
check("ticket create has no purpose note", "<INNOPurposeNote" not in ticket)

check("deployment footer spacing uses shared ownership", ".deployment-card .inno-editor-footer" not in SHELL)
check("ticket footer spacing uses shared ownership", ".ticket-create-main > .inno-editor-footer" not in SHELL)
check("baseline footer spacing override removed", ".baseline-editor-footer" not in SHELL)

step44a=(ROOT/"step44a-screen-interaction-architecture-audit.py").read_text(encoding="utf-8")
check("Step44A still models hero restore candidates", '{"apps", "assets", "devices/add"}' in step44a)
check("workflow remains deferred to later slice", "workflow-canvas-missing" in step44a)
check("assets IA remains for Step44F", "assets-user-profiles-ia" in step44a)

print("step44e_checks="+str(checks))
print("step44e_failures="+str(len(failures)))
print("step44e_hero_assets="+str(sorted(assets_present)))
print("step44e_legacy_row_actions="+str(all_pages.count('className="inno-row-action"')))
print("step44e_purpose_notes="+str(all_pages.count("<INNOPurposeNote")))
for n,d in failures:
    print("FAILURE: "+n+" :: "+str(d))
raise SystemExit(1 if failures else 0)
