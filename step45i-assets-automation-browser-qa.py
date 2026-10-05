from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45i-assets-automation-browser"
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
helpers=helpers.replace('self.call("Page.enable"); self.call("Runtime.enable")', '')
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

orphans=api(c,"""
 const r=await fetch('/api/v1/assets/automations?page=1&pageSize=100',{headers});
 const list=await r.json();
 const result=[];
 for(const item of (list.items||[]).filter(x=>(x.name||'').startsWith('QA Step45I Browser '))){
   const dr=await fetch('/api/v1/assets/automations/'+encodeURIComponent(item.id),{headers});
   if(!dr.ok) continue;
   const d=(await dr.json()).data;
   const rr=await fetch('/api/v1/assets/automations/'+encodeURIComponent(item.id),{
     method:'DELETE',headers:{...headers,'If-Match':d.eTag}
   });
   result.push({id:item.id,status:rr.status});
 }
 return result;
""")
check("Interrupted browser QA definitions cleaned", all(x.get("status")==204 for x in orphans), orphans)

context=api(c,"""
 const r=await fetch('/api/v1/assets?page=1&pageSize=100',{headers});
 const list=await r.json();
 const asset=(list.items||[]).find(x=>['in_use','stock','repair','retired'].includes(x.status));
 if(!asset)return null;
 const detail=await fetch('/api/v1/assets/'+encodeURIComponent(asset.id),{headers});
 return detail.ok ? (await detail.json()).data : null;
""")
check("Asset browser context found", bool(context), context)
if not context:
    raise SystemExit(1)

asset_id=context["id"]
asset_status=context["status"]
name="QA Step45I Browser "+str(int(time.time()))
nodes=[
 {
   "id":"when","kind":"trigger","catalogKey":"assets.asset.lifecycle_status",
   "label":"Lifecycle Status","labelKey":"assets.automation.catalog.lifecycle.label",
   "description":"Requires current lifecycle status.",
   "descriptionKey":"assets.automation.catalog.lifecycle.description",
   "configuration":{"status":asset_status}
 },
 {
   "id":"then","kind":"action","catalogKey":"assets.asset.set_lifecycle_status",
   "label":"Update Lifecycle","labelKey":"assets.automation.catalog.setLifecycle.label",
   "description":"Sets the same lifecycle status for idempotent browser QA.",
   "descriptionKey":"assets.automation.catalog.setLifecycle.description",
   "configuration":{"status":asset_status}
 },
 {
   "id":"end","kind":"end","catalogKey":"workflow.end",
   "label":"End","labelKey":"assets.automation.catalog.end.label",
   "description":"Ends this automation path.",
   "descriptionKey":"assets.automation.catalog.end.description",
   "configuration":{}
 }
]
edges=[
 {"id":"edge_when_then","source":"when","target":"then"},
 {"id":"edge_then_end","source":"then","target":"end"}
]
created=api(c,"""
 const r=await fetch('/api/v1/assets/automations',{
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

c.viewport(1366)
check("List route ready before cache refresh", nav(c,"/assets/automation"))
c.call("Page.reload",{"ignoreCache":True})
check(
    "List refetch includes browser QA definition",
    bool(wait(c, "document.body.innerText.includes("+json.dumps(name)+")", 12)),
)

routes=[
 ("/assets/automation","list"),
 (f"/assets/automation/{automation_id}","editor"),
 (f"/assets/automation/{automation_id}/runs","runs"),
]
for width in WIDTHS:
    c.viewport(width)
    for route,label in routes:
        check(f"{width} {label} route ready", nav(c,route))
        page=body(c)
        if label=="list":
            check(f"{width} list title", "Automation" in page)
            check(f"{width} created rule visible",
                  bool(wait(c, "document.body.innerText.includes("+json.dumps(name)+")", 10)))
        elif label=="editor":
            check(f"{width} editor WHEN IF THEN", all(x in page for x in ("WHEN","IF","THEN")))
            check(f"{width} editor has no React Flow", c.ev("!!document.querySelector('.react-flow')") is False)
        else:
            check(f"{width} run history title", "Run History" in page)
            check(f"{width} run launcher", c.ev("!!document.querySelector('.automation-run-launcher')") is True)
        check(f"{width} {label} no overflow", no_overflow(c))
        c.shot(f"{width}__assets-automation-{label}-en.png")

c.viewport(1366)
runs_route=f"/assets/automation/{automation_id}/runs"
check("Run History ready for execution", nav(c,runs_route))
check(
    "Asset option loaded",
    bool(wait(c, """(()=>{const e=document.querySelector('.automation-run-launcher select');return !!e&&[...e.options].some(x=>x.value===%s)})()""" % json.dumps(asset_id),10)),
)
check("Select Asset context", bool(set_select(c,asset_id)))
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
    return api(c, """const r=await fetch('/api/v1/assets/automations/%s/runs/%s',{headers});return {status:r.status,data:r.ok?(await r.json()).data:await r.json()};""" % (automation_id,run_id))

deadline=time.time()+20
run=None
while time.time()<deadline:
    run=get_run()
    if run.get("status")==200 and isinstance(run.get("data"),dict) and run["data"].get("status") in ("completed","failed"):
        break
    time.sleep(.25)

check("UI-dispatched Asset run completes", run and run.get("data",{}).get("status")=="completed", run)
detail=(run or {}).get("data",{})
steps=detail.get("steps",[])
check("UI Asset run persists three steps", len(steps)==3, steps)
action=next((x for x in steps if x.get("catalogKey")=="assets.asset.set_lifecycle_status"),None)
check(
    "UI Asset run is idempotent and non-mutating",
    action is not None and (action.get("output") or {}).get("idempotentReplay") is True,
    action,
)
check("Completed drawer renders three steps", bool(wait(c,"document.querySelectorAll('.automation-run-step').length===3",8)))
check("English completed status visible", "Completed" in body(c))
c.shot("1366__assets-automation-runs-completed-en.png")

check("Switch user locale to Thai", set_profile_locale(c,"th-TH").get("status")==200)
thai_routes=[
 ("/assets/automation","list"),
 (f"/assets/automation/{automation_id}","editor"),
 (runs_route+"?run="+run_id,"runs"),
]
for width in (1366,768):
    c.viewport(width)
    for route,label in thai_routes:
        check(f"{width} Thai {label} ready", nav(c,route))
        page=body(c)
        if label=="list":
            check(f"{width} Thai list copy", "ระบบอัตโนมัติ" in page)
        elif label=="editor":
            check(f"{width} Thai editor copy", "WHEN" in page and "THEN" in page)
            check(f"{width} Thai editor no React Flow", c.ev("!!document.querySelector('.react-flow')") is False)
        else:
            check(f"{width} Thai run history copy", "ประวัติการทำงาน" in page)
            check(f"{width} Thai completed status", "สำเร็จ" in page)
            check(f"{width} Thai detail steps",
                  bool(wait(c,"document.querySelectorAll('.automation-run-step').length===3",8)))
        check(f"{width} Thai {label} no overflow", no_overflow(c))
        c.shot(f"{width}__assets-automation-{label}-th.png")

check("Thai document language", c.ev("document.documentElement.lang")=="th", c.ev("document.documentElement.lang"))
check("Restore organization locale", set_admin_locale(c,original_default).get("status")==200)
check("Restore user locale", set_profile_locale(c,original_pref).get("status")==200)
deleted=api(c, """const r=await fetch('/api/v1/assets/automations/%s',{method:'DELETE',headers:{...headers,'If-Match':%s}});return r.status;""" % (automation_id,json.dumps(etag)))
check("Browser QA Assets definition soft-delete 204", deleted==204, deleted)

print(f"step45i_browser_checks={checks}")
print(f"step45i_browser_failures={len(failures)}")
print(f"step45i_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
raise SystemExit(1 if failures else 0)
