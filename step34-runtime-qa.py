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
check("admin security view permission", "admin.security.view" in admin_permissions)
check("admin security manage permission", "admin.security.manage" in admin_permissions)

status, _, security = get("/admin/security", admin_token)
check("security status", status == 200, str(security))
check("security deployment managed", security["configurationMode"] == "deployment-managed", str(security))
check("security mutable policies false", security["mutablePolicies"] is False, str(security))
check("security providers count", security["summary"]["providers"] == 3, str(security))
check("security provider items count", len(security["items"]) == 3, str(security))

providers = {item["id"]: item for item in security["items"]}
check("identity provider present", "identity" in providers, str(providers.keys()))
check("platform provider present", "platform-controls" in providers, str(providers.keys()))
check("remote provider present", "remote-management" in providers, str(providers.keys()))

def controls(provider_id):
    return {item["id"]: item for item in providers[provider_id]["controls"]}

identity = controls("identity")
for control_id in (
    "identity.authority.transport",
    "identity.metadata.https",
    "identity.api.audience",
    "identity.discovery",
    "identity.issuer.match",
    "identity.authorization-code",
    "identity.pkce.s256",
):
    check("identity control " + control_id, control_id in identity, str(identity.keys()))

platform = controls("platform-controls")
for control_id in (
    "platform.security-permissions",
    "platform.admin-role",
    "platform.audit-ledger",
    "platform.authorization-model",
):
    check("platform control " + control_id, control_id in platform, str(platform.keys()))

remote = controls("remote-management")
for control_id in (
    "remote-management.enabled",
    "remote-management.transport",
    "remote-management.tls-validation",
    "remote-management.credentials",
):
    check("remote control " + control_id, control_id in remote, str(remote.keys()))

check(
    "dev runtime reports attention",
    security["summary"]["attention"] >= 1,
    str(security["summary"]),
)
check(
    "identity discovery reachable",
    identity["identity.discovery"]["status"] == "healthy",
    str(identity["identity.discovery"]),
)
check(
    "pkce s256 advertised",
    identity["identity.pkce.s256"]["status"] == "healthy",
    str(identity["identity.pkce.s256"]),
)
check(
    "authorization code advertised",
    identity["identity.authorization-code"]["status"] == "healthy",
    str(identity["identity.authorization-code"]),
)
check(
    "platform permission catalog healthy",
    platform["platform.security-permissions"]["status"] == "healthy",
    str(platform["platform.security-permissions"]),
)
check(
    "platform admin grants healthy",
    platform["platform.admin-role"]["status"] == "healthy",
    str(platform["platform.admin-role"]),
)
check(
    "audit ledger healthy",
    platform["platform.audit-ledger"]["status"] == "healthy",
    str(platform["platform.audit-ledger"]),
)

serialized = json.dumps(security).lower()
for forbidden in (
    "inno_dev_only",
    "inno_mesh_dev_only",
    '"password"',
    '"secret"',
    "client_secret",
):
    check("security hides " + forbidden, forbidden not in serialized, serialized)

status, _, viewer_profile = get("/platform/me", viewer_token)
check("viewer profile", status == 200, str(status))
viewer_permissions = set(viewer_profile["data"]["permissions"])
check("viewer lacks security permission", "admin.security.view" not in viewer_permissions)

status, _, denied = get("/admin/security", viewer_token)
check("viewer denied security", status == 403, str(denied))

print(f"step34_runtime_checks={len(checks)}")
print("step34_runtime_qa=PASS")
