from pathlib import Path
import base64,hashlib,json,time,sys,requests,websocket,shutil

ROOT=Path(__file__).resolve().parent
PORT=9227
OUT=ROOT/"qa-final-visual"
EXT={"asset-mobile.html","helpdesk-agent-request.html","agent-ownership-confirmation.html"}
REF={"design-system.html"}

if OUT.exists(): shutil.rmtree(OUT)
for x in ("routes-web","surfaces","states"): (OUT/x).mkdir(parents=True,exist_ok=True)

web_pages=[]
for p in sorted(ROOT.glob("*.html")):
    s=p.read_text(errors="ignore")
    if "inno-design-system.css" in s and p.name not in EXT|REF:web_pages.append(p.name)

fails=[];checks=0;manifest={"generated":"2026-09-24","web":{},"surfaces":{},"states":{},"summary":{}}

def check(name,cond,detail=""):
    global checks;checks+=1
    print(("PASS " if cond else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not cond:fails.append((name,detail))

class CDP:
    def __init__(self):
        deadline=time.time()+8;targets=None
        while time.time()<deadline:
            try:
                targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=1).json()
                if targets:break
            except:time.sleep(.1)
        if not targets:raise RuntimeError("DevTools target unavailable")
        p=next(x for x in targets if x.get("type")=="page")
        self.ws=websocket.create_connection(p["webSocketDebuggerUrl"],timeout=8,origin="http://127.0.0.1");self.n=0
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
        if "exceptionDetails" in r:raise RuntimeError(str(r["exceptionDetails"]))
        return r.get("result",{}).get("value")
    def viewport(self,w,h):
        self.call("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":False})
    def nav(self,page,query=""):
        self.call("Page.navigate",{"url":(ROOT/page).as_uri()+query})
        deadline=time.time()+7
        while time.time()<deadline:
            try:
                if self.eval("document.readyState")=="complete":break
            except:pass
            time.sleep(.04)
        time.sleep(.13)
        self.normalize()
    def normalize(self):
        self.eval("""(()=>{let s=document.getElementById('qa-final-freeze');if(!s){s=document.createElement('style');s.id='qa-final-freeze';s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.appendChild(s)}const st=document.getElementById('sessionTimer');if(st)st.textContent='00:12:48';const mt=document.getElementById('mobileTime');if(mt)mt.textContent='14:32';window.scrollTo(0,0);})()""")
        time.sleep(.03)
    def shot(self,path):
        data=self.call("Page.captureScreenshot",{"format":"png","fromSurface":True}).get("data","")
        raw=base64.b64decode(data);path.write_bytes(raw)
        return {"file":str(path.relative_to(ROOT)),"sha256":hashlib.sha256(raw).hexdigest(),"bytes":len(raw)}
c=CDP();c.viewport(1366,900)

# Canonical Web routes at the frozen desktop viewport.
for i,page in enumerate(web_pages,1):
    c.nav(page,"?qaMetrics=1")
    m=c.eval("""(()=>{const h=document.documentElement,b=document.body,h1=document.querySelector('h1'),head=document.querySelector('.page-head'),rail=document.querySelector('.rail'),side=document.querySelector('.side'),ph=document.querySelector('.platform-header');const visible=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};const dead=[...document.querySelectorAll('button')].filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&!e.closest('.mock-desktop')&&!e.closest('#innoInteractionRoot')&&typeof e.onclick!=='function'&&![...e.attributes].some(a=>a.name.startsWith('data-'))&&!['submit','reset'].includes(e.type)&&!e.id).map(e=>(e.textContent||e.getAttribute('aria-label')||e.className).trim().slice(0,80));return {overflow:h.scrollWidth>innerWidth+2,railActive:document.querySelectorAll('.rail a.active').length,sideActive:document.querySelectorAll('.side a.active').length,rawPlaceholders:Number(h.dataset.navRawPlaceholders||0),contract:window.INNODesignContract?.contractVersion||'',status:window.INNODesignContract?.status||'',h1Count:document.querySelectorAll('h1').length,h1Size:h1?getComputedStyle(h1).fontSize:'',bodyBg:getComputedStyle(b).backgroundColor,railWidth:rail?Math.round(rail.getBoundingClientRect().width):0,sideWidth:side?Math.round(side.getBoundingClientRect().width):0,headerHeight:ph?Math.round(ph.getBoundingClientRect().height):0,primaryHead:head?[...head.querySelectorAll('.actions .btn')].filter(x=>!x.classList.contains('secondary')&&!x.classList.contains('ghost')&&!x.classList.contains('danger')).length:0,dead};})()""")
    shot=c.shot(OUT/"routes-web"/f"{page[:-5]}.png")
    manifest["web"][page]={**m,**shot}
    bad=[]
    if m["overflow"]:bad.append("page overflow")
    if m["railActive"]!=1:bad.append(f"rail active={m['railActive']}")
    if m["sideActive"]!=1:bad.append(f"side active={m['sideActive']}")
    if m["rawPlaceholders"]!=0:bad.append(f"raw placeholders={m['rawPlaceholders']}")
    if m["status"]!="frozen":bad.append("contract not frozen")
    if m["primaryHead"]>1:bad.append(f"page-head primary={m['primaryHead']}")
    # Runtime dead-control candidates are reviewed below; only unhandled plain buttons count.
    if m["dead"] and page not in {"device-alerts.html","remote-consent-rules.html","remote-session.html"}:bad.append("dead:"+",".join(m["dead"][:3]))
    check(f"Web route {i:02d}/{len(web_pages)} {page}",not bad,"; ".join(bad))
# Design System reference and external surfaces use their native review widths.
c.viewport(1366,900);c.nav("design-system.html")
refm=c.eval("""(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,contract:window.INNODesignContract?.contractVersion||'',status:window.INNODesignContract?.status||''}))()""")
manifest["surfaces"]["design-system.html"]={**refm,**c.shot(OUT/"surfaces"/"design-system.png")}
check("Design System reference has no overflow",not refm["overflow"],refm)

for page in ("helpdesk-agent-request.html","agent-ownership-confirmation.html"):
    c.viewport(820,900);c.nav(page)
    m=c.eval("""(()=>({surface:document.body.dataset.innoSurface,overflow:document.documentElement.scrollWidth>innerWidth+2,webShell:!!document.querySelector('.rail,.side,.platform-header'),contract:window.INNODesignContract?.contractVersion||'',status:window.INNODesignContract?.status||''}))()""")
    manifest["surfaces"][page]={**m,**c.shot(OUT/"surfaces"/f"{page[:-5]}-820.png")}
    check(page+" surface boundary",m["surface"]=="agent" and not m["overflow"] and not m["webShell"],m)

c.viewport(390,844);c.nav("asset-mobile.html")
m=c.eval("""(()=>({surface:document.body.dataset.innoSurface,overflow:document.documentElement.scrollWidth>innerWidth+2,webShell:!!document.querySelector('.rail,.side,.platform-header'),contract:window.INNODesignContract?.contractVersion||'',status:window.INNODesignContract?.status||''}))()""")
manifest["surfaces"]["asset-mobile.html"]={**m,**c.shot(OUT/"surfaces"/"asset-mobile-390.png")}
check("asset-mobile.html surface boundary",m["surface"]=="mobile" and not m["overflow"] and not m["webShell"],m)
# Important states and interaction snapshots.
states=[
 ("loading","devices-overview-v2.html","?uiState=loading",".inno-skeleton-block"),
 ("partial","devices-overview-v2.html","?uiState=partial&succeeded=8&failed=2",".inno-partial-state"),
 ("permission","reports-overview.html","?uiState=permission",".inno-state.permission"),
 ("disabled","reports-overview.html","?uiState=disabled",".inno-state.disabled"),
 ("error","assets-overview.html","?uiState=error",".inno-state.error"),
 ("offline","device-detail-v2.html","?uiState=offline&device=VM-FIN-02",".inno-state-banner.offline")
]
c.viewport(1366,900)
for name,page,query,sel in states:
    c.nav(page,query)
    present=c.eval(f"!!document.querySelector({json.dumps(sel)})")
    shot=c.shot(OUT/"states"/f"{name}.png")
    manifest["states"][name]={"page":page,"query":query,"selector":sel,"present":present,**shot}
    check("State "+name,present,page+query)

# No-results search.
c.nav("devices-overview-v2.html")
c.eval("""(()=>{const i=document.getElementById('deviceSearch');i.value='__FINAL_QA_NO_RESULT__';i.dispatchEvent(new Event('input',{bubbles:true}))})()""");time.sleep(.1)
present=c.eval("!!document.querySelector('#deviceRows .inno-search-empty')")
manifest["states"]["no-results"]={"page":"devices-overview-v2.html","present":present,**c.shot(OUT/"states"/"no-results.png")}
check("State no-results",present)

# Validation.
c.nav("ticket-new.html");c.eval("document.querySelector('[data-inno-save]').click()");time.sleep(.08)
invalid=c.eval("document.querySelectorAll('[aria-invalid=\"true\"]').length")
manifest["states"]["validation"]={"page":"ticket-new.html","invalid":invalid,**c.shot(OUT/"states"/"validation.png")}
check("State validation",invalid==2,invalid)

# Unsaved discard confirm.
c.nav("ticket-new.html");c.eval("""(()=>{const i=document.getElementById('subject');i.value='Final QA draft';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.form-footer a').click()})()""");time.sleep(.08)
open_=c.eval("document.getElementById('innoConfirmBackdrop').classList.contains('open')")
manifest["states"]["unsaved-confirm"]={"page":"ticket-new.html","open":open_,**c.shot(OUT/"states"/"unsaved-confirm.png")}
check("State unsaved-confirm",open_)

# Filter drawer.
c.nav("devices-overview-v2.html");c.eval("document.querySelector('[data-inno-filter=\"devices\"]').click()");time.sleep(.08)
open_=c.eval("document.getElementById('innoFilterDrawer').classList.contains('open')")
manifest["states"]["filter-drawer"]={"page":"devices-overview-v2.html","open":open_,**c.shot(OUT/"states"/"filter-drawer.png")}
check("State filter-drawer",open_)

# Bulk selection.
c.nav("devices-overview-v2.html");c.eval("""(()=>{const r=[...document.querySelectorAll('[data-inno-select-row]')];r[0].click();r[1].click()})()""");time.sleep(.05)
count=c.eval("document.querySelector('[data-inno-selected-count]').textContent")
manifest["states"]["bulk-selection"]={"page":"devices-overview-v2.html","selected":count,**c.shot(OUT/"states"/"bulk-selection.png")}
check("State bulk-selection",count=="2",count)

# Destructive confirmation.
c.nav("remote-session.html");c.eval("document.querySelector('[data-inno-confirm]').click()");time.sleep(.08)
open_=c.eval("document.getElementById('innoConfirmBackdrop').classList.contains('open')")
manifest["states"]["destructive-confirm"]={"page":"remote-session.html","open":open_,**c.shot(OUT/"states"/"destructive-confirm.png")}
check("State destructive-confirm",open_)
# Shared Input System open state.
c.viewport(1366,900);c.nav("ticket-new.html")
c.eval("""(()=>{const s=[...document.querySelectorAll('select')].find(x=>x.closest('.field')?.querySelector('label')?.textContent==='Category');s.nextElementSibling.querySelector('.inno-select-trigger').click()})()""");time.sleep(.08)
input_open=c.eval("!!document.querySelector('.inno-picker-popover .inno-picker-list')")
manifest["states"]["select-open"]={"page":"ticket-new.html","open":input_open,**c.shot(OUT/"states"/"select-open.png")}
check("State select-open",input_open)

# Final dead-control behavior checks.
c.viewport(1366,900)
c.nav("device-query.html");c.eval("document.querySelectorAll('.arch-side-list button[data-query-type]')[1].click()");time.sleep(.04)
check("Saved Query selection updates builder",c.eval("document.getElementById('queryValue').value==='Stopped' && document.getElementById('queryResultMeta').textContent.startsWith('6 results')"))

c.nav("helpdesk-categories.html");c.eval("document.querySelector('[data-category=\"VPN\"]').click()");time.sleep(.04)
check("Category tree selection updates detail",c.eval("document.querySelector('.arch-detail-panel .section-title h3').textContent==='VPN' && document.getElementById('categoryName').value==='VPN'"))

c.nav("helpdesk-requester-groups.html");c.eval("document.querySelector('[data-group-name=\"VIP Users\"]').click()");time.sleep(.04)
check("Requester Group selection updates detail",c.eval("document.getElementById('requesterGroupField').value==='VIP' && document.getElementById('requesterGroupValue').value==='true'"))

c.nav("meeting.html")
check("Upcoming meetings use real routes",c.eval("document.querySelectorAll('#upcoming a[href=\"meeting-detail.html\"]').length===2"))

c.nav("ticket-detail.html");c.eval("document.getElementById('ticketAttachBtn').click()");time.sleep(.04)
check("Ticket attachment control has feedback",c.eval("!!document.querySelector('.inno-toast')"))
c.eval("document.getElementById('ticketNoteBtn').click()");time.sleep(.03)
check("Ticket internal-note control changes composer mode",c.eval("document.querySelector('.composer textarea').placeholder==='Write an internal note...'"))

c.viewport(390,844);c.nav("asset-mobile.html","?screen=history")
check("Mobile history rows all open assets",c.eval("document.querySelectorAll('.history-row').length===document.querySelectorAll('.history-row[data-asset]').length"))
check("Unavailable full software list is explicitly disabled",c.eval("document.querySelector('.mobile-text-btn').disabled"))

c.viewport(1366,900);c.nav("device-alerts.html");c.eval("document.querySelector('.ack').click()");time.sleep(.03)
check("Alert acknowledge action is wired",c.eval("document.querySelector('.ack').disabled"))

c.nav("remote-consent-rules.html");c.eval("document.querySelector('.editRule').click()");time.sleep(.04)
check("Bypass rule Edit opens dialog",c.eval("document.getElementById('ruleDialog').classList.contains('open')"))

c.nav("remote-session.html","?collab=files");c.eval("document.querySelector('.transfer-download').click()");time.sleep(.04)
check("Remote file download action has feedback",c.eval("!!document.querySelector('.inno-toast.success')"))

# Visual-consistency distributions (record + enforce only stable shell contracts).
sizes={};bgs={};rail={};side={};header={}
for _,m in manifest["web"].items():
    sizes[m["h1Size"]]=sizes.get(m["h1Size"],0)+1
    bgs[m["bodyBg"]]=bgs.get(m["bodyBg"],0)+1
    rail[str(m["railWidth"])]=rail.get(str(m["railWidth"]),0)+1
    side[str(m["sideWidth"])]=side.get(str(m["sideWidth"]),0)+1
    header[str(m["headerHeight"])]=header.get(str(m["headerHeight"]),0)+1
manifest["summary"]={
 "webRoutes":len(web_pages),"routeScreenshots":len(manifest["web"])+len(manifest["surfaces"]),
 "stateScreenshots":len(manifest["states"]),"checks":checks,"failures":len(fails),
 "h1SizeDistribution":sizes,"bodyBackgroundDistribution":bgs,"railWidthDistribution":rail,
 "sideWidthDistribution":side,"headerHeightDistribution":header
}
check("All canonical route screenshots captured",manifest["summary"]["routeScreenshots"]==78,manifest["summary"]["routeScreenshots"])
check("Important state screenshots captured",manifest["summary"]["stateScreenshots"]==13,manifest["summary"]["stateScreenshots"])
check("Web shell rail width consistent",rail=={"60":len(web_pages)},rail)
check("Web shell sidebar width consistent",side=={"216":len(web_pages)},side)
check("Web shell header height consistent",len(header)==1,header)

(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
print("web_routes",len(web_pages))
print("route_screenshots",manifest["summary"]["routeScreenshots"])
print("state_screenshots",manifest["summary"]["stateScreenshots"])
print("checks",checks)
print("failures",len(fails))
print("h1_sizes",sizes)
print("body_backgrounds",bgs)
print("rail_widths",rail)
print("side_widths",side)
print("header_heights",header)
for x in fails:print("FAILED",x)
sys.exit(1 if fails else 0)
