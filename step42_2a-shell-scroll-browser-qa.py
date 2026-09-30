import json, time, requests, websocket

PORT = 9241
URL = "http://localhost:5180/internal/design-system"

targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=2).json()
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
            return msg.get("result", {})

def ev(expr):
    return call("Runtime.evaluate", {"expression": expr, "returnByValue": True})["result"].get("value")

call("Page.enable")
call("Runtime.enable")
failures = []
checks = 0
for width in (1366, 1024, 768):
    call("Emulation.setDeviceMetricsOverride", {"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False})
    call("Page.navigate", {"url": URL})
    deadline = time.time() + 12
    while time.time() < deadline:
        ready = ev("!!document.querySelector('.internal-ds-section') && document.querySelector('.prod-main')?.scrollHeight > document.querySelector('.prod-main')?.clientHeight")
        if ready:
            time.sleep(.2)
            break
        time.sleep(.15)
    data = ev("""(()=>{const m=document.querySelector('.prod-main'),r=document.querySelector('.prod-rail'),s=document.querySelector('.prod-side');const b={windowY:scrollY,docH:document.documentElement.scrollHeight,docC:document.documentElement.clientHeight,mainTop:m?.scrollTop||0,mainH:m?.scrollHeight||0,mainC:m?.clientHeight||0,railY:r?.getBoundingClientRect().top||0,sideY:s?.getBoundingClientRect().top||0,sidePos:s?getComputedStyle(s).position:''};if(m)m.scrollTop=400;const a={windowY:scrollY,mainTop:m?.scrollTop||0,railY:r?.getBoundingClientRect().top||0,sideY:s?.getBoundingClientRect().top||0};return {b,a};})()""")
    tests = {
        "document does not own scroll": data["b"]["docH"] <= data["b"]["docC"] + 2 and data["a"]["windowY"] == 0,
        "main owns overflow": data["b"]["mainH"] > data["b"]["mainC"] and data["a"]["mainTop"] > 0,
        "rail stays chrome": abs(data["a"]["railY"] - data["b"]["railY"]) <= 1,
    }
    if width == 1366:
        tests["sidebar stays chrome"] = abs(data["a"]["sideY"] - data["b"]["sideY"]) <= 1 and data["b"]["sidePos"] == "relative"
    else:
        tests["sidebar keeps off-canvas ownership"] = data["b"]["sidePos"] == "fixed"
    for name, ok in tests.items():
        checks += 1
        print(("PASS " if ok else "FAIL ") + f"{width} {name}" + ("" if ok else " :: " + json.dumps(data)))
        if not ok:
            failures.append((width, name, data))

print(f"step42_2a_scroll_checks={checks}")
print(f"step42_2a_scroll_failures={len(failures)}")
raise SystemExit(1 if failures else 0)
