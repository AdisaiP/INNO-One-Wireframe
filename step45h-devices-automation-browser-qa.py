from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45h-devices-automation-browser"
REALM=ROOT/"production/infrastructure/docker/keycloak/realm-inno-one.json"
PORT=9241
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
        failures.append((name,detail))

source=(ROOT/"step45g-helpdesk-automation-runs-browser-qa.py").read_text(encoding="utf-8")
helpers=source[source.index("class CDP:"):source.index("c=CDP(); c.viewport(1366)")]
helpers=helpers.replace("timeout=10,origin=", "timeout=30,origin=")
exec(helpers)

c=CDP()
c.viewport(1366)
check("Keycloak login completes", login(c), c.ev("location.href") or "")

original_profile=profile_state(c)
original_settings=admin_settings(c)
original_pref=original_profile.get("preferredLocale")
original_default=original_settings["localization"]["defaultLocale"]
check("Force English organization default", set_admin_locale(c,"en-US").get("status")==200)
check("Use organization locale", set_profile_locale(c,None).get("status")==200)

# Cleanup interrupted browser definitions only.
orphans=api(c,"""
 const r=await fetch('/api/v1/devices/automations?page=1&pageSize=100',{headers});
 const list=await r.json();
 const result=[];
 for(const item of (list.items||[]).filter(x=>(x.name||'').startsWith('QA Step45H Browser '))){
   const dr=await fetch('/api/v1/devices/automations/'+encodeURIComponent(item.id),{headers});
   if(!dr.ok) continue;
   const d=(await dr.json()).data;
   const rr=await fetch('/api/v1/devices/automations/'+encodeURIComponent(item.id),{
     method:'DELETE',headers:{...headers,'If-Match':d.eTag}
   });
   result.push({id:item.id,status:rr.status});
 }
 return result;
""")
check("Interrupted browser QA definitions cleaned", all(x.get("status")==204 for x in orphans), orphans)

context=api(c,"""
 const gr=await fetch('/api/v1/devices/groups?page=1&pageSize=100&status=active',{headers});
 const groups=await gr.json();
 const locals=(groups.items||[]).filter(g=>g.groupType==='static'&&g.status==='active'&&g.syncStatus==='local');
 for(const group of locals){
   const mr=await fetch('/api/v1/devices/groups/'+encodeURIComponent(group.id)+'/members?page=1&pageSize=100',{headers});
   if(!mr.ok) continue;
   const members=await mr.json();
   for(const m of (members.items||[])){
     const dr=await fetch('/api/v1/devices/'+encodeURIComponent(m.id),{headers});
     if(!dr.ok) continue;
     const d=(await dr.json()).data;
     if(d.operatingSystem && ['online','offline'].includes((d.status||'').toLowerCase())){
       return {device:d,group};
     }
   }
 }
 return null;
""")
check("Existing-member device context found", bool(context), context)
if not context:
    raise SystemExit(1)

device=context["device"]
group=context["group"]
device_id=device["id"]
group_id=group["id"]
trigger="device.online" if str(device["status"]).lower()=="online" else "device.offline"

name="QA Step45H Browser "+str(int(time.time()))
nodes=[
 {
   "id":"when","kind":"trigger","catalogKey":trigger,
   "label":"Device Online" if trigger=="device.online" else "Device Offline",
   "labelKey":"devices.automation.catalog.deviceOnline.label" if trigger=="device.online" else "devices.automation.catalog.deviceOffline.label",
   "description":"Current device state trigger.",
   "descriptionKey":"devices.automation.catalog.deviceOnline.description" if trigger=="device.online" else "devices.automation.catalog.deviceOffline.description",
   "configuration":{}
 },
 {
   "id":"then","kind":"action","catalogKey":"devices.device.add_to_group",
   "label":"Add to Group","labelKey":"devices.automation.catalog.addToGroup.label",
   "description":"Adds the device to a local static group.",
   "descriptionKey":"devices.automation.catalog.addToGroup.description",
   "configuration":{"groupId":group_id}
 },
 {
   "id":"end","kind":"end","catalogKey":"workflow.end",
   "label":"End","labelKey":"devices.automation.catalog.end.label",
   "description":"Ends this remediation path.",
   "descriptionKey":"devices.automation.catalog.end.description",
   "configuration":{}
 }
]
edges=[
 {"id":"edge_when_then","source":"when","target":"then"},
 {"id":"edge_then_end","source":"then","target":"end"}
]
created=api(c,"""
 const r=await fetch('/api/v1/devices/automations',{
   method:'POST',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify(%s)
 });
 return {status:r.status,data:await r.json()};
""" % json.dumps({"name":name,"nodes":nodes,"edges":edges,"orientation":"horizontal"}))
check("Browser QA definition create 201", created.get("status")==201, created)
automation=created["data"]["data"]
automation_id=automation["id"]
etag=automation["eTag"]

# The definition was created outside React Query, so reload the list once to establish
# the authoritative server state before responsive route checks.
c.viewport(1366)
check("List route ready before cache refresh", nav(c,"/devices/automation"))
c.call("Page.reload",{"ignoreCache":True})
check(
    "List refetch includes browser QA definition",
    bool(wait(c, "document.body.innerText.includes("+json.dumps(name)+")", 12)),
)

routes=[
 ("/devices/automation","list"),
 (f"/devices/automation/{automation_id}","editor"),
 (f"/devices/automation/{automation_id}/history","history"),
]
for width in WIDTHS:
    c.viewport(width)
    for route,label in routes:
        check(f"{width} {label} route ready", nav(c,route))
        page=body(c)
        if label=="list":
            check(f"{width} list title", "Automation & Remediation" in page)
            check(
                f"{width} created rule visible",
                bool(wait(c, "document.body.innerText.includes("+json.dumps(name)+")", 10)),
            )
        elif label=="editor":
            check(f"{width} editor WHEN IF THEN", all(x in page for x in ("WHEN","IF","THEN")))
            check(f"{width} editor has no React Flow", c.ev("!!document.querySelector('.react-flow')") is False)
        else:
            check(f"{width} history title", "Run History" in page)
            check(f"{width} run launcher", c.ev("!!document.querySelector('.automation-run-launcher')") is True)
        check(f"{width} {label} no overflow", no_overflow(c))
        c.shot(f"{width}__devices-automation-{label}-en.png")

# Run from UI using an existing membership so the action is idempotent and creates no new membership.
c.viewport(1366)
history_route=f"/devices/automation/{automation_id}/history"
check("History ready for execution", nav(c,history_route))
check(
    "Existing member device option loaded",
    bool(wait(c, """(()=>{const e=document.querySelector('.automation-run-launcher select');return !!e&&[...e.options].some(x=>x.value===%s)})()""" % json.dumps(device_id),10)),
)
check("Select device context", bool(set_select(c,device_id)))
check(
    "Run Automation enabled",
    bool(wait(c, """(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Run Automation');return !!b&&!b.disabled})()""",8)),
)
check("Run Automation dispatched", bool(click_text(c,"Run Automation")))
run_id=wait(c,"new URLSearchParams(location.search).get('run')||''",10) or ""
check("Run query selection appears", run_id.startswith("run_"), run_id)

def get_run():
    if not run_id:
        return {"status":0,"data":{}}
    return api(c, """const r=await fetch('/api/v1/devices/automations/%s/runs/%s',{headers});return {status:r.status,data:r.ok?(await r.json()).data:await r.json()};""" % (automation_id,run_id))

deadline=time.time()+20
run=None
while time.time()<deadline:
    run=get_run()
    if run.get("status")==200 and isinstance(run.get("data"),dict) and run["data"].get("status") in ("completed","failed"):
        break
    time.sleep(.25)

check("UI-dispatched run completes", run and run.get("data",{}).get("status")=="completed", run)
detail=(run or {}).get("data",{})
steps=detail.get("steps",[])
check("UI run persists three steps", len(steps)==3, steps)
action=next((x for x in steps if x.get("catalogKey")=="devices.device.add_to_group"),None)
check(
    "UI run is idempotent and non-mutating",
    action is not None and (action.get("output") or {}).get("idempotentReplay") is True,
    action,
)
check("Completed drawer renders", bool(wait(c,"document.querySelectorAll('.automation-run-step').length===3",8)))
check(
    "English run summary reaches completed",
    bool(wait(c, "(()=>{const e=document.querySelector('.automation-run-detail-summary');return !!e&&e.innerText.includes('Completed')&&!e.innerText.includes('Running')})()", 8)),
)
check(
    "English run duration resolves",
    bool(wait(c, "(()=>{const e=document.querySelector('.automation-run-detail-summary');return !!e&&!e.innerText.includes('—')})()", 8)),
)
check("English completed status visible", "Completed" in body(c))
c.shot("1366__devices-automation-history-completed-en.png")

# Thai critical states.
check("Switch user locale to Thai", set_profile_locale(c,"th-TH").get("status")==200)
thai_routes=[
 ("/devices/automation","list"),
 (f"/devices/automation/{automation_id}","editor"),
 (history_route+"?run="+run_id,"history"),
]
for width in (1366,768):
    c.viewport(width)
    for route,label in thai_routes:
        check(f"{width} Thai {label} ready", nav(c,route))
        page=body(c)
        if label=="list":
            check(f"{width} Thai list copy", "ระบบอัตโนมัติและการแก้ไข" in page)
        elif label=="editor":
            check(f"{width} Thai editor copy", "แก้ไขระบบอัตโนมัติของอุปกรณ์" in page)
            check(f"{width} Thai editor no React Flow", c.ev("!!document.querySelector('.react-flow')") is False)
        else:
            check(f"{width} Thai history copy", "ประวัติการทำงาน" in page)
            check(f"{width} Thai completed status", "สำเร็จ" in page)
            check(f"{width} Thai detail steps", bool(wait(c,"document.querySelectorAll('.automation-run-step').length===3",8)))
        check(f"{width} Thai {label} no overflow", no_overflow(c))
        c.shot(f"{width}__devices-automation-{label}-th.png")

check("Thai document language", c.ev("document.documentElement.lang")=="th", c.ev("document.documentElement.lang"))

# Restore locale + cleanup definition.
check("Restore organization locale", set_admin_locale(c,original_default).get("status")==200)
check("Restore user locale", set_profile_locale(c,original_pref).get("status")==200)
deleted=api(c, """const r=await fetch('/api/v1/devices/automations/%s',{method:'DELETE',headers:{...headers,'If-Match':%s}});return r.status;""" % (automation_id,json.dumps(etag)))
check("Browser QA definition soft-delete 204", deleted==204, deleted)

print(f"step45h_browser_checks={checks}")
print(f"step45h_browser_failures={len(failures)}")
print(f"step45h_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
raise SystemExit(1 if failures else 0)
