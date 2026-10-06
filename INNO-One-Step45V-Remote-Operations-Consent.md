# Step45V — Remote Operations + Remote Consent through MeshCentral

Date: 2026-10-06  
Branch: `implementation/step45v-remote-operations-consent`  
Base: `main@a4d6e26`

## Status

**SOURCE IMPLEMENTATION COMPLETE / LIVE ACCEPTANCE BLOCKED**

The Product/API/Data/Permission/Audit lifecycle is implemented end-to-end in source and the MeshCentral 1.2.6 execution protocol is wired through the existing adapter boundary. The live MeshCentral control endpoint at `172.10.1.58:8443` is still blocked by `noauth (noauth-2d)`; therefore this step does **not** claim that live remote desktop is operational.

## Architecture preserved

- INNO.One owns canonical Remote Session identity, data, permissions, effective device scope, consent lifecycle, audit and events.
- Endpoint Agent remains the real user-consent prompt surface.
- Web Portal is the operator console and consent/history view.
- MeshCentral/MeshAgent is execution only.
- MeshCentral node/share identifiers remain behind the integration boundary and are not exposed as INNO.One resource IDs.
- No MeshCentral database is queried directly.

## Backend

- Added canonical `RemoteSession` persistence and linked `RemoteConsentRequest.RemoteSessionId`.
- Added EF migration `Step45VRemoteSessions`.
- Implemented:
  - `GET /devices/remote-sessions`
  - `POST /devices/{deviceId}/remote-sessions`
  - `GET /devices/remote-sessions/{sessionId}`
  - `POST /devices/remote-sessions/{sessionId}/disconnect`
  - `GET /devices/remote-consent/history`
- Session creation requires `devices.remote`, effective Device scope, online state, current owner, and MeshCentral mapping.
- Session creation creates consent first and remains `awaiting_consent`; it does not create a MeshCentral share before approval.
- Endpoint Agent approval transitions the session to execution; decline/expiry prevent execution.
- Explicit states include awaiting_consent, launching, active, declined, expired, failed and ended.
- Execution failures surface explicit Product error codes rather than fabricating success.

## MeshCentral execution

Audited against MeshCentral 1.2.6 source at commit `029b7338ecfeeacc65da3b5a1a4cc069baeb2f65`.

- Desktop share create: `createDeviceShareLink`, `p: 2`.
- Desktop share remove: `removeDeviceShare`.
- Shares are time limited.
- MeshCentral consent is set to 0 only after INNO.One user consent has already been approved, avoiding a duplicate vendor-owned prompt.
- Adapter returns a Product-internal execution result containing external share id + launch URL; external share id is never exposed as canonical API identity.

## Audit / events

- Consent decision: `devices.remote.consent_decided` + `remote.consent.decided`.
- Remote start: `devices.remote.session_started` + `remote.started`.
- Remote end: `devices.remote.session_ended` + `remote.ended`.
- Sensitive remote audit writes use restricted classification.

## Web Portal

- Added Devices routes and side navigation:
  - `/devices/remote-operations`
  - `/devices/remote-consent`
- Device Detail exposes `Start Remote Session` only with `devices.remote`, disabled while offline.
- Remote Operations polls awaiting consent/launching sessions.
- Execution URL is shown/openable only for active sessions.
- Active sessions can be disconnected through the canonical INNO.One API.
- Remote Consent page is status/history only; it explicitly keeps approval/decline on Endpoint Agent.

## QA

- .NET solution build: PASS, 0 warnings / 0 errors (SDK 10.0.201 used from a parent directory because repo pins unavailable 10.0.103).
- Web shared packages + Web Portal typecheck: PASS.
- Web production build: PASS, 2261 modules transformed.
- Step45V audit: 57/57 PASS.
- Step45Q Devices TOR audit: 74 checks / 0 issues after promoting the Step45V route guards.
- API contract audit: 191 operations / 153 paths / 0 issues.
- Data model contract audit: 95 tables / 0 issues.
- Event/Audit contract audit: 66 audit actions / 0 issues.
- Implementation contract audit: 0 issues.

## Live blocker

`172.10.1.58:8443` still rejects the integration control connection with `noauth (noauth-2d)`. No live remote-session success is claimed. Live acceptance requires fixing control authentication and then testing create share, user consent, remote desktop open, and disconnect against the real MeshCentral deployment.

## Merge state

Not merged to `main`. Do not merge without explicit user instruction.
