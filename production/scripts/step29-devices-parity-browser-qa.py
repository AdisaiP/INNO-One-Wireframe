#!/usr/bin/env python3
import json,time,requests,websocket

PORT=9241
BASE='http://localhost:5180'
def targets():
 return requests.get(f'http://127.0.0.1:{PORT}/json',timeout=2).json()
xs=targets()
page=next((x for x in xs if x.get('type')=='page' and 'localhost:5180' in x.get('url','')),None)
if page is None:
 requests.put(f'http://127.0.0.1:{PORT}/json/new?{BASE}/devices',timeout=2)
 time.sleep(.8)
 page=next(x for x in targets() if x.get('type')=='page' and 'localhost:5180' in x.get('url',''))
ws=websocket.create_connection(page['webSocketDebuggerUrl'],timeout=12,origin='http://127.0.0.1')
seq=0;checks=0;fails=[]
def call(method,params=None):
 global seq
 seq+=1;i=seq;ws.send(json.dumps({'id':i,'method':method,'params':params or {}}))
 while True:
  r=json.loads(ws.recv())
  if r.get('id')==i:return r.get('result',{})
def ev(expr):
 return call('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True}).get('result',{}).get('value')
def check(name,ok,detail=''):
 global checks
 checks+=1;print(('PASS ' if ok else 'FAIL ')+name+(f' :: {detail}' if detail else ''))
 if not ok:fails.append((name,detail))
def nav(path,wait):
 call('Page.navigate',{'url':BASE+path})
 deadline=time.time()+8
 while time.time()<deadline:
  if ev(f"document.querySelector({json.dumps(wait)})!==null"): break
  time.sleep(.08)
 time.sleep(.28)
def shell_metrics():
 return ev("""(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,rail:document.querySelectorAll('.prod-rail a.active').length,side:document.querySelectorAll('.prod-side a.active').length}))()""")
call('Page.enable');call('Runtime.enable')

group_href=None
for width in (1366,1024,768):
 call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':False})

 nav('/devices','.inno-collection')
 m=ev("""(()=>({head:!!document.querySelector('.inno-page-head'),discover:!!document.querySelector('a[href="/devices/discovery"].inno-link-button'),add:!!document.querySelector('a[href="/devices/add"].inno-link-button'),columns:!!document.querySelector('.device-columns-menu'),legacy:document.querySelectorAll('.collection-card,.collection-toolbar,.production-table-wrap,.page-helper').length,overflow:document.documentElement.scrollWidth>innerWidth+2}))()""")
 check(f'{width} devices header',m['head'] and m['discover'],m)
 check(f'{width} devices columns chooser',m['columns'],m)
 check(f'{width} devices migrated wrappers',m['legacy']==0,m)
 check(f'{width} devices no overflow',not m['overflow'],m)
 if width==1366:
  before=ev("""(()=>{const d=document.querySelector('.device-columns-menu');d.open=true;const x=[...d.querySelectorAll('label')].find(l=>l.textContent.trim()==='User')?.querySelector('input');return x?.checked ?? null})()""")
  ev("""(()=>{const d=document.querySelector('.device-columns-menu');const x=[...d.querySelectorAll('label')].find(l=>l.textContent.trim()==='User')?.querySelector('input');x?.click();return true})()""")
  time.sleep(.08)
  after=ev("""(()=>{const x=[...document.querySelectorAll('.device-columns-menu label')].find(l=>l.textContent.trim()==='User')?.querySelector('input');return x?.checked ?? null})()""")
  check('devices columns toggle interaction',before is True and after is False,{'before':before,'after':after})

 nav('/devices/discovery','.discovery-layout')
 m=ev("""(()=>({action:[...document.querySelectorAll('.inno-page-actions button')].some(x=>x.textContent.includes('Run Scan')),collection:!!document.querySelector('.inno-collection'),legacy:document.querySelectorAll('.collection-card,.collection-toolbar,.production-table-wrap,.page-intro-row,.page-helper,.editor-footer').length,overflow:document.documentElement.scrollWidth>innerWidth+2}))()""")
 check(f'{width} discovery real header action',m['action'],m)
 check(f'{width} discovery shared results',m['collection'],m)
 check(f'{width} discovery no legacy wrappers',m['legacy']==0,m)
 check(f'{width} discovery no overflow',not m['overflow'],m)

 nav('/devices/groups','.inno-collection')
 m=ev("""(()=>({action:[...document.querySelectorAll('.inno-page-actions button')].some(x=>x.textContent.includes('New Device Group')),collection:!!document.querySelector('.inno-collection'),legacy:document.querySelectorAll('.collection-card,.collection-toolbar,.production-table-wrap,.page-intro-row,.page-helper').length,overflow:document.documentElement.scrollWidth>innerWidth+2,group:[...document.querySelectorAll('a[href^="/devices/groups/"]')].map(a=>a.getAttribute('href'))[0]||null}))()""")
 check(f'{width} groups real header action',m['action'],m)
 check(f'{width} groups shared collection',m['collection'],m)
 check(f'{width} groups no legacy wrappers',m['legacy']==0,m)
 check(f'{width} groups no overflow',not m['overflow'],m)
 if group_href is None and m['group']: group_href=m['group']

 nav('/devices/add','.deployment-layout')
 m=ev("""(()=>({footer:!!document.querySelector('.inno-editor-footer'),state:document.querySelector('.inno-state')?.dataset.state||null,helper:document.querySelectorAll('.page-helper,.editor-footer').length,statuses:document.querySelectorAll('.inno-status').length,overflow:document.documentElement.scrollWidth>innerWidth+2}))()""")
 check(f'{width} agent editor or canonical state',m['footer'] or m['state'] in ['empty','loading','error','permission'],m)
 check(f'{width} agent no legacy helper/footer',m['helper']==0,m)
 check(f'{width} agent no overflow',not m['overflow'],m)

 nav('/devices/dev_80000000000000000000000000000001','.inno-resource-head')
 m=ev("""(()=>({resource:!!document.querySelector('.inno-resource-head'),icon:!!document.querySelector('.inno-resource-icon'),software:!!document.querySelector('.device-software-card.inno-collection'),toolbar:!!document.querySelector('.device-software-card .inno-collection-toolbar'),legacy:document.querySelectorAll('.production-resource-head,.resource-title-line,.resource-meta-line,.device-software-card.collection-card,.device-software-card .production-table-wrap').length,overflow:document.documentElement.scrollWidth>innerWidth+2}))()""")
 check(f'{width} detail frozen resource identity',m['resource'] and m['icon'],m)
 check(f'{width} detail software collection',m['software'],m)
 check(f'{width} detail no legacy resource/software wrappers',m['legacy']==0,m)
 check(f'{width} detail no overflow',not m['overflow'],m)

 if group_href:
  nav(group_href,'.inno-resource-head')
  m=ev("""(()=>({resource:!!document.querySelector('.inno-resource-head'),collection:!!document.querySelector('.inno-collection'),duplicate:document.querySelectorAll('.inno-page-head').length,legacy:document.querySelectorAll('.production-resource-head,.resource-title-line,.resource-meta-line,.collection-card,.collection-toolbar,.production-table-wrap').length,overflow:document.documentElement.scrollWidth>innerWidth+2}))()""")
  check(f'{width} group detail resource pattern',m['resource'] and m['collection'],m)
  check(f'{width} group detail no duplicate page head',m['duplicate']==0,m)
  check(f'{width} group detail no legacy wrappers',m['legacy']==0,m)
  check(f'{width} group detail no overflow',not m['overflow'],m)

 sm=shell_metrics()
 check(f'{width} devices shell active navigation',sm['rail']==1 and sm['side']==1,sm)

print(f'checks={checks} failures={len(fails)} group_detail={group_href or "not-found"}')
raise SystemExit(bool(fails))
