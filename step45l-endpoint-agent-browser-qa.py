from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
REALM=ROOT/"production/infrastructure/docker/keycloak/realm-inno-one.json"
OUT=ROOT/"qa-step45l-endpoint-agent-browser"
PORT=9241
WIDTHS=(820,640,390)
DEVICE_ID="dev_80000000000000000000000000000002"
OTHER_DEVICE_ID="dev_80000000000000000000000000000001"

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

TOKEN_URL="http://172.10.1.58:8080/realms/inno-one/protocol/openid-connect/token"
token_response=requests.post(
    TOKEN_URL,
    data={
        "grant_type":"password",
        "client_id":"inno-one-e2e",
        "username":"adisai",
        "password":realm_password("adisai"),
        "scope":"openid",
    },
    timeout=10,
)
if token_response.status_code!=200:
    raise RuntimeError("Step45L QA token grant failed: "+str(token_response.status_code))
API_TOKEN=token_response.json()["access_token"]
API_BASE="http://127.0.0.1:5080/api/v1"

def py_api(method,path,body=None,extra=None):
    headers={"Authorization":"Bearer "+API_TOKEN,"Accept":"application/json"}
    if body is not None:
        headers["Content-Type"]="application/json"
    if extra:
        headers.update(extra)
    response=requests.request(
        method,
        API_BASE+path,
        headers=headers,
        data=None if body is None else json.dumps(body),
        timeout=20,
    )
    try:
        payload=None if response.status_code==204 else response.json()
    except ValueError:
        payload=response.text
    return {"status":response.status_code,"data":payload,"headers":dict(response.headers)}

# Step45L runs the standalone Endpoint Agent, not the Web Portal.
def login(c):
    c.navigate("http://localhost:5180/")
    password=realm_password("adisai")
    deadline=time.time()+35
    while time.time()<deadline:
        href=c.ev("location.href") or ""
        if any(host in href for host in ("172.10.1.58:8080","localhost:8080","127.0.0.1:8080")) and c.ev("!!document.querySelector('#kc-login')"):
            c.ev("document.querySelector('#username').value="+json.dumps("adisai")+";document.querySelector('#password').value="+json.dumps(password)+";document.querySelector('#kc-login').click();true")
            time.sleep(.5)
        if href.startswith("http://localhost:5180") and wait(c,"!!document.querySelector('.agent-app')",2):
            return True
        time.sleep(.2)
    return False

def api(c,script):
    return c.ev("""(async()=>{const headers={Authorization:'Bearer '+%s};%s})()""" % (json.dumps(API_TOKEN),script))

def reload_agent(c):
    c.call("Page.reload", {"ignoreCache": True})
    return bool(wait(c, "document.body.innerText.includes('INNO.One')", 12))

def click_button(c, text_value):
    return bool(c.ev("""
      (()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim().includes(%s));if(!b)return false;b.click();return true})()
    """ % json.dumps(text_value)))

original_profile_response=py_api("GET","/platform/me")
original_profile=(original_profile_response.get("data") or {}).get("data",{})
original_pref=original_profile.get("preferredLocale")
thai_response=py_api("PATCH","/platform/me/profile",{"preferredLocale":"th-TH"})
check("Force Agent Thai locale before boot", thai_response.get("status")==200, thai_response.get("status"))

c=CDP()
c.viewport(820)
check("Keycloak login completes", login(c), c.ev("location.href") or "")
check("Agent shell loads", bool(wait(c, "document.body.innerText.includes('INNO.One')", 12)), body(c)[:240])
check("Thai document language", c.ev("document.documentElement.lang")=="th", c.ev("document.documentElement.lang"))

profile=api(c,"""
 const r=await fetch('/api/v1/platform/me',{headers});
 return {status:r.status,data:await r.json()};
""")
check("Agent profile API 200", profile.get("status")==200, profile.get("status"))

context=api(c,"""
 const r=await fetch('/api/v1/agent/device-context/%s',{headers});
 return {status:r.status,data:await r.json()};
""" % DEVICE_ID)
check("Agent device context 200", context.get("status")==200, context)
device=context.get("data",{}).get("data",{})
check("Owned device context", device.get("hostname")=="NOTEBOOK-IT-003", device)

blocked=api(c,"""
 const r=await fetch('/api/v1/agent/device-context/%s',{headers});
 return {status:r.status,data:await r.json()};
""" % OTHER_DEVICE_ID)
check("Non-owned device context denied", blocked.get("status")==403, blocked)

ownership=api(c,"""
 const r=await fetch('/api/v1/agent/ownership/context?deviceId=%s',{headers});
 return {status:r.status,data:await r.json()};
""" % DEVICE_ID)
ownership_data=ownership.get("data",{}).get("data",{})
check("Agent ownership context 200", ownership.get("status")==200, ownership)
check("Linked asset is AST-NB-000003", ownership_data.get("assetTag")=="AST-NB-000003", ownership_data.get("assetTag"))

# Clean interrupted Request Help QA tickets without touching non-QA tickets.
help_cleanup=api(c,"""
 const list=await (await fetch('/api/v1/helpdesk/tickets?search='+encodeURIComponent('QA Step45L Agent')+'&status=open&page=1&pageSize=100',{headers})).json();
 const out=[];
 for(const item of (list.items||[]).filter(x=>(x.subject||'').startsWith('QA Step45L Agent '))){
   const detailResponse=await fetch('/api/v1/helpdesk/tickets/'+encodeURIComponent(item.id),{headers});
   if(!detailResponse.ok){out.push({id:item.id,status:detailResponse.status});continue;}
   const detail=(await detailResponse.json()).data;
   const resolved=await fetch('/api/v1/helpdesk/tickets/'+encodeURIComponent(item.id)+'/resolve',{
     method:'POST',
     headers:{...headers,'Content-Type':'application/json','If-Match':detail.eTag},
     body:JSON.stringify({resolutionCode:'qa_cleanup',note:'Step45L interrupted QA cleanup'})
   });
   out.push({id:item.id,status:resolved.status});
 }
 return out;
""")
check("Interrupted Request Help QA tickets cleaned", all(x.get("status")==200 for x in help_cleanup), help_cleanup)

# Clean interrupted QA submissions by rejecting only Step45L QA rows.
cleanup=api(c,"""
 const r=await fetch('/api/v1/assets/ownership-submissions?status=pending&page=1&pageSize=100',{headers});
 const j=await r.json();
 const out=[];
 for(const item of (j.items||[])){
   if(item.submittedLocation!=='Step45L QA') continue;
   const rr=await fetch('/api/v1/assets/ownership-submissions/'+encodeURIComponent(item.id)+'/decision',{
     method:'POST',
     headers:{...headers,'Content-Type':'application/json','If-Match':item.eTag},
     body:JSON.stringify({decision:'rejected',note:'Step45L QA cleanup'})
   });
   out.push({id:item.id,status:rr.status});
 }
 return out;
""")
check("Interrupted ownership QA rows cleaned", all(x.get("status")==200 for x in cleanup), cleanup)

# Responsive Thai home.
for width in WIDTHS:
    c.viewport(width)
    check(f"{width} Agent home visible", bool(wait(c, "document.body.innerText.includes('INNO.One Agent พร้อมใช้งาน')", 8)), body(c)[:260])
    check(f"{width} Agent no horizontal overflow", no_overflow(c))
    check(f"{width} Agent has Request Help", "ขอความช่วยเหลือ" in body(c))
    check(f"{width} Agent has ownership action", "ยืนยันผู้ใช้งาน" in body(c))
    c.shot(f"{width}__agent-home-th.png")

# Request Help UI.
c.viewport(820)
check("Open Request Help", click_button(c,"ขอความช่วยเหลือ"))
check("Request Help form visible", bool(wait(c, "document.body.innerText.includes('แจ้งปัญหาการใช้งาน')", 5)))
stamp=str(int(time.time()))
subject_value="QA Step45L Agent "+stamp
description_value="Step45L browser QA request"
form_values=c.ev("""(()=>{const set=(el,v)=>{const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const d=Object.getOwnPropertyDescriptor(proto,'value');d.set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};const i=document.querySelector('input[required]');const ta=document.querySelector('textarea[required]');if(!i||!ta)return null;set(i,%s);set(ta,%s);return {subject:i.value,description:ta.value,valid:i.checkValidity()&&ta.checkValidity()}})()""" % (json.dumps(subject_value),json.dumps(description_value)))
check("Request Help form values set", bool(form_values and form_values.get("subject")==subject_value and form_values.get("description")==description_value and form_values.get("valid")), form_values)
check("Send Request Help", click_button(c,"ส่งคำขอ"))
check("Ticket created through Agent UI", bool(wait(c, "document.body.innerText.includes('สร้าง Ticket แล้ว')", 12)), body(c)[:320])
c.shot("820__agent-help-success-th.png")
ticket_cleanup=api(c,"""
 const subject=%s;
 const list=await (await fetch('/api/v1/helpdesk/tickets?search='+encodeURIComponent(subject)+'&page=1&pageSize=20',{headers})).json();
 const item=(list.items||[]).find(x=>x.subject===subject);
 if(!item)return {found:false,status:0};
 const detailResponse=await fetch('/api/v1/helpdesk/tickets/'+encodeURIComponent(item.id),{headers});
 if(!detailResponse.ok)return {found:true,status:detailResponse.status,id:item.id};
 const detail=(await detailResponse.json()).data;
 const resolved=await fetch('/api/v1/helpdesk/tickets/'+encodeURIComponent(item.id)+'/resolve',{
   method:'POST',
   headers:{...headers,'Content-Type':'application/json','If-Match':detail.eTag},
   body:JSON.stringify({resolutionCode:'qa_cleanup',note:'Step45L browser QA cleanup'})
 });
 return {found:true,status:resolved.status,id:item.id};
""" % json.dumps(subject_value))
check("Request Help QA ticket resolved", ticket_cleanup.get("found") is True and ticket_cleanup.get("status")==200, ticket_cleanup)

# Ownership UI.
check("Open ownership view", click_button(c,"ยืนยันผู้ใช้งาน"))
check("Ownership form visible", bool(wait(c, "document.body.innerText.includes('ยืนยันข้อมูลผู้ใช้งานและการครอบครอง')", 8)))
loc_set=c.ev("""(()=>{const inputs=[...document.querySelectorAll('input')];const target=inputs.find(x=>x.type==='text');if(!target)return false;const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d.set.call(target,'Step45L QA');target.dispatchEvent(new Event('input',{bubbles:true}));return true})()""")
check("Ownership QA location entered", bool(loc_set))
check("Submit ownership confirmation", click_button(c,"ส่งข้อมูลยืนยัน"))
check("Ownership submission success", bool(wait(c, "document.body.innerText.includes('ส่งข้อมูลให้ตรวจสอบแล้ว')", 10)), body(c)[:320])
c.shot("820__agent-ownership-success-th.png")

pending=api(c,"""
 const r=await fetch('/api/v1/assets/ownership-submissions?status=pending&page=1&pageSize=100',{headers});
 const j=await r.json();
 return (j.items||[]).find(x=>x.submittedLocation==='Step45L QA')||null;
""")
check("Ownership UI persisted review row", bool(pending), pending)
if pending:
    rejected=api(c,"""
      const item=%s;
      const r=await fetch('/api/v1/assets/ownership-submissions/'+encodeURIComponent(item.id)+'/decision',{
        method:'POST',
        headers:{...headers,'Content-Type':'application/json','If-Match':item.eTag},
        body:JSON.stringify({decision:'rejected',note:'Step45L browser QA cleanup'})
      });
      return r.status;
    """ % json.dumps(pending))
    check("Ownership UI QA row rejected", rejected==200, rejected)

# Remote consent runtime: operator creates, Agent polls, user approves.
created=api(c,"""
 const r=await fetch('/api/v1/devices/%s/remote-consent-requests',{
   method:'POST',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({
     operatorName:'Step45L QA Operator',
     operatorRole:'IT Support',
     mode:'remote_control',
     messageTh:'เจ้าหน้าที่ QA ขออนุญาตเชื่อมต่อเพื่อทดสอบ Remote Consent',
     messageEn:'QA operator requests remote consent.',
     durationSeconds:90
   })
 });
 return {status:r.status,data:await r.json()};
""" % DEVICE_ID)
consent_id=created.get("data",{}).get("data",{}).get("id","")
check("Operator creates durable consent request", created.get("status")==201 and bool(consent_id), created)
check("Agent consent dialog appears", bool(wait(c, "document.body.innerText.includes('Step45L QA Operator')", 8)), body(c)[:340])
c.shot("820__agent-remote-consent-th.png")
check("Approve consent in Agent UI", click_button(c,"อนุญาต"))
check("Consent dialog closes", bool(wait(c, "!document.body.innerText.includes('Step45L QA Operator')", 8)))
pending_after=api(c,"""
 const r=await fetch('/api/v1/agent/remote-consent/pending?deviceId=%s',{headers});
 return {status:r.status,data:await r.json()};
""" % DEVICE_ID)
check("Approved consent leaves pending queue", pending_after.get("status")==200 and pending_after.get("data",{}).get("data") is None, pending_after)

# Explicit Agent prompt contract: an owning module creates a durable prompt and the Agent responds.
prompt_created=api(c,"""
 const r=await fetch('/api/v1/devices/%s/agent-prompts',{
   method:'POST',
   headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({
     sourceReference:'step45l-browser-qa',
     promptType:'confirm',
     titleTh:'ยืนยันการทำงานจากระบบ',
     titleEn:'Confirm system action',
     messageTh:'ระบบต้องการให้ผู้ใช้ยืนยันก่อนดำเนินการต่อ',
     messageEn:'The system requires your confirmation before continuing.',
     durationSeconds:120
   })
 });
 return {status:r.status,data:await r.json()};
""" % DEVICE_ID)
prompt_id=prompt_created.get("data",{}).get("data",{}).get("id","")
check("Module creates durable Agent prompt through contract", prompt_created.get("status")==201 and bool(prompt_id), prompt_created)
check("Agent prompt dialog appears", bool(wait(c, "document.body.innerText.includes('ยืนยันการทำงานจากระบบ')", 8)), body(c)[:340])
c.shot("820__agent-prompt-th.png")
check("Accept Agent prompt", click_button(c,"ยอมรับ"))
check("Agent prompt dialog closes", bool(wait(c, "!document.body.innerText.includes('ยืนยันการทำงานจากระบบ')", 8)))
prompt_pending=api(c,"""
 const r=await fetch('/api/v1/agent/prompts/pending?deviceId=%s',{headers});
 return {status:r.status,data:await r.json()};
""" % DEVICE_ID)
check("Responded Agent prompt leaves pending queue", prompt_pending.get("status")==200 and prompt_pending.get("data",{}).get("data") is None, prompt_pending)

# Offline state is Agent-owned and should preserve shell.
offline_ok=c.ev("""(()=>{Object.defineProperty(navigator,'onLine',{value:false,configurable:true});window.dispatchEvent(new Event('offline'));return true})()""")
check("Offline event dispatched", bool(offline_ok))
check("Offline state visible", bool(wait(c, "document.body.innerText.includes('ออฟไลน์')", 4)), body(c)[:220])
c.shot("820__agent-offline-th.png")
c.ev("""(()=>{Object.defineProperty(navigator,'onLine',{value:true,configurable:true});window.dispatchEvent(new Event('online'));return true})()""")

# Switch to English using the Agent control itself.
check("Return Agent home before language switch", click_button(c,"หน้าหลัก"))
check("Agent language toggle visible", click_button(c,"EN"))
check("English document language", bool(wait(c, "document.documentElement.lang==='en'", 6)), c.ev("document.documentElement.lang"))
check("English Agent copy visible", "INNO.One Agent is ready" in body(c) or "Request Help" in body(c), body(c)[:280])
c.shot("820__agent-home-en.png")

restore_body={"useOrganizationDefault":True} if original_pref is None else {"preferredLocale":original_pref}
restore_response=py_api("PATCH","/platform/me/profile",restore_body)
check("Restore user locale", restore_response.get("status")==200, restore_response.get("status"))

print(f"step45l_browser_checks={checks}")
print(f"step45l_browser_failures={len(failures)}")
print(f"step45l_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
raise SystemExit(1 if failures else 0)
