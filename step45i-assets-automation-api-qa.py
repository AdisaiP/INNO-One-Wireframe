from pathlib import Path
import json
import sys
import time
import requests

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qa-step45i-assets-automation-api"
OUT.mkdir(exist_ok=True)
CLEANUP = OUT / "cleanup.json"
REALM = ROOT / "production/infrastructure/docker/keycloak/realm-inno-one.json"
API = "http://127.0.0.1:5080/api/v1"
TOKEN_URL = "http://172.10.1.58:8080/realms/inno-one/protocol/openid-connect/token"

checks = 0
failures: list[tuple[str, object]] = []
created_tickets: list[str] = []
definitions: dict[str, str] = {}
asset_id = ""
asset_original_status = ""
asset_restore_needed = False

def check(name: str, ok: bool, detail=""):
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

def req(method: str, path: str, *, body=None, extra=None, timeout=15):
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
    if response.status_code == 204:
        data = None
    else:
        try:
            data = response.json()
        except ValueError:
            data = response.text
    return response.status_code, data, response.headers

def detail(path: str):
    status, envelope, response_headers = req("GET", path)
    data = envelope.get("data", {}) if isinstance(envelope, dict) else {}
    return status, data, response_headers

def wait_run(automation_id: str, run_id: str, timeout=25):
    deadline = time.time() + timeout
    latest = None
    while time.time() < deadline:
        status, envelope, _ = req(
            "GET",
            f"/assets/automations/{automation_id}/runs/{run_id}",
        )
        data = envelope.get("data", envelope) if isinstance(envelope, dict) else envelope
        latest = {"statusCode": status, "data": data}
        if status == 200 and isinstance(data, dict) and data.get("status") in ("completed", "failed", "cancelled"):
            return latest
        time.sleep(0.25)
    return latest

def output_value(obj, *names):
    if not isinstance(obj, dict):
        return None
    for name in names:
        if name in obj:
            return obj[name]
    return None

def lifecycle_nodes(trigger_status: str, target_status: str):
    return [
        {
            "id": "when",
            "kind": "trigger",
            "catalogKey": "assets.asset.lifecycle_status",
            "label": "Lifecycle Status",
            "labelKey": "assets.automation.catalog.lifecycle.label",
            "description": "Requires the selected Asset to be in the configured lifecycle state.",
            "descriptionKey": "assets.automation.catalog.lifecycle.description",
            "configuration": {"status": trigger_status},
        },
        {
            "id": "then",
            "kind": "action",
            "catalogKey": "assets.asset.set_lifecycle_status",
            "label": "Update Lifecycle",
            "labelKey": "assets.automation.catalog.setLifecycle.label",
            "description": "Updates lifecycle through the Assets permission boundary.",
            "descriptionKey": "assets.automation.catalog.setLifecycle.description",
            "configuration": {"status": target_status},
        },
        {
            "id": "end",
            "kind": "end",
            "catalogKey": "workflow.end",
            "label": "End",
            "labelKey": "assets.automation.catalog.end.label",
            "description": "Ends this automation path.",
            "descriptionKey": "assets.automation.catalog.end.description",
            "configuration": {},
        },
    ]

def ticket_nodes(trigger_catalog: str, trigger_config: dict, *, subject: str, description: str):
    label_map = {
        "assets.asset.lifecycle_status": (
            "Lifecycle Status",
            "assets.automation.catalog.lifecycle.label",
            "assets.automation.catalog.lifecycle.description",
        ),
        "assets.asset.owner_unassigned": (
            "Owner Unassigned",
            "assets.automation.catalog.ownerUnassigned.label",
            "assets.automation.catalog.ownerUnassigned.description",
        ),
        "assets.asset.warranty_expiring": (
            "Warranty Expiring",
            "assets.automation.catalog.warrantyExpiring.label",
            "assets.automation.catalog.warrantyExpiring.description",
        ),
        "assets.license.overused": (
            "License Overused",
            "assets.automation.catalog.licenseOverused.label",
            "assets.automation.catalog.licenseOverused.description",
        ),
    }
    label, label_key, desc_key = label_map[trigger_catalog]
    return [
        {
            "id": "when",
            "kind": "trigger",
            "catalogKey": trigger_catalog,
            "label": label,
            "labelKey": label_key,
            "description": "QA trigger.",
            "descriptionKey": desc_key,
            "configuration": trigger_config,
        },
        {
            "id": "then",
            "kind": "action",
            "catalogKey": "helpdesk.ticket.create",
            "label": "Create Helpdesk Ticket",
            "labelKey": "assets.automation.catalog.createTicket.label",
            "description": "Creates a Helpdesk ticket through the actor current permission.",
            "descriptionKey": "assets.automation.catalog.createTicket.description",
            "configuration": {
                "subject": subject,
                "description": description,
                "priority": "P3",
            },
        },
        {
            "id": "end",
            "kind": "end",
            "catalogKey": "workflow.end",
            "label": "End",
            "labelKey": "assets.automation.catalog.end.label",
            "description": "Ends this automation path.",
            "descriptionKey": "assets.automation.catalog.end.description",
            "configuration": {},
        },
    ]

edges = [
    {"id": "edge_when_then", "source": "when", "target": "then"},
    {"id": "edge_then_end", "source": "then", "target": "end"},
]

def create_definition(name: str, nodes: list[dict]):
    status, envelope, _ = req(
        "POST",
        "/assets/automations",
        body={"name": name, "nodes": nodes, "edges": edges, "orientation": "horizontal"},
    )
    check(name + " create returns 201", status == 201, status if status == 201 else envelope)
    if status != 201:
        return None
    data = envelope["data"]
    definitions[data["id"]] = data["eTag"]
    return data

def update_definition(definition: dict, name: str, nodes: list[dict]):
    status, envelope, _ = req(
        "PUT",
        "/assets/automations/" + definition["id"],
        body={"name": name, "nodes": nodes, "edges": edges, "orientation": "horizontal"},
        extra={"If-Match": definition["eTag"]},
    )
    check(name + " update returns 200", status == 200, status if status == 200 else envelope)
    if status != 200:
        return definition
    data = envelope["data"]
    definitions[data["id"]] = data["eTag"]
    return data

try:
    status, profile_envelope, _ = req("GET", "/platform/me")
    check("Platform profile returns 200", status == 200, status)
    profile = profile_envelope.get("data", {}) if isinstance(profile_envelope, dict) else {}
    permissions = set(profile.get("permissions", []))
    for permission in [
        "assets.automation.view",
        "assets.automation.manage",
        "assets.automation.run.view",
        "assets.view",
        "assets.manage",
        "assets.license.manage",
        "helpdesk.ticket.create",
        "helpdesk.ticket.view",
    ]:
        check("Profile has " + permission, permission in permissions)

    # Clean interrupted QA definitions from earlier runs.
    status, listing, _ = req("GET", "/assets/automations?page=1&pageSize=100")
    check("Assets automation list returns 200", status == 200, status)
    for item in (listing or {}).get("items", []):
        if not (item.get("name") or "").startswith("QA Step45I "):
            continue
        s, d, _ = detail("/assets/automations/" + item["id"])
        if s != 200:
            continue
        ds, _, _ = req(
            "DELETE",
            "/assets/automations/" + item["id"],
            extra={"If-Match": d["eTag"]},
        )
        check("Interrupted definition cleanup " + item["id"], ds == 204, ds)

    # Pick an in-scope Asset with an owner so owner-unassigned mismatch is deterministic.
    status, asset_page, _ = req("GET", "/assets?page=1&pageSize=100")
    check("Assets list returns 200", status == 200, status)
    asset = None
    asset_detail = None
    asset_headers = None
    for candidate in (asset_page or {}).get("items", []):
        if candidate.get("status") not in ("in_use", "stock", "repair", "retired"):
            continue
        s, d, h = detail("/assets/" + candidate["id"])
        if s == 200 and d.get("owner") is not None:
            asset = candidate
            asset_detail = d
            asset_headers = h
            break
    check("Restorable owned Asset context found", asset is not None, asset_page)
    if asset is None:
        raise RuntimeError("No owned Asset context available")

    asset_id = asset["id"]
    asset_original_status = asset_detail["status"]
    asset_tag = asset_detail["assetTag"]
    target_status = next(
        value for value in ("repair", "stock", "in_use", "retired")
        if value != asset_original_status
    )

    lifecycle_name = "QA Step45I Lifecycle " + str(int(time.time()))
    lifecycle = create_definition(
        lifecycle_name,
        lifecycle_nodes(asset_original_status, target_status),
    )
    if lifecycle is None:
        raise RuntimeError("Lifecycle definition unavailable")
    check("Lifecycle definition owner is assets", lifecycle.get("ownerModule") == "assets")
    check("Lifecycle definition starts at v1", lifecycle.get("version") == 1, lifecycle.get("version"))
    v1_etag = lifecycle["eTag"]

    s, run_envelope, _ = req(
        "POST",
        f"/assets/automations/{lifecycle['id']}/runs",
        body={"input": {"assetId": asset_id}},
    )
    check("Lifecycle run queues with 202", s == 202, s if s == 202 else run_envelope)
    run1_id = run_envelope.get("data", {}).get("id", "") if isinstance(run_envelope, dict) else ""
    run1 = wait_run(lifecycle["id"], run1_id) if run1_id else None
    check("Lifecycle run completes", run1 and run1["data"].get("status") == "completed", run1)
    run1_data = run1["data"] if run1 else {}
    run1_steps = run1_data.get("steps", [])
    check("Lifecycle run pins v1", run1_data.get("workflowVersion") == 1, run1_data.get("workflowVersion"))
    check("Lifecycle run has three steps", len(run1_steps) == 3, run1_steps)
    lifecycle_action = next((x for x in run1_steps if x.get("catalogKey") == "assets.asset.set_lifecycle_status"), None)
    check("Lifecycle action step persisted", lifecycle_action is not None, run1_steps)
    check(
        "Lifecycle action changed state, not replay",
        output_value((lifecycle_action or {}).get("output"), "idempotentReplay", "IdempotentReplay") is False,
        lifecycle_action,
    )
    asset_restore_needed = True

    s, changed_asset, changed_headers = detail("/assets/" + asset_id)
    check("Lifecycle side effect applied", s == 200 and changed_asset.get("status") == target_status, changed_asset)

    lifecycle_v2 = update_definition(
        lifecycle,
        lifecycle_name + " v2 idempotent",
        lifecycle_nodes(target_status, target_status),
    )
    check("Lifecycle definition advances to v2", lifecycle_v2.get("version") == 2, lifecycle_v2.get("version"))

    stale_status, stale_body, _ = req(
        "PUT",
        "/assets/automations/" + lifecycle["id"],
        body={
            "name": lifecycle_name + " stale",
            "nodes": lifecycle_nodes(target_status, target_status),
            "edges": edges,
            "orientation": "horizontal",
        },
        extra={"If-Match": v1_etag},
    )
    check("Stale lifecycle ETag rejected with 412", stale_status == 412, stale_status if stale_status == 412 else stale_body)

    s, run2_envelope, _ = req(
        "POST",
        f"/assets/automations/{lifecycle['id']}/runs",
        body={"input": {"assetId": asset_id}},
    )
    check("Lifecycle v2 run queues", s == 202, s)
    run2_id = run2_envelope.get("data", {}).get("id", "") if isinstance(run2_envelope, dict) else ""
    run2 = wait_run(lifecycle["id"], run2_id) if run2_id else None
    check("Lifecycle v2 idempotent run completes", run2 and run2["data"].get("status") == "completed", run2)
    run2_action = next(
        (x for x in (run2 or {}).get("data", {}).get("steps", []) if x.get("catalogKey") == "assets.asset.set_lifecycle_status"),
        None,
    )
    check(
        "Lifecycle v2 action reports idempotent replay",
        output_value((run2_action or {}).get("output"), "idempotentReplay", "IdempotentReplay") is True,
        run2_action,
    )

    s, old_run, _ = req(
        "GET",
        f"/assets/automations/{lifecycle['id']}/runs/{run1_id}",
    )
    old_run_data = old_run.get("data", {}) if isinstance(old_run, dict) else {}
    check(
        "Existing lifecycle run remains immutable v1",
        s == 200
        and old_run_data.get("workflowVersion") == 1
        and old_run_data.get("definitionSnapshot", {}).get("name") == lifecycle_name,
        old_run_data.get("definitionSnapshot"),
    )

    # Restore Asset through canonical API before cross-module tests.
    s, current_asset, current_headers = detail("/assets/" + asset_id)
    current_etag = current_headers.get("ETag")
    restore_status, restore_body, _ = req(
        "PATCH",
        "/assets/" + asset_id,
        body={"lifecycleStatus": asset_original_status},
        extra={"If-Match": current_etag},
    )
    check("Lifecycle QA restores Asset through API", restore_status == 200, restore_status if restore_status == 200 else restore_body)
    if restore_status == 200:
        asset_restore_needed = False
    s, restored_asset, _ = detail("/assets/" + asset_id)
    check("Asset lifecycle restored", s == 200 and restored_asset.get("status") == asset_original_status, restored_asset)

    # Asset -> Helpdesk cross-module action.
    ticket_name = "QA Step45I Asset Ticket " + str(int(time.time()))
    ticket_subject_template = "QA Step45I {assetTag} requires review"
    ticket_definition = create_definition(
        ticket_name,
        ticket_nodes(
            "assets.asset.lifecycle_status",
            {"status": asset_original_status},
            subject=ticket_subject_template,
            description="QA Step45I related Asset {assetId} / {assetName}",
        ),
    )
    if ticket_definition is None:
        raise RuntimeError("Asset ticket definition unavailable")

    s, ticket_run_envelope, _ = req(
        "POST",
        f"/assets/automations/{ticket_definition['id']}/runs",
        body={"input": {"assetId": asset_id}},
    )
    check("Asset ticket run queues", s == 202, s if s == 202 else ticket_run_envelope)
    ticket_run_id = ticket_run_envelope.get("data", {}).get("id", "") if isinstance(ticket_run_envelope, dict) else ""
    ticket_run = wait_run(ticket_definition["id"], ticket_run_id) if ticket_run_id else None
    check("Asset ticket run completes", ticket_run and ticket_run["data"].get("status") == "completed", ticket_run)
    ticket_steps = (ticket_run or {}).get("data", {}).get("steps", [])
    ticket_action = next((x for x in ticket_steps if x.get("catalogKey") == "helpdesk.ticket.create"), None)
    ticket_id = output_value((ticket_action or {}).get("output"), "TicketId", "ticketId")
    check("Cross-module ticket action persisted", bool(ticket_id), ticket_action)
    if ticket_id:
        created_tickets.append(ticket_id)
        ts, ticket_detail, _ = detail("/helpdesk/tickets/" + ticket_id)
        check("Created Helpdesk ticket can be read", ts == 200, ts)
        check("Created ticket links RelatedAssetId", ticket_detail.get("relatedAssetId") == asset_id, ticket_detail.get("relatedAssetId"))
        check("Created ticket expands asset tag", asset_tag in (ticket_detail.get("subject") or ""), ticket_detail.get("subject"))

    # Owner-unassigned trigger must reject the selected owned Asset before enqueue.
    owner_nodes = ticket_nodes(
        "assets.asset.owner_unassigned",
        {},
        subject="QA Step45I owner check {assetTag}",
        description="QA Step45I owner preflight",
    )
    ticket_v2 = update_definition(ticket_definition, ticket_name + " v2 owner mismatch", owner_nodes)
    owner_status, owner_problem, _ = req(
        "POST",
        f"/assets/automations/{ticket_definition['id']}/runs",
        body={"input": {"assetId": asset_id}},
    )
    check(
        "Owner-unassigned mismatch rejected before enqueue",
        owner_status == 422 and isinstance(owner_problem, dict) and owner_problem.get("code") == "ASSETS_OWNER_CONTEXT_MISMATCH",
        owner_problem,
    )

    # Warranty-expiring with zero days should either be outside threshold or explicitly lack warranty.
    warranty_nodes = ticket_nodes(
        "assets.asset.warranty_expiring",
        {"withinDays": 0},
        subject="QA Step45I warranty check {assetTag}",
        description="QA Step45I warranty preflight",
    )
    ticket_v3 = update_definition(ticket_v2, ticket_name + " v3 warranty mismatch", warranty_nodes)
    warranty_status, warranty_problem, _ = req(
        "POST",
        f"/assets/automations/{ticket_definition['id']}/runs",
        body={"input": {"assetId": asset_id}},
    )
    warranty_code = warranty_problem.get("code") if isinstance(warranty_problem, dict) else None
    check(
        "Warranty preflight rejects non-expiring context",
        warranty_status == 422 and warranty_code in {
            "ASSETS_WARRANTY_THRESHOLD_NOT_REACHED",
            "ASSETS_WARRANTY_MISSING",
            "ASSETS_WARRANTY_ALREADY_EXPIRED",
        },
        warranty_problem,
    )

    # Software License overuse trigger.
    ls, licenses, _ = req("GET", "/assets/software-licenses?page=1&pageSize=100")
    check("Software Licenses list returns 200", ls == 200, ls)
    license_items = (licenses or {}).get("items", [])
    overused = next((x for x in license_items if x.get("usedSeats", 0) > x.get("entitledSeats", 0)), None)
    compliant = next((x for x in license_items if x.get("usedSeats", 0) <= x.get("entitledSeats", 0)), None)
    check("Overused Software License context exists", overused is not None, license_items)
    check("Compliant Software License context exists", compliant is not None, license_items)

    if overused is not None:
        license_name = "QA Step45I License " + str(int(time.time()))
        license_definition = create_definition(
            license_name,
            ticket_nodes(
                "assets.license.overused",
                {},
                subject="QA Step45I {licenseProduct} overused",
                description="QA Step45I {usedSeats}/{entitledSeats} seats for {vendor}",
            ),
        )
        if license_definition is not None:
            if compliant is not None:
                cs, compliant_problem, _ = req(
                    "POST",
                    f"/assets/automations/{license_definition['id']}/runs",
                    body={"input": {"licenseId": compliant["id"]}},
                )
                check(
                    "Compliant license rejected before enqueue",
                    cs == 422
                    and isinstance(compliant_problem, dict)
                    and compliant_problem.get("code") == "ASSETS_LICENSE_THRESHOLD_NOT_REACHED",
                    compliant_problem,
                )

            os, over_envelope, _ = req(
                "POST",
                f"/assets/automations/{license_definition['id']}/runs",
                body={"input": {"licenseId": overused["id"]}},
            )
            check("Overused license run queues", os == 202, os if os == 202 else over_envelope)
            over_run_id = over_envelope.get("data", {}).get("id", "") if isinstance(over_envelope, dict) else ""
            over_run = wait_run(license_definition["id"], over_run_id) if over_run_id else None
            check("Overused license run completes", over_run and over_run["data"].get("status") == "completed", over_run)
            over_action = next(
                (x for x in (over_run or {}).get("data", {}).get("steps", []) if x.get("catalogKey") == "helpdesk.ticket.create"),
                None,
            )
            license_ticket_id = output_value((over_action or {}).get("output"), "TicketId", "ticketId")
            check("License overuse creates Helpdesk ticket", bool(license_ticket_id), over_action)
            if license_ticket_id:
                created_tickets.append(license_ticket_id)
                ts, license_ticket, _ = detail("/helpdesk/tickets/" + license_ticket_id)
                check("License ticket can be read", ts == 200, ts)
                check("License ticket has no RelatedAssetId", license_ticket.get("relatedAssetId") is None, license_ticket.get("relatedAssetId"))
                check(
                    "License ticket expands product name",
                    overused.get("productName", "") in (license_ticket.get("subject") or ""),
                    license_ticket.get("subject"),
                )

    # Version/run history resources are owner-scoped and readable.
    vs, versions, _ = req("GET", f"/assets/automations/{lifecycle['id']}/versions")
    check("Assets definition version history persists", vs == 200 and len((versions or {}).get("items", [])) >= 2, versions)
    hs, history, _ = req("GET", f"/assets/automations/{lifecycle['id']}/runs?page=1&pageSize=25")
    check("Assets run history contains lifecycle runs", hs == 200 and len((history or {}).get("items", [])) >= 2, history)

finally:
    # Restore Asset if a failure occurred after the mutation but before the normal restore.
    if asset_id and asset_original_status and asset_restore_needed:
        try:
            s, current, h = detail("/assets/" + asset_id)
            if s == 200 and current.get("status") != asset_original_status:
                req(
                    "PATCH",
                    "/assets/" + asset_id,
                    body={"lifecycleStatus": asset_original_status},
                    extra={"If-Match": h.get("ETag", "")},
                )
        except Exception as ex:
            failures.append(("Emergency Asset restore", str(ex)))

    # Soft-delete all QA definitions using the latest ETag.
    for definition_id, etag in list(definitions.items()):
        try:
            s, d, _ = detail("/assets/automations/" + definition_id)
            if s == 200:
                etag = d.get("eTag", etag)
                req("DELETE", "/assets/automations/" + definition_id, extra={"If-Match": etag})
        except Exception as ex:
            failures.append(("Definition cleanup " + definition_id, str(ex)))

    CLEANUP.write_text(
        json.dumps(
            {
                "ticketIds": created_tickets,
                "assetId": asset_id,
                "assetOriginalStatus": asset_original_status,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

print(f"step45i_api_checks={checks}")
print(f"step45i_api_failures={len(failures)}")
print(f"step45i_api_created_tickets={len(created_tickets)}")
print("cleanup_file=" + str(CLEANUP))
for item in failures:
    print("FAILED", item)
raise SystemExit(1 if failures else 0)
