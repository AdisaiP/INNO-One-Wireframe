from pathlib import Path
import base64,json,time,sys,requests,websocket

ROOT=Path(__file__).resolve().parent
PORT=9226
OUT=ROOT/"qa-responsive"
OUT.mkdir(exist_ok=True)
fails=[];checks=0

def check(name,cond,detail=""):
    global checks;checks+=1
    print(("PASS " if cond else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not cond:fails.append((name,detail))

class CDP:
    def __init__(self):
        deadline=time.time()+8; targets=None
        while time.time()<deadline:
            try:
                targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=1).json()
                if targets:break
            except:time.sleep(.1)
        p=next(x for x in targets if x.get("type")=="page")
        self.ws=websocket.create_connection(p["webSocketDebuggerUrl"],timeout=6,origin="http://127.0.0.1");self.n=0
        self.call("Page.enable");self.call("Runtime.enable")
    def call(self,m,p=None):
        self.n+=1;i=self.n;self.ws.send(json.dumps({"id":i,"method":m,"params":p or {}}))
        while True:
            x=json.loads(self.ws.recv())
            if x.get("id")==i:
                if "error" in x:raise RuntimeError(x["error"])
                return x.get("result",{})
    def eval(self,e):
        r=self.call("Runtime.evaluate",{"expression":e,"returnByValue":True,"awaitPromise":True})
        return r.get("result",{}).get("value")
    def viewport(self,w,h=900):
        self.call("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":False})
    def nav(self,page,query=""):
        self.call("Page.navigate",{"url":(ROOT/page).as_uri()+query})
        deadline=time.time()+7
        while time.time()<deadline:
            try:
                if self.eval("document.readyState")=="complete":break
            except:pass
            time.sleep(.04)
        time.sleep(.14)
    def shot(self,name):
        data=self.call("Page.captureScreenshot",{"format":"png","fromSurface":True}).get("data")
        if data:(OUT/name).write_bytes(base64.b64decode(data))

c=CDP()
# Sidebar contract: inline/collapsible at 1366, overlay at 1024/768.
c.viewport(1366);c.nav("workspace-v2.html","?qaMetrics=1")
m=c.eval("""(()=>({overlay:document.body.classList.contains('responsive-overlay'),sideInert:document.querySelector('.side').inert,reveal:document.querySelector('.context-nav-reveal').hidden,overflow:document.documentElement.scrollWidth>innerWidth+2}))()""")
check("1366 sidebar is inline",not m["overlay"] and not m["sideInert"] and m["reveal"] and not m["overflow"],m)
c.eval("document.querySelector('.context-side-collapse').click()");time.sleep(.08)
check("1366 sidebar collapses",c.eval("document.body.classList.contains('side-collapsed') && document.querySelector('.side').inert && !document.querySelector('.context-nav-reveal').hidden"))
c.shot("01-workspace-1366-collapsed.png")
c.eval("document.querySelector('.context-nav-reveal').click()");time.sleep(.06)
check("1366 sidebar expands",not c.eval("document.body.classList.contains('side-collapsed')"))

for w in (1024,768):
    c.viewport(w);c.nav("workspace-v2.html","?qaMetrics=1")
    closed=c.eval("document.body.classList.contains('responsive-overlay') && document.querySelector('.side').inert && !document.querySelector('.context-nav-reveal').hidden")
    check(f"{w} sidebar starts as overlay closed",closed)
    c.eval("document.querySelector('.context-nav-reveal').click()");time.sleep(.08)
    opened=c.eval("document.body.classList.contains('side-open') && !document.querySelector('.side').inert && document.querySelector('.context-nav-backdrop').classList.contains('open')")
    check(f"{w} sidebar overlay opens",opened)
    c.shot(f"02-workspace-{w}-nav-open.png")
    c.eval("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");time.sleep(.06)
    check(f"{w} Escape closes sidebar",not c.eval("document.body.classList.contains('side-open')"))
# Table overflow stays local to table-wrap.
c.viewport(768);c.nav("device-alert-rules.html","?qaMetrics=1")
tbl=c.eval("""(()=>{const w=document.querySelector('.table-wrap');return {scroll:w.scrollWidth>w.clientWidth+2,cls:w.classList.contains('is-scrollable'),tab:w.tabIndex,page:document.documentElement.scrollWidth>innerWidth+2}})()""")
check("768 wide table scroll is contained",tbl["scroll"] and tbl["cls"] and tbl["tab"]==0 and not tbl["page"],tbl)
c.shot("03-alert-rules-768-table.png")

# Sticky actions remain usable on narrow screens.
c.nav("ticket-new.html","?qaMetrics=1")
sticky=c.eval("""(()=>{const e=document.querySelector('.form-footer'),r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {position:cs.position,bottom:r.bottom,width:r.width,page:document.documentElement.scrollWidth>innerWidth+2}})()""")
check("768 form footer is sticky without overflow",sticky["position"]=="sticky" and sticky["bottom"]<=901 and not sticky["page"],sticky)
c.shot("04-ticket-new-768-sticky.png")

# Builder/editor preview stacks below 1150.
for w in (1366,1024,768):
    c.viewport(w);c.nav("report-builder.html","?qaMetrics=1")
    pos=c.eval("""(()=>{const x=[...document.querySelector('.builder-grid').children].slice(0,2).map(e=>e.getBoundingClientRect());return {sameRow:Math.abs(x[0].top-x[1].top)<4,dx:Math.abs(x[0].left-x[1].left),overflow:document.documentElement.scrollWidth>innerWidth+2}})()""")
    if w==1366:check("1366 report builder keeps two columns",pos["sameRow"] and pos["dx"]>100 and not pos["overflow"],pos)
    else:check(f"{w} report builder stacks",not pos["sameRow"] and pos["dx"]<8 and not pos["overflow"],pos)
    if w in (1024,768):c.shot(f"05-report-builder-{w}.png")

# Editor + preview stack at tablet/narrow.
for w in (1366,1024,768):
    c.viewport(w);c.nav("remote-consent-message.html","?qaMetrics=1")
    pos=c.eval("""(()=>{const x=[...document.querySelector('.arch-editor').children].slice(0,2).map(e=>e.getBoundingClientRect());return {sameRow:Math.abs(x[0].top-x[1].top)<4,leftDiff:Math.abs(x[0].left-x[1].left),overflow:document.documentElement.scrollWidth>innerWidth+2}})()""")
    if w==1366:check("1366 editor preview remains side-by-side",pos["sameRow"] and pos["leftDiff"]>100 and not pos["overflow"],pos)
    else:check(f"{w} editor preview stacks",not pos["sameRow"] and pos["leftDiff"]<8 and not pos["overflow"],pos)
    if w==1024:c.shot("05b-consent-editor-1024.png")

# Master-detail collapses at tablet/narrow.
for w in (1366,1024,768):
    c.viewport(w);c.nav("device-query.html","?qaMetrics=1")
    pos=c.eval("""(()=>{const x=[...document.querySelector('.arch-split-list').children].slice(0,2).map(e=>e.getBoundingClientRect());return {sameRow:Math.abs(x[0].top-x[1].top)<4,leftDiff:Math.abs(x[0].left-x[1].left),overflow:document.documentElement.scrollWidth>innerWidth+2}})()""")
    if w==1366:check("1366 master-detail remains split",pos["sameRow"] and pos["leftDiff"]>100,pos)
    else:check(f"{w} master-detail stacks",not pos["sameRow"] and pos["leftDiff"]<8 and not pos["overflow"],pos)
# Wizard stepper responsive column counts.
def row_signature():
    return c.eval("""(()=>[...document.querySelectorAll('.arch-step')].map(e=>Math.round(e.getBoundingClientRect().top)))()""")
for w,expected_rows in ((1024,2),(768,3)):
    c.viewport(w);c.nav("deployment-new.html","?qaMetrics=1")
    tops=row_signature();rows=len(set(tops))
    check(f"{w} deployment stepper wraps predictably",rows==expected_rows,f"rows={rows} tops={tops}")
    c.shot(f"06-deployment-{w}-stepper.png")

for w in (1024,768):
    c.viewport(w);c.nav("agent-rollout-new.html","?qaMetrics=1")
    tops=row_signature();rows=len(set(tops))
    check(f"{w} four-step rollout uses two-column stepper",rows==2,f"rows={rows} tops={tops}")
c.shot("07-agent-rollout-768-stepper.png")

# Toolbar wraps search to full row at narrow width.
c.viewport(768);c.nav("devices-overview-v2.html","?qaMetrics=1")
bar=c.eval("""(()=>{const t=document.querySelector('.ds-toolbar'),s=t.querySelector('.ds-search'),tr=t.getBoundingClientRect(),sr=s.getBoundingClientRect();return {ratio:sr.width/tr.width,overflow:document.documentElement.scrollWidth>innerWidth+2,toolbarScroll:t.scrollWidth>t.clientWidth+2}})()""")
check("768 data toolbar gives search its own row",bar["ratio"]>.90 and not bar["overflow"] and not bar["toolbarScroll"],bar)
c.shot("08-devices-768-toolbar.png")
# Endpoint Agent surfaces: windowed desktop, full-screen compact.
for page in ("helpdesk-agent-request.html","agent-ownership-confirmation.html"):
    for w in (820,640,390):
        c.viewport(w,900);c.nav(page)
        m=c.eval("""(()=>{const h=document.documentElement,w=document.querySelector('.agent-window'),g=document.querySelector('.agent-form-grid');const wr=w.getBoundingClientRect();return {overflow:h.scrollWidth>innerWidth+2,width:Math.round(wr.width),radius:getComputedStyle(w).borderRadius,cols:g?getComputedStyle(g).gridTemplateColumns:'',surface:document.body.dataset.innoSurface}})()""")
        check(f"{page} {w} Agent has no page overflow",m["surface"]=="agent" and not m["overflow"],m)
        if w==820:check(f"{page} 820 keeps window shell",m["width"]<=820 and m["radius"]!="0px",m)
        else:check(f"{page} {w} switches to compact one-column form"," " not in m["cols"].strip() and m["radius"]=="0px",m)
        if w in (820,390):c.shot(f"09-{page[:-5]}-{w}.png")

# Android Mobile surface: dedicated full-screen shell under 600px.
for w in (430,390,360):
    c.viewport(w,844);c.nav("asset-mobile.html")
    m=c.eval("""(()=>{const h=document.documentElement,p=document.querySelector('.android-phone'),tabs=document.querySelector('.mobile-tabs');const r=p.getBoundingClientRect();return {overflow:h.scrollWidth>innerWidth+2,width:Math.round(r.width),height:Math.round(r.height),radius:getComputedStyle(p).borderRadius,tabsLocal:tabs.scrollWidth>=tabs.clientWidth,surface:document.body.dataset.innoSurface}})()""")
    check(f"Mobile {w} has no page overflow",m["surface"]=="mobile" and not m["overflow"],m)
    check(f"Mobile {w} uses full-width phone shell",m["width"]==w and m["radius"]=="0px",m)
    if w in (430,360):c.shot(f"10-asset-mobile-{w}.png")

print(f"browser_checks={checks}")
print(f"browser_failures={len(fails)}")
print(f"screenshots={len(list(OUT.glob('*.png')))}")
if fails:
    for x in fails:print("FAILED",x)
    sys.exit(1)
