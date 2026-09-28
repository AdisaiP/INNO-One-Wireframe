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

admin_token = token("adisai")
viewer_token = token("hr.viewer")

status, _, admin_profile = get("/platform/me", admin_token)
check("admin profile", status == 200, str(status))
admin_permissions = set(admin_profile["data"]["permissions"])
for permission in (
    "platform.apps.view",
    "admin.apps.view",
    "admin.apps.manage",
):
    check(
        "admin permission " + permission,
        permission in admin_permissions,
    )

status, _, launcher = get("/platform/apps", admin_token)
check("admin launcher status", status == 200, str(status))
launcher_ids = {item["id"] for item in launcher["items"]}
check(
    "admin launcher installed modules",
    {"devices", "assets", "helpdesk"} <= launcher_ids,
    str(sorted(launcher_ids)),
)
check(
    "admin launcher excludes unavailable modules",
    "meeting" not in launcher_ids and "reports" not in launcher_ids,
    str(sorted(launcher_ids)),
)

status, _, admin_apps = get("/admin/apps", admin_token)
check("admin registry status", status == 200, str(status))
apps = app_map(admin_apps)
check("admin registry five modules", len(apps) == 5, str(sorted(apps)))
check("meeting not installed", apps["meeting"]["status"] == "not-installed")
check("reports not installed", apps["reports"]["status"] == "not-installed")
check(
    "assets depends devices",
    "devices" in apps["assets"]["dependencies"],
    str(apps["assets"]["dependencies"]),
)
check(
    "helpdesk depends assets",
    "assets" in apps["helpdesk"]["dependencies"],
    str(apps["helpdesk"]["dependencies"]),
)
check(
    "reports depends helpdesk",
    "helpdesk" in apps["reports"]["dependencies"],
    str(apps["reports"]["dependencies"]),
)
status, _, viewer_profile = get("/platform/me", viewer_token)
check("viewer profile", status == 200, str(status))
viewer_permissions = set(viewer_profile["data"]["permissions"])
check("viewer app launcher permission", "platform.apps.view" in viewer_permissions)
check("viewer no admin permission", "admin.apps.view" not in viewer_permissions)

status, _, viewer_launcher = get("/platform/apps", viewer_token)
check("viewer launcher status", status == 200, str(status))
viewer_ids = {item["id"] for item in viewer_launcher["items"]}
check(
    "viewer launcher subset",
    viewer_ids <= launcher_ids,
    str(sorted(viewer_ids)),
)

status, _, _ = get("/admin/apps", viewer_token)
check("viewer registry denied", status == 403, str(status))

status, _, problem = patch(
    "/admin/apps/assets",
    admin_token,
    {"enabled": False},
    apps["assets"]["eTag"],
)
check("assets dependency conflict", status == 409, str(problem))
status, _, problem = patch(
    "/admin/apps/devices",
    admin_token,
    {"enabled": False},
    apps["devices"]["eTag"],
)
check("devices dependency conflict", status == 409, str(problem))

status, _, problem = patch(
    "/admin/apps/meeting",
    admin_token,
    {"enabled": True},
)
check("not-installed enable blocked", status == 409, str(problem))

target = apps["helpdesk"]
original_enabled = target["enabled"]
original_etag = target["eTag"]
mutated = False

try:
    status, headers, response = patch(
        "/admin/apps/helpdesk",
        admin_token,
        {"enabled": not original_enabled},
        original_etag,
    )
    check("availability mutation", status == 200, str(response))
    mutated = True
    check("mutation emits etag", bool(headers.get("ETag")), str(headers))

    status, _, stale_problem = patch(
        "/admin/apps/helpdesk",
        admin_token,
        {"enabled": original_enabled},
        original_etag,
    )
    check("stale etag rejected", status == 412, str(stale_problem))

    status, _, launcher_after = get("/platform/apps", admin_token)
    check("launcher after mutation", status == 200, str(status))
    after_ids = {item["id"] for item in launcher_after["items"]}
    if original_enabled:
        check("disabled module hidden", "helpdesk" not in after_ids, str(sorted(after_ids)))
    else:
        check("enabled module visible", "helpdesk" in after_ids, str(sorted(after_ids)))
finally:
    if mutated:
        status, _, current_apps = get("/admin/apps", admin_token)
        if status == 200:
            current = app_map(current_apps)["helpdesk"]
            if current["enabled"] != original_enabled:
                restore_status, _, restore_payload = patch(
                    "/admin/apps/helpdesk",
                    admin_token,
                    {"enabled": original_enabled},
                    current["eTag"],
                )
                check("restore helpdesk state", restore_status == 200, str(restore_payload))

status, _, final_launcher = get("/platform/apps", admin_token)
check("final launcher status", status == 200, str(status))
final_ids = {item["id"] for item in final_launcher["items"]}
check("helpdesk restored", ("helpdesk" in final_ids) == original_enabled, str(sorted(final_ids)))

print(f"step30_runtime_checks={len(checks)}")
print("step30_runtime_qa=PASS")
