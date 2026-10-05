from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(r"C:\Projects\INNO-One-Wireframe")
OUT = ROOT / "qa-step45s-device-detail-performance-network"
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
    r = call("Runtime.evaluate", {
        "expression": expr,
        "returnByValue": True,
        "awaitPromise": True,
    })
    if "exceptionDetails" in r:
        raise RuntimeError(str(r["exceptionDetails"]))
    return r.get("result", {}).get("value")

def wait(expr, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            value = ev(expr)
            if value:
                return value
        except Exception:
            pass
        time.sleep(.15)
    return None

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        fails.append((name, detail))

def viewport(width):
    call("Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": 900,
        "deviceScaleFactor": 1,
        "mobile": False,
    })

def nav(path):
    call("Page.navigate", {"url": "http://localhost:5180" + path})
    return bool(wait(
        "!!document.querySelector('.inno-production-shell') && "
        "!document.querySelector('.page-loading-wrap,.boot-screen')",
        18,
    ))

def no_overflow():
    return bool(ev("document.documentElement.scrollWidth <= window.innerWidth + 1"))

def shot(name):
    data = call("Page.captureScreenshot", {
        "format": "png",
        "fromSurface": True,
        "captureBeyondViewport": False,
    })["data"]
    (OUT / name).write_bytes(base64.b64decode(data))

def api(js):
    prefix = (
        "(async()=>{"
        "const auth=await import('/src/auth/keycloak.ts');"
        "const token=await auth.getAccessToken();"
        "const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};"
    )
    return ev(prefix + js + "})()")

profile = api(
    "const r=await fetch('/api/v1/platform/me',{headers});"
    "const j=await r.json();return {status:r.status,body:j};"
)
check("profile API", profile.get("status") == 200, profile.get("status"))
profile_data = (profile.get("body") or {}).get("data") or {}

device_list = api(
    "const r=await fetch('/api/v1/devices?page=1&pageSize=100',{headers});"
    "const j=await r.json();return {status:r.status,body:j};"
)
check("device list API", device_list.get("status") == 200, device_list.get("status"))
items = (device_list.get("body") or {}).get("items") or []
check("device list has rows", len(items) > 0, len(items))

details = []
for item in items:
    did = item.get("id")
    if not did:
        continue
    result = api(
        "const r=await fetch('/api/v1/devices/" + did + "',{headers});"
        "const j=await r.json();return {status:r.status,body:j};"
    )
    if result.get("status") == 200:
        details.append((item, (result.get("body") or {}).get("data") or {}))

full_name = profile_data.get("fullName")
owned = next(
    (
        (item, detail)
        for item, detail in details
        if full_name
        and detail.get("assignedUser")
        and detail.get("assignedUser") == full_name
    ),
    None,
)
if owned is None:
    owned = next(
        ((item, detail) for item, detail in details if detail.get("status") == "online"),
        details[0] if details else None,
    )

check("telemetry target device available", owned is not None)
telemetry_device = owned[0]["id"] if owned else None

telemetry_results = []
if telemetry_device:
    now_ms = int(time.time() * 1000)
    for index, offset_ms in enumerate((10000, 5000, 0)):
        observed = time.strftime(
            "%Y-%m-%dT%H:%M:%S",
            time.gmtime((now_ms - offset_ms) / 1000),
        ) + ".000Z"
        cpu = 31 + index * 6
        memory = 12.5 + index * 0.5
        network_part = (
            "" if index < 2 else
            """,
              network:{
                ipAddress:'10.20.3.33',
                macAddress:'A4:91:B1:20:44:18',
                subnetMask:'255.255.255.0',
                gateway:'10.20.3.1',
                dnsServers:['10.20.0.10','10.20.0.11'],
                adapterName:'Step45S QA adapter'
              }"""
        )
        js = f"""
            const body={{
              observedAt:'{observed}',
              sourceInstance:'step45s-browser-qa',
              performance:{{
                cpuPercent:{cpu},
                memoryUsedGb:{memory},
                memoryTotalGb:32,
                diskUsedGb:220,
                diskTotalGb:512
              }}{network_part}
            }};
            const r=await fetch('/api/v1/agent/devices/{telemetry_device}/telemetry',{{
              method:'POST',headers,body:JSON.stringify(body)
            }});
            const t=await r.text();
            let j=null;try{{j=t?JSON.parse(t):null;}}catch{{j=t;}}
            return {{status:r.status,body:j}};
        """
        result = api(js)
        telemetry_results.append(result)
        if result.get("status") not in (200, 201):
            break

check(
    "agent telemetry ingest accepted",
    len(telemetry_results) == 3 and all(x.get("status") == 200 for x in telemetry_results),
    telemetry_results,
)

performance = None
network = None
if telemetry_device:
    performance = api(
        "const r=await fetch('/api/v1/devices/" + telemetry_device +
        "/performance?window=5m&interval=5',{headers});"
        "const j=await r.json();return {status:r.status,body:j};"
    )
    network = api(
        "const r=await fetch('/api/v1/devices/" + telemetry_device +
        "/network-inventory',{headers});"
        "const j=await r.json();return {status:r.status,body:j};"
    )

perf_data = ((performance or {}).get("body") or {}).get("data") or {}
network_data = ((network or {}).get("body") or {}).get("data") or {}

check("performance API 200", (performance or {}).get("status") == 200, (performance or {}).get("status"))
check("performance source endpoint agent", perf_data.get("source") == "endpoint_agent", perf_data.get("source"))
check("performance is live only from fresh agent sample", perf_data.get("status") == "live" and perf_data.get("isLive") is True, perf_data)
check("performance has trend samples", len(perf_data.get("points") or []) >= 3, len(perf_data.get("points") or []))

check("network API 200", (network or {}).get("status") == 200, (network or {}).get("status"))
check("network reported", network_data.get("inventoryStatus") == "reported", network_data.get("inventoryStatus"))
check("network fresh agent observation", network_data.get("isStale") is False and network_data.get("source") == "endpoint_agent", network_data)
check("network independent config persisted", network_data.get("subnetMask") == "255.255.255.0" and len(network_data.get("dnsServers") or []) == 2, network_data)
check("network does not invent latency", network_data.get("agentLatencyMs") is None and network_data.get("packetLossPercent") is None, network_data)

offline = next(((item, detail) for item, detail in details if detail.get("status") == "offline"), None)
check("offline device available", offline is not None)

for width in (1366, 768):
    viewport(width)
    if telemetry_device:
        base = "/devices/" + telemetry_device

        check(f"{width} performance deep link ready", nav(base + "?tab=performance"))
        tabs = ev(
            "[...document.querySelectorAll('.inno-surface-tabs [role=tab]')].map("
            "x=>({text:(x.textContent||'').trim(),selected:x.getAttribute('aria-selected')}))"
        ) or []
        check(f"{width} exactly five implemented tabs", len(tabs) == 5, tabs)
        check(
            f"{width} performance selected",
            ev("document.querySelectorAll('.inno-surface-tabs [role=tab]')[3]?.getAttribute('aria-selected')==='true'") is True,
        )
        check(f"{width} performance panels rendered", ev("!!document.querySelector('.device-performance-grid')") is True)
        check(f"{width} performance charts use real points", (ev("document.querySelectorAll('.performance-sparkline polyline').length") or 0) >= 2)
        check(f"{width} performance no overflow", no_overflow())
        shot(f"{width}__live-performance.png")

        check(f"{width} network deep link ready", nav(base + "?tab=network"))
        check(
            f"{width} network selected",
            ev("document.querySelectorAll('.inno-surface-tabs [role=tab]')[4]?.getAttribute('aria-selected')==='true'") is True,
        )
        check(f"{width} network grid rendered", ev("!!document.querySelector('.device-network-grid')") is True)
        body = ev("document.body.innerText") or ""
        check(f"{width} network does not claim healthy", "Healthy" not in body and "ปกติ" not in body)
        check(f"{width} network no overflow", no_overflow())
        shot(f"{width}__fresh-network.png")

        check(f"{width} future tab falls back overview", nav(base + "?tab=processes"))
        check(
            f"{width} future tab overview selected",
            ev("document.querySelectorAll('.inno-surface-tabs [role=tab]')[0]?.getAttribute('aria-selected')==='true'") is True,
        )

    if offline:
        offline_id = offline[0]["id"]
        check(f"{width} offline performance ready", nav("/devices/" + offline_id + "?tab=performance"))
        check(f"{width} offline performance not live", "Live" not in (ev("document.body.innerText") or "") or "สด" not in (ev("document.body.innerText") or ""))
        check(f"{width} offline performance no overflow", no_overflow())
        shot(f"{width}__offline-performance.png")

        check(f"{width} offline network ready", nav("/devices/" + offline_id + "?tab=network"))
        check(f"{width} offline network no overflow", no_overflow())
        shot(f"{width}__offline-network.png")

print("step45s_browser_checks=" + str(checks))
print("step45s_browser_failures=" + str(len(fails)))
print("step45s_browser_screenshots=" + str(len(list(OUT.glob('*.png')))))
for name, detail in fails:
    print("FAILED", name, detail)
ws.close()
raise SystemExit(1 if fails else 0)
