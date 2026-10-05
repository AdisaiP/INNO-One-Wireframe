from pathlib import Path
import json
import sys
import time
import requests

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
API = "http://127.0.0.1:5080/api/v1"
TOKEN_URL = "http://172.10.1.58:8080/realms/inno-one/protocol/openid-connect/token"

checks = 0
failures = []
created_reports = []
created_schedule = None

def check(name, ok, detail=""):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail != "" else ""))
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
    raise SystemExit(1)

headers = {
    "Authorization": "Bearer " + token_response.json()["access_token"],
    "Accept": "application/json",
}

def req(method, path, *, body=None, extra=None, timeout=20):
    h = dict(headers)
    if extra:
        h.update(extra)
    if body is not None:
        h["Content-Type"] = "application/json"
    response = requests.request(
        method,
        API + path,
        headers=h,
        data=None if body is None else json.dumps(body),
        timeout=timeout,
    )
    try:
        data = None if response.status_code == 204 else response.json()
    except ValueError:
        data = response.text
    return response.status_code, data, response.headers

profile_status, profile, _ = req("GET", "/platform/me")
check("Platform profile returns 200", profile_status == 200, profile_status)
profile_data = profile.get("data", {}) if isinstance(profile, dict) else {}
for permission in ("reports.view", "reports.create", "reports.manage"):
    check("Profile has " + permission, permission in profile_data.get("permissions", []))

source_status, source_payload, _ = req("GET", "/reports/sources")
check("Report sources return 200", source_status == 200, source_status)
sources = source_payload.get("items", []) if isinstance(source_payload, dict) else []
source_map = {item.get("key"): item for item in sources}
for source_key in ("devices.inventory", "assets.inventory", "helpdesk.tickets"):
    check("Source available " + source_key, source_key in source_map, sorted(source_map))

stamp = str(int(time.time()))
first_report = None

try:
    for source_key in ("devices.inventory", "assets.inventory", "helpdesk.tickets"):
        source = source_map.get(source_key, {})
        columns = [x.get("key") for x in source.get("columns", [])[:3] if x.get("key")]
        body = {
            "name": "QA Step45K " + source_key + " " + stamp,
            "description": "Dedicated Step45K runtime QA",
            "sourceKey": source_key,
            "columns": columns,
            "filters": [],
        }
        status, payload, response_headers = req("POST", "/reports", body=body)
        check("Create " + source_key + " report 201", status == 201, (status, payload))
        if status != 201:
            continue
        report = payload.get("data", {})
        report_id = report.get("id", "")
        etag = report.get("eTag") or response_headers.get("ETag")
        created_reports.append({"id": report_id, "etag": etag, "body": body})
        if first_report is None:
            first_report = created_reports[-1]

        get_status, detail, _ = req("GET", "/reports/" + report_id)
        check("Read " + source_key + " report 200", get_status == 200, get_status)
        check("Report source persisted " + source_key, detail.get("data", {}).get("sourceKey") == source_key)

        run_status, run_payload, _ = req("POST", "/reports/" + report_id + "/runs")
        check("Generate " + source_key + " report 200", run_status == 200, (run_status, run_payload))
        run = run_payload.get("data", {}) if isinstance(run_payload, dict) else {}
        run_id = run.get("id", "")
        check("Run completed " + source_key, run.get("status") == "completed", run)

        list_status, run_list, _ = req("GET", "/reports/" + report_id + "/runs?page=1&pageSize=25")
        items = run_list.get("items", []) if isinstance(run_list, dict) else []
        check("Run history returns " + source_key, list_status == 200 and any(x.get("id") == run_id for x in items), list_status)

        detail_status, run_detail, _ = req("GET", "/reports/" + report_id + "/runs/" + run_id)
        detail_data = run_detail.get("data", {}) if isinstance(run_detail, dict) else {}
        check("Run detail returns " + source_key, detail_status == 200 and detail_data.get("status") == "completed", detail_data)

        download = requests.get(
            API + "/reports/" + report_id + "/runs/" + run_id + "/download",
            headers=headers,
            timeout=20,
        )
        check("CSV download returns 200 " + source_key, download.status_code == 200, download.status_code)
        check("CSV mime " + source_key, "text/csv" in download.headers.get("Content-Type", ""), download.headers.get("Content-Type"))
        csv_text = download.content.decode("utf-8-sig") if download.status_code == 200 else ""
        check("CSV header " + source_key, bool(columns) and csv_text.splitlines() and columns[0] in csv_text.splitlines()[0], csv_text[:120])

    if first_report:
        stale_status, _, _ = req(
            "PUT",
            "/reports/" + first_report["id"],
            body=first_report["body"],
            extra={"If-Match": 'W/"999999"'},
        )
        check("Stale report ETag returns 412", stale_status == 412, stale_status)

        update_body = dict(first_report["body"])
        update_body["description"] = "Updated by Step45K runtime QA"
        update_status, update_payload, update_headers = req(
            "PUT",
            "/reports/" + first_report["id"],
            body=update_body,
            extra={"If-Match": first_report["etag"]},
        )
        check("Current report ETag update 200", update_status == 200, (update_status, update_payload))
        if update_status == 200:
            first_report["etag"] = update_payload.get("data", {}).get("eTag") or update_headers.get("ETag")
            first_report["body"] = update_body

        schedule_body = {
            "name": "QA Step45K Daily " + stamp,
            "reportId": first_report["id"],
            "cadence": "daily",
            "timeZoneId": "Asia/Bangkok",
            "hour": 23,
            "minute": 59,
            "dayOfWeek": None,
            "dayOfMonth": None,
            "isEnabled": False,
        }
        schedule_status, schedule_payload, schedule_headers = req(
            "POST",
            "/reports/schedules",
            body=schedule_body,
        )
        check("Create report schedule 201", schedule_status == 201, (schedule_status, schedule_payload))
        if schedule_status == 201:
            schedule = schedule_payload.get("data", {})
            created_schedule = {
                "id": schedule.get("id"),
                "etag": schedule.get("eTag") or schedule_headers.get("ETag"),
                "body": schedule_body,
            }
            schedules_status, schedules_payload, _ = req("GET", "/reports/schedules")
            schedule_items = schedules_payload.get("items", []) if isinstance(schedules_payload, dict) else []
            check(
                "Schedule list contains QA schedule",
                schedules_status == 200 and any(x.get("id") == created_schedule["id"] for x in schedule_items),
                schedules_status,
            )

            enabled_body = dict(schedule_body)
            enabled_body["isEnabled"] = True
            enabled_status, enabled_payload, enabled_headers = req(
                "PUT",
                "/reports/schedules/" + created_schedule["id"],
                body=enabled_body,
                extra={"If-Match": created_schedule["etag"]},
            )
            check("Enable report schedule 200", enabled_status == 200, (enabled_status, enabled_payload))
            if enabled_status == 200:
                enabled = enabled_payload.get("data", {})
                check("Enabled schedule has next run", bool(enabled.get("nextRunAt")), enabled.get("nextRunAt"))
                created_schedule["etag"] = enabled.get("eTag") or enabled_headers.get("ETag")
finally:
    if created_schedule and created_schedule.get("id") and created_schedule.get("etag"):
        delete_status, _, _ = req(
            "DELETE",
            "/reports/schedules/" + created_schedule["id"],
            extra={"If-Match": created_schedule["etag"]},
        )
        check("Delete QA schedule 204", delete_status == 204, delete_status)

    for report in reversed(created_reports):
        if report.get("id") and report.get("etag"):
            delete_status, _, _ = req(
                "DELETE",
                "/reports/" + report["id"],
                extra={"If-Match": report["etag"]},
            )
            check("Soft-delete QA report " + report["id"], delete_status == 204, delete_status)

print("step45k_api_checks=" + str(checks))
print("step45k_api_failures=" + str(len(failures)))
for failure in failures:
    print("FAILED", failure)
raise SystemExit(1 if failures else 0)
