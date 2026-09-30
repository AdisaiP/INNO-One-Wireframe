from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step42_2g-responsive"
PORT = 9241
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
WIDTHS = (1366, 1024, 768)

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

checks = 0
fails = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        fails.append((name, detail))

class CDP:
    def __init__(self):
        targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=3).json()
        page = next(x for x in targets if x.get("type") == "page")
        self.ws = websocket.create_connection(
            page["webSocketDebuggerUrl"], timeout=10, origin="http://127.0.0.1"
        )
        self.n = 0
        self.call("Page.enable")
        self.call("Runtime.enable")

    def call(self, method, params=None):
        self.n += 1
        ident = self.n
        self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == ident:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result", {})

    def ev(self, expr):
        result = self.call("Runtime.evaluate", {
            "expression": expr, "returnByValue": True, "awaitPromise": True,
        })
        return result.get("result", {}).get("value")

    def viewport(self, width, height=900):
        self.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 1, "mobile": False,
        })
    def navigate(self, route):
        self.call("Page.navigate", {"url": "http://localhost:5180" + route})

    def shot(self, name):
        data = self.call("Page.captureScreenshot", {
            "format": "png", "fromSurface": True, "captureBeyondViewport": False,
        })["data"]
        (OUT / name).write_bytes(base64.b64decode(data))

def realm_password(username):
    realm = json.loads(REALM.read_text(encoding="utf-8"))
    user = next(x for x in realm["users"] if x["username"] == username)
    return user["credentials"][0]["value"]

def ensure_login(c):
    c.viewport(1366)
    c.navigate("/")
    password = realm_password("adisai")
    deadline = time.time() + 35
    while time.time() < deadline:
        href = c.ev("location.href") or ""
        if ("172.10.1.58:8080" in href or "localhost:8080" in href) and c.ev("!!document.querySelector('#kc-login')"):
            c.ev(
                "document.querySelector('#username').value='adisai';"
                + "document.querySelector('#password').value=" + json.dumps(password) + ";"
                + "document.querySelector('#kc-login').click();"
            )
            time.sleep(.7)
        if href.startswith("http://localhost:5180") and c.ev("!!document.querySelector('.inno-production-shell')"):
            return True
        time.sleep(.2)
    return False

def wait(c, expr, timeout=12):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            value = c.ev(expr)
            if value:
                return value
        except Exception:
            pass
        time.sleep(.1)
    return None

def nav(c, route):
    c.navigate(route)
    return bool(wait(
        c,
        "!!document.querySelector('.inno-production-shell') && !!document.querySelector('.inno-page,.workspace-home-page,.internal-ds-page,.page-loading-wrap,.page-error-wrap')",
        12,
    ))

c = CDP()
check("authenticated production session", ensure_login(c), c.ev("location.href"))
if not c.ev("location.href").startswith("http://localhost:5180"):
    print("FAILED authenticated production session")
    sys.exit(1)
c.ev("localStorage.setItem('inno.ui.sidebar.collapsed','0')")

for width, rail, side in ((1600, 72, 248), (1599, 64, 232)):
    c.viewport(width)
    check(f"{width} shell boundary ready", nav(c, "/"))
    boundary = c.ev("""(()=>{
      const r=document.querySelector('.prod-rail')?.getBoundingClientRect();
      const s=document.querySelector('.prod-side')?.getBoundingClientRect();
      return {rail:Math.round(r?.width||0),side:Math.round(s?.width||0),overflow:document.documentElement.scrollWidth>innerWidth+2};
    })()""")
    check(f"{width} shell boundary ownership",
          boundary["rail"] == rail and boundary["side"] == side and not boundary["overflow"], boundary)

expected_rail = {1366: 60, 1024: 58, 768: 56}

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} shell ready", nav(c, "/"))
    shell = c.ev("""(()=> {
      const rail=document.querySelector('.prod-rail');
      const side=document.querySelector('.prod-side');
      const reveal=document.querySelector('.prod-context-reveal');
      const page=document.querySelector('.inno-page,.workspace-home-page');
      const rr=rail.getBoundingClientRect(), sr=side.getBoundingClientRect(), pr=page.getBoundingClientRect();
      const pcs=getComputedStyle(page), rcs=getComputedStyle(reveal), scs=getComputedStyle(side);
      return {
        rail:Math.round(rr.width), side:Math.round(sr.width), sideDisplay:scs.display,
        revealDisplay:rcs.display, revealText:(reveal.textContent||'').trim(),
        pageLeft:Math.round(pr.left), paddingTop:parseFloat(pcs.paddingTop),
        paddingRight:parseFloat(pcs.paddingRight), paddingBottom:parseFloat(pcs.paddingBottom),
        paddingLeft:parseFloat(pcs.paddingLeft),
        sideOpen:document.querySelector('.inno-production-shell').classList.contains('side-open'),
        overflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
    check(f"{width} frozen rail width", shell["rail"] == expected_rail[width], shell)
    check(f"{width} no page overflow", not shell["overflow"], shell)
    if width == 1366:
        check("1366 context sidebar inline",
              shell["sideDisplay"] != "none" and shell["side"] == 216 and shell["revealDisplay"] == "none", shell)
        check("1366 canonical page gutter",
              shell["paddingTop"] == 24 and shell["paddingRight"] == 16
              and shell["paddingBottom"] == 32 and shell["paddingLeft"] == 16, shell)
    else:
        check(f"{width} sidebar starts off-canvas closed",
              shell["sideDisplay"] == "none" and shell["revealDisplay"] != "none" and not shell["sideOpen"], shell)
        check(f"{width} contextual reveal is labeled", bool(shell["revealText"]), shell)
        clicked = c.ev("""(()=> {
          const b=document.querySelector('.prod-context-reveal');
          if(!b)return false;
          b.click();
          return true;
        })()""")
        opened = wait(c, """document.querySelector('.inno-production-shell').classList.contains('side-open')
          && getComputedStyle(document.querySelector('.prod-side')).display!=='none'
          && !!document.querySelector('.prod-side-backdrop')""", 3)
        check(f"{width} contextual drawer opens", bool(clicked and opened))
        c.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        closed = wait(c, "!document.querySelector('.inno-production-shell').classList.contains('side-open')", 3)
        check(f"{width} Escape closes contextual drawer", bool(closed))
    c.shot(f"{width}__workspace.png")
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} devices collection ready", nav(c, "/devices"))
    check(f"{width} collection anatomy mounted", bool(wait(
        c,
        "!!document.querySelector('.inno-collection-toolbar .inno-search') && !!document.querySelector('.inno-table-wrap')",
        8,
    )))
    cm = c.ev("""(()=> {
      const bar=document.querySelector('.inno-collection-toolbar');
      const search=bar.querySelector('.inno-search');
      const select=bar.querySelector('.inno-select');
      const wrap=document.querySelector('.inno-table-wrap');
      const action=document.querySelector('.inno-table-wrap tbody td.action-column');
      const br=bar.getBoundingClientRect(), sr=search.getBoundingClientRect();
      const fr=select?.getBoundingClientRect();
      return {
        searchRatio:sr.width/br.width,
        sameRow:fr?Math.abs(sr.top-fr.top)<4:true,
        tableOverflow:wrap.scrollWidth>wrap.clientWidth+2,
        actionPosition:action?getComputedStyle(action).position:'',
        pageOverflow:document.documentElement.scrollWidth>innerWidth+2,
        toolbarOverflow:bar.scrollWidth>bar.clientWidth+2
      };
    })()""")
    if width > 850:
        check(f"{width} collection search remains inline",
              cm["sameRow"] and cm["searchRatio"] < .7, cm)
    else:
        check("768 collection search owns first row",
              (not cm["sameRow"]) and cm["searchRatio"] > .9, cm)
        check("768 action column sticks within table", cm["actionPosition"] == "sticky", cm)
    check(f"{width} collection overflow remains local",
          not cm["pageOverflow"] and not cm["toolbarOverflow"], cm)
    if width in (1024, 768):
        c.shot(f"{width}__devices.png")
c.viewport(1366)
nav(c, "/devices")
device_href = wait(c, """(()=>document.querySelector("a[href^='/devices/dev_']")?.getAttribute('href')||'')()""", 8)
check("device detail discovered", bool(device_href), device_href)

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} device detail ready", nav(c, device_href))
    check(f"{width} resource anatomy mounted", bool(wait(
        c,
        "!!document.querySelector('.inno-resource-head') && !!document.querySelector('.inno-resource-summary') && !!document.querySelector('.inno-surface-tabs')",
        8,
    )))
    rm = c.ev("""(()=> {
      const head=document.querySelector('.inno-resource-head');
      const summary=document.querySelector('.inno-resource-summary');
      const items=[...summary.children];
      const tabs=document.querySelector('.inno-surface-tabs');
      const first=head.firstElementChild?.getBoundingClientRect();
      const actions=head.querySelector('.inno-resource-actions')?.getBoundingClientRect();
      const tops=items.map(x=>Math.round(x.getBoundingClientRect().top));
      return {
        headDirection:getComputedStyle(head).flexDirection,
        headStacked:first&&actions?Math.abs(first.top-actions.top)>4:false,
        summaryRows:new Set(tops).size,
        summaryColumns:getComputedStyle(summary).gridTemplateColumns.split(' ').filter(Boolean).length,
        tabsLocal:tabs.scrollWidth>=tabs.clientWidth,
        pageOverflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
    if width > 850:
        check(f"{width} resource head remains inline", rm["headDirection"] == "row", rm)
        check(f"{width} resource summary keeps four columns",
              rm["summaryColumns"] == 4 and rm["summaryRows"] == 1, rm)
    else:
        check("768 resource head stacks", rm["headDirection"] == "column", rm)
        check("768 resource summary becomes two columns",
              rm["summaryColumns"] == 2 and rm["summaryRows"] == 2, rm)
    check(f"{width} resource tabs stay locally scrollable",
          rm["tabsLocal"] and not rm["pageOverflow"], rm)
    if width in (1366, 768):
        c.shot(f"{width}__device-detail.png")
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} ticket editor ready", nav(c, "/helpdesk/tickets/new"))
    check(f"{width} editor footer mounted", bool(wait(c, "!!document.querySelector('.inno-editor-footer')", 8)))
    fm = c.ev("""(()=> {
      const f=document.querySelector('.inno-editor-footer');
      const main=document.querySelector('.prod-main');
      const r=f.getBoundingClientRect(), mr=main.getBoundingClientRect(), cs=getComputedStyle(f);
      return {
        wrap:cs.flexWrap, dir:cs.flexDirection,
        left:r.left, right:r.right, mainLeft:mr.left, mainRight:mr.right,
        overflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
    check(f"{width} editor footer stays inside main",
          fm["left"] >= fm["mainLeft"]-2 and fm["right"] <= fm["mainRight"]+2 and not fm["overflow"], fm)
    if width > 850:
        check(f"{width} editor footer remains single-row contract", fm["wrap"] == "nowrap", fm)
    else:
        check("768 editor footer allows controlled wrapping", fm["wrap"] == "wrap", fm)

    check(f"{width} design system ready", nav(c, "/internal/design-system"))
    check(f"{width} state banner mounted", bool(wait(c, "!!document.querySelector('.inno-state.banner')", 8)))
    c.ev("document.querySelector('#states')?.scrollIntoView({block:'start'})")
    time.sleep(.15)
    sm = c.ev("""(()=> {
      const b=document.querySelector('.inno-state.banner');
      const a=b?.querySelector('.inno-state-actions');
      if(!b)return null;
      const br=b.getBoundingClientRect(), ar=a?.getBoundingClientRect(), cs=getComputedStyle(b);
      return {
        wrap:cs.flexWrap, actionRatio:ar?ar.width/br.width:0,
        overflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
    if width > 850:
        check(f"{width} state banner remains inline",
              sm and sm["wrap"] == "nowrap" and sm["actionRatio"] < .6, sm)
    else:
        check("768 state banner wraps actions below",
              sm and sm["wrap"] == "wrap" and sm["actionRatio"] > .85, sm)
    check(f"{width} state banner has no page overflow", sm and not sm["overflow"], sm)
print(f"step42_2g_responsive_checks={checks}")
print(f"step42_2g_responsive_failures={len(fails)}")
if fails:
    for item in fails:
        print("FAILED", item)
    sys.exit(1)
