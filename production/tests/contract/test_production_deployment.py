from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from production_acceptance import join_url, mesh_health_url
from production_preflight import parse_env, validate


VALID_ENV = {
    "PUBLIC_HOST": "inno.example.test",
    "PORTAL_PORT": "8082",
    "PORTAL_HTTPS_PORT": "8446",
    "POSTGRES_PORT": "5433",
    "KEYCLOAK_PORT": "8180",
    "MESHCENTRAL_PORT": "8445",
    "PUBLIC_PORTAL_URL": "https://inno.example.test:8446",
    "PUBLIC_KEYCLOAK_URL": "https://inno.example.test:8446/auth",
    "PUBLIC_MESHCENTRAL_WS_URL": "wss://inno.example.test:8445",
    "PUBLIC_ENDPOINT_AGENT_INSTALLER_URL": (
        "https://inno.example.test:8446/downloads/INNO.One-Agent.msi"
    ),
    "POSTGRES_USER": "inno",
    "POSTGRES_PASSWORD": "postgres-test-secret",
    "KEYCLOAK_ADMIN": "admin",
    "KEYCLOAK_ADMIN_PASSWORD": "keycloak-test-secret",
    "MESHCENTRAL_USERNAME": "innoapi",
    "MESHCENTRAL_PASSWORD": "meshcentral-test-secret",
}


class ProductionPreflightTests(unittest.TestCase):
    def test_valid_environment_passes(self) -> None:
        self.assertEqual([], validate(dict(VALID_ENV)))

    def test_placeholder_secret_is_rejected(self) -> None:
        values = dict(VALID_ENV)
        values["POSTGRES_PASSWORD"] = "CHANGE_ME_POSTGRES"

        errors = validate(values)

        self.assertTrue(any("POSTGRES_PASSWORD" in error for error in errors))

    def test_invalid_public_schemes_are_rejected(self) -> None:
        values = dict(VALID_ENV)
        values["PUBLIC_PORTAL_URL"] = "http://inno.example.test:8082"
        values["PUBLIC_MESHCENTRAL_WS_URL"] = "ws://inno.example.test:8445"

        errors = validate(values)

        self.assertTrue(any("PUBLIC_PORTAL_URL" in error for error in errors))
        self.assertTrue(any("PUBLIC_MESHCENTRAL_WS_URL" in error for error in errors))

    def test_parser_accepts_utf8_bom(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / ".env"
            content = "\ufeff" + "\n".join(
                f"{key}={value}" for key, value in VALID_ENV.items()
            )
            path.write_text(content, encoding="utf-8")

            parsed = parse_env(path)

        self.assertEqual("inno.example.test", parsed["PUBLIC_HOST"])
        self.assertEqual([], validate(parsed))


class ProductionAcceptanceTests(unittest.TestCase):
    def test_join_url_normalizes_slashes(self) -> None:
        self.assertEqual(
            "https://inno.example.test:8446/health/platform",
            join_url("https://inno.example.test:8446/", "/health/platform"),
        )

    def test_mesh_health_uses_https(self) -> None:
        self.assertEqual(
            "https://inno.example.test:8445/health.ashx",
            mesh_health_url("wss://inno.example.test:8445"),
        )


if __name__ == "__main__":
    unittest.main()
