from pathlib import Path
import base64, json, shutil, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step42_2c-list-collection"
PORT = 9241
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
    return call("Runtime.evaluate", {
        "expression": expr,
        "returnByValue": True,
        "awaitPromise": True,
    }).get("result", {}).get("value")
def viewport(width):
    call("Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": 900,
        "deviceScaleFactor": 1,
        "mobile": False,
    })

def nav(route):
    call("Page.navigate", {"url": "http://localhost:5180" + route})
    deadline = time.time() + 12
    while time.time() < deadline:
        ready = ev("!!document.querySelector('.inno-production-shell') && !!document.querySelector('h1')")
        if ready:
            time.sleep(.25)
            return True
        time.sleep(.12)
    return False

def wait_rows():
    deadline = time.time() + 12
    while time.time() < deadline:
        if ev("!!document.querySelector('.inno-collection .inno-table-wrap tbody tr')"):
            time.sleep(.15)
            return True
        time.sleep(.15)
    return False
def shot(name):
    data = call("Page.captureScreenshot", {
        "format": "png",
        "fromSurface": True,
        "captureBeyondViewport": False,
    })["data"]
    (OUT / name).write_bytes(base64.b64decode(data))

def anatomy():
    return ev("""(()=>{
      const collection=document.querySelector('.inno-collection');
      if(!collection)return null;
      const head=collection.querySelector('.inno-collection-head');
      const toolbar=collection.querySelector('.inno-collection-toolbar');
      const search=toolbar?.querySelector('.inno-search');
      const table=collection.querySelector('.inno-table-wrap table');
      const actionHead=collection.querySelector('th.action-column');
      const action=collection.querySelector('td.action-column .inno-row-action');
      const meta=toolbar?.querySelector('.inno-toolbar-meta');
      const hr=head?.getBoundingClientRect(), tr=toolbar?.getBoundingClientRect(), sr=search?.getBoundingClientRect();
      return {
        head:!!head, toolbar:!!toolbar, table:!!table,
        separated:!!(hr&&tr&&tr.top>=hr.bottom-1),
        search:!!search, searchWidth:sr?.width||0, toolbarWidth:tr?.width||0,
        actionHeader:!!actionHead, actionText:action?.textContent.trim()||'',
        actionPosition:actionHead?getComputedStyle(actionHead).position:'',
        meta:!!meta, metaWidth:meta?.getBoundingClientRect().width||0,
        overflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
call("Page.enable")
call("Runtime.enable")
viewport(1366)
check("existing authenticated session", nav("/"))

routes = [
    ("/devices", "Open", False),
    ("/devices/groups", "Open", True),
    ("/assets/inventory", "Open", True),
    ("/assets/owners", "Open", True),
    ("/helpdesk/tickets", "Open", True),
    ("/admin/users", "Open", False),
    ("/admin/access-scopes", "Edit", False),
    ("/admin/positions", "Edit", False),
    ("/admin/audit", "Open", False),
]
for width in (1366, 1024, 768):
    viewport(width)
    for route, action_label, expects_meta in routes:
        check(f"{width} ready {route}", nav(route))
        check(f"{width} rows ready {route}", wait_rows())
        data = anatomy()
        check(f"{width} collection anatomy {route}", bool(data and data["head"] and data["toolbar"] and data["table"] and data["separated"]), str(data))
        check(f"{width} no page overflow {route}", bool(data and not data["overflow"]), str(data))
        check(f"{width} named Action column {route}", bool(data and data["actionHeader"]), str(data))
        check(f"{width} named row action {route}", bool(data and data["actionText"] == action_label), str(data))
        if expects_meta:
            check(f"{width} shared toolbar meta {route}", bool(data and data["meta"]), str(data))
        if width == 768:
            check(f"{width} full-width search {route}", bool(data and data["search"] and data["searchWidth"] >= data["toolbarWidth"] * .88), str(data))
            check(f"{width} sticky action {route}", bool(data and data["actionPosition"] == "sticky"), str(data))
    for route, name in [
        ("/devices", "devices"),
        ("/assets/inventory", "assets"),
        ("/helpdesk/tickets", "tickets"),
        ("/admin/access-scopes", "access-scopes"),
    ]:
        nav(route)
        wait_rows()
        shot(f"{width}__{name}.png")

print("step42_2c_collection_checks=" + str(checks))
print("step42_2c_collection_failures=" + str(len(fails)))
for item in fails:
    print("FAILED", item)
raise SystemExit(1 if fails else 0)
