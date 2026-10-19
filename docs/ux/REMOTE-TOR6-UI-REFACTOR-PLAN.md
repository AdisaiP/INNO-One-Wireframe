# INNO.One Remote UX Refactor — TOR Section 6

Status: design specification / implementation plan (not implemented)
Branch: \`remote/tor6-ui-refactor\`
Baseline: \`main\` at \`daf2b41f\` (2026-10-15)
Scope: Web Portal Remote UX, relevant Device actions, Endpoint policies, Admin authorization. No backend/agent changes in this pass.
Sources: user-provided TOR OCR text \`64107312093_1_2021111613345152_OCR.txt\` lines 135–180, \`docs/ux/TOR-UI-Coverage.md\` (archive prototype coverage), and current production source.

## Executive decisions

1. Remote is a dedicated **workspace within Devices**, not a second independent Device inventory or separate platform backend module. MeshCentral remains behind \`IRemoteDeviceEngine\`.
2. Separate **interactive** work (Live Session, Screen Wall) from **scheduled/bulk** jobs (Screenshot, File/Software Deployment), **persistent policy** (USB/consent), and **audit**.
3. Preserve \`devices.remote\` server authorization and effective scope; add specific permission distinctions only through a reviewed contract.
4. Preserve existing Devices/Deployment/Policies/Admin ownership. Do not duplicate Process Manager, Deployment, RBAC or Audit data.
5. Existing archived prototype is a **design reference** only. Its TOR-UI coverage does not establish production function or Agent enforcement.
6. Remote Access uses English UI per Web Portal design contract; Endpoint Agent consent and end-user prompts remain Thai. No fake enabled actions.

## Source baseline and known gaps

- \`RemoteOperationsPage.tsx\`: table of sessions (Device/Operator/Mode/Status/Requested/Action), link to Devices to start; launch URL opens another window; Disconnect action.
- \`DeviceDetailPage.tsx\`: fixed control-mode 60-minute session action; view-only selection absent in launcher; live Processes and Stop Process exist.
- \`RemoteConsentPage.tsx\`: legacy/not-required audit history; current session creation is unattended; avoid presenting obsolete consent prompt configuration as active capability.
- \`EndpointPoliciesPage.tsx\`: policy list/detail/compliance; type \`usb_storage\` has \`registered_only\` selection; evidence-based compliance; USB hardware registry/enforcement must be verified separately.
- \`DeviceMaintenancePages.tsx\`: Deployment Jobs for Agent/Software/Files, scheduling/retries and Software Maintenance; job acceptance does not equal endpoint execution proof.
- \`AppShell.tsx\`: Remote Operations and Remote Consent currently sit between Devices workspace links; deployment/policies are other Devices links.
- \`AppRoot.tsx\`: remote only \`/devices/remote-operations\` and \`/devices/remote-consent\`, with session start from device detail. No production Screen Wall/Screenshot route identified.
- \`archive/prototype-v1.26/remote-operations.html\`: Screen Wall, Screenshot Jobs, Wake-on-LAN, Sessions represented as prototype.
- \`archive/prototype-v1.26/remote-session.html\`: session toolbar, control/view-only, collaboration/chat/files represented as prototype. Collaboration not TOR Section 6 mandatory.
- \`docs/ux/TOR-UI-Coverage.md\`: prior static prototype marked Section 6 complete. Must not be applied to production status.

## Proposed navigation (avoid a long sidebar)

Devices
- Overview
- Devices
- Discovery
- Device Groups
- Remote Access  --> /devices/remote
  - tab: Sessions --> /devices/remote/sessions
  - tab: Screen Wall --> /devices/remote/wall
  - tab: Screenshots --> /devices/remote/screenshots
- Inventory Query
Operations
- Deployment Jobs (existing, Agent/Software/Files)
- Agent Maintenance (existing)
- Endpoint Policies (existing; USB Storage and USB Registry context)
- Alerts (existing)

Do **not** keep Remote Consent as a primary Devices sidebar item; move legacy/not_required decisions to Remote Access > Session History audit facet, retaining a redirect from the old route. Admin > Roles & Access Scopes owns resource scopes; Admin > Audit owns independent audit reporting. User-facing policies remain in Endpoint Policies.

## Pages and detailed behavior

### R01 Remote Access Home (P07 Monitor / Operations)
Route: \`/devices/remote\`.
Primary job: identify a manageable online endpoint and launch an authorized remote interaction.
- Summary: online/available endpoints in effective scope; active sessions; awaiting/failed sessions; current viewer availability.
- Search + filter: computer name, IP, group, organization/location, online/offline, OS, permission/mapping availability.
- Table: Device, User, Group/Location, Online, Agent & Mesh mapping, Session state, Last seen, Action.
- Actions: Start Remote (mode-picker View only/Control, duration, optional reason/ticket if policy); View screen; Wake (offline/WoL eligible); Open Device Detail.
- Conditional disabled actions with explicit reason: offline, insufficient scope, agent missing, Mesh mapping missing, Remote engine unavailable.
- Do not duplicate Device Inventory editing or display a misleading global available total outside effective scope.
- States: loading, no devices, no search results, permission denied, integration unavailable, partial sync, offline.

### R02 Remote Sessions (P02 List + history)
Route: \`/devices/remote/sessions\`.
Primary job: monitor, resume, stop, and investigate sessions.
- Active/history segmented tab; Device/Operator/Mode/Start/Duration/Expiry/Status/Reason/Failure Code/Actions.
- Active: Open Session, Disconnect (confirm if third-party interruption), see details; refresh/autoupdate status.
- History: filter time/operator/group/outcome; links to Device and audit correlation.
- Session details via R03; display a truthful session lifecycle: launching/active/ended/failed/expired, plus legacy awaiting_consent where relevant.
- Preserve old \`/devices/remote-operations\` via redirect, after route parity achieved.

### R03 Live Remote Workspace (P09 Master-detail / Monitor)
Route: \`/devices/remote/sessions/:sessionId\`.
Primary job: one endpoint remote interaction without losing device context.
- Header: Device Name, Online, Session ID/Operator, mode, elapsed/expiry, secure connection, Disconnect.
- Viewer area: stream placeholder vs live stream; fullscreen; fit/zoom; quality/bandwidth; resolution; multi-monitor selection if supported.
- Primary mode: View Only vs Control; clearly display server-allowed permission and policy.
- Quick side drawer: Device facts; Processes (link to existing live Device Detail), File/Software tasks (deep link to existing Deployment creation), Incident/Ticket where allowed.
- Action safeguards: confirmation for force/disconnect; avoid fake clipboard/Ctrl+Alt+Del/recording until adapter verifies runtime support.
- If MeshCentral share cannot be safely embedded due to CSP/cross-origin/vendor constraints, use an explicit secure external viewer with meaningful in-app status/history; never bypass Platform authentication or log share tokens.
- States: connecting, waiting for endpoint, active, degraded, expired, reconnecting, denied, engine unavailable, disconnected.

### R04 Screen Wall (P07 Monitor)
Route: \`/devices/remote/wall\`.
Primary job: supervise **multiple live endpoints** in a view-only grid.
- Saved sets/selection from effective-scope devices; group filter; max tiles governed by capability/limit; layout 2x2/3x3/etc.
- Tile: device, online, thumbnail/last frame age, stream health, FPS/quality, expand, remove.
- Bulk controls: start/stop monitoring; pause off-screen streams; adaptive quality/frame rate; never silently start remote control of a tile.
- Click to expand opens R03, through authorization; tile errors must not terminate other streams.
- Distinguish stream count from device presence/heartbeat count. UI measure CPU, bandwidth, latency.
- States: no selection, unauthorized device, offline tile, reconnecting tile, partial failure, overloaded client.

### R05 Screenshot Jobs (P02 List)
Route: \`/devices/remote/screenshots\`.
Primary job: manage one-off or recurring endpoint capture requests.
- Tabs: Active Jobs / History / Captures (gallery).
- Rows: Job ID, target group/device count, capture mode, interval, start/end, progress, success/failure, creator, retention, actions.
- Actions: New Capture, Pause/Stop if supported, Open Job, inspect/download JPG per authorized scope, bulk export with audit and sensible limits.
- Never mark succeeded without verifiable endpoint/engine results. Empty/no results/offline/partial failure.

### R06 Create Screenshot Job (P08 Wizard or focused modal)
Route: \`/devices/remote/screenshots/new\`.
Primary job: configure safely, review, and submit.
- Select one/many Device IDs or dynamic Device Group, show eligible vs excluded count & reasons.
- One-time vs recurring; interval e.g. 10s, 30s, 60s; start time; bounded duration/number of captures; JPG output; quality; retention and storage estimate.
- Preflight: permission/scope, endpoint capability, concurrency, data storage, and target availability; confirm impacts.
- Review step -> Run / Schedule in canonical footer. Form validation inline.
- TOR mentions 10-second interval as example; do not assume unbounded indefinite capture.

### R07 Screenshot Job Detail (P03 Resource Detail)
Route: \`/devices/remote/screenshots/:jobId\`.
Primary job: review per-device completion and retrieve images.
- Status/progress; per-device results, last capture, failure/retry, JPG thumbnail gallery, download scope, audit, retention deadline.
- Retry failed targets only; avoid wiping successfully captured images.

## Shared pages/actions owned outside Remote navigation

D01 Devices/Device Detail (existing): a "Remote" action with Mode/duration; Wake-on-LAN action for known WoL-capable/offline target (TOR 6.1); Process/Service control stays here (TOR 6.6). Warn when WoL transport/network lacks compatible relay/broadcast path.
D02 Deployment Jobs + New Deployment + Detail (existing): TOR 6.7/6.8, with Files payload list, destination path, overwrite conflict handling, target scope, schedule, throttle/concurrency, retries, per-device delivery/installation evidence and safe rollback where supported. **Do not duplicate** under Remote.
D03 Endpoint Policies + detail + compliance (existing): TOR 6.9, USB read/write/deny/allow modes, assignment, enforcement evidence, effective scope, no AD dependency. Do not confuse configured with enforced.
D04 Registered USB Registry (new page under Endpoint Policies; proposed \`/devices/policies/usb-devices\`): TOR 6.10, device serial/hardware ID, manufacturer, registered-by, owning unit/group, assignment, approval, status, revoke, change/audit history. Do not claim policy enforcement without verified Agent code.
A01 Admin > Roles/Access Scopes (existing): remote permission, group/organization/location scope (TOR 6.3). Reserve privilege split (view_only/control/capture/wake/deploy/policy) for approved permission contract.
A02 Admin > Audit + Remote Sessions: session author/device/group/start/end/mode/outcome/correlation and token-safe forensic evidence, no screenshot content in logs.

## TOR traceability and readiness (as of baseline source review)

| TOR | Current production evidence | UX disposition | Execution verification needed |
|---|---|---|---|
| 6.1 WoL | Not found in inspected production Remote page | D01 + R01 Wake action | WoL API/relay/capability |
| 6.2 Screen/mouse/keyboard | Device detail Create session; Remote list Launch URL | R01/R03 | embedded viewer capability vs external launch |
| 6.3 Scope | \`devices.remote\` and server scope evaluation | R01/R02 access-aware filtering; Admin scope remains | negative tenant/scope tests |
| 6.4 single/multi view | archived prototype wall only | R04 | live stream concurrency budget |
| 6.5 JPG interval captures | archived prototype jobs only | R05/R06/R07 | capture transport/storage/Agent |
| 6.6 stop Process | DeviceDetail live Processes + terminate | D01 existing; context link R03 | stop/verification/auth testing |
| 6.7 distribute files | Deployment jobs include Files | D02 improve details | actual file transfer, path and scale tests |
| 6.8 remote software | Deployment/Software Maintenance | D02 existing | install success/exit code/evidence |
| 6.9 USB read/write policy | Endpoint Policy usb_storage UI | D03 improve evidence | OS enforcement without AD |
| 6.10 registered USB | \`registered_only\` setting present | D04 registry new | serial identity/allowlist enforcement |

## Phased implementation order

- Phase UX0: Approve page map and permission ownership; resolve policy/consent decisions; keep this document as acceptance contract.
- Phase UX1: R01/R02/R03, move old paths via redirects, link R03 to existing Device actions; verify states and permissions; don't expose faux stream controls.
- Phase UX2: R04 live wall only after real multi-stream adapter contract exists; start 1-2 real streams then profile higher counts.
- Phase UX3: R05/R06/R07 screenshot jobs only with actual capture API and retention evidence; can build **clearly labeled prototype** separately.
- Phase UX4: D01 WoL, D02 files/software refinements, D03 policy compliance, D04 USB registry based on service readiness.
- Phase UX5: TOR acceptance evidence with API integration and browser E2E; responsive 1440/1024/768; capture evidence and audit tests.

## Acceptance and edge-case matrix

- A user with \`devices.view\` but not \`devices.remote\` cannot launch, resume, or obtain a share URL.
- Group-scoped operator cannot search, view or capture screenshots outside their assigned scope; API must reject forged requests.
- Device offline, absent Mesh node mapping, token expiry, and engine failure each give correct retry/status.
- View-only client cannot send control input (server-enforced).
- Live wall partial tile failure keeps unaffected tiles working; 50 heartbeat clients is not evidence of 50 live video feeds.
- Screenshot job interval/duration constrained; target audit and per-device file evidence; JPG output verified.
- Process terminate, deployment, USB policy updates logged and permission-guarded.
- USB policy "configured" and "enforced/compliant" remain distinct until trusted Endpoint evidence.
- Critical journeys have Playwright E2E and authorization integration coverage, and \`corepack pnpm run check\` passes before merge.

## GitHub to company GitLab migration notes

Target sign-in page: \`https://git.innovationssolution.cloud/users/sign_in\` (public sign-in reachable, private project/settings not inspected).
- Git repositories/branches/commits move normally; GitHub PR/issues importer support depends on access and GitLab import settings.
- Translate protected main checks \`CORE baseline\` and \`Web golden path\` into GitLab CI required pipelines with available GitLab Runner.
- Migrate \`.github/workflows\` to \`.gitlab-ci.yml\`, protected variables/tokens, scheduled actions, artifact retention; verify Docker/Node/.NET SDK and deployment.
- Ensure Git LFS artifacts (if present), submodules, secrets, releases and review history accounted for.
- Verify Windows developer git credentials, organization VPN/DNS/HTTPS certificate trust, and GitLab SSH/API access.
- ChatGPT GitHub connector will not automatically become a GitLab connector; Git operations can still be carried out through an authorized machine using MCP + git CLI once access is configured.
- Preserve GitHub read-only until all branches/references, CI acceptance and audit records have been verified after cutover.

## Implementation guardrails

- Current repository code/contracts are authoritative; this is a proposal, not proof of functionality.
- No backend/Agent implementation in UI-only branch without explicit scope agreement.
- Preserve current shared UI components \`@inno/ui\`, English Web terminology, Thai Endpoint Agent.
- Reuse source Device IDs, scopes, audit and existing module boundaries.
- New controls must have real route/prototype action and feedback; hide unavailable features from production navigation.
- No change to \`main\` until reviewed PR and green CORE CI.
