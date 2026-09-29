import base64, json, shutil, sys, time
from pathlib import Path
import requests, websocket

ROOT=Path(__file__).resolve().parent
OUT=ROOT/"qa-step42-detail"
PORT=9241
ROUTES=[
"/admin/users/user_10000000000000000000000000000001",
"/devices/dev_80000000000000000000000000000001",
"/devices/groups/grp_81000000000000000000000000000003",
"/assets/asset_90000000000000000000000000000003",
"/assets/owners/user_10000000000000000000000000000001",
"/helpdesk/tickets/ticket_adac45f8ccd848a8a15cc7770a8cee9b",
"/helpdesk/automation/auto_95000000000000000000000000000001",
]
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir()
fails=[]; checks=0
def check(name,ok,detail=""):
 global checks
 checks+=1
 if not ok:
  fails.append((name,detail)); print("FAIL",name,detail)
 else: print("PASS",name)
targets=requests.get(f"http://127.0.0.1:{PORT}/json").json()
page=next(x for x in targets if x.get("type")=="page")
ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=8,origin="http://127.0.0.1")
n=0
def call(method,params=None):
 global n
 n+=1; ident=n
 ws.send(json.dumps({"id":ident,"method":method,"params":params or {}}))
 while True:
  msg=json.loads(ws.recv())
  if msg.get("id")==ident:
   if "error" in msg: raise RuntimeError(msg["error"])
   return msg.get("result",{})
def ev(expr):
 r=call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True})
 return r.get("result",{}).get("value")
def viewport(w):
 call("Emulation.setDeviceMetricsOverride",{"width":w,"height":900,"deviceScaleFactor":1,"mobile":False})
def nav(route):
 call("Page.navigate",{"url":"http://localhost:5180"+route})
 deadline=time.time()+12
 while time.time()<deadline:
  if ev("!!document.querySelector('.inno-page,.page-error-wrap')"): return True
  time.sleep(.15)
 return False
def shot(name):
 data=call("Page.captureScreenshot",{"format":"png","fromSurface":True,"captureBeyondViewport":False})["data"]
 (OUT/name).write_bytes(base64.b64decode(data))
call("Page.enable"); call("Runtime.enable")
manifest={}
for width in (1366,1024,768):
 viewport(width)
 for route in ROUTES:
  ready=nav(route)
  check(f"ready {width} {route}",ready)
  if not ready: continue
  time.sleep(.25)
  m=ev("""(()=>({
   h1:document.querySelector('h1')?.textContent?.trim()||'',
   overflow:document.documentElement.scrollWidth>innerWidth+2,
   mainRight:Math.round(document.querySelector('.prod-main')?.getBoundingClientRect().right||0),
   resourceHeader:!!document.querySelector('.inno-resource-head'),
   resourceIcon:!!document.querySelector('.inno-resource-head .inno-icon[data-icon-token]'),
   rawHeaderGlyph:[...document.querySelectorAll('.inno-resource-head span')].some(x=>/[▣▦▧◫◉◇▱]/.test(x.textContent||'')),
   activeRail:document.querySelectorAll('.prod-rail a.active').length,
   activeSide:document.querySelectorAll('.prod-side a.active').length,
   error:/Failed to fetch|Something went wrong|Access denied/i.test(document.body.innerText||'')
  }))()""")
  check(f"no overflow {width} {route}",not m["overflow"],str(m))
  check(f"main fit {width} {route}",m["mainRight"]<=width+2,str(m))
  check(f"rail active {width} {route}",m["activeRail"]==1,str(m))
  check(f"side active {width} {route}",m["activeSide"]==1,str(m))
  if m["resourceHeader"]:
   check(f"resource icon semantic {width} {route}",m["resourceIcon"],str(m))
   check(f"resource glyph removed {width} {route}",not m["rawHeaderGlyph"],str(m))
  check(f"no runtime error {width} {route}",not m["error"],str(m))
  fn=f"{width}__"+route.strip("/").replace("/","__")+".png"
  shot(fn)
  manifest.setdefault(route,{})[str(width)]={**m,"shot":fn}
(OUT/"manifest.json").write_text(json.dumps({"routes":manifest,"checks":checks,"failures":fails},indent=2),encoding="utf-8")
print("step42_detail_routes="+str(len(ROUTES)))
print("step42_detail_checks="+str(checks))
print("step42_detail_failures="+str(len(fails)))
for x in fails: print("FAILED",x)
sys.exit(1 if fails else 0)
