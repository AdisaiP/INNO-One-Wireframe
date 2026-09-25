from pathlib import Path
import json,time,sys,requests,websocket

ROOT=Path(__file__).resolve().parent
PORT=9231
manifest=json.loads((ROOT/"qa-final-visual/manifest.json").read_text())
WEB=list(manifest["web"])
fails=[];checks=0

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
            except Exception:time.sleep(.1)
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
    def viewport(self,w,h=900):
        self.call("Emulation.setDeviceMetricsOverride",{"width":w,"height":h,"deviceScaleFactor":1,"mobile":False})
    def nav(self,page,query=""):
        self.call("Page.navigate",{"url":(ROOT/page).as_uri()+query})
        deadline=time.time()+7
        while time.time()<deadline:
            try:
                if self.eval("document.readyState")=="complete" and self.eval("!!window.INNOInputs"):break
            except:pass
            time.sleep(.04)
        time.sleep(.1)
c=CDP()
# System-wide route pass at all required Web breakpoints.
for w in (1366,1024,768):
    c.viewport(w)
    route_fails=[]
    for page in WEB:
        c.nav(page,"?qaMetrics=1")
        m=c.eval("""(()=>{const sels=[...document.querySelectorAll('select')];const expected=sels.filter(s=>!s.hasAttribute('data-inno-native')&&!s.closest('.mock-desktop,.android-phone')).length;const enhanced=sels.filter(s=>s.dataset.innoEnhanced).length;const visibleNative=sels.filter(s=>{const r=s.getBoundingClientRect(),cs=getComputedStyle(s);return cs.position!=='absolute'&&cs.display!=='none'&&r.width>3&&r.height>3}).length;const visible=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};const highDisabled=[...document.querySelectorAll('.page-head .actions .btn[disabled],.page-head .actions .btn[aria-disabled="true"],.resource-actions .btn[disabled],.resource-actions .btn[aria-disabled="true"]')].filter(visible).length;const cleanDocked=document.querySelectorAll('.inno-editor-footer.is-docked,.inno-builder-footer.is-docked,.inno-wizard-footer.is-docked').length;const a11yName=e=>{const aria=e.getAttribute('aria-label')?.trim();if(aria)return aria;const ids=e.getAttribute('aria-labelledby')?.trim();if(ids){const t=ids.split(/\\s+/).map(id=>document.getElementById(id)?.textContent?.trim()||'').filter(Boolean).join(' ');if(t)return t}const txt=e.textContent?.trim();if(txt)return txt;return e.getAttribute('title')?.trim()||''};const unnamedInteractive=[...document.querySelectorAll('button,a[href]')].filter(visible).filter(e=>!a11yName(e)).length;const unlabeledFields=[...document.querySelectorAll('input,textarea')].filter(visible).filter(e=>e.type!=='hidden'&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).length;const nonSemanticClicks=[...document.querySelectorAll('[onclick]')].filter(visible).filter(e=>!['BUTTON','A','INPUT','SELECT','TEXTAREA','SUMMARY'].includes(e.tagName)).length;const badSwitches=[...document.querySelectorAll('[role="switch"]')].filter(visible).filter(e=>!['BUTTON','INPUT'].includes(e.tagName)||!e.hasAttribute('aria-checked')||!a11yName(e)).length;const visibleFutureNav=[...document.querySelectorAll('.side .nav-disabled')].filter(visible).length;const visibleComingSoon=[...document.querySelectorAll('button,a')].filter(visible).filter(e=>(((e.getAttribute('title')||'')+' '+(e.textContent||'')).toLowerCase().includes('coming soon'))).length;return {overflow:document.documentElement.scrollWidth>innerWidth+2,inputSystem:document.documentElement.dataset.innoInputSystem==='1',selects:sels.length,expected,enhanced,visibleNative,popovers:document.querySelectorAll('.inno-picker-popover').length,sideHash:[...document.querySelectorAll('.side a')].filter(a=>(a.getAttribute('href')||'').includes('#')).length,cleanDocked,highDisabled,unnamedInteractive,unlabeledFields,nonSemanticClicks,badSwitches,visibleFutureNav,visibleComingSoon}})()""")
        bad=[]
        if m["overflow"]:bad.append("overflow")
        if not m["inputSystem"]:bad.append("input-system-missing")
        if m["enhanced"]!=m["expected"]:bad.append(f"enhanced={m['enhanced']}/{m['expected']}")
        if m["visibleNative"]:bad.append(f"visible-native={m['visibleNative']}")
        if m["popovers"]:bad.append("orphan-popover")
        if m["sideHash"]:bad.append(f"side-hash-links={m['sideHash']}")
        if m["highDisabled"]:bad.append(f"high-emphasis-disabled={m['highDisabled']}")
        if m["cleanDocked"]:bad.append(f"clean-footer-docked={m['cleanDocked']}")
        if m["unnamedInteractive"]:bad.append(f"unnamed-interactive={m['unnamedInteractive']}")
        if m["unlabeledFields"]:bad.append(f"unlabeled-fields={m['unlabeledFields']}")
        if m["nonSemanticClicks"]:bad.append(f"nonsemantic-clicks={m['nonSemanticClicks']}")
        if m["badSwitches"]:bad.append(f"bad-switches={m['badSwitches']}")
        if m["visibleFutureNav"]:bad.append(f"visible-future-nav={m['visibleFutureNav']}")
        if m["visibleComingSoon"]:bad.append(f"visible-coming-soon={m['visibleComingSoon']}")
        if bad:route_fails.append((page,bad))
    check(f"All {len(WEB)} Web routes pass Input System at {w}",not route_fails,route_fails[:6])
# Ticket: combobox, resource picker and segmented controls retain backing select events.
c.viewport(1366);c.nav("ticket-new.html")
check("Ticket primary form is simplified",c.eval("document.querySelectorAll('.ux-section').length===2 && !!document.querySelector('.ux-advanced')"))
c.eval("""(()=>{const s=[...document.querySelectorAll('select')].find(x=>x.closest('.field')?.querySelector('label')?.textContent==='Category');s.nextElementSibling.querySelector('.inno-select-trigger').click()})()""");time.sleep(.03)
check("Category opens custom searchable popover",c.eval("!!document.querySelector('.inno-picker-popover .inno-picker-search input')"))
c.eval("""(()=>{const i=document.querySelector('.inno-picker-search input');i.value='Software';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.inno-picker-option:not([hidden])').click()})()""");time.sleep(.04)
check("Category selection updates native backing value",c.eval("[...document.querySelectorAll('select')].find(x=>x.closest('.field')?.querySelector('label')?.textContent==='Category').value==='Software'"))

c.eval("""(()=>{const s=[...document.querySelectorAll('select')].find(x=>x.closest('.field')?.querySelector('label')?.textContent==='Related device');s.nextElementSibling.querySelector('.inno-select-trigger').click()})()""");time.sleep(.03)
check("Device field uses resource picker",c.eval("!!document.querySelector('.inno-picker-popover.resource .inno-picker-option-icon')"))
c.eval("""(()=>{const i=document.querySelector('.inno-picker-search input');i.value='NOTEBOOK';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.inno-picker-option:not([hidden])').click()})()""");time.sleep(.03)
check("Resource picker updates device value",c.eval("[...document.querySelectorAll('select')].find(x=>x.closest('.field')?.querySelector('label')?.textContent==='Related device').value.includes('NOTEBOOK')"))

c.eval("""(()=>{const s=document.getElementById('urgency');const seg=s.nextElementSibling;[...seg.querySelectorAll('.inno-segment')].find(x=>x.textContent==='Critical').click()})()""");time.sleep(.03)
check("Segmented urgency preserves change handler",c.eval("document.getElementById('priority').value==='P1 · Critical' && document.getElementById('slaPreview').textContent.includes('15m')"))
# Notification rule: purpose-built flow and template summary sync.
c.nav("helpdesk-notification-rule.html")
check("Notification Rule uses When-Send to-Message flow",c.eval("document.querySelectorAll('.ux-rule-node-body').length===3"))
c.eval("document.getElementById('templateSelect').nextElementSibling.querySelector('.inno-select-trigger').click()");time.sleep(.03)
c.eval("""(()=>{const b=[...document.querySelectorAll('.inno-picker-option')].find(x=>x.textContent.includes('Action Required'));b.click()})()""");time.sleep(.03)
check("Template combobox updates summary",c.eval("document.getElementById('summaryTemplate').textContent==='Action Required'"))

# Report Builder: searchable dataset + filter builder + preview event compatibility.
c.nav("report-builder.html")
check("Report Builder uses filter-builder rows",c.eval("document.querySelectorAll('.ux-filter-row').length===2"))
c.eval("document.getElementById('dataset').nextElementSibling.querySelector('.inno-select-trigger').click()");time.sleep(.03)
check("Dataset uses resource-style picker",c.eval("!!document.querySelector('.inno-picker-popover.resource')"))
c.eval("""(()=>{const i=document.querySelector('.inno-picker-search input');i.value='Helpdesk';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.inno-picker-option:not([hidden])').click();document.querySelector('button[onclick="refreshPreview()"]').click()})()""");time.sleep(.8)
check("Report preview still reacts to selected dataset",c.eval("document.getElementById('previewMeta').textContent.includes('Helpdesk')"))

# Asset QR: workflow is reduced to core task and supporting info is collapsed.
c.nav("asset-qr.html")
check("QR page uses four-step task flow",c.eval("document.querySelectorAll('.qr-workflow .qr-step').length===4"))
check("QR security/mobile are progressive disclosure",c.eval("document.querySelectorAll('.ux-qr-aside details.ux-advanced').length===2"))
check("QR label setup uses segmented controls",c.eval("document.getElementById('labelSize').dataset.innoEnhanced==='segmented'"))
c.eval("""(()=>{const seg=document.getElementById('labelSize').nextElementSibling;[...seg.querySelectorAll('.inno-segment')][1].click()})()""");time.sleep(.03)
check("QR label size control updates backing select",c.eval("document.getElementById('labelSize').selectedIndex===1"))
# Keyboard interaction on a normal custom select.
c.nav("software-maintenance-new.html")
target=c.eval("""(()=>{const s=[...document.querySelectorAll('select')].find(x=>x.dataset.innoEnhanced==='select');return {id:s.id,trigger:s.nextElementSibling.querySelector('.inno-select-trigger').id,value:s.value}})()""")
c.eval(f"document.getElementById({json.dumps(target['trigger'])}).focus();document.getElementById({json.dumps(target['trigger'])}).dispatchEvent(new KeyboardEvent('keydown',{{key:'ArrowDown',bubbles:true}}))");time.sleep(.04)
check("Keyboard ArrowDown opens select",c.eval("!!document.querySelector('.inno-picker-popover')"))
c.eval("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");time.sleep(.03)
check("Escape closes select and restores focus",c.eval("!document.querySelector('.inno-picker-popover') && document.activeElement?.classList.contains('inno-select-trigger')"))

# B-grade operational-form polish.
c.nav("software-maintenance-new.html")
check("Software Maintenance uses staged operational layout",c.eval("document.querySelectorAll('.ux-section').length===2 && !!document.querySelector('.ux-operational-aside') && !!document.querySelector('details.ux-advanced')"))
check("Software action is segmented and package is a resource picker",c.eval("""(()=>{const s=[...document.querySelectorAll('select')];return s.some(x=>x.dataset.innoEnhanced==='segmented'&&x.closest('.field')?.querySelector('label')?.textContent==='Action')&&s.some(x=>x.hasAttribute('data-inno-resource-picker')&&x.closest('.field')?.querySelector('label')?.textContent==='Package')})()"""))

c.nav("restart-schedule.html")
check("Restart Schedule separates target, time and notification",c.eval("document.querySelectorAll('.ux-section').length===3 && !!document.querySelector('.ux-operational-aside')"))
check("Restart target uses resource picker and grace uses segmented control",c.eval("""(()=>{const s=[...document.querySelectorAll('select')];return s.some(x=>x.hasAttribute('data-inno-resource-picker'))&&s.some(x=>x.dataset.innoEnhanced==='segmented'&&x.closest('.field')?.querySelector('label')?.textContent==='Grace period')})()"""))

c.nav("device-alert-rule.html")
check("Alert Rule uses three-step detection editor",c.eval("document.querySelectorAll('.ux-section').length===3 && !!document.querySelector('.ux-operational-aside')"))
c.eval("""(()=>{const s=document.getElementById('ruleType'),seg=s.nextElementSibling;[...seg.querySelectorAll('.inno-segment')].find(x=>x.textContent.includes('Hardware')).click()})()""");time.sleep(.04)
check("Alert rule type still switches conditional fields",c.eval("document.getElementById('offlineFields').hidden && !document.getElementById('inventoryFields').hidden"))

c.nav("remote-consent-policy.html")
check("Consent Policy uses policy-specific prompt controls",c.eval("document.querySelectorAll('.inno-segmented').length>=4 && document.querySelectorAll('.ux-decision').length===2"))
c.eval("document.querySelector('#modeGrid button[data-mode=trusted]').click()");time.sleep(.02)
check("Consent mode cards remain interactive",c.eval("document.querySelector('#modeGrid button[data-mode=trusted]').classList.contains('active')"))

c.nav("access-scope-edit.html")
check("Access Assignment is structured as Who-Where-What",c.eval("document.querySelectorAll('.ux-section').length===3 && document.querySelectorAll('select[data-inno-resource-picker]').length===3"))
check("Access scope type uses segmented control",c.eval("""[...document.querySelectorAll('select')].some(x=>x.closest('.field')?.querySelector('label')?.textContent==='Scope type'&&x.dataset.innoEnhanced==='segmented')"""))

c.nav("device-query.html")
c.eval("document.querySelectorAll('.arch-side-list button[data-query-type]')[1].click()");time.sleep(.05)
check("Saved Query refreshes custom Fact selector",c.eval("document.getElementById('queryFact').value==='Service' && document.getElementById('queryFact').nextElementSibling.querySelector('.inno-select-value').textContent.trim()==='Service'"))
check("Saved Query refreshes custom Operator selector",c.eval("document.getElementById('queryOperator').value==='equals' && document.getElementById('queryOperator').nextElementSibling.querySelector('.inno-select-value').textContent.trim()==='equals'"))

c.nav("deployment-new.html")
check("Deployment remains six-step wizard",c.eval("document.querySelectorAll('.arch-step').length===6"))
c.eval("document.getElementById('nextStep').click()");time.sleep(.03)
check("Deployment target step uses segmented source and resource picker",c.eval("document.querySelector('[data-pane=\"2\"] select[data-inno-resource-picker]').dataset.innoEnhanced==='select' && document.querySelector('[data-pane=\"2\"] select[data-inno-display=\"segmented\"]').dataset.innoEnhanced==='segmented'"))
c.eval("document.getElementById('nextStep').click()");time.sleep(.03)
check("Deployment payload uses resource picker",c.eval("document.querySelector('[data-pane=\"3\"] select[data-inno-resource-picker]').dataset.innoEnhanced==='select'"))
c.eval("document.getElementById('nextStep').click()");time.sleep(.03)
check("Deployment schedule uses segmented choices",c.eval("document.querySelectorAll('[data-pane=\"4\"] .inno-segmented').length===2"))
c.eval("document.getElementById('nextStep').click()");time.sleep(.03)
check("Deployment safeguards use segmented choices",c.eval("document.querySelectorAll('[data-pane=\"5\"] .inno-segmented').length===2"))

# B-grade configuration / account polish.
c.nav("meeting-new.html")
check("Meeting starts with exactly one capture form visible",c.eval("document.querySelector('[data-capture-pane=record]').hidden===false && document.querySelector('[data-capture-pane=upload]').hidden===true"))
c.eval("document.querySelector('#captureMode [data-mode=upload]').click()");time.sleep(.03)
check("Meeting mode switch shows upload and hides record",c.eval("document.querySelector('[data-capture-pane=record]').hidden===true && document.querySelector('[data-capture-pane=upload]').hidden===false && document.querySelector('#captureMode [data-mode=upload]').classList.contains('active')"))

c.nav("helpdesk-calendar.html")
check("Business Calendar renders seven readable day cards",c.eval("document.querySelectorAll('.ux-day-card').length===7 && document.querySelectorAll('.ux-day-card.off').length===2"))
check("Calendar separates working hours from holiday exceptions",c.eval("document.querySelectorAll('.ux-section').length===2"))

c.nav("device-alert-channels.html")
check("Alert Channels uses purpose-built sections",c.eval("document.querySelectorAll('.ux-section').length===3 && document.querySelectorAll('.inno-segmented').length>=4"))
check("Alert Channels keeps health as supporting context",c.eval("!!document.querySelector('.ux-operational-aside') && !!document.getElementById('testAlert')"))

c.nav("helpdesk-notification-settings.html")
check("Notification Settings separates connection and delivery defaults",c.eval("document.querySelectorAll('.ux-section').length===2 && document.querySelectorAll('.inno-segmented').length===3"))
check("Notification delivery safeguards are explicit decisions",c.eval("document.querySelectorAll('.ux-decision').length===2"))

c.nav("helpdesk-categories.html")
c.eval("""document.querySelector('.ux-category-node[data-category="Hardware"]').click()""");time.sleep(.04)
check("Category selection updates detail and enhanced team picker",c.eval("document.getElementById('categoryName').value==='Hardware' && document.getElementById('categoryTeam').value==='IT Support' && document.getElementById('categoryTeam').nextElementSibling.textContent.includes('IT Support')"))

c.nav("helpdesk-requester-groups.html")
c.eval("document.querySelectorAll('.arch-side-list button[data-group-name]')[2].click()");time.sleep(.04)
check("Requester Group selection refreshes visible condition selector",c.eval("document.getElementById('requesterGroupField').value==='Department' && document.getElementById('requesterGroupField').nextElementSibling.textContent.includes('Department') && document.getElementById('requesterGroupValue').value==='Finance'"))

c.nav("helpdesk-sla.html")
check("SLA policy uses resource pickers for calendar and applicability",c.eval("document.querySelectorAll('select[data-inno-resource-picker]').length===2"))
check("SLA policy exposes two explicit target cards",c.eval("document.querySelectorAll('.ux-sla-target').length===2"))

c.nav("endpoint-policies.html")
check("Endpoint Policy hides USB exceptions behind progressive detail",c.eval("!!document.querySelector('details.ux-advanced') && document.querySelector('details.ux-advanced').open===false"))
check("Endpoint Policy no longer exposes unavailable primary create actions",c.eval("!document.querySelector('.page-head button[disabled]')"))

c.nav("modules.html")
check("Module inspector exposes active Inspect actions",c.eval("document.querySelectorAll('[data-detail]:not([disabled])').length>=5"))
c.eval("""(()=>{const b=[...document.querySelectorAll('[data-detail]')].find(x=>x.dataset.detail==='helpdesk');b.click()})()""");time.sleep(.04)
check("Module Inspect updates selected module overview",c.eval("document.querySelector('#moduleDetail h3').textContent==='Helpdesk' && !!document.querySelector('#moduleDetail details.ux-tech-details:not([open])')"))

c.nav("profile.html")
check("Profile defaults to Profile & Security pane only",c.eval("document.querySelector('[data-profile-pane=profile]').hidden===false && document.querySelector('[data-profile-pane=preferences]').hidden===true"))
c.eval("document.querySelector('[data-profile-tab=preferences]').click()");time.sleep(.03)
check("Profile preferences tab isolates preference controls",c.eval("document.querySelector('[data-profile-pane=profile]').hidden===true && document.querySelector('[data-profile-pane=preferences]').hidden===false && document.querySelector('[data-profile-pane=preferences] select').dataset.innoEnhanced==='segmented'"))

# Route ownership cleanup: application navigation must use canonical routes, not hash navigation.
c.nav("devices-overview-v2.html")
check("Devices sidebar points to canonical devices route",c.eval("document.querySelector('.side a[href=\"devices.html\"]')!==null && document.querySelectorAll('.side a[href*=\"#\"]').length===0"))
c.nav("devices.html")
check("All Devices owns active Devices sidebar item",c.eval("document.querySelector('.side a.active')?.getAttribute('href')==='devices.html'"))

c.nav("ticket-detail.html")
check("Ticket detail inherits canonical Tickets route",c.eval("document.querySelector('.side a.active')?.getAttribute('href')==='helpdesk-tickets.html' && document.querySelector('.breadcrumb-back')?.getAttribute('href')==='helpdesk-tickets.html'"))
c.nav("meeting-detail.html")
check("Meeting detail returns to My Meetings route",c.eval("document.querySelector('.side a.active')?.getAttribute('href')==='meeting-list.html' && document.querySelector('.breadcrumb-back')?.getAttribute('href')==='meeting-list.html'"))

c.nav("workspace-attention.html")
check("Workspace attention is a real route",c.eval("document.querySelector('.side a.active')?.getAttribute('href')==='workspace-attention.html'"))

c.nav("app-launcher-v2.html","?filter=pinned")
check("App Launcher pinned filter uses query route",c.eval("document.querySelector('.side a.active')?.getAttribute('href')==='app-launcher-v2.html?filter=pinned' && document.querySelector('.segment [data-filter=pinned]').classList.contains('active')"))
c.nav("app-launcher-v2.html","?view=recent")
check("App Launcher recent view uses query route without hash",c.eval("document.querySelector('.side a.active')?.getAttribute('href')==='app-launcher-v2.html?view=recent' && document.getElementById('apps').hidden===true"))

c.nav("reports-overview.html","?report=software")
check("Report catalog uses query route and restores selected report",c.eval("document.querySelector('.side a.active')?.getAttribute('href')==='reports-overview.html?report=software' && document.getElementById('reportTitle').textContent==='Software Inventory'"))

# Final Action/Layout contract regression.
c.viewport(1366);c.nav("endpoint-policies.html")
check("Endpoint Policies defaults to Policies editor view",c.eval("document.querySelector('[data-view=policies]').hidden===false && document.querySelector('[data-view=compliance]').hidden===true && document.querySelector('[data-policy-view=policies]').classList.contains('active')"))
check("Endpoint Policies editor footer belongs to editor pane",c.eval("document.querySelector('.inno-editor-pane > .inno-editor-footer')!==null && getComputedStyle(document.querySelector('.inno-editor-footer')).position==='static'"))
check("Endpoint Policies has no unavailable competing footer action",c.eval("document.querySelectorAll('.inno-editor-footer [disabled],.inno-editor-footer [aria-disabled=\"true\"]').length===0 && !document.body.textContent.includes('Preview Impact')"))
c.nav("endpoint-policies.html","?view=compliance")
check("Endpoint Policies Compliance is a separate view",c.eval("document.querySelector('[data-view=policies]').hidden===true && document.querySelector('[data-view=compliance]').hidden===false && document.querySelector('[data-policy-view=compliance]').classList.contains('active')"))

c.viewport(768);c.nav("endpoint-policies.html")
check("Clean editor footer does not cover tablet content",c.eval("""(()=>{const f=document.querySelector('.inno-editor-footer');return !f.classList.contains('is-docked')&&getComputedStyle(f).position==='static'})()"""))
c.eval("""(()=>{const r=[...document.querySelectorAll('input[name="usb"]')].find(x=>!x.checked);r.click()})()""");time.sleep(.06)
check("Dirty editor footer docks to owning pane at tablet width",c.eval("""(()=>{const f=document.querySelector('.inno-editor-footer'),r=f.getBoundingClientRect(),owner=f.parentElement.getBoundingClientRect();return f.classList.contains('is-docked')&&getComputedStyle(f).position==='fixed'&&r.top>=0&&r.bottom<=innerHeight+2&&Math.abs(r.left-owner.left)<=2&&Math.abs(r.width-owner.width)<=2})()"""))

c.viewport(1366);c.nav("device-query.html")
check("Inventory Query actions belong to builder, not page header",c.eval("document.querySelector('.page-head .actions')===null && document.querySelector('.query-workspace > .inno-builder-footer #saveQuery')!==null && document.querySelector('.query-workspace > .inno-builder-footer #runQuery')!==null"))

c.nav("helpdesk-sla.html")
check("SLA editor keeps editable behavior in main column",c.eval("""(()=>{const main=document.querySelector('.ux-operational-main'),aside=document.querySelector('.ux-operational-aside');return main.textContent.includes('Policy behavior')&&main.querySelector('.inno-editor-footer')&&aside.textContent.includes('Live SLA monitor')&&!aside.textContent.includes('Save Policy')})()"""))

c.nav("device-groups.html","?tab=dynamic")
check("Dynamic Group deep link opens builder tab",c.eval("document.querySelector('#groupTabs [data-tab=dynamic]').classList.contains('active') && document.querySelector('[data-panel=dynamic]').classList.contains('active')"))
check("Dynamic Group save belongs to builder footer",c.eval("document.querySelector('[data-panel=dynamic] > .inno-builder-footer [data-inno-save]')!==null && document.querySelectorAll('[data-panel=dynamic] button[disabled]').length===0"))

c.nav("asset-qr.html")
check("QR workflow actions moved out of page header",c.eval("document.querySelector('.page-head .actions')===null && document.querySelector('.inno-builder-footer #printSelectedBtn')!==null && document.querySelector('.inno-builder-footer #generateQrBtn')!==null && !document.getElementById('labelSettingsBtn')"))

# Availability / Coming Soon cleanup regression.
c.nav("workspace-v2.html")
check("Workspace recent history uses canonical route",c.eval("document.querySelector('#recent .panel-head a[href=\"workspace-recent.html\"]')!==null"))

c.nav("modules.html")
check("Available modules expose Inspect without fake Install",c.eval("document.querySelectorAll('[data-install]').length===0 && [...document.querySelectorAll('.registry-row')].some(r=>r.textContent.includes('Available')&&r.querySelector('[data-detail]'))"))

c.nav("remote-operations.html")
check("Remote Operations has no visible unavailable task action",c.eval("[...document.querySelectorAll('button,a')].filter(e=>getComputedStyle(e).display!=='none').every(e=>!(((e.getAttribute('title')||'')+' '+e.textContent).toLowerCase().includes('coming soon'))) && !document.querySelector('[title*=\"Create Job · Coming soon\"]')"))

c.nav("helpdesk-statuses.html")
check("Helpdesk statuses are read-only instead of fake-editable",c.eval("document.querySelectorAll('table th').length===4 && !document.querySelector('button[title*=\"Edit\"]') && !document.body.textContent.includes('Edit Transitions')"))

c.nav("admin.html")
check("Admin overview only uses interactive navigation tiles",c.eval("document.querySelectorAll('div.admin-tile').length===0 && document.querySelectorAll('a.admin-tile[href]').length>=4"))

c.nav("device-add.html")
check("Generate Installer is an active prototype action",c.eval("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Generate Installer'));return !!b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'})()"))

print(f"checks={checks}")
print(f"failures={len(fails)}")
for x in fails:print("FAILED",x)
sys.exit(1 if fails else 0)
