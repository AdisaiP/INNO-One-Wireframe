# INNO.One â€” Step45T Processes + Services via MeshCentral

**Date:** 2026-10-06
**Status:** IMPLEMENTED + VERIFIED AGAINST PROTOCOL-COMPATIBLE TEST ENGINE
**Branch:** `implementation/step45t-processes-services-mesh-execution`
**Base:** Step45S commit `43ad5aa`

## Architecture decision

Step45T follows the frozen execution boundary:

- **INNO.One owns Product UX, public API, canonical Device IDs/data, permission/scope and audit.**
- **MeshCentral / MeshAgent is the endpoint execution engine when the exact deployed capability is verified.**
- Web Portal never calls MeshCentral directly.
- INNO.One Endpoint Agent does not duplicate the Process/Service executor.
- MeshCentral node IDs remain private integration identifiers behind `IRemoteDeviceEngine`.

The exact MeshCentral 1.2.6 source was audited before implementation. Native MeshAgent commands exist for:

- Process list: `ps`
- Process termination: `pskill`
- Service list: `services`
- Service start: `serviceStart`
- Service stop: `serviceStop`
- Service restart: `serviceRestart`

Generic `runcommands` exists but is intentionally not used by Step45T.

Full capability evidence: `INNO-One-Step45T-MeshCentral-Capability-Audit.md`.

## Device Detail

Device Detail now exposes seven implemented tabs:

`Overview â†’ Hardware â†’ Software â†’ Performance â†’ Processes â†’ Services â†’ Network`

Activity and Tickets remain hidden until Step45U.

### Processes

Processes is a live MeshAgent surface.

Canonical operations:

- `POST /devices/{deviceId}/processes/snapshots`
- `GET /devices/{deviceId}/processes/snapshots/{snapshotId}`
- `POST /devices/{deviceId}/processes/{processKey}/terminate`

Read permission: `devices.view`
Terminate permission: `devices.manage`

The normalized process response includes INNO.One process key, PID, process name, user, command line where available, CPU, memory and status.

Terminate is an interruptive action. The Web requires a warning confirmation. The API sends `pskill` through MeshCentral and **does not report success from route acknowledgement alone**. It fetches live Processes again until the PID disappears. If endpoint state cannot be verified, the operation fails with `REMOTE_ACTION_UNVERIFIED`.

### Services

Canonical operations:

- `POST /devices/{deviceId}/services/snapshots`
- `GET /devices/{deviceId}/services/snapshots/{snapshotId}`
- `POST /devices/{deviceId}/services/{serviceName}/actions`

Read permission: `devices.view`
Start/Stop/Restart permission: `devices.manage`

Allowed actions:

`start | stop | restart`

The normalized service response includes name, display name, status, startup type and service user where available.

Each action requires warning confirmation in Product UI.

Start/Stop are verified by polling live MeshAgent service state.

Restart additionally requires an observed state transition when the service was initially running before the operation may report success.

## Ephemeral state

Processes and Services remain live operational observations.

Step45T does **not** add Process or Service persistence tables.

The API uses an in-memory `DeviceLiveSnapshotStore` with a 60-second lifetime. Expired snapshot IDs return `LIVE_SNAPSHOT_EXPIRED` / HTTP 410.

A Device that is offline returns Resource Offline. Cached Process/Service lists are never rendered as current.

## MeshCentral mapping and dependency states

A canonical INNO.One Device must have a MeshCentral external mapping before live operations can run.

Missing mapping is explicit:

`MESH_CENTRAL_MAPPING_MISSING`

MeshCentral transport/authentication failure is explicit:

`REMOTE_ENGINE_UNAVAILABLE` / HTTP 503

An action that was routed but cannot be verified against resulting endpoint state is explicit:

`REMOTE_ACTION_UNVERIFIED` / HTTP 502

## Audit

Process termination and Service actions are audited by INNO.One, not delegated to vendor logs.

Canonical audit actions:

- `devices.process.terminate`
- `devices.service.action`

Both use:

- retention class: `security_long`
- sensitivity: `restricted`

Audit metadata includes the canonical target, requested action, execution engine `meshcentral` and verification result.

## Live MeshCentral environment result

The configured MeshCentral server at `172.10.1.58:8443` is reachable.

Health result:

- HTTP 200
- body `ok`

However the current integration control credentials are rejected by MeshCentral:

`noauth (noauth-2d)`

Therefore **Step45T does not claim live Process/Service execution against the deployed MeshCentral server yet**.

The adapter/API/Web execution path was runtime-tested against a local protocol-compatible MeshCentral control fixture implementing the exact verified Step45T message types. Live authentication remains a blocker to resolve before Step45V remote-control completion or before claiming production endpoint execution.

## Runtime verification

The focused browser/API test exercised the full INNO.One execution path:

`Web/API â†’ Devices Module â†’ IRemoteDeviceEngine â†’ MeshCentral adapter â†’ protocol-compatible MeshAgent fixture â†’ normalized result`

Verified:

- Process snapshot accepted and returned normalized `chrome.exe`, `Teams.exe`, `explorer.exe`
- Service snapshot accepted and returned normalized service state
- Process terminate returned 202 with `verified=true`
- the terminated PID disappeared from the next live snapshot
- Service Start returned verified and resulted in Running
- Service Restart returned verified only after an observed transition and resulted in Running
- Service Stop returned verified and resulted in Stopped
- offline Process/Service tabs showed Resource Offline and no cached live collection
- warning dialogs were shown for interruptive actions
- 1366 and 768 layouts were visually inspected

## QA

- Step45T static audit: **92 / 92**, issues 0.
- API Contract: **190 operations / 152 unique paths / 0 issues**.
- Data Model Contract: **95 planning tables / 0 issues**.
- Implementation Contract: issues 0.
- Step45Q contract: **72 / 72**.
- Step45N bilingual audit: **3973 checks / 1942 keys / 0 raw-copy offenders / 0 failures**.
- Language/terminology audit: 0 issues.
- .NET solution build: **0 warnings / 0 errors**.
- i18n build: PASS.
- Web TypeScript typecheck: PASS.
- Web production build: PASS, **2259 modules**.
- Focused Step45T browser/runtime QA: **46 / 46**, 5 screenshots.
- Broad browser regression: **66 routes / 1734 checks / 0 failures** at 1366 / 1024 / 768.
- Process/Service screenshots visually inspected at 1366 and 768.
- `git diff --check`: required before checkpoint.

## Next

Step45U â€” Device Activity + related Helpdesk Tickets.

The live MeshCentral `noauth-2d` blocker remains explicitly open. Step45V will own full Remote Operations + Remote Consent end-to-end completion, but the authentication issue may be repaired earlier if deployment access becomes available.

Do not merge `main` without explicit user instruction.
