from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45c-dynamic-workflow-persistence"
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
        failures.append((name, detail))

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
            if ("172.10.1.58:8080" in href or "localhost:8080" in href) and c.ev("!!document.querySelector('#kc-login')"):
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

def nav(c,route):
    c.navigate("http://localhost:5180"+route)
    ready=wait(c,"""(()=> {
      const shell=document.querySelector('.inno-production-shell');
      const page=document.querySelector('.inno-page,.workspace-home-page,.page-error-wrap');
      return !!shell && !!page && !document.querySelector('.page-loading-wrap,.boot-screen');
    })()""",20)
    if ready: time.sleep(.25)
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

c=CDP()
c.viewport(1366)
check("Keycloak login completes",login(c),c.ev("location.href") or "")

check("Apps launcher ready",nav(c,"/apps"))
check("Apps launcher data loaded",bool(wait(c,"document.querySelectorAll('.production-app-card').length>=4",8)))
apps_text=body(c)
check("Dynamic Workflows appears in normal Apps launcher","Dynamic Workflows" in apps_text)
check("Apps launcher has Workflow link",c.ev("""!!document.querySelector('a[href="/workflows"]')""") is True)

check("Admin Apps ready",nav(c,"/admin/apps"))
admin_text=body(c)
check("Admin registry knows Dynamic Workflows","Dynamic Workflows" in admin_text)

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} workflow list ready",nav(c,"/workflows"))
    txt=body(c)
    check(f"{width} workflow list title","Dynamic Workflows" in txt)
    check(f"{width} workflow list declares persisted boundary","Persisted definitions" in txt)
    check(f"{width} workflow list has no session-only copy","session draft" not in txt.lower())
    check(f"{width} workflow list has create action","New Workflow" in txt)
    check(f"{width} workflow list no page overflow",no_overflow(c))
    c.shot(f"{width}__workflows-list.png")

    check(f"{width} workflow builder ready",nav(c,"/workflows/new"))
    txt=body(c)
    check(f"{width} workflow builder title","New Workflow" in txt)
    check(f"{width} workflow builder has palette",c.ev("""!!document.querySelector('[aria-label="Workflow node palette"]')""") is True)
    check(f"{width} workflow builder has canvas",c.ev("!!document.querySelector('[data-inno-workflow-canvas]')") is True)
    check(f"{width} workflow builder has properties",c.ev("""!!document.querySelector('[aria-label="Workflow properties"]')""") is True)
    check(f"{width} workflow builder declares persistence","Persisted definition" in txt and "ETag" in txt)
    check(f"{width} workflow builder has no Publish control",c.ev("""![...document.querySelectorAll('button,a')].some(x=>(x.textContent||'').trim()==='Publish')""") is True)
    check(f"{width} workflow builder has no Run control",c.ev("""![...document.querySelectorAll('button,a')].some(x=>(x.textContent||'').includes('Run Workflow'))""") is True)
    check(f"{width} workflow builder no page overflow",no_overflow(c))
    check(f"{width} Create Workflow initially disabled",c.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Create Workflow');return !!b&&b.disabled})()""") is True)
    c.shot(f"{width}__workflow-builder-new.png")

c.viewport(1366)
check("interaction builder ready",nav(c,"/workflows/new"))
initial_nodes=c.ev("document.querySelectorAll('[data-workflow-node-kind]').length") or 0
check("starter graph has three nodes",initial_nodes==3,initial_nodes)
check("Condition palette action dispatched",bool(click_text(c,"Condition")))
check("palette add increases canvas nodes",bool(wait(c,"document.querySelectorAll('[data-workflow-node-kind]').length===4",5)))
name="QA Persisted Approval "+str(int(time.time()))
check("workflow name input populated",bool(set_input(c,"Workflow name",name)))
check("Create Workflow enables",bool(wait(c,"""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Create Workflow');return !!b&&!b.disabled})()""",5)))
check("Create Workflow dispatched",bool(click_text(c,"Create Workflow")))
workflow_path=wait(c,"location.pathname.startsWith('/workflows/wf_') ? location.pathname : ''",8) or ""
check("persisted workflow navigates to resource route",bool(workflow_path),workflow_path)
check("created workflow shows version 1","Version 1" in body(c))
check("created workflow preserves four nodes",c.ev("document.querySelectorAll('[data-workflow-node-kind]').length===4") is True)
c.shot("1366__workflow-created-v1.png")

check("list reload ready",nav(c,"/workflows"))
check("persisted workflow appears in list",name in body(c))
check("persisted workflow list shows v1","v1" in body(c))
c.shot("1366__workflows-list-persisted.png")

check("full navigation reopens persisted workflow",nav(c,workflow_path))
check("reopened workflow preserves name",name in body(c))
check("reopened workflow preserves nodes",c.ev("document.querySelectorAll('[data-workflow-node-kind]').length===4") is True)
check("reopened workflow shows Save New Version","Save New Version" in body(c))

name2=name+" v2"
check("updated workflow name input populated",bool(set_input(c,"Workflow name",name2)))
check("Save New Version dispatched",bool(click_text(c,"Save New Version")))
check("version increments to 2",bool(wait(c,"document.body.innerText.includes('Version 2')",8)))
check("updated workflow name rendered",name2 in body(c))
c.shot("1366__workflow-updated-v2.png")

api_probe=c.ev("""(async()=> {
  const auth=await import('/src/auth/keycloak.ts');
  const token=await auth.getAccessToken();
  const path=location.pathname.replace('/workflows/','');
  const getResp=await fetch('/api/v1/workflows/'+encodeURIComponent(path),{headers:{Authorization:'Bearer '+token}});
  const data=await getResp.json();
  const payload={name:data.data.name,nodes:data.data.nodes,edges:data.data.edges,orientation:data.data.orientation};
  const stale=await fetch('/api/v1/workflows/'+encodeURIComponent(path),{
    method:'PUT',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','If-Match':'"v1"'},
    body:JSON.stringify(payload)
  });
  const versions=await fetch('/api/v1/workflows/'+encodeURIComponent(path)+'/versions',{headers:{Authorization:'Bearer '+token}});
  const versionsJson=await versions.json();
  return {staleStatus:stale.status,versionsStatus:versions.status,versionCount:versionsJson.items?.length||0,topVersion:versionsJson.items?.[0]?.version||0};
})()""")
check("stale ETag update returns 412",api_probe.get("staleStatus")==412,api_probe)
check("version history endpoint returns 200",api_probe.get("versionsStatus")==200,api_probe)
check("version history contains two snapshots",api_probe.get("versionCount")>=2,api_probe)
check("version history newest is v2",api_probe.get("topVersion")==2,api_probe)

delete_probe=c.ev("""(async()=> {
  const auth=await import('/src/auth/keycloak.ts');
  const token=await auth.getAccessToken();
  const id=%s.split('/').pop();
  const del=await fetch('/api/v1/workflows/'+encodeURIComponent(id),{
    method:'DELETE',
    headers:{Authorization:'Bearer '+token,'If-Match':'"v2"'}
  });
  const after=await fetch('/api/v1/workflows/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token}});
  return {deleteStatus:del.status,getAfterDelete:after.status};
})()""" % json.dumps(workflow_path))
check("delete persisted workflow returns 204",delete_probe.get("deleteStatus")==204,delete_probe)
check("deleted workflow becomes unavailable",delete_probe.get("getAfterDelete")==404,delete_probe)
check("list reload after delete ready",nav(c,"/workflows"))
check("deleted workflow disappears from list",name2 not in body(c))

check("invalid persisted workflow route ready",nav(c,"/workflows/wf_00000000000000000000000000000000"))
invalid=body(c)
check("invalid persisted workflow reports error","Unable to load content" in invalid and "Try again" in invalid)
check("invalid workflow does not fabricate editor","Save New Version" not in invalid)

print(f"step45c_browser_checks={checks}")
print(f"step45c_browser_failures={len(failures)}")
print(f"step45c_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
