from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45w-deployment-maintenance"
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
    return bool(wait("!!document.querySelector('.inno-production-shell') && !document.querySelector('.boot-screen,.page-loading-wrap')",20))

def shot(name):
    data=call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
    (OUT/name).write_bytes(base64.b64decode(data))

viewport(1366)
call("Page.navigate",{"url":"http://localhost:5180/"})
realm=json.loads(REALM.read_text(encoding="utf-8"))
user=next(x for x in realm["users"] if x["username"]=="adisai")
password=user["credentials"][0]["value"]
deadline=time.time()+40
logged=False
while time.time()<deadline:
    href=ev("location.href") or ""
    if "172.10.1.58:8080" in href and ev("!!document.querySelector('#kc-login')"):
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
    ("/devices/deployments","Deployment Jobs"),
    ("/devices/deployments/new","New Deployment"),
    ("/devices/maintenance","Agent Maintenance"),
    ("/devices/maintenance/agent-updates","Agent Updates"),
    ("/devices/maintenance/agent-rollouts/new","New Agent Rollout"),
    ("/devices/maintenance/software","Software Maintenance"),
    ("/devices/maintenance/software/new","New Software Maintenance Job"),
    ("/devices/maintenance/restarts","Restart Operations"),
    ("/devices/maintenance/restarts/new","Schedule Restart"),
    ("/devices/maintenance/history","Maintenance History"),
]

for width in (1366,768):
    viewport(width)
    for index,(path,title) in enumerate(routes):
        check(f"{width} {title} ready",nav(path))
        check(f"{width} {title} visible",bool(wait("document.body.innerText.includes("+json.dumps(title)+")",10)))
        check(f"{width} {title} no page overflow",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)
        if width==1366 and index in (0,2,6,8,9):
            shot(f"{width}__{title.lower().replace(' ','-')}.png")

viewport(1366)
check("Deployment Jobs ready for navigation check",nav("/devices/deployments"))
sidebar=ev("[...document.querySelectorAll('.prod-side a')].map(x=>(x.textContent||'').trim()).filter(Boolean)")
check("Devices nav contains Deployment Jobs",isinstance(sidebar,list) and "Deployment Jobs" in sidebar,sidebar)
check("Devices nav contains Agent Maintenance",isinstance(sidebar,list) and "Agent Maintenance" in sidebar,sidebar)
check("retired Agent Deployment hidden from nav",isinstance(sidebar,list) and "Agent Deployment" not in sidebar,sidebar)
check("Step45X Policies hidden",isinstance(sidebar,list) and "Endpoint Policies" not in sidebar,sidebar)
check("Step45X Alerts hidden",isinstance(sidebar,list) and "Active Alerts" not in sidebar,sidebar)

check("New Deployment form ready",nav("/devices/deployments/new"))
copy=ev("document.body.innerText")
for label in ("Deployment type","Package / source","Select targets","Schedule & safeguards","Create Deployment"):
    check("New Deployment control "+label,label in (copy or ""))

check("Software Maintenance form ready",nav("/devices/maintenance/software/new"))
copy=ev("document.body.innerText")
for label in ("Action","Package","Targets & timing","Create Job"):
    check("Software form control "+label,label in (copy or ""))

check("Restart Schedule form ready",nav("/devices/maintenance/restarts/new"))
copy=ev("document.body.innerText")
for label in ("Restart time","Grace period","User notification message","Schedule Restart"):
    check("Restart form control "+label,label in (copy or ""))

check("Deployment list has truthful queued QA row",nav("/devices/deployments"))
check("queued status visible",bool(wait("document.body.innerText.includes('queued') && document.body.innerText.includes('[STEP45W-QA]')",10)))

check("Maintenance history has QA rows",nav("/devices/maintenance/history"))
check("history renders rows",bool(wait("document.querySelectorAll('tbody tr').length>=3",10)))

print("step45w_browser_checks="+str(checks))
print("step45w_browser_failures="+str(len(fails)))
print("step45w_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for name,detail in fails:
    print("FAILED",name,detail)
ws.close()
raise SystemExit(1 if fails else 0)
