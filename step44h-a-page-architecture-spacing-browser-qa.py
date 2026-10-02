from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step44h-a-page-architecture-spacing"
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
        deadline=time.time()+12
        targets=None
        while time.time()<deadline:
            try:
                targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=1).json()
                if targets:
                    break
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
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result",{})
    def ev(self,expression):
        result=self.call("Runtime.evaluate",{
            "expression":expression,
            "returnByValue":True,
            "awaitPromise":True,
        })
        if "exceptionDetails" in result:
            raise RuntimeError(str(result["exceptionDetails"]))
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
            if value:
                return value
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
    if ready:
        time.sleep(.25)
    return bool(ready)

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

def close_overlay(c):
    c.ev("""(()=>{const b=document.querySelector('.inno-overlay-close');if(!b)return false;b.click();return true})()""")
    wait(c,"!document.querySelector('.inno-overlay')",4)

c=CDP()
c.viewport(1366)
check("Keycloak login completes",login(c),c.ev("location.href") or "")
# Organization / Locations: full-width hierarchy with focused drawer and connector lines.
for route,label in [("/admin/organization","organization"),("/admin/locations","locations")]:
    for width in WIDTHS:
        c.viewport(width)
        check(f"{width} {label} route ready",nav(c,route))
        check(f"{width} {label} no permanent side editor",c.ev("!document.querySelector('.admin-master-detail,.admin-editor-panel')") is True)
        tree_width=c.ev("document.querySelector('.admin-hierarchy-collection')?.getBoundingClientRect().width||0") or 0
        page_width=c.ev("document.querySelector('.inno-page')?.getBoundingClientRect().width||0") or 0
        check(f"{width} {label} hierarchy owns page width",tree_width>page_width*0.9,{"tree":tree_width,"page":page_width})
        check(f"{width} {label} no overflow",no_overflow(c))
        if width==1366:
            nested=bool(wait(c,"[...document.querySelectorAll('.inno-tree-row[data-level]')].some(r=>Number(r.dataset.level)>1)",5))
            if label=="organization":
                check("organization nested hierarchy row exists",nested)
                connector=c.ev("""(()=>{const r=[...document.querySelectorAll('.inno-tree-row[data-level]')].find(x=>Number(x.dataset.level)>1);if(!r)return null;const s=getComputedStyle(r,'::before');return {style:s.borderLeftStyle,width:s.borderLeftWidth,color:s.borderLeftColor}})()""")
                check("organization hierarchy connector visible",bool(connector and connector.get("style")!="none" and connector.get("width")!="0px"),connector or "")
            else:
                check("locations hierarchy renders current records",c.ev("document.querySelectorAll('.inno-tree-row').length>=1") is True)
            clicked=c.ev("""(()=>{const b=document.querySelector('.inno-tree-item');if(!b)return false;b.click();return true})()""")
            check(f"{label} hierarchy row click dispatched",bool(clicked))
            check(f"{label} row opens drawer",bool(wait(c,"!!document.querySelector('.inno-overlay--drawer .inno-drawer')",5)))
            check(f"{label} drawer has editor fields",c.ev("document.querySelectorAll('.inno-overlay--drawer .field-block').length>=4") is True)
            c.shot(f"1366__{label}__drawer.png")
            close_overlay(c)
        if width==768:
            c.shot(f"768__{label}.png")
# Audit: history table remains primary and detail is a drawer.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} audit route ready",nav(c,"/admin/audit"))
    check(f"{width} audit table full surface",c.ev("!!document.querySelector('.admin-audit-collection') && !document.querySelector('.admin-audit-layout')") is True)
    check(f"{width} audit no permanent detail panel",c.ev("!document.querySelector('.prod-panel.admin-audit-detail')") is True)
    check(f"{width} audit no overflow",no_overflow(c))
    if width==1366:
        ready=bool(wait(c,"!!document.querySelector('.admin-audit-collection tbody .inno-row-action')",8))
        check("audit Open action ready",ready)
        if ready:
            c.ev("document.querySelector('.admin-audit-collection tbody .inno-row-action').click();true")
            check("audit Open opens drawer",bool(wait(c,"!!document.querySelector('.inno-overlay--drawer .inno-drawer')",6)))
            check("audit drawer renders immutable detail",bool(wait(c,"document.querySelector('.audit-detail-list')?.textContent.includes('Audit ID')",8)))
            c.shot("1366__audit__drawer.png")
            close_overlay(c)
    if width==768:
        c.shot("768__audit.png")

# Roles: clarify immutable role catalog and visually separate matrix.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} roles route ready",nav(c,"/admin/roles"))
    check(f"{width} roles read-only note visible",c.ev("document.body.innerText.includes('System roles are read-only')") is True)
    gap=c.ev("""(()=>{const a=document.querySelector('.admin-role-catalog');const b=document.querySelector('.admin-permission-collection');if(!a||!b)return -1;return Math.round(b.getBoundingClientRect().top-a.getBoundingClientRect().bottom)})()""")
    check(f"{width} role catalog and permission matrix separated",gap>=24,gap)
    check(f"{width} roles no fake create action",c.ev("![...document.querySelectorAll('button,a')].some(x=>/New Role|Create Role/.test((x.textContent||'').trim()))") is True)
    check(f"{width} roles no overflow",no_overflow(c))
    if width in (1366,768):
        c.shot(f"{width}__roles.png")
# Access Scopes: assignments list primary, Evaluate Access is dialog utility.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} access scopes route ready",nav(c,"/admin/access-scopes"))
    check(f"{width} access has one primary collection",c.ev("document.querySelectorAll('.inno-page > .inno-collection').length===1") is True)
    evaluate_ready=c.ev("""[...document.querySelectorAll('button')].some(b=>(b.textContent||'').trim()==='Evaluate Access')""") is True
    check(f"{width} Evaluate Access header action visible",evaluate_ready)
    check(f"{width} access no overflow",no_overflow(c))
    if width==1366 and evaluate_ready:
        c.ev("""[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='Evaluate Access').click();true""")
        check("Evaluate Access opens dialog",bool(wait(c,"!!document.querySelector('.inno-overlay--dialog .inno-dialog')",5)))
        check("Evaluate dialog has User and Permission",c.ev("document.querySelectorAll('.admin-evaluate-dialog .field-block').length===2") is True)
        c.shot("1366__access-scopes__evaluate-dialog.png")
        close_overlay(c)
    if width==768:
        c.shot("768__access-scopes.png")

# Inventory Query: builder hierarchy and actions.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} inventory query route ready",nav(c,"/devices/query"))
    check(f"{width} standalone fact coverage card removed",c.ev("!document.querySelector('.inventory-fact-coverage')") is True)
    check(f"{width} fact source note visible",c.ev("document.body.innerText.includes('Available fact source')") is True)
    check(f"{width} New Query in builder head",c.ev("!!document.querySelector('.inventory-builder-head-actions') && document.querySelector('.inventory-builder-head-actions')?.innerText.includes('New Query')") is True)
    check(f"{width} Run Query in builder footer",c.ev("!![...document.querySelectorAll('.inventory-query-builder .inno-editor-footer button')].find(b=>(b.textContent||'').includes('Run Query'))") is True)
    check(f"{width} inventory no overflow",no_overflow(c))
    if width==1366:
        saved=bool(wait(c,"!!document.querySelector('.inventory-saved-item')",6))
        check("inventory saved query available",saved)
        if saved:
            c.ev("document.querySelector('.inventory-saved-item').click();true")
            check("selected saved query exposes Save as New",bool(wait(c,"[...document.querySelectorAll('.inventory-query-builder button')].some(b=>(b.textContent||'').trim()==='Save as New')",4)))
        c.shot("1366__inventory-query.png")
    if width==768:
        c.shot("768__inventory-query.png")
# Software Licenses: primary list + focused drawer.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} software licenses route ready",nav(c,"/assets/software-licenses"))
    check(f"{width} software drawer initially closed",c.ev("!document.querySelector('.inno-overlay--drawer')") is True)
    check(f"{width} permanent detail grid absent",c.ev("!document.querySelector('.license-detail-grid')") is True)
    check(f"{width} software no overflow",no_overflow(c))
    if width==1366:
        ready=bool(wait(c,"!!document.querySelector('.license-table tbody .inno-row-action')",6))
        check("software Open action ready",ready)
        if ready:
            c.ev("document.querySelector('.license-table tbody .inno-row-action').click();true")
            check("software Open opens drawer",bool(wait(c,"!!document.querySelector('.inno-overlay--drawer .license-drawer-content')",5)))
            check("software drawer contains allocations and record editor",c.ev("!!document.querySelector('.license-drawer-content .license-allocations') && !!document.querySelector('.license-drawer-content .license-record-panel')") is True)
            c.shot("1366__software-licenses__drawer.png")
            close_overlay(c)
    if width==768:
        c.shot("768__software-licenses.png")

# Asset detail current-owner padding.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} asset detail route ready",nav(c,"/assets/asset_90000000000000000000000000000003"))
    owner_padding=c.ev("""(()=>{const h=[...document.querySelectorAll('.prod-panel-head h3')].find(x=>x.textContent.trim()==='Current owner');const p=h?.closest('.prod-panel');const s=p?.querySelector('.settings-stack');if(!s)return null;const cs=getComputedStyle(s);return {left:parseFloat(cs.paddingLeft),right:parseFloat(cs.paddingRight)}})()""")
    check(f"{width} current owner has horizontal panel padding",bool(owner_padding and owner_padding.get("left",0)>=12 and owner_padding.get("right",0)>=12),owner_padding or "")
    check(f"{width} asset detail no overflow",no_overflow(c))
    if width in (1366,768):
        c.shot(f"{width}__asset-detail.png")
# QR Labels label-setup body padding.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} QR Labels route ready",nav(c,"/assets/qr-labels"))
    qr_padding=c.ev("""(()=>{const e=document.querySelector('.qr-setup-section .editor-form');if(!e)return null;const s=getComputedStyle(e);return {bottom:parseFloat(s.paddingBottom),left:parseFloat(s.paddingLeft),right:parseFloat(s.paddingRight)}})()""")
    check(f"{width} Label setup has full body padding",bool(qr_padding and qr_padding.get("bottom",0)>=12 and qr_padding.get("left",0)>=12 and qr_padding.get("right",0)>=12),qr_padding or "")
    check(f"{width} QR Labels no overflow",no_overflow(c))
    if width in (1366,768):
        c.shot(f"{width}__qr-labels.png")

# Asset Ownership overview spacing and responsive stacking.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} asset ownership route ready",nav(c,"/assets/ownership"))
    gap=c.ev("""(()=>{const a=document.querySelector('.asset-ownership-overview-grid');const b=a?.nextElementSibling;if(!a||!b)return -1;return Math.round(b.getBoundingClientRect().top-a.getBoundingClientRect().bottom)})()""")
    check(f"{width} ownership overview separated from history",gap>=14,gap)
    cols=c.ev("""(()=>{const e=document.querySelector('.asset-ownership-overview-grid');return e?getComputedStyle(e).gridTemplateColumns:''})()""") or ""
    if width<=1024:
        check(f"{width} ownership overview stacks",len(cols.split())==1,cols)
    else:
        check(f"{width} ownership overview uses two columns",len(cols.split())>=2,cols)
    check(f"{width} asset ownership no overflow",no_overflow(c))
    if width in (1366,768):
        c.shot(f"{width}__asset-ownership.png")

print("step44h_a_browser_checks="+str(checks))
print("step44h_a_browser_failures="+str(len(failures)))
print("step44h_a_browser_screenshots="+str(len(list(OUT.glob('*.png')))))
for name,detail in failures:
    print("FAILURE: "+name+" :: "+str(detail))
raise SystemExit(1 if failures else 0)
