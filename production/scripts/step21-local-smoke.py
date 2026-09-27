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


def api(method, path, access_token=None, body=None, expected=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Accept": "application/json"}
    if access_token:
        headers["Authorization"] = "Bearer " + access_token
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
            raw = response.read()
            payload = json.loads(raw or b"{}")
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read()
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            payload = {"raw": raw.decode("utf-8", errors="replace")}

    if expected is not None and status != expected:
        raise AssertionError(
            f"{method} {path}: expected {expected}, got {status}: {payload}"
        )
    return status, payload


hr_asset = "asset_90000000000000000000000000000001"
it_asset = "asset_90000000000000000000000000000002"

api("POST", "/assets/" + hr_asset + "/qr-label", expected=401)
print("unauthenticated=PASS")

admin = token("adisai")
hr = token("hr.viewer")

api("POST", "/assets/" + hr_asset + "/qr-label", hr, expected=403)
print("print_permission=PASS")

_, generated_response = api(
    "POST",
    "/assets/" + hr_asset + "/qr-label",
    admin,
    expected=200,
)
generated = generated_response["data"]
first_token = generated["qrValue"]
assert first_token.startswith("inno1_qr_")
assert len(first_token) >= 50
assert generated["assetTag"] == "AST-PC-000142"
print("label_generation=PASS")

_, resolved_response = api(
    "POST",
    "/assets/qr/resolve",
    hr,
    {"token": first_token},
    expected=200,
)
resolved = resolved_response["data"]
assert resolved["assetTag"] == "AST-PC-000142"
assert resolved["owner"]["name"] == "Somchai Prasert"
assert any(x["fieldKey"] == "cost_center" for x in resolved["customFields"])
print("scoped_resolve=PASS")

_, it_generated_response = api(
    "POST",
    "/assets/" + it_asset + "/qr-label",
    admin,
    expected=200,
)
it_token = it_generated_response["data"]["qrValue"]

api(
    "POST",
    "/assets/qr/resolve",
    hr,
    {"token": it_token},
    expected=403,
)
_, admin_it_resolve = api(
    "POST",
    "/assets/qr/resolve",
    admin,
    {"token": it_token},
    expected=200,
)
assert admin_it_resolve["data"]["assetTag"] == "AST-NB-000003"
print("resolve_scope_guard=PASS")

_, regenerated_response = api(
    "POST",
    "/assets/" + hr_asset + "/qr-label",
    admin,
    expected=200,
)
regenerated = regenerated_response["data"]
second_token = regenerated["qrValue"]
assert second_token != first_token
assert regenerated["replacedPrevious"] is True

api(
    "POST",
    "/assets/qr/resolve",
    hr,
    {"token": first_token},
    expected=404,
)
api(
    "POST",
    "/assets/qr/resolve",
    hr,
    {"token": second_token},
    expected=200,
)
print("regeneration_revokes_previous=PASS")

api(
    "POST",
    "/assets/qr/resolve",
    hr,
    {"token": "inno1_qr_" + ("x" * 43)},
    expected=404,
)
print("invalid_token=PASS")
print("STEP21_RUNTIME_SMOKE_PASS")
