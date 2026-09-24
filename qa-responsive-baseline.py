from pathlib import Path
import json,time,sys,requests,websocket

ROOT=Path(__file__).resolve().parent
PORT=9224
EXTERNAL={"asset-mobile.html","helpdesk-agent-request.html","agent-ownership-confirmation.html","design-system.html"}
pages=[]
for p in sorted(ROOT.glob("*.html")):
    s=p.read_text(errors="ignore")
    if "inno-design-system.css" in s and p.name not in EXTERNAL: pages.append(p.name)

class CDP:
    def __init__(self):
        deadline=time.time()+8; targets=None
        while time.time()<deadline:
            try:
                targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=1).json()
                if targets:break
            except Exception:time.sleep(.1)
        page=next(x for x in targets if x.get("type")=="page")
        self.ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=6,origin="http://127.0.0.1");self.n=0
        self.call("Page.enable");self.call("Runtime.enable")
    def call(self,m,p=None):
        self.n+=1;i=self.n;self.ws.send(json.dumps({"id":i,"method":m,"params":p or {}}))
        while True:
            x=json.loads(self.ws.recv())
            if x.get("id")==i:return x.get("result",{})
    def eval(self,e):
        return self.call("Runtime.evaluate",{"expression":e,"returnByValue":True,"awaitPromise":True}).get("result",{}).get("value")
    def viewport(self,w,h=900):
        self.call("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":False})
    def nav(self,page):
        self.call("Page.navigate",{"url":(ROOT/page).as_uri()+"?qaMetrics=1"})
        deadline=time.time()+6
        while time.time()<deadline:
            try:
                if self.eval("document.readyState")=="complete" and self.eval("!!window.INNOResponsive"):break
            except:pass
            time.sleep(.04)
        time.sleep(.08)

c=CDP(); failures=[]; rows=[]
for w in (1366,1024,768):
    c.viewport(w)
    for page in pages:
        c.nav(page)
        js="""(()=>{const html=document.documentElement,b=document.body,side=document.querySelector('.side'),reveal=document.querySelector('.context-nav-reveal');
        const wraps=[...document.querySelectorAll('.table-wrap')];
        const rogue=[...document.querySelectorAll('body *')].filter(el=>{const cs=getComputedStyle(el),r=el.getBoundingClientRect();if(cs.display==='none'||cs.visibility==='hidden'||r.width===0||cs.position==='fixed')return false;if(el.closest('.table-wrap,.surface-tabs,.detail-tabs,.asset-tabs,.section-subnav'))return false;if(b.classList.contains('responsive-overlay')&&el.closest('.side'))return false;return r.right>innerWidth+3||r.left<-3}).slice(0,8).map(x=>x.className||x.tagName);
        const sticky=[...document.querySelectorAll('.arch-editor-actions,.form-footer,.editor-footer,.sticky-actions')];
        return {overflow:html.scrollWidth>innerWidth+2,doc:html.scrollWidth,mode:b.dataset.viewport||'',overlay:b.classList.contains('responsive-overlay'),sideOpen:b.classList.contains('side-open'),sideHidden:side?side.inert:null,reveal:reveal?!reveal.hidden:false,tables:wraps.length,scrollTables:wraps.filter(x=>x.scrollWidth>x.clientWidth+2).length,rogue,sticky:sticky.length,stickyBad:sticky.filter(x=>{const r=x.getBoundingClientRect();return r.width>innerWidth+2}).length};})()"""
        m=c.eval(js)
        rows.append((page,w,m))
        expectedOverlay=w<=1180
        bad=[]
        if m["overflow"]:bad.append(f"page-overflow {m['doc']}>{w}")
        if m["overlay"]!=expectedOverlay:bad.append("sidebar-mode")
        if expectedOverlay and (not m["sideHidden"] or not m["reveal"]):bad.append("overlay-closed-state")
        if m["stickyBad"]:bad.append("sticky-width")
        if m["rogue"]:bad.append("rogue:"+",".join(map(str,m["rogue"][:3])))
        if bad:failures.append((page,w,"; ".join(bad)))
print("pages",len(pages))
print("viewports",3)
print("checks",len(rows))
print("failures",len(failures))
for x in failures:print("FAIL",*x,sep=" | ")
for w in (1366,1024,768):
    subset=[m for _,ww,m in rows if ww==w]
    print(f"viewport_{w}_scrollable_tables",sum(x["scrollTables"] for x in subset))
    print(f"viewport_{w}_sticky_areas",sum(x["sticky"] for x in subset))
sys.exit(1 if failures else 0)
