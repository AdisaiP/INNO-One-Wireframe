from pathlib import Path
import base64, json, shutil, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step42_2d-editor-settings"
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
        ready = ev("!!document.querySelector('.inno-production-shell') && !!document.querySelector('h1')")
        if ready:
            time.sleep(.2)
            return True
        time.sleep(.12)
    return False

def wait_footer():
    deadline = time.time() + 12
    while time.time() < deadline:
        if ev("!!document.querySelector('.inno-editor-footer')"):
            time.sleep(.12)
            return True
        time.sleep(.12)
    return False

def click_text(label):
    return ev("""(label=>{
      const nodes=[...document.querySelectorAll('button,a')];
      const el=nodes.find(e=>e.textContent.trim()===label);
      if(!el)return false;
      el.click();
      return true;
    })(%s)""" % json.dumps(label))

def shot(name):
    data = call("Page.captureScreenshot", {
        "format": "png", "fromSurface": True, "captureBeyondViewport": False,
    })["data"]
    (OUT / name).write_bytes(base64.b64decode(data))
def metrics():
    return ev("""(()=>{
      const f=document.querySelector('.inno-editor-footer');
      if(!f)return null;
      const s=f.querySelector('.inno-editor-footer-start');
      const e=f.querySelector('.inno-editor-footer-end');
      const note=f.querySelector('.inno-editor-footer-note');
      const labels=x=>x?[...x.querySelectorAll('button,a')].map(n=>n.textContent.trim()).filter(Boolean):[];
      const fr=f.getBoundingClientRect();
      const main=document.querySelector('.prod-main')?.getBoundingClientRect();
      return {
        start:!!s,end:!!e,note:!!note,
        startLabels:labels(s),endLabels:labels(e),
        footerWidth:fr.width, footerLeft:fr.left, footerRight:fr.right,
        mainLeft:main?.left||0, mainRight:main?.right||0,
        flex:getComputedStyle(f).flexDirection,
        overflow:document.documentElement.scrollWidth>innerWidth+2,
        danger:!!f.querySelector('.inno-btn--danger,[data-variant="danger"]')
      };
    })()""")

call("Page.enable")
call("Runtime.enable")
check("authenticated session", nav("/"))

routes = [
    ("/profile", "Save profile", False),
    ("/helpdesk/tickets/new", "Create Ticket", False),
    ("/helpdesk/automation/new", "Save Rule", False),
    ("/helpdesk/sla", "Save Policy", True),
    ("/helpdesk/calendar", "Save Calendar", True),
    ("/admin/users/new", "Create User", False),
]
for width in (1366, 1024, 768):
    viewport(width)
    for route, primary, expects_note in routes:
        check(f"{width} ready {route}", nav(route))
        check(f"{width} footer ready {route}", wait_footer())
        m = metrics()
        check(f"{width} structured footer {route}", bool(m and m["start"] and m["end"]), str(m))
        check(f"{width} primary in footer end {route}", bool(m and primary in m["endLabels"]), str(m))
        check(f"{width} no destructive footer action {route}", bool(m and not m["danger"]), str(m))
        check(f"{width} no page overflow {route}", bool(m and not m["overflow"]), str(m))
        check(f"{width} footer stays in main {route}", bool(m and m["footerLeft"] >= m["mainLeft"]-2 and m["footerRight"] <= m["mainRight"]+2), str(m))
        if expects_note:
            check(f"{width} shared footer note {route}", bool(m and m["note"]), str(m))

    for route, trigger, cancel, primary in [
        ("/devices/groups", "New Device Group", "Cancel", "Create Group"),
    ]:
        check(f"{width} ready {route}", nav(route))
        check(f"{width} open editor {route}", bool(click_text(trigger)))
        check(f"{width} inline footer ready {route}", wait_footer())
        m = metrics()
        head_labels = ev("[...document.querySelectorAll('.inno-page-actions button,.inno-page-actions a')].map(e=>e.textContent.trim())")
        check(f"{width} cancel not in page header {route}", cancel not in (head_labels or []), str(head_labels))
        check(f"{width} cancel in footer start {route}", bool(m and cancel in m["startLabels"]), str(m))
        check(f"{width} create in footer end {route}", bool(m and primary in m["endLabels"]), str(m))
        check(f"{width} inline no overflow {route}", bool(m and not m["overflow"]), str(m))
    for route, name, trigger in [
        ("/profile", "profile", None),
        ("/helpdesk/tickets/new", "ticket-create", None),
        ("/helpdesk/sla", "sla", None),
        ("/devices/groups", "device-groups-create", "New Device Group"),
        ("/admin/users/new", "admin-user-create", None),
    ]:
        nav(route)
        if trigger:
            click_text(trigger)
        wait_footer()
        shot(f"{width}__{name}.png")

viewport(1366)
check("profile interaction ready", nav("/profile"))
original = ev("document.querySelector('input[autocomplete=tel]')?.value || ''")
changed = ev("""(()=>{const i=document.querySelector('input[autocomplete=tel]');if(!i)return false;const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,(i.value||'')+' 9');i.dispatchEvent(new Event('input',{bubbles:true}));return true;})()""")
check("profile field changed", bool(changed))
deadline=time.time()+4
discard=False
while time.time()<deadline:
    discard=bool(ev("[...document.querySelectorAll('.inno-editor-footer button')].some(b=>b.textContent.trim()==='Discard changes')"))
    if discard: break
    time.sleep(.1)
check("profile discard appears when dirty", discard)
check("profile discard click", bool(click_text("Discard changes")))
time.sleep(.2)
restored = ev("document.querySelector('input[autocomplete=tel]')?.value || ''")
check("profile discard restores value", restored == original, f"{original!r} -> {restored!r}")

print("step42_2d_editor_checks=" + str(checks))
print("step42_2d_editor_failures=" + str(len(fails)))
for item in fails:
    print("FAILED", item)
raise SystemExit(1 if fails else 0)
