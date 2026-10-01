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
check("implementation 0.32.0", health["implementationContract"] == "0.32.0", str(health))

admin = token("adisai")
viewer = token("hr.viewer")

status, listed, _ = get("/devices/inventory-queries", admin)
check("saved query collection readable", status == 200, str(listed))
check("saved query collection shape", isinstance(listed.get("items"), list), str(listed))

invalid = {
    "factType": "process",
    "field": "name",
    "operator": "contains",
    "value": "chrome",
    "scopeType": "all",
    "scopeId": None,
}
status, invalid_body, _ = post("/devices/inventory-queries/runs", admin, invalid)
check("unsupported fact type rejected", status == 400, str(invalid_body))

definition = {
    "factType": "software",
    "field": "name",
    "operator": "contains",
    "value": "INNO.One Endpoint Agent",
    "scopeType": "all",
    "scopeId": None,
}
query_name = "Step43 QA " + uuid.uuid4().hex[:8]
status, saved, _ = post(
    "/devices/inventory-queries",
    admin,
    {"name": query_name, **definition},
)
check("saved query created", status == 201, str(saved))
saved_query = saved["data"]
saved_id = saved_query["id"]
check("saved query id opaque", saved_id.startswith("iq_"), saved_id)
check("saved query definition preserved", saved_query["definition"]["factType"] == "software", str(saved_query))

status, searched, _ = get(
    "/devices/inventory-queries?search=" + urllib.parse.quote(query_name),
    admin,
)
check("saved query searchable", status == 200, str(searched))
check(
    "saved query appears in collection",
    any(item["id"] == saved_id for item in searched["items"]),
    str(searched),
)

status, viewer_save, _ = post(
    "/devices/inventory-queries",
    viewer,
    {"name": "Viewer forbidden " + uuid.uuid4().hex[:6], **definition},
)
check("save requires devices manage", status == 403, str(viewer_save))

status, accepted, headers = post(
    "/devices/inventory-queries/runs",
    admin,
    {"savedQueryId": saved_id},
)
check("inventory query accepted", status == 202, str(accepted))
operation_id = accepted["operationId"]
run_id = accepted["resource"]["runId"]
status_url = accepted["statusUrl"]
check("operation id opaque", operation_id.startswith("op_"), operation_id)
check("run id opaque", run_id.startswith("iqr_"), run_id)
check("accepted references saved query", accepted["resource"]["savedQueryId"] == saved_id, str(accepted))
check("canonical operation url", status_url == "/api/v1/operations/" + operation_id, status_url)
location = headers.get("Location") or headers.get("location")
check("location is operation url", location == status_url, str(headers))

status, initial, _ = get("/operations/" + operation_id, admin)
check("operation owner can read", status == 200, str(initial))
initial = initial["data"]
check("inventory operation type", initial["operationType"] == "devices.inventory_query", str(initial))
check("inventory origin module", initial["originModule"] == "devices", str(initial))

status, foreign, _ = get("/operations/" + operation_id, viewer)
check("foreign operation hidden", status == 404, str(foreign))
status, anonymous, _ = get("/operations/" + operation_id)
check("operation requires auth", status in {401, 403}, str(anonymous))

deadline = time.time() + 25
final = initial
while time.time() < deadline:
    status, payload, _ = get("/operations/" + operation_id, admin)
    check("poll operation response", status == 200, str(payload))
    final = payload["data"]
    if final["status"] in {"succeeded", "failed", "partial"}:
        break
    time.sleep(0.35)

check("operation reaches succeeded", final["status"] == "succeeded", str(final))
check("operation progress complete", final["progress"] == 100, str(final))
check("operation has no error", final.get("errorCode") is None, str(final))

status, results, _ = get(
    "/devices/inventory-queries/runs/" + run_id + "/results?page=1&pageSize=50",
    admin,
)
check("materialized results readable", status == 200, str(results))
check("results belong to completed run", results["totalItems"] >= 1, str(results))
check("results page has rows", len(results["items"]) >= 1, str(results))
first = results["items"][0]
check("result device opaque id", first["deviceId"].startswith("dev_"), str(first))
check("result fact is software", first["factType"] == "software", str(first))
check("result has evidence timestamp", bool(first["observedAt"]), str(first))
check(
    "result matches endpoint agent",
    "INNO.One Endpoint Agent".lower() in first["factName"].lower(),
    str(first),
)

status, foreign_results, _ = get(
    "/devices/inventory-queries/runs/" + run_id + "/results",
    viewer,
)
check("foreign run results hidden", status == 404, str(foreign_results))

print("step43_runtime_saved_query=" + saved_id)
print("step43_runtime_run=" + run_id)
print("step43_runtime_operation=" + operation_id)
print("step43_runtime_matches=" + str(results["totalItems"]))
print("step43_runtime_checks=" + str(len(checks)))
print("step43_runtime_qa=PASS")
