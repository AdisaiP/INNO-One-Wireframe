from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step42_2-design-system"
PORT = 9241
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

checks = 0
fails = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + detail) if detail else ""))
    if not ok:
        fails.append((name, detail))

targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=3).json()
page = next(x for x in targets if x.get("type") == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=10, origin="http://127.0.0.1")
seq = 0

def call(method, params=None):
    global seq
    seq += 1
    ident = seq
    ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == ident:
            if "error" in msg:
                raise RuntimeError(msg["error"])
            return msg.get("result", {})

def ev(expr):
    result = call("Runtime.evaluate", {
        "expression": expr,
        "returnByValue": True,
        "awaitPromise": True,
    })
    return result.get("result", {}).get("value")

def viewport(width):
    call("Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": 900,
        "deviceScaleFactor": 1,
        "mobile": False,
    })

def nav(route):
    call("Page.navigate", {"url": "http://localhost:5180" + route})
    deadline = time.time() + 12
    while time.time() < deadline:
        if ev("!!document.querySelector('.inno-production-shell') && !!document.querySelector('h1')"):
            time.sleep(.25)
            return True
        time.sleep(.15)
    return False

def shot(name):
    data = call("Page.captureScreenshot", {
        "format": "png",
        "fromSurface": True,
        "captureBeyondViewport": False,
    })["data"]
    (OUT / name).write_bytes(base64.b64decode(data))

def realm_password(username):
    realm = json.loads(REALM.read_text(encoding="utf-8"))
    user = next(x for x in realm["users"] if x["username"] == username)
    return user["credentials"][0]["value"]

def style(selector):
    return ev("""(s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e),r=e.getBoundingClientRect();return{
      display:c.display,gridTemplateColumns:c.gridTemplateColumns,overflowX:c.overflowX,
      x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
      marginTop:c.marginTop,marginBottom:c.marginBottom,padding:c.padding,
      boxShadow:c.boxShadow,borderRadius:c.borderRadius,position:c.position
    }})(%s)""" % json.dumps(selector))

call("Page.enable")
call("Runtime.enable")
viewport(1366)
call("Page.navigate", {"url": "http://localhost:5180/internal/design-system"})
password = realm_password("adisai")
deadline = time.time() + 35
logged_in = False
while time.time() < deadline:
    href = ev("location.href") or ""
    if ("172.10.1.58:8080" in href or "localhost:8080" in href) and ev("!!document.querySelector('#kc-login')"):
        ev(
            "document.querySelector('#username').value='adisai';"
            + "document.querySelector('#password').value=" + json.dumps(password) + ";"
            + "document.querySelector('#kc-login').click();"
        )
        time.sleep(.7)
    if href.startswith("http://localhost:5180") and ev("!!document.querySelector('.inno-production-shell')"):
        logged_in = True
        break
    time.sleep(.2)
check("Keycloak login", logged_in, ev("location.href") or "")

ev("localStorage.setItem('inno.ui.sidebar.collapsed','0')")
viewport(1366)
check("design-system route ready 1366", nav("/internal/design-system"))
check("title matches frozen page", ev("document.querySelector('h1')?.textContent.trim()") == "Design System V1.26")
check("eyebrow matches frozen page", ev("document.querySelector('.internal-ds-eyebrow')?.textContent.trim()") == "INNO.ONE UI FOUNDATION")
check("admin rail remains global owner", ev("""document.querySelector('.prod-rail a[aria-label="Admin Center"]')?.classList.contains('active')""") is True)
check("context sidebar is Design System", ev("document.querySelector('.prod-side-title')?.textContent.trim()") == "Design System")
check("context label is Design System", ev("document.querySelector('.prod-context-reveal span')?.textContent") == "Design System")
check("internal route absent from normal route navigation", ev("""document.querySelectorAll('a[href="/internal/design-system"]').length""") == 0)
check("sidebar has thirteen frozen section links", ev("""document.querySelectorAll('.prod-side a[href^="#"]').length""") == 13)
check("React page has thirteen frozen sections", ev("document.querySelectorAll('.internal-ds-section').length") == 13)
check("frozen banner visible", ev("document.body.innerText.includes('UI Contract 1.20.0 is frozen')"))
check("implementation direction visible", ev("document.body.innerText.includes('Implementation direction')"))
check("Frozen UI contract section visible", ev("document.body.innerText.includes('Frozen UI contract')"))
check("source of truth visible", ev("document.body.innerText.includes('React consumes the contract, not prototype internals.')"))
check("Hierarchy section visible", ev("document.body.innerText.includes('Hierarchy components')"))
check("Interactions section visible", ev("document.body.innerText.includes('Interaction standards')"))
check("Dialog section visible", ev("document.body.innerText.includes('Dialog & overlays')"))
check("Icons section visible", ev("document.body.innerText.includes('Icon vocabulary')"))
check("Implementation map visible", ev("document.body.innerText.includes('Implementation map')"))
check("no page horizontal overflow 1366", ev("document.documentElement.scrollWidth <= innerWidth + 2"))

section_style = style(".internal-ds-section")
card_style = style(".internal-ds-card")
freeze_grid = style(".internal-ds-freeze-grid")
foundation_grid = style("#foundations .internal-ds-grid")
check("section rhythm matches frozen 28px", section_style and section_style["marginTop"] == "28px" and section_style["marginBottom"] == "28px", str(section_style))
check("card radius matches frozen 12px", card_style and card_style["borderRadius"] == "12px", str(card_style))
check("card padding matches frozen 18px", card_style and card_style["padding"] == "18px", str(card_style))
check("frozen contract grid is two columns 1366", freeze_grid and len(freeze_grid["gridTemplateColumns"].split()) == 2, str(freeze_grid))
check("foundation grid is two columns 1366", foundation_grid and len(foundation_grid["gridTemplateColumns"].split()) == 2, str(foundation_grid))
check("page has two header actions", ev("document.querySelectorAll('.internal-ds-page-actions button').length") == 2)
check("feedback toast hidden before action", ev("document.querySelector('.internal-ds-feedback') === null"))

ev("""document.querySelector('.prod-side a[href="#states"]').click()""")
time.sleep(.15)
check("hash navigation updates location", ev("location.hash") == "#states")
check("clicked Design System sidebar item becomes active", ev("""document.querySelector('.prod-side a[href="#states"]').classList.contains('active')""") is True)
nav("/internal/design-system")

ev("""(()=>{const e=document.querySelector('#data input[placeholder="Search devices..."]');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,'PC-FIN');e.dispatchEvent(new Event('input',{bubbles:true}));})()""")
time.sleep(.2)
check("Data Table search filters rows", ev("document.querySelectorAll('#data tbody tr').length") == 1)
check("Data Table search returns PC-FIN-021", ev("document.querySelector('#data tbody tr')?.innerText.includes('PC-FIN-021')") is True)
ev("""(()=>{const e=document.querySelector('#data input[placeholder="Search devices..."]');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));})()""")
time.sleep(.15)

ev("""(()=>{const e=document.querySelector('#data select');const s=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;s.call(e,'offline');e.dispatchEvent(new Event('change',{bubbles:true}));})()""")
time.sleep(.2)
check("Data Table status filter works", ev("document.querySelectorAll('#data tbody tr').length") == 1)
check("offline filter returns Offline row", ev("document.querySelector('#data tbody tr')?.innerText.includes('Offline')") is True)

ev("""[...document.querySelectorAll('#interactions button')].find(b=>b.textContent.includes('More actions'))?.click()""")
time.sleep(.1)
check("context menu demo opens", ev("!!document.querySelector('#interactions .internal-ds-menu')"))
ev("""document.querySelector('#interactions .internal-ds-menu button')?.click()""")
time.sleep(.1)
check("context menu demo closes after action", ev("!document.querySelector('#interactions .internal-ds-menu')"))

ev("""[...document.querySelectorAll('#overlays button')].find(b=>b.textContent.includes('Open Dialog'))?.click()""")
time.sleep(.1)
check("dialog demo opens", ev("!!document.querySelector('.inno-dialog[role=dialog]')"))
ev("""[...document.querySelectorAll('.inno-dialog button')].find(b=>b.textContent.includes('Cancel'))?.click()""")
time.sleep(.1)
check("dialog demo closes", ev("!document.querySelector('.inno-dialog')"))

ev("""[...document.querySelectorAll('#overlays button')].find(b=>b.textContent.includes('Open Sheet'))?.click()""")
time.sleep(.1)
check("sheet demo opens", ev("!!document.querySelector('.inno-drawer[role=dialog]')"))
ev("""document.querySelector('.inno-drawer .inno-overlay-close')?.click()""")
time.sleep(.1)
check("sheet demo closes", ev("!document.querySelector('.inno-drawer')"))

ev("""[...document.querySelectorAll('#buttons button')].find(b=>b.textContent.includes('Primary'))?.click()""")
time.sleep(.1)
check("feedback toast appears after action", ev("document.querySelector('.internal-ds-feedback')?.textContent.includes('Primary action')") is True)
shot("design-system-1366.png")

for width in (1024, 768):
    viewport(width)
    check(f"design-system route ready {width}", nav("/internal/design-system"))
    check(f"no page horizontal overflow {width}", ev("document.documentElement.scrollWidth <= innerWidth + 2"))
    check(f"{width} context sidebar title remains Design System", ev("document.querySelector('.prod-side-title')?.textContent.trim()") == "Design System")
    reveal = style(".prod-context-reveal")
    check(f"{width} contextual hamburger visible", reveal and reveal["display"] != "none", str(reveal))
    check(f"{width} contextual hamburger label", ev("document.querySelector('.prod-context-reveal span')?.textContent") == "Design System")
    check(f"{width} thirteen sections remain", ev("document.querySelectorAll('.internal-ds-section').length") == 13)
    grid = style("#foundations .internal-ds-grid")
    check(f"{width} foundation grid stacks", grid and len(grid["gridTemplateColumns"].split()) == 1, str(grid))
    check(f"{width} frozen grid stacks", len((style('.internal-ds-freeze-grid') or {}).get('gridTemplateColumns','').split()) == 1)
    shot(f"design-system-{width}.png")

print("step42_2_design_system_checks=" + str(checks))
print("step42_2_design_system_failures=" + str(len(fails)))
for item in fails:
    print("FAILED", item)
sys.exit(1 if fails else 0)
