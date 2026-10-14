#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

REQUIRED_KEYS = (
    "PUBLIC_HOST",
    "PORTAL_PORT",
    "PORTAL_HTTPS_PORT",
    "POSTGRES_PORT",
    "KEYCLOAK_PORT",
    "MESHCENTRAL_PORT",
    "PUBLIC_PORTAL_URL",
    "PUBLIC_KEYCLOAK_URL",
    "PUBLIC_MESHCENTRAL_WS_URL",
    "PUBLIC_ENDPOINT_AGENT_INSTALLER_URL",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "KEYCLOAK_ADMIN",
    "KEYCLOAK_ADMIN_PASSWORD",
    "MESHCENTRAL_USERNAME",
    "MESHCENTRAL_PASSWORD",
)

PORT_KEYS = (
    "PORTAL_PORT",
    "PORTAL_HTTPS_PORT",
    "POSTGRES_PORT",
    "KEYCLOAK_PORT",
    "MESHCENTRAL_PORT",
)

URL_SCHEMES = {
    "PUBLIC_PORTAL_URL": {"https"},
    "PUBLIC_KEYCLOAK_URL": {"https"},
    "PUBLIC_MESHCENTRAL_WS_URL": {"wss"},
    "PUBLIC_ENDPOINT_AGENT_INSTALLER_URL": {"https"},
}

SECRET_KEYS = (
    "POSTGRES_PASSWORD",
    "KEYCLOAK_ADMIN_PASSWORD",
    "MESHCENTRAL_PASSWORD",
)


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line_number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"line {line_number}: expected KEY=VALUE")
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            raise ValueError(f"line {line_number}: key is empty")
        values[key] = value.strip().strip('"').strip("'")
    return values


def validate(values: dict[str, str]) -> list[str]:
    errors: list[str] = []

    for key in REQUIRED_KEYS:
        value = values.get(key, "").strip()
        if not value:
            errors.append(f"{key}: missing or empty")
        elif "CHANGE_ME" in value:
            errors.append(f"{key}: placeholder must be replaced")

    for key in PORT_KEYS:
        value = values.get(key, "")
        if not value:
            continue
        try:
            port = int(value)
        except ValueError:
            errors.append(f"{key}: must be an integer port")
            continue
        if not 1 <= port <= 65535:
            errors.append(f"{key}: port must be in range 1..65535")

    for key, allowed_schemes in URL_SCHEMES.items():
        value = values.get(key, "")
        if not value:
            continue
        parsed = urlparse(value)
        if parsed.scheme not in allowed_schemes:
            errors.append(
                f"{key}: scheme must be one of {', '.join(sorted(allowed_schemes))}"
            )
        if not parsed.hostname:
            errors.append(f"{key}: hostname is required")
        if parsed.username or parsed.password:
            errors.append(f"{key}: user info must not be embedded in a public URL")

    portal = values.get("PUBLIC_PORTAL_URL", "")
    installer = values.get("PUBLIC_ENDPOINT_AGENT_INSTALLER_URL", "")
    if portal and installer:
        portal_host = urlparse(portal).hostname
        installer_host = urlparse(installer).hostname
        if portal_host and installer_host and portal_host != installer_host:
            errors.append(
                "PUBLIC_ENDPOINT_AGENT_INSTALLER_URL: host must match PUBLIC_PORTAL_URL"
            )

    for key in SECRET_KEYS:
        value = values.get(key, "")
        if value and "CHANGE_ME" not in value and len(value) < 12:
            errors.append(f"{key}: secret must be at least 12 characters")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate INNO.One production environment inputs without printing secrets."
    )
    parser.add_argument(
        "--env",
        default="infrastructure/docker/.env.production",
        help="Path to the production env file.",
    )
    args = parser.parse_args()

    path = Path(args.env)
    if not path.is_file():
        print(f"PRECHECK_FAILED env file not found: {path}", file=sys.stderr)
        return 2

    try:
        values = parse_env(path)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"PRECHECK_FAILED {exc}", file=sys.stderr)
        return 2

    errors = validate(values)
    if errors:
        print("PRECHECK_FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PRECHECK_OK")
    print(f"public_host={values['PUBLIC_HOST']}")
    print(f"portal_url={values['PUBLIC_PORTAL_URL']}")
    print(f"keycloak_url={values['PUBLIC_KEYCLOAK_URL']}")
    print(f"meshcentral_url={values['PUBLIC_MESHCENTRAL_WS_URL']}")
    print("secrets=present (values hidden)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
