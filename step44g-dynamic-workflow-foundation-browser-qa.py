from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step44g-dynamic-workflow-foundation"
PORT=9241
REALM=ROOT/"production/infrastructure/docker/keycloak/realm-inno-one.json"
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
        targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=3).json()
        t=next(x for x in targets if x.get("type")=="page")
        self.ws=websocket.create_connection(t["webSocketDebuggerUrl"],timeout=10,origin="http://127.0.0.1")
        self.n=0
        self.call("Page.enable")
        self.call("Runtime.enable")
    def call(self,m,p=None):
        self.n+=1
        i=self.n
        self.ws.send(json.dumps({"id":i,"method":m,"params":p or {}}))
        while True:
            r=json.loads(self.ws.recv())
            if r.get("id")==i:
                return r.get("result",{})
    def ev(self,x):
        return self.call("Runtime.evaluate",{"expression":x,"returnByValue":True,"awaitPromise":True}).get("result",{}).get("value")
    def viewport(self,w,h=900):
        self.call("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":False})
    def shot(self,name):
        data=self.call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
        (OUT/name).write_bytes(base64.b64decode(data))

def wait(c,expr,timeout=15):
    end=time.time()+timeout
    while time.time()<end:
        try:
            value=c.ev(expr)
            if value:
                return value
        except Exception:
            pass
        time.sleep(.1)
    return None

def nav(c,route,selector):
    c.ev("history.pushState({},''," + json.dumps(route) + ");window.dispatchEvent(new PopStateEvent('popstate'));true")
    return bool(wait(c,"location.pathname===" + json.dumps(route.split('#')[0]) + " && !!document.querySelector(" + json.dumps(selector) + ")",20))

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True
c=CDP()
c.viewport(1366)
check("authenticated production session",
      bool(wait(c,"location.href.startsWith('http://localhost:5180') && !!document.querySelector('.inno-production-shell')",5)),
      c.ev("location.href") or "")

for w in WIDTHS:
    c.viewport(w)
    check(f"{w} design system ready",nav(c,"/internal/design-system#workflow",".internal-ds-page"))
    check(f"{w} workflow section present",bool(wait(c,"!!document.querySelector('#workflow')",6)))
    check(f"{w} React Flow canvas mounted",bool(wait(c,"!!document.querySelector('#workflow [data-inno-workflow-canvas] .react-flow')",8)))
    counts=wait(c,"(()=>{const nodes=document.querySelectorAll('#workflow .react-flow__node').length;const edges=document.querySelectorAll('#workflow .react-flow__edge').length;return nodes>=6&&edges>=6?{nodes,edges}:null})()",8)
    check(f"{w} branching nodes render",bool(counts and counts.get("nodes",0)>=6),counts or "")
    check(f"{w} branching edges render",bool(counts and counts.get("edges",0)>=6),counts or "")
    check(f"{w} palette present",c.ev("""!!document.querySelector('#workflow [aria-label="Workflow node palette"]')""") is True)
    check(f"{w} properties present",c.ev("""!!document.querySelector('#workflow [aria-label="Selected workflow node properties"]')""") is True)
    check(f"{w} no document overflow",no_overflow(c))
    if w in (1366,768):
        c.ev("document.querySelector('#workflow')?.scrollIntoView({block:'start'});true")
        time.sleep(.2)
        c.shot(f"{w}__workflow-foundation.png")

c.viewport(1366)
check("workflow ready for selection",nav(c,"/internal/design-system#workflow",".internal-ds-page"))
check("assignment node ready",bool(wait(c,"""!!document.querySelector('#workflow .react-flow__node[data-id="assignment"]')""",8)))
clicked=c.ev("""(()=>{const n=document.querySelector('#workflow .react-flow__node[data-id="assignment"]');if(!n)return false;n.click();return true})()""")
check("assignment node click dispatched",bool(clicked))
check("properties follow selected node",bool(wait(c,"document.querySelector('#workflow .internal-ds-workflow-properties input')?.value==='Assign IT Operations'",5)))
before=c.ev("document.querySelectorAll('#workflow .react-flow__node').length") or 0
added=c.ev("""(()=>{const b=[...document.querySelectorAll('#workflow [aria-label="Workflow node palette"] button')].find(x=>(x.textContent||'').trim()==='Wait');if(!b)return false;b.click();return true})()""")
check("palette add action dispatched",bool(added))
check("palette adds workflow node",bool(wait(c,f"document.querySelectorAll('#workflow .react-flow__node').length>{before}",8)))
check("new node becomes selected",bool(wait(c,"document.querySelector('#workflow .internal-ds-workflow-properties input')?.value==='Wait'",5)))

check("helpdesk simple rule ready",nav(c,"/helpdesk/automation/new",".inno-page"))
check("helpdesk simple rule remains non-canvas",c.ev("!document.querySelector('[data-inno-workflow-canvas]')") is True)
helpdesk_text=c.ev("(document.querySelector('.inno-page')?.innerText||'')")
check("helpdesk simple rule still Trigger Condition Action",all(x in (helpdesk_text or "") for x in ["Trigger","Condition","Action"]))

print("step44g_browser_checks="+str(checks))
print("step44g_browser_failures="+str(len(failures)))
print("step44g_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for name,detail in failures:
    print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
