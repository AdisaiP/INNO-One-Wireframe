from pathlib import Path
import base64, json, time, sys
import requests, websocket

ROOT=Path(__file__).resolve().parent
PORT=9223
OUT=ROOT/"qa-interactions"
OUT.mkdir(exist_ok=True)
failures=[]
checks=0

def check(name, condition, detail=""):
    global checks
    checks+=1
    status="PASS" if condition else "FAIL"
    print(f"{status} {name}" + (f" :: {detail}" if detail else ""))
    if not condition: failures.append((name,detail))

class CDP:
    def __init__(self):
        deadline=time.time()+8
        targets=None
        while time.time()<deadline:
            try:
                targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=1).json()
                if targets: break
            except Exception: time.sleep(.15)
        if not targets: raise RuntimeError("Chrome DevTools target not available")
        page=next((x for x in targets if x.get("type")=="page"),targets[0])
        self.ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=6,origin="http://127.0.0.1")
        self.n=0
        self.call("Page.enable"); self.call("Runtime.enable")
    def call(self,method,params=None):
        self.n+=1; ident=self.n
        self.ws.send(json.dumps({"id":ident,"method":method,"params":params or {}}))
        while True:
            msg=json.loads(self.ws.recv())
            if msg.get("id")==ident:
                if "error" in msg: raise RuntimeError(msg["error"])
                return msg.get("result",{})
    def eval(self,expr):
        result=self.call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True})
        if "exceptionDetails" in result: raise RuntimeError(result["exceptionDetails"])
        return result.get("result",{}).get("value")
    def nav(self,name,query=""):
        url=(ROOT/name).as_uri()+query
        self.call("Page.navigate",{"url":url})
        deadline=time.time()+8
        while time.time()<deadline:
            try:
                ready=self.eval("document.readyState")
                shell=self.eval("!!window.INNOInteractions && !!window.INNOStates")
                if ready=="complete" and shell: break
            except Exception: pass
            time.sleep(.08)
        time.sleep(.12)
        return self.eval("location.href")
    def shot(self,name):
        data=self.call("Page.captureScreenshot",{"format":"png","fromSurface":True}).get("data")
        if data: (OUT/name).write_bytes(base64.b64decode(data))
    def close(self): self.ws.close()

c=CDP()
# 1. Validation -> dirty -> saving -> navigate
c.nav("ticket-new.html")
c.eval("document.querySelector('[data-inno-save]').click()")
time.sleep(.12)
invalid=c.eval("document.querySelectorAll('[aria-invalid=\"true\"]').length")
toast_error=c.eval("!!document.querySelector('.inno-toast.error')")
check("ticket validation marks two required fields",invalid==2,str(invalid))
check("ticket validation uses shared error toast",toast_error)
c.shot("01-ticket-validation.png")

c.eval("""(()=>{const s=document.getElementById('subject');s.value='VPN access issue';s.dispatchEvent(new Event('input',{bubbles:true}));const t=document.querySelector('textarea[required]');t.value='VPN times out after Windows update';t.dispatchEvent(new Event('input',{bubbles:true}));})()""")
time.sleep(.08)
dirty=c.eval("document.documentElement.dataset.uiDirtyCount")
unsaved=c.eval("!!document.querySelector('.editor-save-state.is-unsaved')")
check("form editing sets dirty state",dirty=="1",str(dirty))
check("unsaved indicator is visible",unsaved)
c.shot("02-ticket-unsaved.png")

c.eval("document.querySelector('[data-inno-save]').click()")
time.sleep(.12)
saving=c.eval("document.querySelector('[data-inno-save]').classList.contains('is-loading')")
saving_indicator=c.eval("!!document.querySelector('.editor-save-state.is-saving')")
check("save enters Saving state",saving)
check("save indicator enters Saving state",saving_indicator)
c.shot("03-ticket-saving.png")
time.sleep(1.15)
check("successful create navigates after Saved",c.eval("location.pathname.endsWith('/ticket-detail.html')"),c.eval("location.href"))

# 2. Unsaved Cancel protection
c.nav("ticket-new.html")
c.eval("""(()=>{const s=document.getElementById('subject');s.value='Draft issue';s.dispatchEvent(new Event('input',{bubbles:true}))})()""")
c.eval("document.querySelector('.form-footer a').click()")
time.sleep(.12)
confirm_open=c.eval("document.getElementById('innoConfirmBackdrop').classList.contains('open')")
check("Cancel with dirty form opens discard confirmation",confirm_open)
check("dirty Cancel does not navigate immediately",c.eval("location.pathname.endsWith('/ticket-new.html')"))
c.shot("04-unsaved-discard-confirm.png")
c.eval("document.getElementById('innoConfirmOk').click()")
time.sleep(.25)
check("discard confirmation navigates to Cancel destination",c.eval("location.pathname.endsWith('/helpdesk.html')"),c.eval("location.href"))
# 3. Filters persist and Reset clears them
c.nav("devices-overview-v2.html")
c.eval("document.querySelector('[data-inno-filter=\"devices\"]').click()")
time.sleep(.1)
c.eval("""(()=>{const s=[...document.querySelectorAll('#innoFilterFields select')];s[0].selectedIndex=1;s[1].selectedIndex=1;document.getElementById('innoFilterApply').click()})()""")
time.sleep(.12)
filter_count=c.eval("document.documentElement.dataset.uiFilterCount")
badge=c.eval("document.querySelector('[data-inno-filter=\"devices\"] .tag').textContent")
check("filter Apply reports active count",filter_count=="2" and badge=="2",f"{filter_count}/{badge}")
c.eval("document.querySelector('[data-inno-filter=\"devices\"]').click()")
time.sleep(.08)
persist=c.eval("[...document.querySelectorAll('#innoFilterFields select')].slice(0,2).map(x=>x.selectedIndex).join(',')")
check("filter values persist when drawer reopens",persist=="1,1",persist)
c.shot("05-filter-persisted.png")
c.eval("document.getElementById('innoFilterReset').click()")
time.sleep(.08)
reset=c.eval("[...document.querySelectorAll('#innoFilterFields select')].every(x=>x.selectedIndex===0)")
badge0=c.eval("document.querySelector('[data-inno-filter=\"devices\"] .tag').textContent")
check("filter Reset restores defaults",reset and badge0=="0",str(badge0))

# 4. Bulk selection
c.eval("document.querySelector('[data-inno-close-drawer]').click()")
time.sleep(.06)
c.eval("""(()=>{const r=[...document.querySelectorAll('[data-inno-select-row]')];r[0].click();r[1].click()})()""")
time.sleep(.08)
bulk_count=c.eval("document.querySelector('[data-inno-selected-count]').textContent")
bulk_show=c.eval("document.querySelector('[data-inno-bulkbar]').classList.contains('show')")
bulk_ind=c.eval("document.querySelector('[data-inno-select-all]').indeterminate")
check("bulk row selection shows shared bulk bar",bulk_count=="2" and bulk_show and bulk_ind,f"{bulk_count}/{bulk_show}/{bulk_ind}")
c.shot("06-bulk-selection.png")
c.eval("document.querySelector('[data-inno-select-all]').click()")
time.sleep(.06)
check("Select all updates shared count",c.eval("document.querySelector('[data-inno-selected-count]').textContent")=="4")

# 5. Search no-results state
c.eval("""(()=>{const i=document.getElementById('deviceSearch');i.value='__no_such_device__';i.dispatchEvent(new Event('input',{bubbles:true}))})()""")
time.sleep(.16)
nores=c.eval("!!document.querySelector('#deviceRows .inno-search-empty')")
visible=c.eval("[...document.querySelectorAll('#deviceRows > tr:not(.inno-search-empty)')].filter(r=>getComputedStyle(r).display!=='none').length")
check("search renders standard No Results state",nores and visible==0,f"{nores}/{visible}")
c.shot("07-search-no-results.png")
# 6. Partial failure + Retry
c.nav("devices-overview-v2.html","?uiState=partial&succeeded=8&failed=2")
failed=c.eval("document.querySelector('[data-inno-partial-failed]')?.textContent")
check("partial failure state exposes failed count",failed=="2",str(failed))
c.shot("08-partial-failure.png")
c.eval("document.querySelector('[data-inno-retry]').click()")
time.sleep(.8)
resolved=c.eval("document.querySelector('.inno-partial-state').classList.contains('resolved')")
failed0=c.eval("document.querySelector('[data-inno-partial-failed]').textContent")
check("Retry resolves partial failure state",resolved and failed0=="0",f"{resolved}/{failed0}")
c.shot("09-partial-retried.png")

# 7. Loading / Permission / Error states
for state,selector in [("loading",".inno-skeleton-block"),("permission",".inno-state.permission"),("error",".inno-state.error")]:
    c.nav("devices-overview-v2.html",f"?uiState={state}")
    check(f"{state} state uses shared renderer",c.eval(f"!!document.querySelector('{selector}')"))
c.shot("10-error-state.png")

# 8. Destructive confirmation
c.nav("remote-session.html")
c.eval("document.querySelector('[data-inno-confirm]').click()")
time.sleep(.1)
title=c.eval("document.getElementById('innoConfirmTitle').textContent")
check("destructive action opens confirmation",c.eval("document.getElementById('innoConfirmBackdrop').classList.contains('open')"),title)
c.shot("11-destructive-confirm.png")
c.eval("document.getElementById('innoConfirmOk').click()")
time.sleep(.12)
check("confirmed destructive action closes dialog",not c.eval("document.getElementById('innoConfirmBackdrop').classList.contains('open')"))
check("confirmed destructive action uses shared toast",c.eval("!!document.querySelector('.inno-toast.success')"))
# 9. Dialog dirty-close protection and save-close behavior
c.nav("remote-consent-rules.html")
c.eval("document.getElementById('newBypass').click()")
time.sleep(.08)
c.eval("""(()=>{const i=[...document.querySelectorAll('#ruleDialog input')].find(x=>x.placeholder);i.value='Approved maintenance';i.dispatchEvent(new Event('input',{bubbles:true}))})()""")
time.sleep(.06)
check("dialog editing sets dirty state",c.eval("document.documentElement.dataset.uiDirtyCount")=="1")
c.eval("document.getElementById('closeRule').click()")
time.sleep(.08)
check("dirty dialog close asks to discard",c.eval("document.getElementById('innoConfirmBackdrop').classList.contains('open')"))
c.shot("12-dialog-unsaved-confirm.png")
c.eval("document.getElementById('innoConfirmOk').click()")
time.sleep(.1)
check("discard closes dirty dialog",not c.eval("document.getElementById('ruleDialog').classList.contains('open')"))
check("discard clears dirty state",c.eval("document.documentElement.dataset.uiDirtyCount")=="0")

c.eval("document.getElementById('newBypass').click()")
time.sleep(.05)
c.eval("""(()=>{const i=[...document.querySelectorAll('#ruleDialog input')].find(x=>x.placeholder);i.value='Second change';i.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('saveRule').click()})()""")
time.sleep(.12)
check("dialog save enters shared loading state",c.eval("document.getElementById('saveRule').classList.contains('is-loading')"))
time.sleep(.75)
check("successful dialog save closes editor",not c.eval("document.getElementById('ruleDialog').classList.contains('open')"))
check("successful dialog save clears dirty state",c.eval("document.documentElement.dataset.uiDirtyCount")=="0")

# 10. Recoverable save failure keeps dirty input
c.nav("asset-user-detail.html")
c.eval("""(()=>{const i=document.querySelector('.arch-editor input');i.value=i.value+' X';i.dispatchEvent(new Event('input',{bubbles:true}));const b=document.getElementById('saveUser');b.dataset.innoSaveFail='true';b.click()})()""")
time.sleep(.78)
failed_save=c.eval("document.getElementById('saveUser').classList.contains('is-error')")
dirty_after_fail=c.eval("document.documentElement.dataset.uiDirtyCount")
check("save failure exposes retry/error state",failed_save)
check("save failure preserves dirty state",dirty_after_fail=="1",str(dirty_after_fail))
c.shot("13-save-failure.png")

c.close()
print(f"browser_checks={checks}")
print(f"browser_failures={len(failures)}")
print(f"screenshots={len(list(OUT.glob('*.png')))}")
if failures:
    for item in failures: print("FAILED",item)
    sys.exit(1)
