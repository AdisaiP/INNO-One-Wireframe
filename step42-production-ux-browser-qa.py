from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
PORT = 9241
OUT = ROOT / "qa-step42-production-ux"
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
WIDTHS = (1366, 1024, 768)

STATIC_ROUTES = [
    "/", "/workspace/continue", "/workspace/attention", "/workspace/recent",
    "/profile", "/notifications", "/search", "/apps",
    "/admin", "/admin/organization", "/admin/locations", "/admin/positions",
    "/admin/users", "/admin/users/new", "/admin/roles", "/admin/access-scopes",
    "/admin/integrations", "/admin/security", "/admin/audit",
    "/admin/branding", "/admin/settings", "/admin/apps",
    "/devices", "/devices/discovery", "/devices/groups", "/devices/add",
    "/assets", "/assets/inventory", "/assets/ownership", "/assets/owners",
    "/assets/ownership/submissions", "/assets/custom-fields", "/assets/qr-labels",
    "/assets/software-baselines", "/assets/software-licenses", "/assets/contracts",
    "/helpdesk", "/helpdesk/tickets", "/helpdesk/assigned", "/helpdesk/team",
    "/helpdesk/tickets/new", "/helpdesk/sla", "/helpdesk/calendar",
    "/helpdesk/automation", "/helpdesk/automation/new",
]

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
failures = []
checks = 0
def check(name, condition, detail=""):
    global checks
    checks += 1
    if condition:
        print("PASS " + name)
    else:
        print("FAIL " + name + (" :: " + detail if detail else ""))
        failures.append((name, detail))

class CDP:
    def __init__(self):
        deadline = time.time() + 12
        targets = None
        while time.time() < deadline:
            try:
                targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=1).json()
                if targets:
                    break
            except Exception:
                time.sleep(.15)
        if not targets:
            raise RuntimeError("Chrome DevTools target unavailable")
        page = next(x for x in targets if x.get("type") == "page")
        self.ws = websocket.create_connection(
            page["webSocketDebuggerUrl"], timeout=10, origin="http://127.0.0.1"
        )
        self.n = 0
        self.call("Page.enable")
        self.call("Runtime.enable")

    def call(self, method, params=None):
        self.n += 1
        ident = self.n
        self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == ident:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result", {})
    def eval(self, expression):
        result = self.call("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
        })
        if "exceptionDetails" in result:
            raise RuntimeError(str(result["exceptionDetails"]))
        return result.get("result", {}).get("value")

    def viewport(self, width, height=900):
        self.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 1, "mobile": False,
        })

    def navigate(self, url):
        self.call("Page.navigate", {"url": url})

    def shot(self, name):
        data = self.call("Page.captureScreenshot", {
            "format": "png", "fromSurface": True, "captureBeyondViewport": False,
        })["data"]
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
        time.sleep(.12)
    return None

def realm_password(username):
    realm = json.loads(REALM.read_text(encoding="utf-8"))
    user = next(x for x in realm["users"] if x["username"] == username)
    return user["credentials"][0]["value"]
def slug(route):
    if route == "/":
        return "workspace-home"
    return route.strip("/").replace("/", "__").replace("?", "_").replace("=", "-")

c = CDP()
c.viewport(1366)
c.navigate("http://localhost:5180/")
password = realm_password("adisai")
deadline = time.time() + 35
logged_in = False
while time.time() < deadline:
    try:
        href = c.eval("location.href") or ""
        if "172.10.1.58:8080" in href and c.eval("!!document.querySelector('#kc-login')"):
            c.eval(
                "document.querySelector('#username').value=" + json.dumps("adisai")
                + ";document.querySelector('#password').value=" + json.dumps(password)
                + ";document.querySelector('#kc-login').click();"
            )
            time.sleep(.5)
        if href.startswith("http://localhost:5180") and wait_eval(
            c, "!!document.querySelector('.inno-production-shell')", timeout=2
        ):
            logged_in = True
            break
    except Exception:
        pass
    time.sleep(.2)

check("Keycloak login completes", logged_in, c.eval("location.href") if logged_in else "timeout")
if not logged_in:
    sys.exit(1)
def route_ready(cdp):
    return bool(wait_eval(
        cdp,
        """(()=> {
          const shell=document.querySelector('.inno-production-shell');
          const main=document.querySelector('.prod-main');
          const page=document.querySelector('.inno-page,.workspace-home-page');
          return !!shell && !!main && !!page
            && main.getBoundingClientRect().width > 0
            && !document.querySelector('.boot-screen,.page-loading-wrap');
        })()""",
        timeout=20,
    ))

def metrics(cdp):
    return cdp.eval("""(()=> {
      const side=[...document.querySelectorAll('.prod-side a')];
      const rail=[...document.querySelectorAll('.prod-rail a')];
      const main=document.querySelector('.prod-main');
      const page=document.querySelector('.inno-page,.workspace-home-page');
      const h1=document.querySelector('h1')?.textContent?.trim()||'';
      const sideMissing=side.filter(a=>!a.querySelector('.inno-icon[data-icon-token]')).map(a=>a.textContent.trim());
      const railMissing=rail.filter(a=>!a.querySelector('.inno-icon[data-icon-token]')).map(a=>a.getAttribute('aria-label')||'');
      const glyphActions=[...document.querySelectorAll('.device-row-action,.production-app-open,.workspace-app-card')]
        .filter(e=>/[›→]/.test(e.textContent||'')).length;
      const unlabeledIconButtons=[...document.querySelectorAll('button,a')]
        .filter(e=>{
          const icon=e.querySelector('.inno-icon');
          if(!icon)return false;
          const visible=(e.textContent||'').trim();
          return !visible && !e.getAttribute('aria-label') && !e.getAttribute('title');
        }).length;
      const badStateIcons=[...document.querySelectorAll('.inno-state-icon')]
        .filter(e=>!e.querySelector('.inno-icon[data-icon-token]')).length;
      const clippedSide=side.filter(a=>a.scrollWidth>a.clientWidth+2).map(a=>a.textContent.trim());
      return {
        href:location.pathname+location.search,
        title:h1,
        overflow:document.documentElement.scrollWidth>innerWidth+2,
        docWidth:document.documentElement.scrollWidth,
        width:innerWidth,
        mainRight:main?Math.round(main.getBoundingClientRect().right):0,
        pageRight:page?Math.round(page.getBoundingClientRect().right):0,
        railActive:document.querySelectorAll('.prod-rail a.active').length,
        sideActive:document.querySelectorAll('.prod-side a.active').length,
        railLinks:rail.length,
        sideLinks:side.length,
        sideMissing, railMissing, glyphActions, unlabeledIconButtons, badStateIcons, clippedSide,
        bodyError:!!document.querySelector('.page-error-wrap,.inno-state[data-state="error"]'),
      };
    })()""")
manifest = {"routes": {}, "checks": 0, "failures": []}
dynamic_routes = set()

def collect_dynamic(cdp, route):
    action_routes = {
        "/admin/users",
        "/devices",
        "/devices/groups",
        "/assets/inventory",
        "/assets/owners",
        "/helpdesk/tickets",
        "/helpdesk/automation",
        "/admin/access-scopes",
        "/assets/contracts",
    }
    if route not in action_routes:
        return
    ready = wait_eval(cdp, "!!document.querySelector('.inno-collection tbody .action-column .inno-row-action')", timeout=5)
    check("dynamic route action ready " + route, bool(ready))
    if not ready:
        return
    clicked = cdp.eval("""(()=>{const b=document.querySelector('.inno-collection tbody .action-column .inno-row-action');if(!b)return false;b.click();return true})()""")
    href = wait_eval(
        cdp,
        "location.pathname!=="+json.dumps(route)+" ? location.pathname : ''",
        timeout=5,
    ) if clicked else ""
    check("dynamic route discovered " + route, bool(href), href or "shared row action did not navigate")
    if href and ":" not in href:
        dynamic_routes.add(href)
        if route in ("/admin/users", "/assets/contracts") and not href.endswith("/edit"):
            dynamic_routes.add(href + "/edit")

for route in STATIC_ROUTES:
    c.viewport(1366)
    c.navigate("http://localhost:5180" + route)
    ready = route_ready(c)
    check("ready " + route, ready)
    if not ready:
        continue
    time.sleep(.15)
    m = metrics(c)
    check("no overflow " + route, not m["overflow"], str(m))
    check("main within viewport " + route, m["mainRight"] <= 1368, str(m))
    check("rail icons complete " + route, not m["railMissing"], str(m["railMissing"]))
    check("side icons complete " + route, not m["sideMissing"], str(m["sideMissing"]))
    check("no action glyphs " + route, m["glyphActions"] == 0, str(m["glyphActions"]))
    check("icon controls labeled " + route, m["unlabeledIconButtons"] == 0, str(m["unlabeledIconButtons"]))
    check("state icons semantic " + route, m["badStateIcons"] == 0, str(m["badStateIcons"]))
    check("side labels fit " + route, not m["clippedSide"], str(m["clippedSide"]))
    check("no visible runtime error " + route, not m["bodyError"], str(m))
    shot = c.shot("1366__" + slug(route) + ".png")
    manifest["routes"].setdefault(route, {})["1366"] = {**m, "shot": shot}
    collect_dynamic(c, route)
ALL_ROUTES = STATIC_ROUTES + sorted(dynamic_routes.difference(STATIC_ROUTES))
print("dynamic_routes=" + ",".join(sorted(dynamic_routes)))

for width in (1024, 768):
    c.viewport(width)
    for route in ALL_ROUTES:
        c.navigate("http://localhost:5180" + route)
        ready = route_ready(c)
        check(f"ready {width} {route}", ready)
        if not ready:
            continue
        time.sleep(.12)
        m = metrics(c)
        check(f"no overflow {width} {route}", not m["overflow"], str(m))
        check(f"main within viewport {width} {route}", m["mainRight"] <= width + 2, str(m))
        check(f"rail icons complete {width} {route}", not m["railMissing"], str(m["railMissing"]))
        check(f"side icons complete {width} {route}", not m["sideMissing"], str(m["sideMissing"]))
        check(f"no action glyphs {width} {route}", m["glyphActions"] == 0, str(m["glyphActions"]))
        check(f"icon controls labeled {width} {route}", m["unlabeledIconButtons"] == 0, str(m["unlabeledIconButtons"]))
        check(f"state icons semantic {width} {route}", m["badStateIcons"] == 0, str(m["badStateIcons"]))
        check(f"no runtime error {width} {route}", not m["bodyError"], str(m))
        shot = c.shot(str(width) + "__" + slug(route) + ".png")
        manifest["routes"].setdefault(route, {})[str(width)] = {**m, "shot": shot}

manifest["dynamicRoutes"] = sorted(dynamic_routes)
manifest["checks"] = checks
manifest["failures"] = failures
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print("step42_routes=" + str(len(ALL_ROUTES)))
print("step42_browser_checks=" + str(checks))
print("step42_browser_failures=" + str(len(failures)))
for item in failures[:80]:
    print("FAILED", item)
sys.exit(1 if failures else 0)
