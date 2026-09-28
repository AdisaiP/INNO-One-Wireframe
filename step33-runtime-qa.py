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
check("admin audit permission", "admin.audit.view" in admin_permissions)

status, _, audit = get("/admin/audit?page=1&pageSize=10", admin_token)
check("audit list status", status == 200, str(audit))
check("audit list nonempty", len(audit["items"]) > 0, str(audit))
check("audit list page size", len(audit["items"]) <= 10, str(audit))
check("audit total positive", audit["totalItems"] > 0, str(audit))
first = audit["items"][0]

for field in (
    "auditId", "occurredAt", "action", "module", "targetType",
    "targetId", "actorType", "actorId", "classification",
):
    check("audit field " + field, field in first and first[field] not in (None, ""), str(first))

status, _, facets = get("/admin/audit/facets", admin_token)
check("audit facets status", status == 200, str(facets))
check("audit facets modules", len(facets["modules"]) > 0, str(facets))
check("audit facets actions", len(facets["actions"]) > 0, str(facets))
check("audit facets targets", len(facets["targetTypes"]) > 0, str(facets))

status, _, detail = get("/admin/audit/" + first["auditId"], admin_token)
check("audit detail status", status == 200, str(detail))
detail_data = detail["data"]
check("audit detail identity", detail_data["auditId"] == first["auditId"], str(detail_data))
check("audit detail metadata", "metadata" in detail_data, str(detail_data))

status, _, module_filtered = get(
    "/admin/audit?page=1&pageSize=20&module=" + urllib.parse.quote(first["module"]),
    admin_token,
)
check("audit module filter status", status == 200, str(module_filtered))
check(
    "audit module filter exact",
    all(item["module"] == first["module"] for item in module_filtered["items"]),
    str(module_filtered),
)

status, _, action_filtered = get(
    "/admin/audit?page=1&pageSize=20&action=" + urllib.parse.quote(first["action"]),
    admin_token,
)
check("audit action filter status", status == 200, str(action_filtered))
check(
    "audit action filter exact",
    all(item["action"] == first["action"] for item in action_filtered["items"]),
    str(action_filtered),
)

status, _, target_filtered = get(
    "/admin/audit?page=1&pageSize=20&targetType=" + urllib.parse.quote(first["targetType"]),
    admin_token,
)
check("audit target filter status", status == 200, str(target_filtered))
check(
    "audit target filter exact",
    all(item["targetType"] == first["targetType"] for item in target_filtered["items"]),
    str(target_filtered),
)

status, _, actor_filtered = get(
    "/admin/audit?page=1&pageSize=20&actor=" + urllib.parse.quote(first["actorId"][:12]),
    admin_token,
)
check("audit actor filter status", status == 200, str(actor_filtered))
check("audit actor filter nonempty", len(actor_filtered["items"]) > 0, str(actor_filtered))

if first.get("correlationId"):
    status, _, search_filtered = get(
        "/admin/audit?page=1&pageSize=20&search=" + urllib.parse.quote(first["correlationId"]),
        admin_token,
    )
    check("audit correlation search status", status == 200, str(search_filtered))
    check(
        "audit correlation search exact",
        any(item.get("correlationId") == first["correlationId"] for item in search_filtered["items"]),
        str(search_filtered),
    )

status, _, invalid_range = get(
    "/admin/audit?page=1&pageSize=10&from=2026-09-29T00:00:00Z&to=2026-09-28T00:00:00Z",
    admin_token,
)
check("audit invalid date range", status == 400, str(invalid_range))

status, _, missing = get("/admin/audit/aud_00000000000000000000000000000000", admin_token)
check("audit missing detail", status == 404, str(missing))

serialized = json.dumps(detail_data).lower()
for forbidden in ("password=", '"password"', '"secret"', "inno_dev_only", "inno_mesh_dev_only"):
    check("audit detail hides " + forbidden, forbidden not in serialized, serialized)

status, _, viewer_profile = get("/platform/me", viewer_token)
check("viewer profile", status == 200, str(status))
viewer_permissions = set(viewer_profile["data"]["permissions"])
check("viewer lacks audit permission", "admin.audit.view" not in viewer_permissions)

for path in (
    "/admin/audit?page=1&pageSize=10",
    "/admin/audit/facets",
    "/admin/audit/" + first["auditId"],
):
    status, _, denied = get(path, viewer_token)
    check("viewer denied " + path.split("?")[0], status == 403, str(denied))

print(f"step33_runtime_checks={len(checks)}")
print("step33_runtime_qa=PASS")
