from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step44h-c-page-architecture-cleanup"
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
    print(("PASS " if ok else "FAIL ")+name+(((" :: "+str(detail)) if detail else "")))
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
    def ev(self,expression):
        result=self.call("Runtime.evaluate",{
            "expression":expression,"returnByValue":True,"awaitPromise":True,
        })
        if "exceptionDetails" in result: raise RuntimeError(str(result["exceptionDetails"]))
        return result.get("result",{}).get("value")
    def viewport(self,width,height=900):
        self.call("Emulation.setDeviceMetricsOverride",{
            "width":width,"height":height,"deviceScaleFactor":1,"mobile":False,
        })
    def navigate(self,url):
        self.call("Page.navigate",{"url":url})
    def shot(self,name):
        data=self.call("Page.captureScreenshot",{
            "format":"png","fromSurface":True,"captureBeyondViewport":False,
        })["data"]
        (OUT/name).write_bytes(base64.b64decode(data))

def wait(c,expr,timeout=15):
    deadline=time.time()+timeout
    while time.time()<deadline:
        try:
            value=c.ev(expr)
            if value: return value
        except Exception:
            pass
        time.sleep(.1)
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
    if ready: time.sleep(.2)
    return bool(ready)

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

def click_text(c,text_value):
    return c.ev("""(()=>{const t=%s;const e=[...document.querySelectorAll('button,a')].find(x=>(x.textContent||'').trim()===t);if(!e)return false;e.click();return true})()""" % json.dumps(text_value))

def close_overlay(c):
    c.ev("""(()=>{const b=document.querySelector('.inno-overlay-close');if(!b)return false;b.click();return true})()""")
    wait(c,"!document.querySelector('.inno-overlay')",4)

def discover_from_first_row(c,route):
    if not nav(c,route): return ""
    ready=wait(c,"!!document.querySelector('.inno-collection tbody .action-column .inno-row-action')",7)
    if not ready: return ""
    c.ev("""(()=>{const b=document.querySelector('.inno-collection tbody .action-column .inno-row-action');if(!b)return false;b.click();return true})()""")
    return wait(c,"location.pathname!=="+json.dumps(route)+" ? location.pathname : ''",7) or ""

c=CDP()
c.viewport(1366)
logged=login(c)
check("Keycloak login completes",logged,c.ev("location.href") or "")
if not logged:
    print("step44h_c_browser_blocked=authentication_or_infra")
    print(f"step44h_c_browser_checks={checks}")
    print(f"step44h_c_browser_failures={len(failures)}")
    sys.exit(2)

# Software Baselines list and create route.
baseline_route=""
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} baseline list ready",nav(c,"/assets/software-baselines"))
    body=c.ev("document.body.innerText") or ""
    check(f"{width} baseline list has no embedded evaluation","Evaluation results" not in body)
    check(f"{width} baseline list has no embedded editor","Save Baseline" not in body and "Edit baseline" not in body)
    check(f"{width} baseline list no overflow",no_overflow(c))
    c.shot(f"{width}__software-baselines.png")
    if width==1366:
        baseline_route=discover_from_first_row(c,"/assets/software-baselines")
        check("baseline Open navigates to detail",baseline_route.startswith("/assets/software-baselines/baseline_"),baseline_route)

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} baseline create ready",nav(c,"/assets/software-baselines/new"))
    body=c.ev("document.body.innerText") or ""
    check(f"{width} baseline create owns editor","New software baseline" in body and "Create Baseline" in body)
    check(f"{width} baseline create excludes evaluation","Evaluation results" not in body)
    check(f"{width} baseline create no overflow",no_overflow(c))
    c.shot(f"{width}__software-baseline-new.png")

if baseline_route:
    for width in WIDTHS:
        c.viewport(width)
        check(f"{width} baseline detail ready",nav(c,baseline_route))
        body=c.ev("document.body.innerText") or ""
        check(f"{width} baseline detail has evaluation","Evaluation results" in body)
        check(f"{width} baseline detail has no editor","Save Baseline" not in body)
        check(f"{width} baseline detail no overflow",no_overflow(c))
        c.shot(f"{width}__software-baseline-detail.png")
        edit_route=baseline_route+"/edit"
        check(f"{width} baseline edit ready",nav(c,edit_route))
        body=c.ev("document.body.innerText") or ""
        check(f"{width} baseline edit owns editor","Edit software baseline" in body and "Save Baseline" in body)
        check(f"{width} baseline edit excludes evaluation","Evaluation results" not in body)
        check(f"{width} baseline edit no overflow",no_overflow(c))
        c.shot(f"{width}__software-baseline-edit.png")

# Device Groups create dialog + detail edit dialog.
group_route=""
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} device groups ready",nav(c,"/devices/groups"))
    check(f"{width} device groups no embedded create panel",c.ev("!document.querySelector('.create-panel')") is True)
    check(f"{width} device groups no overflow",no_overflow(c))
    c.shot(f"{width}__device-groups.png")
    if width==1366:
        check("New Device Group action dispatched",bool(click_text(c,"New Device Group")))
        check("New Device Group opens dialog",bool(wait(c,"!!document.querySelector('.inno-overlay--dialog #device-group-create-form')",5)))
        check("device group create dialog has three fields",c.ev("document.querySelectorAll('#device-group-create-form .field-block').length===3") is True)
        c.shot("1366__device-groups__create-dialog.png")
        close_overlay(c)
        group_route=discover_from_first_row(c,"/devices/groups")
        check("device group Open navigates to detail",group_route.startswith("/devices/groups/group_"),group_route)

if group_route:
    for width in WIDTHS:
        c.viewport(width)
        check(f"{width} device group detail ready",nav(c,group_route))
        check(f"{width} device group detail tabs remain",c.ev("document.querySelectorAll('[role=tab]').length>=2") is True)
        check(f"{width} device group detail no inline editor",c.ev("!document.querySelector('.prod-panel > .editor-form')") is True)
        check(f"{width} device group detail no overflow",no_overflow(c))
        c.shot(f"{width}__device-group-detail.png")
        if width==1366:
            check("Edit Group action dispatched",bool(click_text(c,"Edit Group")))
            check("Edit Group opens dialog",bool(wait(c,"!!document.querySelector('.inno-overlay--dialog #device-group-edit-form')",5)))
            check("device group edit dialog has three fields",c.ev("document.querySelectorAll('#device-group-edit-form .field-block').length===3") is True)
            check("tabs remain mounted behind edit dialog",c.ev("document.querySelectorAll('[role=tab]').length>=2") is True)
            c.shot("1366__device-group-detail__edit-dialog.png")
            close_overlay(c)

# Asset detail is read only; multi-section edit route; owner is separate dialog.
asset_route=discover_from_first_row(c,"/assets/inventory")
check("asset Open navigates to detail",asset_route.startswith("/assets/asset_"),asset_route)
if asset_route:
    for width in WIDTHS:
        c.viewport(width)
        check(f"{width} asset detail ready",nav(c,asset_route))
        check(f"{width} asset detail has no generic editor",c.ev("!document.querySelector('.asset-editor-route') && ![...document.querySelectorAll('button')].some(b=>(b.textContent||'').trim()==='Save Asset')") is True)
        check(f"{width} asset detail exposes Edit Asset","Edit Asset" in (c.ev("document.body.innerText") or ""))
        check(f"{width} asset detail no overflow",no_overflow(c))
        c.shot(f"{width}__asset-detail.png")
        if width==1366:
            check("Change Owner action dispatched",bool(click_text(c,"Change Owner")))
            check("Change Owner opens dialog",bool(wait(c,"!!document.querySelector('.inno-overlay--dialog') && document.body.innerText.includes('Change Asset Owner')",5)))
            c.shot("1366__asset-detail__owner-dialog.png")
            close_overlay(c)
        check(f"{width} asset edit ready",nav(c,asset_route+"/edit"))
        check(f"{width} asset edit has multi-section editor",c.ev("document.querySelectorAll('.asset-editor-route .editor-section').length>=2") is True)
        check(f"{width} asset edit has Save Asset","Save Asset" in (c.ev("document.body.innerText") or ""))
        check(f"{width} asset edit no overflow",no_overflow(c))
        c.shot(f"{width}__asset-edit.png")

# Ticket reassign dialog.
ticket_route=discover_from_first_row(c,"/helpdesk/tickets")
check("ticket Open navigates to detail",ticket_route.startswith("/helpdesk/tickets/ticket_"),ticket_route)
if ticket_route:
    for width in WIDTHS:
        c.viewport(width)
        check(f"{width} ticket detail ready",nav(c,ticket_route))
        check(f"{width} ticket has no inline assign panel",c.ev("!document.querySelector('.ticket-assign-panel')") is True)
        check(f"{width} ticket detail no overflow",no_overflow(c))
        c.shot(f"{width}__ticket-detail.png")
        if width==1366 and "Reassign" in (c.ev("document.body.innerText") or ""):
            check("Reassign action dispatched",bool(click_text(c,"Reassign")))
            check("Reassign opens dialog",bool(wait(c,"!!document.querySelector('.inno-overlay--dialog') && document.body.innerText.includes('Reassign Ticket')",5)))
            check("Reassign dialog has two fields",c.ev("document.querySelectorAll('.inno-overlay--dialog .field-block').length===2") is True)
            c.shot("1366__ticket-detail__reassign-dialog.png")
            close_overlay(c)

# Admin Apps technical inspect drawer.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} admin apps ready",nav(c,"/admin/apps"))
    check(f"{width} admin apps native details removed",c.ev("!document.querySelector('.production-module-row details')") is True)
    check(f"{width} admin apps no overflow",no_overflow(c))
    c.shot(f"{width}__admin-apps.png")
    if width==1366:
        check("Admin Apps Inspect dispatched",bool(click_text(c,"Inspect")))
        check("Admin Apps Inspect opens drawer",bool(wait(c,"!!document.querySelector('.inno-overlay--drawer')",5)))
        body=c.ev("document.body.innerText") or ""
        check("Admin Apps drawer has manifest metadata",all(x in body for x in ["Entry permission","Dependencies","Capabilities","Events"]))
        c.shot("1366__admin-apps__inspect-drawer.png")
        close_overlay(c)

# SLA remains intentionally P05 settings.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} SLA settings ready",nav(c,"/helpdesk/sla"))
    body=c.ev("document.body.innerText") or ""
    check(f"{width} SLA policy remains primary","SLA & Escalation" in body and "Policy behavior" in body and "Save Policy" in body)
    check(f"{width} SLA monitor remains supporting context","Live SLA monitor" in body)
    check(f"{width} SLA no overflow",no_overflow(c))
    c.shot(f"{width}__helpdesk-sla.png")

print(f"step44h_c_browser_checks={checks}")
print(f"step44h_c_browser_failures={len(failures)}")
print(f"step44h_c_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
