from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(r"C:\Projects\INNO-One-Wireframe")
OUT = ROOT / "qa-step45r-device-detail-core-browser"
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

targets = requests.get("http://127.0.0.1:9241/json", timeout=3).json()
page = next(x for x in targets if x.get("type") == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=20, origin="http://127.0.0.1")
seq = 0
checks = 0
fails = []

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
    r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    if "exceptionDetails" in r:
        raise RuntimeError(str(r["exceptionDetails"]))
    return r.get("result", {}).get("value")

def wait(expr, timeout=12):
    end = time.time() + timeout
    while time.time() < end:
        try:
            value = ev(expr)
            if value:
                return value
        except Exception:
            pass
        time.sleep(.12)
    return None

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        fails.append((name, detail))

def viewport(width):
    call("Emulation.setDeviceMetricsOverride", {"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False})

def nav(path):
    call("Page.navigate", {"url": "http://localhost:5180" + path})
    return bool(wait("!!document.querySelector('.inno-production-shell') && !document.querySelector('.page-loading-wrap,.boot-screen')", 15))

def no_overflow():
    return bool(ev("document.documentElement.scrollWidth <= window.innerWidth + 1"))

def shot(name):
    data = call("Page.captureScreenshot", {"format": "png", "fromSurface": True, "captureBeyondViewport": False})["data"]
    (OUT / name).write_bytes(base64.b64decode(data))

def api(script):
    return ev("(async()=>{const auth=await import('/src/auth/keycloak.ts');const token=await auth.getAccessToken();"
              "const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};" + script + "})()")

device_list = api("const r=await fetch('/api/v1/devices?page=1&pageSize=100',{headers});"
                  "const j=await r.json();return {status:r.status,body:j};")
check("device list API", device_list.get("status") == 200, device_list.get("status"))
items = (device_list.get("body") or {}).get("items") or []
check("device list has rows", len(items) > 0, len(items))
online = next((x for x in items if x.get("status") == "online"), items[0] if items else None)
offline = next((x for x in items if x.get("status") == "offline"), None)
check("online device available", online is not None)
check("offline device available", offline is not None)

if online:
    device_id = online["id"]
    hardware = api("const r=await fetch('/api/v1/devices/" + device_id + "/hardware-inventory',{headers});"
                   "const j=await r.json();return {status:r.status,body:j};")
    check("hardware API 200", hardware.get("status") == 200, hardware.get("status"))
    hw = ((hardware.get("body") or {}).get("data") or {})
    check("hardware API device id", hw.get("deviceId") == device_id, hw.get("deviceId"))
    check("hardware API observation status", hw.get("inventoryStatus") in ("complete","partial"), hw.get("inventoryStatus"))
    check("hardware API evidence metadata", bool(hw.get("snapshotId")) and bool(hw.get("observedAt")) and bool(hw.get("source")), hw)

for width in (1366, 768):
    viewport(width)
    if online:
        base = "/devices/" + online["id"]
        check(f"{width} online overview ready", nav(base))
        check(f"{width} online overview no overflow", no_overflow())
        tabs = ev("[...document.querySelectorAll('.inno-surface-tabs [role=tab]')].map(x=>({text:(x.textContent||'').trim(),selected:x.getAttribute('aria-selected')}))") or []
        check(f"{width} exactly three active Step45R tabs", len(tabs) == 3, tabs)
        check(f"{width} overview selected", len(tabs) == 3 and tabs[0].get("selected") == "true", tabs)

        check(f"{width} hardware deep link ready", nav(base + "?tab=hardware"))
        check(f"{width} hardware selected", ev("document.querySelectorAll('.inno-surface-tabs [role=tab]')[1]?.getAttribute('aria-selected')==='true'") is True)
        check(f"{width} hardware panel rendered", ev("!!document.querySelector('.device-hardware-grid')") is True)
        check(f"{width} hardware no overflow", no_overflow())
        check(f"{width} no refresh placeholder", "Refresh Inventory" not in (ev("document.body.innerText") or ""))
        shot(f"{width}__online-hardware.png")

        check(f"{width} software deep link ready", nav(base + "?tab=software"))
        check(f"{width} software selected", ev("document.querySelectorAll('.inno-surface-tabs [role=tab]')[2]?.getAttribute('aria-selected')==='true'") is True)
        check(f"{width} software collection rendered", ev("!!document.querySelector('.device-software-card')") is True)
        check(f"{width} software no overflow", no_overflow())
        shot(f"{width}__online-software.png")

        check(f"{width} unknown tab route ready", nav(base + "?tab=unknown"))
        check(f"{width} unknown tab falls back overview", ev("document.querySelectorAll('.inno-surface-tabs [role=tab]')[0]?.getAttribute('aria-selected')==='true'") is True)

    if offline:
        base = "/devices/" + offline["id"]
        check(f"{width} offline hardware ready", nav(base + "?tab=hardware"))
        body = ev("document.body.innerText") or ""
        check(f"{width} offline banner visible", ev("!!document.querySelector('.inno-state.is-offline,.inno-state[data-kind=offline],.inno-state-banner')") is True or "offline" in body.lower() or "ออฟไลน์" in body)
        check(f"{width} offline cached hardware visible", ev("!!document.querySelector('.device-hardware-grid')") is True)
        check(f"{width} offline hardware no overflow", no_overflow())
        shot(f"{width}__offline-hardware.png")

print("step45r_browser_checks=" + str(checks))
print("step45r_browser_failures=" + str(len(fails)))
print("step45r_browser_screenshots=" + str(len(list(OUT.glob('*.png')))))
for name, detail in fails:
    print("FAILED", name, detail)
ws.close()
raise SystemExit(1 if fails else 0)
