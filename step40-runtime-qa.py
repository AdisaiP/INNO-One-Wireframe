import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_BASE = os.environ.get("INNO_API_BASE", "http://127.0.0.1:5080/api/v1")
KEYCLOAK_BASE = os.environ.get("INNO_KEYCLOAK_BASE", "http://172.10.1.58:8080")
REALM_PATH = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
checks = []

def check(name, condition, detail=""):
    if not condition:
        raise AssertionError(f"{name}: {detail}")
    checks.append(name)
    print("PASS " + name)

def http(method, url, token=None, payload=None):
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = "Bearer " + token
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            body = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            body = raw
        return error.code, body

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
def get(path, access_token):
    return http("GET", API_BASE + path, access_token)

def patch(path, access_token, payload):
    return http("PATCH", API_BASE + path, access_token, payload)

status, health = http("GET", API_BASE.removesuffix("/api/v1") + "/health/ready")
check("health ready", status == 200, str(health))
check("implementation 0.30.0", health["implementationContract"] == "0.30.0", str(health))

admin = token("adisai")
viewer = token("hr.viewer")

status, admin_before = get("/platform/me", admin)
check("admin profile", status == 200, str(admin_before))
admin_before = admin_before["data"]
check("workspace permission", "platform.workspace.access" in admin_before["permissions"], str(admin_before))

status, viewer_before = get("/platform/me", viewer)
check("viewer profile", status == 200, str(viewer_before))
viewer_before = viewer_before["data"]

status, unauthorized = http("PATCH", API_BASE + "/platform/me/profile", payload={"phone": "x"})
check("profile patch requires auth", status in {401, 403}, str(unauthorized))

status, empty = patch("/platform/me/profile", admin, {})
check("empty profile patch rejected", status == 400, str(empty))

status, invalid = patch("/platform/me/profile", admin, {"phone": "x" * 65})
check("long phone rejected", status == 400, str(invalid))
status, forbidden_field = patch(
    "/platform/me/profile",
    admin,
    {"fullName": "Should Not Change"},
)
check("organization-managed field rejected", status == 400, str(forbidden_field))

admin_test = {"phone": "02-STEP40-QA", "office": "Step40 QA Office"}
viewer_test = {"phone": "02-VIEWER-QA", "office": "Step40 Viewer Office"}

try:
    status, updated = patch("/platform/me/profile", admin, admin_test)
    check("admin profile patch status", status == 200, str(updated))
    updated = updated["data"]
    check("admin phone updated", updated["phone"] == admin_test["phone"], str(updated))
    check("admin office updated", updated["office"] == admin_test["office"], str(updated))
    check("admin identity unchanged", updated["fullName"] == admin_before["fullName"] and updated["email"] == admin_before["email"], str(updated))

    status, reread = get("/platform/me", admin)
    check("admin persisted reread", status == 200, str(reread))
    reread = reread["data"]
    check("admin persisted phone", reread["phone"] == admin_test["phone"], str(reread))
    check("admin persisted office", reread["office"] == admin_test["office"], str(reread))

    status, viewer_updated = patch("/platform/me/profile", viewer, viewer_test)
    check("viewer profile patch status", status == 200, str(viewer_updated))
    viewer_updated = viewer_updated["data"]
    check("viewer self update", viewer_updated["office"] == viewer_test["office"], str(viewer_updated))

    status, admin_after_viewer = get("/platform/me", admin)
    check("viewer cannot alter admin", admin_after_viewer["data"]["office"] == admin_test["office"], str(admin_after_viewer))
finally:
    admin_restore = {
        "phone": admin_before.get("phone") or "",
        "office": admin_before.get("office") or "",
    }
    viewer_restore = {
        "phone": viewer_before.get("phone") or "",
        "office": viewer_before.get("office") or "",
    }
    status, restored_admin = patch("/platform/me/profile", admin, admin_restore)
    check("admin restored", status == 200, str(restored_admin))
    check(
        "admin restore values",
        (restored_admin["data"].get("phone") or "") == admin_restore["phone"]
        and (restored_admin["data"].get("office") or "") == admin_restore["office"],
        str(restored_admin),
    )
    status, restored_viewer = patch("/platform/me/profile", viewer, viewer_restore)
    check("viewer restored", status == 200, str(restored_viewer))
    check(
        "viewer restore values",
        (restored_viewer["data"].get("phone") or "") == viewer_restore["phone"]
        and (restored_viewer["data"].get("office") or "") == viewer_restore["office"],
        str(restored_viewer),
    )

print("step40_runtime_checks=" + str(len(checks)))
print("step40_runtime_qa=PASS")
