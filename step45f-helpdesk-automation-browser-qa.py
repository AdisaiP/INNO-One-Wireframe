from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45f-helpdesk-automation"
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
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
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
        if not targets:
            raise RuntimeError("Chrome DevTools target unavailable")
        page=next(x for x in targets if x.get("type")=="page")
        self.ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=10,origin="http://127.0.0.1")
        self.n=0
        self.call("Page.enable")
        self.call("Runtime.enable")
    def call(self,method,params=None):
        self.n+=1
        ident=self.n
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
    def navigate(self,url):
        self.call("Page.navigate",{"url":url})
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
        try:
            href=c.ev("location.href") or ""
            if any(host in href for host in ("172.10.1.58:8080","localhost:8080","127.0.0.1:8080")) and c.ev("!!document.querySelector('#kc-login')"):
                c.ev(
                    "document.querySelector('#username').value="+json.dumps("adisai")
                    +";document.querySelector('#password').value="+json.dumps(password)
                    +";document.querySelector('#kc-login').click();true"
                )
                time.sleep(.5)
            if href.startswith("http://localhost:5180") and wait(c,"!!document.querySelector('.inno-production-shell')",2):
                return True
        except Exception:
            pass
        time.sleep(.2)
    return False

def nav(c,route,expected=None):
    c.navigate("http://localhost:5180"+route)
    time.sleep(.4)
    expected=expected or route
    ready=wait(c,"""(()=> {
      const shell=document.querySelector('.inno-production-shell');
      const page=document.querySelector('.inno-page,.workspace-home-page,.page-error-wrap');
      return location.pathname===%s && document.readyState==='complete' && !!shell && !!page && !document.querySelector('.page-loading-wrap,.boot-screen');
    })()""" % json.dumps(expected),20)
    if ready: time.sleep(.35)
    return bool(ready)

def body(c):
    return c.ev("document.body.innerText") or ""

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

def click_text(c,text_value):
    return c.ev("""(()=>{const t=%s;const e=[...document.querySelectorAll('button,a')].find(x=>(x.textContent||'').trim()===t);if(!e)return false;e.click();return true})()""" % json.dumps(text_value))

def set_input(c,label_text,value):
    return c.ev("""(()=> {
      const label=[...document.querySelectorAll('label')].find(x=>x.querySelector(':scope > span')?.textContent.trim()===%s);
      const input=label?.querySelector('input,textarea');
      if(!input)return false;
      const proto=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set;
      setter.call(input,%s);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return true;
    })()""" % (json.dumps(label_text),json.dumps(value)))

def api(c,script):
    return c.ev("""(async()=> {
      const auth=await import('/src/auth/keycloak.ts');
      const token=await auth.getAccessToken();
      const headers={Authorization:'Bearer '+token};
      %s
    })()""" % script)

def profile_state(c):
    return api(c,"""
      const p=await fetch('/api/v1/platform/me',{headers});
      return (await p.json()).data;
    """)

def admin_settings(c):
    return api(c,"""
      const r=await fetch('/api/v1/admin/settings',{headers});
      return await r.json();
    """)

def set_profile_locale(c,preferred):
    payload={"useOrganizationDefault": True} if preferred is None else {"preferredLocale":preferred}
    return api(c,"""
      const r=await fetch('/api/v1/platform/me/profile',{
        method:'PATCH',
        headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify(%s)
      });
      return {status:r.status,data:await r.json()};
    """ % json.dumps(payload))

def set_admin_locale(c,locale):
    return api(c,"""
      const current=await (await fetch('/api/v1/admin/settings',{headers})).json();
      if(current.localization.defaultLocale===%s) return {status:200,data:current.localization};
      const r=await fetch('/api/v1/admin/settings/localization',{
        method:'PATCH',
        headers:{...headers,'Content-Type':'application/json','If-Match':current.localization.eTag},
        body:JSON.stringify({defaultLocale:%s})
      });
      return {status:r.status,data:await r.json()};
    """ % (json.dumps(locale),json.dumps(locale)))

c=CDP()
c.viewport(1366)
check("Keycloak login completes",login(c),c.ev("location.href") or "")

original_profile=profile_state(c)
original_settings=admin_settings(c)
original_pref=original_profile.get("preferredLocale")
original_default=original_settings["localization"]["defaultLocale"]

set_admin_locale(c,"en-US")
set_profile_locale(c,None)
c.navigate("http://localhost:5180/helpdesk/automation")
check("English Helpdesk Automation ready",bool(wait(c,"location.pathname==='/helpdesk/automation' && document.body.innerText.includes('Automation')",15)))

check("Apps launcher ready",nav(c,"/apps"))
apps_text=body(c)
check("Dynamic Workflows absent from Apps launcher","Dynamic Workflows" not in apps_text)
check("Automation Core absent from Apps launcher","Automation Core" not in apps_text)
check("No standalone workflow launcher link",c.ev("""!document.querySelector('a[href="/workflows"]')""") is True)

check("Admin Apps ready",nav(c,"/admin/apps"))
admin_text=body(c)
check("Admin registry exposes technical Automation Core","Automation Core" in admin_text)
check("Admin registry no longer names Dynamic Workflows","Dynamic Workflows" not in admin_text)

check("Legacy browser route redirects into Helpdesk",nav(c,"/workflows","/helpdesk/automation"))
check("Redirect target is Helpdesk Automation","Automation" in body(c))

legacy_state=api(c,"""
  const list=await (await fetch('/api/v1/helpdesk/automations?page=1&pageSize=100',{headers})).json();
  return list;
""")
check("Helpdesk automation API returns items",isinstance(legacy_state.get("items"),list),legacy_state)
check("Every listed definition is Helpdesk-owned",all(x.get("ownerModule")=="helpdesk" for x in legacy_state.get("items",[])),legacy_state.get("items",[]))
legacy_names={x.get("name") for x in legacy_state.get("items",[])}
if {"Route Network / VPN by skill","P1 three-level escalation","After-hours queue routing"} & legacy_names:
    check("Legacy Step18 rules migrated into visual definitions",
          {"Route Network / VPN by skill","P1 three-level escalation","After-hours queue routing"}.issubset(legacy_names),
          sorted(legacy_names))

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} automation list ready",nav(c,"/helpdesk/automation"))
    txt=body(c)
    check(f"{width} automation list title","Automation" in txt)
    check(f"{width} automation list is Helpdesk-owned","Helpdesk-owned" in txt)
    check(f"{width} boundary uses shared flex spacing",c.ev("""(()=>{const e=document.querySelector('.workflow-product-boundary');if(!e)return false;const s=getComputedStyle(e);return s.display==='flex' && parseFloat(s.gap)>0})()""") is True)
    check(f"{width} automation list no overflow",no_overflow(c))
    c.shot(f"{width}__helpdesk-automation-list-en.png")

    check(f"{width} automation builder ready",nav(c,"/helpdesk/automation/new"))
    txt=body(c)
    check(f"{width} builder title","New Automation" in txt)
    check(f"{width} shared React Flow canvas",c.ev("!!document.querySelector('[data-inno-workflow-canvas]')") is True)
    check(f"{width} Helpdesk palette",c.ev("""!!document.querySelector('[aria-label="Helpdesk Steps"]')""") is True)
    check(f"{width} properties panel",c.ev("""!!document.querySelector('[aria-label="Properties"]')""") is True)
    check(f"{width} Ticket Created catalog visible","Ticket Created" in txt)
    check(f"{width} Manager Approval catalog visible","Manager Approval" in txt)
    check(f"{width} AI not exposed by Helpdesk catalog",not any((x or "").strip()=="AI" for x in c.ev("""[...document.querySelectorAll('.workflow-builder-palette-items button')].map(x=>x.textContent)""") or []))
    check(f"{width} Subflow not exposed by Helpdesk catalog","Subflow" not in [x.strip() for x in (c.ev("""[...document.querySelectorAll('.workflow-builder-palette-items button')].map(x=>x.textContent)""") or [])])
    check(f"{width} no Publish control",c.ev("""![...document.querySelectorAll('button,a')].some(x=>(x.textContent||'').trim()==='Publish')""") is True)
    check(f"{width} no Run control",c.ev("""![...document.querySelectorAll('button,a')].some(x=>(x.textContent||'').includes('Run Workflow'))""") is True)
    check(f"{width} builder no overflow",no_overflow(c))
    c.shot(f"{width}__helpdesk-automation-builder-en.png")

c.viewport(1366)
check("Interaction builder ready",nav(c,"/helpdesk/automation/new"))
initial_nodes=c.ev("document.querySelectorAll('[data-workflow-node-kind]').length") or 0
check("Starter graph has three nodes",initial_nodes==3,initial_nodes)
check("Ticket Condition palette dispatched",bool(click_text(c,"Ticket Condition")))
check("Palette add increases nodes",bool(wait(c,"document.querySelectorAll('[data-workflow-node-kind]').length===4",5)))
name="QA Helpdesk Visual Automation "+str(int(time.time()))
check("Automation name populated",bool(set_input(c,"Automation name",name)))
check("Create Automation enables",bool(wait(c,"""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Create Automation');return !!b&&!b.disabled})()""",5)))
check("Create Automation dispatched",bool(click_text(c,"Create Automation")))
automation_path=wait(c,"location.pathname.startsWith('/helpdesk/automation/wf_') ? location.pathname : ''",10) or ""
check("Create navigates to Helpdesk-owned resource",bool(automation_path),automation_path)
automation_id=automation_path.rsplit("/",1)[-1] if automation_path else ""

created=api(c,"""
  const id=%s;
  const r=await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(id),{headers});
  return {status:r.status,data:r.status===200?(await r.json()).data:null};
""" % json.dumps(automation_id))
check("Created definition API returns 200",created.get("status")==200,created)
check("Created definition owner is helpdesk",created.get("data",{}).get("ownerModule")=="helpdesk",created)
check("Created definition is v1",created.get("data",{}).get("version")==1,created)
check("Created definition persisted four nodes",len(created.get("data",{}).get("nodes",[]))==4,created.get("data",{}).get("nodes",[]))
v1_etag=created.get("data",{}).get("eTag","")

isolation=api(c,"""
  const id=%s;
  const generic=await fetch('/api/v1/workflows/'+encodeURIComponent(id),{headers});
  const genericList=await (await fetch('/api/v1/workflows?page=1&pageSize=100',{headers})).json();
  return {getStatus:generic.status,inList:(genericList.items||[]).some(x=>x.id===id)};
""" % json.dumps(automation_id))
check("Generic workflow facade cannot GET Helpdesk definition",isolation.get("getStatus")==404,isolation)
check("Generic workflow list excludes Helpdesk definition",isolation.get("inList") is False,isolation)

check("Persisted definition reopens",nav(c,automation_path))
check("Persisted name survives navigation",name in body(c))
check("Persisted node count survives navigation",(c.ev("document.querySelectorAll('[data-workflow-node-kind]').length") or 0)==4)
check("Save New Version dispatched",bool(click_text(c,"Save New Version")))
check("Version 2 appears",bool(wait(c,"document.body.innerText.includes('Version 2')",8)))

updated=api(c,"""
  const id=%s;
  const r=await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(id),{headers});
  return {status:r.status,data:(await r.json()).data};
""" % json.dumps(automation_id))
check("Updated definition is v2",updated.get("data",{}).get("version")==2,updated)
v2_etag=updated.get("data",{}).get("eTag","")

stale=api(c,"""
  const id=%s;
  const payload=%s;
  const r=await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(id),{
    method:'PUT',
    headers:{...headers,'Content-Type':'application/json','If-Match':%s},
    body:JSON.stringify(payload)
  });
  return r.status;
""" % (
    json.dumps(automation_id),
    json.dumps({
      "name":name,
      "nodes":updated.get("data",{}).get("nodes",[]),
      "edges":updated.get("data",{}).get("edges",[]),
      "orientation":updated.get("data",{}).get("orientation","horizontal"),
    }),
    json.dumps(v1_etag),
))
check("Stale Helpdesk ETag returns 412",stale==412,stale)

versions=api(c,"""
  const id=%s;
  const r=await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(id)+'/versions',{headers});
  return {status:r.status,data:await r.json()};
""" % json.dumps(automation_id))
check("Version history returns 200",versions.get("status")==200,versions)
version_items=versions.get("data",{}).get("items",[])
check("Version history contains at least v1/v2",len(version_items)>=2,version_items)
check("Version history remains Helpdesk-owned",all(x.get("ownerModule")=="helpdesk" for x in version_items),version_items)

check("Switch user locale to Thai",set_profile_locale(c,"th-TH").get("status")==200)
c.navigate("http://localhost:5180/helpdesk/automation")
check("Thai automation list ready",bool(wait(c,"location.pathname==='/helpdesk/automation' && document.body.innerText.includes('ระบบอัตโนมัติ')",12)))
check("Thai automation collection loaded",bool(wait(c,"!!document.querySelector('table') && !document.querySelector('.inno-collection-state.is-loading')",12)))
check("Thai document language",c.ev("document.documentElement.lang")=="th",c.ev("document.documentElement.lang"))
check("Thai list title","ระบบอัตโนมัติ" in body(c))
check("Thai boundary uses shared flex spacing",c.ev("""(()=>{const e=document.querySelector('.workflow-product-boundary');if(!e)return false;const s=getComputedStyle(e);return s.display==='flex' && parseFloat(s.gap)>0})()""") is True)
c.shot("1366__helpdesk-automation-list-th.png")

check("Thai builder ready",nav(c,"/helpdesk/automation/new"))
thai=body(c)
check("Thai builder title","สร้างระบบอัตโนมัติ" in thai)
check("Thai Ticket Created label","สร้างทิกเก็ต" in thai)
check("Thai Assign Team label","มอบหมายทีม" in thai)
check("Thai validation/palette has no page overflow",no_overflow(c))
c.shot("1366__helpdesk-automation-builder-th.png")

delete_result=api(c,"""
  const id=%s;
  const r=await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(id),{
    method:'DELETE',
    headers:{...headers,'If-Match':%s}
  });
  return r.status;
""" % (json.dumps(automation_id),json.dumps(v2_etag)))
check("QA definition delete returns 204",delete_result==204,delete_result)

deleted=api(c,"""
  const id=%s;
  return (await fetch('/api/v1/helpdesk/automations/'+encodeURIComponent(id),{headers})).status;
""" % json.dumps(automation_id))
check("Deleted Helpdesk definition returns 404",deleted==404,deleted)

c.navigate("http://localhost:5180/helpdesk/automation/wf_00000000000000000000000000000000")
check("Invalid Helpdesk definition renders shared error state",bool(wait(c,"document.body.innerText.includes('ไม่สามารถโหลดข้อมูลได้') || document.body.innerText.includes('Unable to load content')",10)))

restore_default=set_admin_locale(c,original_default)
check("Restore organization locale",restore_default.get("status")==200,restore_default)
restore_profile=set_profile_locale(c,original_pref)
check("Restore user locale preference",restore_profile.get("status")==200,restore_profile)

print(f"step45f_browser_checks={checks}")
print(f"step45f_browser_failures={len(failures)}")
print(f"step45f_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
