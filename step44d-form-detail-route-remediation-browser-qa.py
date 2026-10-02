from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step44d-form-detail"
PORT=9241
WIDTHS=(1366,1024,768)
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True)
checks=0; failures=[]

def check(name, ok, detail=""):
    global checks
    checks+=1
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok: failures.append((name,detail))

class CDP:
    def __init__(self):
        t=next(x for x in requests.get(f"http://127.0.0.1:{PORT}/json",timeout=3).json() if x.get("type")=="page")
        self.ws=websocket.create_connection(t["webSocketDebuggerUrl"],timeout=10,origin="http://127.0.0.1"); self.n=0
        self.call("Page.enable"); self.call("Runtime.enable")
    def call(self,m,p=None):
        self.n+=1; i=self.n
        self.ws.send(json.dumps({"id":i,"method":m,"params":p or {}}))
        while True:
            r=json.loads(self.ws.recv())
            if r.get("id")==i: return r.get("result",{})
    def ev(self,x):
        return self.call("Runtime.evaluate",{"expression":x,"returnByValue":True,"awaitPromise":True}).get("result",{}).get("value")
    def viewport(self,w,h=900):
        self.call("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":False})
    def shot(self,name):
        data=self.call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
        (OUT/name).write_bytes(base64.b64decode(data))
def wait(c, expr, timeout=15):
    end=time.time()+timeout
    while time.time()<end:
        try:
            v=c.ev(expr)
            if v: return v
        except Exception: pass
        time.sleep(.1)
    return None

def nav(c, route, selector=".inno-page"):
    c.ev("history.pushState({},'',"+json.dumps(route)+");window.dispatchEvent(new PopStateEvent('popstate'));true")
    return bool(wait(c,"location.pathname==="+json.dumps(route)+" && !!document.querySelector("+json.dumps(selector)+")",20))

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

c=CDP(); c.viewport(1366)
check("authenticated production session", bool(wait(c,"location.href.startsWith('http://localhost:5180') && !!document.querySelector('.inno-production-shell')",5)), c.ev("location.href") or "")

for w in WIDTHS:
    c.viewport(w)
    check(f"{w} positions ready", nav(c,"/admin/positions"))
    check(f"{w} positions no permanent master detail", c.ev("!document.querySelector('.admin-master-detail')") is True)
    check(f"{w} positions no document overflow", no_overflow(c))
    if w==1366:
        opened=c.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='New Position');if(!b)return false;b.click();return true})()""")
        check("positions create dialog trigger", bool(opened))
        check("positions dialog opens", bool(wait(c,"!!document.querySelector('.inno-overlay--dialog [role=dialog]')",3)))
        dialog=c.ev("""(()=>{const d=document.querySelector('[role=dialog]');return d?{modal:d.getAttribute('aria-modal'),title:d.querySelector('h2')?.textContent,focus:document.activeElement?.tagName}:null})()""")
        check("positions dialog semantics", bool(dialog and dialog["modal"]=="true"), dialog)
        c.shot("1366__positions-dialog.png")
        c.ev("document.querySelector('.inno-overlay-close')?.click()")
for w in WIDTHS:
    c.viewport(w)
    check(f"{w} users list ready", nav(c,"/admin/users"))
    check(f"{w} users list no inline create", c.ev("!document.querySelector('.create-panel') && !document.querySelector('.admin-editor-panel')") is True)
    check(f"{w} users no document overflow", no_overflow(c))
    check(f"{w} user create route ready", nav(c,"/admin/users/new",".editor-route-panel"))
    check(f"{w} user create canonical footer", c.ev("!!document.querySelector('.editor-route-panel .inno-editor-footer')") is True)
    check(f"{w} user create no document overflow", no_overflow(c))
    if w==1366: c.shot("1366__user-create.png")

c.viewport(1366); nav(c,"/admin/users")
user_clicked=c.ev("""(()=>{const b=document.querySelector('.inno-table-wrap tbody .inno-row-action');if(!b)return false;b.click();return true})()""")
user_href=wait(c,"location.pathname.startsWith('/admin/users/') && !location.pathname.endsWith('/edit') ? location.pathname : ''",5) if user_clicked else None
check("user detail route discovered", bool(user_href), user_href or "")
if user_href:
    check("user detail ready", nav(c,user_href,".inno-resource-head"))
    check("user detail read-only", c.ev("!document.querySelector('.editor-form')") is True)
    edit_href=c.ev('document.querySelector(\'.inno-resource-head a[href$="/edit"]\')?.getAttribute(\'href\')')
    check("user edit route discovered", bool(edit_href), edit_href or "")
    if edit_href:
        check("user edit ready", nav(c,edit_href,".editor-route-panel"))
        check("user edit canonical footer", c.ev("!!document.querySelector('.editor-route-panel .inno-editor-footer')") is True)
        c.shot("1366__user-edit.png")
for w in WIDTHS:
    c.viewport(w)
    check(f"{w} access list ready", nav(c,"/admin/access-scopes"))
    check(f"{w} access no permanent master detail", c.ev("!document.querySelector('.admin-master-detail') && !document.querySelector('.admin-editor-panel')") is True)
    check(f"{w} access list no TreeGrid", c.ev("!document.querySelector('.inno-treegrid')") is True)
    check(f"{w} access list no document overflow", no_overflow(c))

c.viewport(1366); nav(c,"/admin/access-scopes")
access_clicked=c.ev("""(()=>{const b=document.querySelector('.inno-table-wrap tbody .inno-row-action');if(!b)return false;b.click();return true})()""")
access_href=wait(c,"location.pathname.startsWith('/admin/access-scopes/') && location.pathname.endsWith('/edit') ? location.pathname : ''",5) if access_clicked else None
check("access edit route discovered", bool(access_href), access_href or "")
if access_href:
    for w in WIDTHS:
        c.viewport(w)
        check(f"{w} access edit ready", nav(c,access_href,".editor-route-panel"))
        check(f"{w} access TreeGrid ready", bool(wait(c,"!!document.querySelector('.inno-treegrid[role=treegrid]')",8)))
        check(f"{w} access edit footer", c.ev("!!document.querySelector('.inno-editor-footer')") is True)
        check(f"{w} access edit no document overflow", no_overflow(c))
        if w in (1366,768): c.shot(f"{w}__access-edit.png")
for w in WIDTHS:
    c.viewport(w)
    check(f"{w} custom fields ready", nav(c,"/assets/custom-fields"))
    check(f"{w} custom fields no inline editor rows", c.ev("!document.querySelector('.custom-field-editor-row')") is True)
    check(f"{w} custom fields no document overflow", no_overflow(c))
    if w==1366:
        opened=c.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Field');if(!b)return false;b.click();return true})()""")
        check("custom fields dialog trigger", bool(opened))
        check("custom fields dialog opens", bool(wait(c,"!!document.querySelector('.inno-overlay--dialog [role=dialog]')",3)))
        c.shot("1366__custom-field-dialog.png")
        c.ev("document.querySelector('.inno-overlay-close')?.click()")

for w in WIDTHS:
    c.viewport(w)
    check(f"{w} contracts list ready", nav(c,"/assets/contracts"))
    check(f"{w} contracts no inline detail/editor", c.ev("!document.querySelector('.contract-detail-grid') && !document.querySelector('.contract-record-panel')") is True)
    check(f"{w} contracts no document overflow", no_overflow(c))

c.viewport(1366); nav(c,"/assets/contracts")
contract_clicked=c.ev("""(()=>{const b=document.querySelector('.inno-table-wrap tbody .inno-row-action');if(!b)return false;b.click();return true})()""")
contract_href=wait(c,"location.pathname.startsWith('/assets/contracts/') && !location.pathname.endsWith('/edit') ? location.pathname : ''",5) if contract_clicked else None
check("contract detail route discovered", bool(contract_href), contract_href or "")
if contract_href:
    for w in WIDTHS:
        c.viewport(w)
        check(f"{w} contract detail ready", nav(c,contract_href,".inno-resource-head"))
        check(f"{w} contract detail no editor", c.ev("!document.querySelector('.editor-form')") is True)
        check(f"{w} contract detail no overflow", no_overflow(c))
    c.viewport(1366); nav(c,contract_href,".inno-resource-head")
    edit_href=c.ev('document.querySelector(\'.inno-resource-head a[href$="/edit"]\')?.getAttribute(\'href\')')
    check("contract edit route discovered", bool(edit_href), edit_href or "")
    if edit_href:
        for w in WIDTHS:
            c.viewport(w)
            check(f"{w} contract edit ready", nav(c,edit_href,".editor-route-panel"))
            check(f"{w} contract edit footer", c.ev("!!document.querySelector('.inno-editor-footer')") is True)
            check(f"{w} contract edit no overflow", no_overflow(c))
            if w in (1366,768): c.shot(f"{w}__contract-edit.png")
print("step44d_browser_checks="+str(checks))
print("step44d_browser_failures="+str(len(failures)))
print("step44d_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for name,detail in failures: print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
