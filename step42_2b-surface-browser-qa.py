from pathlib import Path
import base64, json, shutil, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step42_2b-surface"
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
    return call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}).get("result", {}).get("value")

def viewport(width):
    call("Emulation.setDeviceMetricsOverride", {"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False})

def nav(route):
    call("Page.navigate", {"url": "http://localhost:5180" + route})
    deadline = time.time() + 12
    while time.time() < deadline:
        if ev("!!document.querySelector('.inno-production-shell') && !!document.querySelector('h1')"):
            time.sleep(.2)
            return True
        time.sleep(.12)
    return False

def shot(name):
    data = call("Page.captureScreenshot", {"format": "png", "fromSurface": True, "captureBeyondViewport": False})["data"]
    (OUT / name).write_bytes(base64.b64decode(data))

def realm_password(username):
    realm = json.loads(REALM.read_text(encoding="utf-8"))
    user = next(x for x in realm["users"] if x["username"] == username)
    return user["credentials"][0]["value"]

def surface_metrics():
    return ev("""(()=>{const visible=e=>getComputedStyle(e).display!=='none';const surfaces=[...document.querySelectorAll('.prod-panel,.collection-card,.inno-collection')].filter(visible);const nested=[...document.querySelectorAll('.prod-panel .prod-panel,.prod-panel .collection-card,.prod-panel .inno-collection,.collection-card .prod-panel,.collection-card .collection-card,.inno-collection .prod-panel,.inno-collection .collection-card')].filter(visible);return{count:surfaces.length,shadowed:surfaces.filter(e=>getComputedStyle(e).boxShadow!=='none').length,nested:nested.length,overflow:document.documentElement.scrollWidth>innerWidth+2};})()""")
call("Page.enable")
call("Runtime.enable")
viewport(1366)
call("Page.navigate", {"url": "http://localhost:5180/"})
password = realm_password("adisai")
deadline = time.time() + 35
logged_in = False
while time.time() < deadline:
    href = ev("location.href") or ""
    if "172.10.1.58:8080" in href and ev("!!document.querySelector('#kc-login')"):
        ev("document.querySelector('#username').value='adisai';document.querySelector('#password').value=" + json.dumps(password) + ";document.querySelector('#kc-login').click();")
        time.sleep(.7)
    if href.startswith("http://localhost:5180") and ev("!!document.querySelector('.inno-production-shell')"):
        logged_in = True
        break
    time.sleep(.2)
check("Keycloak login", logged_in, ev("location.href") or "")

check("devices route ready for detail discovery", nav("/devices"))
device_route = ""
deadline = time.time() + 10
while time.time() < deadline and not device_route:
    device_route = ev("""[...document.querySelectorAll("a[href^='/devices/']")].map(a=>a.getAttribute('href')).find(h=>h&&!['/devices/discovery','/devices/groups','/devices/add'].includes(h))||''""") or ""
    if not device_route:
        time.sleep(.2)
check("device detail route discovered", bool(device_route), str(device_route))

routes = ["/", "/profile", "/notifications", "/admin/access-scopes", "/helpdesk/sla", "/devices"]
for width in (1366, 1024, 768):
    viewport(width)
    for route in routes:
        check(f"{width} ready {route}", nav(route))
        m = surface_metrics()
        check(f"{width} standard surfaces exist {route}", m and m["count"] > 0, str(m))
        check(f"{width} standard surfaces have no shadow {route}", m and m["shadowed"] == 0, str(m))
        check(f"{width} no nested standard surfaces {route}", m and m["nested"] == 0, str(m))
        check(f"{width} no horizontal overflow {route}", m and not m["overflow"], str(m))
    nav("/")
    shot(f"{width}__workspace.png")
    call("Page.navigate", {"url": "http://localhost:5180" + device_route})
    detail_deadline = time.time() + 12
    detail_ready = False
    while time.time() < detail_deadline:
        if ev("document.querySelectorAll('.summary-grid > div').length === 4"):
            detail_ready = True
            time.sleep(.2)
            break
        time.sleep(.12)
    check(f"{width} device detail ready", detail_ready)
    inset = ev("""(()=>{const cells=[...document.querySelectorAll('.summary-grid > div')].filter(e=>getComputedStyle(e).display!=='none');return{count:cells.length,borders:cells.map(e=>getComputedStyle(e).borderTopWidth),backgrounds:cells.map(e=>getComputedStyle(e).backgroundColor),radii:cells.map(e=>getComputedStyle(e).borderRadius),panelShadow:[...document.querySelectorAll('.prod-panel')].filter(e=>getComputedStyle(e).display!=='none').map(e=>getComputedStyle(e).boxShadow)};})()""")
    check(f"{width} device summary has four insets", inset and inset["count"] == 4, str(inset))
    check(f"{width} device summary insets borderless", inset and all(x == "0px" for x in inset["borders"]), str(inset))
    check(f"{width} device summary insets subtle", inset and all(x != "rgb(255, 255, 255)" for x in inset["backgrounds"]), str(inset))
    check(f"{width} device summary inset radius", inset and all(x == "8px" for x in inset["radii"]), str(inset))
    check(f"{width} device panels have no shadow", inset and all(x == "none" for x in inset["panelShadow"]), str(inset))
    shot(f"{width}__device-detail.png")
    check(f"{width} notifications ready", nav("/notifications"))
    custom = ev("""(()=>{const a=['.notification-stat-strip','.notification-feed'].map(s=>document.querySelector(s)).filter(Boolean);return a.map(e=>getComputedStyle(e).boxShadow)})()""")
    check(f"{width} notification surfaces have no shadow", all(x == "none" for x in (custom or [])), str(custom))
    shot(f"{width}__notifications.png")

print("step42_2b_surface_checks=" + str(checks))
print("step42_2b_surface_failures=" + str(len(fails)))
raise SystemExit(1 if fails else 0)
