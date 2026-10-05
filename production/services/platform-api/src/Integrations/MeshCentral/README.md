# MeshCentral adapter boundary

MeshCentral is the remote-device execution engine behind the INNO.One Devices module.

INNO.One remains canonical for Product UX, public API, Device IDs/data, permission/scope and audit. Vendor node IDs/DTOs stay behind `IRemoteDeviceEngine`.

Implemented adapter responsibilities now include:

- Device Groups and enrollment links;
- Node synchronization;
- Step45T live Processes via MeshAgent `ps`;
- Process termination via `pskill` with post-command verification;
- live Services via `services`;
- Service Start/Stop/Restart via native MeshAgent service commands with post-command verification.

Web Portal and INNO.One Endpoint Agent never call MeshCentral directly.

The deployed development MeshCentral target is version 1.2.6. See `INNO-One-Step45T-MeshCentral-Capability-Audit.md` for the exact upstream capability evidence and the current `noauth-2d` live integration blocker.
