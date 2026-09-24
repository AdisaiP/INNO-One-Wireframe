from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent
issues = []

DOCS = [
    "INNO-One-Backend-Planning-Index.md",
    "INNO-One-Backend-Architecture.md",
    "INNO-One-Domain-Model.md",
    "INNO-One-API-Contract.md",
    "INNO-One-Event-Catalog.md",
    "INNO-One-Permission-Matrix.md",
    "INNO-One-Database-Plan.md",
]

texts = {}
for name in DOCS:
    p = ROOT / name
    if not p.exists():
        issues.append(f"missing planning document: {name}")
        texts[name] = ""
    else:
        texts[name] = p.read_text(encoding="utf-8")

manifest_path = ROOT / "qa-final-visual" / "manifest.json"
if not manifest_path.exists():
    issues.append("missing frozen UI manifest")
    routes = []
else:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    routes = sorted(manifest.get("web", {}).keys())

if len(routes) != 83:
    issues.append(f"expected 83 frozen Web routes, found {len(routes)}")

domain = texts["INNO-One-Domain-Model.md"]
permissions = texts["INNO-One-Permission-Matrix.md"]
api_contract = texts["INNO-One-API-Contract.md"]

domain_missing = [r for r in routes if f"`{r}`" not in domain]
permission_missing = [r for r in routes if f"`{r}`" not in permissions]
api_missing = [r for r in routes if f"`{r}`" not in api_contract]

for r in domain_missing:
    issues.append(f"route missing from Domain Model: {r}")
for r in permission_missing:
    issues.append(f"route missing from Permission Matrix: {r}")
for r in api_missing:
    issues.append(f"route missing from API Contract: {r}")

registry = (ROOT / "platform-registry.js").read_text(encoding="utf-8")
module_area = registry.split("roles:{", 1)[0]

declared_permissions = set()
declared_events = set()
for block in re.findall(r"permissions:\[(.*?)\]", module_area, re.S):
    declared_permissions.update(re.findall(r'"([^"]+)"', block))
for block in re.findall(r"events:\[(.*?)\]", module_area, re.S):
    declared_events.update(re.findall(r'"([^"]+)"', block))

perm_doc = texts["INNO-One-Permission-Matrix.md"]
event_doc = texts["INNO-One-Event-Catalog.md"]

for permission in sorted(declared_permissions):
    if f"`{permission}`" not in perm_doc:
        issues.append(f"prototype manifest permission undocumented: {permission}")

for event in sorted(declared_events):
    if f"`{event}`" not in event_doc:
        issues.append(f"prototype manifest event undocumented: {event}")

architecture = texts["INNO-One-Backend-Architecture.md"]
for term in ["Modular Monolith", "Keycloak", "MeshCentral", "ASP.NET Core 9", "PostgreSQL", "Outbox"]:
    if term not in architecture:
        issues.append(f"architecture missing required boundary/decision: {term}")

database = texts["INNO-One-Database-Plan.md"]
for schema in ["core", "devices", "assets", "helpdesk", "meeting", "reports"]:
    if f"`{schema}" not in database and f"  ├─ {schema}" not in database and f"  └─ {schema}" not in database:
        issues.append(f"database plan missing schema: {schema}")

api = texts["INNO-One-API-Contract.md"]
for term in ["/api/v1", "Problem Details", "Idempotency-Key", "ETag"]:
    if term not in api:
        issues.append(f"API contract missing convention: {term}")

# This branch is planning-only. Backend implementation belongs on a later branch.
backend_code = []
for pattern in ["*.cs", "*.csproj", "*.sln"]:
    backend_code.extend(
        p for p in ROOT.rglob(pattern)
        if ".git" not in p.parts
    )
if backend_code:
    issues.append(
        "backend implementation files found on planning branch: "
        + ", ".join(str(p.relative_to(ROOT)) for p in backend_code[:10])
    )

print(f"planning_docs={sum((ROOT / x).exists() for x in DOCS)}")
print(f"web_routes={len(routes)}")
print(f"domain_route_coverage={len(routes)-len(domain_missing)}/{len(routes)}")
print(f"permission_route_coverage={len(routes)-len(permission_missing)}/{len(routes)}")
print(f"api_route_coverage={len(routes)-len(api_missing)}/{len(routes)}")
print(f"manifest_permissions={len(declared_permissions)}")
print(f"manifest_events={len(declared_events)}")
print(f"backend_code_files={len(backend_code)}")
print(f"issues={len(issues)}")
for issue in issues:
    print(" -", issue)

sys.exit(1 if issues else 0)
