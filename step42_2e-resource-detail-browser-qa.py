from pathlib import Path
import base64, json, shutil, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step42_2e-resource-detail"
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
        "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False,
    })

def nav(route):
    call("Page.navigate", {"url": "http://localhost:5180" + route})
    deadline = time.time() + 12
    while time.time() < deadline:
        if ev("!!document.querySelector('.inno-production-shell') && !!document.querySelector('.inno-page,.page-loading-wrap,.page-error-wrap')"):
            time.sleep(.15)
            return True
        time.sleep(.1)
    return False

def wait_for(expr, timeout=8):
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = ev(expr)
        if value:
            return value
        time.sleep(.1)
    return None

def click_text(label):
    return ev("""(label=>{
      const el=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===label && !e.hidden);
      if(!el)return false;
      el.click();
      return true;
    })(%s)""" % json.dumps(label))

def click_tab(label):
    return ev("""(label=>{
      const el=[...document.querySelectorAll('.inno-surface-tabs button')].find(e=>e.textContent.trim()===label && !e.hidden);
      if(!el)return false;
      el.click();
      return true;
    })(%s)""" % json.dumps(label))

def shot(name):
    data = call("Page.captureScreenshot", {
        "format":"png","fromSurface":True,"captureBeyondViewport":False,
    })["data"]
    (OUT / name).write_bytes(base64.b64decode(data))
def detail_metrics():
    return ev("""(()=>{
      const head=document.querySelector('.inno-resource-head');
      const summary=document.querySelector('.inno-resource-summary');
      const tabs=document.querySelector('.inno-surface-tabs');
      const main=document.querySelector('.prod-main')?.getBoundingClientRect();
      const sr=summary?.getBoundingClientRect();
      return {
        breadcrumb:!!document.querySelector('.resource-breadcrumb'),
        head:!!head,
        identity:!!head?.querySelector('.inno-resource-identity'),
        actionsInside:!document.querySelector('.inno-resource-actions') || !!head?.querySelector('.inno-resource-actions'),
        summary:!!summary,
        summaryItems:summary?.querySelectorAll('.inno-resource-summary-item').length||0,
        summaryColumns:summary ? getComputedStyle(summary).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        tabs:!!tabs,
        activeTabs:tabs?.querySelectorAll('button.active').length||0,
        overflow:document.documentElement.scrollWidth>innerWidth+2,
        inMain:!!(main&&sr&&sr.left>=main.left-2&&sr.right<=main.right+2),
        title:head?.querySelector('.inno-resource-title')?.textContent?.trim()||''
      };
    })()""")

call("Page.enable")
call("Runtime.enable")
viewport(1366)
call("Page.navigate", {"url": "http://localhost:5180/"})
check("authenticated session", bool(wait_for("!!document.querySelector('.inno-production-shell')")))

sources = {
    "admin-user": ("/admin/users", ".inno-collection tbody a[href^='/admin/users/']"),
    "device": ("/devices", ".inno-collection tbody a[href^='/devices/']:not([href='/devices/discovery']):not([href='/devices/groups']):not([href='/devices/add'])"),
    "device-group": ("/devices/groups", ".inno-collection tbody a[href^='/devices/groups/']"),
    "asset": ("/assets/inventory", ".inno-collection tbody a[href^='/assets/']:not([href='/assets/inventory']):not([href='/assets/ownership']):not([href='/assets/owners'])"),
    "asset-owner": ("/assets/owners", ".inno-collection tbody a[href^='/assets/owners/']"),
    "ticket": ("/helpdesk/tickets", ".inno-collection tbody a[href^='/helpdesk/tickets/']:not([href='/helpdesk/tickets/new'])"),
}
routes = {}
for name,(source,selector) in sources.items():
    check("source ready " + name, nav(source))
    href = wait_for("document.querySelector(" + json.dumps(selector) + ")?.getAttribute('href')||''")
    check("detail discovered " + name, bool(href), str(href))
    if href:
        routes[name] = href

check("all six P03 routes discovered", len(routes) == 6, json.dumps(routes))
for width in (1366,1024,768):
    viewport(width)
    expected_cols = 2 if width == 768 else 4
    for name,route in routes.items():
        check(f"{width} ready {name}", nav(route))
        check(f"{width} resource rendered {name}", bool(wait_for("!!document.querySelector('.inno-resource-head')")))
        m=detail_metrics()
        check(f"{width} breadcrumb {name}", bool(m and m["breadcrumb"]), str(m))
        check(f"{width} identity {name}", bool(m and m["head"] and m["identity"]), str(m))
        check(f"{width} actions owned by header {name}", bool(m and m["actionsInside"]), str(m))
        check(f"{width} summary anatomy {name}", bool(m and m["summary"] and m["summaryItems"]==4), str(m))
        check(f"{width} summary columns {name}", bool(m and m["summaryColumns"]==expected_cols), str(m))
        check(f"{width} tabs {name}", bool(m and m["tabs"] and m["activeTabs"]==1), str(m))
        check(f"{width} summary inside main {name}", bool(m and m["inMain"]), str(m))
        check(f"{width} no page overflow {name}", bool(m and not m["overflow"]), str(m))

        if width in (1366,768):
            shot(f"{width}__{name}.png")

viewport(1366)
tab_cases = [
    ("admin-user","Access","Access Assignments"),
    ("device","Software","Installed software"),
    ("device-group","Members","Group members"),
    ("asset","Custom Fields","Custom fields"),
    ("asset-owner","Assets","Owned Assets"),
    ("ticket","Activity","Activity"),
]
for name,tab_label,content in tab_cases:
    check("tab route ready " + name, nav(routes[name]))
    check("tab click " + name + " " + tab_label, bool(click_tab(tab_label)))
    time.sleep(.15)
    active = ev("document.querySelector('.inno-surface-tabs button.active')?.textContent?.trim()||''")
    body = ev("document.body.innerText")
    check("tab active " + name + " " + tab_label, active == tab_label, str(active))
    check("tab content " + name + " " + tab_label, content in (body or ""), content)
    if name == "ticket":
        visible = ev("""[...document.querySelectorAll('.ticket-detail-tabs .prod-panel')].filter(e=>e.offsetParent!==null).map(e=>e.querySelector('.prod-panel-head h3')?.textContent?.trim()||'')""")
        check("ticket inactive tab panels hidden", visible == ["Activity"], str(visible))
for name,edit_label,save_label in [
    ("admin-user","Edit Profile","Save Profile"),
    ("asset","Edit Asset","Save Asset"),
    ("device-group","Edit Group","Save Changes"),
]:
    check("edit route ready " + name, nav(routes[name]))
    visible_editor = ev("!![...document.querySelectorAll('.editor-form')].find(e=>e.offsetParent!==null)")
    check("default detail not editor " + name, not bool(visible_editor), str(visible_editor))
    check("open edit " + name, bool(click_text(edit_label)))
    check("editor footer appears " + name, bool(wait_for("!!document.querySelector('.inno-editor-footer')")))
    footer = ev("""(()=>{
      const f=document.querySelector('.inno-editor-footer');
      return {
        start:[...f.querySelectorAll('.inno-editor-footer-start button,.inno-editor-footer-start a')].map(e=>e.textContent.trim()),
        end:[...f.querySelectorAll('.inno-editor-footer-end button,.inno-editor-footer-end a')].map(e=>e.textContent.trim()),
        tabs:!!document.querySelector('.inno-surface-tabs'),
        ownership:[...document.querySelectorAll('.inno-surface-tabs button')].some(e=>e.textContent.trim()==='Ownership')
      };
    })()""")
    check("cancel in footer start " + name, "Cancel" in footer["start"], str(footer))
    check("save in footer end " + name, save_label in footer["end"], str(footer))
    if name in ("admin-user","device-group"):
        check("view tabs hidden while editing " + name, not footer["tabs"], str(footer))
    if name == "asset":
        check("asset ownership tab hidden while editing", not footer["ownership"], str(footer))
    check("cancel edit " + name, bool(click_text("Cancel")))
    time.sleep(.15)
    check("detail tabs restored " + name, bool(ev("!!document.querySelector('.inno-surface-tabs')")))

check("ticket operation route ready", nav(routes["ticket"]))
if click_text("Reassign"):
    check("ticket reassign footer appears", bool(wait_for("!!document.querySelector('.ticket-assign-panel .inno-editor-footer')")))
    own = ev("""(()=>{
      const p=document.querySelector('.ticket-assign-panel');
      return {
        inStart:[...p.querySelectorAll('.inno-editor-footer-start button')].some(b=>b.textContent.trim()==='Cancel'),
        inEnd:[...p.querySelectorAll('.inno-editor-footer-end button')].some(b=>b.textContent.trim()==='Reassign')
      };
    })()""")
    check("ticket reassign cancel ownership", bool(own["inStart"]), str(own))
    check("ticket reassign primary ownership", bool(own["inEnd"]), str(own))
    click_text("Cancel")
else:
    check("ticket reassign available for QA user", False)

print("step42_2e_detail_checks=" + str(checks))
print("step42_2e_detail_failures=" + str(len(fails)))
for item in fails:
    print("FAILED", item)
raise SystemExit(1 if fails else 0)
