#!/usr/bin/env python3
from pathlib import Path
import json
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:5080/api/v1"
KEYCLOAK = "http://localhost:8080/realms/inno-one"
REALM = json.loads(
    (ROOT / "infrastructure/docker/keycloak/realm-inno-one.json").read_text()
)


def token(username):
    user = next(x for x in REALM["users"] if x["username"] == username)
    body = urllib.parse.urlencode({
        "client_id": "inno-one-e2e",
        "grant_type": "password",
        "username": username,
        "password": user["credentials"][0]["value"],
    }).encode()
    request = urllib.request.Request(
        KEYCLOAK + "/protocol/openid-connect/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)["access_token"]


def api(method, path, access_token=None, body=None, headers=None, expected=None):
    data = None if body is None else json.dumps(body).encode()
    merged = {"Accept": "application/json"}
    if access_token:
        merged["Authorization"] = "Bearer " + access_token
    if body is not None:
        merged["Content-Type"] = "application/json"
    if headers:
        merged.update(headers)
    request = urllib.request.Request(
        API + path,
        data=data,
        headers=merged,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            status = response.status
            raw = response.read()
            payload = json.loads(raw or b"{}")
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read()
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            payload = {"raw": raw.decode("utf-8", errors="replace")}

    if expected is not None and status != expected:
        raise AssertionError(
            f"{method} {path}: expected {expected}, got {status}: {payload}"
        )
    return status, payload


api("GET", "/assets/software-licenses", expected=401)
print("unauthenticated=PASS")

admin = token("adisai")
hr = token("hr.viewer")

api("GET", "/assets/software-licenses", hr, expected=403)
print("manage_permission=PASS")

_, list_response = api(
    "GET",
    "/assets/software-licenses?page=1&pageSize=25",
    admin,
    expected=200,
)
items = list_response["items"]
summary = list_response["summary"]
assert len(items) == 4
assert summary["products"] == 4
assert summary["purchasedSeats"] == 775
assert summary["installedSeats"] == 798
assert summary["overusedProducts"] == 3
assert float(summary["estimatedGapCost"]) == 185800
print("summary=PASS")

_, overused_response = api(
    "GET",
    "/assets/software-licenses?compliance=overused",
    admin,
    expected=200,
)
assert overused_response["totalItems"] == 3
_, adobe_response = api(
    "GET",
    "/assets/software-licenses?search=Adobe",
    admin,
    expected=200,
)
assert adobe_response["totalItems"] == 1
assert adobe_response["items"][0]["productName"] == "Adobe Acrobat Pro"
print("filters=PASS")

m365 = next(x for x in items if x["productName"] == "Microsoft 365 Apps")
assert m365["compliance"] == "compliant"
assert m365["entitledSeats"] == 200
assert m365["usedSeats"] == 197
assert len(m365["allocations"]) >= 3
original_etag = m365["eTag"]

bad = {
    "entitledSeats": -1,
    "unitPrice": m365["unitPrice"],
    "renewalAt": m365["renewalAt"],
    "contractReference": m365["contractReference"],
    "licenseModel": m365["licenseModel"],
}
api(
    "PATCH",
    "/assets/software-licenses/" + m365["id"],
    admin,
    bad,
    headers={"If-Match": original_etag},
    expected=400,
)
print("validation=PASS")

make_overused = {
    "entitledSeats": 196,
    "unitPrice": m365["unitPrice"],
    "renewalAt": m365["renewalAt"],
    "contractReference": m365["contractReference"],
    "licenseModel": m365["licenseModel"],
}
_, overused_update = api(
    "PATCH",
    "/assets/software-licenses/" + m365["id"],
    admin,
    make_overused,
    headers={"If-Match": original_etag},
    expected=200,
)
updated = overused_update["data"]
assert updated["compliance"] == "overused"
assert updated["seatBalance"] == -1
print("compliance_transition=PASS")

restore = dict(make_overused)
restore["entitledSeats"] = 200
api(
    "PATCH",
    "/assets/software-licenses/" + m365["id"],
    admin,
    restore,
    headers={"If-Match": original_etag},
    expected=412,
)
print("etag_guard=PASS")

_, current_response = api(
    "GET",
    "/assets/software-licenses?search=Microsoft%20365",
    admin,
    expected=200,
)
current = current_response["items"][0]
_, restore_response = api(
    "PATCH",
    "/assets/software-licenses/" + m365["id"],
    admin,
    restore,
    headers={"If-Match": current["eTag"]},
    expected=200,
)
restored = restore_response["data"]
assert restored["entitledSeats"] == 200
assert restored["compliance"] == "compliant"
print("restore=PASS")
print("STEP22_RUNTIME_SMOKE_PASS")
