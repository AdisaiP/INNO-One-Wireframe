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
for permission in (
    "admin.access",
    "admin.integrations.view",
    "admin.integrations.manage",
):
    check("admin permission " + permission, permission in admin_permissions)

status, _, integrations = get("/admin/integrations", admin_token)
check("integration registry status", status == 200, str(integrations))
items = {item["id"]: item for item in integrations["items"]}
check(
    "integration registry providers",
    set(items) == {"core-database", "keycloak", "meshcentral"},
    str(sorted(items)),
)

valid_statuses = {"connected", "degraded", "disabled", "not-configured"}
for integration_id, item in items.items():
    check(integration_id + " status valid", item["status"] in valid_statuses, str(item))
    check(integration_id + " checkedAt", bool(item["checkedAt"]), str(item))
    check(integration_id + " capabilities", bool(item["capabilities"]), str(item))
    check(integration_id + " endpoint present", bool(item["endpoint"]), str(item))
    serialized = json.dumps(item).lower()
    for forbidden in (
        "inno_dev_only",
        "inno_mesh_dev_only",
        "password=",
        "username=",
        '"password"',
        '"secret"',
    ):
        check(
            integration_id + " hides " + forbidden,
            forbidden not in serialized,
            serialized,
        )

check(
    "core database connected",
    items["core-database"]["status"] == "connected",
    str(items["core-database"]),
)
check(
    "keycloak connected",
    items["keycloak"]["status"] == "connected",
    str(items["keycloak"]),
)
check(
    "meshcentral registered",
    items["meshcentral"]["configured"] is True,
    str(items["meshcentral"]),
)

for integration_id in ("core-database", "keycloak", "meshcentral"):
    item = items[integration_id]
    if item["canTest"]:
        status, _, tested = post(
            "/admin/integrations/" + integration_id + "/test",
            admin_token,
            None,
        )
        check(integration_id + " test status", status == 200, str(tested))
        check(
            integration_id + " test identity",
            tested["data"]["id"] == integration_id,
            str(tested),
        )

status, _, missing = post(
    "/admin/integrations/unknown-provider/test",
    admin_token,
    None,
)
check("unknown integration test returns 404", status == 404, str(missing))

status, _, viewer_profile = get("/platform/me", viewer_token)
check("viewer profile", status == 200, str(status))
viewer_permissions = set(viewer_profile["data"]["permissions"])
check(
    "viewer lacks integrations view",
    "admin.integrations.view" not in viewer_permissions,
)

status, _, denied = get("/admin/integrations", viewer_token)
check("viewer integration registry denied", status == 403, str(denied))
status, _, denied = post(
    "/admin/integrations/core-database/test",
    viewer_token,
    None,
)
check("viewer integration test denied", status == 403, str(denied))

print(f"step32_runtime_checks={len(checks)}")
print("step32_runtime_qa=PASS")
