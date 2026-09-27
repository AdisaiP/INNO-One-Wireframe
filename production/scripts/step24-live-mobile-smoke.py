#!/usr/bin/env python3
from pathlib import Path
import base64
import hashlib
import html
import json
import re
import secrets
from urllib.parse import parse_qs, urlencode, urlparse
import requests

ROOT = Path(__file__).resolve().parents[1]
REALM = json.loads(
    (ROOT / "infrastructure/docker/keycloak/realm-inno-one.json").read_text()
)
KEYCLOAK = "http://localhost:8080/realms/inno-one"
API = "http://127.0.0.1:5080/api/v1"
REDIRECT_URI = "innoone-assets:/oauth"


def user_password(username: str) -> str:
    user = next(x for x in REALM["users"] if x["username"] == username)
    return user["credentials"][0]["value"]


def direct_token(username: str) -> str:
    response = requests.post(
        KEYCLOAK + "/protocol/openid-connect/token",
        data={
            "client_id": "inno-one-e2e",
            "grant_type": "password",
            "username": username,
            "password": user_password(username),
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def mobile_code_flow(username: str) -> str:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": "inno-one-assets-mobile",
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid profile email",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }

    session = requests.Session()
    login = session.get(
        KEYCLOAK + "/protocol/openid-connect/auth?" + urlencode(params),
        timeout=10,
    )
    login.raise_for_status()
    match = re.search(
        r'<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"',
        login.text,
    )
    if not match:
        match = re.search(
            r'<form[^>]+action="([^"]+)"[^>]+id="kc-form-login"',
            login.text,
        )
    if not match:
        raise RuntimeError("Keycloak login form not found")

    # Keycloak dev mode marks auth cookies Secure even on localhost.
    # Browsers special-case localhost; requests does not, so relax only
    # the local smoke client's cookie jar.
    for cookie in session.cookies:
        cookie.secure = False

    posted = session.post(
        html.unescape(match.group(1)),
        data={
            "username": username,
            "password": user_password(username),
            "credentialId": "",
        },
        allow_redirects=False,
        timeout=10,
    )
    if posted.status_code not in (302, 303):
        raise RuntimeError(
            f"OIDC login expected redirect, got {posted.status_code}"
        )

    query = parse_qs(urlparse(posted.headers.get("Location", "")).query)
    if query.get("state", [""])[0] != state or "code" not in query:
        raise RuntimeError("OIDC redirect missing authorization code/state")

    token = requests.post(
        KEYCLOAK + "/protocol/openid-connect/token",
        data={
            "grant_type": "authorization_code",
            "client_id": "inno-one-assets-mobile",
            "redirect_uri": REDIRECT_URI,
            "code": query["code"][0],
            "code_verifier": verifier,
        },
        timeout=10,
    )
    token.raise_for_status()
    payload = token.json()
    access_token = payload["access_token"]

    encoded_claims = access_token.split(".")[1]
    encoded_claims += "=" * ((4 - len(encoded_claims) % 4) % 4)
    claims = json.loads(base64.urlsafe_b64decode(encoded_claims))
    audience = claims.get("aud")
    audiences = [audience] if isinstance(audience, str) else list(audience or [])
    assert "inno-one-api" in audiences
    assert payload.get("refresh_token")
    return access_token


def api(method, path, token=None, body=None, expected=200):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        headers["Content-Type"] = "application/json"

    response = requests.request(
        method,
        API + path,
        headers=headers,
        json=body,
        timeout=15,
    )
    if response.status_code != expected:
        raise AssertionError(
            f"{method} {path}: expected {expected}, got "
            f"{response.status_code}: {response.text[:400]}"
        )
    return response.json() if response.content else {}


admin = direct_token("adisai")
mobile = mobile_code_flow("adisai")
print("mobile_oidc_pkce=PASS")
print("mobile_api_audience=PASS")
print("mobile_refresh_token=PASS")

asset_id = "asset_90000000000000000000000000000001"
generated = api(
    "POST",
    f"/assets/{asset_id}/qr-label",
    admin,
)["data"]
token1 = generated["qrValue"]
assert token1.startswith("inno1_qr_")
print("real_qr_generation=PASS")

resolved = api(
    "POST",
    "/assets/qr/resolve",
    mobile,
    {"token": token1},
)["data"]
assert resolved["assetTag"] == "AST-PC-000142"
assert resolved["owner"]["name"] == "Somchai Prasert"
print("mobile_real_qr_resolve=PASS")

replacement = api(
    "POST",
    f"/assets/{asset_id}/qr-label",
    admin,
)["data"]
token2 = replacement["qrValue"]
assert token2 != token1
assert replacement["replacedPrevious"] is True

api(
    "POST",
    "/assets/qr/resolve",
    mobile,
    {"token": token1},
    expected=404,
)
print("mobile_revoked_qr=PASS")

api(
    "POST",
    "/assets/qr/resolve",
    mobile,
    {"token": "inno1_qr_" + ("x" * 43)},
    expected=404,
)
print("mobile_invalid_qr=PASS")

current = api(
    "POST",
    "/assets/qr/resolve",
    mobile,
    {"token": token2},
)["data"]
assert current["assetTag"] == "AST-PC-000142"
print("mobile_current_qr=PASS")
print("STEP24_LIVE_MOBILE_SMOKE_PASS")
