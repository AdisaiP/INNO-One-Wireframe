from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(r"C:\Projects\INNO-One-Wireframe")
OUT=ROOT/"qa-step45u-activity-tickets"
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

targets=requests.get("http://127.0.0.1:9241/json",timeout=3).json()
page=next(x for x in targets if x.get("type")=="page")
ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=20,origin="http://127.0.0.1")
seq=0
def call(method,params=None):
    global seq
    seq+=1; ident=seq
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
            v=ev(expr)
            if v: return v
        except Exception:
            pass
        time.sleep(.15)
    return None
def viewport(width):
    call("Emulation.setDeviceMetricsOverride",{"width":width,"height":900,"deviceScaleFactor":1,"mobile":False})
def nav(path):
    call("Page.navigate",{"url":"http://localhost:5180"+path})
    return bool(wait("!!document.querySelector('.inno-production-shell') && !document.querySelector('.page-loading-wrap,.boot-screen')",20))
def shot(name):
    data=call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
    (OUT/name).write_bytes(base64.b64decode(data))
def api(js):
    return ev("(async()=>{const auth=await import('/src/auth/keycloak.ts');const token=await auth.getAccessToken();const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};"+js+"})()")

viewport(1366)
call("Page.navigate",{"url":"http://localhost:5180/"})
realm=json.loads(REALM.read_text(encoding="utf-8"))
user=next(x for x in realm["users"] if x["username"]=="adisai")
password=user["credentials"][0]["value"]
deadline=time.time()+35
logged=False
while time.time()<deadline:
    href=ev("location.href") or ""
    if "172.10.1.58:8080" in href and ev("!!document.querySelector('#kc-login')"):
        ev("document.querySelector('#username').value='adisai';document.querySelector('#password').value="+json.dumps(password)+";document.querySelector('#kc-login').click();")
        time.sleep(.6)
    if href.startswith("http://localhost:5180") and wait("!!document.querySelector('.inno-production-shell')",2):
        logged=True; break
    time.sleep(.2)
check("Keycloak login completes",logged)
if not logged: raise SystemExit(1)

locale=api("const r=await fetch('/api/v1/platform/me/profile',{method:'PATCH',headers,body:JSON.stringify({preferredLocale:'en-US'})});return r.status;")
check("force English locale",locale==200,locale)

lst=api("const r=await fetch('/api/v1/devices?page=1&pageSize=100',{headers});const j=await r.json();return {status:r.status,body:j};")
devices=(lst.get("body") or {}).get("items") or []
check("device list API",lst.get("status")==200,lst.get("status"))
check("devices available",len(devices)>0,len(devices))

activity_device=None
activity_payload=None
ticket_device=None
ticket_payload=None
for d in devices:
    did=d.get("id")
    if not activity_device:
        a=api("const r=await fetch('/api/v1/devices/"+did+"/activity?page=1&pageSize=50',{headers});let j=null;try{j=await r.json()}catch{};return {status:r.status,body:j};")
        if a.get("status")==200 and ((a.get("body") or {}).get("totalItems") or 0)>0:
            activity_device=d; activity_payload=a
    if not ticket_device:
        t=api("const r=await fetch('/api/v1/helpdesk/tickets?page=1&pageSize=25&relatedDeviceId="+did+"',{headers});let j=null;try{j=await r.json()}catch{};return {status:r.status,body:j};")
        if t.get("status")==200 and ((t.get("body") or {}).get("totalItems") or 0)>0:
            ticket_device=d; ticket_payload=t
    if activity_device and ticket_device:
        break

check("device with audit activity available",activity_device is not None)
check("device with related Helpdesk ticket available",ticket_device is not None)

if activity_device:
    aid=activity_device["id"]
    check("activity API 200",activity_payload.get("status")==200,activity_payload.get("status"))
    activities=(activity_payload.get("body") or {}).get("items") or []
    check("activity returns rows",len(activities)>0,len(activities))
    check("activity exposes structured metadata",all(isinstance(x.get("metadata"),dict) for x in activities),activities[:1])
    allowed_keys={
        "devices.software_inventory.observed":{"snapshotId","observedAt","completeness","source","packageCount"},
        "devices.process.terminate":{"processKey","processId","executionEngine","verified"},
        "devices.service.action":{"serviceName","action","executionEngine","verified"},
    }
    check("activity metadata is allowlisted",all(set((x.get("metadata") or {}).keys())<=allowed_keys.get(x.get("action"),set()) for x in activities),activities[:3])
    check("activity actor names present",all(bool(x.get("actorName")) for x in activities),activities[:2])
    opaque_actors=[x for x in activities if str(x.get("actorId","")).startswith("user_")]
    check("opaque user actors resolve to directory names",all(x.get("actorName")!=x.get("actorId") for x in opaque_actors),opaque_actors[:2])

if ticket_device:
    tid=ticket_device["id"]
    check("related ticket API 200",ticket_payload.get("status")==200,ticket_payload.get("status"))
    tickets=(ticket_payload.get("body") or {}).get("items") or []
    check("related ticket filter returns rows",len(tickets)>0,len(tickets))
    first=tickets[0]
    detail=api("const r=await fetch('/api/v1/helpdesk/tickets/"+first["id"]+"',{headers});const j=await r.json();return {status:r.status,body:j};")
    related=((detail.get("body") or {}).get("data") or {}).get("relatedDevice") or {}
    check("filtered ticket detail references requested device",detail.get("status")==200 and related.get("id")==tid,related)

for width in (1366,768):
    viewport(width)
    if activity_device:
        aid=activity_device["id"]
        check(f"{width} Activity ready",nav("/devices/"+aid+"?tab=activity"))
        check(f"{width} exactly nine tabs",ev("document.querySelectorAll('.inno-surface-tabs [role=tab]').length")==9)
        check(f"{width} Activity selected",ev("[...document.querySelectorAll('.inno-surface-tabs [role=tab]')].some(x=>x.getAttribute('aria-selected')==='true'&&(x.textContent||'').trim()==='Activity')") is True)
        check(f"{width} Activity rows visible",bool(wait("document.querySelectorAll('tbody tr').length>0 && document.body.innerText.includes('Activity')",12)))
        check(f"{width} Activity no page overflow",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)
        shot(f"{width}__activity.png")
    if ticket_device:
        tid=ticket_device["id"]
        check(f"{width} Tickets ready",nav("/devices/"+tid+"?tab=tickets"))
        check(f"{width} Tickets selected",ev("[...document.querySelectorAll('.inno-surface-tabs [role=tab]')].some(x=>x.getAttribute('aria-selected')==='true'&&(x.textContent||'').trim()==='Tickets')") is True)
        ticket_number=((ticket_payload.get("body") or {}).get("items") or [{}])[0].get("ticketNumber","")
        check(f"{width} ticket rows visible",bool(wait("document.querySelectorAll('tbody tr').length>0 && document.body.innerText.includes("+json.dumps(ticket_number)+")",12)))
        check(f"{width} Tickets no page overflow",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)
        shot(f"{width}__tickets.png")

if ticket_device:
    tid=ticket_device["id"]
    viewport(1366)
    check("Create Ticket deep link ready",nav("/helpdesk/tickets/new?relatedDeviceId="+tid))
    selected=wait("(()=>{const o=[...document.querySelectorAll('option')].find(x=>x.value==="+json.dumps(tid)+");return !!o && o.parentElement && o.parentElement.value==="+json.dumps(tid)+"})()",15)
    check("Create Ticket preselects related device",bool(selected))

if activity_device:
    aid=activity_device["id"]
    check("unknown tab route ready",nav("/devices/"+aid+"?tab=unknown"))
    check("unknown tab still falls back Overview",ev("document.querySelectorAll('.inno-surface-tabs [role=tab]')[0]?.getAttribute('aria-selected')==='true'") is True)

print("step45u_browser_checks="+str(checks))
print("step45u_browser_failures="+str(len(fails)))
print("step45u_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for n,d in fails: print("FAILED",n,d)
ws.close()
raise SystemExit(1 if fails else 0)
