from pathlib import Path
import base64
import json
import shutil
import sys
import time
import requests
import websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step43-inventory-query"
PORT = 9241
WIDTHS = (1366, 1024, 768)

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

checks = 0
failures = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

class CDP:
    def __init__(self):
        targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=3).json()
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

    def ev(self, expr):
        result = self.call("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True,
        })
        return result.get("result", {}).get("value")

    def viewport(self, width, height=900):
        self.call("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": False,
        })

    def navigate(self, route):
        self.call("Page.navigate", {"url": "http://localhost:5180" + route})

    def shot(self, name):
        data = self.call("Page.captureScreenshot", {
            "format": "png",
            "fromSurface": True,
            "captureBeyondViewport": False,
        })["data"]
        (OUT / name).write_bytes(base64.b64decode(data))

def wait(c, expr, timeout=12):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            value = c.ev(expr)
            if value:
                return value
        except Exception:
            pass
        time.sleep(.12)
    return None

def click_route(c, route):
    return bool(c.ev("""(route => {
      const link = [...document.querySelectorAll('a')]
        .find(a => new URL(a.href).pathname === route);
      if (!link) return false;
      link.click();
      return true;
    })(%s)""" % json.dumps(route)))

def nav(c, route):
    if not click_route(c, route):
        if not click_route(c, "/devices"):
            return False
        if not wait(c, "location.pathname === '/devices' && !!document.querySelector('.prod-side')", 8):
            return False
        if not click_route(c, route):
            return False
    return bool(wait(
        c,
        "location.pathname === " + json.dumps(route)
        + " && !!document.querySelector('.inno-production-shell')"
        + " && !!document.querySelector('.inventory-query-builder')",
        15,
    ))

c = CDP()
c.viewport(1366)
authenticated = bool(wait(
    c,
    "location.href.startsWith('http://localhost:5180')"
    " && !!document.querySelector('.inno-production-shell')",
    3,
))
check("authenticated production session already available", authenticated, c.ev("location.href"))
if not authenticated:
    print("Run an existing authenticated browser QA harness first.")
    sys.exit(1)

c.ev("localStorage.setItem('inno.ui.sidebar.collapsed','0')")

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} inventory query ready", nav(c, "/devices/query"))
    wait(c, "!document.body.innerText.includes('Loading saved queries…')", 8)
    c.ev("""(()=> {
      const button=[...document.querySelectorAll('button')]
        .find(b=>b.textContent.trim()==='New Query');
      if(button) button.click();
      return !!button;
    })()""")
    wait(c, """[...document.querySelectorAll('button')]
      .some(b=>b.textContent.trim()==='Save Query')""", 3)
    metrics = c.ev("""(()=> {
      const builder=document.querySelector('.inventory-query-builder')?.getBoundingClientRect();
      const support=document.querySelector('.inventory-query-support')?.getBoundingClientRect();
      const nav=[...document.querySelectorAll('.prod-side a')]
        .find(a=>(a.textContent||'').trim()==='Inventory Query');
      return {
        builder: builder ? {x:builder.x,y:builder.y,w:builder.width} : null,
        support: support ? {x:support.x,y:support.y,w:support.width} : null,
        active: !!nav?.classList.contains('active'),
        overflow: document.documentElement.scrollWidth > innerWidth + 2,
        condition: !!document.querySelector('.inventory-condition-row'),
        results: !!document.querySelector('.inventory-query-results'),
        save: [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Save Query'),
        run: [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Run Query'),
      };
    })()""")
    check(f"{width} no document overflow", not metrics["overflow"], metrics)
    check(f"{width} builder mounted", metrics["builder"] is not None and metrics["condition"], metrics)
    check(f"{width} results collection mounted", metrics["results"], metrics)
    check(f"{width} inventory query nav active", metrics["active"], metrics)
    check(f"{width} canonical actions visible", metrics["save"] and metrics["run"], metrics)
    if width >= 1024:
        check(
            f"{width} support stays left of builder",
            metrics["support"]["x"] < metrics["builder"]["x"],
            metrics,
        )
    else:
        check(
            "768 builder precedes support",
            metrics["builder"]["y"] < metrics["support"]["y"],
            metrics,
        )
    c.shot(f"{width}__inventory-query.png")

c.viewport(1366)
check("interaction route ready", nav(c, "/devices/query"))
check(
    "saved query available for interaction",
    bool(wait(c, "document.querySelectorAll('.inventory-saved-item').length > 0", 8)),
)
clicked_saved = c.ev("""(()=> {
  const b=document.querySelector('.inventory-saved-item');
  if(!b)return false;
  b.click();
  return true;
})()""")
check("saved query selection works", bool(clicked_saved))
check(
    "saved definition loaded",
    bool(wait(c, """(()=> {
      const v=document.querySelector('.inventory-value-field input')?.value||'';
      return v.length>0 && !!document.querySelector('.inventory-saved-item.active');
    })()""", 3)),
)
saved_save_visible = c.ev("""[...document.querySelectorAll('button')]
  .some(b=>b.textContent.trim()==='Save Query')""")
check("saved query hides duplicate save action", not saved_save_visible)
clicked_run = c.ev("""(()=> {
  const b=[...document.querySelectorAll('button')]
    .find(x=>x.textContent.trim()==='Run Query');
  if(!b || b.disabled)return false;
  b.click();
  return true;
})()""")
check("run query action starts", bool(clicked_run))

terminal = wait(c, """(()=> {
  const status=document.querySelector('.inventory-operation b')?.textContent||'';
  return status.startsWith('succeeded') || status.startsWith('failed') ? status : '';
})()""", 20)
check("shared operation reaches succeeded", bool(terminal and terminal.startswith("succeeded")), terminal)
check(
    "results render from completed run",
    bool(wait(c, "document.querySelectorAll('.inventory-query-results tbody tr').length > 0", 8)),
)
result_count = c.ev("document.querySelectorAll('.inventory-query-results tbody tr').length") or 0
check("browser results include devices", result_count >= 1, result_count)
runtime_error = c.ev("""document.body.innerText.includes('Something went wrong')
  || document.body.innerText.includes('Failed to fetch')""")
check("no visible runtime error", not runtime_error)
c.shot("1366__inventory-query__results.png")

print("step43_browser_checks=" + str(checks))
print("step43_browser_failures=" + str(len(failures)))
for name, detail in failures:
    print("FAILURE: " + name + " :: " + str(detail))
raise SystemExit(1 if failures else 0)
