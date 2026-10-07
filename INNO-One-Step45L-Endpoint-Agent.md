

## Endpoint Agent machine enrollment + telemetry acceptance — 2026-10-07

Architecture outcome:
- Endpoint Agent startup no longer requires interactive Keycloak user login.
- Web Portal remains user-authenticated for IT/Admin operations such as Agent Deployment and ownership confirmation.
- Endpoint Agent uses one-time enrollment bootstrap, then exchanges it for a per-device machine credential.
- Machine credential is persisted locally with Windows DPAPI LocalMachine protection.
- Server stores only hashes for enrollment tokens and device secrets.
- Existing assigned devices preserve OwnerUserId; new ownership evidence is represented through device_ownership_suggestions and requires IT confirmation before assigning an owner.

Production acceptance on WIN-J00TUFFH81D:
- Product Agent Deployment API generated a real one-time Endpoint Agent enrollment bootstrap for Production Remote Acceptance.
- Agent launched directly at http://tauri.localhost/ with no Keycloak Sign in redirect.
- Enrollment token was consumed exactly once and marked used.
- Local bootstrap token was removed after successful exchange.
- C:\ProgramData\INNO.One\agent-credential.bin was created.
- Server-side device_agent_credentials row is active.
- Ownership suggestion resolved to confirmed / existing_owner for Adisai Plomlee.
- machine/context returns 200 through machine authentication.
- Remote consent and Agent prompt polling return 200 through machine authentication.
- Agent UI renders WIN-J00TUFFH81D, ASUS TUF Gaming A15, Windows 11, current IP and assigned employee without interactive login.

Telemetry acceptance:
- Hardware inventory API: inventoryStatus=complete, source=endpoint_agent.
- Hardware observed: ASUSTeK COMPUTER INC., ASUS TUF Gaming A15 FA506IV_FA506IV, AMD Ryzen 7 4800H, BIOS FA506IV.320, 16 GB RAM.
- Software inventory API: inventoryStatus=complete, source=endpoint_agent, 1,027 packages.
- Performance API: status=live, source=endpoint_agent, isLive=true; samples are being published approximately every 5 seconds.
- Network inventory API: inventoryStatus=reported, source=endpoint_agent with IP/MAC/subnet/gateway/DNS/adapter populated.
- Device Activity API now returns inventory-related events; runtime acceptance observed totalItems=39 with devices.hardware_inventory.observed and devices.software_inventory.observed actions.

QA after runtime hardening:
- step45l-endpoint-agent-audit.py: 184/184 PASS.
- Step45V Remote Operations audit: 67/67 PASS.
- Step45Q Devices TOR audit: 86/86 PASS.
- Endpoint Agent TypeScript typecheck PASS.
- Web Portal TypeScript typecheck PASS.
- .NET solution build: 0 warnings / 0 errors.
- git diff --check PASS.

Current branch:
- hardening/endpoint-agent-telemetry
- runtime hardening commit before this documentation checkpoint: e3fb949 fix:harden-endpoint-telemetry-pipeline
- main remains at 71c20e2 and must not be merged until explicitly requested.

Known remaining acceptance limitation:
- The MCP PowerShell session on WIN-J00TUFFH81D is not elevated (is_admin=False), so silent MSI installation returned Windows Installer 1603.
- Runtime acceptance therefore used the exact release Endpoint Agent executable built from the same package payload.
- The production MSI itself is hosted at /downloads/INNO.One-Agent.msi and its SHA256 was verified across Windows and Ubuntu.
- A final elevated MSI install / startup-registration acceptance remains before calling installation packaging fully complete.
