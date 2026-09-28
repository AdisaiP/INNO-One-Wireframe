#!/usr/bin/env python3
from pathlib import Path
import json,time,requests,websocket
PORT=9241
OUT=Path(__file__).resolve().parents[1]/"qa-step29-react-shell"
OUT.mkdir(exist_ok=True)
targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=2).json()
page=next(x for x in targets if x.get("type")=="page" and "localhost:5180" in x.get("url",""))
ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=15,suppress_origin=True)
seq=0;fails=[];checks=0
def call(method,params=None):
 global seq
 seq+=1;i=seq;ws.send(json.dumps({"id":i,"method":method,"params":params or {}}))
 while True:
  r=json.loads(ws.recv())
  if r.get("id")==i:return r.get("result",{})
def ev(expr):
 return call("Runtime.evaluate",{"expression":expr,"returnByValue":True,"awaitPromise":True}).get("result",{}).get("value")
def check(name,ok,detail=""):
 global checks
 checks+=1;print(("PASS " if ok else "FAIL ")+name+(f" :: {detail}" if detail else ""))
 if not ok:fails.append((name,detail))
call("Page.enable");call("Runtime.enable")
for width,rail,inline_side in ((1366,60,216),(1024,58,0),(768,54,0)):
 call("Emulation.setDeviceMetricsOverride",{"width":width,"height":900,"deviceScaleFactor":1,"mobile":False})
 call("Page.navigate",{"url":"http://localhost:5180/devices"})
 deadline=time.time()+8
 while time.time()<deadline and not ev("document.querySelector('.prod-shell-body')!==null"):time.sleep(.08)
 time.sleep(.25)
 m=ev("""(()=>{const h=document.querySelector('.prod-header').getBoundingClientRect(),r=document.querySelector('.prod-rail').getBoundingClientRect(),s=document.querySelector('.prod-side'),sr=s.getBoundingClientRect(),t=document.querySelector('.prod-context-toggle');return {header:Math.round(h.height),rail:Math.round(r.width),side:getComputedStyle(s).display==='none'?0:Math.round(sr.width),overflow:document.documentElement.scrollWidth>innerWidth+2,railActive:document.querySelectorAll('.prod-rail a.active').length,sideActive:document.querySelectorAll('.prod-side a.active').length,toggle:getComputedStyle(t).display}})()""")
 check(f"{width} header",m["header"]==56,m);check(f"{width} rail",m["rail"]==rail,m)
 check(f"{width} sidebar",m["side"]==inline_side,m);check(f"{width} overflow",not m["overflow"],m)
 check(f"{width} active rail",m["railActive"]==1,m);check(f"{width} active side",m["sideActive"]==1,m)
 check(f"{width} toggle",("none" if width==1366 else "grid")==m["toggle"],m)
 if width<1180:
  ev("document.querySelector('.prod-context-toggle').click()");time.sleep(.12)
  opened=ev("getComputedStyle(document.querySelector('.prod-side')).display!=='none' && document.querySelector('.prod-side').classList.contains('open')")
  check(f"{width} overlay opens",opened)
  ev("document.querySelector('.prod-side-backdrop').click()");time.sleep(.08)
print(f"checks={checks} failures={len(fails)}")
raise SystemExit(bool(fails))
