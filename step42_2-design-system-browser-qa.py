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
      padding:c.padding,boxShadow:c.boxShadow,borderRadius:c.borderRadius
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
    if "172.10.1.58:8080" in href and ev("!!document.querySelector('#kc-login')"):
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
check("title is Production Design System", ev("document.querySelector('h1')?.textContent.trim()") == "Production Design System")
check("admin rail owns internal route", ev("""document.querySelector('.prod-rail a[aria-label="Admin Center"]')?.classList.contains('active')""") is True)
check("admin contextual sidebar owns internal route", ev("document.querySelector('.prod-side-title')?.textContent.trim()") == "Admin Center")
check("route absent from normal shell navigation", ev("""document.querySelectorAll('a[href="/internal/design-system"]').length""") == 0)
check("frozen banner visible", ev("document.body.innerText.includes('Frozen reference is versioned in Production')"))
check("frozen path visible", ev("document.body.innerText.includes('production/design-system/frozen/v1.26')"))
check("eight reference sections", ev("document.querySelectorAll('.internal-ds-section').length") == 8)
check("jump navigation has eight links", ev("document.querySelectorAll('.internal-ds-jump a').length") == 8)
check("screen patterns include P02 P03 P04", ev("document.body.innerText.includes('P02') && document.body.innerText.includes('P03') && document.body.innerText.includes('P04')"))
check("no page horizontal overflow 1366", ev("document.documentElement.scrollWidth <= innerWidth + 2"))
check("foundation tokens visible", ev("document.querySelectorAll('.internal-ds-token-card').length") == 6)
check("primary collection renders two rows per page", ev("document.querySelectorAll('#data tbody tr').length") == 2)
check("state hierarchy renders seven states", ev("document.querySelectorAll('.internal-ds-state-grid .inno-state').length") == 7)
check("navigation preview exists", ev("!!document.querySelector('.internal-ds-shell-preview')"))
check("responsive contract has six breakpoints", ev("document.querySelectorAll('.internal-ds-breakpoints article').length") == 6)

# Search interaction
ev("""(()=>{const e=document.querySelector('#data .inno-search input');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,'OPS');e.dispatchEvent(new Event('input',{bubbles:true}));})()""")
time.sleep(.2)
check("collection search demo filters rows", ev("document.querySelectorAll('#data tbody tr').length") == 1)
check("collection search demo returns OPS device", ev("document.querySelector('#data tbody tr td')?.textContent.includes('OPS-WS-008')") is True)
ev("""(()=>{const e=document.querySelector('#data .inno-search input');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));})()""")
time.sleep(.15)

# Select interaction
ev("""(()=>{const e=document.querySelector('#data .inno-select select');const s=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;s.call(e,'offline');e.dispatchEvent(new Event('change',{bubbles:true}));})()""")
time.sleep(.2)
check("collection select demo filters status", ev("document.querySelectorAll('#data tbody tr').length") == 1)
check("offline filter returns Offline state", ev("document.querySelector('#data tbody tr')?.innerText.includes('Offline')") is True)

# Tab and editor interactions
ev("""document.querySelector('.internal-ds-live-pattern [role=tab]:nth-child(2)').click()""")
time.sleep(.15)
check("detail tabs switch", ev("document.querySelector('.internal-ds-detail-section h3')?.textContent") == "Installed software")
ev("""[...document.querySelectorAll('.internal-ds-editor-preview button')].find(b=>b.textContent.includes('Save changes'))?.click()""")
time.sleep(.15)
check("editor demo emits save feedback", ev("document.querySelector('.internal-ds-demo-feedback')?.textContent.includes('Editor saved')") is True)
footer = style(".internal-ds-editor-preview .inno-editor-footer")
check("baseline editor footer is integrated", footer and footer["boxShadow"] == "none" and footer["borderRadius"] == "0px", str(footer))
shot("design-system-1366.png")

for width in (1024, 768):
    viewport(width)
    check(f"design-system route ready {width}", nav("/internal/design-system"))
    check(f"no page horizontal overflow {width}", ev("document.documentElement.scrollWidth <= innerWidth + 2"))
    check(f"{width} internal route stays admin-owned", ev("""document.querySelector('.prod-rail a[aria-label="Admin Center"]')?.classList.contains('active')""") is True)
    reveal = style(".prod-context-reveal")
    check(f"{width} contextual hamburger visible", reveal and reveal["display"] != "none", str(reveal))
    check(f"{width} contextual hamburger label", ev("document.querySelector('.prod-context-reveal span')?.textContent") == "Admin Center")
    pattern = style(".internal-ds-pattern-grid")
    check(f"{width} screen patterns stack", pattern and pattern["gridTemplateColumns"].count(" ") == 0, str(pattern))
    if width == 768:
        check("768 foundation tokens stack", (style(".internal-ds-grid--colors") or {}).get("gridTemplateColumns","").count(" ") == 0)
        check("768 state examples stack", (style(".internal-ds-state-grid") or {}).get("gridTemplateColumns","").count(" ") == 0)
        check("768 shell preview hides contextual sidebar", (style(".internal-ds-shell-side") or {}).get("display") == "none")
    shot(f"design-system-{width}.png")

print("step42_2_design_system_checks=" + str(checks))
print("step42_2_design_system_failures=" + str(len(fails)))
for item in fails:
    print("FAILED", item)
sys.exit(1 if fails else 0)
