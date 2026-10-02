from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step44e-visual-parity"
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
        t=next(x for x in requests.get(f"http://127.0.0.1:{PORT}/json",timeout=3).json() if x.get("type")=="page")
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
            v=c.ev(expr)
            if v:
                return v
        except Exception:
            pass
        time.sleep(.1)
    return None

def nav(c,route,selector=".inno-page"):
    c.ev("history.pushState({},'',"+json.dumps(route)+");window.dispatchEvent(new PopStateEvent('popstate'));true")
    return bool(wait(c,"location.pathname==="+json.dumps(route)+" && !!document.querySelector("+json.dumps(selector)+")",20))

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

def hero_metrics(c):
    return c.ev("""(()=>{const h=document.querySelector('.inno-page-hero');const i=h?.querySelector('.inno-page-illustration img');
      if(!h||!i)return null;const hr=h.getBoundingClientRect(),ir=i.getBoundingClientRect();
      return {src:i.getAttribute('src'),heroW:Math.round(hr.width),heroH:Math.round(hr.height),
        imageW:Math.round(ir.width),imageH:Math.round(ir.height),display:getComputedStyle(i).display};})()""")

def row_action_metrics(c):
    return c.ev("""(()=>{const cell=document.querySelector('.inno-table-wrap tbody .action-column');const a=cell?.querySelector('.inno-row-action');
      if(!cell||!a)return null;const r=a.getBoundingClientRect();return {tag:a.tagName,text:(a.textContent||'').trim(),
      width:Math.round(r.width),height:Math.round(r.height),aria:a.getAttribute('aria-label')};})()""")

c=CDP()
c.viewport(1366)
check("authenticated production session",
      bool(wait(c,"location.href.startsWith('http://localhost:5180') && !!document.querySelector('.inno-production-shell')",5)),
      c.ev("location.href") or "")

hero_routes=[
    ("/apps","apps-ecosystem.svg","apps"),
    ("/assets","asset-inventory.svg","assets"),
    ("/devices/add","device-setup.svg","deployment"),
]
for route,asset,label in hero_routes:
    for w in WIDTHS:
        c.viewport(w)
        check(f"{w} {label} route ready",nav(c,route))
        m=wait(c,"(()=>{const i=document.querySelector('.inno-page-illustration img');if(!i)return null;const r=i.getBoundingClientRect();return r.width>40&&r.height>40?{src:i.getAttribute('src'),w:r.width,h:r.height}:null})()",8)
        check(f"{w} {label} approved hero visible",bool(m and asset in (m.get("src") or "")),m or "")
        check(f"{w} {label} no document overflow",no_overflow(c))
        if w in (1366,768):
            c.shot(f"{w}__{label}.png")

for w in WIDTHS:
    c.viewport(w)
    check(f"{w} integrations ready",nav(c,"/admin/integrations"))
    check(f"{w} integrations redundant note removed",c.ev("!document.querySelector('.inno-purpose-note')") is True)
    check(f"{w} integrations boundary in page description",
          c.ev("(document.querySelector('.inno-page-sub')?.textContent||'').includes('deployment-managed')") is True)
    check(f"{w} integrations no document overflow",no_overflow(c))
    if w==1366:
        c.shot("1366__integrations-clean.png")

for w in WIDTHS:
    c.viewport(w)
    check(f"{w} calendar ready",nav(c,"/helpdesk/calendar"))
    check(f"{w} calendar redundant notes removed",c.ev("!document.querySelector('.inno-purpose-note')") is True)
    check(f"{w} calendar working-hours panel ready",bool(wait(c,"!!document.querySelector('.calendar-working-grid, .working-days-grid, .business-calendar-layout')",3) or c.ev("!!document.querySelector('.prod-panel')")))
    check(f"{w} calendar no document overflow",no_overflow(c))
    if w in (1366,768):
        c.shot(f"{w}__calendar-clean.png")

clean_routes=[
    ("/admin/branding","branding"),
    ("/admin/platform-settings","platform-settings"),
    ("/admin/roles","roles"),
    ("/admin/security","security"),
    ("/search","search"),
]
for route,label in clean_routes:
    c.viewport(1366)
    check(label+" route ready",nav(c,route))
    check(label+" redundant purpose note removed",c.ev("!document.querySelector('.inno-purpose-note')") is True)
    check(label+" no document overflow",no_overflow(c))

route_action_routes=[
    ("/admin/users","users"),
    ("/assets/inventory","asset inventory"),
    ("/helpdesk/tickets","tickets"),
]
for route,label in route_action_routes:
    c.viewport(1366)
    check(label+" list ready",nav(c,route))
    check(label+" table settled",bool(wait(c,"document.querySelectorAll('.inno-table-wrap tbody tr').length>0",12)))
    m=row_action_metrics(c)
    check(label+" uses shared button row action",bool(m and m.get("tag")=="BUTTON" and m.get("text")=="Open"),m or "")
    check(label+" row action has accessible label",bool(m and m.get("aria")),m or "")
    check(label+" no document overflow",no_overflow(c))

c.viewport(1366)
check("user list ready for navigation",nav(c,"/admin/users"))
check("user row action ready",bool(wait(c,"!!document.querySelector('.inno-table-wrap tbody .inno-row-action')",10)))
clicked=c.ev("""(()=>{const b=document.querySelector('.inno-table-wrap tbody .inno-row-action');if(!b)return false;b.click();return true})()""")
check("shared router row action click dispatched",bool(clicked))
check("shared router row action navigates",bool(wait(c,"location.pathname.startsWith('/admin/users/') && location.pathname!='/admin/users'",6)),c.ev("location.pathname") or "")

c.viewport(1366)
check("positions ready",nav(c,"/admin/positions"))
check("positions table settled",bool(wait(c,"document.querySelectorAll('.inno-table-wrap tbody tr').length>0",10)))
pm=row_action_metrics(c)
check("positions edit uses shared row action",bool(pm and pm.get("tag")=="BUTTON" and pm.get("text")=="Edit"),pm or "")
opened=c.ev("""(()=>{const b=document.querySelector('.inno-table-wrap tbody .inno-row-action');if(!b)return false;b.click();return true})()""")
check("positions edit action dispatched",bool(opened))
check("positions edit dialog opens",bool(wait(c,"!!document.querySelector('.inno-overlay--dialog [role=dialog]')",4)))
c.shot("1366__positions-shared-action.png")
c.ev("document.querySelector('.inno-overlay-close')?.click()")

c.viewport(1366)
check("software baselines ready",nav(c,"/assets/software-baselines"))
baseline_state=c.ev("""(()=>({rows:document.querySelectorAll('.inno-table-wrap tbody tr').length,
  empty:!!document.querySelector('.inno-collection-state,.collection-state')}))()""")
check("software baselines resolves to rows or legitimate empty state",
      bool(baseline_state and (baseline_state.get("rows",0)>0 or baseline_state.get("empty"))),baseline_state or "")
if baseline_state and baseline_state.get("rows",0)>0:
    bm=row_action_metrics(c)
    check("software baseline select uses shared row action",bool(bm and bm.get("tag")=="BUTTON" and bm.get("text")=="Select"),bm or "")

# Spot-check content inset so form controls/footer do not sit against card edges.
c.viewport(1366)
check("deployment ready for spacing",nav(c,"/devices/add"))
spacing=c.ev("""(()=>{const panel=document.querySelector('.deployment-card');const input=panel?.querySelector('select');const footer=panel?.querySelector('.inno-editor-footer');
  if(!panel||!input||!footer)return null;const p=panel.getBoundingClientRect(),i=input.getBoundingClientRect(),f=footer.getBoundingClientRect();
  return {inputLeft:Math.round(i.left-p.left),inputRight:Math.round(p.right-i.right),footerLeft:Math.round(f.left-p.left),footerRight:Math.round(p.right-f.right)};})()""")
check("deployment controls keep card inset",bool(spacing and spacing["inputLeft"]>=12 and spacing["inputRight"]>=12),spacing or "")
check("deployment footer stays inside card",bool(spacing and spacing["footerLeft"]>=0 and spacing["footerRight"]>=0),spacing or "")

print("step44e_browser_checks="+str(checks))
print("step44e_browser_failures="+str(len(failures)))
print("step44e_browser_screenshots="+str(len(list(OUT.glob("*.png")))))
for name,detail in failures:
    print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
