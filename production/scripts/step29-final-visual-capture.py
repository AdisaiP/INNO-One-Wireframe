#!/usr/bin/env python3
import base64
import io
import json
import os
import time
from pathlib import Path

import requests
import websocket
from PIL import Image, ImageDraw, ImageFont

PORT = 9241
BASE = 'http://localhost:5180'
OUT = Path(os.environ.get('STEP29_SCREENSHOT_DIR', 'step29-final-visual'))
OUT.mkdir(parents=True, exist_ok=True)

def targets():
    return requests.get(f'http://127.0.0.1:{PORT}/json', timeout=2).json()

pages = targets()
page = next((x for x in pages if x.get('type') == 'page' and 'localhost:5180' in x.get('url', '')), None)
if page is None:
    requests.put(f'http://127.0.0.1:{PORT}/json/new?{BASE}/devices', timeout=2)
    time.sleep(.8)
    page = next(x for x in targets() if x.get('type') == 'page' and 'localhost:5180' in x.get('url', ''))

ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=15, suppress_origin=True)
seq = 0

def call(method, params=None):
    global seq
    seq += 1
    i = seq
    ws.send(json.dumps({'id': i, 'method': method, 'params': params or {}}))
    while True:
        response = json.loads(ws.recv())
        if response.get('id') == i:
            return response.get('result', {})

def ev(expr):
    return call('Runtime.evaluate', {
        'expression': expr,
        'returnByValue': True,
        'awaitPromise': True,
    }).get('result', {}).get('value')

def nav(path, wait='.inno-page'):
    call('Page.navigate', {'url': BASE + path})
    deadline = time.time() + 10
    while time.time() < deadline:
        if ev(f"document.querySelector({json.dumps(wait)})!==null"):
            time.sleep(.35)
            return
        time.sleep(.1)
    raise RuntimeError(f'Route did not settle: {path}')

def screenshot(name):
    result = call('Page.captureScreenshot', {
        'format': 'png',
        'fromSurface': True,
        'captureBeyondViewport': False,
    })
    data = base64.b64decode(result['data'])
    path = OUT / f'{name}.png'
    path.write_bytes(data)
    return path

def first_detail(prefix, exclusions):
    expr = """(()=>{const exclusions=new Set(EXCLUSIONS);return [...document.querySelectorAll('a[href^="PREFIX"]')].map(a=>a.getAttribute('href')).find(h=>h && !exclusions.has(h) && /^REGEX$/.test(h))||null})()"""
    regex = prefix.rstrip('/') + r'/[^/]+'
    return ev(expr.replace('EXCLUSIONS', json.dumps(exclusions)).replace('PREFIX', prefix).replace('REGEX', regex.replace('/', r'\/')))

call('Page.enable')
call('Runtime.enable')

nav('/devices', '.inno-page')
device_detail = first_detail('/devices/', ['/devices/discovery', '/devices/groups', '/devices/add'])

nav('/assets/inventory', '.inno-collection')
asset_detail = first_detail('/assets/', [
    '/assets/inventory', '/assets/ownership', '/assets/owners', '/assets/custom-fields',
    '/assets/qr-labels', '/assets/software-baselines', '/assets/software-licenses', '/assets/contracts'
])

nav('/helpdesk/tickets', '.inno-collection')
ticket_detail = first_detail('/helpdesk/tickets/', ['/helpdesk/tickets/new'])

routes = [
    ('devices', '/devices', '.inno-page'),
    ('assets-inventory', '/assets/inventory', '.inno-collection'),
    ('helpdesk-overview', '/helpdesk', '.inno-page'),
    ('helpdesk-tickets', '/helpdesk/tickets', '.inno-collection'),
    ('helpdesk-sla', '/helpdesk/sla', '.inno-page'),
    ('helpdesk-automation', '/helpdesk/automation', '.inno-collection'),
    ('profile', '/profile', '.inno-page'),
    ('deferred-apps', '/apps/future', '.inno-state'),
]
if device_detail:
    routes.insert(1, ('device-detail', device_detail, '.inno-resource-head'))
if asset_detail:
    routes.insert(3, ('asset-detail', asset_detail, '.inno-resource-head'))
if ticket_detail:
    routes.insert(6, ('ticket-detail', ticket_detail, '.inno-resource-head'))

captured = []
for width in (1366, 1024, 768):
    call('Emulation.setDeviceMetricsOverride', {
        'width': width,
        'height': 900,
        'deviceScaleFactor': 1,
        'mobile': False,
    })
    for name, path, wait in routes:
        nav(path, wait)
        out = screenshot(f'{width}-{name}')
        captured.append((width, name, out))
        print(f'CAPTURE {width} {name} {path}')

font = ImageFont.load_default()
for width in (1366, 1024, 768):
    items = [(name, path) for w, name, path in captured if w == width]
    thumb_w = 360
    label_h = 26
    gap = 12
    cols = 2
    thumbs = []
    for name, path in items:
        img = Image.open(path).convert('RGB')
        scale = thumb_w / img.width
        thumb_h = max(1, int(img.height * scale))
        img = img.resize((thumb_w, thumb_h))
        thumbs.append((name, img))
    cell_h = max(img.height for _, img in thumbs) + label_h
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * thumb_w + (cols + 1) * gap, rows * cell_h + (rows + 1) * gap), 'white')
    draw = ImageDraw.Draw(sheet)
    for idx, (name, img) in enumerate(thumbs):
        row, col = divmod(idx, cols)
        x = gap + col * (thumb_w + gap)
        y = gap + row * cell_h
        draw.text((x, y), f'{width} · {name}', fill='black', font=font)
        sheet.paste(img, (x, y + label_h))
    sheet.save(OUT / f'contact-sheet-{width}.png')

print(f'captured={len(captured)} routes={len(routes)} viewports=3 output={OUT}')
