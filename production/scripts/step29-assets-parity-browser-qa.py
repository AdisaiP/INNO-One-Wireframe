#!/usr/bin/env python3
import json,time,requests,websocket

PORT=9241
BASE='http://localhost:5180'

def targets():
 return requests.get(f'http://127.0.0.1:{PORT}/json',timeout=2).json()

xs=targets()
page=next((x for x in xs if x.get('type')=='page' and 'localhost:5180' in x.get('url','')),None)
if page is None:
 requests.put(f'http://127.0.0.1:{PORT}/json/new?{BASE}/assets',timeout=2)
 time.sleep(.8)
 page=next(x for x in targets() if x.get('type')=='page' and 'localhost:5180' in x.get('url',''))

ws=websocket.create_connection(page['webSocketDebuggerUrl'],timeout=12,origin='http://127.0.0.1')
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
  legacy:document.querySelectorAll('.collection-card,.production-table-wrap,.page-helper,.production-resource-head,.resource-title-line').length,
  rail:document.querySelectorAll('.prod-rail a.active').length,
  side:document.querySelectorAll('.prod-side a.active').length
}))()""")

call('Page.enable');call('Runtime.enable')

asset_href=None
owner_href=None
routes=[
 ('overview','/assets','.inno-page-head'),
 ('inventory','/assets/inventory','.inno-collection'),
 ('ownership','/assets/ownership','.inno-page-head'),
 ('owners','/assets/owners','.inno-collection'),
 ('submissions','/assets/ownership/submissions','.inno-collection'),
 ('custom-fields','/assets/custom-fields','.inno-page'),
 ('qr','/assets/qr-labels','.inno-page'),
 ('baselines','/assets/software-baselines','.inno-page'),
 ('licenses','/assets/software-licenses','.inno-page'),
 ('contracts','/assets/contracts','.inno-page'),
]

for width in (1366,1024,768):
 call('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':False})
 for name,path,wait in routes:
  nav(path,wait)
  m=common()
  check(f'{width} {name} page rendered',m['page'],m)
  check(f'{width} {name} no legacy wrappers',m['legacy']==0,m)
  check(f'{width} {name} no page overflow',not m['overflow'],m)
  if name in ['inventory','owners','submissions']:
   has_collection=ev("!!document.querySelector('.inno-collection')")
   check(f'{width} {name} shared collection',has_collection,{'collection':has_collection})
  if name in ['custom-fields','qr','baselines','licenses','contracts']:
   canonical=ev("""(()=>({
    collection:!!document.querySelector('.inno-collection'),
    state:document.querySelector('.inno-state')?.dataset.state||null,
    permission:document.body.innerText.includes('Permission denied')||document.body.innerText.includes('not available')
   }))()""")
   check(f'{width} {name} canonical content or state',canonical['collection'] or canonical['state'] in ['empty','loading','error','permission'] or canonical['permission'],canonical)
  if name=='baselines':
   evidence=ev("document.body.innerText.includes('last 24 hours') && document.body.innerText.includes('Unknown')")
   check(f'{width} baselines evidence scope copy',evidence,{'evidence':evidence})
  if name=='inventory' and asset_href is None:
   asset_href=ev("""(()=>[...document.querySelectorAll('a[href^="/assets/"]')].map(a=>a.getAttribute('href')).find(h=>h && /^\/assets\/[^/]+$/.test(h))||null)()""")
  if name=='owners' and owner_href is None:
   owner_href=ev("""(()=>[...document.querySelectorAll('a[href^="/assets/owners/"]')].map(a=>a.getAttribute('href'))[0]||null)()""")

 if asset_href:
  nav(asset_href,'.inno-resource-head')
  m=ev("""(()=>({
    resource:!!document.querySelector('.inno-resource-head'),
    icon:!!document.querySelector('.inno-resource-icon'),
    collection:!!document.querySelector('.inno-collection'),
    footer:!!document.querySelector('.inno-editor-footer'),
    sideActive:document.querySelectorAll('.prod-side a.active').length,
    inventoryActive:[...document.querySelectorAll('.prod-side a.active')].some(a=>a.getAttribute('href')==='/assets/inventory'),
    legacy:document.querySelectorAll('.collection-card,.production-table-wrap,.production-resource-head,.resource-title-line').length,
    overflow:document.documentElement.scrollWidth>innerWidth+2
  }))()""")
  check(f'{width} asset detail resource pattern',m['resource'] and m['icon'],m)
  check(f'{width} asset detail shared history',m['collection'],m)
  check(f'{width} asset detail inventory navigation',m['sideActive']==1 and m['inventoryActive'],m)
  check(f'{width} asset detail no legacy wrappers',m['legacy']==0,m)
  check(f'{width} asset detail no overflow',not m['overflow'],m)

 if owner_href:
  nav(owner_href,'.inno-resource-head')
  m=ev("""(()=>({
    resource:!!document.querySelector('.inno-resource-head'),
    collection:!!document.querySelector('.inno-collection'),
    legacy:document.querySelectorAll('.collection-card,.production-table-wrap,.production-resource-head,.resource-title-line').length,
    overflow:document.documentElement.scrollWidth>innerWidth+2
  }))()""")
  check(f'{width} owner detail resource pattern',m['resource'] and m['collection'],m)
  check(f'{width} owner detail no legacy wrappers',m['legacy']==0,m)
  check(f'{width} owner detail no overflow',not m['overflow'],m)

print(f'checks={checks} failures={len(fails)} asset_detail={asset_href or "not-found"} owner_detail={owner_href or "not-found"}')
raise SystemExit(bool(fails))
