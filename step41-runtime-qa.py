import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
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
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else None, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            body = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            body = raw
        return error.code, body, dict(error.headers)

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
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)["access_token"]

def get(path, access_token=None):
    return http("GET", API_BASE + path, access_token)

def post(path, access_token, payload):
    return http("POST", API_BASE + path, access_token, payload)

status, health, _ = http("GET", API_BASE.removesuffix("/api/v1") + "/health/ready")
check("health ready", status == 200, str(health))
check("implementation 0.31.0", health["implementationContract"] == "0.31.0", str(health))
admin = token("adisai")
viewer = token("hr.viewer")

status, accepted, headers = post(
    "/devices/discovery-scans",
    admin,
    {"ranges": ["127.0.0.1/32"]},
)
check("discovery accepted", status == 202, str(accepted))
operation_id = accepted["operationId"]
scan_id = accepted["resource"]["scanId"]
status_url = accepted["statusUrl"]

check("operation id opaque", operation_id.startswith("op_"), operation_id)
check("scan id opaque", scan_id.startswith("scan_"), scan_id)
check("accepted state queued", accepted["status"] == "queued", str(accepted))
check("canonical status url", status_url == "/api/v1/operations/" + operation_id, status_url)
location = headers.get("Location") or headers.get("location")
check("location points to operation", location == status_url, str(headers))

status, initial, _ = get("/operations/" + operation_id, admin)
check("owner can read operation", status == 200, str(initial))
initial = initial["data"]
check("operation identity", initial["operationId"] == operation_id, str(initial))
check("operation type", initial["operationType"] == "devices.discovery_scan", str(initial))
check("operation module", initial["originModule"] == "devices", str(initial))
check("operation state valid", initial["status"] in {"queued", "running", "succeeded", "failed", "partial"}, str(initial))
check("operation progress bounded", 0 <= initial["progress"] <= 100, str(initial))
check("operation self url", initial["statusUrl"] == status_url, str(initial))

serialized = json.dumps(initial)
for forbidden in (
    "requestedByActorId",
    "requestedByActorType",
    "requiredPermission",
    "permissionContext",
    "resultRef",
    "subjectId",
):
    check("safe payload excludes " + forbidden, forbidden not in serialized, serialized)

status, foreign, _ = get("/operations/" + operation_id, viewer)
check("foreign owner hidden", status == 404, str(foreign))

status, anonymous, _ = get("/operations/" + operation_id)
check("operation requires auth", status in {401, 403}, str(anonymous))
status, malformed, _ = get("/operations/not-an-operation", admin)
check("malformed operation hidden", status == 404, str(malformed))

missing_id = "op_" + str(uuid.uuid4())
status, missing, _ = get("/operations/" + missing_id, admin)
check("missing operation hidden", status == 404, str(missing))

deadline = time.time() + 25
final = initial
while time.time() < deadline:
    status, payload, _ = get("/operations/" + operation_id, admin)
    check("poll status response", status == 200, str(payload))
    final = payload["data"]
    if final["status"] in {"succeeded", "failed", "partial"}:
        break
    time.sleep(0.35)

check("operation reaches terminal", final["status"] == "succeeded", str(final))
check("operation progress complete", final["progress"] == 100, str(final))
check("operation error empty", final.get("errorCode") is None, str(final))
check("operation timestamps ordered", final["updatedAt"] >= final["createdAt"], str(final))

status, scan, _ = get("/devices/discovery-scans/" + scan_id, admin)
check("origin resource readable", status == 200, str(scan))
scan = scan["data"]
check("origin operation linked", scan["operationId"] == operation_id, str(scan))
check("origin state agrees", scan["status"] == final["status"], str(scan))
status, repeated, _ = get("/operations/" + operation_id, admin)
check("terminal read stable", status == 200 and repeated["data"] == final, str(repeated))

print("step41_runtime_operation=" + operation_id)
print("step41_runtime_scan=" + scan_id)
print("step41_runtime_checks=" + str(len(checks)))
print("step41_runtime_qa=PASS")
