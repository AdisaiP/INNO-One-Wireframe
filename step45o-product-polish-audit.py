import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

shell = read("production/apps/web-portal/src/app/AppShell.tsx")
shell_css = read("production/apps/web-portal/src/shell.css")
tree = read("production/packages/ui/src/index.tsx")
tree_css = read("production/packages/ui/src/styles.css")
settings = read("production/apps/web-portal/src/pages/AdminPlatformSettingsPage.tsx")
hierarchy = read("production/apps/web-portal/src/pages/AdminHierarchyPage.tsx")
sla = read("production/apps/web-portal/src/pages/HelpdeskSlaPage.tsx")
calendar = read("production/apps/web-portal/src/pages/BusinessCalendarPage.tsx")
en_admin = json.loads(read("production/packages/i18n/src/locales/en-US/admin.json"))
th_admin = json.loads(read("production/packages/i18n/src/locales/th-TH/admin.json"))
en_helpdesk = json.loads(read("production/packages/i18n/src/locales/en-US/helpdesk.json"))
th_helpdesk = json.loads(read("production/packages/i18n/src/locales/th-TH/helpdesk.json"))

checks = []
failures = []

def check(name, condition):
    checks.append(name)
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)

check("top bar owns language switch", 'className="prod-language-switch"' in shell)
check("language switch persists preferred locale", "updateCurrentProfile({ preferredLocale: locale })" in shell)
check("language switch refreshes shared profile cache", "setQueryData(['platform', 'me'], updatedProfile)" in shell)
check("sign out moved into user popover", 'className="prod-user-popover"' in shell and "common.actions.signOut" in shell)
check("legacy standalone header sign out removed", '<button className="prod-icon-button" type="button" onClick={() => void logout()}>' not in shell)
check("top bar language styling exists", ".prod-language-switch" in shell_css)
check("user popover styling exists", ".prod-user-popover" in shell_css)

check("platform settings explains ownership", "<INNOPurposeNote" in settings and "admin.settings.scope.title" in settings)
check("platform settings separates defaults and runtime", "platform-settings-defaults" in settings and "platform-settings-summary" in settings)
check("platform settings layout responsive", ".platform-settings-layout" in shell_css)
for key in ["admin.settings.scope.title","admin.settings.scope.description","admin.settings.defaults.title","admin.settings.runtime.title"]:
    check("admin locale pair " + key, key in en_admin and key in th_admin)

check("organization title localized", "admin.step45n.adminOverview.organizationStructure" in hierarchy and "'Organization Structure'" not in hierarchy)
check("tree identifies last sibling", "isLastSibling" in tree and 'data-last-sibling={row.isLastSibling' in tree)
check("tree last sibling connector terminates", '[data-last-sibling="true"]::before' in tree_css)
check("tree indentation is deliberate", "(row.level - 1) * 24" in tree)

check("SLA uses localized durations", "durationLabel" in sla and "durationMinutes" in sla and "durationHours" in sla)
check("SLA escalation fields have visible labels", "sla-level-field" in sla and "escalationThreshold" in sla and "targetRole" in sla and "escalationTeam" in sla)
check("SLA save footer owns whole editor", 'docked className="sla-save-footer"' in sla)
check("SLA monitor state localized", "stateLabel" in sla and "state.atRisk" in sla)
for key in ["helpdesk.step45n.helpdeskSla.durationMinutes","helpdesk.step45n.helpdeskSla.escalationThreshold","helpdesk.step45n.helpdeskSla.targetRole","helpdesk.step45n.helpdeskSla.state.atRisk"]:
    check("helpdesk locale pair " + key, key in en_helpdesk and key in th_helpdesk)

check("calendar no hardcoded weekday array", "const dayNames =" not in calendar)
check("calendar weekday follows locale", "Intl.DateTimeFormat(locale" in calendar)
check("calendar uses compact weekly rows", "business-week-list" in calendar and "business-day-row" in calendar)
check("calendar old card grid removed", "business-day-grid" not in calendar and "business-day-card" not in calendar)
check("calendar responsive styles exist", ".business-week-list" in shell_css and ".business-day-row" in shell_css)

concept_dir = ROOT / "production/infrastructure/keycloak/login-concepts"
concepts = sorted(concept_dir.glob("concept-*.html"))
check("five Keycloak login concepts exist", len(concepts) == 5)
check("login concept gallery exists", (concept_dir / "index.html").exists())
check("login concepts reuse product illustrations", all("assets/" in p.read_text(encoding="utf-8") for p in concepts))
check("login concept illustration assets bundled", all((concept_dir / "assets" / name).exists() for name in ["workspace-welcome.svg", "device-setup.svg", "asset-inventory.svg"]))
check("login concepts remain preview-only", "not wired into the active Keycloak realm" in (concept_dir / "README.md").read_text(encoding="utf-8"))

print("step45o_checks=" + str(len(checks)))
print("step45o_failures=" + str(len(failures)))
if failures:
    for failure in failures:
        print("FAILURE: " + failure)
    raise SystemExit(1)
