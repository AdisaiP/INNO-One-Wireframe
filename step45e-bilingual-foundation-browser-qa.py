from pathlib import Path
import base64, json, shutil, sys, time
import requests, websocket

sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step45e-bilingual-foundation"
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
    print(("PASS " if ok else "FAIL ")+name+((" :: "+str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

class CDP:
    def __init__(self):
        deadline=time.time()+12
        targets=None
        while time.time()<deadline:
            try:
                targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=1).json()
                if targets: break
            except Exception:
                time.sleep(.15)
        if not targets:
            raise RuntimeError("Chrome DevTools target unavailable")
        page=next(x for x in targets if x.get("type")=="page")
        self.ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=10,origin="http://127.0.0.1")
        self.n=0
        self.call("Page.enable")
        self.call("Runtime.enable")
    def call(self,method,params=None):
        self.n+=1
        ident=self.n
        self.ws.send(json.dumps({"id":ident,"method":method,"params":params or {}}))
        while True:
            msg=json.loads(self.ws.recv())
            if msg.get("id")==ident:
                if "error" in msg: raise RuntimeError(msg["error"])
                return msg.get("result",{})
    def ev(self,expr):
        result=self.call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True})
        if "exceptionDetails" in result: raise RuntimeError(str(result["exceptionDetails"]))
        return result.get("result",{}).get("value")
    def viewport(self,width,height=900):
        self.call("Emulation.setDeviceMetricsOverride",{"width":width,"height":height,"deviceScaleFactor":1,"mobile":False})
    def navigate(self,url):
        self.call("Page.navigate",{"url":url})
    def shot(self,name):
        data=self.call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
        (OUT/name).write_bytes(base64.b64decode(data))

def wait(c,expr,timeout=15):
    deadline=time.time()+timeout
    while time.time()<deadline:
        try:
            value=c.ev(expr)
            if value: return value
        except Exception:
            pass
        time.sleep(.12)
    return None

def realm_password(username):
    realm=json.loads(REALM.read_text(encoding="utf-8"))
    user=next(x for x in realm["users"] if x["username"]==username)
    return user["credentials"][0]["value"]

def login(c):
    c.navigate("http://localhost:5180/")
    password=realm_password("adisai")
    deadline=time.time()+35
    while time.time()<deadline:
        try:
            href=c.ev("location.href") or ""
            if any(host in href for host in ("172.10.1.58:8080","localhost:8080","127.0.0.1:8080")) and c.ev("!!document.querySelector('#kc-login')"):
                c.ev(
                    "document.querySelector('#username').value="+json.dumps("adisai")
                    +";document.querySelector('#password').value="+json.dumps(password)
                    +";document.querySelector('#kc-login').click();true"
                )
                time.sleep(.5)
            if href.startswith("http://localhost:5180") and wait(c,"!!document.querySelector('.inno-production-shell')",2):
                return True
        except Exception:
            pass
        time.sleep(.2)
    return False

def nav(c,route):
    c.navigate("http://localhost:5180"+route)
    time.sleep(.4)
    ready=wait(c,"""(()=> {
      const shell=document.querySelector('.inno-production-shell');
      const page=document.querySelector('.inno-page,.workspace-home-page,.page-error-wrap');
      return location.pathname===%s && document.readyState==='complete' && !!shell && !!page && !document.querySelector('.page-loading-wrap,.boot-screen');
    })()""" % json.dumps(route),20)
    if ready: time.sleep(.35)
    return bool(ready)

def body(c):
    return c.ev("document.body.innerText") or ""

def no_overflow(c):
    return c.ev("document.documentElement.scrollWidth<=innerWidth+2") is True

def click_text(c,text_value):
    return c.ev("""(()=>{const t=%s;const e=[...document.querySelectorAll('button,a')].find(x=>(x.textContent||'').trim()===t);if(!e)return false;e.click();return true})()""" % json.dumps(text_value))

def set_select(c,label_text,value):
    return c.ev("""(()=> {
      const label=[...document.querySelectorAll('label')].find(x=>x.querySelector(':scope > span')?.textContent.trim()===%s);
      const select=label?.querySelector('select');
      if(!select)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
      setter.call(select,%s);
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return select.value===%s;
    })()""" % (json.dumps(label_text),json.dumps(value),json.dumps(value)))

def api_state(c):
    return c.ev("""(async()=> {
      const auth=await import('/src/auth/keycloak.ts');
      const token=await auth.getAccessToken();
      const headers={Authorization:'Bearer '+token};
      const p=await fetch('/api/v1/platform/me',{headers});
      const profile=(await p.json()).data;
      const s=await fetch('/api/v1/admin/settings',{headers});
      const settings=await s.json();
      return {profile,settings};
    })()""")

def set_admin_locale_api(c,locale):
    return c.ev("""(async()=> {
      const auth=await import('/src/auth/keycloak.ts');
      const token=await auth.getAccessToken();
      const headers={Authorization:'Bearer '+token};
      const get=await fetch('/api/v1/admin/settings',{headers});
      const settings=await get.json();
      if(settings.localization.defaultLocale===%s) return {status:200,data:settings.localization};
      const resp=await fetch('/api/v1/admin/settings/localization',{
        method:'PATCH',
        headers:{...headers,'Content-Type':'application/json','If-Match':settings.localization.eTag},
        body:JSON.stringify({defaultLocale:%s})
      });
      return {status:resp.status,data:await resp.json()};
    })()""" % (json.dumps(locale),json.dumps(locale)))

def set_profile_locale_api(c,preferred):
    if preferred is None:
        payload={"useOrganizationDefault": True}
    else:
        payload={"preferredLocale": preferred}
    return c.ev("""(async()=> {
      const auth=await import('/src/auth/keycloak.ts');
      const token=await auth.getAccessToken();
      const resp=await fetch('/api/v1/platform/me/profile',{
        method:'PATCH',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(%s)
      });
      return {status:resp.status,data:await resp.json()};
    })()""" % json.dumps(payload))

c=CDP()
c.viewport(1366)
check("Keycloak login completes",login(c),c.ev("location.href") or "")

original=api_state(c)
original_pref=original["profile"].get("preferredLocale")
original_default=original["settings"]["localization"]["defaultLocale"]
original_permissions=sorted(original["profile"].get("permissions",[]))

baseline_admin=set_admin_locale_api(c,"en-US")
check("QA baseline organization locale set to en-US",baseline_admin.get("status")==200,baseline_admin)
baseline_profile=set_profile_locale_api(c,None)
check("QA baseline profile inherits organization locale",baseline_profile.get("status")==200,baseline_profile)

c.navigate("http://localhost:5180/profile")
check("English profile page ready",bool(wait(c,"document.body.innerText.includes('Profile & Settings')",15)))
check("English document lang","en"==c.ev("document.documentElement.lang"),c.ev("document.documentElement.lang"))
check("Profile language selector exists",c.ev("""!![...document.querySelectorAll('label')].find(x=>x.querySelector(':scope > span')?.textContent.trim()==='Language')?.querySelector('select')""") is True)
check("Profile starts on organization default",c.ev("""[...document.querySelectorAll('label')].find(x=>x.querySelector(':scope > span')?.textContent.trim()==='Language')?.querySelector('select')?.value==='organization'""") is True)

check("Select Thai on profile",bool(set_select(c,"Language","th-TH")))
check("Profile becomes dirty","Unsaved" in body(c))
route_before=c.ev("location.pathname")
check("Save Thai profile dispatched",bool(click_text(c,"Save profile")))
check("Thai locale applies without route change",bool(wait(c,"document.documentElement.lang==='th' && location.pathname==='/profile'",10)))
check("Route preserved while switching locale",c.ev("location.pathname")==route_before,c.ev("location.pathname"))
thai_text=body(c)
check("Profile title translated to Thai","โปรไฟล์และการตั้งค่า" in thai_text)
check("Shell Helpdesk semantic label translated",c.ev("""!!document.querySelector('.prod-rail a[aria-label="ศูนย์ช่วยเหลือ"]')""") is True)
check("Shell Devices semantic label translated",c.ev("""!!document.querySelector('.prod-rail a[aria-label="อุปกรณ์"]')""") is True)
check("Shell Assets semantic label translated",c.ev("""!!document.querySelector('.prod-rail a[aria-label="ทรัพย์สิน"]')""") is True)

state_th=api_state(c)
check("Preferred locale persisted as th-TH",state_th["profile"].get("preferredLocale")=="th-TH",state_th["profile"].get("preferredLocale"))
check("Effective locale is th-TH",state_th["profile"].get("locale")=="th-TH",state_th["profile"].get("locale"))
check("Permissions unchanged after language switch",sorted(state_th["profile"].get("permissions",[]))==original_permissions)

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} Thai profile route ready",nav(c,"/profile"))
    check(f"{width} Thai profile no overflow",no_overflow(c))
    check(f"{width} Thai profile title","โปรไฟล์และการตั้งค่า" in body(c))
    c.shot(f"{width}__profile-th.png")

check("Select organization default in Thai profile",bool(set_select(c,"ภาษา","organization")))
check("Save organization default dispatched",bool(click_text(c,"บันทึกโปรไฟล์")))
check("Profile returns to English organization default",bool(wait(c,"document.documentElement.lang==='en' && document.body.innerText.includes('Profile & Settings')",10)))
state_inherit=api_state(c)
check("Preferred locale cleared",state_inherit["profile"].get("preferredLocale") is None,state_inherit["profile"].get("preferredLocale"))
check("Effective locale follows en-US default",state_inherit["profile"].get("locale")=="en-US",state_inherit["profile"].get("locale"))

check("Admin settings ready",nav(c,"/admin/settings"))
check("Default language control rendered","Default language" in body(c))
probe=c.ev("""(async()=> {
  const auth=await import('/src/auth/keycloak.ts');
  const token=await auth.getAccessToken();
  const base={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const missing=await fetch('/api/v1/admin/settings/localization',{
    method:'PATCH',headers:base,body:JSON.stringify({defaultLocale:'th-TH'})
  });
  const stale=await fetch('/api/v1/admin/settings/localization',{
    method:'PATCH',headers:{...base,'If-Match':'W/"999999"'},body:JSON.stringify({defaultLocale:'th-TH'})
  });
  const invalid=await fetch('/api/v1/admin/settings/localization',{
    method:'PATCH',headers:{...base,'If-Match':'W/"999999"'},body:JSON.stringify({defaultLocale:'fr-FR'})
  });
  return {missing:missing.status,stale:stale.status,invalid:invalid.status};
})()""")
check("Missing localization If-Match returns 428",probe.get("missing")==428,probe)
check("Stale localization If-Match returns 412",probe.get("stale")==412,probe)
check("Unsupported locale returns 400",probe.get("invalid")==400,probe)

check("Select Thai organization default",bool(set_select(c,"Default language","th-TH")))
check("Save Thai organization default dispatched",bool(click_text(c,"Save language")))
check("Inherited user switches to Thai",bool(wait(c,"document.documentElement.lang==='th' && document.body.innerText.includes('การตั้งค่าแพลตฟอร์ม')",12)))
check("Admin route preserved after organization switch",c.ev("location.pathname")=="/admin/settings",c.ev("location.pathname"))
state_org_th=api_state(c)
check("Organization default persisted as th-TH",state_org_th["settings"]["localization"]["defaultLocale"]=="th-TH",state_org_th["settings"]["localization"])
check("Inherited effective locale is th-TH",state_org_th["profile"]["locale"]=="th-TH",state_org_th["profile"]["locale"])

for width in WIDTHS:
    c.viewport(width)
    check(f"{width} Thai admin settings ready",nav(c,"/admin/settings"))
    check(f"{width} Thai admin no overflow",no_overflow(c))
    check(f"{width} Thai admin title","การตั้งค่าแพลตฟอร์ม" in body(c))
    c.shot(f"{width}__admin-settings-th.png")

c.viewport(1366)
check("Refresh profile under Thai default",nav(c,"/profile"))
check("Inherited profile remains Thai after navigation","โปรไฟล์และการตั้งค่า" in body(c))
check("Inherited profile selector remains organization",c.ev("""[...document.querySelectorAll('label')].find(x=>x.querySelector(':scope > span')?.textContent.trim()==='ภาษา')?.querySelector('select')?.value==='organization'""") is True)

race_probe=c.ev("""(async()=> {
  const auth=await import('/src/auth/keycloak.ts');
  const token=await auth.getAccessToken();
  const headers={Authorization:'Bearer '+token};
  const current=await (await fetch('/api/v1/admin/settings',{headers})).json();
  const eTag=current.localization.eTag;
  const request=()=>fetch('/api/v1/admin/settings/localization',{
    method:'PATCH',
    headers:{...headers,'Content-Type':'application/json','If-Match':eTag},
    body:JSON.stringify({defaultLocale:'en-US'})
  }).then(r=>r.status);
  const statuses=await Promise.all([request(),request()]);
  return statuses.sort((a,b)=>a-b);
})()""")
check("Concurrent localization writes resolve as 200 + 412",race_probe==[200,412],race_probe)

restore_default=set_admin_locale_api(c,original_default)
check("Restore original organization locale",restore_default.get("status")==200,restore_default)
restore_profile=set_profile_locale_api(c,original_pref)
check("Restore original user locale preference",restore_profile.get("status")==200,restore_profile)

c.navigate("http://localhost:5180/profile")
check("Restored profile reloads",bool(wait(c,"!!document.querySelector('.inno-production-shell') && location.pathname==='/profile'",12)))
restored=api_state(c)
check("Original organization locale restored",restored["settings"]["localization"]["defaultLocale"]==original_default,restored["settings"]["localization"]["defaultLocale"])
check("Original user preference restored",restored["profile"].get("preferredLocale")==original_pref,restored["profile"].get("preferredLocale"))

print(f"step45e_browser_checks={checks}")
print(f"step45e_browser_failures={len(failures)}")
print(f"step45e_browser_screenshots={len(list(OUT.glob('*.png')))}")
for item in failures:
    print("FAILED",item)
sys.exit(1 if failures else 0)
