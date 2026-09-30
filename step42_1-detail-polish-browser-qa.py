from pathlib import Path
import base64, json, sys, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
PORT = 9241
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
OUT = ROOT / "qa-step42_1-detail-polish"
OUT.mkdir(exist_ok=True)

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
    r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    return r.get("result", {}).get("value")

def viewport(width):
    call("Emulation.setDeviceMetricsOverride", {"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False})

def nav(route):
    call("Page.navigate", {"url": "http://localhost:5180" + route})
    deadline = time.time() + 12
    while time.time() < deadline:
        if ev("!!document.querySelector('.inno-production-shell')"):
            time.sleep(.25)
            return True
        time.sleep(.15)
    return False

def shot(name):
    data = call("Page.captureScreenshot", {"format": "png", "fromSurface": True, "captureBeyondViewport": False})["data"]
    (OUT / name).write_bytes(base64.b64decode(data))

def realm_password(username):
    realm = json.loads(REALM.read_text(encoding="utf-8"))
    user = next(x for x in realm["users"] if x["username"] == username)
    return user["credentials"][0]["value"]

call("Page.enable")
call("Runtime.enable")
viewport(1366)
call("Page.navigate", {"url": "http://localhost:5180/devices"})
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

ev("localStorage.removeItem('inno.ui.sidebar.collapsed')")
nav("/devices")

def style(selector):
    return ev("""(s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e),r=e.getBoundingClientRect();return{
      display:c.display,visibility:c.visibility,padding:c.padding,margin:c.margin,border:c.border,
      borderBottom:c.borderBottom,marginBottom:c.marginBottom,
      x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)
    }})(%s)""" % json.dumps(selector))

# Desktop contextual navigation contract
viewport(1366); nav("/devices")
check("desktop header has no contextual hamburger", not ev("!!document.querySelector('.prod-header .prod-context-toggle')"))
collapse = style(".prod-side-collapse")
reveal = style(".prod-context-reveal")
check("desktop collapse control visible", collapse and collapse["display"] != "none", str(collapse))
check("desktop reveal hidden while expanded", reveal and reveal["display"] == "none", str(reveal))
check("desktop sidebar width 216", abs((style(".prod-side") or {}).get("w", 0) - 216) <= 1, str(style(".prod-side")))
check("desktop rail begins below header", abs((style(".prod-rail") or {}).get("y", 0) - 56) <= 1, str(style(".prod-rail")))
check("desktop sidebar begins below header", abs((style(".prod-side") or {}).get("y", 0) - 56) <= 1, str(style(".prod-side")))
check("desktop page padding frozen", (style(".inno-page") or {}).get("padding") == "24px 16px 32px", str(style(".inno-page")))
check("desktop page-head margin frozen", (style(".inno-page-head") or {}).get("marginBottom") == "16px", str(style(".inno-page-head")))
ev("document.querySelector('.prod-side-collapse').click()")
time.sleep(.25)
check("desktop sidebar collapses", ev("getComputedStyle(document.querySelector('.prod-side')).display==='none'"))
check("desktop edge reopen visible", ev("getComputedStyle(document.querySelector('.prod-context-reveal')).display!=='none'"))
check("desktop collapsed main starts after rail", abs((style(".prod-main") or {}).get("x", 0) - 60) <= 1, str(style(".prod-main")))
ev("document.querySelector('.prod-context-reveal').click()")
time.sleep(.25)
check("desktop sidebar restores", ev("getComputedStyle(document.querySelector('.prod-side')).display!=='none'"))
shot("devices-1366.png")

# Tablet / compact contextual hamburger contract
for width, expected_label in [(1024, "Devices"), (768, "Devices")]:
    viewport(width); nav("/devices")
    ev("localStorage.setItem('inno.ui.sidebar.collapsed','0')")
    time.sleep(.15)
    reveal = style(".prod-context-reveal")
    check(f"{width} labeled hamburger visible", reveal and reveal["display"] != "none", str(reveal))
    check(f"{width} hamburger label", ev("document.querySelector('.prod-context-reveal span')?.textContent") == expected_label)
    check(f"{width} global header clean", not ev("!!document.querySelector('.prod-header .prod-context-toggle')"))
    check(f"{width} sidebar closed initially", ev("getComputedStyle(document.querySelector('.prod-side')).display==='none'"))
    check(f"{width} page top reserves contextual control", (style(".inno-page") or {}).get("padding","").split()[0] in ("62px","58px"), str(style(".inno-page")))
    ev("document.querySelector('.prod-context-reveal').click()")
    time.sleep(.2)
    check(f"{width} hamburger opens drawer", ev("getComputedStyle(document.querySelector('.prod-side')).display!=='none'"))
    check(f"{width} backdrop visible", bool(ev("!!document.querySelector('.prod-side-backdrop')")))
    check(f"{width} close control visible in drawer", ev("getComputedStyle(document.querySelector('.prod-side-collapse')).display!=='none'"))
    ev("document.querySelector('.prod-side-collapse').click()")
    time.sleep(.2)
    check(f"{width} drawer closes", ev("getComputedStyle(document.querySelector('.prod-side')).display==='none'"))
    shot(f"devices-{width}.png")

# Frozen collection rhythm
viewport(1366); nav("/devices")
head = style(".inno-collection-head")
toolbar = style(".inno-collection-toolbar")
check("collection head padding 12x16", head and head["padding"] == "12px 16px", str(head))
check("collection toolbar padding 12x16", toolbar and toolbar["padding"] == "12px 16px", str(toolbar))
check("collection head separator present", head and "1px" in head["borderBottom"], str(head))

# Empty queue should be flat, not a nested card
empty_found = False
for route in ["/helpdesk/assigned", "/helpdesk/team", "/helpdesk/tickets"]:
    nav(route)
    deadline = time.time() + 5
    while time.time() < deadline:
        if ev("document.body.innerText.includes('No tickets in this queue')"):
            empty_found = True
            break
        time.sleep(.2)
    if empty_found:
        state = style(".collection-state .inno-state")
        check("empty queue state is compact", ev("document.querySelector('.collection-state .inno-state')?.classList.contains('compact')") is True)
        check("empty queue has no nested card border", state and state["border"].startswith("0px"), str(state))
        check("empty queue background is transparent", ev("getComputedStyle(document.querySelector('.collection-state .inno-state')).backgroundColor") == "rgba(0, 0, 0, 0)")
        shot("tickets-empty-1366.png")
        break
check("empty queue route found", empty_found)

print("step42_1_detail_polish_checks=" + str(checks))
print("step42_1_detail_polish_failures=" + str(len(fails)))
for item in fails:
    print("FAILED", item)
sys.exit(1 if fails else 0)
