from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45x-policies-alerts-overview"
REALM=ROOT/"production/infrastructure/docker/keycloak/realm-inno-one.json"
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True)
checks=0
fails=[]

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok: fails.append((name,detail))

targets=requests.get("http://127.0.0.1:9242/json",timeout=3).json()
page=next(x for x in targets if x.get("type")=="page")
ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=20,origin="http://127.0.0.1")
seq=0

def call(method,params=None):
    global seq
    seq+=1
    ident=seq
    ws.send(json.dumps({"id":ident,"method":method,"params":params or {}}))
    while True:
        msg=json.loads(ws.recv())
        if msg.get("id")==ident:
            if "error" in msg: raise RuntimeError(msg["error"])
            return msg.get("result",{})

def ev(expr):
    r=call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True})
    if "exceptionDetails" in r: raise RuntimeError(str(r["exceptionDetails"]))
    return r.get("result",{}).get("value")

def wait(expr,timeout=18):
    end=time.time()+timeout
    while time.time()<end:
        try:
            value=ev(expr)
            if value: return value
        except Exception:
            pass
        time.sleep(.15)
    return None

def viewport(width):
    call("Emulation.setDeviceMetricsOverride",{"width":width,"height":900,"deviceScaleFactor":1,"mobile":False})

def nav(path):
    call("Page.navigate",{"url":"http://localhost:5180"+path})
    return bool(wait("!!document.querySelector('.inno-production-shell') && !document.querySelector('.boot-screen')",20))

def body():
    return ev("document.body.innerText") or ""

def shot(name):
    data=call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
    (OUT/name).write_bytes(base64.b64decode(data))

def no_runtime_error():
    text=body().lower()
    return "something went wrong" not in text and "system.invalidoperationexception" not in text and "error 500" not in text

viewport(1366)
call("Page.navigate",{"url":"http://localhost:5180/"})
realm=json.loads(REALM.read_text(encoding="utf-8"))
user=next(x for x in realm["users"] if x["username"]=="adisai")
password=user["credentials"][0]["value"]
deadline=time.time()+40
logged=False
while time.time()<deadline:
    href=ev("location.href") or ""
    if any(host in href for host in ("172.10.1.58:8080","localhost:8080","127.0.0.1:8080")) and ev("!!document.querySelector('#kc-login')"):
        ev("document.querySelector('#username').value='adisai';document.querySelector('#password').value="+json.dumps(password)+";document.querySelector('#kc-login').click();")
        time.sleep(.6)
    if href.startswith("http://localhost:5180") and wait("!!document.querySelector('.inno-production-shell')",2):
        logged=True
        break
    time.sleep(.2)
check("Keycloak login completes",logged)
if not logged:
    ws.close()
    raise SystemExit(1)

routes=[
    ("/devices/overview","Fleet Overview"),
    ("/devices/policies","Endpoint Policies"),
    ("/devices/alerts","Active Alerts"),
    ("/devices/alerts/rules","Alert Rules"),
    ("/devices/alerts/channels","Alert Channels"),
    ("/devices/alerts/history","Alert History"),
]

for width in (1366,768):
    viewport(width)
    for index,(path,title) in enumerate(routes):
        check(f"{width} {title} ready",nav(path))
        check(f"{width} {title} visible",bool(wait("document.body.innerText.includes("+json.dumps(title)+")",12)))
        check(f"{width} {title} no page overflow",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)
        check(f"{width} {title} no runtime error",no_runtime_error())
        if (width==1366 and index in (0,1,2,3,4)) or (width==768 and index in (0,1,2)):
            time.sleep(.3)
            shot(f"{width}__{title.lower().replace(' ','-')}.png")

viewport(1366)
check("Devices Overview ready for nav audit",nav("/devices/overview"))
sidebar=ev("[...document.querySelectorAll('.prod-side a')].map(x=>({text:(x.textContent||'').trim(),href:x.getAttribute('href')})).filter(x=>x.href)")
expected_hrefs=[
    "/devices/overview","/devices","/devices/discovery","/devices/groups",
    "/devices/remote-operations","/devices/remote-consent","/devices/query",
    "/devices/deployments","/devices/maintenance","/devices/policies","/devices/alerts",
]
hrefs=[x.get("href") for x in sidebar] if isinstance(sidebar,list) else []
check("Devices final nav has eleven TOR jobs",all(x in hrefs for x in expected_hrefs),sidebar)
positions=[hrefs.index(x) for x in expected_hrefs if x in hrefs]
check("Devices final nav canonical order",len(positions)==len(expected_hrefs) and positions==sorted(positions),sidebar)
check("retired Agent Deployment hidden","/devices/add" not in hrefs,sidebar)
check("retired Device Automation hidden","/devices/automation" not in hrefs,sidebar)

check("Policies collection ready",nav("/devices/policies"))
check("assigned policies render",bool(wait("document.querySelectorAll('tbody tr').length>=3",12)))
policy_href=ev("document.querySelector('a[href^=\"/devices/policies/pol_\"]')?.getAttribute('href') || ''")
check("policy detail link exists",bool(policy_href),policy_href)
if policy_href:
    check("Policy detail ready",nav(policy_href))
    check("Policy detail has configuration",bool(wait("document.body.innerText.includes('Policy configuration')",10)))
    check("Policy detail no page overflow",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)
    compliance_href=ev("document.querySelector('a[href$=\"/compliance\"]')?.getAttribute('href') || ''")
    check("policy compliance link exists",bool(compliance_href),compliance_href)
    if compliance_href:
        check("Policy compliance ready",nav(compliance_href))
        check("Policy compliance visible",bool(wait("document.body.innerText.includes('Compliance') && document.body.innerText.includes('Device compliance')",10)))
        check("Policy compliance rows render",bool(wait("document.querySelectorAll('tbody tr').length>=1",10)))
        check("Policy compliance no page overflow",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)

check("Alert Rules ready for row audit",nav("/devices/alerts/rules"))
check("four default rules render",bool(wait("document.querySelectorAll('tbody tr').length>=4",10)))
check("New Rule route ready",nav("/devices/alerts/rules/new"))
new_copy=body()
for label in ("Rule name","Rule type","Severity","Scope","Channels"):
    check("New Rule control "+label,label in new_copy)

check("Alert Channels ready for section audit",nav("/devices/alerts/channels"))
check("Alert Channels content loaded",bool(wait("document.body.innerText.includes('Alert Channels') && document.body.innerText.includes('Console')",12)))
channel_copy=body()
for label in ("Console","Sound","Email","Test Alert Channels"):
    check("Alert Channels section "+label,label in channel_copy)
check("Email truthfulness copy", "does not fabricate external mail delivery" in channel_copy)

check("Active Alerts empty/evidence state ready",nav("/devices/alerts"))
check("Active Alerts content loaded",bool(wait("document.body.innerText.includes('Active Alerts') && document.body.innerText.includes('Evidence-backed alerts only')",12)))
wait("document.body.innerText.includes('No active alerts') || document.querySelectorAll('tbody tr').length>0",12)
alert_copy=body()
check("Evidence-backed alerts note visible","Evidence-backed alerts only" in alert_copy)
check("No active alerts is valid truthful state",("No active alerts" in alert_copy) or ev("document.querySelectorAll('tbody tr').length>0") is True)

print("step45x_browser_checks="+str(checks))
print("step45x_browser_failures="+str(len(fails)))
print("step45x_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for name,detail in fails:
    print("FAILED",name,detail)
ws.close()
raise SystemExit(1 if fails else 0)
