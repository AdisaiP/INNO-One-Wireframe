#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
contract = json.loads((ROOT / "inno-implementation-contract.json").read_text())
registry_text = (ROOT / "platform-registry.js").read_text()

issues = []

if contract.get("contractVersion") != "0.13.0":
    issues.append(f"expected implementation contract 0.13.0, found {contract.get('contractVersion')}")
api_contract = contract.get("apiContract", {})
if api_contract.get("version") != "0.2.0":
    issues.append("implementation contract must reference API Contract 0.2.0")
if api_contract.get("basePath") != "/api/v1":
    issues.append("implementation contract API base path must be /api/v1")
for ref in (api_contract.get("source"), api_contract.get("openApi")):
    if not ref or not (ROOT / ref).exists():
        issues.append(f"missing API contract reference: {ref}")

event_contract = contract.get("eventAuditContract", {})
if event_contract.get("version") != "0.3.0":
    issues.append("implementation contract must reference Event/Audit Contract 0.3.0")
for ref in (event_contract.get("source"), event_contract.get("documentation"), event_contract.get("audit")):
    if not ref or not (ROOT / ref).exists():
        issues.append(f"missing Event/Audit contract reference: {ref}")
if event_contract.get("delivery") != "at-least-once":
    issues.append("integration event delivery must be at-least-once")
if event_contract.get("crossModuleDurability") != "transactional-outbox":
    issues.append("cross-module event durability must use transactional outbox")

data_contract = contract.get("dataModelContract", {})
if data_contract.get("version") != "0.4.0":
    issues.append("implementation contract must reference Data Model Contract 0.4.0")
for ref in (data_contract.get("source"), data_contract.get("documentation"), data_contract.get("audit")):
    if not ref or not (ROOT / ref).exists():
        issues.append(f"missing Data Model contract reference: {ref}")
if data_contract.get("engine") != "PostgreSQL":
    issues.append("data model engine must be PostgreSQL")
if data_contract.get("coreDatabase") != "inno_core" or data_contract.get("meetingDatabase") != "inno_meeting":
    issues.append("data model database ownership mismatch")

skeleton = contract.get("productionSkeleton", {})
if skeleton.get("version") != "0.5.0":
    issues.append("implementation contract must reference Production Skeleton 0.5.0")
for ref in (skeleton.get("documentation"), skeleton.get("manifest"), skeleton.get("audit")):
    if not ref or not (ROOT / ref).exists():
        issues.append(f"missing Production Skeleton reference: {ref}")
if skeleton.get("root") != "production":
    issues.append("production skeleton root must be production")
if skeleton.get("dotnetProjects") != 12:
    issues.append("production skeleton must expose 12 .NET projects")
if skeleton.get("sharedWebPackages") != 4:
    issues.append("production skeleton must expose 4 shared Web packages")
if skeleton.get("dbContexts") != 8:
    issues.append("production skeleton must expose 8 DbContexts")
if skeleton.get("featureHeavyBackendImplemented") is not False:
    issues.append("Step 14 skeleton snapshot must not claim feature-heavy backend implementation")

vertical = contract.get("verticalSlice", {})
if vertical.get("version") != "0.6.0":
    issues.append("implementation contract must reference Step 15 Vertical Slice 0.6.0")
for ref in (vertical.get("documentation"), vertical.get("manifest"), vertical.get("audit")):
    if not ref or not (ROOT / ref).exists():
        issues.append(f"missing Step 15 vertical-slice reference: {ref}")
if vertical.get("implementedOperations") != ["platform.me.get", "devices.list", "devices.get"]:
    issues.append("Step 15 implemented operation catalog mismatch")
if vertical.get("featureImplementationStarted") is not True:
    issues.append("Step 15 must mark feature implementation as started")

step16 = contract.get("devicesManagementSlice", {})
if step16.get("version") != "0.7.0":
    issues.append("implementation contract must reference Step 16 Devices Management 0.7.0")
for ref in (step16.get("documentation"), step16.get("manifest"), step16.get("audit")):
    if not ref or not (ROOT / ref).exists():
        issues.append(f"missing Step 16 devices-management reference: {ref}")
expected_step16_operations = [
    "devices.groups.list",
    "devices.groups.create",
    "devices.groups.get",
    "devices.groups.update",
    "devices.group_members.list",
    "devices.discovery_scan.create",
    "devices.discovery_scan.get",
    "devices.discovery_results.list",
    "devices.agent_installer.create",
]
if step16.get("implementedOperations") != expected_step16_operations:
    issues.append("Step 16 implemented operation catalog mismatch")
if step16.get("realMeshCentralAdapter") is not True:
    issues.append("Step 16 must use the real MeshCentral adapter boundary")

step17 = contract.get("helpdeskCoreSlice", {})
if step17.get("version") != "0.8.0":
    issues.append("implementation contract must reference Step 17 Helpdesk Core 0.8.0")
for ref in (step17.get("documentation"), step17.get("manifest"), step17.get("audit")):
    if not ref or not (ROOT / ref).exists():
        issues.append(f"missing Step 17 helpdesk-core reference: {ref}")
expected_step17_operations = [
    "helpdesk.overview.get",
    "helpdesk.tickets.list",
    "helpdesk.tickets.get",
    "helpdesk.tickets.create",
    "helpdesk.tickets.reply",
    "helpdesk.tickets.reassign",
    "helpdesk.tickets.resolve",
    "helpdesk.categories.tree",
    "helpdesk.statuses.list",
]
if step17.get("implementedOperations") != expected_step17_operations:
    issues.append("Step 17 implemented operation catalog mismatch")
if step17.get("crossModuleReads") != "shared directory contracts only":
    issues.append("Step 17 cross-module reads must use shared directory contracts only")
if step17.get("featureImplementationStarted") is not True:
    issues.append("Step 17 must mark feature implementation as started")

existing = contract.get("existingPermissions", [])
reserved = contract.get("reservedImplementationPermissions", [])
all_permissions = existing + reserved

if len(existing) != len(set(existing)):
    issues.append("duplicate permission in existingPermissions")
if len(reserved) != len(set(reserved)):
    issues.append("duplicate permission in reservedImplementationPermissions")
if set(existing) & set(reserved):
    issues.append("permission appears in both existing and reserved catalogs")

permission_pattern = re.compile(r"^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$")
for permission in all_permissions:
    if not permission_pattern.match(permission):
        issues.append(f"invalid permission id: {permission}")

for permission in existing:
    if f'"{permission}"' not in registry_text:
        issues.append(f"existing permission missing from platform-registry.js: {permission}")

for module, permission in contract.get("moduleRequiredPermissions", {}).items():
    if permission not in existing:
        issues.append(f"required permission for {module} is not in existing catalog: {permission}")
    pattern = rf'{re.escape(module)}:\{{[^\n]*requiredPermission:"{re.escape(permission)}"'
    if not re.search(pattern, registry_text):
        issues.append(f"required permission mismatch for {module}: expected {permission}")

scope_ids = [x["id"] for x in contract.get("assignmentScopeTypes", [])]
expected_scopes = ["organization", "location", "device_group"]
if scope_ids != expected_scopes:
    issues.append(f"assignment scope types must be {expected_scopes}, found {scope_ids}")

logical_scopes = contract.get("logicalScopes", [])
if logical_scopes != ["own", "team", "org", "all"]:
    issues.append(f"logical scopes mismatch: {logical_scopes}")

auth = contract.get("authorization", {})
if not auth.get("serverSideAuthoritative"):
    issues.append("server-side authorization must be authoritative")
if not auth.get("roleAndScopeSeparate"):
    issues.append("permission and scope must stay separate")
if auth.get("actionOverrideMayExpandRole") is not False:
    issues.append("action override must not expand the role")

arch = contract.get("architecture", {})
if arch.get("webPortal", {}).get("deployment") != "single-web-app":
    issues.append("web portal must start as one application")
if arch.get("platformApi", {}).get("style") != "modular-monolith":
    issues.append("platform API must start as modular monolith")
if arch.get("deviceEngine", {}).get("access") != "devices-adapter-only":
    issues.append("MeshCentral must remain behind Devices adapter")

print(f"contract_version={contract.get('contractVersion')}")
print(f"existing_permissions={len(existing)}")
print(f"reserved_permissions={len(reserved)}")
print(f"logical_scopes={len(logical_scopes)}")
print(f"assignment_scope_types={len(scope_ids)}")
print(f"issues={len(issues)}")

for issue in issues:
    print(f"ISSUE: {issue}")

raise SystemExit(1 if issues else 0)
