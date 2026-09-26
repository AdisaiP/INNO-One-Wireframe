#!/usr/bin/env python3
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REALM_PATH = ROOT / "infrastructure/docker/keycloak/realm-inno-one.json"
realm = json.loads(REALM_PATH.read_text())

KEYCLOAK = "http://localhost:8080/realms/inno-one"
API = "http://127.0.0.1:5080"


def user_fixture(username: str):
    for user in realm["users"]:
        if user["username"] == username:
            return user
    raise AssertionError(f"missing local fixture user: {username}")


def token_for(username: str) -> str:
    user = user_fixture(username)
    credential = user["credentials"][0]["value"]
    form = urllib.parse.urlencode({
        "client_id": "inno-one-e2e",
        "grant_type": "password",
        "username": username,
        "password": credential,
    }).encode()
    request = urllib.request.Request(
        KEYCLOAK + "/protocol/openid-connect/token",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)["access_token"]


def get(path: str, token: str | None = None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(API + path, headers=headers)
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.status, json.load(response)


def expect_status(path: str, expected: int, token: str | None = None):
    try:
        status, body = get(path, token)
    except urllib.error.HTTPError as error:
        status = error.code
        try:
            body = json.load(error)
        except Exception:
            body = None
    assert status == expected, f"{path}: expected {expected}, got {status}: {body}"
    return body


# Unauthenticated requests must never reach business data.
expect_status("/api/v1/platform/me", 401)

admin_token = token_for("adisai")
admin_profile = expect_status("/api/v1/platform/me", 200, admin_token)
admin_devices = expect_status(
    "/api/v1/devices?page=1&pageSize=25&sort=lastSeenAt&order=desc",
    200,
    admin_token,
)

assert admin_profile["data"]["email"] == "adisai@inno.local"
assert "devices.view" in admin_profile["data"]["permissions"]
assert admin_devices["totalItems"] == 4

search_result = expect_status(
    "/api/v1/devices?page=1&pageSize=25&search=NOTEBOOK-IT-003",
    200,
    admin_token,
)
assert search_result["totalItems"] == 1
assert search_result["items"][0]["name"] == "NOTEBOOK-IT-003"

offline_result = expect_status(
    "/api/v1/devices?page=1&pageSize=25&status=offline",
    200,
    admin_token,
)
assert offline_result["totalItems"] == 1
assert offline_result["items"][0]["name"] == "VM-FIN-02"

os_result = expect_status(
    "/api/v1/devices?page=1&pageSize=25&os=Windows%20Server",
    200,
    admin_token,
)
assert os_result["totalItems"] == 1
assert os_result["items"][0]["name"] == "SRV-APP-01"

paged = expect_status(
    "/api/v1/devices?page=1&pageSize=2&sort=name&order=asc",
    200,
    admin_token,
)
assert paged["totalItems"] == 4
assert paged["totalPages"] == 2
assert len(paged["items"]) == 2

by_name = {item["name"]: item for item in admin_devices["items"]}
assert {"DESKTOP-HR-014", "NOTEBOOK-IT-003", "SRV-APP-01", "VM-FIN-02"} == set(by_name)

detail = expect_status(
    "/api/v1/devices/" + by_name["DESKTOP-HR-014"]["id"],
    200,
    admin_token,
)
assert detail["data"]["managementEngine"] == "MeshCentral"
serialized_detail = json.dumps(detail).lower()
assert "externalid" not in serialized_detail
assert "mesh-step15" not in serialized_detail

offline = expect_status(
    "/api/v1/devices/" + by_name["VM-FIN-02"]["id"],
    200,
    admin_token,
)
assert offline["data"]["isOffline"] is True

# Second local identity proves that authorization is resource-scope filtered server-side.
hr_token = token_for("hr.viewer")
hr_profile = expect_status("/api/v1/platform/me", 200, hr_token)
hr_devices = expect_status(
    "/api/v1/devices?page=1&pageSize=25&sort=lastSeenAt&order=desc",
    200,
    hr_token,
)

assert hr_profile["data"]["email"] == "hr.viewer@inno.local"
assert hr_profile["data"]["permissions"] == ["devices.view", "platform.workspace.access"]
assert hr_devices["totalItems"] == 1
assert [item["name"] for item in hr_devices["items"]] == ["DESKTOP-HR-014"]

expect_status(
    "/api/v1/devices/" + by_name["NOTEBOOK-IT-003"]["id"],
    403,
    hr_token,
)
expect_status(
    "/api/v1/devices/dev_ffffffffffffffffffffffffffffffff",
    404,
    admin_token,
)

print("unauthenticated=401")
print("admin_profile=ok")
print("admin_devices=4")
print("search_filter=ok")
print("status_filter=ok")
print("os_filter=ok")
print("pagination=ok")
print("offline_cache=ok")
print("vendor_external_id_hidden=ok")
print("hr_scope_devices=1")
print("out_of_scope_detail=403")
print("missing_resource=404")
print("step15_local_smoke=PASS")
