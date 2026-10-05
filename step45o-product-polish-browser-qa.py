from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
PORT = 9241
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
OUT = ROOT / "qa-step45o-product-polish-browser"
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

c = CDP()
c.viewport(1366)
check("Keycloak login completes", login(c), c.ev("location.href") or "")
if failures:
    raise SystemExit(1)

original_profile = profile_state(c)
original_pref = original_profile.get("preferredLocale")

def click_language(label, lang):
    clicked = c.ev("""(()=>{const b=[...document.querySelectorAll('.prod-language-switch button')].find(x=>x.textContent.trim()==='""" + label + """');if(!b)return false;b.click();return true})()""")
    ok = bool(clicked) and bool(wait(c, "document.documentElement.lang==='" + lang + "'", 12))
    time.sleep(.35)
    return ok

check("top bar language switch visible", bool(wait(c, "document.querySelectorAll('.prod-language-switch button').length===2", 8)))
header_text = c.ev("document.querySelector('.prod-header-actions')?.innerText||''") or ""
check("sign out not exposed in top bar", "Sign out" not in header_text and "ออกจากระบบ" not in header_text, header_text)
check("user trigger available", c.ev("!!document.querySelector('.prod-user-trigger')") is True)
c.ev("document.querySelector('.prod-user-trigger').click()")
check("user popover opens", bool(wait(c, "!!document.querySelector('.prod-user-popover')", 5)))
popover_text = c.ev("document.querySelector('.prod-user-popover')?.innerText||''") or ""
check("sign out lives in user menu", ("Sign out" in popover_text) or ("ออกจากระบบ" in popover_text), popover_text)
check("profile action lives in user menu", c.ev("""!!document.querySelector('.prod-user-popover a[href="/profile"]')""") is True)
c.ev("document.querySelector('.prod-user-trigger').click()")

check("top bar can switch English", click_language("EN", "en"))
check("English switch becomes active", c.ev("document.querySelector('.prod-language-switch button.active')?.textContent.trim()==='EN'") is True)
check("top bar can switch Thai", click_language("ไทย", "th"))
check("Thai switch becomes active", c.ev("document.querySelector('.prod-language-switch button.active')?.textContent.trim()==='ไทย'") is True)

routes = [
    ("/admin/settings", "platform-settings"),
    ("/admin/organization", "organization"),
    ("/helpdesk/sla", "sla"),
    ("/helpdesk/calendar", "calendar"),
]
for width in (1366, 1024, 768):
    c.viewport(width)
    for route, label in routes:
        check(f"{width} {label} ready", nav(c, route), c.ev("location.pathname") or "")
        selector = {
            "platform-settings": ".platform-settings-layout",
            "organization": ".inno-tree-row",
            "sla": ".sla-level-field",
            "calendar": ".business-day-row",
        }[label]
        loaded = bool(wait(c, "!!document.querySelector(" + json.dumps(selector) + ")", 15))
        check(f"{width} {label} data rendered", loaded, body(c)[:240] if not loaded else "")
        check(f"{width} {label} no overflow", no_overflow(c))
        if label == "platform-settings":
            check(f"{width} settings scope note", c.ev("!!document.querySelector('.inno-purpose-note')") is True)
            check(f"{width} settings split layout", c.ev("!!document.querySelector('.platform-settings-layout')") is True)
        elif label == "organization":
            rows = c.ev("document.querySelectorAll('.inno-tree-row').length") or 0
            nested = c.ev("[...document.querySelectorAll('.inno-tree-row')].filter(x=>Number(x.dataset.level)>1).length") or 0
            check(f"{width} organization tree rows", rows >= 1, rows)
            check(f"{width} organization nested rows", nested >= 1, nested)
            connector = c.ev("""(()=>{const r=[...document.querySelectorAll('.inno-tree-row[data-last-sibling=true]')].find(x=>Number(x.dataset.level)>1);if(!r)return null;const s=getComputedStyle(r,'::before');return {style:s.borderLeftStyle,bottom:s.bottom}})()""")
            check(f"{width} organization last connector terminates", bool(connector) and connector.get("style") == "solid", connector)
        elif label == "sla":
            check(f"{width} SLA visible escalation labels", (c.ev("document.querySelectorAll('.sla-level-field > span').length") or 0) >= 3)
            check(f"{width} SLA save footer", c.ev("!!document.querySelector('.sla-save-footer.is-docked')") is True)
        elif label == "calendar":
            check(f"{width} calendar seven compact rows", c.ev("document.querySelectorAll('.business-day-row').length") == 7)
            body_text = body(c)
            check(f"{width} calendar localized weekday", any(day in body_text for day in ["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"]), body_text[:250])
        c.shot(f"{width}__{label}.png")

c.viewport(1366)
concepts = [
    "concept-01-corporate-clean.html",
    "concept-02-modern-workspace.html",
    "concept-03-security-trust.html",
    "concept-04-operations-command.html",
    "concept-05-friendly-enterprise.html",
]
for index, concept in enumerate(concepts, start=1):
    c.navigate("http://localhost:5190/" + concept)
    ready = wait(c, "!!document.querySelector('.login-card') && !!document.querySelector('.hero-art')", 8)
    check(f"login concept {index} ready", bool(ready))
    check(f"login concept {index} no overflow", no_overflow(c))
    c.shot(f"1366__login-concept-{index}.png")

c.navigate("http://localhost:5180/")
wait(c, "!!document.querySelector('.inno-production-shell')", 8)
check("restore user locale", set_profile_locale(c, original_pref).get("status") == 200)

print(f"step45o_browser_checks={checks}")
print(f"step45o_browser_failures={len(failures)}")
print(f"step45o_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED", item)
raise SystemExit(1 if failures else 0)
