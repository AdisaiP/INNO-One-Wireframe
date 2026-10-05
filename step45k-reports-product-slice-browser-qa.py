from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45k-reports-product-slice-browser"
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
 const r=await fetch('/api/v1/reports?page=1&pageSize=100&search=QA%20Step45K%20Browser',{headers});
 const list=await r.json();
 const result=[];
 for(const item of (list.items||[])){
   const dr=await fetch('/api/v1/reports/'+encodeURIComponent(item.id),{headers});
   if(!dr.ok) continue;
   const d=(await dr.json()).data;
   const rr=await fetch('/api/v1/reports/'+encodeURIComponent(item.id),{
     method:'DELETE',headers:{...headers,'If-Match':d.eTag}
   });
   result.push({id:item.id,status:rr.status});
 }
 return result;
""")
check("Interrupted browser QA reports cleaned", all(x.get("status")==204 for x in orphans), orphans)

sources=api(c,"""
 const r=await fetch('/api/v1/reports/sources',{headers});
 return {status:r.status,data:await r.json()};
""")
check("Browser report sources 200", sources.get("status")==200, sources)
assets=next((x for x in sources.get("data",{}).get("items",[]) if x.get("key")=="assets.inventory"),None)
check("Assets report source available", bool(assets), assets)
if not assets:
    raise SystemExit(1)

name="QA Step45K Browser "+str(int(time.time()))
columns=[x["key"] for x in assets.get("columns",[])[:4]]
created=api(c,"""
 const r=await fetch('/api/v1/reports',{
   method:'POST',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify(%s)
 });
 return {status:r.status,data:await r.json()};
""" % json.dumps({
    "name":name,
    "description":"Step45K browser runtime QA",
    "sourceKey":"assets.inventory",
    "columns":columns,
    "filters":[],
}))
check("Browser QA report create 201", created.get("status")==201, created)
report=created["data"]["data"]
report_id=report["id"]
etag=report["eTag"]

routes=[
 ("/reports","list"),
 (f"/reports/{report_id}","editor"),
 (f"/reports/{report_id}/runs","runs"),
 ("/reports/schedules","schedules"),
]
for width in WIDTHS:
    c.viewport(width)
    for route,label in routes:
        check(f"{width} {label} route ready", nav(c,route))
        page=body(c)
        if label=="list":
            check(f"{width} list title", "Reports" in page)
            check(f"{width} report visible", bool(wait(c, "document.body.innerText.includes("+json.dumps(name)+")", 10)))
        elif label=="editor":
            check(f"{width} editor title", "Edit Report" in page)
            check(f"{width} editor source", "Asset Inventory" in page)
        elif label=="runs":
            check(f"{width} run history title", "Run History" in page)
            check(f"{width} generate action", "Generate Report" in page)
        else:
            check(f"{width} schedules title", "Report Schedules" in page)
        check(f"{width} {label} no overflow", no_overflow(c))
        check(f"{width} {label} Reports shell context", "outside the currently enabled production modules" not in page)
        c.shot(f"{width}__reports-{label}-en.png")

c.viewport(1366)
check("Run route ready for UI execution", nav(c,f"/reports/{report_id}/runs"))
check(
    "Generate Report enabled",
    bool(wait(c, """(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Generate Report');return !!b&&!b.disabled})()""",8)),
)
check("Generate Report dispatched", bool(click_text(c,"Generate Report")))
check("Completed run visible after UI dispatch", bool(wait(c, "document.body.innerText.includes('Completed')",12)))
runs=api(c,"""
 const r=await fetch('/api/v1/reports/%s/runs?page=1&pageSize=25',{headers});
 return {status:r.status,data:await r.json()};
""" % report_id)
items=runs.get("data",{}).get("items",[])
check("UI run persisted", runs.get("status")==200 and any(x.get("status")=="completed" for x in items), items)
check("UI run persisted output", any(x.get("outputFileName") for x in items if x.get("status")=="completed"), items)
c.shot("1366__reports-runs-completed-en.png")

check("Switch user locale to Thai", set_profile_locale(c,"th-TH").get("status")==200)
thai_routes=[
 ("/reports","list"),
 (f"/reports/{report_id}","editor"),
 (f"/reports/{report_id}/runs","runs"),
 ("/reports/schedules","schedules"),
]
thai_expected={
 "list":"รายงาน",
 "editor":"แก้ไขรายงาน",
 "runs":"ประวัติการสร้างรายงาน",
 "schedules":"กำหนดเวลารายงาน",
}
for width in (1366,768):
    c.viewport(width)
    for route,label in thai_routes:
        check(f"{width} Thai {label} ready", nav(c,route))
        page=body(c)
        check(f"{width} Thai {label} copy", thai_expected[label] in page, page[:220])
        if label=="editor":
            check(f"{width} Thai editor source localized", "รายการทรัพย์สิน" in page, page[:320])
        check(f"{width} Thai {label} no overflow", no_overflow(c))
        check(f"{width} Thai {label} Reports shell context", "outside the currently enabled production modules" not in page)
        c.shot(f"{width}__reports-{label}-th.png")

check("Thai document language", c.ev("document.documentElement.lang")=="th", c.ev("document.documentElement.lang"))
check("Restore organization locale", set_admin_locale(c,original_default).get("status")==200)
check("Restore user locale", set_profile_locale(c,original_pref).get("status")==200)

deleted=api(c,"""
 const r=await fetch('/api/v1/reports/%s',{method:'DELETE',headers:{...headers,'If-Match':%s}});
 return r.status;
""" % (report_id,json.dumps(etag)))
check("Browser QA report soft-delete 204", deleted==204, deleted)

print(f"step45k_browser_checks={checks}")
print(f"step45k_browser_failures={len(failures)}")
print(f"step45k_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
raise SystemExit(1 if failures else 0)
