#!/usr/bin/env python3
from datetime import datetime, timedelta, timezone
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
    req = urllib.request.Request(
        KEYCLOAK + "/protocol/openid-connect/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)["access_token"]

def api(method, path, access_token=None, body=None, headers=None, expected=None):
    data = None if body is None else json.dumps(body).encode()
    merged = {"Accept": "application/json"}
    if access_token:
        merged["Authorization"] = "Bearer " + access_token
    if body is not None:
        merged["Content-Type"] = "application/json"
    if headers:
        merged.update(headers)
    req = urllib.request.Request(API + path, data=data, headers=merged, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            status = response.status
            payload = json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read()
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            payload = {"raw": raw.decode("utf-8", errors="replace")}
    if expected is not None and status != expected:
        raise AssertionError(f"{method} {path}: expected {expected}, got {status}: {payload}")
    return status, payload

api("GET", "/assets/contracts", expected=401)
print("unauthenticated=PASS")

admin = token("adisai")
hr = token("hr.viewer")

_, listing = api("GET", "/assets/contracts?page=1&pageSize=25", admin, expected=200)
assert listing["totalItems"] == 3
assert listing["summary"]["activeContracts"] == 1
assert listing["summary"]["expiringWithin90Days"] == 1
assert listing["summary"]["coveredAssets"] == 4
assert listing["summary"]["uncoveredAssets"] == 1
print("summary=PASS")

_, expiring = api("GET", "/assets/contracts?status=expiring", admin, expected=200)
assert expiring["totalItems"] == 1
_, fiscal = api("GET", "/assets/contracts?fiscalYear=2567", admin, expected=200)
assert fiscal["totalItems"] == 1
print("filters=PASS")

active = next(x for x in listing["items"] if x["contractNumber"] == "CTR-2568-IT-014")
api(
    "PATCH",
    "/assets/contracts/" + active["id"],
    hr,
    {
        "fiscalYear": active["fiscalYear"],
        "vendor": active["vendor"],
        "startAt": active["startAt"],
        "endAt": active["endAt"],
        "serviceType": active["serviceType"],
        "serviceCondition": active["serviceCondition"],
        "warrantyTerms": active["warrantyTerms"],
        "contactName": active["contactName"],
        "contactPhone": active["contactPhone"],
        "contactEmail": active["contactEmail"],
    },
    headers={"If-Match": active["eTag"]},
    expected=403,
)
print("manage_permission=PASS")

bad = {
    "fiscalYear": active["fiscalYear"],
    "vendor": active["vendor"],
    "startAt": active["endAt"],
    "endAt": active["startAt"],
    "serviceType": active["serviceType"],
    "serviceCondition": active["serviceCondition"],
    "warrantyTerms": active["warrantyTerms"],
    "contactName": active["contactName"],
    "contactPhone": active["contactPhone"],
    "contactEmail": active["contactEmail"],
}
api(
    "PATCH",
    "/assets/contracts/" + active["id"],
    admin,
    bad,
    headers={"If-Match": active["eTag"]},
    expected=400,
)
print("validation=PASS")

now = datetime.now(timezone.utc)
transition = dict(bad)
transition["startAt"] = active["startAt"]
transition["endAt"] = (now + timedelta(days=30)).isoformat()
_, changed_response = api(
    "PATCH",
    "/assets/contracts/" + active["id"],
    admin,
    transition,
    headers={"If-Match": active["eTag"]},
    expected=200,
)
changed = changed_response["data"]
assert changed["status"] == "expiring"
assert changed["coveredAssets"]
print("expiration_transition=PASS")

restore = dict(transition)
restore["endAt"] = active["endAt"]
api(
    "PATCH",
    "/assets/contracts/" + active["id"],
    admin,
    restore,
    headers={"If-Match": active["eTag"]},
    expected=412,
)
print("etag_guard=PASS")

_, current_listing = api(
    "GET",
    "/assets/contracts?search=CTR-2568-IT-014",
    admin,
    expected=200,
)
current = current_listing["items"][0]
_, restored_response = api(
    "PATCH",
    "/assets/contracts/" + active["id"],
    admin,
    restore,
    headers={"If-Match": current["eTag"]},
    expected=200,
)
restored = restored_response["data"]
assert restored["status"] == "active"
assert restored["endAt"][:10] == active["endAt"][:10]
print("restore=PASS")
print("STEP23_RUNTIME_SMOKE_PASS")
