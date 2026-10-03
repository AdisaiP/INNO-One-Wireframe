from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45b-dynamic-workflow-product-ia"
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
            if "172.10.1.58:8080" in href and c.ev("!!document.querySelector('#kc-login')"):
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
      const page=document.querySelector('.inno-page,.workspace-home-page');
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

# Normal launcher must remain honest: Workflow is not available there.
check("Apps launcher ready",nav(c,"/apps"))
apps_text=body(c)
check("Dynamic Workflows absent from normal Apps launcher","Dynamic Workflows" not in apps_text)
check("Apps launcher has no Workflow link",c.ev("""!document.querySelector('a[href="/workflows"]')""") is True)

# Admin registry may expose the future manifest as Available, but not as installed/launcher.
check("Admin Apps ready",nav(c,"/admin/apps"))
admin_text=body(c)
check("Admin registry knows Dynamic Workflows","Dynamic Workflows" in admin_text)
check("Admin registry has no fake Install action",c.ev("""![...document.querySelectorAll('button,a')].some(x=>(x.textContent||'').trim()==='Install')""") is True)

# P02 list and P06 new builder across canonical widths.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} workflow list ready",nav(c,"/workflows"))
    txt=body(c)
    check(f"{width} workflow list title","Dynamic Workflows" in txt)
    check(f"{width} workflow list declares session boundary","UI foundation preview" in txt and "session" in txt.lower())
    check(f"{width} workflow list starts empty","No session workflow drafts" in txt)
    check(f"{width} workflow list has create action","New Workflow" in txt)
    check(f"{width} workflow context nav mounted",c.ev("""!!document.querySelector('.prod-side[aria-label="Dynamic Workflows navigation"]')""") is True)
    check(f"{width} workflow list no page overflow",no_overflow(c))
    check(f"{width} normal rail still has no workflow link",c.ev("""!document.querySelector('.prod-rail a[href="/workflows"]')""") is True)
    c.shot(f"{width}__workflows-list.png")

    check(f"{width} workflow builder ready",nav(c,"/workflows/new"))
    txt=body(c)
    check(f"{width} workflow builder title","New Workflow" in txt)
    check(f"{width} workflow builder has palette",c.ev("""!!document.querySelector('[aria-label="Workflow node palette"]')""") is True)
    check(f"{width} workflow builder has canvas",c.ev("!!document.querySelector('[data-inno-workflow-canvas]')") is True)
    check(f"{width} workflow builder has properties",c.ev("""!!document.querySelector('[aria-label="Workflow properties"]')""") is True)
    check(f"{width} workflow builder declares no persistence","No server persistence or execution in Step 45B" in txt)
    check(f"{width} workflow builder has no Publish action",c.ev("""![...document.querySelectorAll('button,a')].some(x=>(x.textContent||'').trim().startsWith('Publish'))""") is True)
    check(f"{width} workflow builder has no Run Workflow","Run Workflow" not in txt)
    check(f"{width} workflow builder no page overflow",no_overflow(c))
    check(f"{width} Keep in Session initially disabled",c.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Keep in Session');return !!b&&b.disabled})()""") is True)
    c.shot(f"{width}__workflow-builder-new.png")

# Interaction proof on desktop in one SPA session.
c.viewport(1366)
check("interaction builder ready",nav(c,"/workflows/new"))
initial_nodes=c.ev("document.querySelectorAll('[data-workflow-node-kind]').length") or 0
check("starter graph has three nodes",initial_nodes==3,initial_nodes)
check("Condition palette action dispatched",bool(click_text(c,"Condition")))
check("palette add increases canvas nodes",bool(wait(c,"document.querySelectorAll('[data-workflow-node-kind]').length===4",5)))
check("selected Condition properties visible","Condition" in body(c))
check("workflow name input populated",bool(set_input(c,"Workflow name","QA Critical Approval")))
check("Keep in Session enables",bool(wait(c,"""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Keep in Session');return !!b&&!b.disabled})()""",5)))
check("Keep in Session dispatched",bool(click_text(c,"Keep in Session")))
draft_path=wait(c,"location.pathname.startsWith('/workflows/session_') ? location.pathname : ''",6) or ""
check("session draft navigates to edit route",bool(draft_path),draft_path)
edit_text=body(c)
check("edit route shows Update Session Draft","Update Session Draft" in edit_text)
check("edit route preserves workflow name","QA Critical Approval" in edit_text)
check("edit route preserves added node",c.ev("document.querySelectorAll('[data-workflow-node-kind]').length===4") is True)
c.shot("1366__workflow-builder-session-edit.png")

check("Back to Workflows dispatched",bool(click_text(c,"Back to Workflows")))
check("returns to workflow list",bool(wait(c,"location.pathname==='/workflows'",5)))
list_text=body(c)
check("session draft appears in list","QA Critical Approval" in list_text)
check("session draft row status shown","Session draft" in list_text)
check("workflow list has one row",c.ev("document.querySelectorAll('.workflow-list-collection tbody tr').length===1") is True)
c.shot("1366__workflows-list-with-session-draft.png")

check("session draft row Open dispatched",c.ev("""(()=>{const b=document.querySelector('.workflow-list-collection tbody .inno-row-action');if(!b)return false;b.click();return true})()""") is True)
check("row Open returns to session edit route",bool(wait(c,"location.pathname.startsWith('/workflows/session_')",5)))
check("row Open preserves session name","QA Critical Approval" in body(c))

# Invalid session ID must fail honestly rather than fabricate data.
check("invalid workflow draft route ready",nav(c,"/workflows/session_missing"))
invalid_text=body(c)
check("invalid draft reports unavailable","Workflow draft unavailable" in invalid_text and "Session draft not found" in invalid_text)
check("invalid draft does not fabricate persisted resource","Update Session Draft" not in invalid_text)
c.shot("1366__workflow-builder-missing-session.png")

print(f"step45b_browser_checks={checks}")
print(f"step45b_browser_failures={len(failures)}")
print(f"step45b_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
