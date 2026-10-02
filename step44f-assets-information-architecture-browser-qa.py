from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step44f-assets-information-architecture"
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

def nav(c,route):
    c.ev("history.pushState({},''," + json.dumps(route) + ");window.dispatchEvent(new PopStateEvent('popstate'));true")
    return bool(wait(c,"location.pathname===" + json.dumps(route) + " && !!document.querySelector('.inno-page')",20))

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True
c=CDP()
c.viewport(1366)
check("authenticated production session",
      bool(wait(c,"location.href.startsWith('http://localhost:5180') && !!document.querySelector('.inno-production-shell')",5)),
      c.ev("location.href") or "")

for w in WIDTHS:
    c.viewport(w)
    check(f"{w} ownership route ready",nav(c,"/assets/ownership"))
    page_text=c.ev("(document.querySelector('.inno-page')?.innerText||'')")
    check(f"{w} ownership title canonical","Asset Ownership" in (page_text or ""))
    check(f"{w} ownership exposes Asset Owners","Asset Owners" in (page_text or ""))
    check(f"{w} ownership removes generic User Profiles","User Profiles" not in (page_text or ""))
    check(f"{w} ownership no document overflow",no_overflow(c))
    if w in (1366,768):
        c.shot(f"{w}__asset-ownership.png")

for w in WIDTHS:
    c.viewport(w)
    check(f"{w} owners route ready",nav(c,"/assets/owners"))
    page_text=c.ev("(document.querySelector('.inno-page')?.innerText||'')")
    check(f"{w} owners title canonical","Asset Owners" in (page_text or ""))
    check(f"{w} owners generic User Profiles removed","User Profiles" not in (page_text or ""))
    check(f"{w} owners no document overflow",no_overflow(c))
    if w in (1366,768):
        c.shot(f"{w}__asset-owners.png")
c.viewport(1366)
check("owners route ready for detail navigation",nav(c,"/assets/owners"))
row_ready=bool(wait(c,"!!document.querySelector('.inno-table-wrap tbody .inno-row-action')",12))
empty_state=c.ev("!!document.querySelector('.inno-collection-state,.collection-state')")
check("owners resolves to rows or legitimate empty state",row_ready or bool(empty_state))
if row_ready:
    clicked=c.ev("(()=>{const b=document.querySelector('.inno-table-wrap tbody .inno-row-action');if(!b)return false;b.click();return true})()")
    check("asset owner row action dispatched",bool(clicked))
    check("asset owner detail navigates",bool(wait(c,"location.pathname.startsWith('/assets/owners/') && location.pathname!='/assets/owners'",6)),c.ev("location.pathname") or "")
    check("asset owner detail rendered",bool(wait(c,"!!document.querySelector('.resource-breadcrumb') && (document.querySelector('.inno-page')?.innerText||'').includes('Ownership profile')",12)))
    detail_text=c.ev("(document.querySelector('.inno-page')?.innerText||'')")
    detail_all_text=c.ev("(document.querySelector('.inno-page')?.textContent||'')")
    check("owner detail breadcrumb uses Asset Owners","Asset Owners" in (detail_text or ""))
    check("owner detail uses ownership profile","Ownership profile" in (detail_text or ""))
    check("owner detail states Admin Center identity boundary","Admin Center" in (detail_text or ""))
    check("owner detail retains owned assets section","Owned Assets" in (detail_all_text or ""))
    check("owner detail no document overflow",no_overflow(c))
    c.shot("1366__asset-owner-detail.png")

c.viewport(1366)
check("admin users route remains ready",nav(c,"/admin/users"))
admin_text=c.ev("(document.querySelector('.inno-page')?.innerText||'')")
check("Admin Users remains identity surface","Users" in (admin_text or ""))
check("Admin Users not renamed to Asset Owners","Asset Owners" not in (admin_text or ""))

print("step44f_browser_checks="+str(checks))
print("step44f_browser_failures="+str(len(failures)))
print("step44f_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for name, detail in failures:
    print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
