from pathlib import Path
import json
import sys
import time
import requests

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step45h-devices-automation-api"
OUT.mkdir(exist_ok=True)
CLEANUP = OUT / "cleanup.json"
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
API = "http://127.0.0.1:5080/api/v1"
TOKEN_URL = "http://172.10.1.58:8080/realms/inno-one/protocol/openid-connect/token"

checks = 0
failures = []

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail else ""))
    if not ok:
        failures.append((name, detail))

realm = json.loads(REALM.read_text(encoding="utf-8"))
user = next(x for x in realm["users"] if x["username"] == "adisai")
password = user["credentials"][0]["value"]
token_response = requests.post(
    TOKEN_URL,
    data={
        "grant_type": "password",
        "client_id": "inno-one-e2e",
        "username": "adisai",
        "password": password,
        "scope": "openid",
    },
    timeout=10,
)
check("E2E token grant succeeds", token_response.status_code == 200, token_response.status_code)
if token_response.status_code != 200:
    print(token_response.text[:500])
    raise SystemExit(1)
token = token_response.json()["access_token"]
headers = {"Authorization": "Bearer " + token}

def request(method, path, *, body=None, extra_headers=None):
    h = dict(headers)
    if extra_headers:
        h.update(extra_headers)
    if body is not None:
        h["Content-Type"] = "application/json"
    response = requests.request(
        method,
        API + path,
        headers=h,
        data=None if body is None else json.dumps(body),
        timeout=15,
    )
    if response.status_code == 204:
        data = None
    else:
        try:
            data = response.json()
        except ValueError:
            data = response.text
    return response.status_code, data

status, profile_envelope = request("GET", "/platform/me")
check("Platform profile returns 200", status == 200, status)
profile = (profile_envelope or {}).get("data", {})
permissions = set(profile.get("permissions", []))
for permission in ("devices.automation.view", "devices.automation.manage", "devices.automation.run.view", "devices.manage"):
    check("Profile has " + permission, permission in permissions)

# Clean only interrupted QA definitions from earlier Step45H API runs.
status, definition_list = request("GET", "/devices/automations?page=1&pageSize=100")
check("Devices automation list returns 200", status == 200, status)
for item in (definition_list or {}).get("items", []):
    if not (item.get("name") or "").startswith("QA Step45H API Rule "):
        continue
    detail_status, detail_envelope = request("GET", "/devices/automations/" + item["id"])
    if detail_status != 200:
        continue
    detail = detail_envelope["data"]
    delete_status, _ = request(
        "DELETE",
        "/devices/automations/" + item["id"],
        extra_headers={"If-Match": detail["eTag"]},
    )
    check("Interrupted QA definition cleanup " + item["id"], delete_status == 204, delete_status)

status, devices_page = request("GET", "/devices?page=1&pageSize=100&sort=lastSeenAt&order=desc")
check("Devices list returns 200", status == 200, status)
status, groups_page = request("GET", "/devices/groups?page=1&pageSize=100&status=active")
check("Device Groups list returns 200", status == 200, status)

devices = (devices_page or {}).get("items", [])
groups = (groups_page or {}).get("items", [])
local_groups = [
    g for g in groups
    if g.get("groupType") == "static"
    and g.get("status") == "active"
    and g.get("syncStatus") == "local"
]
provider_groups = [
    g for g in groups
    if g.get("groupType") == "static"
    and g.get("status") == "active"
    and g.get("syncStatus") != "local"
]

context = None
for device in devices:
    if not device.get("operatingSystem"):
        continue
    if str(device.get("status", "")).lower() not in ("online", "offline"):
        continue
    for group in local_groups:
        member_status, members_page = request(
            "GET",
            "/devices/groups/" + group["id"] + "/members?page=1&pageSize=100",
        )
        if member_status != 200:
            continue
        if not any(x.get("id") == device["id"] for x in members_page.get("items", [])):
            context = {"device": device, "group": group}
            break
    if context:
        break

check("Found safe device + local static group context", context is not None)
if context is None:
    raise SystemExit(1)

device = context["device"]
group = context["group"]
device_id = device["id"]
group_id = group["id"]
trigger = "device.online" if str(device["status"]).lower() == "online" else "device.offline"
opposite_trigger = "device.offline" if trigger == "device.online" else "device.online"
os_value = str(device["operatingSystem"]).split()[0]

CLEANUP.write_text(json.dumps({
    "deviceId": device_id,
    "groupId": group_id,
    "deviceName": device.get("name"),
    "groupName": group.get("name"),
    "membershipExistedBefore": False,
}, indent=2), encoding="utf-8")

name = "QA Step45H API Rule " + str(int(time.time()))
nodes = [
    {
        "id": "when",
        "kind": "trigger",
        "catalogKey": trigger,
        "label": "Device Online" if trigger == "device.online" else "Device Offline",
        "labelKey": "devices.automation.catalog.deviceOnline.label" if trigger == "device.online" else "devices.automation.catalog.deviceOffline.label",
        "description": "Current device state trigger.",
        "descriptionKey": "devices.automation.catalog.deviceOnline.description" if trigger == "device.online" else "devices.automation.catalog.deviceOffline.description",
        "configuration": {
            "condition": {
                "field": "operatingSystem",
                "operator": "contains",
                "value": os_value,
            }
        },
    },
    {
        "id": "then",
        "kind": "action",
        "catalogKey": "devices.device.add_to_group",
        "label": "Add to Group",
        "labelKey": "devices.automation.catalog.addToGroup.label",
        "description": "Adds the device to a local static group.",
        "descriptionKey": "devices.automation.catalog.addToGroup.description",
        "configuration": {"groupId": group_id},
    },
    {
        "id": "end",
        "kind": "end",
        "catalogKey": "workflow.end",
        "label": "End",
        "labelKey": "devices.automation.catalog.end.label",
        "description": "Ends this remediation path.",
        "descriptionKey": "devices.automation.catalog.end.description",
        "configuration": {},
    },
]
edges = [
    {"id": "edge_when_then", "source": "when", "target": "then"},
    {"id": "edge_then_end", "source": "then", "target": "end"},
]

create_status, create_envelope = request(
    "POST",
    "/devices/automations",
    body={"name": name, "nodes": nodes, "edges": edges, "orientation": "horizontal"},
)
check("Create Devices automation returns 201", create_status == 201, create_status)
if create_status != 201:
    print(json.dumps(create_envelope, ensure_ascii=False)[:1500])
    raise SystemExit(1)
definition = create_envelope["data"]
automation_id = definition["id"]
v1_etag = definition["eTag"]
check("Definition owner is devices", definition.get("ownerModule") == "devices", definition.get("ownerModule"))
check("Definition starts at v1", definition.get("version") == 1, definition.get("version"))

status, list_after_create = request("GET", "/devices/automations?page=1&pageSize=100")
check("Persisted definition appears in list", status == 200 and any(x.get("id") == automation_id for x in list_after_create.get("items", [])))

start_status, start_envelope = request(
    "POST",
    "/devices/automations/" + automation_id + "/runs",
    body={"input": {"deviceId": device_id}},
)
check("Matching run queues with 202", start_status == 202, start_status)
if start_status != 202:
    print(json.dumps(start_envelope, ensure_ascii=False)[:1500])
    raise SystemExit(1)
run = start_envelope["data"]
run_id = run["id"]

def wait_run(run_id, timeout=20):
    deadline = time.time() + timeout
    latest = None
    while time.time() < deadline:
        s, e = request("GET", "/devices/automations/" + automation_id + "/runs/" + run_id)
        latest = {"statusCode": s, "data": (e or {}).get("data", e)}
        if s == 200 and isinstance(latest["data"], dict) and latest["data"].get("status") in ("completed", "failed", "cancelled"):
            return latest
        time.sleep(0.25)
    return latest

first = wait_run(run_id)
check("First run reaches completed", first and first["statusCode"] == 200 and first["data"].get("status") == "completed", first)
first_detail = first["data"] if first else {}
steps = first_detail.get("steps", [])
check("Run pins workflow v1", first_detail.get("workflowVersion") == 1, first_detail.get("workflowVersion"))
check("Run snapshot owner is devices", first_detail.get("definitionSnapshot", {}).get("ownerModule") == "devices")
check("Run persists three steps", len(steps) == 3, len(steps))
check("All first-run steps complete", len(steps) == 3 and all(x.get("status") == "completed" for x in steps), steps)
action_step = next((x for x in steps if x.get("catalogKey") == "devices.device.add_to_group"), None)
check("Add-to-group step persisted", action_step is not None, steps)
check(
    "First action is not idempotent replay",
    action_step is not None and (action_step.get("output") or {}).get("idempotentReplay") is False,
    action_step,
)

status, members_after = request("GET", "/devices/groups/" + group_id + "/members?page=1&pageSize=100")
check("Real group membership side effect applied", status == 200 and any(x.get("id") == device_id for x in members_after.get("items", [])))

# Replay same immutable v1 after membership exists: executor must be idempotent.
replay_status, replay_envelope = request(
    "POST",
    "/devices/automations/" + automation_id + "/runs",
    body={"input": {"deviceId": device_id}},
)
check("Replay run queues", replay_status == 202, replay_status)
replay_id = replay_envelope.get("data", {}).get("id", "") if isinstance(replay_envelope, dict) else ""
replay = wait_run(replay_id) if replay_id else None
check("Replay run completes", replay and replay["data"].get("status") == "completed", replay)
replay_steps = replay["data"].get("steps", []) if replay else []
replay_action = next((x for x in replay_steps if x.get("catalogKey") == "devices.device.add_to_group"), None)
check(
    "Replay action reports idempotent success",
    replay_action is not None and (replay_action.get("output") or {}).get("idempotentReplay") is True,
    replay_action,
)

# Immutable definition versioning.
v2_status, v2_envelope = request(
    "PUT",
    "/devices/automations/" + automation_id,
    body={"name": name + " v2", "nodes": nodes, "edges": edges, "orientation": "horizontal"},
    extra_headers={"If-Match": v1_etag},
)
check("Definition updates to v2", v2_status == 200 and v2_envelope.get("data", {}).get("version") == 2, v2_envelope)
v2 = v2_envelope["data"]
status, old_run_envelope = request("GET", "/devices/automations/" + automation_id + "/runs/" + run_id)
old_run = (old_run_envelope or {}).get("data", {})
check(
    "Existing run remains pinned to v1 snapshot",
    status == 200 and old_run.get("workflowVersion") == 1 and old_run.get("definitionSnapshot", {}).get("name") == name,
    old_run.get("definitionSnapshot"),
)

# WHEN mismatch must reject before enqueue.
trigger_mismatch_nodes = json.loads(json.dumps(nodes))
trigger_mismatch_nodes[0]["catalogKey"] = opposite_trigger
v3_status, v3_envelope = request(
    "PUT",
    "/devices/automations/" + automation_id,
    body={"name": name + " v3 trigger mismatch", "nodes": trigger_mismatch_nodes, "edges": edges, "orientation": "horizontal"},
    extra_headers={"If-Match": v2["eTag"]},
)
check("Definition updates to v3 trigger mismatch", v3_status == 200 and v3_envelope.get("data", {}).get("version") == 3, v3_envelope)
v3 = v3_envelope["data"]
mismatch_status, mismatch_problem = request(
    "POST",
    "/devices/automations/" + automation_id + "/runs",
    body={"input": {"deviceId": device_id}},
)
check(
    "WHEN mismatch rejected before enqueue",
    mismatch_status == 422 and isinstance(mismatch_problem, dict) and mismatch_problem.get("code") == "DEVICES_TRIGGER_CONTEXT_MISMATCH",
    mismatch_problem,
)

# IF mismatch must reject before enqueue.
if_mismatch_nodes = json.loads(json.dumps(nodes))
if_mismatch_nodes[0]["configuration"]["condition"] = {
    "field": "operatingSystem",
    "operator": "equals",
    "value": "__STEP45H_NO_MATCH__",
}
v4_status, v4_envelope = request(
    "PUT",
    "/devices/automations/" + automation_id,
    body={"name": name + " v4 condition mismatch", "nodes": if_mismatch_nodes, "edges": edges, "orientation": "horizontal"},
    extra_headers={"If-Match": v3["eTag"]},
)
check("Definition updates to v4 IF mismatch", v4_status == 200 and v4_envelope.get("data", {}).get("version") == 4, v4_envelope)
v4 = v4_envelope["data"]
if_status, if_problem = request(
    "POST",
    "/devices/automations/" + automation_id + "/runs",
    body={"input": {"deviceId": device_id}},
)
check(
    "IF mismatch rejected before enqueue",
    if_status == 422 and isinstance(if_problem, dict) and if_problem.get("code") == "DEVICES_RULE_CONDITION_NOT_MATCHED",
    if_problem,
)

latest = v4
if provider_groups:
    provider_group = provider_groups[0]
    provider_nodes = json.loads(json.dumps(nodes))
    provider_nodes[1]["configuration"]["groupId"] = provider_group["id"]
    v5_status, v5_envelope = request(
        "PUT",
        "/devices/automations/" + automation_id,
        body={"name": name + " v5 provider guard", "nodes": provider_nodes, "edges": edges, "orientation": "horizontal"},
        extra_headers={"If-Match": v4["eTag"]},
    )
    check("Definition updates to provider-guard v5", v5_status == 200 and v5_envelope.get("data", {}).get("version") == 5, v5_envelope)
    if v5_status == 200:
        latest = v5_envelope["data"]
        provider_start_status, provider_start = request(
            "POST",
            "/devices/automations/" + automation_id + "/runs",
            body={"input": {"deviceId": device_id}},
        )
        check("Provider-owned test run queues", provider_start_status == 202, provider_start_status)
        provider_run_id = provider_start.get("data", {}).get("id", "") if isinstance(provider_start, dict) else ""
        provider_result = wait_run(provider_run_id) if provider_run_id else None
        check(
            "Provider-owned group is blocked by executor",
            provider_result
            and provider_result["data"].get("status") == "failed"
            and provider_result["data"].get("errorCode") == "DEVICES_GROUP_PROVIDER_OWNED",
            provider_result,
        )
else:
    print("SKIP provider-owned executor guard: no active provider-owned static group in current seed")

status, versions = request("GET", "/devices/automations/" + automation_id + "/versions")
expected_min_versions = 5 if provider_groups else 4
check("Version history is persisted", status == 200 and len((versions or {}).get("items", [])) >= expected_min_versions, versions)

status, run_history = request("GET", "/devices/automations/" + automation_id + "/runs?page=1&pageSize=25")
check("Run History lists first run", status == 200 and any(x.get("id") == run_id for x in run_history.get("items", [])), run_history)

delete_status, _ = request(
    "DELETE",
    "/devices/automations/" + automation_id,
    extra_headers={"If-Match": latest["eTag"]},
)
check("QA definition soft-delete returns 204", delete_status == 204, delete_status)

CLEANUP.write_text(json.dumps({
    "deviceId": device_id,
    "groupId": group_id,
    "deviceName": device.get("name"),
    "groupName": group.get("name"),
    "membershipExistedBefore": False,
    "automationId": automation_id,
    "runId": run_id,
}, indent=2), encoding="utf-8")

print(f"step45h_api_checks={checks}")
print(f"step45h_api_failures={len(failures)}")
print("cleanup_file=" + str(CLEANUP))
for item in failures:
    print("FAILED", item)
raise SystemExit(1 if failures else 0)
