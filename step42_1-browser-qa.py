import json, sys, time
import requests, websocket

PORT = 9241
BASE = "http://localhost:5180"
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

def ev(expression):
    result = call("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    })
    return result.get("result", {}).get("value")

def viewport(width, height=900):
    call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": height, "deviceScaleFactor": 1, "mobile": False,
    })

def nav(route, ready_selector=".inno-production-shell"):
    call("Page.navigate", {"url": BASE + route})
    deadline = time.time() + 12
    while time.time() < deadline:
        if ev("document.readyState==='complete' && !!document.querySelector(" + json.dumps(ready_selector) + ")"):
            time.sleep(.25)
            return True
        time.sleep(.12)
    return False

call("Page.enable")
call("Runtime.enable")

device_id = "dev_80000000000000000000000000000001"
asset_id = "asset_90000000000000000000000000000003"

for width in (1366, 1024, 768):
    viewport(width)

    check(f"workspace ready {width}", nav("/", ".workspace-app-grid"))
    workspace = ev("""(()=>({
      illustration:!!document.querySelector('.workspace-welcome-art img[src="/illustrations/workspace-welcome.svg"]'),
      columns:getComputedStyle(document.querySelector('.workspace-app-grid')).gridTemplateColumns.split(' ').length,
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }))()""")
    check(f"workspace illustration {width}", workspace["illustration"], str(workspace))
    expected_cols = 5 if width == 1366 else 3 if width == 1024 else 1
    check(f"workspace columns {width}", workspace["columns"] == expected_cols, str(workspace))
    check(f"workspace no overflow {width}", not workspace["overflow"], str(workspace))

    check(f"admin ready {width}", nav("/admin", ".admin-overview-grid"))
    admin = ev("""(()=>({
      groups:document.querySelectorAll('.admin-overview-group').length,
      tiles:document.querySelectorAll('.admin-overview-card').length,
      icons:[...document.querySelectorAll('.admin-overview-card')].every(x=>!!x.querySelector('.admin-overview-icon .inno-icon')),
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }))()""")
    check(f"admin grouped sections {width}", admin["groups"] >= 2, str(admin))
    check(f"admin semantic tile icons {width}", admin["tiles"] > 0 and admin["icons"], str(admin))
    check(f"admin no overflow {width}", not admin["overflow"], str(admin))

    check(f"notifications ready {width}", nav("/notifications", ".notification-layout"))
    notifications = ev("""(()=>({
      extraStats:!!document.querySelector('.notification-stat-strip'),
      layout:!!document.querySelector('.notification-layout'),
      rows:document.querySelectorAll('.notification-row').length,
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }))()""")
    check(f"notifications stat strip removed {width}", not notifications["extraStats"], str(notifications))
    check(f"notifications feed layout {width}", notifications["layout"], str(notifications))
    check(f"notifications no overflow {width}", not notifications["overflow"], str(notifications))

    check(f"agent deployment ready {width}", nav("/devices/add", ".deployment-layout"))
    deadline = time.time() + 8
    while time.time() < deadline:
        if ev("""[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Generate Installer')"""):
            break
        time.sleep(.15)
    deploy = ev("""(()=>({
      illustration:!!document.querySelector('.inno-page-illustration img[src="/illustrations/device-setup.svg"]'),
      cards:document.querySelectorAll('.deployment-card').length,
      button:[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Generate Installer'),
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }))()""")
    check(f"agent illustration {width}", deploy["illustration"], str(deploy))
    check(f"agent card structure {width}", deploy["cards"] >= 2, str(deploy))
    check(f"agent installer action {width}", deploy["button"], str(deploy))
    check(f"agent no overflow {width}", not deploy["overflow"], str(deploy))

    check(f"ticket create ready {width}", nav("/helpdesk/tickets/new", ".ticket-create-layout"))
    ticket_create = ev("""(()=>({
      breadcrumb:!!document.querySelector('.inno-page-breadcrumb'),
      labels:[...document.querySelectorAll('.inno-page-breadcrumb a,.inno-page-breadcrumb span')].map(x=>x.textContent.trim()),
      footer:!!document.querySelector('.ticket-create-main > .inno-editor-footer'),
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }))()""")
    check(f"ticket create breadcrumb {width}", ticket_create["breadcrumb"], str(ticket_create))
    check(f"ticket create breadcrumb labels {width}", "Helpdesk" in ticket_create["labels"] and "Tickets" in ticket_create["labels"] and "New ticket" in ticket_create["labels"], str(ticket_create))
    check(f"ticket create footer {width}", ticket_create["footer"], str(ticket_create))
    check(f"ticket create no overflow {width}", not ticket_create["overflow"], str(ticket_create))

    check(f"device detail ready {width}", nav("/devices/" + device_id, ".inno-surface-tabs"))
    device = ev("""(()=>({
      tabs:[...document.querySelectorAll('.inno-surface-tabs button')].map(x=>x.textContent.trim()),
      selected:document.querySelector('.inno-surface-tabs button[aria-selected="true"]')?.textContent.trim()||'',
      overviewHidden:document.querySelector('.device-overview-grid')?.closest('[hidden]')?.hidden||false,
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }))()""")
    check(f"device tabs real {width}", device["tabs"] == ["Overview", "Software"], str(device))
    check(f"device overview selected {width}", device["selected"] == "Overview", str(device))
    ev("""[...document.querySelectorAll('.inno-surface-tabs button')].find(x=>x.textContent.trim()==='Software')?.click()""")
    time.sleep(.1)
    device_after = ev("""(()=>({
      selected:document.querySelector('.inno-surface-tabs button[aria-selected="true"]')?.textContent.trim()||'',
      overviewHidden:!!document.querySelector('.device-overview-grid')?.closest('[hidden]')?.hidden,
      softwareVisible:!![...document.querySelectorAll('.inno-collection-head h2')].find(x=>x.textContent.trim()==='Installed software')?.closest('[hidden]')===false
    }))()""")
    check(f"device software tab switches {width}", device_after["selected"] == "Software" and device_after["overviewHidden"], str(device_after))
    check(f"device detail no overflow {width}", not device["overflow"], str(device))

    check(f"asset detail ready {width}", nav("/assets/" + asset_id, ".inno-surface-tabs"))
    asset = ev("""(()=>({
      tabs:[...document.querySelectorAll('.inno-surface-tabs button')].map(x=>x.textContent.trim()),
      selected:document.querySelector('.inno-surface-tabs button[aria-selected="true"]')?.textContent.trim()||'',
      overflow:document.documentElement.scrollWidth>innerWidth+2
    }))()""")
    check(f"asset tabs real {width}", asset["tabs"] == ["Overview", "Custom Fields", "Ownership"], str(asset))
    check(f"asset overview selected {width}", asset["selected"] == "Overview", str(asset))
    ev("""[...document.querySelectorAll('.inno-surface-tabs button')].find(x=>x.textContent.trim()==='Ownership')?.click()""")
    time.sleep(.1)
    asset_after = ev("""(()=>({
      selected:document.querySelector('.inno-surface-tabs button[aria-selected="true"]')?.textContent.trim()||'',
      history:!![...document.querySelectorAll('.inno-collection-head h2')].find(x=>x.textContent.trim()==='Ownership history')
    }))()""")
    check(f"asset ownership tab switches {width}", asset_after["selected"] == "Ownership" and asset_after["history"], str(asset_after))
    check(f"asset detail no overflow {width}", not asset["overflow"], str(asset))

print("step42_1_browser_checks=" + str(checks))
print("step42_1_browser_failures=" + str(len(failures)))
for failure in failures:
    print("FAILED", failure)
sys.exit(1 if failures else 0)
