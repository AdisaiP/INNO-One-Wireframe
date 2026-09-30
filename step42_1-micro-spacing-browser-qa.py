import json, sys, time
from pathlib import Path
import requests, websocket

PORT=9241
ROUTES=[
"/","/workspace/continue","/workspace/attention","/workspace/recent",
"/profile","/notifications","/search","/apps",
"/admin","/admin/organization","/admin/locations","/admin/positions","/admin/users","/admin/roles",
"/admin/access-scopes","/admin/integrations","/admin/security","/admin/audit","/admin/branding","/admin/settings","/admin/apps",
"/devices","/devices/discovery","/devices/groups","/devices/add",
"/assets","/assets/inventory","/assets/ownership","/assets/owners","/assets/ownership/submissions",
"/assets/custom-fields","/assets/qr-labels","/assets/software-baselines","/assets/software-licenses","/assets/contracts",
"/helpdesk","/helpdesk/tickets","/helpdesk/assigned","/helpdesk/team","/helpdesk/tickets/new",
"/helpdesk/sla","/helpdesk/calendar","/helpdesk/automation","/helpdesk/automation/new",
]
checks=0; fails=[]

def check(name, ok, detail=""):
    global checks
    checks+=1
    if not ok:
        fails.append((name,detail))
        print("FAIL",name,detail)

t=next(x for x in requests.get(f"http://127.0.0.1:{PORT}/json",timeout=3).json() if x.get("type")=="page")
ws=websocket.create_connection(t["webSocketDebuggerUrl"],timeout=10,origin="http://127.0.0.1")
seq=0
def call(method,params=None):
    global seq
    seq+=1;i=seq
    ws.send(json.dumps({"id":i,"method":method,"params":params or {}}))
    while True:
        m=json.loads(ws.recv())
        if m.get("id")==i:
            if "error" in m: raise RuntimeError(m["error"])
            return m.get("result",{})
def ev(expr):
    r=call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True})
    return r.get("result",{}).get("value")
def viewport(w):
    call("Emulation.setDeviceMetricsOverride",{"width":w,"height":900,"deviceScaleFactor":1,"mobile":False})
def nav(route):
    call("Page.navigate",{"url":"http://localhost:5180"+route})
    deadline=time.time()+10
    while time.time()<deadline:
        if ev("!!document.querySelector('.inno-production-shell')"):
            time.sleep(.15);return True
        time.sleep(.1)
    return False

def metric(selector):
    return ev("""(s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e),r=e.getBoundingClientRect();return{
      padding:c.padding,paddingTop:c.paddingTop,paddingRight:c.paddingRight,paddingBottom:c.paddingBottom,paddingLeft:c.paddingLeft,
      margin:c.margin,marginTop:c.marginTop,marginRight:c.marginRight,marginBottom:c.marginBottom,marginLeft:c.marginLeft,
      gap:c.gap,borderRadius:c.borderRadius,borderTop:c.borderTop,borderBottom:c.borderBottom,
      minHeight:c.minHeight,position:c.position,display:c.display,
      x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)
    }})(%s)"""%json.dumps(selector))

def eq(route,width,selector,key,expected,label):
    m=metric(selector)
    if m is None:return
    check(f"{width} {route} {label}",m.get(key)==expected,f"{key}={m.get(key)} expected={expected}")

for width in (1366,1024,768):
    viewport(width)
    for route in ROUTES:
        if not nav(route):
            check(f"{width} {route} ready",False,"not ready");continue

        page=metric(".inno-page")
        if page:
            if width==1366:
                check(f"{width} {route} page padding",page["padding"]=="24px 16px 32px",str(page))
            elif width==1024:
                check(f"{width} {route} page horizontal/bottom",page["paddingLeft"]=="16px" and page["paddingRight"]=="16px" and page["paddingBottom"]=="32px",str(page))
                check(f"{width} {route} contextual top reserve",page["paddingTop"]=="62px",str(page))
            else:
                check(f"{width} {route} page horizontal/bottom",page["paddingLeft"]=="12px" and page["paddingRight"]=="12px" and page["paddingBottom"]=="32px",str(page))
                check(f"{width} {route} contextual top reserve",page["paddingTop"]=="58px",str(page))

        head=metric(".inno-page-head")
        hero_head=ev("!!document.querySelector('.inno-page-hero .inno-page-head')")
        if head and not hero_head:
            expected="12px" if width<=850 else "16px"
            check(f"{width} {route} page head rhythm",head["marginBottom"]==expected,str(head))

        for selector,label,padding in [
            (".inno-collection-head","collection head","12px 16px"),
            (".inno-collection-toolbar","collection toolbar","12px 16px"),
            (".inno-pagination","pagination","12px 16px"),
            (".prod-panel-head","panel head","12px 16px"),
        ]:
            m=metric(selector)
            if m: check(f"{width} {route} {label}",m["padding"]==padding,str(m))

        resource=metric(".inno-resource-head")
        if resource: check(f"{width} {route} resource margin",resource["marginBottom"]=="16px",str(resource))

        tabs=metric(".inno-surface-tabs")
        if tabs: check(f"{width} {route} tabs margin",tabs["marginBottom"]=="16px",str(tabs))

        stat=metric(".production-stat-strip")
        if stat: check(f"{width} {route} stat rhythm",stat["marginBottom"]=="16px",str(stat))

        footer=metric(".inno-editor-footer")
        deployment_footer=ev("!!document.querySelector('.deployment-card .inno-editor-footer')")
        if footer and not deployment_footer:
            ok=(footer["position"]=="static" and footer["minHeight"]=="58px" and footer["marginTop"]=="14px"
                and footer["padding"]=="10px 12px" and footer["borderRadius"]=="12px")
            check(f"{width} {route} editor footer",ok,str(footer))

        hero=metric(".inno-page-hero")
        if hero:
            expected_padding="16px" if width<=850 else "18px 20px"
            check(f"{width} {route} hero padding",hero["padding"]==expected_padding,str(hero))
            check(f"{width} {route} hero margin",hero["marginBottom"]=="18px",str(hero))

print("micro_spacing_routes="+str(len(ROUTES)))
print("micro_spacing_checks="+str(checks))
print("micro_spacing_failures="+str(len(fails)))
for item in fails[:150]:
    print("FAILED",item)
sys.exit(1 if fails else 0)
