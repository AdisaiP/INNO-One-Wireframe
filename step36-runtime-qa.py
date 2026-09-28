import json
import os
import sys
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
    print(f"PASS {name}")

def http(method, url, token=None, body=None, headers=None):
    request_headers = {"Accept": "application/json"}
    if token:
        request_headers["Authorization"] = "Bearer " + token
    if headers:
        request_headers.update(headers)
    data = None
    if body is not None:
        request_headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers=request_headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return response.status, dict(response.headers), payload
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return error.code, dict(error.headers), payload

def realm_user_password(username):
    realm = json.loads(REALM_PATH.read_text(encoding="utf-8"))
    user = next(item for item in realm["users"] if item["username"] == username)
    return user["credentials"][0]["value"]
def token(username):
    form = urllib.parse.urlencode({
        "grant_type": "password",
        "client_id": "inno-one-e2e",
        "username": username,
        "password": realm_user_password(username),
    }).encode("utf-8")
    request = urllib.request.Request(
        KEYCLOAK_BASE + "/realms/inno-one/protocol/openid-connect/token",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)["access_token"]

def get(path, access_token):
    return http("GET", API_BASE + path, token=access_token)

def patch(path, access_token, body, etag=None):
    headers = {}
    if etag:
        headers["If-Match"] = etag
    return http(
        "PATCH",
        API_BASE + path,
        token=access_token,
        body=body,
        headers=headers,
    )
def app_map(payload):
    return {item["id"]: item for item in payload["items"]}


def put(path, access_token, body, etag=None):
    headers = {}
    if etag:
        headers["If-Match"] = etag
    return http("PUT", API_BASE + path, token=access_token, body=body, headers=headers)

def post(path, access_token, body):
    return http("POST", API_BASE + path, token=access_token, body=body)






admin_token = token("adisai")
viewer_token = token("hr.viewer")

status, _, admin_profile = get("/platform/me", admin_token)
check("admin profile", status == 200, str(status))
admin_permissions = set(admin_profile["data"]["permissions"])
check("admin settings permission", "admin.settings.manage" in admin_permissions)

status, _, settings = get("/admin/settings", admin_token)
check("settings status", status == 200, str(settings))
check(
    "settings configuration mode",
    settings["configurationMode"] == "contract-and-deployment-managed",
    str(settings),
)
check("settings read only", settings["mutableSettings"] is False, str(settings))
check("settings environment", settings["environment"] == "Development", str(settings))
check("settings groups", set(settings["groups"]) == {"API", "Time", "Runtime", "Contracts"}, str(settings["groups"]))
check("settings item count", len(settings["items"]) == 14, str(len(settings["items"])))

items = {item["id"]: item for item in settings["items"]}
expected = {
    "api.base-path": "/api/v1",
    "api.authentication": "Bearer JWT",
    "api.authorization": "Permission + resource scope",
    "api.pagination": "Page-number pagination",
    "api.errors": "application/problem+json",
    "api.concurrency": "ETag / If-Match",
    "time.transport": "ISO 8601 with timezone",
    "runtime.environment": "Development",
    "contracts.design-system": "V1.26",
    "contracts.ui": "1.20.0",
    "contracts.api": "0.5.0",
    "contracts.event-audit": "0.5.0",
    "contracts.data-model": "0.6.0",
    "contracts.implementation": "0.26.0",
}
check("settings ids exact", set(items) == set(expected), str(sorted(items)))
for setting_id, value in expected.items():
    check(
        "settings value " + setting_id,
        items[setting_id]["value"] == value,
        str(items[setting_id]),
    )

check(
    "frozen settings statuses",
    all(
        item["status"] == "frozen"
        for item in settings["items"]
        if item["id"] not in {"runtime.environment", "contracts.implementation"}
    ),
    str(settings["items"]),
)
check(
    "effective settings statuses",
    items["runtime.environment"]["status"] == "effective"
    and items["contracts.implementation"]["status"] == "effective",
    str(settings["items"]),
)

serialized = json.dumps(settings).lower()
for forbidden in (
    "inno_dev_only",
    "inno_mesh_dev_only",
    '"password"',
    '"secret"',
    "connectionstring",
    "connection string",
    "meshcentral:password",
    "authentication:authority",
):
    check("settings hides " + forbidden, forbidden not in serialized, serialized)

status, _, viewer_profile = get("/platform/me", viewer_token)
check("viewer profile", status == 200, str(status))
viewer_permissions = set(viewer_profile["data"]["permissions"])
check("viewer lacks settings permission", "admin.settings.manage" not in viewer_permissions)

status, _, denied = get("/admin/settings", viewer_token)
check("viewer denied settings", status == 403, str(denied))

print(f"step36_runtime_checks={len(checks)}")
print("step36_runtime_qa=PASS")
