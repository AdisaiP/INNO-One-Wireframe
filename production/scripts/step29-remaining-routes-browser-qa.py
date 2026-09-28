#!/usr/bin/env python3
import json,time,requests,websocket

PORT=9241
BASE='http://localhost:5180'

def targets():
 return requests.get(f'http://127.0.0.1:{PORT}/json',timeout=2).json()

xs=targets()
page=next((x for x in xs if x.get('type')=='page' and 'localhost:5180' in x.get('url','')),None)
if page is None:
 requests.put(f'http://127.0.0.1:{PORT}/json/new?{BASE}/profile',timeout=2)
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
 time.sleep(.25)

call('Page.enable');call('Runtime.enable')

deferred=[
 ('apps','/apps/future','disabled'),
 ('meeting','/meeting/future','disabled'),
 ('reports','/reports/future','disabled'),
 ('admin','/admin/future','disabled'),
 ('not-found','/route-that-does-not-exist','no-results'),
]

for width in (1366,1024,768):
 call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':False})

 nav('/profile','.inno-page-head')
 p=ev("""(()=>({
   page:!!document.querySelector('.inno-page'),
   profileActive:[...document.querySelectorAll('.prod-rail a.active')].some(a=>a.getAttribute('href')==='/profile'),
   sideActive:[...document.querySelectorAll('.prod-side a.active')].some(a=>a.getAttribute('href')==='/profile'),
   statuses:document.querySelectorAll('.inno-status').length,
   legacy:document.querySelectorAll('.page-helper,.prod-tag,.collection-card,.production-table-wrap,.editor-footer').length,
   overflow:document.documentElement.scrollWidth>innerWidth+2,
   prefsNote:document.body.innerText.includes('Personal preferences are not exposed in this production slice.')
 }))()""")
 check(f'{width} profile rendered',p['page'],p)
 check(f'{width} profile navigation',p['profileActive'] and p['sideActive'],p)
 check(f'{width} profile shared statuses',p['statuses']>=4,p)
 check(f'{width} profile no legacy wrappers',p['legacy']==0,p)
 check(f'{width} profile no overflow',not p['overflow'],p)
 check(f'{width} profile availability note',p['prefsNote'],p)

 for name,path,state in deferred:
  nav(path,'.inno-state')
  m=ev("""(()=>({
    state:document.querySelector('.inno-state')?.dataset.state||null,
    railActive:document.querySelectorAll('.prod-rail a.active').length,
    sideActive:document.querySelectorAll('.prod-side a.active').length,
    sideTitle:document.querySelector('.prod-side-title')?.textContent?.trim()||'',
    neutral:(document.querySelector('.prod-side-note')?.textContent||'').includes('outside the currently enabled production modules'),
    overflow:document.documentElement.scrollWidth>innerWidth+2
  }))()""")
  check(f'{width} {name} state',m['state']==state,m)
  if name!='not-found':
   check(f'{width} {name} neutral shell context',m['railActive']==0 and m['sideActive']==0 and m['sideTitle']=='INNO.One' and m['neutral'],m)
  check(f'{width} {name} no overflow',not m['overflow'],m)

print(f'checks={checks} failures={len(fails)}')
raise SystemExit(bool(fails))
