#!/usr/bin/env python3
import json,time,requests,websocket

PORT=9241
routes=[
 ("devices","http://localhost:5180/devices"),
 ("assets","http://localhost:5180/assets/inventory"),
 ("automation","http://localhost:5180/helpdesk/automation"),
]
targets=requests.get(f"http://127.0.0.1:{PORT}/json",timeout=2).json()
page=next(x for x in targets if x.get("type")=="page" and "localhost:5180" in x.get("url",""))
ws=websocket.create_connection(page["webSocketDebuggerUrl"],timeout=12,origin="http://127.0.0.1")
seq=0;checks=0;fails=[]
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
 checks+=1
 print(("PASS " if ok else "FAIL ")+name+(f" :: {detail}" if detail else ""))
 if not ok:fails.append((name,detail))
call("Page.enable");call("Runtime.enable")

for width in (1366,1024,768):
 call("Emulation.setDeviceMetricsOverride",{"width":width,"height":900,"deviceScaleFactor":1,"mobile":False})
 for name,url in routes:
  call("Page.navigate",{"url":url})
  deadline=time.time()+8
  while time.time()<deadline and not ev("document.querySelector('.inno-collection')!==null"): time.sleep(.08)
  time.sleep(.35)
  m=ev("""(()=>{const c=document.querySelector('.inno-collection'),tb=document.querySelector('.inno-collection-toolbar'),s=document.querySelector('.inno-search input'),tw=document.querySelector('.inno-table-wrap'),th=tw?.querySelector('th'),td=tw?.querySelector('td'),ph=document.querySelector('.inno-page-head');return {collection:!!c,toolbar:!!tb,searchH:s?Math.round(s.getBoundingClientRect().height):0,searchW:s?Math.round(s.getBoundingClientRect().width):0,toolbarW:tb?Math.round(tb.getBoundingClientRect().width):0,table:!!tw,thH:th?Math.round(th.getBoundingClientRect().height):0,tdH:td?Math.round(td.getBoundingClientRect().height):0,overflow:document.documentElement.scrollWidth>innerWidth+2,legacy:document.querySelectorAll('.collection-card,.collection-toolbar,.production-table-wrap,.page-helper').length,pageHead:!!ph,statuses:document.querySelectorAll('.inno-status').length,actions:document.querySelectorAll('.inno-page-actions>*').length}})()""")
  check(f"{width} {name} shared collection",m["collection"] and m["toolbar"],m)
  check(f"{width} {name} control height",m["searchH"]==36,m)
  check(f"{width} {name} no page overflow",not m["overflow"],m)
  check(f"{width} {name} no migrated legacy wrappers",m["legacy"]==0,m)
  check(f"{width} {name} page header",m["pageHead"],m)
  if m["table"]:
   check(f"{width} {name} table header density",m["thH"]==40,m)
   check(f"{width} {name} table row density",m["tdH"]>=48 and m["tdH"]<=52,m)
  if width<=850:
   check(f"{width} {name} search expands",m["searchW"]>=m["toolbarW"]-30,m)
  if name=="automation" and width==1366:
   check("automation page action in header",m["actions"]==1,m)

for width in (1366,768):
 call("Emulation.setDeviceMetricsOverride",{"width":width,"height":900,"deviceScaleFactor":1,"mobile":False})
 call("Page.navigate",{"url":"http://localhost:5180/devices/dev_80000000000000000000000000000001"})
 deadline=time.time()+8
 while time.time()<deadline and not ev("document.querySelector('.inno-resource-head')!==null"): time.sleep(.08)
 time.sleep(.25)
 resource=ev("""(()=>{const h=document.querySelector('.inno-resource-head'),s=document.querySelector('.inno-resource-title'),status=document.querySelector('.inno-resource-head .inno-status');return {head:!!h,title:!!s,status:!!status,overflow:document.documentElement.scrollWidth>innerWidth+2,legacy:document.querySelectorAll('.production-resource-head,.resource-title-line,.resource-meta-line').length}})()""")
 check(f"{width} resource header primitive",resource["head"] and resource["title"] and resource["status"],resource)
 check(f"{width} resource header no legacy wrapper",resource["legacy"]==0,resource)
 check(f"{width} resource header no overflow",not resource["overflow"],resource)

 call("Page.navigate",{"url":"http://localhost:5180/helpdesk/tickets/new"})
 deadline=time.time()+8
 while time.time()<deadline and not ev("document.querySelector('.inno-editor-footer')!==null"): time.sleep(.08)
 time.sleep(.25)
 footer=ev("""(()=>{const f=document.querySelector('.inno-editor-footer'),cs=f?getComputedStyle(f):null;return {footer:!!f,position:cs?.position||'',buttons:f?.querySelectorAll('.inno-btn').length||0,primary:f?.querySelectorAll('.inno-btn--primary').length||0,legacy:document.querySelectorAll('.editor-footer').length,overflow:document.documentElement.scrollWidth>innerWidth+2}})()""")
 check(f"{width} editor footer primitive",footer["footer"] and footer["position"]=="sticky",footer)
 check(f"{width} editor footer actions",footer["buttons"]==2 and footer["primary"]==1,footer)
 check(f"{width} editor footer no legacy wrapper",footer["legacy"]==0,footer)
 check(f"{width} editor footer no overflow",not footer["overflow"],footer)

print(f"checks={checks} failures={len(fails)}")
raise SystemExit(bool(fails))
