from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(r"C:\Projects\INNO-One-Wireframe")
OUT=ROOT/"qa-step45t-processes-services"
REALM=ROOT/"production/infrastructure/docker/keycloak/realm-inno-one.json"
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True)
checks=0
fails=[]

def check(name, ok, detail=""):
    global checks
    checks+=1
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
        except Exception: pass
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
items=(lst.get("body") or {}).get("items") or []
online=next((x for x in items if x.get("status")=="online"),None)
offline=next((x for x in items if x.get("status")=="offline"),None)
check("online device available",online is not None)
check("offline device available",offline is not None)
if not online: raise SystemExit(1)
did=online["id"]

proc=api("const r=await fetch('/api/v1/devices/"+did+"/processes/snapshots',{method:'POST',headers});const j=await r.json();return {status:r.status,body:j};")
check("process snapshot accepted",proc.get("status")==202,proc)
psid=(proc.get("body") or {}).get("snapshotId")
if psid:
    got=api("const r=await fetch('/api/v1/devices/"+did+"/processes/snapshots/"+psid+"',{headers});const j=await r.json();return {status:r.status,body:j};")
    rows=((got.get("body") or {}).get("data") or {}).get("items") or []
    check("process snapshot GET",got.get("status")==200,got.get("status"))
    check("MeshAgent process normalized",any(x.get("name")=="chrome.exe" for x in rows),rows)

svc=api("const r=await fetch('/api/v1/devices/"+did+"/services/snapshots',{method:'POST',headers});const j=await r.json();return {status:r.status,body:j};")
check("service snapshot accepted",svc.get("status")==202,svc)
ssid=(svc.get("body") or {}).get("snapshotId")
if ssid:
    got=api("const r=await fetch('/api/v1/devices/"+did+"/services/snapshots/"+ssid+"',{headers});const j=await r.json();return {status:r.status,body:j};")
    rows=((got.get("body") or {}).get("data") or {}).get("items") or []
    check("service snapshot GET",got.get("status")==200,got.get("status"))
    check("MeshAgent service normalized",any(x.get("name")=="WSearch" for x in rows),rows)

for width in (1366,768):
    viewport(width)
    base="/devices/"+did
    check(f"{width} Processes ready",nav(base+"?tab=processes"))
    check(f"{width} seven tabs",ev("document.querySelectorAll('.inno-surface-tabs [role=tab]').length")==7)
    check(f"{width} Processes selected",ev("[...document.querySelectorAll('.inno-surface-tabs [role=tab]')].some(x=>x.getAttribute('aria-selected')==='true'&&(x.textContent||'').trim()==='Processes')") is True)
    check(f"{width} process rows visible",bool(wait("[...document.querySelectorAll('tbody tr')].some(r=>(r.textContent||'').includes('chrome.exe'))",15)))
    check(f"{width} no overflow Processes",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)
    shot(f"{width}__processes.png")

    if width==1366:
        opened=ev("""(()=>{const row=[...document.querySelectorAll('tbody tr')].find(r=>(r.textContent||'').includes('chrome.exe'));const b=row?[...row.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Stop'):null;if(b){b.click();return true}return false})()""")
        check("process warning dialog opens",opened is True and bool(wait("!!document.querySelector('[role=dialog]')",5)))
        body=ev("document.querySelector('[role=dialog]')?.innerText||''")
        check("process dialog identifies interruptive action","Interruptive action" in body and "chrome.exe" in body,body)
        ev("document.querySelector('[role=dialog] button.inno-btn--secondary')?.click()")

    check(f"{width} Services ready",nav(base+"?tab=services"))
    check(f"{width} Services selected",ev("[...document.querySelectorAll('.inno-surface-tabs [role=tab]')].some(x=>x.getAttribute('aria-selected')==='true'&&(x.textContent||'').trim()==='Services')") is True)
    check(f"{width} service rows visible",bool(wait("[...document.querySelectorAll('tbody tr')].some(r=>(r.textContent||'').includes('WSearch'))",15)))
    check(f"{width} no overflow Services",ev("document.documentElement.scrollWidth<=innerWidth+1") is True)
    shot(f"{width}__services.png")

    if width==1366:
        opened=ev("""(()=>{const row=[...document.querySelectorAll('tbody tr')].find(r=>(r.textContent||'').includes('WSearch'));const b=row?[...row.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Start'):null;if(b){b.click();return true}return false})()""")
        check("service warning dialog opens",opened is True and bool(wait("!!document.querySelector('[role=dialog]')",5)))
        body=ev("document.querySelector('[role=dialog]')?.innerText||''")
        check("service dialog identifies interruptive action","Interruptive action" in body and "Windows Search" in body,body)
        ev("document.querySelector('[role=dialog] button.inno-btn--secondary')?.click()")

if offline:
    oid=offline["id"]
    viewport(1366)
    check("offline Processes ready",nav("/devices/"+oid+"?tab=processes"))
    check("offline Processes state",ev("!!document.querySelector('.inno-state.offline')") is True)
    check("offline Processes no live collection",ev("!document.querySelector('.device-live-collection')") is True)
    check("offline Services ready",nav("/devices/"+oid+"?tab=services"))
    check("offline Services state",ev("!!document.querySelector('.inno-state.offline')") is True)
    check("offline Services no live collection",ev("!document.querySelector('.device-live-collection')") is True)
    shot("1366__offline-services.png")



# Action verification happens after visual/read-only checks so the deterministic
# screenshots above always start from the same fake MeshAgent state.
terminate=api("const r=await fetch('/api/v1/devices/"+did+"/processes/proc_12884/terminate',{method:'POST',headers});const j=await r.json();return {status:r.status,body:j};")
check("terminate process action verified",terminate.get("status")==202 and (terminate.get("body") or {}).get("verified") is True,terminate)
proc2=api("const r=await fetch('/api/v1/devices/"+did+"/processes/snapshots',{method:'POST',headers});const j=await r.json();return {status:r.status,body:j};")
psid2=(proc2.get("body") or {}).get("snapshotId")
if psid2:
    got=api("const r=await fetch('/api/v1/devices/"+did+"/processes/snapshots/"+psid2+"',{headers});const j=await r.json();return {status:r.status,body:j};")
    rows=((got.get("body") or {}).get("data") or {}).get("items") or []
    check("terminated process disappears from MeshAgent snapshot",not any(x.get("processId")==12884 for x in rows),rows)

for action,expected in [("start","Running"),("restart","Running"),("stop","Stopped")]:
    result=api("const r=await fetch('/api/v1/devices/"+did+"/services/WSearch/actions',{method:'POST',headers,body:JSON.stringify({action:"+json.dumps(action)+"})});const j=await r.json();return {status:r.status,body:j};")
    check("service "+action+" action verified",result.get("status")==202 and (result.get("body") or {}).get("verified") is True,result)
    current=api("const r=await fetch('/api/v1/devices/"+did+"/services/snapshots',{method:'POST',headers});const j=await r.json();return {status:r.status,body:j};")
    current_id=(current.get("body") or {}).get("snapshotId")
    if current_id:
        got=api("const r=await fetch('/api/v1/devices/"+did+"/services/snapshots/"+current_id+"',{headers});const j=await r.json();return {status:r.status,body:j};")
        rows=((got.get("body") or {}).get("data") or {}).get("items") or []
        wsearch=next((x for x in rows if x.get("name")=="WSearch"),None)
        check("service "+action+" resulting state",wsearch is not None and wsearch.get("status")==expected,wsearch)

print("step45t_browser_checks="+str(checks))
print("step45t_browser_failures="+str(len(fails)))
print("step45t_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for n,d in fails: print("FAILED",n,d)
ws.close()
raise SystemExit(1 if fails else 0)
