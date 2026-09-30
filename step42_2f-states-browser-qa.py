from pathlib import Path
import base64, json, shutil, time
import requests, websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step42_2f-states"
PORT = 9241

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

checks = 0
fails = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + detail) if detail else ""))
    if not ok:
        fails.append((name, detail))

targets = requests.get(f"http://127.0.0.1:{PORT}/json", timeout=3).json()
page = next(x for x in targets if x.get("type") == "page")
ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=10, origin="http://127.0.0.1")
seq = 0

def call(method, params=None):
    global seq
    seq += 1
    ident = seq
    ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == ident:
            if "error" in msg:
                raise RuntimeError(msg["error"])
            return msg.get("result", {})

def ev(expr):
    return call("Runtime.evaluate", {
        "expression": expr,
        "returnByValue": True,
        "awaitPromise": True,
    }).get("result", {}).get("value")
def viewport(width):
    call("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": 900, "deviceScaleFactor": 1, "mobile": False,
    })

def wait_for(expr, timeout=8):
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = ev(expr)
        if value:
            return value
        time.sleep(.1)
    return None

def nav(route):
    call("Page.navigate", {"url": "http://localhost:5180" + route})
    return bool(wait_for("!!document.querySelector('.inno-production-shell')", 12))

def set_input(selector, value):
    script = """((selector,value)=>{
      const el=document.querySelector(selector);
      if(!el)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      setter.call(el,value);
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    })(%s,%s)""" % (json.dumps(selector), json.dumps(value))
    return bool(ev(script))

def set_select(selector, value):
    script = """((selector,value)=>{
      const el=document.querySelector(selector);
      if(!el)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
      setter.call(el,value);
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    })(%s,%s)""" % (json.dumps(selector), json.dumps(value))
    return bool(ev(script))

def click_selector(selector):
    return bool(ev("""(selector=>{const el=document.querySelector(selector);if(!el)return false;el.click();return true;})(%s)""" % json.dumps(selector)))

def click_collection_clear():
    return bool(ev("""(()=>{
      const collection=document.querySelector('.inno-collection');
      const el=collection?.querySelector('.inno-collection-state button')
        || collection?.querySelector('.audit-clear-button')
        || [...(collection?.querySelectorAll('button')||[])].find(b=>b.textContent.trim().toLowerCase().startsWith('clear'));
      if(!el)return false;
      el.click();
      return true;
    })()"""))

def shot(name):
    data=call("Page.captureScreenshot", {"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
    (OUT / name).write_bytes(base64.b64decode(data))

call("Page.enable")
call("Runtime.enable")
viewport(1366)
check("authenticated session", nav("/"))
# Discover an actual offline Device through the production list.
check("offline discovery list ready", nav("/devices"))
check("offline status filter set", set_select(".inno-collection-toolbar .inno-select select", "offline"))
offline_href = wait_for("""(()=>{
  const rows=[...document.querySelectorAll('.inno-collection tbody tr')];
  const row=rows.find(r=>r.textContent.toLowerCase().includes('offline'));
  return row?.querySelector("a[href^='/devices/']")?.getAttribute('href')||'';
})()""", 8)
check("offline device discovered", bool(offline_href), str(offline_href))

# Real No Results behavior on major searchable collections.
state_routes = [
    ("/devices", "devices"),
    ("/devices/groups", "device-groups"),
    ("/assets/inventory", "assets"),
    ("/assets/owners", "asset-owners"),
    ("/helpdesk/tickets", "tickets"),
    ("/helpdesk/automation", "automation"),
    ("/admin/users", "admin-users"),
    ("/admin/audit", "audit"),
]
needle = "__STATE_QA_NO_MATCH_42_2F__"

def exercise_no_results(route, label, width):
    check(f"{width} no-results route ready {label}", nav(route))
    rows_ready = wait_for("document.querySelectorAll('.inno-collection tbody tr').length>0", 8)
    check(f"{width} rows exist before filter {label}", bool(rows_ready))
    check(f"{width} set unmatched search {label}", set_input(".inno-collection-toolbar .inno-search input", needle))
    state_ready = wait_for("""!!document.querySelector('.inno-collection-state [data-state="no-results"]')""", 10)
    check(f"{width} no-results state appears {label}", bool(state_ready))
    metrics = ev("""(()=>{
      const c=document.querySelector('.inno-collection');
      const s=c?.querySelector('.inno-collection-state');
      return {
        head:!!c?.querySelector('.inno-collection-head'),
        toolbar:!!c?.querySelector('.inno-collection-toolbar'),
        state:s?.querySelector('[data-state]')?.getAttribute('data-state')||'',
        footer:s?.querySelector('.inno-pagination--state')?.textContent?.trim()||'',
        pageActions:s?.querySelectorAll('.inno-pagination-actions').length||0,
        action:!!s?.querySelector('button') || !!c?.querySelector('.audit-clear-button') || [...(c?.querySelectorAll('button')||[])].some(b=>b.textContent.trim().toLowerCase().startsWith('clear')),
        overflow:document.documentElement.scrollWidth>innerWidth+2
      };
    })()""")
    check(f"{width} collection chrome preserved {label}", bool(metrics and metrics["head"] and metrics["toolbar"]), str(metrics))
    check(f"{width} truthful zero footer {label}", bool(metrics and metrics["footer"]=="0 matching results"), str(metrics))
    check(f"{width} no fake pagination {label}", bool(metrics and metrics["pageActions"]==0), str(metrics))
    check(f"{width} clear action available {label}", bool(metrics and metrics["action"]), str(metrics))
    check(f"{width} no page overflow in no-results {label}", bool(metrics and not metrics["overflow"]), str(metrics))
    if width in (1366,768) and label=="devices":
        shot(f"{width}__devices-no-results.png")
    check(f"{width} clear no-results {label}", click_collection_clear())
    restored=wait_for("""document.querySelectorAll('.inno-collection tbody tr').length>0 && !document.querySelector('.inno-collection-state [data-state="no-results"]')""",10)
    check(f"{width} rows restored {label}", bool(restored))

for route,label in state_routes:
    exercise_no_results(route,label,1366)

for width in (1024,768):
    viewport(width)
    exercise_no_results("/devices","devices",width)
# Canonical state semantics and partial retry reference at all QA widths.
for width in (1366,1024,768):
    viewport(width)
    check(f"{width} design-system states ready", nav("/internal/design-system"))
    check(f"{width} states section exists", bool(wait_for("!!document.querySelector('#states')")))
    ev("document.querySelector('#states')?.scrollIntoView({block:'start'})")
    time.sleep(.15)
    state_metrics = ev("""(()=>{
      const root=document.querySelector('.internal-ds-state-preview-grid');
      const all=[...root.querySelectorAll('[data-state]')];
      const byKind=Object.fromEntries(all.map(x=>[x.getAttribute('data-state'),{
        role:x.getAttribute('role'),
        live:x.getAttribute('aria-live'),
        label:x.getAttribute('aria-label'),
        busy:x.getAttribute('aria-busy'),
        sr:x.querySelector('.inno-sr-only')?.textContent?.trim()||'',
        title:x.querySelector('h4')?.textContent?.trim()||''
      }]));
      return {count:all.length,kinds:all.map(x=>x.getAttribute('data-state')),byKind};
    })()""")
    expected={"empty","no-results","loading","error","permission","disabled","offline","partial"}
    actual=set(state_metrics["kinds"] if state_metrics else [])
    check(f"{width} eight canonical states", state_metrics and state_metrics["count"]==8 and actual==expected, str(state_metrics))
    loading=state_metrics["byKind"]["loading"] if state_metrics else {}
    check(f"{width} loading status semantics", loading.get("role")=="status" and loading.get("live")=="polite" and loading.get("label")=="Loading content" and loading.get("busy")=="true" and loading.get("sr")=="Loading content", str(loading))
    error=state_metrics["byKind"]["error"] if state_metrics else {}
    check(f"{width} error alert semantics", error.get("role")=="alert", str(error))
    non_error_ok=all(state_metrics["byKind"][k].get("role")=="status" for k in expected-{"error"}) if state_metrics else False
    check(f"{width} non-error status semantics", non_error_ok)
    check(f"{width} canonical permission copy", state_metrics and state_metrics["byKind"]["permission"].get("title")=="You do not have access", str(state_metrics))
    check(f"{width} canonical disabled copy", state_metrics and state_metrics["byKind"]["disabled"].get("title")=="Module is not available", str(state_metrics))
    partial = ev("""(()=>{
      const x=document.querySelector('.inno-state.banner[data-state="partial"]');
      return {title:x?.querySelector('h4')?.textContent?.trim()||'',button:x?.querySelector('button')?.textContent?.trim()||'',meta:x?.querySelector('.inno-state-meta')?.textContent?.trim()||''};
    })()""")
    check(f"{width} partial preserves success count", partial and partial["title"]=="8 succeeded, 2 failed" and partial["button"]=="Retry failed" and partial["meta"]=="8 of 10 devices updated", str(partial))
    check(f"{width} retry failed action", click_selector('.inno-state.banner[data-state="partial"] button'))
    resolved=wait_for("""document.querySelector('.inno-state.banner[data-state="partial"] h4')?.textContent?.trim()==='Retry completed'""")
    check(f"{width} partial retry resolves", bool(resolved))
    resolved_metrics=ev("""(()=>{const x=document.querySelector('.inno-state.banner[data-state="partial"]');return {title:x?.querySelector('h4')?.textContent?.trim()||'',button:!!x?.querySelector('button'),meta:x?.querySelector('.inno-state-meta')?.textContent?.trim()||''};})()""")
    check(f"{width} resolved partial has no retry", resolved_metrics and resolved_metrics["title"]=="Retry completed" and not resolved_metrics["button"] and resolved_metrics["meta"]=="10 of 10 devices updated", str(resolved_metrics))
    shot(f"{width}__canonical-states.png")
# Module-disabled route uses safe navigation, and actual Offline keeps cached detail visible.
for width in (1366,1024,768):
    viewport(width)
    check(f"{width} disabled route ready", nav("/meeting/state-qa"))
    disabled=ev("""(()=>{const s=document.querySelector('[data-state="disabled"]');return {exists:!!s,title:s?.querySelector('h4')?.textContent?.trim()||'',role:s?.getAttribute('role')||'',action:s?.querySelector('a')?.textContent?.trim()||''};})()""")
    check(f"{width} module-disabled canonical", disabled and disabled["exists"] and disabled["title"]=="Module is not available" and disabled["role"]=="status" and disabled["action"]=="Open Apps", str(disabled))

    if offline_href:
        check(f"{width} offline device route ready", nav(offline_href))
        check(f"{width} offline banner appears", bool(wait_for("""!!document.querySelector('.inno-state.banner[data-state="offline"]')""")))
        offline=ev("""(()=>{
          const s=document.querySelector('.inno-state.banner[data-state="offline"]');
          return {
            role:s?.getAttribute('role')||'',
            title:s?.querySelector('h4')?.textContent?.trim()||'',
            text:s?.textContent||'',
            summary:!!document.querySelector('.inno-resource-summary'),
            tabs:!!document.querySelector('.inno-surface-tabs'),
            overflow:document.documentElement.scrollWidth>innerWidth+2
          };
        })()""")
        check(f"{width} offline is contextual status", offline and offline["role"]=="status" and offline["title"]=="Resource offline", str(offline))
        check(f"{width} offline explains cached and live-only", offline and "cached" in offline["text"].lower() and "live-only" in offline["text"].lower(), str(offline))
        check(f"{width} cached detail remains visible", offline and offline["summary"] and offline["tabs"], str(offline))
        check(f"{width} offline has no page overflow", offline and not offline["overflow"], str(offline))
        if width in (1366,768):
            shot(f"{width}__device-offline.png")

print("step42_2f_state_checks=" + str(checks))
print("step42_2f_state_failures=" + str(len(fails)))
for item in fails:
    print("FAILED", item)
raise SystemExit(1 if fails else 0)
