# INNO.One â€” Step45T MeshCentral Capability Audit

**Date:** 2026-10-06
**MeshCentral:** 1.2.6
**Upstream tag commit:** `029b7338ecfeeacc65da3b5a1a4cc069baeb2f65`
**Configured image:** `ghcr.io/ylianst/meshcentral:1.2.6`

## Decision

INNO.One remains the owner of Product UX, public API, canonical Device IDs/data, permissions, scope and audit. MeshCentral/MeshAgent is the endpoint execution engine for capabilities verified in the exact deployed version.

The Step45T Process/Service executor is therefore **not** implemented inside INNO.One Endpoint Agent.

## Verified MeshAgent capabilities

Exact 1.2.6 source was inspected.

| INNO.One job | MeshAgent native command | Evidence | Step45T |
| --- | --- | --- | --- |
| List Processes | `ps` | `agents/meshcore.js` | Use |
| Terminate Process | `pskill` | `agents/meshcore.js` | Use |
| List Services | `services` | `agents/meshcore.js` | Use |
| Start Service | `serviceStart` | `agents/meshcore.js` | Use |
| Stop Service | `serviceStop` | `agents/meshcore.js` | Use |
| Restart Service | `serviceRestart` | `agents/meshcore.js` | Use |
| Generic commands | `runcommands` | `agents/meshcore.js` | Not used for Step45T |

Native commands are preferred to wrapping PowerShell because the vendor agent already owns cross-endpoint execution semantics for these jobs.

## Routing evidence

MeshCentral server source confirms:

1. `meshuser.js` accepts the control/user `msg` command and routes it to the target node.
2. The server attaches the requesting control session ID.
3. MeshAgent replies with `action=msg`, a response type such as `ps` or `services`, and that session ID.
4. `webserver.js` routes the agent reply back to the originating control session.

This allows the INNO.One MeshCentral adapter to keep the vendor transport private while exposing normalized INNO.One DTOs.

## Verification rule

A route acknowledgement only proves that MeshCentral accepted the route.

Step45T requires endpoint-result verification:

- Process termination â†’ fetch live Processes until the PID disappears.
- Start Service â†’ fetch live Services until running is observed.
- Stop Service â†’ fetch live Services until stopped is observed.
- Restart Service â†’ fetch live Services until running is observed after the restart request.

If verification does not succeed, the INNO.One operation fails with an unverified remote-action state. It must not display false success.

## Live environment result

The configured MeshCentral endpoint at `172.10.1.58:8443` is reachable:

- health endpoint: HTTP 200
- response: `ok`

The current INNO.One integration control credentials are **not** accepted:

`noauth (noauth-2d)`

Therefore live-server Process/Service execution cannot be claimed as verified until MeshCentral integration authentication is repaired. Step45T adapter behavior is runtime-tested against a protocol-compatible local fake control server; the live authentication blocker remains explicitly open for the later MeshCentral integration work.

## Boundaries

- Web Portal â†’ INNO.One API only.
- Endpoint Agent â†’ INNO.One Agent API only.
- Devices Module â†’ `IRemoteDeviceEngine` â†’ MeshCentral adapter.
- Vendor node IDs never become INNO.One public IDs.
- Process/Service live snapshots are memory-only and expire after 60 seconds.
- No permanent Process/Service inventory tables are introduced.
- Stop/Start/Restart actions require `devices.manage`, confirmation and restricted audit.
