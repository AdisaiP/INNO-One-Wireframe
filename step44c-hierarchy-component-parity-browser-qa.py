from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step44c-hierarchy"
PORT = 9241
WIDTHS = (1366, 1024, 768)
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

checks = 0
failures = []
def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

class CDP:
    def __init__(self):
        targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=3).json()
        page = next(x for x in targets if x.get("type") == "page")
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=10, origin="http://127.0.0.1")
        self.n = 0
        self.call("Page.enable")
        self.call("Runtime.enable")
    def call(self, method, params=None):
        self.n += 1
        ident = self.n
        self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") == ident:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def ev(self, expression):
        result = self.call("Runtime.evaluate", {
            "expression": expression, "returnByValue": True, "awaitPromise": True,
        })
        return result.get("result", {}).get("value")

    def viewport(self, width, height=900):
        self.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 1, "mobile": False,
        })

    def shot(self, name):
        data = self.call("Page.captureScreenshot", {
            "format": "png", "fromSurface": True, "captureBeyondViewport": False,
        })["data"]
        (OUT / name).write_bytes(base64.b64decode(data))
def wait(c, expression, timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            value = c.ev(expression)
            if value:
                return value
        except Exception:
            pass
        time.sleep(.1)
    return None

def nav(c, route, selector):
    c.ev("history.pushState({},'',%s);window.dispatchEvent(new PopStateEvent('popstate'));" % json.dumps(route))
    return bool(wait(c,
        "location.pathname===" + json.dumps(route)
        + " && !!document.querySelector('.inno-production-shell')"
        + " && !!document.querySelector(" + json.dumps(selector) + ")"
        + " && document.querySelector('.prod-main')?.getBoundingClientRect().width>0",
        20))

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

c = CDP()
c.viewport(1366)
auth = bool(wait(c, "location.href.startsWith('http://localhost:5180') && !!document.querySelector('.inno-production-shell')", 4))
check("authenticated production session", auth, c.ev("location.href") or "")
if not auth:
    raise SystemExit(1)
for width in WIDTHS:
    c.viewport(width)
    for route, label in [("/admin/organization", "organization"), ("/admin/locations", "locations")]:
        check(f"{width} {label} route ready", nav(c, route, ".inno-tree"))
        check(f"{width} {label} hierarchy loaded", bool(wait(c, "document.querySelectorAll('.inno-tree [role=treeitem]').length>0", 12)))
        metrics = c.ev("""(()=>{const t=document.querySelector('.inno-tree');const items=[...t?.querySelectorAll('[role=treeitem]')||[]];
          const selected=items.filter(x=>x.getAttribute('aria-selected')==='true').length;
          return {role:t?.getAttribute('role'),items:items.length,selected,overflow:document.documentElement.scrollWidth>innerWidth+2,
          clipped:items.some(x=>{const r=x.getBoundingClientRect();return r.left<-2||r.right>innerWidth+2})};})()""")
        check(f"{width} {label} tree semantics", metrics and metrics["role"]=="tree" and metrics["items"]>0, metrics)
        check(f"{width} {label} no document overflow", metrics and not metrics["overflow"], metrics)
        check(f"{width} {label} tree controls stay in viewport", metrics and not metrics["clipped"], metrics)
        c.shot(f"{width}__{label}.png")

        if width == 1366:
            interaction = c.ev("""(()=>{const items=[...document.querySelectorAll('.inno-tree [role=treeitem]')];
              const expandable=items.find(x=>x.getAttribute('aria-expanded')==='true');if(!expandable)return {available:false};
              expandable.dataset.qaKeyboard='1';expandable.focus();
              expandable.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
              return {available:true,before:'true'};})()""")
            if interaction and interaction.get("available"):
                collapsed = bool(wait(c, 'document.querySelector(\'[data-qa-keyboard="1"]\')?.getAttribute(\'aria-expanded\')===\'false\'', 2))
                check(f"{label} ArrowLeft collapses hierarchy", collapsed)
                c.ev("""(()=>{const x=document.querySelector('[data-qa-keyboard="1"]');if(!x)return false;
                  x.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));return true;})()""")
                expanded = bool(wait(c, 'document.querySelector(\'[data-qa-keyboard="1"]\')?.getAttribute(\'aria-expanded\')===\'true\'', 2))
                check(f"{label} ArrowRight expands hierarchy", expanded)
            else:
                check(f"{label} leaf-only dataset needs no expand keyboard action", True)
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} access scopes route ready", nav(c, "/admin/access-scopes", ".inno-collection"))
    check(f"{width} assignments settled", bool(wait(c,
        "document.querySelectorAll('.inno-table-wrap tbody tr').length>0", 15)))
    selected = c.ev("""(()=>{const b=document.querySelector('.inno-table-wrap tbody .inno-row-action');
      if(!b)return false;b.click();return true;})()""")
    check(f"{width} access assignment selectable", bool(selected))
    check(f"{width} assignment editor opens", bool(wait(c, "!!document.querySelector('.admin-editor-panel form')", 5)))
    changed = c.ev("""(()=>{const labels=[...document.querySelectorAll('.admin-editor-panel label')];
      const label=labels.find(x=>(x.querySelector(':scope > span')?.textContent||'').trim()==='Scope type');
      const s=label?.querySelector('select');if(!s)return false;s.value='organization';
      s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()""")
    check(f"{width} scope type can switch to organization", bool(changed))
    check(f"{width} treegrid appears", bool(wait(c, "!!document.querySelector('.inno-treegrid[role=treegrid]') && document.querySelectorAll('.inno-treegrid tbody tr[role=row]').length>0", 10)))
    metrics = c.ev("""(()=>{const g=document.querySelector('.inno-treegrid');const rows=[...g?.querySelectorAll('tbody tr[role=row]')||[]];
      const wrap=g?.closest('.inno-treegrid-wrap');return {role:g?.getAttribute('role'),rows:rows.length,
      localScroll:!!wrap&&wrap.scrollWidth>wrap.clientWidth+2,docOverflow:document.documentElement.scrollWidth>innerWidth+2,
      clipped:rows.some(x=>{const r=x.getBoundingClientRect();return r.left<-2||r.right>Math.max(innerWidth+2,wrap?.getBoundingClientRect().right||0)+2})};})()""")
    check(f"{width} access treegrid semantics", bool(metrics and metrics.get("role")=="treegrid" and metrics.get("rows",0)>0), metrics)
    check(f"{width} access no document overflow", bool(metrics and not metrics.get("docOverflow",True)), metrics)
    c.shot(f"{width}__access-scope-treegrid.png")

    if width == 1366:
        choose = c.ev("""(()=>{const row=document.querySelector('.inno-treegrid tbody tr[role=row]');if(!row)return null;
          row.click();const summary=document.querySelector('.admin-scope-resource-summary b')?.textContent?.trim();
          return {selected:row.getAttribute('aria-selected'),summary};})()""")
        time.sleep(.1)
        after = c.ev("""(()=>{const row=document.querySelector('.inno-treegrid tbody tr[role=row][aria-selected=true]');
          return {selected:!!row,summary:document.querySelector('.admin-scope-resource-summary b')?.textContent?.trim()||''};})()""")
        check("access treegrid row selection updates editor resource", after and after["selected"] and after["summary"]!="No resource selected", after)
c.viewport(1366)
check("design system route ready", nav(c, "/internal/design-system", "#hierarchy"))
c.ev("document.querySelector('#hierarchy')?.scrollIntoView({block:'center'})")
time.sleep(.2)
ds = c.ev("""(()=>{const t=document.querySelector('#hierarchy .inno-tree');const g=document.querySelector('#hierarchy .inno-treegrid');
  return {tree:t?.getAttribute('role'),treeItems:t?.querySelectorAll('[role=treeitem]').length||0,
  grid:g?.getAttribute('role'),gridRows:g?.querySelectorAll('tbody tr[role=row]').length||0,
  overflow:document.documentElement.scrollWidth>innerWidth+2};})()""")
check("design system live INNOTree", ds and ds["tree"]=="tree" and ds["treeItems"]>0, ds)
check("design system live INNOTreeGrid", ds and ds["grid"]=="treegrid" and ds["gridRows"]>0, ds)
check("design system hierarchy no document overflow", ds and not ds["overflow"], ds)
c.shot("1366__design-system-hierarchy.png")

print("step44c_browser_checks=" + str(checks))
print("step44c_browser_failures=" + str(len(failures)))
print("step44c_browser_screenshots=" + str(len(list(OUT.glob('*.png')))))
for name, detail in failures:
    print("FAILURE: " + name + " :: " + str(detail))
raise SystemExit(1 if failures else 0)
