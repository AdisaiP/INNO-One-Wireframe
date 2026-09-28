from pathlib import Path
import base64
import json
import shutil
import sys
import time

import requests
import websocket

ROOT = Path(__file__).resolve().parent
PORT = 9230
OUT = ROOT / "qa-step30-browser"
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
c.navigate("http://localhost:5180/apps")

deadline = time.time() + 25
logged_in = False
password = realm_password("adisai")
while time.time() < deadline:
    try:
        href = c.eval("location.href") or ""
        if "127.0.0.1:18080" in href:
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
            if wait_eval(c, "document.querySelector('h1')?.textContent==='Apps'", timeout=2):
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
      sideVisible:(()=>{const e=document.querySelector('.prod-side');if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0})(),
      mainRight:(()=>{const e=document.querySelector('.prod-main');return e?Math.round(e.getBoundingClientRect().right):0})(),
      width:innerWidth
    }))()""")

manifest = {"viewports": {}, "checks": []}
for width in (1366, 1024, 768):
    c.viewport(width)
    c.navigate("http://localhost:5180/apps")
    check(f"Apps route ready {width}", bool(wait_eval(c, "document.querySelector('h1')?.textContent==='Apps'")))
    check(
        f"Apps data ready {width}",
        bool(wait_eval(c, "document.querySelectorAll('.production-app-card').length===3", timeout=10)),
    )
    m = metrics(c)
    cards = c.eval("[...document.querySelectorAll('.production-app-card')].map(x=>x.textContent.trim())")
    check(f"Apps no overflow {width}", not m["overflow"], str(m))
    check(f"Apps main within viewport {width}", m["mainRight"] <= width + 2, str(m))
    check(f"Apps rail active {width}", m["railActive"] == 1, str(m))
    check(f"Apps three available cards {width}", len(cards) == 3, str(cards))
    check(
        f"Apps cards correct {width}",
        all(any(name in card for card in cards) for name in ("Devices", "Assets", "Helpdesk"))
        and all(all(name not in card for card in cards) for name in ("Meeting", "Reports")),
        str(cards),
    )
    shot = c.shot(f"apps-{width}.png")
    manifest["viewports"][f"apps-{width}"] = {**m, "cards": cards, "shot": shot}

c.viewport(1366)
search_ok = c.eval("""(()=>{
 const label=[...document.querySelectorAll('label.inno-search')]
   .find(x=>x.querySelector('.inno-sr-only')?.textContent==='Search apps');
 const i=label?.querySelector('input');
 if(!i)return false;
 const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
 s.call(i,'asset'); i.dispatchEvent(new Event('input',{bubbles:true})); return true;
})()""")
time.sleep(0.2)
filtered = c.eval("[...document.querySelectorAll('.production-app-card')].map(x=>x.textContent.trim())")
check("Apps search input wired", search_ok and len(filtered) == 1 and "Assets" in filtered[0], str(filtered))
for width in (1366, 1024, 768):
    c.viewport(width)
    c.navigate("http://localhost:5180/admin/apps")
    check(
        f"Admin Apps route ready {width}",
        bool(wait_eval(c, "document.querySelector('h1')?.textContent==='Apps & Modules'")),
    )
    check(
        f"Admin Apps data ready {width}",
        bool(wait_eval(c, "document.querySelectorAll('.production-module-row').length===5", timeout=10)),
    )
    m = metrics(c)
    rows = c.eval("document.querySelectorAll('.production-module-row').length")
    switches = c.eval("document.querySelectorAll('.production-switch[role=switch]').length")
    fake_install = c.eval(
        "[...document.querySelectorAll('button,a')].some(x=>x.textContent.trim()==='Install')"
    )
    check(f"Admin Apps no overflow {width}", not m["overflow"], str(m))
    check(f"Admin Apps main within viewport {width}", m["mainRight"] <= width + 2, str(m))
    check(f"Admin Apps rail active {width}", m["railActive"] == 1, str(m))
    check(f"Admin Apps five rows {width}", rows == 5, str(rows))
    check(f"Admin Apps three switches {width}", switches == 3, str(switches))
    check(f"Admin Apps no fake Install {width}", not fake_install)
    shot = c.shot(f"admin-apps-{width}.png")
    manifest["viewports"][f"admin-apps-{width}"] = {
        **m,
        "rows": rows,
        "switches": switches,
        "shot": shot,
    }
c.viewport(1366)
c.navigate("http://localhost:5180/admin/apps")
wait_eval(c, "document.querySelector('.production-module-inspect > summary')")
c.eval("document.querySelector('.production-module-inspect > summary').click()")
time.sleep(0.15)
inspect_open = c.eval(
    "document.querySelector('.production-module-inspect')?.hasAttribute('open')"
    " && !!document.querySelector('.production-module-detail')"
)
check("Admin Inspect opens details", inspect_open)
manifest["inspectShot"] = c.shot("admin-apps-inspect-1366.png")

manifest["checks"] = checks
manifest["failures"] = failures
(OUT / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

print(f"step30_browser_checks={checks}")
print(f"step30_browser_failures={len(failures)}")
for item in failures:
    print("FAILED", item)
sys.exit(1 if failures else 0)
