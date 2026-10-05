# INNO.One â€” Step45S Device Detail Performance + Network

**Date:** 2026-10-06
**Status:** IMPLEMENTED + VERIFIED
**Branch:** `implementation/step45s-device-detail-performance-network`
**Base:** Step45R commit `e87728b`

## Scope

Step45S activates the next two Device Detail tabs frozen by Step45Q:

1. Performance
2. Network

The active Device Detail tab set is now:

`Overview â†’ Hardware â†’ Software â†’ Performance â†’ Network`

Processes, Services, Activity and Tickets remain unavailable until their owning implementation steps. No Coming Soon or dead tabs are exposed.

## Performance contract

Canonical operation:

`GET /devices/{deviceId}/performance?window=<window>&interval=<seconds>`

Permission: `devices.view`
Scope: Device resource.

Supported windows:

- 5 minutes
- 15 minutes
- 1 hour

Supported intervals:

- 5 seconds
- 15 seconds
- 30 seconds
- 60 seconds

The Product default is 5 minutes / 5 seconds.

Performance is **Live** only when:

- Device connectivity is online,
- latest sample source is `endpoint_agent`,
- latest observation is <= 60 seconds old.

Legacy Device-row values and development backfill are never promoted to Live.

## Performance persistence

Step45S promotes:

`devices.device_performance_samples`

The table stores bounded operational samples:

- CPU percent
- memory used / total
- disk used / total
- observed / received timestamps
- source / source instance

Migration:

`20261005194138_Step45SPerformanceNetwork`

The migration backfills available pre-Step45S Device metrics as `legacy_device_row` historical evidence.

Runtime ingestion opportunistically removes samples older than one hour for the current Device.

## Network contract

Canonical operation:

`GET /devices/{deviceId}/network-inventory`

Permission: `devices.view`
Scope: Device resource.

Network evidence is considered fresh for 15 minutes.

The response may include:

- IPv4 identity
- MAC address
- subnet mask
- gateway
- DNS servers
- adapter name
- optional Agent latency
- optional packet loss

Missing latency/packet-loss evidence remains null. The Product does not infer or display a Healthy claim from absent measurements.

## Independent network evidence

Network observation metadata is stored independently on the Devices inventory snapshot:

- `network_observed_at`
- `network_received_at`
- `network_source`
- `network_source_instance`

This prevents a fresh network observation from making stale Hardware evidence appear current.

## Endpoint Agent ingestion

Canonical operation:

`POST /agent/devices/{deviceId}/telemetry`

The Endpoint Agent:

- collects CPU/memory/disk through native Rust + `sysinfo`,
- collects Windows network configuration through the native Tauri host,
- publishes Performance every 5 seconds,
- publishes Network every 12 Performance ticks, approximately 60 seconds,
- only publishes while the signed-in Agent is associated with an online managed Device,
- treats telemetry as best-effort so telemetry failure does not break Request Help / consent flows.

The API additionally requires that the Device belongs to the signed-in Agent user before accepting telemetry.

Observations are rejected when they are too far in the future, more than one hour old, or contain invalid numeric ranges.

## MeshCentral boundary

MeshCentral remains the remote-management engine but is **not** used as the Performance telemetry source because the current adapter does not expose CPU/memory/disk observations.

Step45S therefore avoids manufacturing a Live graph from the legacy Device row or MeshCentral status.

## Web behavior

Performance:

- CPU and memory trend charts use persisted real samples.
- Latest sample card shows CPU, memory and disk evidence.
- Stale/offline samples remain readable but lose Live state.
- Devices with no evidence show a real Empty state.

Network:

- shows normalized configuration evidence,
- displays freshness/staleness,
- keeps cached evidence readable while offline,
- does not invent connectivity-quality measurements.

Tab loading is local to the active tab through `device-tab-loading-wrap`; it no longer blocks the resource page-level ready state.

## Native Windows QA environment note

The Windows MCP machine has Visual Studio Build Tools 2022 and Windows SDK libraries, but its default Rust link environment does not expose `msvcrt.lib`.

Native source was therefore verified with the installed Build Tools environment plus a **QA-only static CRT flag**:

`RUSTFLAGS=-C target-feature=+crt-static`

`cargo check` completed successfully through the real Tauri + `sysinfo` dependency tree.

No static-CRT release configuration was committed. A release workstation should repair/install the normal Windows SDK dynamic CRT component, or separately review a permanent static-CRT packaging decision before producing the signed Agent installer.

## Runtime verification

The Step45S EF migration was applied successfully to the shared development PostgreSQL at `172.10.1.58` during local QA.

Focused runtime QA authenticated through the development Keycloak and verified:

- Agent telemetry ingestion,
- fresh Endpoint Agent Performance samples,
- Live predicate,
- trend samples,
- Network observation persistence,
- no fabricated latency/packet loss,
- online/offline Device Detail states,
- 1366 and 768 responsive layouts,
- future tab fallback to Overview.

Synthetic Performance QA samples are bounded by the one-hour Step45S operational retention policy.

This was development-stack QA only. The Step45S Web/API/Agent build was not deployed as a release to the Linux target.

## QA

- Step45S static audit: **59 / 59**, issues 0.
- Endpoint Agent TypeScript typecheck: PASS.
- Endpoint Agent Web build: PASS.
- Native Tauri `cargo check`: PASS with the QA-only static CRT environment described above.
- i18n build: PASS.
- Web TypeScript typecheck: PASS.
- Web production build: PASS, **2259 modules**.
- .NET solution build: **0 warnings / 0 errors**.
- EF pending model changes: none.
- API Contract: **184 operations / 146 unique paths / 0 issues**.
- Data Model Contract: **95 planning tables / 0 issues**.
- Step45Q contract: **72 / 72**.
- Step45N bilingual audit: **3901 checks / 1906 keys / 0 raw-copy offenders / 0 failures**.
- Language/terminology audit: 0 issues.
- Focused Step45S browser QA: **51 / 51**, 8 screenshots.
- Broad browser regression: **66 routes / 1734 checks / 0 failures** at 1366 / 1024 / 768.
- Performance/Network screenshots visually inspected at 1366 and 768.
- `git diff --check`: PASS before checkpoint.

## Next

Step45T â€” Processes + Services + Endpoint command channel.

Do not merge `main` without explicit user instruction.
