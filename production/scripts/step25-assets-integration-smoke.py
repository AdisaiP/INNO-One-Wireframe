#!/usr/bin/env python3
from pathlib import Path
import json
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:5080/api/v1"
KEYCLOAK = "http://localhost:8080/realms/inno-one"
REALM = json.loads(
    (ROOT / "infrastructure/docker/keycloak/realm-inno-one.json").read_text()
)


def token(username):
    user = next(x for x in REALM["users"] if x["username"] == username)
    body = urllib.parse.urlencode({
        "client_id": "inno-one-e2e",
        "grant_type": "password",
        "username": username,
        "password": user["credentials"][0]["value"],
    }).encode()
    request = urllib.request.Request(
        KEYCLOAK + "/protocol/openid-connect/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)["access_token"]


def api(method, path, access_token, body=None, expected=200):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Accept": "application/json",
        "Authorization": "Bearer " + access_token,
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        API + path,
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status = response.status
            payload = json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        status = exc.code
        payload = json.loads(exc.read() or b"{}")
    if status != expected:
        raise AssertionError(
            f"{method} {path}: expected {expected}, got {status}: {payload}"
        )
    return payload


admin = token("adisai")

devices = api(
    "GET",
    "/devices?search=DESKTOP-HR-014&page=1&pageSize=25",
    admin,
)
assert devices["totalItems"] == 1
device_id = devices["items"][0]["id"]
device = api("GET", "/devices/" + device_id, admin)["data"]
assert device["name"] == "DESKTOP-HR-014"
assert device["assetReference"] == "AST-PC-000142"
print("device_asset_reference=PASS")

assets = api(
    "GET",
    "/assets?search=AST-PC-000142&page=1&pageSize=25",
    admin,
)
assert assets["totalItems"] == 1
asset_id = assets["items"][0]["id"]
asset = api("GET", "/assets/" + asset_id, admin)["data"]
assert asset["assetTag"] == "AST-PC-000142"
assert asset["linkedDevice"]["id"] == device_id
assert asset["linkedDevice"]["name"] == "DESKTOP-HR-014"
assert asset["owner"]["name"] == "Somchai Prasert"
assert asset["warrantyEndAt"]
assert any(x["fieldKey"] == "cost_center" for x in asset["customFields"])
print("asset_device_owner_custom_fields=PASS")

tickets = api(
    "GET",
    "/helpdesk/tickets?search=HD-2026-001048&page=1&pageSize=25",
    admin,
)
assert tickets["totalItems"] == 1
ticket_id = tickets["items"][0]["id"]
ticket = api("GET", "/helpdesk/tickets/" + ticket_id, admin)["data"]
assert ticket["ticketNumber"] == "HD-2026-001048"
assert ticket["relatedDevice"]["id"] == device_id
assert ticket["relatedDevice"]["name"] == "DESKTOP-HR-014"
print("helpdesk_device_reference=PASS")

label = api("POST", "/assets/" + asset_id + "/qr-label", admin)["data"]
qr_value = label["qrValue"]
resolved = api(
    "POST",
    "/assets/qr/resolve",
    admin,
    {"token": qr_value},
)["data"]
assert resolved["id"] == asset_id
assert resolved["assetTag"] == asset["assetTag"]
assert resolved["linkedDevice"]["id"] == device_id
assert resolved["owner"]["name"] == asset["owner"]["name"]
print("qr_asset_device_identity=PASS")

licenses = api(
    "GET",
    "/assets/software-licenses?search=Microsoft%20365&page=1&pageSize=25",
    admin,
)
assert licenses["totalItems"] == 1
m365 = licenses["items"][0]
allocation = next(
    x for x in m365["allocations"]
    if x.get("assetId") == asset_id
)
assert allocation["endpointName"] == device["name"]
assert allocation["seatCount"] == 1
print("license_asset_endpoint_reference=PASS")

contracts = api(
    "GET",
    "/assets/contracts?search=CTR-2568-IT-014&page=1&pageSize=25",
    admin,
)
assert contracts["totalItems"] == 1
contract = contracts["items"][0]
covered = next(x for x in contract["coveredAssets"] if x["id"] == asset_id)
assert covered["assetTag"] == asset["assetTag"]
assert covered["owner"] == asset["owner"]["name"]
print("contract_asset_reference=PASS")

ownership = api("GET", "/assets/ownership", admin)["data"]
assert ownership["assignedAssets"] >= 1
assert ownership["confirmedOwnership"] >= 1
print("ownership_summary=PASS")

print("STEP25_ASSETS_INTEGRATION_SMOKE_PASS")
