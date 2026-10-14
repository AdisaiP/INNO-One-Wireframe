from __future__ import annotations

import json
import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

PRODUCTION_ROOT = Path(__file__).resolve().parents[2]
MODULES_ROOT = (
    PRODUCTION_ROOT
    / "services"
    / "platform-api"
    / "src"
    / "Modules"
)
MANIFEST_PATH = PRODUCTION_ROOT / "module-manifests.json"

ALLOWED_SHARED_PROJECTS = {
    "INNO.One.Contracts.csproj",
    "INNO.One.SharedKernel.csproj",
}

MODULE_NAMESPACE = re.compile(r"\bINNO\.One\.Modules\.([A-Za-z0-9_]+)\b")
MIGRATION_SCHEMA = re.compile(
    r'(?:principalSchema|schema)\s*:\s*"([^"]+)"'
)
SCHEMA_CONSTANT = re.compile(
    r'public\s+const\s+string\s+Schema\s*=\s*"([^"]+)"\s*;'
)


def module_projects() -> dict[str, Path]:
    result: dict[str, Path] = {}
    for module_dir in sorted(path for path in MODULES_ROOT.iterdir() if path.is_dir()):
        projects = list(module_dir.glob("INNO.One.Modules.*.csproj"))
        if len(projects) == 1:
            result[module_dir.name] = projects[0]
    return result


class ModuleArchitectureTests(unittest.TestCase):
    def test_modules_reference_only_approved_shared_projects(self) -> None:
        violations: list[str] = []

        for module_name, project_path in module_projects().items():
            root = ET.parse(project_path).getroot()
            for reference in root.findall(".//ProjectReference"):
                include = reference.attrib.get("Include", "")
                target_name = Path(include.replace("\\", "/")).name
                if target_name not in ALLOWED_SHARED_PROJECTS:
                    violations.append(
                        f"{module_name}: {target_name or include}"
                    )

        self.assertEqual(
            [],
            violations,
            "Module project references must go through approved shared contracts/kernel, "
            "not another module project.",
        )

    def test_modules_do_not_import_other_module_namespaces(self) -> None:
        violations: list[str] = []

        for module_name, project_path in module_projects().items():
            module_dir = project_path.parent
            for source in module_dir.rglob("*.cs"):
                if any(part in {"bin", "obj"} for part in source.parts):
                    continue
                text = source.read_text(encoding="utf-8-sig")
                for referenced_module in MODULE_NAMESPACE.findall(text):
                    if referenced_module != module_name:
                        violations.append(
                            f"{source.relative_to(PRODUCTION_ROOT)} -> "
                            f"INNO.One.Modules.{referenced_module}"
                        )

        self.assertEqual(
            [],
            violations,
            "Modules must communicate through contracts/events rather than another "
            "module namespace.",
        )

    def test_module_db_context_schema_matches_module_owner(self) -> None:
        violations: list[str] = []

        for module_name, project_path in module_projects().items():
            persistence = project_path.parent / "Persistence"
            if not persistence.is_dir():
                continue

            db_contexts = list(persistence.glob("*DbContext.cs"))
            if not db_contexts:
                continue

            expected_schema = module_name.lower()
            for db_context in db_contexts:
                text = db_context.read_text(encoding="utf-8-sig")
                match = SCHEMA_CONSTANT.search(text)
                if match is None:
                    violations.append(
                        f"{db_context.relative_to(PRODUCTION_ROOT)}: missing Schema constant"
                    )
                    continue
                if match.group(1) != expected_schema:
                    violations.append(
                        f"{db_context.relative_to(PRODUCTION_ROOT)}: "
                        f"schema={match.group(1)!r}, expected={expected_schema!r}"
                    )

        self.assertEqual([], violations)

    def test_migrations_do_not_create_cross_module_foreign_keys_or_tables(self) -> None:
        violations: list[str] = []

        for module_name, project_path in module_projects().items():
            migrations = project_path.parent / "Persistence" / "Migrations"
            if not migrations.is_dir():
                continue

            expected_schema = module_name.lower()
            for migration in migrations.glob("*.cs"):
                if migration.name.endswith(".Designer.cs"):
                    continue
                text = migration.read_text(encoding="utf-8-sig")
                for schema in MIGRATION_SCHEMA.findall(text):
                    if schema != expected_schema:
                        violations.append(
                            f"{migration.relative_to(PRODUCTION_ROOT)}: "
                            f"references schema={schema!r}, expected={expected_schema!r}"
                        )

        self.assertEqual(
            [],
            violations,
            "Module migrations must stay inside their owned database schema. "
            "Cross-module database foreign keys/tables are prohibited.",
        )

    def test_module_manifest_is_internally_consistent(self) -> None:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8-sig"))
        modules = manifest.get("modules", [])
        self.assertTrue(modules, "module-manifests.json must contain modules")

        ids = [module["id"] for module in modules]
        self.assertEqual(len(ids), len(set(ids)), "module IDs must be unique")

        valid_dependencies = set(ids) | {"platform"}
        violations: list[str] = []

        for module in modules:
            module_id = module["id"]
            permissions = set(module.get("permissions", []))
            entry_permission = module.get("entryPermission")

            if entry_permission not in permissions:
                violations.append(
                    f"{module_id}: entryPermission {entry_permission!r} is not declared"
                )

            route = module.get("route", "")
            if not route.startswith("/"):
                violations.append(f"{module_id}: route must start with /")

            for dependency in module.get("dependencies", []):
                if dependency not in valid_dependencies:
                    violations.append(
                        f"{module_id}: unknown dependency {dependency!r}"
                    )
                if dependency == module_id:
                    violations.append(f"{module_id}: module cannot depend on itself")

            for item in module.get("navigation", []):
                permission = item.get("permission")
                if permission not in permissions:
                    violations.append(
                        f"{module_id}: navigation permission {permission!r} is not declared"
                    )
                nav_route = item.get("route", "")
                if not nav_route.startswith("/"):
                    violations.append(
                        f"{module_id}: navigation route {nav_route!r} must start with /"
                    )

        self.assertEqual([], violations)

    def test_module_manifest_dependencies_are_acyclic(self) -> None:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8-sig"))
        graph = {
            module["id"]: [
                dependency
                for dependency in module.get("dependencies", [])
                if dependency != "platform"
            ]
            for module in manifest["modules"]
        }

        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(module_id: str, path: list[str]) -> None:
            if module_id in visiting:
                cycle_start = path.index(module_id)
                cycle = path[cycle_start:] + [module_id]
                self.fail("module dependency cycle: " + " -> ".join(cycle))
            if module_id in visited:
                return

            visiting.add(module_id)
            for dependency in graph.get(module_id, []):
                visit(dependency, path + [dependency])
            visiting.remove(module_id)
            visited.add(module_id)

        for module_id in graph:
            visit(module_id, [module_id])


if __name__ == "__main__":
    unittest.main()
