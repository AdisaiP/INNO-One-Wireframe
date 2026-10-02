from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
issues = []

def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")

endpoint = read("production/services/platform-api/src/Modules/Platform/Api/PlatformNotificationEndpoints.cs")
entities = read("production/services/platform-api/src/Modules/Platform/Domain/PlatformEntities.cs")
db = read("production/services/platform-api/src/Modules/Platform/Persistence/PlatformDbContext.cs")
seed = read("production/services/platform-api/src/Modules/Platform/Infrastructure/PlatformDevelopmentSeed.cs")
program = read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
versions = read("production/services/platform-api/src/INNO.One.Contracts/ContractVersions.cs")
types = read("production/apps/web-portal/src/api/types.ts")
client = read("production/apps/web-portal/src/api/client.ts")
root = read("production/apps/web-portal/src/app/AppRoot.tsx")
shell = read("production/apps/web-portal/src/app/AppShell.tsx")
page = read("production/apps/web-portal/src/pages/NotificationsPage.tsx")
profile = read("production/apps/web-portal/src/pages/ProfilePage.tsx")
styles = read("production/apps/web-portal/src/shell.css")
frozen = read("INNO-One-Design-System-V1-Frozen.md")
prototype = read("notifications.html")

for marker in [
    'api.MapGet("/platform/notifications"',
    'api.MapPatch("/platform/notifications/{notificationId}"',
    'api.MapPost("/platform/notifications/mark-all-read"',
    '"platform.notifications.view"',
    'x.UserId == access.UserId',
    'OpaqueId.TryParse(notificationId, "notification"',
    'request.IsRead ? DateTimeOffset.UtcNow : null',
    'ExecuteUpdateAsync',
    'DestinationPath',
]:
    if marker not in endpoint:
        issues.append("endpoint " + marker)

for marker in [
    "public sealed class PlatformNotification",
    "UserId",
    "SourceModule",
    "NotificationType",
    "DestinationPath",
    "ReadAt",
    "CreatedAt",
]:
    if marker not in entities:
        issues.append("entity " + marker)

for marker in [
    "DbSet<PlatformNotification> Notifications",
    'entity.ToTable("notifications")',
    "x.UserId, x.ReadAt, x.CreatedAt",
    "HasOne<UserProfile>()",
]:
    if marker not in db:
        issues.append("db " + marker)

for marker in [
    "Step37Permissions",
    '("platform.notifications.view", "platform", "View personal platform notifications")',
    "Step37Notifications",
    "EnsureStep37NotificationsAsync",
]:
    if marker not in seed:
        issues.append("seed " + marker)

if seed.count(".Concat(Step37Permissions)") != 2:
    issues.append("step37 permission ensure chain")
if 'MapPlatformNotificationEndpoints()' not in program:
    issues.append("program notification endpoint")

migration_files = list((ROOT / "production/services/platform-api/src/Modules/Platform/Persistence/Migrations").glob("*_Step37PlatformNotifications.cs"))
if len(migration_files) != 1:
    issues.append("step37 migration count")

for marker in [
    "PlatformNotificationItem",
    "PlatformNotificationsResponse",
    "PlatformNotificationMarkAllResult",
]:
    if marker not in types:
        issues.append("types " + marker)

for marker in [
    "getPlatformNotifications",
    "updatePlatformNotification",
    "markAllPlatformNotificationsRead",
    "'/platform/notifications?'",
    "'/platform/notifications/mark-all-read'",
]:
    if marker not in client:
        issues.append("client " + marker)

for marker in [
    "NotificationsPage",
    "platform.notifications.view",
    'path="notifications"',
]:
    if marker not in root:
        issues.append("route " + marker)

for marker in [
    "platform.notifications.view",
    "canViewNotifications",
    "prod-notification-link",
    'to="/notifications"',
    'Notifications',
]:
    if marker not in shell:
        issues.append("shell " + marker)

for marker in [
    'title="Notifications"',
    "Events from apps across INNO.One",
    "Mark all read",
    "You’re all caught up",
    "Safe deep links",
    "getPlatformNotifications",
    "updatePlatformNotification",
]:
    if marker not in page:
        issues.append("page " + marker)

for forbidden in [
    "Notification preferences",
    "type=\"checkbox\"",
    "Email notifications",
    "Desktop notifications",
]:
    if forbidden in page:
        issues.append("fake preference control " + forbidden)

for marker in [
    ".notification-layout",
    ".notification-feed",
    ".notification-row",
    ".notification-stat-strip",
]:
    if marker not in styles:
        issues.append("styles " + marker)

if "Email notifications" in profile or "Desktop notifications" in profile:
    issues.append("profile invents uncontracted notification preferences")
if "design-system.html" not in frozen or "visual reference and usage rules" not in frozen:
    issues.append("frozen design system source")
if "Mark all read" not in prototype or "You" not in prototype:
    issues.append("prototype reference")

if 'DesignSystem = "V1.26"' not in versions or 'UiContract = "1.20.0"' not in versions:
    issues.append("frozen UX version changed")
version_match = re.search(r'ImplementationContract = "(\d+)\.(\d+)\.(\d+)"', versions)
implementation_version = tuple(map(int, version_match.groups())) if version_match else (0, 0, 0)
if implementation_version < (0, 27, 0):
    issues.append("implementation contract")

print("step37_scope=platform-notification-center,self-read-state,authorized-deep-links")
print("step37_permission=platform.notifications.view")
print("step37_implementation_contract=0.27.0")
print("issues=" + str(len(issues)))
for issue in issues:
    print("ISSUE: " + issue)

raise SystemExit(1 if issues else 0)
