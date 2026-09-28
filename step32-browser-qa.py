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
PORT = 9232
WIDTHS = tuple(int(value) for value in os.environ.get("STEP32_QA_WIDTHS", "1366").split(",") if value.strip())
OUT = ROOT / ("qa-step32-browser-" + "-".join(str(value) for value in WIDTHS))
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
c.viewport(WIDTHS[0] if WIDTHS else 1366)
c.navigate("http://localhost:5180/admin/integrations")

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
                    "document.querySelector('#username').value="
                    + json.dumps("adisai")
                    + ";document.querySelector('#password').value="
                    + json.dumps(password)
                    + ";document.querySelector('#kc-login').click();"
                )
                time.sleep(0.5)
        if href.startswith("http://localhost:5180"):
            if wait_eval(
                c,
                "document.querySelector('h1')?.textContent==='Integrations'",
                timeout=2,
            ):
                logged_in = True
                break
    except Exception:
        pass
    time.sleep(0.2)

check(
    "Keycloak login completes",
    logged_in,
    c.eval("location.href") if logged_in else "timeout",
)

def metrics(cdp):
    return cdp.eval("""(()=>({
      href:location.href,
      h1:document.querySelector('h1')?.textContent?.trim()||'',
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      railActive:document.querySelectorAll('.prod-rail a.active').length,
      mainRight:(()=>{const e=document.querySelector('.prod-main');return e?Math.round(e.getBoundingClientRect().right):0})(),
      width:innerWidth
    }))()""")

manifest = {"viewports": {}, "checks": []}

for width in WIDTHS:
    c.viewport(width)
    c.navigate("http://localhost:5180/admin/integrations")
    check(
        f"Integrations route ready {width}",
        bool(wait_eval(
            c,
            "document.querySelector('h1')?.textContent==='Integrations'",
            timeout=12,
        )),
    )
    check(
        f"Integrations data ready {width}",
        bool(wait_eval(
            c,
            "document.querySelectorAll('tbody tr').length===3",
            timeout=20,
        )),
    )

    m = metrics(c)
    check(f"Integrations no overflow {width}", not m["overflow"], str(m))
    check(
        f"Integrations main within viewport {width}",
        m["mainRight"] <= width + 2,
        str(m),
    )
    check(f"Integrations admin rail active {width}", m["railActive"] == 1, str(m))

    names = c.eval(
        "[...document.querySelectorAll('tbody tr td:first-child b')].map(x=>x.textContent.trim())"
    )
    check(
        f"Integrations providers {width}",
        set(names) == {"Core Database", "Keycloak", "MeshCentral"},
        str(names),
    )

    statuses = c.eval(
        "[...document.querySelectorAll('tbody .inno-status')].map(x=>x.textContent.trim())"
    )
    check(
        f"Integrations statuses visible {width}",
        len(statuses) == 3 and all(bool(value) for value in statuses),
        str(statuses),
    )

    body_text = c.eval("document.body.textContent")
    check(
        f"Integrations no database secret {width}",
        "inno_dev_only" not in body_text,
    )
    check(
        f"Integrations no mesh secret {width}",
        "inno_mesh_dev_only" not in body_text,
    )
    check(
        f"Integrations no password fields {width}",
        c.eval("document.querySelectorAll('input[type=password]').length") == 0,
    )
    check(
        f"Integrations no fake create {width}",
        not c.eval(
            "[...document.querySelectorAll('button,a')].some(x=>/New Integration|Edit Integration|Save Integration/.test(x.textContent))"
        ),
    )

    shot = c.shot(f"admin-integrations-{width}.png")
    manifest["viewports"][str(width)] = {**m, "names": names, "statuses": statuses, "shot": shot}

if 1366 in WIDTHS:
    c.viewport(1366)
    c.navigate("http://localhost:5180/admin")
    check(
        "Admin overview links Integrations",
        bool(wait_eval(
            c,
            """!!document.querySelector('a[href="/admin/integrations"]')""",
            timeout=8,
        )),
    )

    c.navigate("http://localhost:5180/admin/integrations")
    wait_eval(c, "document.querySelectorAll('tbody tr').length===3", timeout=20)
    check(
        "Refresh Health action visible",
        c.eval(
            "[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Refresh Health')"
        ),
    )
    check(
        "Integration Test actions visible",
        c.eval(
            "[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()==='Test').length"
        ) >= 2,
    )

manifest["checks"] = checks
manifest["failures"] = failures
(OUT / "manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

print(f"step32_browser_checks={checks}")
print(f"step32_browser_failures={len(failures)}")
for item in failures:
    print("FAILED", item)
sys.exit(1 if failures else 0)
