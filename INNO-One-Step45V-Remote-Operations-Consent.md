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


## Live auth remediation follow-up — 2026-10-06

The live control target was retested directly with `MESH_BASE_URL=wss://172.10.1.58:8443` and still returns:

`{"action":"close","cause":"noauth","msg":"noauth-2d"}`

MeshCentral 1.2.6 upstream source confirms `noauth-2d` is emitted after the `x-meshauth` header has been parsed successfully but username/password authentication fails. This rules out the WebSocket route and header encoding as the primary blocker.

The repository credential for the `innoapi` integration account has not changed since the Step16 bootstrap. The live account therefore needs to be reconciled on the Ubuntu MeshCentral data volume.

`production/scripts/step16-meshcentral-init.py` is now corrected so rerunning it while MeshCentral is stopped does all three idempotent recovery actions:

1. create `innoapi` when missing;
2. run MeshCentral `--resetaccount innoapi --pass ...` to unlock the account, remove 2FA and align the integration password;
3. run `--adminaccount innoapi`.

The previous script accepted "User already exists" and only promoted the account, so a stale password could survive every rerun and continue producing `noauth-2d`.

`production/scripts/step16-meshcontrol.mjs` now accepts `MESH_BASE_URL`, `MESH_USERNAME` and `MESH_PASSWORD` overrides so live control acceptance can be executed without editing committed appsettings.

Current environment limitation: the connected Windows machine has network reachability to the live MeshCentral endpoint but has no SSH private key/agent, deployment environment variable or Windows Credential Manager entry for `inno360@172.10.1.58`. Passwordless SSH fails, and no unauthenticated Docker remote API is exposed. The corrected bootstrap therefore cannot be applied to the Ubuntu host from this MCP session yet.

Live remote desktop remains **not accepted** until the corrected bootstrap is executed on the Ubuntu host and control auth plus create/consent/open/disconnect are retested.


## Unattended Remote requirement override — 2026-10-06

User direction supersedes the previous mandatory Endpoint Agent consent flow for new Remote Sessions.

- POST /devices/{deviceId}/remote-sessions now validates devices.remote, effective Device scope, online state and MeshCentral mapping, then creates the MeshCentral desktop share immediately.
- New sessions use launching -> active and do not wait in awaiting_consent.
- A remote_consent_requests compatibility/audit row is retained because the frozen persistence shape links RemoteSession.ConsentRequestId; new rows use status=not_required and never surface as pending Endpoint Agent prompts.
- A current Device owner is no longer required to start remote access.
- MeshCentral vendor consent stays disabled (consent: 0) because INNO.One is operating in unattended mode.
- Legacy pending consent records and the legacy Agent approval/decline APIs remain backward compatible but are not used for new sessions.
- Permission, scope, online/mapping checks, restricted audit, remote.started/remote.ended, time-limited shares and explicit Disconnect remain mandatory.
- Remote Operations UI no longer presents consent as part of the normal session lifecycle; Remote Consent is retained as a legacy/audit history surface.


## Local unattended acceptance + Disconnect regression fix — 2026-10-06

A complete local acceptance was executed on Windows using the Product API/Web Portal, MeshCentral 1.2.6 server and MeshAgent for WIN-J00TUFFH81D.

Observed pre-fix disconnect defect: removing an active share disconnected the MeshCentral viewer, but the Product RemoteSession remained active. MeshCentral 1.2.6 sends an acknowledgement containing removed-share metadata before its final removeDeviceShare result=OK response. The integration returned on that first message and EnsureOk rejected the missing result, preventing the Product status update.

Remediation:
- SendAsync has an opt-in requireResultProperty mode.
- RemoveDesktopShareAsync uses that mode and waits for MeshCentral's final result.
- An already-absent share (Invalid device share identifier.) is treated as idempotent removal success so stale/expired vendor state can still converge to Product Ended state.

Verified flow after remediation:
1. Device WIN-J00TUFFH81D online in the Product-owned MeshCentral group.
2. Start Remote Session from INNO.One Device Detail, no Endpoint Agent consent prompt.
3. Session becomes Active and exposes the launch URL only through INNO.One.
4. MeshCentral viewer connects successfully with a 1920x1080 remote canvas.
5. Disconnect from INNO.One removes the vendor share; viewer reports Disconnected.
6. Remote Operations reports Ended, launch_url and external_share_id are cleared, and DB end_reason is operator_disconnected.

Final regression for this fix: Step45V 59/59, Step45Q 84/84, API/Data/Event/Implementation 0 issues, .NET 0 warnings/0 errors, Web typecheck/build PASS (2265 modules), Step45W browser 87/87, Step45X browser 84/84, targeted Remote Operations browser 12/12 at 1366/768.

This acceptance proves the local Windows integration path. It does not by itself change the deployment/authentication state of the separate Ubuntu target at 172.10.1.58:8443.


## Remote production hardening / real-environment acceptance follow-up — 2026-10-06

This follow-up intentionally has no new Step number. Scope is frozen as Remote production hardening / real-environment acceptance.

Environment verification:
- Windows control workstation/repo started clean from main at 4627820 and work moved to branch hardening/remote-production-acceptance.
- Original Ubuntu MeshCentral target 172.10.1.58:8443 is network-reachable: TCP 8443 succeeds and HTTPS responds with the MeshCentral login redirect.
- Integration control authentication still fails with noauth (noauth-2d).
- SSH from the connected Windows workstation to inno360@172.10.1.58 is unavailable (exit 255), so the corrected Ubuntu account bootstrap cannot be applied from this MCP session.
- Therefore the Ubuntu target is not accepted and no live-production Remote success is claimed.
- Only one Windows Desktop Commander endpoint is currently available. No Hyper-V/Windows Sandbox/VirtualBox/VMware/QEMU client environment is available on that endpoint, so a separate Windows Client cannot be prepared or counted as cross-machine acceptance in this session.
- The existing local MeshAgent is a foreground connect process, not a Windows Service. The binary supports -install/-fullinstall/start/stop/state, but installing it on the same control workstation would not satisfy the separate-client acceptance requirement.

Product hardening implemented:
- Added RemoteSessionExpiryWorker to reconcile active Product sessions whose persisted vendor share expiry has passed.
- The worker runs in bounded batches, uses PostgreSQL FOR UPDATE SKIP LOCKED for multi-instance safety, transitions stale active sessions to ended with end_reason=share_expired, clears launch_url/external_share_id, writes restricted devices.remote.session_ended audit as actor_type=service / actor_id=remote-session-expiry-worker, and emits remote.ended with automated=true.
- A runtime probe against the shared development database inserted an isolated synthetic expired active row, observed the hosted worker converge it to ended/share_expired with launch/share state cleared plus restricted audit and remote.ended, then removed the probe row/audit/outbox evidence. This proves the Product expiry reconciler; it is not presented as proof of a real MeshCentral vendor-link expiry on a separate client.

Existing real Remote evidence was rechecked directly in the shared database:
- previously accepted local sessions are ended with end_reason=operator_disconnected and cleared launch_url/external_share_id;
- devices.remote.session_started and devices.remote.session_ended are restricted;
- matching remote.started and remote.ended outbox records exist.

QA after hardening:
- Step45V static audit: 67/67 PASS.
- Step45Q Devices TOR audit: 84/84 PASS.
- API/Data/Event/Implementation audits: 0 issues.
- .NET clean build: 0 warnings / 0 errors.
- Web shared packages + Web Portal typecheck: PASS.
- Web production build: PASS, 2265 modules transformed (existing large-chunk warning only).
- Step45W browser regression: 87/87 PASS.
- Step45X browser regression: 84/84 PASS.
- Remote Operations targeted browser regression: 12/12 PASS at 1366 and 768.

Remaining real-environment acceptance blockers:
1. Repair/reconcile Ubuntu MeshCentral integration authentication and verify control commands on 172.10.1.58:8443.
2. Provide a separate controllable Windows Client, install MeshAgent as a Windows Service, and enroll it through an INNO.One Product-owned Device Group/installer.
3. Run cross-machine Start Remote -> Active -> Connected -> Disconnect -> Ended.
4. Observe an actual time-limited MeshCentral share expire on that separate client and verify Product convergence/audit/outbox against the real vendor expiry.

Do not declare production-hardening complete until those external acceptance items pass. Do not merge main without explicit user instruction.


## Ubuntu production Docker deployment + Step18 retirement — 2026-10-07

This follow-up intentionally does not create a new numbered Step. The deployed runtime source is GitHub main at 47e1e08 (deployment + Keycloak backchannel hotfix); later commits may be documentation-only.

Production host:
- Ubuntu 24.04.2 LTS VM at 172.10.1.58.
- Production repository checkout: /home/inno360/INNO.One-Production-Stage, branch main.
- Docker Compose project: inno-one-production.
- Seven services are running: postgres, keycloak, meshcentral, platform-api, meeting-service, web-portal, reverse-proxy.
- Portal HTTP redirect: 8082.
- Portal HTTPS: 8446 with INNO.One Internal CA.
- PostgreSQL host port: 5433.
- Keycloak diagnostic port: 8180; browser/OIDC frontend is https://172.10.1.58:8446/auth.
- MeshCentral final port: 8444. Port 8445 was used only for coexistence before Step18 cutover.

Deployment hardening:
- Added production Dockerfiles for Platform API, Meeting Service and Web Portal plus production Nginx reverse proxy, TLS generation, production Compose and migration tooling.
- Platform API can apply EF migrations when Database:ApplyMigrationsOnStartup=true in Production; DevelopmentSeed remains Development-only.
- Keycloak production frontend is HTTPS through the reverse proxy and uses hostname-backchannel-dynamic=true so Platform API can use private backchannel discovery/JWKS while tokens retain the public HTTPS issuer.
- Windows control workstation trusts the generated INNO.One Internal CA in the Current User root store for browser acceptance.

Step18 data migration and retirement:
- inno_core and inno_meeting were migrated from Step18 PostgreSQL to the production PostgreSQL volume.
- Production DB counts were verified against Step18 before retirement: remote_sessions=3, devices=9, audit=385.
- Step18 Keycloak SQL was retained as rollback backup; production Keycloak is initialized from the current main-branch realm so production redirect URIs are correct.
- Step18 MeshCentral persistent data/files/backups were archived and copied into the production MeshCentral volumes so Product-owned ExternalGroupId mappings remain valid.
- The production MeshCentral integration credential was reset with production-meshcentral-init.py after the volume cutover.
- Product integration acceptance reports MeshCentral connected at wss://172.10.1.58:8444 with 16 device groups visible.
- Step18 source was archived, then the inno-one-step18 Compose project, network, containers and named volumes were removed.
- /home/inno360/INNO.One-Step18 no longer exists.

Rollback evidence retained under /home/inno360/inno-one-production-backups:
- 20261006-191708/inno_core.sql
- 20261006-191708/inno_meeting.sql
- 20261006-191708/keycloak.sql
- 20261006-194705-meshcentral/meshcentral-data.tgz
- 20261006-194705-meshcentral/meshcentral-files.tgz
- 20261006-194705-meshcentral/meshcentral-backups.tgz
- 20261006-195043-INNO.One-Step18-source.tgz

Runtime acceptance after Step18 removal:
- Production HTTPS health: PASS.
- Platform API health: PASS.
- Meeting Service health: PASS.
- Web Portal health: PASS.
- Keycloak discovery issuer: https://172.10.1.58:8446/auth/realms/inno-one.
- MeshCentral health: PASS on 8444.
- Keycloak token acquisition: PASS.
- Authenticated /api/v1/platform/me: PASS with the migrated Product user and permissions.
- Authenticated /api/v1/admin/integrations: PostgreSQL connected, Keycloak connected, MeshCentral connected.
- Authenticated /api/v1/devices: PASS; migrated device data is available.
- Windows browser PKCE login to https://172.10.1.58:8446: PASS.
- Browser /devices shows WIN-J00TUFFH81D: PASS.
- Browser /devices/remote-operations: PASS.
- Browser /devices/remote-consent: PASS.

Repository QA for the deployment package before runtime cutover:
- Step45V: 67/67 PASS.
- Step45Q: 84/84 PASS.
- API/Data/Event/Implementation audits: 0 issues.
- .NET clean build: 0 warnings / 0 errors.
- Web typecheck/build: PASS; 2265 modules transformed.
- Docker Compose production config on Ubuntu: PASS.
- Docker image builds on Ubuntu: Platform API PASS, Meeting Service PASS, Web Portal PASS.

Remote production-hardening status update:
- The previous Ubuntu control-auth blocker is resolved for the new production MeshCentral deployment. Product health uses an authenticated MeshCentral control connection successfully.
- Do not treat this deployment alone as the separate-client Remote Desktop acceptance. A separate Windows client still needs MeshAgent installed as a Windows Service, Product-owned enrollment, and cross-machine Start Remote -> Active -> Connected -> Disconnect -> Ended plus real share-expiry observation.


## Cross-machine Remote acceptance on production — 2026-10-07

Scope remains Remote production hardening / real-environment acceptance; no new numbered Step was created.

Managed Windows client:
- WIN-J00TUFFH81D is enrolled through the INNO.One Product-owned Device Group Production Remote Acceptance.
- MeshAgent is installed as a real Windows Service: Mesh Agent, Automatic, LocalSystem, Running.
- Installed agent config points to wss://172.10.1.58:8444/agent.ashx.
- Final prepared installer on the client: C:\Users\adisa\INNO-One-Acceptance\MeshAgent-ProductionRemoteAcceptance.exe.
- Installer SHA256: 86a3dff24622bff828d3f01ef11a267f00466cd504ffae838d56a9c6c2cccf09.
- Canonical Product group reconciliation is healthy: PROD-REMOTE-ACCEPTANCE sync_status=synced with 1 member, WIN-J00TUFFH81D online.

Production fixes discovered during acceptance:
- production-meshcentral-init.py now publishes MeshCentral settings.aliasPort from MESHCENTRAL_PORT so generated agent installers advertise external port 8444 rather than internal/default 443.
- MeshCentralSyncWorker now deduplicates vendor nodes by canonical hostname, prefers the online node, and reconciles a replaced MeshCentral external node id back onto the existing canonical Device instead of inserting a duplicate hostname.
- Step45Q gained regression guards for hostname deduplication and external-id reconciliation; current Step45Q result is 86/86 PASS.
- Step45V remains 67/67 PASS.
- .NET clean build after the fixes: 0 warnings / 0 errors.
- These fixes are merged to GitHub main at 5224a25. Ubuntu production checkout is main@5224a25.

Real cross-machine execution:
- Operator machine: Adisais-MacBook-Pro.local.
- Managed client: WIN-J00TUFFH81D.
- Mac logged in to https://172.10.1.58:8446 through Keycloak and opened the canonical Device Detail.
- Start Remote created a canonical Product RemoteSession and transitioned it to Active.
- Open Remote Desktop opened the MeshCentral share on https://172.10.1.58:8444/sharing.
- MeshCentral desktop transitioned Connecting -> Connected.
- Real remote framebuffer observed from Mac: 1920x1080.
- Disconnect was executed from INNO.One Product UI, not directly in MeshCentral.
- Product session transitioned Active -> Ended with end_reason=operator_disconnected.
- The open MeshCentral share immediately showed Disconnected after Product disconnect.

Evidence for the accepted session:
- launch_url cleared: true.
- external_share_id cleared: true.
- devices.remote.session_started audit classification: restricted.
- devices.remote.session_ended audit classification: restricted.
- remote.started outbox record exists.
- remote.ended outbox record exists with reason operator_disconnected.
- Production Remote Acceptance group remains synced after the session and WIN-J00TUFFH81D remains online.

Expiry status:
- Product-side expiry reconciliation was previously runtime-probed successfully with share_expired, restricted service audit and remote.ended.
- A fresh real vendor time-based expiry was not re-run in this cross-machine pass. The production minimum requested share duration is 5 minutes; attempts to automate a temporary 5-minute request through the authenticated browser were blocked by the execution safety layer. Do not claim real vendor time-based expiry as newly observed in this pass.
