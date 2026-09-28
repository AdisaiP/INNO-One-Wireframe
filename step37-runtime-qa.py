import json
import os
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
    print("PASS " + name)

def http(method, url, token=None, body=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return error.code, payload

def realm_password(username):
    realm = json.loads(REALM_PATH.read_text(encoding="utf-8"))
    user = next(item for item in realm["users"] if item["username"] == username)
    return user["credentials"][0]["value"]

def token(username):
    form = urllib.parse.urlencode({
        "grant_type": "password",
        "client_id": "inno-one-e2e",
        "username": username,
        "password": realm_password(username),
    }).encode("utf-8")
    req = urllib.request.Request(
        KEYCLOAK_BASE + "/realms/inno-one/protocol/openid-connect/token",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)["access_token"]

def api(method, path, access_token, body=None):
    return http(method, API_BASE + path, access_token, body)

status, health = http("GET", API_BASE.removesuffix("/api/v1") + "/health/ready")
check("health ready", status == 200, str(health))
check("implementation 0.27.0", health["implementationContract"] == "0.27.0", str(health))

admin = token("adisai")
viewer = token("hr.viewer")

status, profile = api("GET", "/platform/me", admin)
check("admin profile", status == 200, str(profile))
check("admin notification permission", "platform.notifications.view" in profile["data"]["permissions"], str(profile))

status, viewer_profile = api("GET", "/platform/me", viewer)
check("viewer profile", status == 200, str(viewer_profile))
check("viewer notification permission", "platform.notifications.view" in viewer_profile["data"]["permissions"], str(viewer_profile))

status, admin_list = api("GET", "/platform/notifications?page=1&pageSize=25", admin)
check("admin list status", status == 200, str(admin_list))
check("admin list count", admin_list["allCount"] == 5 and len(admin_list["items"]) == 5, str(admin_list))
check("admin unread baseline", admin_list["unreadCount"] == 2, str(admin_list))
check("admin important baseline", admin_list["importantCount"] == 3, str(admin_list))
check("admin self destinations", all(item["destinationPath"].startswith("/") for item in admin_list["items"]), str(admin_list))
check("admin expected modules", {x["sourceModule"] for x in admin_list["items"]} == {"devices", "helpdesk", "assets"}, str(admin_list))

status, unread = api("GET", "/platform/notifications?state=unread", admin)
check("unread filter status", status == 200, str(unread))
check("unread filter exact", unread["totalItems"] == 2 and all(not x["isRead"] for x in unread["items"]), str(unread))

status, invalid = api("GET", "/platform/notifications?state=invalid", admin)
check("invalid state rejected", status == 400, str(invalid))

status, viewer_list = api("GET", "/platform/notifications", viewer)
check("viewer list status", status == 200, str(viewer_list))
check("viewer self isolation", viewer_list["allCount"] == 1 and len(viewer_list["items"]) == 1, str(viewer_list))
admin_ids = {x["id"] for x in admin_list["items"]}
viewer_id = viewer_list["items"][0]["id"]
check("viewer id isolated", viewer_id not in admin_ids, viewer_id)

first_unread = next(x for x in admin_list["items"] if not x["isRead"])
status, changed = api("PATCH", "/platform/notifications/" + first_unread["id"], admin, {"isRead": True})
check("mark one read", status == 200 and changed["isRead"] is True, str(changed))

status, denied_cross = api("PATCH", "/platform/notifications/" + viewer_id, admin, {"isRead": True})
check("admin cannot mutate viewer", status == 404, str(denied_cross))

status, denied_cross_2 = api("PATCH", "/platform/notifications/" + first_unread["id"], viewer, {"isRead": True})
check("viewer cannot mutate admin", status == 404, str(denied_cross_2))

status, marked = api("POST", "/platform/notifications/mark-all-read", admin)
check("mark all status", status == 200, str(marked))
check("mark all updates remaining", marked["updatedCount"] == 1, str(marked))

status, after = api("GET", "/platform/notifications", admin)
check("all read after mark all", status == 200 and after["unreadCount"] == 0, str(after))

baseline_unread_ids = [
    x["id"] for x in admin_list["items"]
    if x["title"] in {
        "PC-FIN-021 is offline longer than expected",
        "HD-2026-001048 assigned to you",
    }
]
for notification_id in baseline_unread_ids:
    status, restored = api("PATCH", "/platform/notifications/" + notification_id, admin, {"isRead": False})
    check("restore unread " + notification_id[-6:], status == 200 and restored["isRead"] is False, str(restored))

status, restored_list = api("GET", "/platform/notifications", admin)
check("baseline restored", restored_list["unreadCount"] == 2, str(restored_list))

status, malformed = api("PATCH", "/platform/notifications/not-a-valid-id", admin, {"isRead": True})
check("malformed id not found", status == 404, str(malformed))

print("step37_runtime_checks=" + str(len(checks)))
print("step37_runtime_qa=PASS")
