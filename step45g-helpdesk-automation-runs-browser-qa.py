from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45g-helpdesk-automation-runs"
REALM=ROOT/"production/infrastructure/docker/keycloak/realm-inno-one.json"
PORT=9241
WIDTHS=(1366,1024,768)

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
checks=0
failures=[]

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name+(((" :: "+str(detail)) if detail else "")))
    if not ok:
        failures.append((name,detail))

class CDP:
    def __init__(self):
        deadline=time.time()+12
        targets=None
        while time.time()<deadline:
            try:
                targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=1).json()
                if targets: break
            except Exception:
                time.sleep(.15)
        if not targets: raise RuntimeError("Chrome DevTools target unavailable")
        page=next(x for x in targets if x.get("type")=="page")
        self.ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=10,origin="http://127.0.0.1")
        self.n=0
        self.call("Page.enable"); self.call("Runtime.enable")
    def call(self,method,params=None):
        self.n+=1; ident=self.n
        self.ws.send(json.dumps({"id":ident,"method":method,"params":params or {}}))
        while True:
            msg=json.loads(self.ws.recv())
            if msg.get("id")==ident:
                if "error" in msg: raise RuntimeError(msg["error"])
                return msg.get("result",{})
    def ev(self,expr):
        result=self.call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True})
        if "exceptionDetails" in result: raise RuntimeError(str(result["exceptionDetails"]))
        return result.get("result",{}).get("value")
    def viewport(self,width,height=900):
        self.call("Emulation.setDeviceMetricsOverride",{"width":width,"height":height,"deviceScaleFactor":1,"mobile":False})
    def navigate(self,url): self.call("Page.navigate",{"url":url})
    def shot(self,name):
        data=self.call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
        (OUT/name).write_bytes(base64.b64decode(data))

def wait(c,expr,timeout=15):
    deadline=time.time()+timeout
    while time.time()<deadline:
        try:
            value=c.ev(expr)
            if value: return value
        except Exception:
            pass
        time.sleep(.12)
    return None

def realm_password(username):
    realm=json.loads(REALM.read_text(encoding="utf-8"))
    user=next(x for x in realm["users"] if x["username"]==username)
    return user["credentials"][0]["value"]

def login(c):
    c.navigate("http://localhost:5180/")
    password=realm_password("adisai")
    deadline=time.time()+35
    while time.time()<deadline:
        href=c.ev("location.href") or ""
        if any(host in href for host in ("172.10.1.58:8080","localhost:8080","127.0.0.1:8080")) and c.ev("!!document.querySelector('#kc-login')"):
            c.ev("document.querySelector('#username').value="+json.dumps("adisai")+";document.querySelector('#password').value="+json.dumps(password)+";document.querySelector('#kc-login').click();true")
            time.sleep(.5)
        if href.startswith("http://localhost:5180") and wait(c,"!!document.querySelector('.inno-production-shell')",2):
            return True
        time.sleep(.2)
    return False

def nav(c,route):
    c.navigate("http://localhost:5180"+route)
    time.sleep(.4)
    return bool(wait(c,"""(()=>{const p=document.querySelector('.inno-page,.page-error-wrap');return location.pathname===%s&&document.readyState==='complete'&&!!p&&!document.querySelector('.page-loading-wrap,.boot-screen')})()""" % json.dumps(route.split("?")[0]),20))

def body(c): return c.ev("document.body.innerText") or ""
def no_overflow(c): return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

def click_text(c,value):
    return c.ev("""(()=>{const t=%s;const e=[...document.querySelectorAll('button,a')].find(x=>(x.textContent||'').trim()===t);if(!e)return false;e.click();return true})()""" % json.dumps(value))

def set_select(c,value):
    return c.ev("""(()=>{const e=document.querySelector('.automation-run-launcher select');if(!e)return false;const s=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;s.call(e,%s);e.dispatchEvent(new Event('change',{bubbles:true}));return e.value===%s})()""" % (json.dumps(value),json.dumps(value)))

def api(c,script):
    return c.ev("""(async()=>{const auth=await import('/src/auth/keycloak.ts');const token=await auth.getAccessToken();const headers={Authorization:'Bearer '+token};%s})()""" % script)

def profile_state(c):
    return api(c,"const r=await fetch('/api/v1/platform/me',{headers});return (await r.json()).data;")
def admin_settings(c):
    return api(c,"const r=await fetch('/api/v1/admin/settings',{headers});return await r.json();")
def set_profile_locale(c,preferred):
    payload={"useOrganizationDefault": True} if preferred is None else {"preferredLocale":preferred}
    return api(c,"""const r=await fetch('/api/v1/platform/me/profile',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(%s)});return {status:r.status,data:await r.json()};""" % json.dumps(payload))
def set_admin_locale(c,locale):
    return api(c,"""const current=await (await fetch('/api/v1/admin/settings',{headers})).json();if(current.localization.defaultLocale===%s)return {status:200,data:current.localization};const r=await fetch('/api/v1/admin/settings/localization',{method:'PATCH',headers:{...headers,'Content-Type':'application/json','If-Match':current.localization.eTag},body:JSON.stringify({defaultLocale:%s})});return {status:r.status,data:await r.json()};""" % (json.dumps(locale),json.dumps(locale)))

c=CDP(); c.viewport(1366)
check("Keycloak login completes",login(c),c.ev("location.href") or "")
original_profile=profile_state(c); original_settings=admin_settings(c)
original_pref=original_profile.get("preferredLocale"); original_default=original_settings["localization"]["defaultLocale"]
set_admin_locale(c,"en-US"); set_profile_locale(c,None)

# Clean up Step45G QA definitions left by an interrupted prior QA run.
orphans=api(c,"""
  const list=await (await fetch('/api/v1/helpdesk/automations?page=1&pageSize=100',{headers})).json();
  const results=[];
  for(const item of (list.items||[]).filter(x=>(x.name||'').startsWith('QA Step45G Executable '))){
    const detailResponse=await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(item.id),{headers});
    if(!detailResponse.ok) continue;
    const detail=(await detailResponse.json()).data;
    const deleted=await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(item.id),{
      method:'DELETE',
      headers:{...headers,'If-Match':detail.eTag}
    });
    results.push({id:item.id,status:deleted.status});
  }
  return results;
""")
check("Interrupted Step45G QA definitions cleaned",all(x.get("status")==204 for x in orphans),orphans)

ticket_state=api(c,"""
  const list=await (await fetch('/api/v1/helpdesk/tickets?page=1&pageSize=50',{headers})).json();
  for(const item of (list.items||[])){
    const r=await fetch('/api/v1/helpdesk/tickets/'+encodeURIComponent(item.id),{headers});
    if(!r.ok)continue;
    const d=(await r.json()).data;
    if(d.assignee?.id || d.team) return {item,detail:d};
  }
  return null;
""")
check("Restorable ticket context found",bool(ticket_state),ticket_state)
ticket_id=ticket_state["detail"]["id"]
original_team=ticket_state["detail"].get("team")
original_assignee=(ticket_state["detail"].get("assignee") or {}).get("id")

name="QA Step45G Executable "+str(int(time.time()))
nodes=[
 {"id":"trigger","kind":"trigger","catalogKey":"helpdesk.ticket.created","label":"Ticket Created","labelKey":"helpdesk.automation.catalog.ticketCreated.label","description":"Starts when a new Helpdesk ticket is created.","descriptionKey":"helpdesk.automation.catalog.ticketCreated.description","configuration":{}},
 {"id":"assignment","kind":"assignment","catalogKey":"helpdesk.ticket.assign_team","label":"Assign Team","labelKey":"helpdesk.automation.catalog.assignTeam.label","description":"Assigns the ticket to a Helpdesk team.","descriptionKey":"helpdesk.automation.catalog.assignTeam.description","configuration":{"team":"QA Automation Team"}},
 {"id":"wait","kind":"wait","catalogKey":"workflow.wait","label":"Wait","labelKey":"helpdesk.automation.catalog.wait.label","description":"Wait one second.","descriptionKey":"helpdesk.automation.catalog.wait.description","configuration":{"durationSeconds":1}},
 {"id":"end","kind":"end","catalogKey":"workflow.end","label":"End","labelKey":"helpdesk.automation.catalog.end.label","description":"End.","descriptionKey":"helpdesk.automation.catalog.end.description","configuration":{}}
]
edges=[
 {"id":"e1","source":"trigger","target":"assignment"},
 {"id":"e2","source":"assignment","target":"wait"},
 {"id":"e3","source":"wait","target":"end"}
]
created=api(c,"""
  const r=await fetch('/api/v1/helpdesk/automations',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(%s)});
  return {status:r.status,data:await r.json()};
""" % json.dumps({"name":name,"nodes":nodes,"edges":edges,"orientation":"horizontal"}))
check("Executable definition create 201",created.get("status")==201,created)
automation=created["data"]["data"]; automation_id=automation["id"]; v1_etag=automation["eTag"]
check("Executable definition is v1",automation["version"]==1,automation)

run_route=f"/helpdesk/automation/{automation_id}/runs"
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} Run History ready",nav(c,run_route))
    check(f"{width} P10 title","Run History" in body(c))
    check(f"{width} run launcher visible",c.ev("!!document.querySelector('.automation-run-launcher')") is True)
    check(f"{width} no overflow",no_overflow(c))
    c.shot(f"{width}__run-history-empty-en.png")

c.viewport(1366); nav(c,run_route)
check(
    "Ticket option loaded in UI",
    bool(wait(c, """(()=>{const e=document.querySelector('.automation-run-launcher select');return !!e&&[...e.options].some(x=>x.value===%s)})()""" % json.dumps(ticket_id), 10)),
)
check("Ticket context selected in UI",bool(set_select(c,ticket_id)))
check(
    "Run Automation enabled",
    bool(wait(c, """(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Run Automation');return !!b&&!b.disabled})()""", 8)),
)
check("Run Automation dispatched",bool(click_text(c,"Run Automation")))
run_id=wait(c,"new URLSearchParams(location.search).get('run')||''",10) or ""
check("Run query selection appears",run_id.startswith("run_"),run_id)

def get_run():
    if not run_id:
        return {"status":0,"data":{"status":"missing-run-id"}}
    return api(c,"""const r=await fetch('/api/v1/helpdesk/automations/%s/runs/%s',{headers});return {status:r.status,data:r.ok?(await r.json()).data:await r.json()};""" % (automation_id,run_id))

deadline=time.time()+20
run=None
while time.time()<deadline:
    run=get_run()
    if run.get("status")==200 and isinstance(run.get("data"),dict) and run["data"].get("status") in ("completed","failed"):
        break
    time.sleep(.25)
check("Run reaches completed",run and run.get("status")==200 and run.get("data",{}).get("status")=="completed",run)
detail=(run or {}).get("data",{})
check("Run pinned workflow version v1",detail.get("workflowVersion")==1,detail.get("workflowVersion"))
snapshot=detail.get("definitionSnapshot",{})
steps=detail.get("steps",[])
check("Run snapshot pinned v1",snapshot.get("workflowVersion")==1,snapshot)
check("Run snapshot owner helpdesk",snapshot.get("ownerModule")=="helpdesk",snapshot)
check("Run persisted four steps",len(steps)==4,steps)
check("All execution steps completed",len(steps)==4 and all(x.get("status")=="completed" for x in steps),steps)
check("Wait step persisted",any(x.get("catalogKey")=="workflow.wait" for x in steps),steps)
check("Assign Team step persisted",any(x.get("catalogKey")=="helpdesk.ticket.assign_team" for x in steps),steps)
check("Completed node ids preserved",set(detail.get("completedNodeIds",[]))=={"trigger","assignment","wait","end"},detail.get("completedNodeIds",[]))

assigned=api(c,"""const r=await fetch('/api/v1/helpdesk/tickets/%s',{headers});return (await r.json()).data;""" % ticket_id)
check("Real ticket side effect applied",assigned.get("team")=="QA Automation Team",assigned.get("team"))

# Save a new immutable version after the run, then prove the run snapshot remains v1.
v2=api(c,"""
 const r=await fetch('/api/v1/helpdesk/automations/%s',{method:'PUT',headers:{...headers,'Content-Type':'application/json','If-Match':%s},body:JSON.stringify(%s)});
 return {status:r.status,data:await r.json()};
""" % (automation_id,json.dumps(v1_etag),json.dumps({"name":name+" v2","nodes":nodes,"edges":edges,"orientation":"horizontal"})))
check("Definition updates to v2",v2["status"]==200 and v2["data"]["data"]["version"]==2,v2)
v2_data=v2["data"]["data"]
after_v2=get_run()["data"]
check("Existing run stays on v1 after definition v2",after_v2["workflowVersion"]==1 and after_v2["definitionSnapshot"]["name"]==name,after_v2["definitionSnapshot"])

# Remove team configuration in v3; enqueue must reject before worker side effects.
invalid_nodes=json.loads(json.dumps(nodes))
invalid_nodes[1]["configuration"]={}
v3=api(c,"""
 const r=await fetch('/api/v1/helpdesk/automations/%s',{method:'PUT',headers:{...headers,'Content-Type':'application/json','If-Match':%s},body:JSON.stringify(%s)});
 return {status:r.status,data:await r.json()};
""" % (automation_id,json.dumps(v2_data["eTag"]),json.dumps({"name":name+" v3 invalid","nodes":invalid_nodes,"edges":edges,"orientation":"horizontal"})))
check("Definition updates to invalid v3 draft",v3["status"]==200 and v3["data"]["data"]["version"]==3,v3)
v3_data=v3["data"]["data"]
invalid_start=api(c,"""
 const r=await fetch('/api/v1/helpdesk/automations/%s/runs',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({input:{ticketId:%s}})});
 return {status:r.status,data:await r.json()};
""" % (automation_id,json.dumps(ticket_id)))
check("Missing team rejected before enqueue",invalid_start["status"]==422 and invalid_start["data"].get("code")=="HELPDESK_TEAM_REQUIRED",invalid_start)

# A migrated legacy Condition graph must not fake branch execution.
legacy=api(c,"""const r=await fetch('/api/v1/helpdesk/automations?page=1&pageSize=100',{headers});const d=await r.json();return (d.items||[]).find(x=>x.name==='Route Network / VPN by skill')||null;""")
check("Migrated legacy definition available",bool(legacy),legacy)
legacy_start=api(c,"""
 const r=await fetch('/api/v1/helpdesk/automations/%s/runs',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({input:{ticketId:%s}})});
 return {status:r.status,data:await r.json()};
""" % (legacy["id"],json.dumps(ticket_id)))
check("Condition graph rejected explicitly",legacy_start["status"]==422 and legacy_start["data"].get("code")=="AUTOMATION_BRANCHING_NOT_SUPPORTED",legacy_start)

history=api(c,"""const r=await fetch('/api/v1/helpdesk/automations/%s/runs?page=1&pageSize=25',{headers});return {status:r.status,data:await r.json()};""" % automation_id)
check("Run history list returns persisted run",history["status"]==200 and any(x["id"]==run_id for x in history["data"]["items"]),history)

# English completed evidence.
nav(c,run_route+"?run="+run_id)
check("Completed run renders English status",bool(wait(c,"document.body.innerText.includes('Completed')",8)))
check(
    "English run detail steps loaded",
    bool(wait(c,"document.querySelectorAll('.automation-run-step').length===4",8)),
)
c.shot("1366__run-history-completed-en.png")

# Thai runtime status and snapshot labels.
check("Switch user locale to Thai",set_profile_locale(c,"th-TH").get("status")==200)
c.navigate("http://localhost:5180"+run_route+"?run="+run_id)
check("Thai Run History ready",bool(wait(c,"document.body.innerText.includes('ประวัติการทำงาน')",12)))
check("Thai completed status visible",bool(wait(c,"document.body.innerText.includes('สำเร็จ')",8)))
check("Thai document language",c.ev("document.documentElement.lang")=="th",c.ev("document.documentElement.lang"))
check("Thai run page no overflow",no_overflow(c))
c.shot("1366__run-history-completed-th.png")

# Restore ticket assignment before cleanup.
current_ticket=api(c,"""const r=await fetch('/api/v1/helpdesk/tickets/%s',{headers});return (await r.json()).data;""" % ticket_id)
restore=api(c,"""
 const r=await fetch('/api/v1/helpdesk/tickets/%s/assignment',{method:'POST',headers:{...headers,'Content-Type':'application/json','If-Match':%s},body:JSON.stringify(%s)});
 return {status:r.status,data:await r.json()};
""" % (ticket_id,json.dumps(current_ticket["eTag"]),json.dumps({"assigneeUserId":original_assignee,"team":original_team,"note":"Step45G QA restore"})))
check("Ticket assignment restored",restore["status"]==200,restore)

restored_ticket=api(c,"""const r=await fetch('/api/v1/helpdesk/tickets/%s',{headers});return (await r.json()).data;""" % ticket_id)
check("Ticket team restored",restored_ticket.get("team")==original_team,(restored_ticket.get("team"),original_team))
check("Ticket assignee restored",(restored_ticket.get("assignee") or {}).get("id")==original_assignee,((restored_ticket.get("assignee") or {}).get("id"),original_assignee))

deleted=api(c,"""const r=await fetch('/api/v1/helpdesk/automations/%s',{method:'DELETE',headers:{...headers,'If-Match':%s}});return r.status;""" % (automation_id,json.dumps(v3_data["eTag"])))
check("QA definition soft-delete returns 204",deleted==204,deleted)

restore_default=set_admin_locale(c,original_default)
check("Restore organization locale",restore_default.get("status")==200,restore_default)
restore_profile=set_profile_locale(c,original_pref)
check("Restore user locale preference",restore_profile.get("status")==200,restore_profile)

print(f"step45g_browser_checks={checks}")
print(f"step45g_browser_failures={len(failures)}")
print(f"step45g_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
