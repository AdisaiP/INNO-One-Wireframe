from pathlib import Path
import base64, json, re, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
PORT = 9241
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
OUT = ROOT / "qa-step45n-bilingual-cleanup-browser"
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

checks = 0
failures = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

source = (ROOT / "step45g-helpdesk-automation-runs-browser-qa.py").read_text(encoding="utf-8")
helpers = source[source.index("class CDP:"):source.index("c=CDP(); c.viewport(1366)")]
helpers = helpers.replace("timeout=10,origin=", "timeout=30,origin=")
helpers = helpers.replace('self.call("Page.enable"); self.call("Runtime.enable")', '')
exec(helpers)

def has_thai(value):
    return any("\u0e00" <= ch <= "\u0e7f" for ch in (value or ""))

def no_visible_key(value):
    return re.search(r"\b(?:common|admin|assets|devices|helpdesk|reports|navigation)\.step45n\.", value or "") is None

c = CDP()
c.viewport(1366)
check("Keycloak login completes", login(c), c.ev("location.href") or "")
if failures:
    raise SystemExit(1)

original_profile = profile_state(c)
original_settings = admin_settings(c)
original_pref = original_profile.get("preferredLocale")
original_default = original_settings["localization"]["defaultLocale"]

check("Force English organization default", set_admin_locale(c, "en-US").get("status") == 200)
check("Use organization locale", set_profile_locale(c, None).get("status") == 200)

en_notifications = api(c, """
 const r=await fetch('/api/v1/platform/notifications?page=1&pageSize=100',{headers});
 return {status:r.status,data:await r.json()};
""")
en_items = en_notifications.get("data", {}).get("items", [])
check("English notifications API 200", en_notifications.get("status") == 200, en_notifications.get("status"))
check("English notifications available", len(en_items) > 0, len(en_items))
check("English notification contentLocale", all(x.get("contentLocale") == "en-US" for x in en_items), [x.get("contentLocale") for x in en_items])
pc_en = next((x for x in en_items if x.get("notificationType") == "device.offline" and "PC-FIN-021" in x.get("title", "")), None)
check("English seeded device notification resolved", bool(pc_en), pc_en)
if pc_en:
    check("English seeded notification copy", "offline longer than expected" in pc_en.get("title", ""), pc_en.get("title"))

permissions_response = api(c, """
 const r=await fetch('/api/v1/admin/permissions',{headers});
 return {status:r.status,data:await r.json()};
""")
permission_items = permissions_response.get("data", {}).get("items", [])
retired_permissions = [
    x.get("permissionId") for x in permission_items
    if str(x.get("permissionId") or "").startswith("workflows.")
]
check("Admin permissions API 200", permissions_response.get("status") == 200, permissions_response.get("status"))
check("Generic workflow permissions retired", not retired_permissions, retired_permissions)

c.navigate("http://localhost:5180/workflows")
workflows_redirect = wait(c, "location.pathname==='/helpdesk/automation'", 10)
check("Standalone workflows route retired", bool(workflows_redirect), c.ev("location.pathname") or "")

representative = [
    ("/", "workspace"),
    ("/admin/roles", "admin"),
    ("/devices", "devices"),
    ("/assets/inventory", "assets"),
    ("/helpdesk/tickets", "helpdesk"),
    ("/reports", "reports"),
    ("/notifications", "notifications"),
]
for route, label in representative:
    route_ok = nav(c, route)
    if label == "workspace" and not route_ok:
        route_ok = bool(wait(c, "!!document.querySelector('.workspace-home-page')", 10))
    notification_ready = True
    if label == "notifications":
        notification_ready = bool(wait(c, "!!document.querySelector('.notification-copy [lang=\"en\"]')", 20))
    check(f"English {label} ready", route_ok)
    page = body(c)
    check(f"English {label} document lang", c.ev("document.documentElement.lang") == "en", c.ev("document.documentElement.lang"))
    check(f"English {label} no translation key", no_visible_key(page), page[:300])
    check(f"English {label} no overflow", no_overflow(c))
    if label == "notifications":
        check("English notification DOM lang", notification_ready)
    c.shot(f"1366__{label}-en.png")

check("Switch user locale to Thai", set_profile_locale(c, "th-TH").get("status") == 200)

th_notifications = api(c, """
 const r=await fetch('/api/v1/platform/notifications?page=1&pageSize=100',{headers});
 return {status:r.status,data:await r.json()};
""")
th_items = th_notifications.get("data", {}).get("items", [])
check("Thai notifications API 200", th_notifications.get("status") == 200, th_notifications.get("status"))
pc_th = next((x for x in th_items if x.get("notificationType") == "device.offline" and "PC-FIN-021" in x.get("title", "")), None)
check("Thai seeded device notification resolved", bool(pc_th), pc_th)
if pc_th:
    check("Thai seeded notification contentLocale", pc_th.get("contentLocale") == "th-TH", pc_th)
    check("Thai seeded notification title", has_thai(pc_th.get("title")), pc_th.get("title"))
    check("Thai seeded notification message", has_thai(pc_th.get("message")), pc_th.get("message"))

for width in (1366, 768):
    c.viewport(width)
    for route, label in representative:
        route_ok = nav(c, route)
        if label == "workspace" and not route_ok:
            route_ok = bool(wait(c, "!!document.querySelector('.workspace-home-page')", 10))
        notification_ready = True
        if label == "notifications":
            notification_ready = bool(wait(c, "!!document.querySelector('.notification-copy [lang=\"th\"]')", 20))
        check(f"{width} Thai {label} ready", route_ok)
        page = body(c)
        check(f"{width} Thai {label} document lang", c.ev("document.documentElement.lang") == "th", c.ev("document.documentElement.lang"))
        check(f"{width} Thai {label} has Thai copy", has_thai(page), page[:300])
        check(f"{width} Thai {label} no translation key", no_visible_key(page), page[:300])
        check(f"{width} Thai {label} no overflow", no_overflow(c))
        if label == "notifications":
            check(f"{width} Thai notification DOM lang", notification_ready)
            check(f"{width} Thai notification copy visible", "ออฟไลน์นานกว่าที่คาด" in page, page[:500])
        c.shot(f"{width}__{label}-th.png")

check("Restore organization locale", set_admin_locale(c, original_default).get("status") == 200)
check("Restore user locale", set_profile_locale(c, original_pref).get("status") == 200)

print(f"step45n_browser_checks={checks}")
print(f"step45n_browser_failures={len(failures)}")
print(f"step45n_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED", item)
raise SystemExit(1 if failures else 0)
