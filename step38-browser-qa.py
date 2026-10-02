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
PORT = int(os.environ.get("STEP38_CDP_PORT", "9238"))
WIDTHS = tuple(int(value) for value in os.environ.get("STEP38_QA_WIDTHS", "1366,1024,768").split(",") if value.strip())
OUT = ROOT / ("qa-step38-browser-" + "-".join(str(value) for value in WIDTHS))
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
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def eval(self, expression):
        result = self.call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
        if "exceptionDetails" in result:
            raise RuntimeError(str(result["exceptionDetails"]))
        return result.get("result", {}).get("value")

    def viewport(self, width, height=900):
        self.call("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False})

    def navigate(self, url):
        self.call("Page.navigate", {"url": url})

    def shot(self, name):
        data = self.call("Page.captureScreenshot", {"format": "png", "fromSurface": True, "captureBeyondViewport": False})["data"]
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
c.viewport(WIDTHS[0] if WIDTHS else 1366)
c.navigate("http://localhost:5180/search?q=DESKTOP-HR-014")

deadline = time.time() + 30
logged_in = False
password = realm_password("adisai")
while time.time() < deadline:
    try:
        href = c.eval("location.href") or ""
        if "172.10.1.58:8080" in href:
            form_ready = c.eval("!!document.querySelector('#kc-login')")
            if form_ready:
                c.eval(
                    "document.querySelector('#username').value=" + json.dumps("adisai")
                    + ";document.querySelector('#password').value=" + json.dumps(password)
                    + ";document.querySelector('#kc-login').click();"
                )
                time.sleep(0.5)
        if href.startswith("http://localhost:5180"):
            if wait_eval(c, "document.querySelector('h1')?.textContent==='Search'", timeout=2):
                logged_in = True
                break
    except Exception:
        pass
    time.sleep(0.2)

check("Keycloak login completes", logged_in, c.eval("location.href") if logged_in else "timeout")

def metrics(cdp):
    return cdp.eval("""(()=>({
      href:location.href,
      title:document.title,
      h1:document.querySelector('h1')?.textContent?.trim()||'',
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      railActive:document.querySelectorAll('.prod-rail a.active').length,
      sideActive:document.querySelectorAll('.prod-side a.active').length,
      results:document.querySelectorAll('.global-search-result').length,
      globalSearch:!!document.querySelector('.prod-global-search input[aria-label="Search INNO.One resources"]'),
      mainRight:(()=>{const e=document.querySelector('.prod-main');return e?Math.round(e.getBoundingClientRect().right):0})(),
      width:innerWidth
    }))()""")

manifest = {"viewports": {}, "checks": []}

for width in WIDTHS:
    c.viewport(width)
    c.navigate("http://localhost:5180/search?q=DESKTOP-HR-014")
    check("Search route ready " + str(width), bool(wait_eval(c, "document.querySelector('h1')?.textContent==='Search'", timeout=12)))
    check("Search device result ready " + str(width), bool(wait_eval(c, "document.querySelectorAll('.global-search-result').length===1", timeout=12)))

    m = metrics(c)
    check("Search no overflow " + str(width), not m["overflow"], str(m))
    check("Search main within viewport " + str(width), m["mainRight"] <= width + 2, str(m))
    check("Search no global rail active " + str(width), m["railActive"] == 0, str(m))
    check("Search contextual active " + str(width), m["sideActive"] == 1, str(m))
    check("Search global input visible " + str(width), m["globalSearch"], str(m))
    check("Search document title " + str(width), m["title"] == "INNO.One", str(m))

    body = c.eval("document.body.innerText")
    for text_value in (
        "Search authorized resources across enabled INNO.One modules.",
        "Global Search",
        "DESKTOP-HR-014",
        "Device",
    ):
        check("Search content " + text_value + " " + str(width), text_value in body)

    check(
        "Search redundant authorization callout removed " + str(width),
        "Authorization stays authoritative" not in body
        and "Global Search only orchestrates module-owned providers." not in body,
    )

    check(
        "Search device route " + str(width),
        bool(c.eval("""!!document.querySelector('.global-search-result[href^="/devices/dev_"]')""")),
    )
    check(
        "Search no unsupported fake result " + str(width),
        "Actions" not in body and "Fake result" not in body,
    )

    shot = c.shot("search-device-" + str(width) + ".png")
    manifest["viewports"][str(width)] = {**m, "shot": shot}

if 1366 in WIDTHS:
    c.viewport(1366)
    c.navigate("http://localhost:5180/search")
    check("Search initial state", bool(wait_eval(c, "document.body.innerText.includes('Search across your workspace')", timeout=10)))

    c.navigate("http://localhost:5180/search?q=HD-2026-001048")
    check("Ticket result ready", bool(wait_eval(c, "document.body.innerText.includes('HD-2026-001048')", timeout=12)))
    check(
        "Ticket route is authorized destination",
        bool(c.eval("""!!document.querySelector('.global-search-result[href^="/helpdesk/tickets/ticket_"]')""")),
    )

    c.navigate("http://localhost:5180/search?q=AST-PC-000142")
    check("Asset result ready", bool(wait_eval(c, "document.body.innerText.includes('AST-PC-000142')", timeout=12)))
    check(
        "Asset route is authorized destination",
        bool(c.eval("""!!document.querySelector('.global-search-result[href^="/assets/asset_"]')""")),
    )

    c.navigate("http://localhost:5180/search?q=definitely-no-such-resource-38")
    check("No results state", bool(wait_eval(c, "document.body.innerText.includes('No results')", timeout=12)))

manifest["checks"] = checks
manifest["failures"] = failures
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print("step38_browser_checks=" + str(checks))
print("step38_browser_failures=" + str(len(failures)))
for item in failures:
    print("FAILED", item)
sys.exit(1 if failures else 0)
