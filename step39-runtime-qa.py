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

def http(method, url, token=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers, method=method)
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

def get(path, access_token):
    return http("GET", API_BASE + path, access_token)

status, health = http("GET", API_BASE.removesuffix("/api/v1") + "/health/ready")
check("health ready", status == 200, str(health))
check("implementation 0.29.0", health["implementationContract"] == "0.29.0", str(health))

admin = token("adisai")
viewer = token("hr.viewer")

status, profile = get("/platform/me", admin)
check("admin profile", status == 200, str(profile))
check("workspace permission", "platform.workspace.access" in profile["data"]["permissions"], str(profile))

status, home = get("/platform/workspace", admin)
check("workspace home status", status == 200, str(home))
check("workspace home user", home["fullName"] == "Adisai Plomlee", str(home))
check("workspace apps exact", {x["id"] for x in home["apps"]} == {"devices", "helpdesk", "assets"}, str(home))
check("workspace no meeting app", all(x["id"] != "meeting" for x in home["apps"]), str(home))
check("workspace continue persisted", len(home["continueItems"]) == 4, str(home))
check("workspace recent persisted", len(home["recentItems"]) == 4, str(home))
attention_modules = {x["module"] for x in home["attentionItems"]}
check("workspace attention modules authorized", attention_modules.issubset({"devices", "helpdesk", "assets"}), str(home))
check("workspace device attention live", "devices" in attention_modules, str(home))
check("workspace asset attention live", "assets" in attention_modules, str(home))
check("workspace attention count positive", home["attentionTotal"] > 0, str(home))
check("workspace no provider failure", home["partialFailures"] == [], str(home))
check("workspace routes absolute", all(x["destinationPath"].startswith("/") for x in home["recentItems"]), str(home))

status, cont = get("/platform/workspace/continue", admin)
check("continue status", status == 200, str(cont))
check("continue distinct resources", len(cont["items"]) == 4 and len({x["resourceId"] for x in cont["items"]}) == 4, str(cont))
check("continue expected device", any(x["title"] == "NOTEBOOK-IT-003" for x in cont["items"]), str(cont))
check("continue expected ticket", any("HD-2026-001050" in x["title"] for x in cont["items"]), str(cont))
check("continue expected asset", any("AST-NB-000003" in x["title"] for x in cont["items"]), str(cont))
check("continue excludes meeting", all(x["sourceModule"] != "meeting" for x in cont["items"]), str(cont))

status, attention = get("/platform/workspace/attention", admin)
check("attention status", status == 200, str(attention))
check("attention provider output authorized", {x["module"] for x in attention["items"]}.issubset({"devices", "helpdesk", "assets"}), str(attention))
check("attention total sum", attention["totalCount"] == sum(x["count"] for x in attention["items"]), str(attention))
check("attention safe routes", all(x["route"].startswith("/") for x in attention["items"]), str(attention))
check("attention severity", all(x["severity"] in {"danger", "warning", "info", "neutral"} for x in attention["items"]), str(attention))

status, activity = get("/platform/activity?limit=2", admin)
check("activity status", status == 200, str(activity))
check("activity limit", len(activity["items"]) == 2, str(activity))
check("activity newest first", activity["items"][0]["occurredAt"] >= activity["items"][1]["occurredAt"], str(activity))
check("activity self only shape", all(set(x) == {"sourceModule", "resourceType", "resourceId", "title", "activity", "destinationPath", "occurredAt"} for x in activity["items"]), str(activity))

status, viewer_home = get("/platform/workspace", viewer)
check("viewer workspace status", status == 200, str(viewer_home))
check("viewer apps filtered", {x["id"] for x in viewer_home["apps"]} == {"devices", "helpdesk"}, str(viewer_home))
check("viewer no asset app", all(x["id"] != "assets" for x in viewer_home["apps"]), str(viewer_home))
check("viewer self activity", len(viewer_home["recentItems"]) == 2, str(viewer_home))
check("viewer activity modules filtered", {x["sourceModule"] for x in viewer_home["recentItems"]} == {"devices", "helpdesk"}, str(viewer_home))
check("viewer no assets attention", all(x["module"] != "assets" for x in viewer_home["attentionItems"]), str(viewer_home))

status, viewer_activity = get("/platform/activity", viewer)
check("viewer activity status", status == 200, str(viewer_activity))
check("viewer activity isolated", len(viewer_activity["items"]) == 2 and all("AST-NB-000003" not in x["title"] for x in viewer_activity["items"]), str(viewer_activity))

status, unauthorized = http("GET", API_BASE + "/platform/workspace")
check("workspace requires auth", status in {401, 403}, str(unauthorized))

print("step39_runtime_checks=" + str(len(checks)))
print("step39_runtime_qa=PASS")
