#!/usr/bin/env python3
import json
import time
from pathlib import Path

import requests
import websocket

PORT = 9241
realm = json.loads(Path('production/infrastructure/docker/keycloak/realm-inno-one.json').read_text())
user = next(item for item in realm['users'] if item['username'] == 'adisai')
password = user['credentials'][0]['value']

deadline = time.time() + 20
page = None
while time.time() < deadline:
    try:
        targets = requests.get(f'http://127.0.0.1:{PORT}/json', timeout=2).json()
        page = next((x for x in targets if x.get('type') == 'page'), None)
        if page:
            break
    except Exception:
        pass
    time.sleep(.25)
if not page:
    raise SystemExit('No Chrome page target')

ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=8, suppress_origin=True)
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

call('Runtime.enable')
deadline = time.time() + 30
while time.time() < deadline:
    url = ev('location.href') or ''
    if 'localhost:5180' in url and ev("!!document.querySelector('.inno-production-shell')"):
        print('QA_BROWSER_LOGIN_READY')
        raise SystemExit(0)
    if 'realms/inno-one' in url and ev("!!document.querySelector('#username')"):
        script = """(()=>{const u=document.querySelector('#username'),p=document.querySelector('#password'),b=document.querySelector('#kc-login');if(!u||!p||!b)return false;u.value=USERNAME;u.dispatchEvent(new Event('input',{bubbles:true}));p.value=PASSWORD;p.dispatchEvent(new Event('input',{bubbles:true}));b.click();return true})()"""
        script = script.replace('USERNAME', json.dumps(user['username'])).replace('PASSWORD', json.dumps(password))
        if not ev(script):
            raise SystemExit('Keycloak login form not ready')
        break
    time.sleep(.25)

deadline = time.time() + 30
while time.time() < deadline:
    if 'localhost:5180' in (ev('location.href') or '') and ev("!!document.querySelector('.inno-production-shell')"):
        print('QA_BROWSER_LOGIN_READY')
        raise SystemExit(0)
    time.sleep(.25)

raise SystemExit('Web portal did not return after login')
