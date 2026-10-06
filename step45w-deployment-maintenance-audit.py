#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parent
issues=[]
checks=0

def read(rel):
    return (ROOT/rel).read_text(encoding="utf-8")

def check(name, ok):
    global checks
    checks += 1
    print(("PASS " if ok else "FAIL ")+name)
    if not ok: issues.append(name)

api=json.loads(read("inno-api-contract.json"))
data=json.loads(read("inno-data-model-contract.json"))
audit=json.loads(read("inno-event-audit-contract.json"))
entities=read("production/services/platform-api/src/Modules/Devices/Domain/DeviceEntities.cs")
db=read("production/services/platform-api/src/Modules/Devices/Persistence/DevicesDbContext.cs")
endpoints=read("production/services/platform-api/src/Modules/Devices/Api/DeviceMaintenanceEndpoints.cs")
program=read("production/services/platform-api/src/INNO.One.PlatformApi/Program.cs")
root=read("production/apps/web-portal/src/app/AppRoot.tsx")
shell=read("production/apps/web-portal/src/app/AppShell.tsx")
page=read("production/apps/web-portal/src/pages/DeviceMaintenancePages.tsx")
client=read("production/apps/web-portal/src/api/client.ts")
types=read("production/apps/web-portal/src/api/types.ts")

ops={x["id"]:x for x in api["endpoints"]}
for op in [
    "devices.deployments.list","devices.deployments.create","devices.deployments.get",
    "devices.agent_rollouts.list","devices.agent_rollouts.create",
    "devices.software_jobs.list","devices.software_jobs.create",
    "devices.restart_jobs.list","devices.restart_jobs.create",
    "devices.maintenance_history.list",
]:
    check("frozen API exists "+op, op in ops)

for table in ["deployment_jobs","agent_rollouts","maintenance_jobs"]:
    check("global data table "+table, any(x["name"]==table for x in data["schemas"]["devices"]["tables"]))

check("DeploymentJob entity", "class DeploymentJob" in entities)
check("AgentRollout entity", "class AgentRollout" in entities)
check("MaintenanceJob entity", "class MaintenanceJob" in entities)
check("deployment DbSet", "DbSet<DeploymentJob>" in db and 'ToTable("deployment_jobs")' in db)
check("rollout DbSet", "DbSet<AgentRollout>" in db and 'ToTable("agent_rollouts")' in db)
check("maintenance DbSet", "DbSet<MaintenanceJob>" in db and 'ToTable("maintenance_jobs")' in db)
check("Step45W endpoints mapped", "MapDeviceMaintenanceEndpoints" in program)

for marker in [
    'MapGet("/devices/deployments"',
    'MapPost("/devices/deployments"',
    'MapGet("/devices/agent-rollouts"',
    'MapPost("/devices/agent-rollouts"',
    'MapGet("/devices/software-maintenance-jobs"',
    'MapPost("/devices/software-maintenance-jobs"',
    'MapGet("/devices/restart-jobs"',
    'MapPost("/devices/restart-jobs"',
    'MapGet("/devices/maintenance-history"',
]:
    check("endpoint marker "+marker, marker in endpoints)

check("deployment create permission", '"devices.deploy"' in endpoints)
check("restart create permission", '"devices.manage"' in endpoints)
check("effective scope enforcement", "ApplyJobScope" in endpoints and "ResolveTargetAsync" in endpoints)
check("canonical group IDs", 'OpaqueId.TryParse(scopeIdInput, "grp"' in endpoints)
check("canonical Device IDs for selected targets", 'OpaqueId.TryParse(deviceId, "dev"' in endpoints)
check("all managed requires full scope", 'scopeType == "all_managed"' in endpoints and "access.AllResources" in endpoints)
check("jobs never fake completion", 'Status = schedule.Mode == "scheduled" ? "scheduled" : "queued"' in endpoints)
check("restart is scheduled only", 'MaintenanceType = "restart"' in endpoints and 'Status = "scheduled"' in endpoints)
check("restart audit restricted", '"devices.restart_job.created"' in endpoints and '"restricted"' in endpoints)
check("deployment audit", '"devices.deployment.created"' in endpoints)
check("agent rollout audit", '"devices.agent_rollout.created"' in endpoints)
check("software maintenance audit", '"devices.software_maintenance.created"' in endpoints)

actions={x["action"] for x in audit["auditActions"]}
for action in [
    "devices.deployment.created",
    "devices.agent_rollout.created",
    "devices.software_maintenance.created",
    "devices.restart_job.created",
]:
    check("audit action "+action, action in actions)

check("Deployment Jobs route", 'path="devices/deployments"' in root)
check("Deployment create route", 'path="devices/deployments/new"' in root)
check("Deployment detail route", 'path="devices/deployments/:deploymentId"' in root)
check("Agent Maintenance route", 'path="devices/maintenance"' in root)
check("Agent Updates route", 'path="devices/maintenance/agent-updates"' in root)
check("Software Maintenance route", 'path="devices/maintenance/software"' in root)
check("Restart route", 'path="devices/maintenance/restarts"' in root)
check("Maintenance history route", 'path="devices/maintenance/history"' in root)
check("Deployment nav", 'to="/devices/deployments"' in shell)
check("Maintenance nav", 'to="/devices/maintenance"' in shell)
check("Agent Deployment hidden from nav", 'to="/devices/add"' not in shell)
check("old Agent Deployment route retained", 'path="devices/add"' in root)

for marker in [
    "DeploymentJobsPage","DeploymentCreatePage","DeploymentJobDetailPage",
    "AgentMaintenancePage","AgentUpdatesPage","AgentRolloutCreatePage",
    "SoftwareMaintenancePage","SoftwareMaintenanceCreatePage",
    "RestartOperationsPage","RestartSchedulePage","MaintenanceHistoryPage",
]:
    check("page "+marker, marker in page and marker in root)

for marker in [
    "getDeploymentJobs","createDeploymentJob","getDeploymentJob",
    "getAgentRollouts","createAgentRollout",
    "getSoftwareMaintenanceJobs","createSoftwareMaintenanceJob",
    "getRestartJobs","createRestartJob","getMaintenanceHistory",
]:
    check("client "+marker, marker in client)

check("web job types", "interface DeploymentJob" in types and "interface AgentRolloutJob" in types and "interface MaintenanceJob" in types)
check("no vendor ids exposed", "ExternalId" not in types and "ExternalGroupId" not in types)
check("no browser native confirm", "window.confirm" not in page and "alert(" not in page and "prompt(" not in page)
check("queued evidence note", "Execution evidence required" in page)
check("restart evidence note", "Scheduling does not claim that the endpoint restarted" in page)

migrations=list((ROOT/"production/services/platform-api/src/Modules/Devices/Persistence/Migrations").glob("*Step45WDeploymentMaintenance*.cs"))
check("Step45W migration exists", len(migrations)>=1)

print("step45w_checks="+str(checks))
print("step45w_issues="+str(len(issues)))
for issue in issues:
    print("ISSUE: "+issue)
raise SystemExit(1 if issues else 0)
