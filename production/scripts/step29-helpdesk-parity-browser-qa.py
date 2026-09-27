#!/usr/bin/env python3
import json,time,requests,websocket

PORT=9241
BASE='http://localhost:5180'

def targets():
 return requests.get(f'http://127.0.0.1:{PORT}/json',timeout=2).json()

xs=targets()
page=next((x for x in xs if x.get('type')=='page' and 'localhost:5180' in x.get('url','')),None)
if page is None:
 requests.put(f'http://127.0.0.1:{PORT}/json/new?{BASE}/helpdesk',timeout=2)
 time.sleep(.8)
 page=next(x for x in targets() if x.get('type')=='page' and 'localhost:5180' in x.get('url',''))

ws=websocket.create_connection(page['webSocketDebuggerUrl'],timeout=12,suppress_origin=True)
seq=0;checks=0;fails=[]

def call(method,params=None):
 global seq
 seq+=1;i=seq
 ws.send(json.dumps({'id':i,'method':method,'params':params or {}}))
 while True:
  r=json.loads(ws.recv())
  if r.get('id')==i:return r.get('result',{})

def ev(expr):
 return call('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True}).get('result',{}).get('value')

def check(name,ok,detail=''):
 global checks
 checks+=1
 print(('PASS ' if ok else 'FAIL ')+name+(f' :: {detail}' if detail else ''))
 if not ok:fails.append((name,detail))

def nav(path,wait='.inno-page'):
 call('Page.navigate',{'url':BASE+path})
 deadline=time.time()+8
 while time.time()<deadline:
  if ev(f"document.querySelector({json.dumps(wait)})!==null"): break
  time.sleep(.08)
 time.sleep(.3)

def common():
 return ev("""(()=>({
  page:!!document.querySelector('.inno-page'),
  overflow:document.documentElement.scrollWidth>innerWidth+2,
  legacy:document.querySelectorAll('.collection-card,.production-table-wrap,.page-helper,.production-resource-head,.resource-title-line,.editor-footer,.compact-empty').length,
  rail:document.querySelectorAll('.prod-rail a.active').length,
  side:document.querySelectorAll('.prod-side a.active').length
}))()""")

call('Page.enable');call('Runtime.enable')

ticket_href=None
automation_href=None
routes=[
 ('overview','/helpdesk','.inno-page-head'),
 ('tickets','/helpdesk/tickets','.inno-collection'),
 ('assigned','/helpdesk/assigned','.inno-collection'),
 ('team','/helpdesk/team','.inno-collection'),
 ('create','/helpdesk/tickets/new','.inno-page'),
 ('sla','/helpdesk/sla','.inno-page'),
 ('calendar','/helpdesk/calendar','.inno-page'),
 ('automation','/helpdesk/automation','.inno-collection'),
 ('automation-new','/helpdesk/automation/new','.inno-page'),
]

for width in (1366,1024,768):
 call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':False})
 for name,path,wait in routes:
  nav(path,wait)
  m=common()
  check(f'{width} {name} page rendered',m['page'],m)
  check(f'{width} {name} no legacy wrappers',m['legacy']==0,m)
  check(f'{width} {name} no page overflow',not m['overflow'],m)
  check(f'{width} {name} shell active navigation',m['rail']==1 and m['side']==1,m)

  if name=='tickets':
   shared=ev("""(()=>({collection:!!document.querySelector('.inno-collection'),toolbar:!!document.querySelector('.inno-collection-toolbar'),table:!!document.querySelector('.inno-table-wrap'),state:document.querySelector('.inno-state')?.dataset.state||null}))()""")
   check(f'{width} tickets collection pattern',shared['collection'] and shared['toolbar'] and (shared['table'] or shared['state'] in ['empty','no-results','loading','error','permission']),shared)
   if ticket_href is None:
    ticket_href=ev("""(()=>[...document.querySelectorAll('a[href^="/helpdesk/tickets/"]')].map(a=>a.getAttribute('href')).find(h=>h && h!='/helpdesk/tickets/new' && /^\/helpdesk\/tickets\/[^/]+$/.test(h))||null)()""")

  if name in ['assigned','team']:
   queue=ev("""(()=>({queue:!!document.querySelector('.helpdesk-operational-queue'),rows:document.querySelectorAll('.helpdesk-operational-queue .helpdesk-queue-row').length,state:document.querySelector('.inno-state')?.dataset.state||null}))()""")
   check(f'{width} {name} operational queue pattern',queue['queue'] or queue['state'] in ['empty','no-results','loading','error','permission'],queue)

  if name=='create':
   create=ev("""(()=>({footer:!!document.querySelector('.inno-editor-footer'),priority:!!document.querySelector('.inno-status'),state:document.querySelector('.inno-state')?.dataset.state||null}))()""")
   check(f'{width} create canonical editor',create['footer'] or create['state'] in ['loading','error','permission'],create)

  if name=='sla':
   sla=ev("""(()=>({footer:!!document.querySelector('.inno-editor-footer'),calendar:!!document.querySelector('a[href="/helpdesk/calendar"]'),switches:document.querySelectorAll('[role="switch"]').length,state:document.querySelector('.inno-state')?.dataset.state||null}))()""")
   check(f'{width} sla policy pattern',sla['calendar'] and (sla['footer'] or sla['state'] in ['loading','error','permission']),sla)
   if sla['switches']:
    check(f'{width} sla switch semantics',sla['switches']>=3,sla)

  if name=='calendar':
   cal=ev("""(()=>({footer:!!document.querySelector('.inno-editor-footer'),table:!!document.querySelector('.inno-table-wrap'),switches:document.querySelectorAll('[role="switch"]').length,state:document.querySelector('.inno-state')?.dataset.state||null}))()""")
   check(f'{width} calendar canonical editor/table',(cal['footer'] and cal['table']) or cal['state'] in ['loading','error','permission'],cal)

  if name=='automation':
   auto=ev("""(()=>({collection:!!document.querySelector('.inno-collection'),toolbar:!!document.querySelector('.inno-collection-toolbar'),table:!!document.querySelector('.inno-table-wrap'),state:document.querySelector('.inno-state')?.dataset.state||null}))()""")
   check(f'{width} automation collection pattern',auto['collection'] and auto['toolbar'] and (auto['table'] or auto['state'] in ['empty','no-results','loading','error','permission']),auto)
   if automation_href is None:
    automation_href=ev("""(()=>[...document.querySelectorAll('a[href^="/helpdesk/automation/"]')].map(a=>a.getAttribute('href')).find(h=>h && h!='/helpdesk/automation/new' && /^\/helpdesk\/automation\/[^/]+$/.test(h))||null)()""")

  if name=='automation-new':
   rule=ev("""(()=>({footer:!!document.querySelector('.inno-editor-footer'),status:!!document.querySelector('.inno-status'),legacy:document.querySelectorAll('.editor-footer,.compact-empty').length}))()""")
   check(f'{width} automation editor pattern',rule['footer'] and rule['status'] and rule['legacy']==0,rule)

 if ticket_href:
  nav(ticket_href,'.inno-resource-head')
  m=ev("""(()=>({
    resource:!!document.querySelector('.inno-resource-head'),
    footer:!!document.querySelector('.inno-editor-footer'),
    ticketActive:[...document.querySelectorAll('.prod-side a.active')].some(a=>a.getAttribute('href')==='/helpdesk/tickets'),
    sideActive:document.querySelectorAll('.prod-side a.active').length,
    legacy:document.querySelectorAll('.resource-title-line,.production-resource-head,.editor-footer,.compact-empty').length,
    overflow:document.documentElement.scrollWidth>innerWidth+2
  }))()""")
  check(f'{width} ticket detail resource pattern',m['resource'],m)
  check(f'{width} ticket detail navigation',m['ticketActive'] and m['sideActive']==1,m)
  check(f'{width} ticket detail no legacy wrappers',m['legacy']==0,m)
  check(f'{width} ticket detail no overflow',not m['overflow'],m)

 if automation_href:
  nav(automation_href,'.inno-page')
  m=ev("""(()=>({
    footer:!!document.querySelector('.inno-editor-footer'),
    status:!!document.querySelector('.inno-status'),
    automationActive:[...document.querySelectorAll('.prod-side a.active')].some(a=>a.getAttribute('href')==='/helpdesk/automation'),
    sideActive:document.querySelectorAll('.prod-side a.active').length,
    legacy:document.querySelectorAll('.editor-footer,.compact-empty').length,
    overflow:document.documentElement.scrollWidth>innerWidth+2
  }))()""")
  check(f'{width} automation detail editor pattern',m['footer'] and m['status'],m)
  check(f'{width} automation detail navigation',m['automationActive'] and m['sideActive']==1,m)
  check(f'{width} automation detail no legacy wrappers',m['legacy']==0,m)
  check(f'{width} automation detail no overflow',not m['overflow'],m)

print(f'checks={checks} failures={len(fails)} ticket_detail={ticket_href or "not-found"} automation_detail={automation_href or "not-found"}')
raise SystemExit(bool(fails))
