#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import ssl
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlunparse
from urllib.request import Request, urlopen

from production_preflight import parse_env, validate


def join_url(base: str, path: str) -> str:
    return base.rstrip("/") + "/" + path.lstrip("/")


def mesh_health_url(ws_url: str) -> str:
    parsed = urlparse(ws_url)
    scheme = "https" if parsed.scheme == "wss" else "http"
    return urlunparse((scheme, parsed.netloc, "/health.ashx", "", "", ""))


def fetch(url: str, context: ssl.SSLContext, timeout: float) -> tuple[int, str]:
    request = Request(url, headers={"User-Agent": "INNO.One-Production-Acceptance/1"})
    try:
        with urlopen(request, context=context, timeout=timeout) as response:
            body = response.read(65536).decode("utf-8", errors="replace")
            return response.status, body
    except HTTPError as exc:
        body = exc.read(65536).decode("utf-8", errors="replace")
        return exc.code, body


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run deterministic INNO.One production HTTP acceptance checks."
    )
    parser.add_argument(
        "--env",
        default="infrastructure/docker/.env.production",
        help="Path to the production env file.",
    )
    parser.add_argument(
        "--ca",
        help="CA certificate used to verify the production HTTPS endpoints.",
    )
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument(
        "--skip-meshcentral",
        action="store_true",
        help="Skip MeshCentral health when it is intentionally unavailable during coexistence.",
    )
    args = parser.parse_args()

    env_path = Path(args.env)
    if not env_path.is_file():
        print(f"ACCEPTANCE_FAILED env file not found: {env_path}", file=sys.stderr)
        return 2

    values = parse_env(env_path)
    preflight_errors = validate(values)
    if preflight_errors:
        print("ACCEPTANCE_FAILED production environment did not pass preflight")
        for error in preflight_errors:
            print(f"- {error}")
        return 2

    if args.ca:
        context = ssl.create_default_context(cafile=args.ca)
    else:
        context = ssl.create_default_context()

    portal = values["PUBLIC_PORTAL_URL"]
    keycloak = values["PUBLIC_KEYCLOAK_URL"]
    checks: list[tuple[str, str, str | None]] = [
        ("reverse-proxy", join_url(portal, "/health"), None),
        ("web-portal", join_url(portal, "/health/web"), None),
        ("platform-api", join_url(portal, "/health/platform"), "ready"),
        ("meeting-service", join_url(portal, "/health/meeting"), None),
        (
            "keycloak",
            join_url(keycloak, "/realms/inno-one/.well-known/openid-configuration"),
            '"issuer"',
        ),
    ]
    if not args.skip_meshcentral:
        checks.append(
            (
                "meshcentral",
                mesh_health_url(values["PUBLIC_MESHCENTRAL_WS_URL"]),
                None,
            )
        )

    failures: list[str] = []
    for name, url, expected_text in checks:
        try:
            status, body = fetch(url, context, args.timeout)
        except (URLError, TimeoutError, ssl.SSLError) as exc:
            failures.append(f"{name}: request failed ({type(exc).__name__})")
            print(f"FAIL {name} request-error")
            continue

        ok = 200 <= status < 300
        if expected_text is not None and expected_text not in body:
            ok = False
        if name == "platform-api" and ok:
            try:
                payload = json.loads(body)
                ok = payload.get("status") == "ready"
            except json.JSONDecodeError:
                ok = False

        if ok:
            print(f"PASS {name} status={status}")
        else:
            failures.append(f"{name}: unexpected status/body")
            print(f"FAIL {name} status={status}")

    if failures:
        print("ACCEPTANCE_FAILED")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("ACCEPTANCE_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
