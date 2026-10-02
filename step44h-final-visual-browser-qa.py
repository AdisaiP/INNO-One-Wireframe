from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
PORT = 9241
OUT = ROOT / "qa-step44h-final-visual"
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
STATE_OUT = OUT / "states"
STATE_OUT.mkdir(parents=True)
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
        if any(host in href for host in ("172.10.1.58:8080", "localhost:8080", "127.0.0.1:8080")) and c.eval("!!document.querySelector('#kc-login')"):
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
      const page=document.querySelector('.inno-page');
      const h1=document.querySelector('h1')?.textContent?.trim()||'';
      const visible=e=>{
        const r=e.getBoundingClientRect(), cs=getComputedStyle(e);
        return cs.display!=='none' && cs.visibility!=='hidden' && Number(cs.opacity||1)>0
          && r.width>0 && r.height>0;
      };
      const hasLocalXOwner=e=>{
        let p=e.parentElement;
        while(p && p!==document.body){
          const cs=getComputedStyle(p);
          if(p.scrollWidth>p.clientWidth+2 && ['auto','scroll'].includes(cs.overflowX)) return true;
          p=p.parentElement;
        }
        return false;
      };
      const label=e=>(e.getAttribute('aria-label')||e.getAttribute('title')||(e.textContent||'').trim()||e.tagName).slice(0,80);
      const sideMissing=side.filter(a=>!a.querySelector('.inno-icon[data-icon-token]')).map(a=>a.textContent.trim());
      const railMissing=rail.filter(a=>!a.querySelector('.inno-icon[data-icon-token]')).map(a=>a.getAttribute('aria-label')||'');
      const glyphActions=[...document.querySelectorAll('.device-row-action,.production-app-open,.workspace-app-card')]
        .filter(e=>/[›→]/.test(e.textContent||'')).length;
      const unlabeledIconButtons=[...document.querySelectorAll('button,a')]
        .filter(e=>{
          const icon=e.querySelector('.inno-icon');
          if(!icon)return false;
          const visibleText=(e.textContent||'').trim();
          return !visibleText && !e.getAttribute('aria-label') && !e.getAttribute('title');
        }).length;
      const badStateIcons=[...document.querySelectorAll('.inno-state-icon')]
        .filter(e=>!e.querySelector('.inno-icon[data-icon-token]')).length;
      const clippedSide=side.filter(a=>a.scrollWidth>a.clientWidth+2).map(a=>a.textContent.trim());
      const clippedInteractive=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="tab"]')]
        .filter(visible)
        .filter(e=>{
          const r=e.getBoundingClientRect();
          return (r.left < -2 || r.right > innerWidth+2) && !hasLocalXOwner(e);
        })
        .map(label)
        .slice(0,12);
      return {
        href:location.pathname+location.search,
        title:h1,
        overflow:document.documentElement.scrollWidth>innerWidth+2,
        docWidth:document.documentElement.scrollWidth,
        docHeight:document.documentElement.scrollHeight,
        docClientHeight:document.documentElement.clientHeight,
        width:innerWidth,
        mainRight:main?Math.round(main.getBoundingClientRect().right):0,
        pageRight:page?Math.round(page.getBoundingClientRect().right):0,
        mainScrollHeight:main?.scrollHeight||0,
        mainClientHeight:main?.clientHeight||0,
        railActive:document.querySelectorAll('.prod-rail a.active').length,
        sideActive:document.querySelectorAll('.prod-side a.active').length,
        railLinks:rail.length,
        sideLinks:side.length,
        sideMissing, railMissing, glyphActions, unlabeledIconButtons, badStateIcons, clippedSide, clippedInteractive,
        bodyError:!!document.querySelector('.page-error-wrap,.inno-state[data-state="error"]'),
      };
    })()""")
def scroll_check(cdp, width, route):
    data = cdp.eval("""(()=> {
      const m=document.querySelector('.prod-main');
      const r=document.querySelector('.prod-rail');
      const s=document.querySelector('.prod-side');
      const de=document.documentElement;
      const before={
        windowY:scrollY,
        docH:de.scrollHeight,
        docC:de.clientHeight,
        mainTop:m?.scrollTop||0,
        mainH:m?.scrollHeight||0,
        mainC:m?.clientHeight||0,
        railY:r?.getBoundingClientRect().top||0,
        sideY:s?.getBoundingClientRect().top||0,
        sidePos:s?getComputedStyle(s).position:'',
      };
      if(m) m.scrollTop=m.scrollHeight;
      const after={
        windowY:scrollY,
        mainTop:m?.scrollTop||0,
        railY:r?.getBoundingClientRect().top||0,
        sideY:s?.getBoundingClientRect().top||0,
      };
      return {before,after,scrollable:before.mainH>before.mainC+2};
    })()""")
    before, after = data["before"], data["after"]
    check(f"{width} document does not own scroll {route}",
          before["docH"] <= before["docC"] + 2 and after["windowY"] == 0, str(data))
    check(f"{width} main scroll ownership {route}",
          (data["scrollable"] and after["mainTop"] > 0)
          or ((not data["scrollable"]) and after["mainTop"] == 0), str(data))
    check(f"{width} rail stays chrome {route}",
          abs(after["railY"] - before["railY"]) <= 1, str(data))
    if width == 1366:
        check(f"{width} sidebar stays chrome {route}",
              before["sidePos"] == "relative" and abs(after["sideY"] - before["sideY"]) <= 1, str(data))
    else:
        check(f"{width} sidebar keeps off-canvas ownership {route}",
              before["sidePos"] == "fixed", str(data))
    bottom_shot = ""
    if data["scrollable"]:
        bottom_shot = cdp.shot(f"{width}__{slug(route)}__bottom.png")
    cdp.eval("(()=>{const m=document.querySelector('.prod-main');if(m)m.scrollTop=0;return true})()")
    return {**data, "bottomShot": bottom_shot}

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
    check("interactive controls fit " + route, not m["clippedInteractive"], str(m["clippedInteractive"]))
    check("no visible runtime error " + route, not m["bodyError"], str(m))
    shot = c.shot("1366__" + slug(route) + ".png")
    scroll = scroll_check(c, 1366, route)
    manifest["routes"].setdefault(route, {})["1366"] = {**m, "shot": shot, "scroll": scroll}
    collect_dynamic(c, route)
ALL_ROUTES = STATIC_ROUTES + sorted(dynamic_routes.difference(STATIC_ROUTES))
print("dynamic_routes=" + ",".join(sorted(dynamic_routes)))

for route in sorted(dynamic_routes.difference(STATIC_ROUTES)):
    c.viewport(1366)
    c.navigate("http://localhost:5180" + route)
    ready = route_ready(c)
    check("ready dynamic 1366 " + route, ready)
    if not ready:
        continue
    time.sleep(.15)
    m = metrics(c)
    check("no overflow dynamic 1366 " + route, not m["overflow"], str(m))
    check("main within viewport dynamic 1366 " + route, m["mainRight"] <= 1368, str(m))
    check("rail icons complete dynamic 1366 " + route, not m["railMissing"], str(m["railMissing"]))
    check("side icons complete dynamic 1366 " + route, not m["sideMissing"], str(m["sideMissing"]))
    check("no action glyphs dynamic 1366 " + route, m["glyphActions"] == 0, str(m["glyphActions"]))
    check("icon controls labeled dynamic 1366 " + route, m["unlabeledIconButtons"] == 0, str(m["unlabeledIconButtons"]))
    check("state icons semantic dynamic 1366 " + route, m["badStateIcons"] == 0, str(m["badStateIcons"]))
    check("side labels fit dynamic 1366 " + route, not m["clippedSide"], str(m["clippedSide"]))
    check("interactive controls fit dynamic 1366 " + route, not m["clippedInteractive"], str(m["clippedInteractive"]))
    check("no visible runtime error dynamic 1366 " + route, not m["bodyError"], str(m))
    shot = c.shot("1366__" + slug(route) + ".png")
    scroll = scroll_check(c, 1366, route)
    manifest["routes"].setdefault(route, {})["1366"] = {**m, "shot": shot, "scroll": scroll}

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
        check(f"interactive controls fit {width} {route}", not m["clippedInteractive"], str(m["clippedInteractive"]))
        check(f"no runtime error {width} {route}", not m["bodyError"], str(m))
        shot = c.shot(str(width) + "__" + slug(route) + ".png")
        scroll = scroll_check(c, width, route)
        manifest["routes"].setdefault(route, {})[str(width)] = {**m, "shot": shot, "scroll": scroll}

for width in (1024, 768):
    c.viewport(width)
    c.navigate("http://localhost:5180/")
    ready = route_ready(c)
    check(f"{width} workspace ready for context drawer visual", ready)
    if ready:
        clicked = c.eval("""(()=> {
          const b=document.querySelector('.prod-context-reveal');
          if(!b)return false;
          b.click();
          return true;
        })()""")
        opened = bool(clicked and wait_eval(
            c,
            """document.querySelector('.inno-production-shell')?.classList.contains('side-open')
              && getComputedStyle(document.querySelector('.prod-side')).display!=='none'
              && !!document.querySelector('.prod-side-backdrop')""",
            timeout=3,
        ))
        check(f"{width} context drawer opens for final visual", opened)
        if opened:
            c.shot(f"{width}__workspace-home__context-open.png")
        c.eval("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")

def final_nav(route, width=1366):
    c.viewport(width)
    c.navigate("http://localhost:5180" + route)
    ready = route_ready(c)
    check(f"final architecture ready {width} {route}", ready)
    if ready:
        time.sleep(.15)
    return ready

def close_overlay():
    c.eval("""(()=>{const b=document.querySelector('.inno-overlay-close');if(b)b.click();return true})()""")
    wait_eval(c, "!document.querySelector('.inno-overlay')", timeout=3)

# Step 44H architecture and interaction assertions on the remediated critical surfaces.
if final_nav("/admin/organization"):
    check("organization hierarchy is full-width tree",
          c.eval("!!document.querySelector('.admin-hierarchy-collection .inno-tree') && !document.querySelector('.admin-master-detail,.admin-editor-panel')") is True)
    connector = c.eval("""(()=>{const r=[...document.querySelectorAll('.inno-tree-row[data-level]')].find(x=>Number(x.dataset.level)>1);if(!r)return null;const s=getComputedStyle(r,'::before');return {style:s.borderLeftStyle,width:s.borderLeftWidth}})()""")
    check("organization hierarchy connector is visible",
          bool(connector and connector.get("style") != "none" and connector.get("width") != "0px"), str(connector or ""))
    clicked = c.eval("""(()=>{const b=document.querySelector('.inno-tree-item');if(!b)return false;b.click();return true})()""")
    opened = bool(clicked and wait_eval(c, "!!document.querySelector('.inno-overlay--drawer .inno-drawer')", timeout=4))
    check("organization selection opens drawer", opened)
    if opened:
        c.shot("states/1366__organization__drawer.png")
        close_overlay()

if final_nav("/admin/locations"):
    check("locations hierarchy is full-width tree",
          c.eval("!!document.querySelector('.admin-hierarchy-collection .inno-tree') && !document.querySelector('.admin-master-detail,.admin-editor-panel')") is True)

if final_nav("/admin/audit"):
    check("audit history table owns primary surface",
          c.eval("!!document.querySelector('.admin-audit-collection') && !document.querySelector('.admin-audit-layout,.prod-panel.admin-audit-detail')") is True)
    ready = bool(wait_eval(c, "!!document.querySelector('.admin-audit-collection tbody .inno-row-action')", timeout=5))
    check("audit Open action available", ready)
    if ready:
        c.eval("document.querySelector('.admin-audit-collection tbody .inno-row-action').click();true")
        opened = bool(wait_eval(c, "!!document.querySelector('.inno-overlay--drawer .audit-detail-list')", timeout=5))
        check("audit Open shows immutable drawer", opened)
        if opened:
            c.shot("states/1366__audit__drawer.png")
            close_overlay()

if final_nav("/assets/software-licenses"):
    check("software licenses starts as primary list",
          c.eval("!document.querySelector('.license-detail-grid,.inno-overlay--drawer')") is True)
    ready = bool(wait_eval(c, "!!document.querySelector('.license-table tbody .inno-row-action')", timeout=5))
    check("software license Open action available", ready)
    if ready:
        c.eval("document.querySelector('.license-table tbody .inno-row-action').click();true")
        opened = bool(wait_eval(c, "!!document.querySelector('.inno-overlay--drawer .license-drawer-content')", timeout=5))
        check("software license Open shows drawer", opened)
        if opened:
            c.shot("states/1366__software-licenses__drawer.png")
            close_overlay()

if final_nav("/admin/access-scopes"):
    check("access assignments remains single primary collection",
          c.eval("document.querySelectorAll('.inno-page > .inno-collection').length===1") is True)
    eval_button = c.eval("""[...document.querySelectorAll('button')].some(b=>(b.textContent||'').trim()==='Evaluate Access')""") is True
    check("Evaluate Access is page utility action", eval_button)
    if eval_button:
        c.eval("""[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='Evaluate Access').click();true""")
        opened = bool(wait_eval(c, "!!document.querySelector('.inno-overlay--dialog .admin-evaluate-dialog')", timeout=4))
        check("Evaluate Access opens dialog", opened)
        if opened:
            c.shot("states/1366__access-scopes__evaluate.png")
            close_overlay()

if final_nav("/admin/roles"):
    check("roles exposes immutable platform-role boundary",
          c.eval("document.body.innerText.includes('System roles are read-only')") is True)
    check("roles does not expose fake create action",
          c.eval("![...document.querySelectorAll('button,a')].some(x=>/New Role|Create Role/.test((x.textContent||'').trim()))") is True)

if final_nav("/devices/query"):
    check("inventory query remains builder-centric",
          c.eval("!!document.querySelector('.inventory-query-builder') && !document.querySelector('.inventory-fact-coverage')") is True)
    saved = bool(wait_eval(c, "!!document.querySelector('.inventory-saved-item')", timeout=5))
    if saved:
        c.eval("document.querySelector('.inventory-saved-item').click();true")
        check("saved query uses Save as New semantics",
              bool(wait_eval(c, "[...document.querySelectorAll('.inventory-query-builder button')].some(b=>(b.textContent||'').trim()==='Save as New')", timeout=3)))

if final_nav("/assets/ownership"):
    gap = c.eval("""(()=>{const a=document.querySelector('.asset-ownership-overview-grid');const b=a?.nextElementSibling;if(!a||!b)return -1;return Math.round(b.getBoundingClientRect().top-a.getBoundingClientRect().bottom)})()""")
    check("asset ownership overview/history spacing is preserved", isinstance(gap, (int, float)) and gap >= 14, str(gap))

if final_nav("/assets/qr-labels"):
    qr_padding = c.eval("""(()=>{const e=document.querySelector('.qr-setup-section .editor-form');if(!e)return null;const s=getComputedStyle(e);return {bottom:parseFloat(s.paddingBottom),left:parseFloat(s.paddingLeft),right:parseFloat(s.paddingRight)}})()""")
    check("QR label setup owns full body padding",
          bool(qr_padding and qr_padding.get("bottom",0) >= 12 and qr_padding.get("left",0) >= 12 and qr_padding.get("right",0) >= 12), str(qr_padding or ""))

asset_detail_route = next((r for r in dynamic_routes if r.startswith("/assets/asset_")), "")
if asset_detail_route and final_nav(asset_detail_route):
    owner_padding = c.eval("""(()=>{const h=[...document.querySelectorAll('.prod-panel-head h3')].find(x=>x.textContent.trim()==='Current owner');const p=h?.closest('.prod-panel');const s=p?.querySelector('.settings-stack');if(!s)return null;const cs=getComputedStyle(s);return {left:parseFloat(cs.paddingLeft),right:parseFloat(cs.paddingRight)}})()""")
    check("asset current-owner body padding is preserved",
          bool(owner_padding and owner_padding.get("left",0) >= 12 and owner_padding.get("right",0) >= 12), str(owner_padding or ""))

matrix_complete = all(
    all(str(width) in manifest["routes"].get(route, {}) for width in WIDTHS)
    for route in ALL_ROUTES
)
top_shots = [
    p for p in OUT.glob("*.png")
    if "__bottom" not in p.stem and "__context-open" not in p.stem
]
check("full route screenshot matrix is 56 x 3",
      len(ALL_ROUTES) == 56 and matrix_complete and len(top_shots) == 168,
      f"routes={len(ALL_ROUTES)} top_shots={len(top_shots)}")
manifest["dynamicRoutes"] = sorted(dynamic_routes)
manifest["matrix"] = {
    "routeCount": len(ALL_ROUTES),
    "widths": list(WIDTHS),
    "topScreenshotCount": len(top_shots),
    "complete": matrix_complete,
}
manifest["checks"] = checks
manifest["failures"] = failures
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print("step44h_routes=" + str(len(ALL_ROUTES)))
print("step44h_top_screenshots=" + str(len(top_shots)))
print("step44h_visual_checks=" + str(checks))
print("step44h_visual_failures=" + str(len(failures)))
for item in failures[:80]:
    print("FAILED", item)
sys.exit(1 if failures else 0)
