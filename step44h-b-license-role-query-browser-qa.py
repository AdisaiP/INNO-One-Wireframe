from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step44h-b-license-role-query"
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
            "expression":expression,"returnByValue":True,"awaitPromise":True,
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

# Software Licenses list and new resource-detail architecture.
license_route=""
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} software licenses ready",nav(c,"/assets/software-licenses"))
    check(f"{width} software licenses no drawer",c.ev("!document.querySelector('.inno-overlay--drawer,.license-drawer-content')") is True)
    check(f"{width} software licenses no overflow",no_overflow(c))
    check(f"{width} software licenses has open action",bool(wait(c,"!!document.querySelector('.license-table tbody .inno-row-action')",8)))
    c.shot(f"{width}__software-licenses.png")
    if width==1366:
        clicked=c.ev("""(()=>{const b=document.querySelector('.license-table tbody .inno-row-action');if(!b)return false;b.click();return true})()""")
        check("software license Open dispatched",bool(clicked))
        license_route=wait(c,"location.pathname.startsWith('/assets/software-licenses/license_') ? location.pathname : ''",8) or ""
        check("software license Open navigates to detail",bool(license_route),license_route)

if license_route:
    for width in WIDTHS:
        c.viewport(width)
        check(f"{width} software license detail ready",nav(c,license_route))
        body=c.ev("document.body.innerText") or ""
        check(f"{width} entitlement and renewal visible","Entitlement & Renewal" in body)
        check(f"{width} detected allocations visible","Detected allocations" in body)
        check(f"{width} ambiguous License record removed","License record" not in body)
        check(f"{width} software license detail no overflow",no_overflow(c))
        c.shot(f"{width}__software-license-detail.png")
        if width==1366:
            edit=c.ev("""[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim()==='Edit Entitlement')?.click();true""")
            check("Edit Entitlement action dispatched",bool(edit))
            opened=bool(wait(c,"!!document.querySelector('.inno-overlay--dialog .editor-form')",5))
            check("Edit Entitlement opens dialog",opened)
            if opened:
                check("entitlement dialog title correct",c.ev("document.querySelector('.inno-overlay--dialog h2')?.textContent==='Edit Entitlement & Renewal'") is True)
                check("entitlement dialog owns five fields",c.ev("document.querySelectorAll('.inno-overlay--dialog .field-block').length===5") is True)
                c.shot("1366__software-license-edit-dialog.png")
                close_overlay(c)

# Roles: dynamic list + permission assignment.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} roles ready",nav(c,"/admin/roles"))
    text=c.ev("document.body.innerText") or ""
    check(f"{width} roles has New Role","New Role" in text)
    check(f"{width} roles no read-only boundary","System roles are read-only" not in text)
    check(f"{width} roles has permission matrix","Permission matrix" in text)
    check(f"{width} roles no overflow",no_overflow(c))
    c.shot(f"{width}__roles.png")
    if width==1366:
        clicked=c.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='New Role');if(!b)return false;b.click();return true})()""")
        check("New Role action dispatched",bool(clicked))
        opened=bool(wait(c,"!!document.querySelector('.inno-overlay--drawer .admin-role-editor')",5))
        check("New Role opens drawer",opened)
        if opened:
            check("role editor has code name status",c.ev("document.querySelectorAll('.admin-role-editor .field-block').length>=3") is True)
            check("role editor exposes permissions",c.ev("document.querySelectorAll('.admin-permission-option input[type=checkbox]').length>0") is True)
            check("role editor groups permissions",c.ev("document.querySelectorAll('.admin-permission-group').length>=3") is True)
            c.shot("1366__roles__new-role.png")
            populated=c.ev("""(()=> {
              const inputs=[...document.querySelectorAll('.admin-role-editor input')];
              if(inputs.length<2)return false;
              const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
              setter.call(inputs[0],'device_viewer'); inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
              setter.call(inputs[1],'Duplicate QA'); inputs[1].dispatchEvent(new Event('input',{bubbles:true}));
              return true;
            })()""")
            check("New Role duplicate test populated",bool(populated))
            time.sleep(.2)
            submitted=c.ev("""(()=>{const b=[...document.querySelectorAll('.inno-overlay--drawer button')].find(x=>(x.textContent||'').trim()==='Create Role');if(!b||b.disabled)return false;b.click();return true})()""")
            check("Create Role POST dispatched",bool(submitted))
            conflict=bool(wait(c,"document.body.innerText.includes('Role code already exists')",6))
            check("Create Role POST reaches duplicate guard",conflict)
            close_overlay(c)

        # Edit a non-platform role without saving, to verify stable-code edit contract.
        edit_clicked=c.ev("""(()=>{const rows=[...document.querySelectorAll('.admin-role-catalog tbody tr')];const row=rows.find(r=>!r.textContent.includes('Platform Admin'));const b=row?.querySelector('.inno-row-action');if(!b)return false;b.click();return true})()""")
        check("Edit Role action dispatched",bool(edit_clicked))
        edit_open=bool(wait(c,"!!document.querySelector('.inno-overlay--drawer .admin-role-editor')",5))
        check("Edit Role opens drawer",edit_open)
        if edit_open:
            check("edit role code is immutable",c.ev("document.querySelector('.admin-role-editor input')?.disabled===true") is True)
            check("edit role permission assignments loaded",c.ev("document.querySelectorAll('.admin-permission-option input[type=checkbox]:checked').length>0") is True)
            c.shot("1366__roles__edit-role.png")
            saved=c.ev("""(()=>{const b=[...document.querySelectorAll('.inno-overlay--drawer button')].find(x=>(x.textContent||'').trim()==='Save Role');if(!b||b.disabled)return false;b.click();return true})()""")
            check("Save Role PUT dispatched",bool(saved))
            check("Save Role PUT succeeds",bool(wait(c,"!document.querySelector('.inno-overlay--drawer')",8)))

# Inventory Query: full-width builder, saved queries drawer, no dead Fact control.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} inventory query ready",nav(c,"/devices/query"))
    page_w=c.ev("document.querySelector('.inno-page')?.getBoundingClientRect().width||0") or 0
    builder_w=c.ev("document.querySelector('.inventory-query-builder')?.getBoundingClientRect().width||0") or 0
    check(f"{width} inventory builder owns page width",builder_w>page_w*.94,{"builder":builder_w,"page":page_w})
    check(f"{width} inventory has clause builder",c.ev("!!document.querySelector('.inventory-clause-block')") is True)
    check(f"{width} inventory has readable summary",c.ev("!!document.querySelector('.inventory-query-summary')") is True)
    check(f"{width} inventory removed disabled Fact control",c.ev("![...document.querySelectorAll('.field-block > span')].some(x=>x.textContent.trim()==='Fact')") is True)
    check(f"{width} inventory removed dark query preview",c.ev("!document.querySelector('.inventory-query-preview')") is True)
    check(f"{width} inventory no overflow",no_overflow(c))
    c.shot(f"{width}__inventory-query.png")
    if width==1366:
        clicked=c.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Saved Queries');if(!b)return false;b.click();return true})()""")
        check("Saved Queries action dispatched",bool(clicked))
        opened=bool(wait(c,"!!document.querySelector('.inno-overlay--drawer .inventory-saved-drawer-body')",5))
        check("Saved Queries opens drawer",opened)
        if opened:
            check("Saved Queries drawer has saved definitions or state",c.ev("!!document.querySelector('.inventory-saved-list,.inno-collection-state')") is True)
            c.shot("1366__inventory-query__saved-drawer.png")
            close_overlay(c)

        # Scope should progressively reveal Device Group rather than show a disabled field.
        revealed=c.ev("""(()=>{const s=[...document.querySelectorAll('.inventory-query-setup select')][0];if(!s)return false;s.value='group';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()""")
        check("inventory group scope change dispatched",bool(revealed))
        check("inventory Device Group field reveals on demand",bool(wait(c,"[...document.querySelectorAll('.inventory-query-setup .field-block > span')].some(x=>x.textContent.trim()==='Device Group')",4)))

print(f"step44h_b_browser_checks={checks}")
print(f"step44h_b_browser_failures={len(failures)}")
print(f"step44h_b_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
