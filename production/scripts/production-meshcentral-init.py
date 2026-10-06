#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "infrastructure/docker/.env.production"
COMPOSE_FILE = ROOT / "infrastructure/docker/compose.production.yml"


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        raise SystemExit(f"missing environment file: {path}")
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


env_values = load_env_file(ENV_FILE)
username = os.environ.get("MESHCENTRAL_USERNAME") or env_values.get("MESHCENTRAL_USERNAME", "innoapi")
password = os.environ.get("MESHCENTRAL_PASSWORD") or env_values.get("MESHCENTRAL_PASSWORD")
if not password or password.startswith("CHANGE_ME"):
    raise SystemExit("MESHCENTRAL_PASSWORD must be configured in .env.production")

compose = [
    "docker", "compose",
    "--env-file", str(ENV_FILE),
    "-f", str(COMPOSE_FILE),
]


def run(args: list[str], check: bool = True, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        args,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)
    if check and result.returncode != 0:
        raise SystemExit(result.returncode)
    return result


run(compose + ["stop", "meshcentral"])

create = run(
    compose + [
        "run", "--rm", "--no-deps", "--entrypoint", "node", "meshcentral",
        "/opt/meshcentral/meshcentral/meshcentral.js",
        "--createaccount", username, "--pass", password,
    ],
    check=False,
)
if create.returncode != 0 and "already exists" not in (create.stdout + create.stderr).lower():
    raise SystemExit(create.returncode)

run(
    compose + [
        "run", "--rm", "--no-deps", "--entrypoint", "node", "meshcentral",
        "/opt/meshcentral/meshcentral/meshcentral.js",
        "--resetaccount", username, "--pass", password,
    ]
)
run(
    compose + [
        "run", "--rm", "--no-deps", "--entrypoint", "node", "meshcentral",
        "/opt/meshcentral/meshcentral/meshcentral.js",
        "--adminaccount", username,
    ]
)

run(compose + ["up", "-d", "meshcentral"])
print("meshcentral_integration_account_ready=" + username)
