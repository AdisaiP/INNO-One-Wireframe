from pathlib import Path
import os
import base64
import json
import shutil
import sys
import time

import requests
import websocket

ROOT = Path(__file__).resolve().parent
PORT = 9231
WIDTHS = tuple(int(value) for value in os.environ.get("STEP31_QA_WIDTHS", "1366").split(",") if value.strip())
OUT = ROOT / ("qa-step31-browser-" + "-".join(str(value) for value in WIDTHS))
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

failures = []
checks = 0

def check(name, condition, detail=""):
    global checks
    checks += 1
    print(("PASS " if condition else "FAIL ") + name + (f" :: {detail}" if detail else ""))
    if not condition:
        failures.append((name, detail))
class CDP:
    def __init__(self):
        deadline = time.time() + 10
        targets = None
        while time.time() < deadline:
            try:
                targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=1).json()
                if targets:
                    break
            except Exception:
                time.sleep(0.15)
        if not targets:
            raise RuntimeError("Chrome DevTools target unavailable")
        page = next(item for item in targets if item.get("type") == "page")
        self.ws = websocket.create_connection(
            page["webSocketDebuggerUrl"],
            timeout=8,
            origin="http://127.0.0.1",
        )
        self.n = 0
        self.call("Page.enable")
        self.call("Runtime.enable")

    def call(self, method, params=None):
        self.n += 1
        ident = self.n
        self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") == ident:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def eval(self, expression):
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if "exceptionDetails" in result:
            raise RuntimeError(str(result["exceptionDetails"]))
        return result.get("result", {}).get("value")

    def viewport(self, width, height=900):
        self.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
        )

    def navigate(self, url):
        self.call("Page.navigate", {"url": url})

    def shot(self, name):
        data = self.call(
            "Page.captureScreenshot",
            {"format": "png", "fromSurface": True, "captureBeyondViewport": False},
        )["data"]
        path = OUT / name
        path.write_bytes(base64.b64decode(data))
        return str(path.relative_to(ROOT))
def wait_eval(cdp, expression, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            value = cdp.eval(expression)
            if value:
                return value
        except Exception:
            pass
        time.sleep(0.15)
    return None

def realm_password(username):
    realm = json.loads(REALM.read_text(encoding="utf-8"))
    user = next(item for item in realm["users"] if item["username"] == username)
    return user["credentials"][0]["value"]



c = CDP()
c.viewport(1366)
c.navigate("http://localhost:5180/admin")

deadline = time.time() + 25
logged_in = False
password = realm_password("adisai")
while time.time() < deadline:
    try:
        href = c.eval("location.href") or ""
        if "172.10.1.58:8080" in href:
            form_ready = c.eval("!!document.querySelector('#kc-login')")
            if form_ready:
                c.eval(
                    "document.querySelector('#username').value="
                    + json.dumps("adisai")
                    + ";document.querySelector('#password').value="
                    + json.dumps(password)
                    + ";document.querySelector('#kc-login').click();"
                )
                time.sleep(0.5)
        if href.startswith("http://localhost:5180"):
            if wait_eval(c, "document.querySelector('h1')?.textContent==='Overview'", timeout=2):
                logged_in = True
                break
    except Exception:
        pass
    time.sleep(0.2)

check("Keycloak login completes", logged_in, c.eval("location.href") if logged_in else "timeout")

def metrics(cdp):
    return cdp.eval("""(()=>({
      href:location.href,
      h1:document.querySelector('h1')?.textContent?.trim()||'',
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      railActive:document.querySelectorAll('.prod-rail a.active').length,
      mainRight:(()=>{const e=document.querySelector('.prod-main');return e?Math.round(e.getBoundingClientRect().right):0})(),
      width:innerWidth
    }))()""")

def api(method, path, body=None, etag=None):
    return c.eval("""(async()=>{
      const token = window.__innoTokenForQa || null;
      const headers={Accept:'application/json'};
      if(token) headers.Authorization='Bearer '+token;
      if(%s!==null) headers['Content-Type']='application/json';
      if(%s) headers['If-Match']=%s;
      const r=await fetch(%s,{method:%s,headers,body:%s});
      let data=null; try{data=await r.json()}catch{}
      return {status:r.status,headers:Object.fromEntries(r.headers.entries()),data};
    })()""" % (
        json.dumps(body),
        json.dumps(bool(etag)),
        json.dumps(etag or ""),
        json.dumps("/api/v1" + path),
        json.dumps(method),
        "null" if body is None else json.dumps(json.dumps(body)),
    ))

# Capture the app's current access token through Keycloak JS instance storage is not exposed,
# so use same-origin authenticated app requests below for data/render verification.
routes = [
    ("/admin", "Overview", ".admin-overview-card", 7),
    ("/admin/organization", "Organization Structure", ".admin-master-detail tbody tr", 1),
    ("/admin/locations", "Locations", ".admin-master-detail tbody tr", 1),
    ("/admin/positions", "Positions", ".admin-master-detail tbody tr", 1),
    ("/admin/users", "Users", "tbody tr", 1),
    ("/admin/roles", "Roles & Permissions", ".admin-role-card", 1),
    ("/admin/access-scopes", "Access Scopes", "tbody tr", 1),
    ("/admin/apps", "Apps & Modules", ".production-module-row", 5),
]
manifest = {"viewports": {}, "checks": []}
responsive_paths = {"/admin", "/admin/organization", "/admin/users", "/admin/access-scopes", "/admin/apps"}

for width in WIDTHS:
    c.viewport(width)
    active_routes = routes if width == 1366 else [item for item in routes if item[0] in responsive_paths]
    for path, title, selector, minimum in active_routes:
        c.navigate("http://localhost:5180" + path)
        check(f"{title} route ready {width}", bool(wait_eval(c, "document.querySelector('h1')?.textContent===" + json.dumps(title), timeout=12)))
        check(f"{title} data ready {width}", bool(wait_eval(c, "document.querySelectorAll(" + json.dumps(selector) + ").length>=" + str(minimum), timeout=12)))
        m = metrics(c)
        check(f"{title} no overflow {width}", not m["overflow"], str(m))
        check(f"{title} main within viewport {width}", m["mainRight"] <= width + 2, str(m))
        check(f"{title} admin rail active {width}", m["railActive"] == 1, str(m))
        if width == 1366 or (width == 768 and path in responsive_paths):
            manifest["viewports"][f"{path.strip('/').replace('/','-') or 'admin'}-{width}"] = {
                **m,
                "shot": c.shot(f"{path.strip('/').replace('/','-') or 'admin'}-{width}.png"),
            }

# Interaction checks run once in the canonical desktop pass.
if 1366 in WIDTHS:
    c.viewport(1366)
    c.navigate("http://localhost:5180/admin/organization")
    wait_eval(c, "document.querySelector('.admin-master-detail tbody tr')")
    c.eval("document.querySelector('.admin-master-detail tbody tr .device-row-action')?.click()")
    check("Organization editor opens", bool(wait_eval(c, "document.querySelector('.admin-editor-panel input')?.value", timeout=5)))

    c.navigate("http://localhost:5180/admin/positions")
    wait_eval(c, "document.querySelector('.admin-master-detail tbody tr')")
    c.eval("document.querySelector('.admin-master-detail tbody tr .device-row-action')?.click()")
    check("Position editor opens", bool(wait_eval(c, "document.querySelector('.admin-editor-panel input')?.value", timeout=5)))

    c.navigate("http://localhost:5180/admin/users")
    check("Users create action visible", bool(wait_eval(c, "[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='New User')", timeout=5)))

    c.navigate("http://localhost:5180/admin/roles")
    check("Roles has no fake edit", not c.eval("[...document.querySelectorAll('button,a')].some(x=>/New Role|Edit Role/.test(x.textContent))"))

    c.navigate("http://localhost:5180/admin/access-scopes")
    wait_eval(c, "document.querySelector('tbody tr')")
    check("Access scopes has no fake create", not c.eval("[...document.querySelectorAll('button,a')].some(x=>x.textContent.trim()==='New Assignment')"))
    check("Evaluate panel present", bool(c.eval("[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Evaluate')")))

# API permission/concurrency behavior is covered by step31-runtime-qa.py.
manifest["checks"] = checks
manifest["failures"] = failures
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"step31_browser_checks={checks}")
print(f"step31_browser_failures={len(failures)}")
for item in failures:
    print("FAILED", item)
sys.exit(1 if failures else 0)
