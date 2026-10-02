from pathlib import Path
import base64
import json
import shutil
import sys
import time
import requests
import websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step44b-shared-interaction"
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
            message = json.loads(self.ws.recv())
            if message.get("id") == ident:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def ev(self, expression):
        result = self.call("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
        })
        return result.get("result", {}).get("value")

    def viewport(self, width, height=900):
        self.call("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": False,
        })

    def shot(self, name):
        data = self.call("Page.captureScreenshot", {
            "format": "png",
            "fromSurface": True,
            "captureBeyondViewport": False,
        })["data"]
        (OUT / name).write_bytes(base64.b64decode(data))

def wait(c, expression, timeout=12):
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

def spa_nav(c, route, ready_selector):
    c.ev(
        "history.pushState({},'',%s);window.dispatchEvent(new PopStateEvent('popstate'));"
        % json.dumps(route)
    )
    return bool(wait(
        c,
        "location.pathname===" + json.dumps(route)
        + " && !!document.querySelector(" + json.dumps(ready_selector) + ")",
        15,
    ))

c = CDP()
c.viewport(1366)
authenticated = bool(wait(
    c,
    "location.href.startsWith('http://localhost:5180')"
    " && !!document.querySelector('.inno-production-shell')",
    3,
))
check("authenticated production session available", authenticated, c.ev("location.href") or "")
if not authenticated:
    print("Run the existing authenticated responsive harness before Step44B browser QA.")
    raise SystemExit(1)

c.ev("localStorage.setItem('inno.ui.sidebar.collapsed','0')")

# Production proof: policy copy + single row action + responsive behavior.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} integrations route ready", spa_nav(c, "/admin/integrations", ".inno-page"))
    check(f"{width} integrations data settled", bool(wait(
        c,
        "!!document.querySelector('.inno-purpose-note') && !!document.querySelector('.inno-row-action')",
        10,
    )))
    metrics = c.ev("""(()=> {
      const note=document.querySelector('.inno-purpose-note');
      const action=document.querySelector('.inno-row-action');
      const state=[...document.querySelectorAll('.inno-state')].find(
        e=>(e.textContent||'').includes('Configuration remains deployment-managed'));
      const nr=note?.getBoundingClientRect();
      const ar=action?.getBoundingClientRect();
      return {
        note:!!note,
        noteH:Math.round(nr?.height||0),
        action:!!action,
        actionText:(action?.textContent||'').trim(),
        actionH:Math.round(ar?.height||0),
        misuse:!!state,
        overflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
    check(f"{width} integrations purpose note mounted", metrics["note"], metrics)
    check(f"{width} deployment copy is not application state", not metrics["misuse"], metrics)
    check(f"{width} test uses canonical row action",
          metrics["action"] and metrics["actionText"] == "Test" and metrics["actionH"] == 32, metrics)
    check(f"{width} integrations no document overflow", not metrics["overflow"], metrics)
    c.shot(f"{width}__integrations.png")

# Production proof: shared editor footer and form control rhythm.
for width in (1366, 768):
    c.viewport(width)
    check(f"{width} calendar route ready", spa_nav(c, "/helpdesk/calendar", ".inno-page"))
    check(f"{width} calendar editor loaded", bool(wait(c, "!!document.querySelector('.inno-editor-footer')", 10)))
    footer = c.ev("""(()=> {
      const e=document.querySelector('.inno-editor-footer');
      const c=getComputedStyle(e), r=e.getBoundingClientRect();
      const input=document.querySelector('.field-block input');
      const ir=input?.getBoundingClientRect();
      const table=document.querySelector('.inno-table-wrap');
      return {
        position:c.position,
        radius:c.borderRadius,
        shadow:c.boxShadow,
        background:c.backgroundColor,
        borderTop:c.borderTopWidth,
        width:Math.round(r.width),
        inputH:Math.round(ir?.height||0),
        tableOverflow:table ? table.scrollWidth > table.clientWidth + 2 : false,
        overflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
    check(f"{width} footer stays in normal flow", footer["position"] == "static", footer)
    check(f"{width} footer no floating-card chrome",
          footer["radius"] == "0px" and footer["shadow"] == "none"
          and footer["background"] in ("rgba(0, 0, 0, 0)", "transparent"), footer)
    check(f"{width} footer belongs to editor via top divider", footer["borderTop"] == "1px", footer)
    check(f"{width} form control uses 36px shared height", footer["inputH"] == 36, footer)
    check(f"{width} three-column holiday table needs no horizontal scroll", not footer["tableOverflow"], footer)
    check(f"{width} calendar no document overflow", not footer["overflow"], footer)
    c.shot(f"{width}__business-calendar.png")

# Internal Design System proves shared RowActions / Dialog / Drawer behavior.
c.viewport(1366)
check("design system route ready", spa_nav(c, "/internal/design-system", ".internal-ds-page"))
check("design system data rows ready", bool(wait(c, "document.querySelectorAll('#data tbody tr').length>0", 5)))

c.ev("document.querySelector('#data')?.scrollIntoView({block:'center'})")
time.sleep(.2)
trigger_clicked = c.ev("""(()=> {
  const b=document.querySelector('#data .inno-row-actions-trigger');
  if(!b)return false;
  b.focus();
  b.click();
  return true;
})()""")
check("row action menu trigger works", bool(trigger_clicked))
check("row action portal menu opens", bool(wait(c, "!!document.body.querySelector(':scope > .inno-row-actions-menu')", 3)))
check("row action menu receives initial focus", bool(wait(c, "(document.activeElement?.textContent||'').trim()==='Open'", 2)))
menu = c.ev("""(()=> {
  const m=document.querySelector('.inno-row-actions-menu');
  if(!m)return null;
  const r=m.getBoundingClientRect(), a=document.activeElement;
  return {
    parent:m.parentElement===document.body,
    position:getComputedStyle(m).position,
    left:Math.round(r.left),top:Math.round(r.top),right:Math.round(r.right),bottom:Math.round(r.bottom),
    focused:(a?.textContent||'').trim(),
    clipped:!!m.closest('.inno-table-wrap')
  };
})()""")
check("row action menu portals to body", menu and menu["parent"] and not menu["clipped"], menu)
check("row action menu stays within viewport",
      menu and menu["left"] >= 0 and menu["top"] >= 0 and menu["right"] <= 1366 and menu["bottom"] <= 900, menu)
c.ev("document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))")
check("row action arrow navigation works", bool(wait(c, "(document.activeElement?.textContent||'').trim()==='Edit'", 2)))
c.ev("document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
check("row action Escape closes menu", bool(wait(c, "!document.querySelector('.inno-row-actions-menu')", 2)))
check("row action Escape restores trigger focus",
      c.ev("document.activeElement?.classList.contains('inno-row-actions-trigger')") is True)

open_dialog = c.ev("""(()=> {
  const b=[...document.querySelectorAll('#overlays button')].find(x=>x.textContent.includes('Open Dialog'));
  if(!b)return false;b.focus();b.click();return true;
})()""")
check("dialog trigger works", bool(open_dialog))
check("shared dialog opens", bool(wait(c, "!!document.querySelector('.inno-dialog[role=dialog]')", 3)))
dialog = c.ev("""(()=> {
  const d=document.querySelector('.inno-dialog');
  const a=document.activeElement;
  return {
    parent:d?.parentElement?.parentElement===document.body,
    modal:d?.getAttribute('aria-modal'),
    focusedTag:a?.tagName,
    autofocus:a?.hasAttribute?.('data-autofocus'),
    bodyOverflow:getComputedStyle(document.body).overflow
  };
})()""")
check("dialog portals to body and is modal", dialog and dialog["parent"] and dialog["modal"] == "true", dialog)
check("dialog honors data-autofocus", dialog and dialog["focusedTag"] == "SELECT" and dialog["autofocus"], dialog)
check("dialog locks body scroll", dialog and dialog["bodyOverflow"] == "hidden", dialog)
c.shot("1366__design-system__dialog.png")
c.ev("document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
check("dialog Escape closes", bool(wait(c, "!document.querySelector('.inno-dialog')", 2)))
check("dialog restores trigger focus",
      c.ev("document.activeElement?.textContent.includes('Open Dialog')") is True)

open_drawer = c.ev("""(()=> {
  const b=[...document.querySelectorAll('#overlays button')].find(x=>x.textContent.includes('Open Sheet'));
  if(!b)return false;b.focus();b.click();return true;
})()""")
check("drawer trigger works", bool(open_drawer))
check("shared drawer opens", bool(wait(c, "!!document.querySelector('.inno-drawer[role=dialog]')", 3)))
drawer = c.ev("""(()=> {
  const d=document.querySelector('.inno-drawer');
  const r=d?.getBoundingClientRect();
  return {
    parent:d?.parentElement?.parentElement===document.body,
    width:Math.round(r?.width||0),
    right:Math.round(r?.right||0),
    focused:document.activeElement?.hasAttribute?.('data-autofocus')||false
  };
})()""")
check("drawer portals to body", drawer and drawer["parent"], drawer)
check("drawer receives autofocus", drawer and drawer["focused"], drawer)
c.shot("1366__design-system__drawer.png")
c.ev("document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
check("drawer Escape closes", bool(wait(c, "!document.querySelector('.inno-drawer')", 2)))
check("drawer restores trigger focus",
      c.ev("document.activeElement?.textContent.includes('Open Sheet')") is True)

c.viewport(768)
check("design system narrow route remains ready", spa_nav(c, "/internal/design-system", ".internal-ds-page"))
c.ev("""(()=> {
  const b=[...document.querySelectorAll('#overlays button')].find(x=>x.textContent.includes('Open Sheet'));
  b?.focus();b?.click();return !!b;
})()""")
check("768 drawer opens", bool(wait(c, "!!document.querySelector('.inno-drawer')", 3)))
narrow = c.ev("""(()=> {
  const d=document.querySelector('.inno-drawer'), r=d?.getBoundingClientRect();
  return {width:Math.round(r?.width||0),left:Math.round(r?.left||0),right:Math.round(r?.right||0),
    overflow:document.documentElement.scrollWidth>innerWidth+2};
})()""")
check("768 drawer stays right aligned within viewport",
      narrow and 360 <= narrow["width"] <= 460 and narrow["right"] == 768 and narrow["left"] >= 0, narrow)
check("768 drawer causes no document overflow", narrow and not narrow["overflow"], narrow)
c.shot("768__design-system__drawer.png")
c.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
wait(c, "!document.querySelector('.inno-drawer')", 2)

c.viewport(640)
check("640 design system route remains ready", spa_nav(c, "/internal/design-system", ".internal-ds-page"))
c.ev("""(()=> {
  const b=[...document.querySelectorAll('#overlays button')].find(x=>x.textContent.includes('Open Sheet'));
  b?.focus();b?.click();return !!b;
})()""")
check("640 drawer opens", bool(wait(c, "!!document.querySelector('.inno-drawer')", 3)))
compact = c.ev("""(()=> {
  const d=document.querySelector('.inno-drawer'), r=d?.getBoundingClientRect();
  return {width:Math.round(r?.width||0),left:Math.round(r?.left||0),right:Math.round(r?.right||0)};
})()""")
check("640 drawer becomes full viewport width",
      compact and compact["width"] == 640 and compact["left"] == 0 and compact["right"] == 640, compact)
c.ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
wait(c, "!document.querySelector('.inno-drawer')", 2)

print("step44b_browser_checks=" + str(checks))
print("step44b_browser_failures=" + str(len(failures)))
for name, detail in failures:
    print("FAILURE: " + name + " :: " + str(detail))
raise SystemExit(1 if failures else 0)
