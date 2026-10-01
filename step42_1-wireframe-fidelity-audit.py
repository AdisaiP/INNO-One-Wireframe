from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

ui = read("production/packages/ui/src/index.tsx")
ui_css = read("production/packages/ui/src/styles.css")
shell = read("production/apps/web-portal/src/shell.css")
workspace = read("production/apps/web-portal/src/pages/WorkspacePages.tsx")
admin = read("production/apps/web-portal/src/pages/AdminOverviewPage.tsx")
notifications = read("production/apps/web-portal/src/pages/NotificationsPage.tsx")
profile = read("production/apps/web-portal/src/pages/ProfilePage.tsx")
agent = read("production/apps/web-portal/src/pages/AgentDeploymentPage.tsx")
ticket_create = read("production/apps/web-portal/src/pages/TicketCreatePage.tsx")
device_detail = read("production/apps/web-portal/src/pages/DeviceDetailPage.tsx")
asset_detail = read("production/apps/web-portal/src/pages/AssetDetailPage.tsx")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")

for marker in [
    "max-width: 1520px",
    "padding: 24px 24px 32px",
    "font-size: 14px",
    "line-height: 1.45",
    "margin-bottom: 16px",
    "font-size: 24px",
]:
    if marker not in ui_css:
        issues.append("shared final baseline missing " + marker)

for marker in [
    "illustration?: ReactNode",
    "breadcrumb?: ReactNode",
    'className="inno-page-hero"',
    'className="inno-page-hero-copy"',
    'className="inno-page-illustration"',
    'className="inno-page-breadcrumb"',
    "export function INNOSurfaceTabs",
]:
    if marker not in ui:
        issues.append("shared fidelity primitive missing " + marker)

for marker in [
    ".inno-page-breadcrumb",
    ".inno-surface-tabs",
    "min-height: 30px",
]:
    if marker not in ui_css:
        issues.append("shared fidelity CSS missing " + marker)

for marker in [
    "--prod-rail-w: 60px",
    "--prod-side-w: 216px",
    "gap: 6px",
    "padding: 16px 9px 12px",
    "width: 40px",
    "height: 40px",
    "border-radius: 9px",
    "font-size: 17px",
    "font-size: 12px",
    ".inno-page-head {\n  margin-bottom: 16px;",
]:
    if marker not in shell:
        issues.append("shell fidelity missing " + marker)
for marker in [
    'src="/illustrations/workspace-welcome.svg"',
    "workspace-welcome-art",
    "workspace-app-grid",
    "workspace-home-columns",
]:
    if marker not in workspace:
        issues.append("workspace fidelity missing " + marker)

for marker in [
    "grid-template-columns: repeat(5, minmax(0, 1fr))",
    "grid-template-columns: minmax(0, 1.25fr) minmax(280px, .75fr)",
    "padding: 20px 22px",
    "border-radius: 13px",
]:
    if marker not in shell:
        issues.append("workspace geometry missing " + marker)

for marker in [
    "function AdminTile",
    "Organization & access",
    "Platform",
    'icon="section.organization"',
    'icon="section.integrations"',
]:
    if marker not in admin:
        issues.append("admin fidelity missing " + marker)

for marker in [
    ".admin-overview-group-title",
    "grid-template-columns: repeat(3, minmax(0, 1fr))",
    "width: 38px",
    "height: 38px",
]:
    if marker not in shell:
        issues.append("admin geometry missing " + marker)
if "notification-stat-strip" in notifications:
    issues.append("notifications top stat strip must stay removed")
if "moduleLabel(" in notifications:
    issues.append("notifications redundant module label must stay removed")
if "notification-unread-dot" in notifications:
    issues.append("notifications extra unread column must stay removed")
for marker in [
    "grid-template-columns: minmax(0, 1fr) 260px",
    "grid-template-columns: 34px minmax(0, 1fr) auto",
    "width: 30px",
    "height: 30px",
]:
    if marker not in shell:
        issues.append("notification geometry missing " + marker)

for marker in [
    "grid-template-columns: minmax(0, 1fr) minmax(320px, .7fr)",
    "grid-template-columns: 125px minmax(0, 1fr)",
]:
    if marker not in shell:
        issues.append("profile fidelity missing " + marker)

for forbidden in [
    "Email notifications",
    "Desktop notifications",
    "Compact tables",
    "Interface language",
]:
    if forbidden in profile:
        issues.append("unsupported profile preference reintroduced " + forbidden)
for marker in [
    'illustration={<img src="/illustrations/device-setup.svg" alt="" />}',
    "deployment-card",
    "How Enrollment Works",
    "Generate Installer",
]:
    if marker not in agent:
        issues.append("agent deployment fidelity missing " + marker)

if "Enrollment package" in agent:
    issues.append("agent deployment obsolete extra panel header reintroduced")

for marker in [
    "ticket-create-main",
    "ticket-create-section",
    "ticket-create-section-head",
    "ticket-create-section-title",
    "ticket-create-step",
    "ticket-create-advanced",
    "Describe the issue",
    "Add context",
    "Advanced routing & priority",
    "Calculated priority",
    'breadcrumb={(',
    '<Link to="/helpdesk">Helpdesk</Link>',
    '<Link to="/helpdesk/tickets">Tickets</Link>',
]:
    if marker not in ticket_create and marker not in shell:
        issues.append("ticket create fidelity missing " + marker)

for marker in [
    "INNOSurfaceTabs",
    "Device detail sections",
    "{ id: 'overview', label: 'Overview' }",
    "{ id: 'software', label: 'Software' }",
]:
    if marker not in device_detail:
        issues.append("device detail fidelity missing " + marker)

for marker in [
    "INNOSurfaceTabs",
    "Asset detail sections",
    "{ id: 'overview', label: 'Overview' }",
    "{ id: 'custom', label: 'Custom Fields' }",
    "{ id: 'ownership', label: 'Ownership' }",
]:
    if marker not in asset_detail:
        issues.append("asset detail fidelity missing " + marker)

for forbidden in [
    "Related asset",
    "Routing preview",
]:
    if forbidden in ticket_create:
        issues.append("unsupported fake ticket control reintroduced " + forbidden)

for required_path in [
    "production/apps/web-portal/public/illustrations/workspace-welcome.svg",
    "production/apps/web-portal/public/illustrations/device-setup.svg",
]:
    if not (ROOT / required_path).exists():
        issues.append("missing production illustration " + required_path)
if 'DesignSystem = "V1.26"' not in versions:
    issues.append("design system drift")
if 'UiContract = "1.20.0"' not in versions:
    issues.append("UI contract drift")
implementation_match = re.search(
    r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"',
    versions,
)
implementation_version = tuple(map(int, implementation_match.groups())) if implementation_match else (0, 0, 0)
if implementation_version < (0, 31, 0):
    issues.append("implementation contract must remain at least 0.31.0")

print("step42_1_scope=wireframe-fidelity")
print("step42_1_desktop=1366-canonical")
print("step42_1_responsive=1024,768")
print("step42_1_backend=unchanged")
print("step42_1_design_system=V1.26")
print("step42_1_ui_contract=1.20.0")
print("step42_1_implementation_contract_min=0.31.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
