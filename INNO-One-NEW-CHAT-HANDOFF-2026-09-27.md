# INNO.One — New Chat Handoff

**Updated:** 2026-09-27 00:42 +07:00
**Purpose:** Continue implementation in a new chat without losing the current Step 18 state.

---

## 1. Project location

Repository root:

`/Users/adisaip/Desktop/INNO-One-Wireframe`

Git remote:

`https://github.com/AdisaiP/INNO-One-Wireframe.git`

Current branch:

`implementation/step18-helpdesk-sla-automation`

Current HEAD/base commit:

`3bfa592 feat: implement helpdesk core`

This Step 18 branch was created from the completed Step 17 checkpoint.

**Important:** Step 18 has NOT been committed yet. The working tree is intentionally dirty.

### Latest snapshot before switching chat

At 2026-09-27 00:42 +07:00:

- branch: `implementation/step18-helpdesk-sla-automation`
- HEAD/base: `3bfa592 feat: implement helpdesk core`
- modified tracked files: **25**
- untracked files: **13**
- total dirty entries: **38**
- Step 18 commit/push: **NOT DONE**
- Step 18 runtime smoke: **NOT YET CLOSED**
- Step 18 audit file: **STILL MISSING**
- final visual/browser/contract closeout: **STILL PENDING**

The last repository edits before this handoff were in Helpdesk SLA/Automation domain/persistence work, including SLA policy/ticket-SLA extensions and DbContext mappings for Business Calendar and Automation storage. Do not reset these changes.

Current working-tree summary at handoff time:

- modified tracked files: **25**
- untracked files: **13**
- total dirty entries: **38**

Do **not** reset, clean, checkout over, or discard this working tree.

---

## 2. Repository structure

### Frozen UX/UI and contracts — repository root

The root contains the frozen prototype HTML, UX/UI contracts, architecture contracts and QA scripts.

Key contracts:

- `INNO-One-Design-System-V1-Frozen.md`
- `INNO-One-Final-UX-UI-Freeze.md`
- `INNO-One-Action-Layout-Contract.md`
- `INNO-One-Accessibility-Contract.md`
- `INNO-One-Availability-Contract.md`
- `INNO-One-Interaction-Feedback-Contract.md`
- `INNO-One-State-Coverage-Contract.md`
- `INNO-One-Permission-Scope-Contract.md`
- `INNO-One-API-Contract.md`
- `INNO-One-Event-Audit-Contract.md`
- `INNO-One-Data-Ownership-Database-Contract.md`
- `INNO-One-Implementation-Architecture-Contract.md`

Frozen UX baseline:

- Design System: **V1.26**
- UI Contract: **1.20.0**
- Frozen browser regression baseline: **124 / 124**

Do not redesign or modify frozen root prototype HTML unless the user explicitly reopens UX/UI.

### Production implementation

`production/`

Main areas:

- `production/apps/web-portal`
  - React 19
  - TypeScript
  - Vite
  - React Query
  - Keycloak JS
  - Production Web Portal UI

- `production/apps/endpoint-agent`
  - Endpoint Agent surface placeholder/implementation area

- `production/apps/assets-mobile`
  - Android/mobile asset surface placeholder/implementation area

- `production/services/platform-api`
  - .NET 10 modular monolith
  - Platform / Devices / Assets / Helpdesk / Reports modules
  - shared contracts
  - MeshCentral adapter
  - PostgreSQL EF Core persistence

- `production/services/meeting-service`
  - separate Meeting service

- `production/packages`
  - `auth`
  - `contracts`
  - `shared`
  - `ui`

- `production/infrastructure`
  - PostgreSQL
  - Keycloak
  - MeshCentral
  - Docker Compose
  - database init
  - deployment
  - reverse proxy
  - monitoring

- `production/scripts`
  - local integration/runtime smoke scripts

- `production/tests`
  - unit / integration / contract / e2e areas

---

## 3. Current contract versions

Current repository contract versions at handoff time:

- Implementation Contract: **0.9.0**
- API Contract: **0.2.0**
- Event & Audit Contract: **0.3.0**
- Data Model Contract: **0.4.0**
- UX/UI baseline: **Design System V1.26 / UI Contract 1.20.0**

Step 18 has already advanced the current Implementation Contract from 0.8.0 to **0.9.0** in the dirty working tree.

---

## 4. Completed implementation checkpoints

### Step 14 — Production Skeleton

Commit:

`e520f24 feat: scaffold production project`

Created the production monorepo skeleton, .NET services, React portal, shared packages and local infrastructure.

### Step 15 — First Vertical Slice

Commit:

`7e33472 feat: implement first vertical slice`

Completed:

- Keycloak Authorization Code + PKCE
- Platform profile
- permission/scope evaluator
- Devices list/detail
- server-side scope filtering
- canonical public IDs
- no MeshCentral vendor-ID leakage

### Step 16 — Devices Management

Commit:

`ae98b76 feat: implement devices management`

Completed:

- Device Groups
- Discovery
- Agent Enrollment
- real MeshCentral adapter
- MeshCentral → canonical Device synchronization
- durable operation / audit / outbox support
- Device Management Web routes

**User decision:** a fresh Step 16 re-validation was explicitly deferred.

Before any merge to `main` or release, return to Step 16 and rerun:

- `production/scripts/step16-local-smoke.py`
- Step 16 audit
- Web/.NET builds
- frozen browser regression
- Step 16 route visual QA
- `git diff --check`

Do not silently claim a newer Step 16 re-test has happened.

### Step 17 — Helpdesk Core

Commit:

`3bfa592 feat: implement helpdesk core`

Completed and pushed:

- Helpdesk Overview
- Tickets
- Assigned to Me
- Team Queue
- Create Ticket
- Ticket Detail
- Reply / Internal Note
- Assignment
- ETag / If-Match concurrency
- SLA state on ticket
- Resolve flow
- Categories / Statuses reads
- Helpdesk audit + outbox
- Platform/Device cross-module directory contracts
- no Helpdesk → Platform / Devices / Assets DB FK

Recorded Step 17 QA:

- runtime smoke: PASS
- Step 17 audit: 0 issues
- Web build/typecheck: PASS
- .NET build: 0 warnings / 0 errors
- EF pending-model checks: PASS
- Helpdesk visual QA: 15 / 15 route-width screens
- frozen browser regression: 124 / 124

---

## 5. Active work — Step 18 Helpdesk SLA & Automation

Branch:

`implementation/step18-helpdesk-sla-automation`

Source-of-truth draft files already exist:

- `INNO-One-Step18-Helpdesk-SLA-Automation.md`
- `inno-step18-helpdesk-sla-automation.json`
- `production/scripts/step18-local-smoke.py`

**Important:** `step18-helpdesk-sla-automation-audit.py` is referenced by the Step 18 docs/contract but is currently **missing** and still needs to be created.

### Step 18 target slice

`SLA Policy → Business Calendar → SLA Monitor → Pause/Resume → Escalation → Automation Rules`

### Implemented API operations in the current dirty tree

- `helpdesk.sla_policies.list`
- `helpdesk.sla_policies.update`
- `helpdesk.sla_monitor.get`
- `helpdesk.calendar.get`
- `helpdesk.calendar.update`
- `helpdesk.automation.list`
- `helpdesk.automation.get`
- `helpdesk.automation.create`
- `helpdesk.automation.upsert`

Backend file:

`production/services/platform-api/src/Modules/Helpdesk/Api/HelpdeskSlaAutomationEndpoints.cs`

### Implemented Step 18 Web routes

- `/helpdesk/sla`
- `/helpdesk/calendar`
- `/helpdesk/automation`
- `/helpdesk/automation/new`
- `/helpdesk/automation/:ruleId`

Pages already created:

- `production/apps/web-portal/src/pages/HelpdeskSlaPage.tsx`
- `production/apps/web-portal/src/pages/BusinessCalendarPage.tsx`
- `production/apps/web-portal/src/pages/AutomationRulesPage.tsx`
- `production/apps/web-portal/src/pages/AutomationRulePage.tsx`

Navigation and routes are already wired into:

- `production/apps/web-portal/src/app/AppRoot.tsx`
- `production/apps/web-portal/src/app/AppShell.tsx`

### Persistence added/extended

New Helpdesk-owned entities/tables in the current Step 18 implementation:

- `helpdesk.business_calendar`
- `helpdesk.business_calendar_entries`
- `helpdesk.automation_rules`
- `helpdesk.automation_executions`

Extended:

- `helpdesk.sla_policies`
- `helpdesk.ticket_sla`

Migration already generated:

`Step18HelpdeskSlaAutomation`

Files:

- `production/services/platform-api/src/Modules/Helpdesk/Persistence/Migrations/20260926161847_Step18HelpdeskSlaAutomation.cs`
- matching Designer
- Helpdesk DbContext snapshot updated

No cross-module database FK should be introduced.

### SLA behavior implemented

SLA policies now include:

- response minutes
- resolution minutes
- Business Calendar reference
- applies-to text
- pause on requester wait
- notify requester on status change
- reassign on breach
- escalation level JSON
- active state
- ETag/version

Ticket SLA state now includes:

- pause timestamp
- accumulated paused seconds
- at-risk emission timestamp
- escalation level
- last evaluated timestamp

### Business Calendar implementation

Implemented:

- calendar code/name/timezone
- weekly working windows
- dated exceptions/holidays
- active/default calendar state
- business-time addition/counting

Backend calculator:

`production/services/platform-api/src/Modules/Helpdesk/Infrastructure/BusinessTimeCalculator.cs`

Calendar changes are designed to recalculate unresolved ticket due dates.

### SLA + Automation worker

Worker exists:

`production/services/platform-api/src/Modules/Helpdesk/Infrastructure/HelpdeskSlaAutomationWorker.cs`

Current intended behavior:

- periodic unresolved-ticket SLA evaluation
- detect requester-wait pause
- resume and extend due dates
- calculate SLA elapsed business time
- emit at-risk event
- emit escalation event
- track escalation level
- optional breach reassignment
- evaluate automation rules
- idempotent automation execution history

Development interval recorded in Step 18 manifest: **3 seconds**
Production interval recorded: **30 seconds**

### Events / audit intended by Step 18

Events:

- `sla.at_risk`
- `sla.escalated`

Audit actions:

- `helpdesk.sla_policy.updated`
- `helpdesk.automation_rule.updated`

Automation actions currently bounded to:

- `assign_team`
- `set_priority`
- `escalate_manager_chain`

Automation triggers currently bounded to:

- `ticket_created`
- `ticket_updated`
- `sla_at_risk`
- `status_changed`

### Development seed/config work already present

Current dirty tree also modifies:

- Platform Helpdesk permissions
- Helpdesk seed policies/calendar/rules
- Platform API composition
- Helpdesk module registration
- appsettings for worker timing/config
- React API client/types
- contract version bridges/audits

---

## 6. Current QA state for Step 18

The Step 18 manifest currently records:

- Web typecheck: **PASS**
- Web build: **PASS**
- .NET build: **PASS, 0 warnings / 0 errors**

But these are **recorded intermediate results**, not a final Step 18 closeout.

Because implementation continued after those checks, rerun them before declaring completion.

Still explicitly pending in the Step 18 manifest:

- runtime smoke
- EF pending-model checks
- visual QA
- frozen browser regression
- contract audit chain

Do not mark Step 18 complete until all final gates are rerun after the last code changes.

---

## 7. Step 18 runtime smoke already written

Script:

`production/scripts/step18-local-smoke.py`

The smoke is designed to verify:

- unauthenticated SLA API → 401
- Admin SLA/Automation permissions
- HR user denied manage operations
- SLA policy reads
- Business Calendar reads
- Automation list
- Automation rule create/update
- stale ETag → 412
- P1 ticket creation
- business-time due dates
- automation execution
- temporary 24/7 calendar for accelerated QA
- SLA policy ETag
- requester-wait pause
- resume + due-date extension
- SLA risk/escalation levels
- breach reassignment
- SLA monitor
- audit records
- automation execution history
- no Helpdesk cross-module DB FK
- restoration of shared Development calendar/policy configuration after test

The script ends with:

`STEP18_RUNTIME_SMOKE_PASS`

**It has not yet been recorded as PASS in the manifest. Run it and fix any failures.**

---

## 8. What remains to finish Step 18

Resume in this order.

### A. Protect the current dirty worktree

First inspect:

```bash
cd /Users/adisaip/Desktop/INNO-One-Wireframe
git status --short --branch
git diff --stat
```

Do not reset or discard files.

### B. Create the missing Step 18 audit

Create:

`step18-helpdesk-sla-automation-audit.py`

It should verify at least:

- Implementation Contract 0.9.0
- Step 18 manifest/docs/script exist
- all Step 18 API operation markers exist
- all 5 Step 18 routes exist
- SLA/Calendar/Automation permissions exist
- Step 18 migration exists
- Business Calendar / Automation tables are mapped
- SLA policy/ticket SLA extensions exist
- worker is registered
- no Helpdesk direct Platform/Devices module dependency
- no vendor-ID leakage
- no cross-module DB FK architecture change
- event/audit markers exist
- Web pages/client/routes/navigation exist
- Step 16 deferred re-validation note remains intact

### C. Build current code after the last edits

Run:

```bash
cd /Users/adisaip/Desktop/INNO-One-Wireframe/production
pnpm typecheck
pnpm build
dotnet build INNO.One.sln
```

Required target:

- Web: PASS
- .NET: 0 warnings / 0 errors

### D. EF pending-model checks

Run Helpdesk at minimum, plus Platform if its seed/contract changes warrant verification:

```bash
cd /Users/adisaip/Desktop/INNO-One-Wireframe/production

ASPNETCORE_ENVIRONMENT=Production \
ConnectionStrings__CoreDatabase='Host=localhost;Port=5432;Database=inno_core;Username=inno;Password=inno_dev_only' \
MeshCentral__Enabled=false \
dotnet ef migrations has-pending-model-changes \
  --project services/platform-api/src/Modules/Helpdesk \
  --startup-project services/platform-api/src/INNO.One.PlatformApi \
  --context HelpdeskDbContext
```

Also rerun Platform/Devices pending-model checks if needed.

### E. Restart local API with current Step 18 code

Use Development environment and port 5080.

Verify:

`GET http://127.0.0.1:5080/health/ready`

Expected Implementation Contract:

`0.9.0`

### F. Run Step 18 runtime smoke

```bash
cd /Users/adisaip/Desktop/INNO-One-Wireframe/production
python3 scripts/step18-local-smoke.py
```

Do not shortcut this test. It intentionally mutates and restores Development SLA/calendar data.

Fix the implementation if any assertion fails.

### G. Run Step 18 audit + existing contract chain

At minimum:

- `step18-helpdesk-sla-automation-audit.py`
- `implementation-contract-audit.py`
- `data-model-contract-audit.py`
- `event-audit-contract-audit.py`
- `api-contract-audit.py`
- `production-skeleton-audit.py`

Target: **0 issues**

### H. Static frozen UX audits

Rerun the authoritative static chain from the handoff/current repo.

Target: **0 issues**

### I. Step 18 production visual QA

Inspect these production routes at:

- 1366
- 1024
- 768

Routes:

- `/helpdesk/sla`
- `/helpdesk/calendar`
- `/helpdesk/automation`
- `/helpdesk/automation/new`
- one real `/helpdesk/automation/:ruleId`

Expected: **15 route-width screens**

Check:

- no page-level horizontal overflow
- no clipped controls
- no unnamed visible controls
- correct Helpdesk rail/side-nav active state
- no loading/error state left behind
- tables remain in their table wrapper
- editor Save actions use the canonical editor footer
- permission-gated management navigation stays hidden when unauthorized

### J. Frozen browser regression

Run:

`python3 -u qa-ux-input-browser.py`

Historical baseline:

**124 / 124, failures 0**

Step 18 must not regress the frozen UX baseline.

### K. Final hygiene

Run:

`git diff --check`

Update:

- `INNO-One-Step18-Helpdesk-SLA-Automation.md`
- `inno-step18-helpdesk-sla-automation.json`
- `INNO-One-Next-Chat-Handoff.md`

Only after all gates pass, change Step 18 status to completed.

### L. Git checkpoint

Then:

- stage only intended Step 18 files
- confirm no `node_modules`, `dist`, `bin`, `obj`, `__pycache__`, `*.pyc`
- commit
- push branch

Suggested commit:

`feat: implement helpdesk sla automation`

Branch:

`implementation/step18-helpdesk-sla-automation`

**Do not merge `main` unless the user explicitly requests it.**

---

## 9. Immediate next-chat instruction

When the new chat begins, tell ChatGPT:

> Continue INNO.One from `INNO-One-NEW-CHAT-HANDOFF-2026-09-27.md`. The active branch is `implementation/step18-helpdesk-sla-automation`. Do not reset the dirty working tree. Continue Step 18 from the missing Step 18 audit and final runtime/QA gates.

The new chat should:

1. read the INNO.One Skill,
2. read this handoff,
3. inspect current Git status,
4. continue the existing Step 18 branch,
5. not create a duplicate Step 18 branch,
6. not redo Steps 15–17,
7. not merge main,
8. preserve the deferred Step 16 fresh re-validation gate.

---

## 10. Critical continuity rules

- Repository is the source of truth.
- Frozen UX/UI stays frozen.
- Web Portal / Endpoint Agent / Android Mobile surface boundaries remain intact.
- Permissions answer **WHAT**; Scope answers **WHERE**.
- server authorization is authoritative.
- PostgreSQL business tables use app-generated UUID PKs.
- public API IDs remain opaque.
- no generic tenant_id.
- no cross-module DB FK.
- no module writes another module's tables.
- cross-module reads use contracts/query interfaces/read models.
- Keycloak owns its own DB.
- MeshCentral is vendor-owned persistence and is accessed only through the adapter.
- Helpdesk must not query Platform or Devices tables directly.
- Ticket/reply text must not be copied into audit/event payloads.
- Do not expose MeshCentral vendor IDs through public APIs.
- Do not merge main without explicit user instruction.

## Remote Docker relocation — 2026-09-27

The Step 18 local infrastructure Docker stack was relocated to the Ubuntu host at `172.10.1.58` (user `inno360`). Credentials are intentionally not stored in this repository.

Remote deployment root:

`/home/inno360/INNO.One-Step18/infrastructure/docker`

Remote Compose project: `inno-one-step18`

- PostgreSQL 17: host port `5432`, healthy.
- Keycloak 26.4.0: host port `8080`, realm discovery verified from the Mac.
- MeshCentral 1.2.6: host port `8444`, healthy; `HOSTNAME=172.10.1.58`.
- MeshCentral uses `8444` because the pre-existing INNO.One MeshCentral remains on `8443`.
- The pre-existing `innoone-*` Docker stack was left running and was not replaced or stopped.
- Migrated PostgreSQL databases: `inno_core`, `inno_meeting`, `keycloak`.
- MeshCentral data/files/backups were transferred; migration artifacts are retained under `/home/inno360/INNO.One-Step18/migration`.
- All three new containers use `restart: unless-stopped`; the same policy is persisted in the remote Compose file.
- Mac-to-server connectivity checks passed for PostgreSQL `:5432`, Keycloak `:8080` and MeshCentral `:8444`.

The remote snapshot was taken before the final local Step 18 QA smoke. The Mac has one additional QA-only ticket and automation rule from that final smoke; these test artifacts were intentionally not re-synced to the server.

# Step 19 — Assets Core ✅ COMPLETED 2026-09-27

Branch: `implementation/step19-assets-core`

Implementation Contract: **0.10.0**.

Implemented:

- Assets Overview with scoped inventory / ownership metrics.
- Asset Inventory with search, category/status filtering and server-authoritative scope filtering.
- Asset Detail with canonical inventory fields, linked Device context and ownership history.
- Asset update with ETag / If-Match concurrency.
- Ownership overview, owner list and owner detail.
- Manual ownership change with immutable ownership history.
- Endpoint Agent ownership-submission review queue and decision endpoint.
- Assets-owned persistence for `assets`, `asset_ownership_history`, `ownership_submissions`.
- Platform and Devices reads only through `IPlatformDirectoryReader` / `IDeviceDirectoryReader`.
- No Assets → Platform / Devices / Helpdesk database foreign key.
- `asset.changed` / `ownership.changed` outbox facts and Assets audit actions.
- Step 19 migration applied to remote development PostgreSQL on `172.10.1.58`.

Deferred to later Assets slices:

- Custom Fields
- QR
- Software baselines
- Software licenses
- Contracts / Warranty
- Android Assets Mobile scanner runtime

Final QA:

- Step 19 runtime smoke: **PASS**.
- Step 19 audit: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- EF pending-model checks: **PASS**.
- contract/static audit chains: **0 issues**.
- Assets production visual QA: **21 / 21 screens**, failures 0.
- frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.

Source of truth:

- `INNO-One-Step19-Assets-Core.md`
- `inno-step19-assets-core.json`
- `step19-assets-core-audit.py`
- `production/scripts/step19-local-smoke.py`

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction. No Step 20 work has been started.**

# Step 20 — Asset Custom Fields ✅ COMPLETED 2026-09-27

Branch: `implementation/step20-asset-custom-fields`

Implementation Contract: **0.11.0**.

Implemented:

- Asset-owned custom-field schema editor at `/assets/custom-fields`.
- `GET /assets/custom-fields` and `PUT /assets/custom-fields`.
- Field types: Text, Number, Date, Boolean and Select.
- Immutable field keys, labels, required flag, Endpoint Agent exposure flag, Active/Draft status, select options and display order.
- Existing fields cannot be deleted in this slice; set unused fields to Draft.
- `assets.custom_field_definitions` and `assets.custom_field_values`.
- Asset Detail reads active custom-field schema and values.
- Existing `PATCH /assets/{assetId}` saves standard Asset data and custom values in one version-checked transaction.
- Required/type/select validation is server-authoritative.
- Custom-field schema saves use ETag / If-Match.
- Schema changes audit as `assets.custom_fields.updated` with internal classification.
- Per-asset custom-value changes flow through existing `assets.asset.updated` / `asset.changed`.
- Platform user profiles remain Platform-owned; stale “User Profile Fields” semantics were not carried into production.
- Endpoint Agent rendering remains a separate surface and is not embedded in Web.
- No cross-module database foreign key.

Remote development DB:

- `Step20AssetCustomFields` migration applied to PostgreSQL on `172.10.1.58`.
- Seeded 4 custom-field definitions and 13 example values.
- Runtime DB check: cross-module FK = 0.

Final QA:

- Step 20 runtime smoke: **PASS**.
- Step 20 audit: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- EF pending-model checks for Assets / Platform / Devices / Helpdesk: **PASS**.
- contract/static audit chains: **0 issues**.
- production visual QA: **6 / 6 screens**, failures 0.
- frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.

Deferred to later Assets slices:

- QR labels / QR resolve and Android scanning.
- Software baselines and licenses.
- Contracts / Warranty.
- Endpoint Agent custom-field rendering.

Source of truth:

- `INNO-One-Step20-Asset-Custom-Fields.md`
- `inno-step20-asset-custom-fields.json`
- `step20-asset-custom-fields-audit.py`
- `production/scripts/step20-local-smoke.py`

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction. No Step 21 work has been started.**


# Step 21 — Asset QR Labels & Resolve ✅ COMPLETED 2026-09-27

Branch: `implementation/step21-asset-qr`

Implementation Contract: **0.12.0**.

Implemented:

- Web QR Labels workspace at `/assets/qr-labels`.
- Four-step flow: Select assets → Label setup → Preview → Print.
- Real QR rendering with the Web `qrcode` package.
- Label sizes 50 × 30, 40 × 25 and 60 × 40 mm.
- 1–3 copies per Asset and configurable visible label content.
- Print-media layout outputs physical labels only and hides the INNO.One Web shell.
- `POST /assets/{assetId}/qr-label` using permission `assets.qr.print`.
- `POST /assets/qr/resolve` using permission `assets.qr.scan`.
- QR payload is an opaque 256-bit random value with `inno1_qr_` prefix.
- Only a SHA-256 fingerprint is persisted; the raw QR token is returned only when generated and is never written to audit metadata.
- Regenerating a label revokes the previous active label for that Asset.
- Resolve rejects unknown/revoked/expired values with a generic not-found response.
- Resolve is permission- and scope-filtered before returning Asset data.
- Successful resolves create `assets.qr_scans` history and `assets.qr.scanned` audit records.
- Label generation audits as `assets.qr.generated`.
- `assets.qr_labels` and `assets.qr_scans` are Assets-owned and introduce no cross-module database foreign key.
- Android Assets Mobile scanner remains a separate surface; no Android scanner Web route was added.

Remote development DB:

- `Step21AssetQr` migration applied to PostgreSQL on `172.10.1.58`.
- `assets.qr_labels` and `assets.qr_scans` created.
- QR permissions `assets.qr.print` / `assets.qr.scan` seeded.
- Security verification found zero raw tokens in fingerprint storage or QR audit metadata and zero cross-module DB foreign keys.
- QA QR labels/scans were deleted after testing; audit history was retained.

Final QA:

- Step 21 runtime smoke: **PASS**.
- Step 21 audit: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- EF pending-model checks for Assets / Platform / Devices / Helpdesk: **PASS**.
- contract/static audit chains: **0 issues**.
- production visual QA: **4 / 4 screens**, failures 0.
- frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.

Deferred to later Assets slices:

- Android camera/scanner runtime and mobile scan-history UI.
- Software Baselines.
- Software Licenses.
- Contracts / Warranty.

Source of truth:

- `INNO-One-Step21-Asset-QR.md`
- `inno-step21-asset-qr.json`
- `step21-asset-qr-audit.py`
- `production/scripts/step21-local-smoke.py`

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction. No Step 22 work has been started.**


# Step 22 — Software License Compliance ✅ COMPLETED 2026-09-27

Branch: `implementation/step22-software-licenses`

Implementation Contract: **0.13.0**.

Local implementation completed:

- Web route `/assets/software-licenses`.
- `GET /assets/software-licenses` and `PATCH /assets/software-licenses/{licenseId}`.
- Permission `assets.license.manage`.
- Assets-owned `software_licenses` and `license_allocations` persistence.
- Server-authoritative compliant/overused calculation and estimated gap cost.
- ETag / If-Match concurrency for entitlement updates.
- `assets.license.updated` audit and `license.overused` outbox transition.
- Frozen Web layout: KPI summary, search/compliance/vendor filters, compact license table, allocation detail and entitlement editor.
- Software Baselines remain deferred because the frozen API contract does not yet define a standalone baseline operation/route.

Local QA completed:

- Step 22 audit: **0 issues**.
- Full contract/static audit chain: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- EF pending-model checks for Assets / Platform / Devices / Helpdesk: **PASS**.
- production visual QA: **3 / 3 screens** at 1366 / 1024 / 768, failures 0.
- frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.
- temporary QA authentication bypass was removed; no QA token hook remains in production source.

Remote completion on 2026-09-27:

- Network connectivity returned; SSH and PostgreSQL were reachable from the Mac, and Keycloak realm discovery returned HTTP 200.
- Applied migration `20260927082251_Step22SoftwareLicenses` to the relocated PostgreSQL on `172.10.1.58`.
- Started current Development API against the remote PostgreSQL/Keycloak through a temporary SSH tunnel with MeshCentral sync disabled for this QA run.
- Runtime smoke: **STEP22_RUNTIME_SMOKE_PASS**, covering authorization, summary/filtering, validation, compliant-to-overused transition, stale ETag and restoration.
- Database verification: 4 licenses / 775 entitled seats, 14 allocations / 798 used seats, `assets.license.manage` seeded.
- Audit/outbox verification: 2 internal `assets.license.updated` records, 1 pending `license.overused` event; Assets cross-module foreign keys = **0**.
- Earlier local QA remains: Step 22 audit 0 issues; full static chain 0 issues; Web typecheck/build PASS; .NET 0 warnings/0 errors; EF pending-model PASS; visual QA 3/3; browser regression 124/124.
- Step 22 manifest and documentation record completion.

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction.**


# Step 23 — Contracts & Warranty ✅ COMPLETED 2026-09-27

Branch: `implementation/step23-contracts-warranty`

Implementation Contract: **0.14.0**.

Implemented:

- Web route `/assets/contracts`.
- `GET /assets/contracts` using `assets.view` with effective Assets scope.
- `PATCH /assets/contracts/{contractId}` using `assets.contract.manage`.
- Assets-owned `contracts` and `asset_contract_links` persistence.
- Server-authoritative contract status:
  - active when > 90 days remain;
  - expiring when ≤ 90 days remain;
  - expired after the end date.
- KPI summary for active contracts, 90-day expirations, covered Assets and uncovered Assets.
- Search, status and fiscal-year filters.
- Master-detail contract workspace with covered Asset links.
- Editable vendor, fiscal year, period, service/warranty and support contact fields.
- ETag / If-Match concurrency.
- `assets.contract.updated` internal audit.
- Entering the 90-day window emits one `contract.expiring` event per covered Asset.
- No cross-module database foreign key.

Remote development DB:

- Migration `20260927094430_Step23ContractsWarranty` applied to PostgreSQL on `172.10.1.58`.
- Seeded 3 contracts and 5 Asset-contract links.
- `assets.contract.manage` permission seeded.
- Runtime smoke: **STEP23_RUNTIME_SMOKE_PASS**.
- Database verification observed 2 contract update audits and 2 expiration events.
- Cross-module DB foreign keys for Step 23 tables: **0**.
- Smoke restored the active contract to its original >90-day state.

Final QA:

- Step 23 audit: **0 issues**.
- Full contract/static audit chain: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- EF pending-model checks for Assets / Platform / Devices / Helpdesk: **PASS**.
- production visual QA: **3 / 3 screens**, failures 0.
- frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.

Source of truth:

- `INNO-One-Step23-Contracts-Warranty.md`
- `inno-step23-contracts-warranty.json`
- `step23-contracts-warranty-audit.py`
- `production/scripts/step23-local-smoke.py`

Remaining Assets work:

- Android Assets Mobile scanner runtime / scan-history UI.
- Software Baselines remain deferred until a standalone frozen API/route contract exists.
- Final Assets integration pass across Devices ↔ Assets ↔ Helpdesk ↔ QR ↔ Licenses ↔ Contracts.
- Step 16 fresh re-validation before merge/release.

**Do not merge `main` without explicit user instruction. No Step 24 work has been started.**


# Step 24 — Android Assets Mobile Scanner ⏳ IN PROGRESS 2026-09-27

Branch: `implementation/step24-assets-mobile`

Implementation Contract: **0.15.0**.

Implemented locally:

- Real Expo / React Native Android app under `production/apps/assets-mobile`.
- Expo SDK 57 + React Native 0.86; mobile toolchain requires Node **20.19.4+**.
- Thai Android mobile UI with separate scanner/history/result/error states.
- Camera permission through `expo-camera`.
- QR scanner accepts QR only and calls the frozen `POST /assets/qr/resolve` operation.
- Organization sign-in uses OIDC Authorization Code + PKCE S256.
- Access/refresh tokens use Expo SecureStore.
- QR payloads are never persisted after resolution.
- Device-local recent history stores only Asset display metadata and does not invent a scan-history API.
- Result view uses only data available from the frozen QR Resolve response: Asset identity, owner/org/location, linked endpoint summary, warranty end date and custom fields.
- Android Mobile remains isolated from Web navigation.
- Added Keycloak realm definition for public client `inno-one-assets-mobile` with PKCE S256 and API audience.
- Added the mobile app to the pnpm workspace.
- Software Baselines remain deferred; no new API operation/database table was invented for Step 24.

Local QA completed:

- Step 24 audit: **0 issues**.
- Implementation/API/data/event/skeleton contract audit chain: **0 issues**.
- Mobile TypeScript: **PASS**.
- Expo public config validation under Node 20.19.4: **PASS**.
- Android Expo/Hermes export: **PASS**.
- Production mobile visual QA: **3 / 3** at 430 / 390 / 360, failures 0; 390px screenshot visually reviewed.
- Existing Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- frozen static UX audit chain: **0 issues**.
- `git diff --check`: **PASS**.
- Temporary mobile visual-QA auth/data hooks were removed from production source after screenshot generation.
- Web browser regression was re-run, but the legacy prototype harness produced unrelated timing/state failures outside Step 24. Step 24 changes no Web Portal source; this gate is not being marked cleared from that run.

Current blocker:

- FortiClient connection `VPN` is currently **Disconnected**.
- SSH to `172.10.1.58` times out while the VPN route is absent.
- Therefore the new `inno-one-assets-mobile` client is present in the versioned Keycloak realm definition but has **not yet been registered in the already-running remote Keycloak realm**.
- Real Android OIDC + QR resolve smoke against the remote development environment is still pending.
- Do not mark Step 24 completed until remote Keycloak client registration and live mobile auth/resolve verification pass.

Pending remote gates:

1. restore VPN route to `172.10.1.58`;
2. register/update `inno-one-assets-mobile` in live Keycloak;
3. verify the redirect URI + PKCE login path;
4. verify an `assets.qr.scan` user can resolve a real generated QR token through the live API;
5. verify revoked/invalid QR returns the expected recovery state;
6. close manifest/docs, final commit/push and verify clean working tree.

**Step 16 fresh re-validation remains deferred by explicit user request and is still required before merge/release.**

**Do not merge `main` without explicit user instruction.**


# Step 24 — Android Assets Mobile Scanner ✅ COMPLETED 2026-09-27

Branch: `implementation/step24-assets-mobile`

Implementation Contract: **0.15.0**.

Implemented:

- Real Expo / React Native Android app under `production/apps/assets-mobile`.
- Expo SDK 57 + React Native 0.86; mobile Node requirement 20.19.4+.
- Thai scanner/history/result/error mobile experience.
- Android camera permission and QR-only scanning.
- Reuses frozen `POST /assets/qr/resolve` with `assets.qr.scan`.
- Organization sign-in uses OIDC Authorization Code + PKCE S256.
- Access/refresh tokens use Expo SecureStore.
- QR token is never persisted after resolution.
- Device-local recent history stores Asset display metadata only.
- Result view uses only fields already exposed by the frozen QR Resolve response.
- No new API operation or database table was introduced.
- Android Mobile remains isolated from Web navigation.
- Versioned Keycloak realm includes public client `inno-one-assets-mobile` with PKCE S256 and `inno-one-api` audience.

Remote completion on `172.10.1.58`:

- Registered live Keycloak client `inno-one-assets-mobile`.
- Verified public client + Standard Flow + Direct Access Grants disabled.
- Verified PKCE S256 through a real Authorization Code flow.
- Verified access token contains `inno-one-api` audience.
- Verified refresh-token issuance.
- Started the current Platform API against relocated PostgreSQL/Keycloak through the development tunnel for smoke only.
- Generated a real QR label through `assets.qr.print`.
- Resolved that real QR through a token issued by the Mobile OIDC client.
- Regenerated the label and verified the previous QR returns 404.
- Verified a malformed/unknown opaque QR returns 404.
- Verified the replacement active QR resolves successfully.
- Live marker: **STEP24_LIVE_MOBILE_SMOKE_PASS**.
- Remote DB after smoke: `assets.qr.scan` permission = 1, QR labels observed = 4, resolved QR scans observed = 4, `assets.qr.scanned` audits observed = 7, active HR labels = 1.

Final QA:

- Step 24 audit: **0 issues**.
- Contract/API/data/event/skeleton audit chain: **0 issues**.
- Mobile TypeScript: **PASS**.
- Expo config validation: **PASS**.
- Android Hermes export: **PASS**.
- Android visual QA: **3 / 3** at 430 / 390 / 360, failures 0.
- Existing Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- Frozen static UX audit chain: **0 issues**.
- `git diff --check`: **PASS**.
- The legacy Web input browser harness currently has a pre-existing/flaky Report Builder preview timing failure. Step 24 changes no Web Portal source, so this Web-only harness is recorded as not applicable to Step 24 completion.

Source of truth:

- `INNO-One-Step24-Assets-Mobile.md`
- `inno-step24-assets-mobile.json`
- `step24-assets-mobile-audit.py`
- `production/scripts/step24-live-mobile-smoke.py`

Remaining Assets work:

- Software Baselines remain deferred until a standalone frozen API/route contract exists.
- Final Assets integration pass across Devices ↔ Assets ↔ Helpdesk ↔ QR ↔ Licenses ↔ Contracts.
- Step 16 fresh re-validation before merge/release.

**Do not merge `main` without explicit user instruction. No Step 25 work has been started.**
