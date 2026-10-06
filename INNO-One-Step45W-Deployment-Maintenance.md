# Step45W — Deployment Jobs + Agent Maintenance

Date: 2026-10-06  
Branch: `implementation/step45w-deployment-maintenance`  
Base: Step45V checkpoint `5592fb4`

## Status

**PRODUCT/API/DATA/UI SLICE COMPLETE — ENDPOINT EXECUTION NOT CLAIMED**

Step45W implements the frozen Product control-plane contract for Deployment Jobs and Agent Maintenance. INNO.One owns canonical job identity, target definitions, permissions/effective scope, persistence, scheduling policy, audit and Web workflows.

Jobs intentionally remain `queued` or `scheduled` until a verified endpoint execution channel reports evidence. Step45W does not fabricate completion.

## Canonical persistence

Added Devices-owned persistence:

- `devices.deployment_jobs`
- `devices.agent_rollouts`
- `devices.maintenance_jobs`

Migration:

- `20261006043048_Step45WDeploymentMaintenance`

Each job stores a canonical operation id, Product job number, creator, target-scope definition, schedule/safeguards, progress counters, lifecycle status and timestamps. No MeshCentral/vendor resource id is exposed as Product identity.

## API

Implemented all 10 frozen Step45W operations:

- `GET /devices/deployments`
- `POST /devices/deployments`
- `GET /devices/deployments/{deploymentId}`
- `GET /devices/agent-rollouts`
- `POST /devices/agent-rollouts`
- `GET /devices/software-maintenance-jobs`
- `POST /devices/software-maintenance-jobs`
- `GET /devices/restart-jobs`
- `POST /devices/restart-jobs`
- `GET /devices/maintenance-history`

Permissions and scope:

- read surfaces: `devices.view`
- Deployment / Agent rollout / Software creation: `devices.deploy`
- Restart creation: `devices.manage`
- effective Organization / Location / Device Group scope is enforced
- `all_managed` and ad-hoc selected Device targets require full-resource access
- canonical opaque Product IDs are validated before persistence

Creating a job completes the **create-job operation**, not the endpoint work. The job itself stays `queued` or `scheduled`.

## Web Portal

Added real Product routes:

- `/devices/deployments`
- `/devices/deployments/new`
- `/devices/deployments/:deploymentId`
- `/devices/maintenance`
- `/devices/maintenance/agent-updates`
- `/devices/maintenance/agent-rollouts/new`
- `/devices/maintenance/software`
- `/devices/maintenance/software/new`
- `/devices/maintenance/restarts`
- `/devices/maintenance/restarts/new`
- `/devices/maintenance/history`

Devices navigation now promotes **Deployment Jobs** and **Agent Maintenance**. The old direct **Agent Deployment** route is retained for compatibility but removed from normal navigation.

The UI follows the frozen wireframes for target scope, maintenance windows, retries, restart handling, grace period, user notification and offline-device handling.

## Audit

Added canonical audit actions:

- `devices.deployment.created`
- `devices.agent_rollout.created`
- `devices.software_maintenance.created`
- `devices.restart_job.created`

Restart creation is recorded as restricted audit data.

## Execution-engine audit / deliberate boundary

MeshCentral 1.2.6 at commit `029b7338ecfeeacc65da3b5a1a4cc069baeb2f65` was inspected before adding any executor.

Findings:

- `poweraction` can request reset, but MeshCentral immediately acknowledges with `ok` and the source explicitly says `Confirm we may be doing something (TODO)`; this is not proof that restart completed.
- `updateagents` routes Agent console command `agentupdate`, which updates **MeshAgent**, not the INNO.One Endpoint Agent release shown by the Product rollout workflow.
- `runcommands` supports `reply=true`, but the MeshCentral control contract exposes a generic `result` and does not freeze an endpoint package/artifact or exit-code verification contract suitable for the Product's approved software/file workflows.
- The Step45Q/Step45W frozen contracts do not define an approved package catalog, artifact storage/distribution contract, package hash/signature verification or INNO.One Agent update artifact source.

Therefore Step45W does **not** invent shell commands from package display names and does not mark queued work as successful.

A future endpoint-execution slice must freeze the approved artifact/package contract and verified execution receipt before enabling real Agent/Software/File rollout completion. Restart may use MeshCentral power execution only after Product-side verification semantics are defined.

## QA

- Step45W static audit: **84 / 84 PASS**
- Step45Q TOR audit: **78 checks / 0 issues**
- API contract: **191 operations / 153 paths / 0 issues**
- Data model: **95 tables / 0 issues**
- Event/Audit contract: **69 audit actions / 0 issues**
- Implementation contract: **0 issues**
- .NET solution build after migration: **0 warnings / 0 errors** using installed SDK 10.0.201 without changing the repo-pinned `global.json`
- Web typecheck: PASS
- Web production build: PASS, **2262 modules transformed**
- Runtime API/DB QA: **27 / 27 PASS**
- Browser QA: **87 / 87 PASS**
  - 1366px + 768px
  - no page-level overflow across all Step45W routes
  - navigation, forms and truthful queued/scheduled status verified
  - 5 screenshot checkpoints generated
- Shared development PostgreSQL at `172.10.1.58`: Step45W schema is current for QA
- No Step45W Web/API release was deployed to the Linux host

## Existing Step45V blocker

The separate Step45V live MeshCentral control-auth blocker `noauth (noauth-2d)` remains recorded and unresolved. Step45W does not claim that blocker was fixed.

## Merge state / next step

Not merged to `main`.

Frozen sequence next step:

**Step45X — Endpoint Policies + Active Alerts + Devices Overview + final TOR navigation**

Do not merge `main` without explicit user instruction.
