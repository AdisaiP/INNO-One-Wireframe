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
    "admin.organization.view",
    "admin.organization.manage",
    "admin.locations.view",
    "admin.locations.manage",
    "admin.positions.view",
    "admin.positions.manage",
    "admin.users.view",
    "admin.users.manage",
    "admin.roles.view",
    "admin.roles.manage",
    "admin.access_scopes.view",
    "admin.access_scopes.manage",
    "admin.access_scopes.evaluate",
    "admin.apps.view",
):
    check("admin permission " + permission, permission in admin_permissions)

for path, label in (
    ("/admin/overview", "overview"),
    ("/admin/organization/tree", "organization"),
    ("/admin/locations/tree", "locations"),
    ("/admin/positions", "positions"),
    ("/admin/users?page=1&pageSize=25", "users"),
    ("/admin/roles", "roles"),
    ("/admin/permissions", "permissions"),
    ("/admin/access-assignments", "access assignments"),
):
    status, _, payload = get(path, admin_token)
    check(label + " status", status == 200, str(payload))

status, _, overview = get("/admin/overview", admin_token)
check(
    "overview counts",
    all(overview["data"][key] >= 1 for key in (
        "organizations", "locations", "positions", "users", "roles", "accessAssignments"
    )),
    str(overview),
)

status, _, orgs = get("/admin/organization/tree", admin_token)
check("organization nonempty", len(orgs["items"]) > 0, str(orgs))
org = orgs["items"][0]

status, _, locations = get("/admin/locations/tree", admin_token)
check("locations nonempty", len(locations["items"]) > 0, str(locations))

status, _, positions = get("/admin/positions", admin_token)
check("positions nonempty", len(positions["items"]) > 0, str(positions))

status, _, users = get("/admin/users?page=1&pageSize=25", admin_token)
check("users nonempty", len(users["items"]) > 0, str(users))
user = users["items"][0]
status, _, user_detail = get("/admin/users/" + user["id"], admin_token)
check("user detail", status == 200, str(user_detail))

status, _, roles = get("/admin/roles", admin_token)
check("roles nonempty", len(roles["items"]) > 0, str(roles))
status, _, permissions = get("/admin/permissions", admin_token)
check("permissions nonempty", len(permissions["items"]) > 0, str(permissions))

status, _, assignments = get("/admin/access-assignments", admin_token)
check("assignments nonempty", len(assignments["items"]) > 0, str(assignments))
assignment = assignments["items"][0]
status, _, assignment_detail = get(
    "/admin/access-assignments/" + assignment["id"],
    admin_token,
)
check("assignment detail", status == 200, str(assignment_detail))

# Same-value writes prove ETag concurrency without changing business meaning.
org_body = {
    "code": org["code"],
    "name": org["name"],
    "parentId": org.get("parentId"),
    "status": org["status"],
}
status, _, updated_org = put(
    "/admin/organization/units/" + org["id"],
    admin_token,
    org_body,
    org["eTag"],
)
check("organization same-value update", status == 200, str(updated_org))
status, _, stale_org = put(
    "/admin/organization/units/" + org["id"],
    admin_token,
    org_body,
    org["eTag"],
)
check("organization stale etag", status == 412, str(stale_org))

assignment_data = assignment_detail["data"]
assignment_body = {
    "roleId": assignment_data["roleId"],
    "scopeType": assignment_data["scopeType"],
    "resourceIds": [resource["id"] for resource in assignment_data["resources"]],
    "includeChildren": assignment_data["includeChildren"],
    "actionOverrides": assignment_data["actionOverrides"],
    "status": assignment_data["status"],
}
status, _, updated_assignment = put(
    "/admin/access-assignments/" + assignment_data["id"],
    admin_token,
    assignment_body,
    assignment_data["eTag"],
)
check("assignment same-value update", status == 200, str(updated_assignment))
status, _, stale_assignment = put(
    "/admin/access-assignments/" + assignment_data["id"],
    admin_token,
    assignment_body,
    assignment_data["eTag"],
)
check("assignment stale etag", status == 412, str(stale_assignment))

status, _, evaluation = post(
    "/admin/access-scopes/evaluate",
    admin_token,
    {"userId": admin_profile["data"]["id"], "permission": "admin.access"},
)
check("evaluate access status", status == 200, str(evaluation))
check("evaluate admin allowed", evaluation["data"]["allowed"] is True, str(evaluation))

status, _, viewer_profile = get("/platform/me", viewer_token)
check("viewer profile", status == 200, str(status))
viewer_permissions = set(viewer_profile["data"]["permissions"])
check("viewer lacks admin access", "admin.access" not in viewer_permissions)

for path in (
    "/admin/overview",
    "/admin/users?page=1&pageSize=25",
    "/admin/roles",
    "/admin/access-assignments",
):
    status, _, payload = get(path, viewer_token)
    check("viewer denied " + path.split("?")[0], status == 403, str(payload))

print(f"step31_runtime_checks={len(checks)}")
print("step31_runtime_qa=PASS")
