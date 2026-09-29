from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
PORT = 9241
WIDTHS = (1366, 1024, 768)
OUT = ROOT / "qa-step41-browser-1366-1024-768"
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
                if targets: break
            except Exception:
                time.sleep(.15)
        if not targets:
            raise RuntimeError("Chrome DevTools target unavailable")
        page = next(x for x in targets if x.get("type") == "page")
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=8, origin="http://127.0.0.1")
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
                return message.get("result", {})
    def eval(self, expression):
        result = self.call("Runtime.evaluate", {
            "expression": expression, "returnByValue": True, "awaitPromise": True,
        })
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
        value = cdp.eval(expression)
        if value: return value
        time.sleep(.15)
    return None
def realm_password(username):
    realm = json.loads(REALM.read_text(encoding="utf-8"))
    user = next(x for x in realm["users"] if x["username"] == username)
    return user["credentials"][0]["value"]

c = CDP()
c.viewport(1366)
c.navigate("http://localhost:5180/devices/discovery")
password = realm_password("adisai")
deadline = time.time() + 30
logged_in = False
while time.time() < deadline:
    href = c.eval("location.href") or ""
    if "172.10.1.58:8080" in href and c.eval("!!document.querySelector('#kc-login')"):
        c.eval(
            "document.querySelector('#username').value=" + json.dumps("adisai")
            + ";document.querySelector('#password').value=" + json.dumps(password)
            + ";document.querySelector('#kc-login').click();"
        )
        time.sleep(.5)
    if href.startswith("http://localhost:5180") and wait_eval(
        c, "document.querySelector('h1')?.textContent==='Network Discovery'", timeout=2
    ):
        logged_in = True
        break
    time.sleep(.2)
check("Keycloak login completes", logged_in, c.eval("location.href"))
check("Discovery page ready", bool(wait_eval(
    c, "document.querySelector('h1')?.textContent==='Network Discovery'", timeout=10
)))
check("Run Scan button present", c.eval("!![...document.querySelectorAll('button')].find(x=>x.textContent.includes('Run Scan'))"))
check("Network ranges textarea present", c.eval("!!document.querySelector('textarea')"))

c.eval("""(()=>{
 const el=document.querySelector('textarea');
 const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
 set.call(el,'127.0.0.1/32');
 el.dispatchEvent(new Event('input',{bubbles:true}));
 return true;
})()""")
check("Run Scan enabled", bool(wait_eval(
    c, "![...document.querySelectorAll('button')].find(x=>x.textContent.includes('Run Scan'))?.disabled", timeout=5
)))
c.eval("[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Run Scan')).click()")
check("Operation appears", bool(wait_eval(
    c, "document.body.innerText.includes('Operation op_')", timeout=12
)))
check("Shared operation copy visible", "shared INNO.One operation resource" in c.eval("document.body.innerText"))
check("Scan reaches succeeded", bool(wait_eval(
    c, "(document.body.innerText||'').toLowerCase().includes('succeeded')", timeout=20
)))

manifest = {"viewports": {}, "checks": 0}
for width in WIDTHS:
    c.viewport(width)
    time.sleep(.25)
    metrics = c.eval("""(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      mainRight:(()=>{const e=document.querySelector('.prod-main');return e?Math.round(e.getBoundingClientRect().right):0})(),
      railActive:document.querySelectorAll('.prod-rail a.active').length,
      sideActive:document.querySelectorAll('.prod-side a.active').length,
      operationText:[...document.querySelectorAll('.table-meta')].map(x=>x.textContent).find(x=>x?.includes('Operation op_'))||'',
      width:innerWidth
    }))()""")
    check(f"no overflow {width}", not metrics["overflow"], str(metrics))
    check(f"main within viewport {width}", metrics["mainRight"] <= width + 2, str(metrics))
    check(f"global rail active {width}", metrics["railActive"] == 1, str(metrics))
    check(f"context nav active {width}", metrics["sideActive"] == 1, str(metrics))
    check(f"operation visible {width}", metrics["operationText"].startswith("Operation op_"), str(metrics))
    manifest["viewports"][str(width)] = {**metrics, "shot": c.shot(f"discovery-{width}.png")}
manifest["checks"] = checks
manifest["failures"] = failures
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("step41_browser_checks=" + str(checks))
print("step41_browser_failures=" + str(len(failures)))
for item in failures:
    print("FAILED", item)
sys.exit(1 if failures else 0)
