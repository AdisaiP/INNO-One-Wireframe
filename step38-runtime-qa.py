import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_BASE = os.environ.get("INNO_API_BASE", "http://127.0.0.1:5080/api/v1")
KEYCLOAK_BASE = os.environ.get("INNO_KEYCLOAK_BASE", "http://127.0.0.1:18080")
REALM_PATH = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
checks = []

def check(name, condition, detail=""):
    if not condition:
        raise AssertionError(f"{name}: {detail}")
    checks.append(name)
    print("PASS " + name)

def http(method, url, token=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return error.code, payload

def realm_password(username):
    realm = json.loads(REALM_PATH.read_text(encoding="utf-8"))
    user = next(item for item in realm["users"] if item["username"] == username)
    return user["credentials"][0]["value"]

def token(username):
    form = urllib.parse.urlencode({
        "grant_type": "password",
        "client_id": "inno-one-e2e",
        "username": username,
        "password": realm_password(username),
    }).encode("utf-8")
    req = urllib.request.Request(
        KEYCLOAK_BASE + "/realms/inno-one/protocol/openid-connect/token",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)["access_token"]

def get(path, access_token):
    return http("GET", API_BASE + path, access_token)

def search(query, access_token, limit=30):
    params = urllib.parse.urlencode({"q": query, "limit": limit})
    return get("/search?" + params, access_token)

def shape_ok(item):
    return set(item) == {"type", "id", "title", "subtitle", "route"}

status, health = http("GET", API_BASE.removesuffix("/api/v1") + "/health/ready")
check("health ready", status == 200, str(health))
check("implementation 0.28.0", health["implementationContract"] == "0.28.0", str(health))

admin = token("adisai")
viewer = token("hr.viewer")

status, admin_profile = get("/platform/me", admin)
check("admin profile", status == 200, str(admin_profile))
check("admin search permission", "platform.search.use" in admin_profile["data"]["permissions"], str(admin_profile))

status, viewer_profile = get("/platform/me", viewer)
check("viewer profile", status == 200, str(viewer_profile))
check("viewer search permission", "platform.search.use" in viewer_profile["data"]["permissions"], str(viewer_profile))

status, missing = get("/search", admin)
check("missing query rejected", status == 400, str(missing))

status, device = search("DESKTOP-HR-014", admin)
check("device search status", status == 200, str(device))
check("device exact result", len(device["items"]) == 1 and device["items"][0]["type"] == "device", str(device))
check("device route", device["items"][0]["route"].startswith("/devices/dev_"), str(device))
check("device result shape", shape_ok(device["items"][0]), str(device))

status, asset = search("AST-PC-000142", admin)
check("asset search status", status == 200, str(asset))
check("asset exact result", len(asset["items"]) == 1 and asset["items"][0]["type"] == "asset", str(asset))
check("asset route", asset["items"][0]["route"].startswith("/assets/asset_"), str(asset))
check("asset result shape", shape_ok(asset["items"][0]), str(asset))

status, ticket = search("HD-2026-001048", admin)
check("ticket search status", status == 200, str(ticket))
check("ticket exact result", len(ticket["items"]) == 1 and ticket["items"][0]["type"] == "ticket", str(ticket))
check("ticket route", ticket["items"][0]["route"].startswith("/helpdesk/tickets/ticket_"), str(ticket))
check("ticket result shape", shape_ok(ticket["items"][0]), str(ticket))

status, windows = search("Windows 11", admin)
check("multi device search", status == 200 and any(x["type"] == "device" for x in windows["items"]), str(windows))
check("provider count", windows["providerCount"] == 3, str(windows))

status, limited = search("Windows", admin, 1)
check("limit respected", status == 200 and len(limited["items"]) <= 1, str(limited))

status, viewer_hr = search("DESKTOP-HR-014", viewer)
check("viewer sees HR device", status == 200 and any(x["type"] == "device" for x in viewer_hr["items"]), str(viewer_hr))

status, viewer_it = search("NOTEBOOK-IT-003", viewer)
check("viewer scope hides IT device", status == 200 and viewer_it["totalItems"] == 0, str(viewer_it))

status, viewer_asset = search("AST-PC-000142", viewer)
check("viewer destination permission hides assets", status == 200 and viewer_asset["totalItems"] == 0, str(viewer_asset))

status, viewer_ticket = search("HD-2026-001048", viewer)
check("viewer sees HR ticket", status == 200 and any(x["type"] == "ticket" for x in viewer_ticket["items"]), str(viewer_ticket))

status, viewer_finance = search("HD-2026-001049", viewer)
check("viewer scope hides Finance ticket", status == 200 and viewer_finance["totalItems"] == 0, str(viewer_finance))

status, empty = search("definitely-no-such-resource-38", admin)
check("no results is valid", status == 200 and empty["items"] == [] and empty["totalItems"] == 0, str(empty))

print("step38_runtime_checks=" + str(len(checks)))
print("step38_runtime_qa=PASS")
