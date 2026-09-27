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
def api(method, path, access_token=None, body=None, headers=None, expected=None):
    data = None if body is None else json.dumps(body).encode()
    merged = {"Accept": "application/json"}
    if access_token:
        merged["Authorization"] = "Bearer " + access_token
    if body is not None:
        merged["Content-Type"] = "application/json"
    if headers:
        merged.update(headers)
    request = urllib.request.Request(
        API + path, data=data, headers=merged, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status = response.status
            raw = response.read()
            payload = json.loads(raw or b"{}")
            response_headers = dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read()
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            payload = {"raw": raw.decode("utf-8", errors="replace")}
        response_headers = dict(exc.headers.items())
    if expected is not None and status != expected:
        raise AssertionError(
            f"{method} {path}: expected {expected}, got {status}: {payload}"
        )
    return status, payload, response_headers

def schema_payload(fields):
    return {
        "fields": [
            {
                "fieldKey": x["fieldKey"],
                "label": x["label"],
                "fieldType": x["fieldType"],
                "isRequired": x["isRequired"],
                "showInAgent": x["showInAgent"],
                "status": x["status"],
                "options": x["options"],
            }
            for x in fields
        ]
    }
api("GET", "/assets/custom-fields", expected=401)
print("unauthenticated=PASS")

admin = token("adisai")
hr = token("hr.viewer")
api("PUT", "/assets/custom-fields", hr, {"fields": []}, expected=403)
print("manage_permission=PASS")

_, schema_response, schema_headers = api(
    "GET", "/assets/custom-fields", admin, expected=200
)
schema = schema_response["data"]
original_fields = schema["fields"]
original_etag = schema["eTag"]
assert len(original_fields) >= 4
assert schema_headers.get("ETag") == original_etag
print("schema_read=PASS fields=" + str(len(original_fields)))

bad_fields = [dict(x) for x in original_fields]
bad_select = next(x for x in bad_fields if x["fieldType"] == "select")
bad_select["options"] = []
api(
    "PUT",
    "/assets/custom-fields",
    admin,
    schema_payload(bad_fields),
    headers={"If-Match": original_etag},
    expected=400,
)
print("schema_validation=PASS")
changed_fields = [dict(x) for x in original_fields]
note = next(x for x in changed_fields if x["fieldKey"] == "maintenance_note")
note["label"] = note["label"] + " QA"
_, changed_response, _ = api(
    "PUT",
    "/assets/custom-fields",
    admin,
    schema_payload(changed_fields),
    headers={"If-Match": original_etag},
    expected=200,
)
changed_schema = changed_response["data"]
api(
    "PUT",
    "/assets/custom-fields",
    admin,
    schema_payload(original_fields),
    headers={"If-Match": original_etag},
    expected=412,
)
api(
    "PUT",
    "/assets/custom-fields",
    admin,
    schema_payload(original_fields),
    headers={"If-Match": changed_schema["eTag"]},
    expected=200,
)
print("schema_etag_restore=PASS")

asset_id = "asset_90000000000000000000000000000001"
_, detail_response, _ = api(
    "GET", "/assets/" + asset_id, admin, expected=200
)
asset = detail_response["data"]
fields = {x["fieldKey"]: x for x in asset["customFields"]}
assert fields["cost_center"]["value"] == "HR-OPS"
assert fields["office_zone"]["value"] == "Floor 3"
assert fields["asset_criticality"]["value"] == "Standard"
original_asset_etag = asset["eTag"]
original_zone = fields["office_zone"]["value"]
print("asset_custom_read=PASS")
api(
    "PATCH",
    "/assets/" + asset_id,
    admin,
    {"customFields": {"cost_center": None}},
    headers={"If-Match": original_asset_etag},
    expected=400,
)
api(
    "PATCH",
    "/assets/" + asset_id,
    admin,
    {"customFields": {"office_zone": "Not an option"}},
    headers={"If-Match": original_asset_etag},
    expected=400,
)
print("asset_custom_validation=PASS")

_, changed_asset_response, _ = api(
    "PATCH",
    "/assets/" + asset_id,
    admin,
    {"customFields": {"office_zone": "Floor 2"}},
    headers={"If-Match": original_asset_etag},
    expected=200,
)
changed_asset = changed_asset_response["data"]
changed_zone = next(
    x for x in changed_asset["customFields"]
    if x["fieldKey"] == "office_zone"
)["value"]
assert changed_zone == "Floor 2"

api(
    "PATCH",
    "/assets/" + asset_id,
    admin,
    {"customFields": {"office_zone": original_zone}},
    headers={"If-Match": original_asset_etag},
    expected=412,
)
print("asset_custom_etag=PASS")
_, latest_response, _ = api(
    "GET", "/assets/" + asset_id, admin, expected=200
)
latest = latest_response["data"]
_, restored_response, _ = api(
    "PATCH",
    "/assets/" + asset_id,
    admin,
    {"customFields": {"office_zone": original_zone}},
    headers={"If-Match": latest["eTag"]},
    expected=200,
)
restored = restored_response["data"]
restored_zone = next(
    x for x in restored["customFields"]
    if x["fieldKey"] == "office_zone"
)["value"]
assert restored_zone == original_zone
print("asset_custom_restore=PASS")
print("STEP20_RUNTIME_SMOKE_PASS")
