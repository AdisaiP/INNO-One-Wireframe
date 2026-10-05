> [!IMPORTANT]
> **Current production override — 2026-10-05 — Step 45M IMPLEMENTED / ANDROID DEVICE VISUAL QA PENDING**
>
> **Step45M Android Mobile bilingual implementation is present** on `implementation/step45m-android-mobile-bilingual`. Read `INNO-One-Step45M-Next-Chat-Handoff.md` and `INNO-One-Step45M-Android-Mobile-Bilingual.md` first. Assets Mobile now resolves `th-TH` / `en-US` from device locale before authentication and from the authenticated Platform profile `locale` afterwards; explicit TH/EN preference writes through `/platform/me/profile`. Scanner, history, Asset result, busy/task state, sign-in, QR error and offline copy are bilingual; business values remain untranslated and the Assets Mobile QR ownership/security boundary is unchanged. Step45M static is **38/38**, Assets Mobile TypeScript PASS, Android Expo export PASS (624 modules, ~1.6 MB HBC), Step45E bilingual browser runtime is **62/62**, and Step45L Agent regression is **54/54** after correcting the shared profile field to `locale`. **Do not mark Step45M fully COMPLETE and do not start Step45N until real Android device/emulator visual QA passes.** The current Windows environment has no `adb` or Android `emulator`; React Native Web is not an authenticated substitute because Expo SecureStore is unavailable there and the Keycloak Mobile client only allows the native redirect scheme. Do not merge to `main` unless explicitly requested.
>
> [!IMPORTANT]
> **Previous production override — 2026-10-05 — Step 45L COMPLETE**
>
> **Step45L Endpoint Agent bilingual runtime is complete** on `implementation/step45l-endpoint-agent-bilingual-runtime`. Read `INNO-One-Step45L-Next-Chat-Handoff.md` and `INNO-One-Step45L-Endpoint-Agent-Bilingual-Runtime.md` first. Endpoint Agent now has a Tauri 2 Windows-first native-host scaffold, React/Vite renderer, Keycloak PKCE session handling, Thai/English runtime, device context, Request Help through the real Helpdesk ticket pipeline, append-only Assets ownership confirmation, durable Remote Consent, offline/error states and an explicit durable `IAgentPromptService` boundary for module/workflow-created prompts. Agent-owned device/prompt/consent APIs require the current authenticated user to own the endpoint; non-owned Helpdesk device relations retain normal Devices permission/scope checks. Authenticated Agent runtime QA passed **54/54 with 9 screenshots** against real Keycloak/PostgreSQL; broad Web Product regression passed **1791/1791 across 68 routes** at 1366/1024/768. QA-created Ticket/ownership evidence is cleaned up and user locale is restored after testing. A runtime auth defect found during QA was fixed by making `getAccessToken()` self-initialize Keycloak. Static/build gates remain green, Devices EF has no pending model changes, and full .NET is **0 warnings / 0 errors**. Windows native packaging is also verified with Rust/Cargo + Visual Studio 2022 Build Tools/MSVC: the Tauri release EXE builds, MSI and NSIS installers are produced, and the native `INNO.One Agent` window smoke test passes. Development installers are currently unsigned; production code signing remains a release-engineering requirement. **Step45J remains deferred. Next is Step45M — Android Mobile bilingual completion.** Do not merge to `main` unless explicitly requested.
>
> [!IMPORTANT]
> **Previous production override — 2026-10-05 — Step 45K COMPLETE**
>
> **Step 45K Reports Product Slice is complete** on `implementation/step45k-reports-product-slice`. Read `INNO-One-Step45K-Next-Chat-Handoff.md` and `INNO-One-Step45K-Reports-Product-Slice.md` first. Reports now owns real P02/P06/P10/P05 routes at `/reports`, `/reports/new`, `/reports/:reportId`, `/reports/:reportId/runs`, and `/reports/schedules`; saved definitions use ETag/versioning; Devices/Assets/Helpdesk data is read only through module-owned source readers with current source permission/scope re-checks; generation persists CSV run output; download is restricted to the same user whose scope generated that output; schedules run daily/weekly/monthly under the creator identity and re-check current permission/scope; EN/TH Reports UI includes localized source/column labels. The shared `IReportGenerationService` accepts trigger=`automation` as an opt-in module integration boundary, but Step45K does not inject a generic Report action into every automation catalog. Final QA: Step45K static **199/199**, API runtime **49/49**, dedicated responsive/bilingual browser **109/109** with **21 screenshots**, broad Product browser **1789/1789 across 68 routes**, Step45A **80/80**, Step45I **152/152**, Step45H **127/127**, Step45G **135/135**, Step45F **135/135**, Step45E **87/87**, Step30 `issues=0`, language/terminology `issues=0`, Web/i18n/UI builds PASS, Reports EF pending model changes none and full .NET solution **0 warnings / 0 errors**. **Step45J Admin Approval Automation is deferred by product decision and was not implemented. Next is Step45L — Endpoint Agent bilingual runtime.** Do not merge to `main` unless explicitly requested.
>
> [!IMPORTANT]
> **Previous production override — 2026-10-05 — Step 45I COMPLETE**
>
> **Step 45I Assets Automation is complete** on `implementation/step45i-assets-automation`. Read `INNO-One-Step45I-Next-Chat-Handoff.md` and `INNO-One-Step45I-Assets-Automation.md` first. Assets owns P02/P04/P10 routes under `/assets/automation`; the focused Product editor is WHEN / optional IF / THEN and does **not** expose React Flow; definitions/runs use shared immutable persistence with `ownerModule=assets`; permissions are `assets.automation.view/manage/run.view`; current source and action permissions are checked before enqueue and re-checked at side-effect time. Supported triggers are lifecycle status, owner-unassigned, warranty expiry, baseline drift and Software License overuse. Supported actions are Asset lifecycle update and cross-module Helpdesk Ticket creation. Asset-created Tickets persist the real `RelatedAssetId`; License-created Tickets intentionally do not create a false Asset relationship. Automatic event-to-run dispatch remains unimplemented; Test Automation is explicit/manual. Final QA: Step45I static **152/152**, API runtime **56/56**, dedicated responsive/bilingual browser **84/84** with **16 screenshots**, broad Product browser **1704/1704 across 65 routes**, Step45H **127/127**, Step45G **135/135**, Step45F **135/135**, Step45E **87/87**, Step45A **78/78**, Step30 `issues=0`, language/terminology `issues=0`, Web/i18n/UI builds PASS and full .NET solution **0 warnings / 0 errors**. QA lifecycle mutations were restored and QA Helpdesk Tickets were deleted and verified absent. **Next is Step 45J — Admin Approval Automation.** Preserve strict Admin privilege boundaries. Meeting remains outside this roadmap. Do not merge to `main` unless explicitly requested.
>
> [!IMPORTANT]
> **Previous production override — 2026-10-05 — Step 45H COMPLETE**
>
> **Step 45H Devices Automation & Remediation is complete** on `implementation/step45h-devices-automation-remediation`. Read `INNO-One-Step45H-Next-Chat-Handoff.md` and `INNO-One-Step45H-Devices-Automation-Remediation.md` first. Devices owns P02/P04/P10 Automation routes under `/devices/automation`; the Product editor is focused WHEN / optional IF / THEN and does **not** expose React Flow; definitions/runs use shared immutable persistence with `ownerModule=devices`; permissions are `devices.automation.view/manage/run.view`; the shared worker re-checks Devices automation permission; `DeviceAutomationNodeExecutor` performs only safe `devices.device.add_to_group` remediation against active INNO.One-owned local static groups with current `devices.manage`, scope, provider-ownership and idempotency checks. High-impact restart/shutdown/script/remote-session automation remains intentionally absent. Final QA: Step45H static **127/127**, dedicated API runtime **38/38**, dedicated responsive/bilingual browser **86/86** with **16 screenshots**, broad Product browser **1647/1647 across 63 routes**, Step45G **135/135**, Step45F **135/135**, Step45E **87/87**, Step45A **78/78**, i18n/UI/Web builds PASS, full .NET solution **0 warnings / 0 errors**. The real API-QA membership mutation was removed and verified with **MEMBERSHIP_REMAINING=0**. Visual inspection passed. **Next is Step 45I — Assets Automation.** Do not merge to `main` unless explicitly requested.
>
> [!IMPORTANT]
> **Previous production override — 2026-10-05 — Step 45G COMPLETE**
>
> **Step 45G Shared Execution + Helpdesk Run History is complete** on `implementation/step45g-shared-execution-helpdesk-run-history`. Read `INNO-One-Step45G-Next-Chat-Handoff.md` and `INNO-One-Step45G-Shared-Execution-Helpdesk-Run-History.md` first. Helpdesk now has a real P10 Run History at `/helpdesk/automation/:automationId/runs`; runs persist separately from definitions and are pinned to immutable workflow ID + version snapshots; `workflow_runs` / `workflow_run_steps` are executed by a shared worker with restart recovery, persisted Wait state, bounded retry, actor RBAC re-check and audit/outbox lifecycle evidence. Helpdesk Assign Team / Escalate nodes perform real ticket side effects through the module boundary with ticket-scope re-check and idempotency. Step45G intentionally executes deterministic linear paths only; Condition/Branch/fan-out/fan-in/cycles return explicit 422 instead of fake execution. Manual ticket-context enqueue is implemented; automatic event-to-run dispatch is not yet implemented because there is no central outbox dispatcher/consumer. Final QA: Step45G static **135/135**, dedicated runtime/browser **52/52** with **5 screenshots**, broad Product browser **1590/1590 across 61 routes**, Web/i18n/ui builds PASS, full .NET solution **0 warnings / 0 errors**, EF pending model changes none, migration SQL PASS. **Next is Step45H — Devices Automation & Remediation.** Keep Devices WHEN / IF / THEN and do not expose full React Flow by default. Meeting remains outside this roadmap.
>
> [!IMPORTANT]
> **Current production override — 2026-10-04 — Step 45F COMPLETE**
>
> **Step 45F Helpdesk Automation Consolidation is complete** on `implementation/step45f-helpdesk-automation-consolidation`. Read `INNO-One-Step45F-Next-Chat-Handoff.md` and `INNO-One-Step45F-Helpdesk-Automation-Consolidation.md` first. Helpdesk owns the P02 Automation list and P06 shared `INNOWorkflowCanvas` builder; definitions/versions are explicitly `ownerModule=helpdesk`; the Helpdesk API facade uses `helpdesk.automation.view/manage`; standalone Dynamic Workflows Product navigation/files are retired; `Automation Core` is technical-only with `launcher:false`; Step18 simple rules migrate into visual definitions; legacy simple-rule API/client is retired and legacy execution is disabled by default while SLA processing remains active. Final QA: Step45F static **135/135**, dedicated browser/runtime **105/105** with **8 screenshots**, broad Product browser **1572/1572 across 60 concrete routes**, Step45E **87/87**, Step45A **78/78**, Step45C **68/68**, Step30 `issues=0`, Web build PASS, .NET **0 warnings / 0 errors**, EF pending model changes none. Visual QA found and fixed the list boundary-spacing issue, then reran dedicated QA clean. **Next is Step45G — Shared Execution + Helpdesk Run History.** Do not revive the old global Step45D direction. Devices remains WHEN / IF / THEN Automation & Remediation first; Reports remains schedule-focused; Meeting remains out of this roadmap.
>
> [!IMPORTANT]
> **Current production override — 2026-10-04 — Step 45C**
>
> **Step 45C Dynamic Workflow Persistence & Versioning is complete** on `implementation/step45c-dynamic-workflow-persistence-versioning`.
>
> Read `INNO-One-Step45C-Next-Chat-Handoff.md` first. Dynamic Workflow now has real server persistence in the `workflows` schema, immutable definition versions, CRUD API, ETag / If-Match optimistic concurrency, append-only create/update/delete audit, and provisioned `workflows.view` / `workflows.manage` permissions. Workflow is installed/enabled and available from the normal Apps launcher; the existing `INNOWorkflowCanvas` remains the Product editor. Execution, workers, retries and run history remain reserved for **Step 45D**. Dedicated QA is **68/68 static, 87/87 browser/runtime**, broad Production is **1628/1628 across 62 concrete routes**, and Design System browser remains **56/56**. Full .NET build is **0 warnings / 0 errors**. Frozen Design System V1.26 / UI Contract 1.20.0 remain unchanged. **Do not merge unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-04 — Step 45B**
>
> **Step 45B Dynamic Workflow Product IA + UI Routes is complete** on `ux/step45b-dynamic-workflow-product-ia`.
>
> Read `INNO-One-Step45B-Next-Chat-Handoff.md` first. Current Production has **64 route definitions**. Dynamic Workflow now has Product IA routes at `/workflows`, `/workflows/new`, and `/workflows/:workflowId`, reusing the Step 44G `INNOWorkflowCanvas` React Flow + ELK foundation. Step 45B remains frontend-only: drafts are React-memory session drafts, there is no Workflow API/persistence/execution, no Publish/Run action, the Workflow manifest is `launcher:false`, and the development seed does not install it. Dedicated QA is **66/66 static, 84/84 browser**, broad Production is **1628/1628 across 62 concrete routes**, and Design System browser remains **56/56**. Next is **Step 45C — Dynamic Workflow Persistence & Versioning**. Frozen Design System V1.26 / UI Contract 1.20.0 remain unchanged. **Do not merge unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-04 — Step 45A**
>
> **Step 45A Production Gap Audit & Roadmap Freeze is complete** on `planning/step45a-production-gap-roadmap`.
>
> Read `INNO-One-Step45A-Next-Chat-Handoff.md` first. Current Production contains **61 real Web route definitions** across Workspace/Core, Admin, Devices, Assets and Helpdesk. Step 45A classifies Dynamic Workflow as foundation-only, Reports and Meeting as backend/service skeletons without Product routes, Endpoint Agent as boundary-only, Assets Mobile as implemented cross-surface, and Forms as backlog-only. The embedded module manifest is realigned to current IA (`Inventory Query`, `Ownership Overview`, `Asset Owners`). The frozen next sequence is **45B Workflow Product IA/UI → 45C Workflow Persistence → 45D Workflow Execution → 46 Reports → 47 Endpoint Agent Runtime → 48 Meeting**. Design System V1.26 / UI Contract 1.20.0 remain unchanged. **Do not merge unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-02 — Step 44E**
>
> **Step 44E Visual Parity is complete** on `ux/step44e-visual-parity`.
>
> Read `INNO-One-Step44E-Next-Chat-Handoff.md` first. Step 44E restores the approved Apps / Assets hero illustrations, retains Workspace / Agent Deployment hero parity, standardizes Production table Action columns on shared `INNORowActions` (with `RouterRowAction` for navigation), removes redundant implementation-oriented explanation blocks, and closes the remaining shared spacing drift. Production remains at **56 concrete routes**. Dedicated QA is **35/35 static and 96/96 browser**; Step 42.2C is **193/193**, Step 42.2D **159/159**, Step 42.2E **256/256**, Step 42.2G **77/77**, Design System browser **56/56**, broad Production **1477/1477 across 56 routes**, and the current static chain is **57/57**. Step36 / Step38 historical browser regressions are also green at **26/26** and **52/52**. UI/Web builds pass. Step 44A now reports only **2 remaining gap classes**: Assets User Profiles IA and Workflow Canvas. Next frozen slice is **Step 44F — Assets Information Architecture**. Frozen Design System V1.26 / UI Contract 1.20.0 remain unchanged. **Do not merge or deploy unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-02 — Step 44D**
>
> **Step 44D Form / Detail Route Remediation is complete** on `ux/step44d-form-detail-route-remediation`.
>
> Read `INNO-One-Step44D-Next-Chat-Handoff.md` first. Step 44D removes invalid permanent side-card / inline editor architecture from Positions, Users, Access Scopes, Contracts and Custom Fields. Production now has 56 concrete routes: Users gained dedicated create/edit routes, Access Scopes gained a dedicated edit route that owns the Step 44C TreeGrid, Contracts gained detail/edit routes, and short Positions / Custom Fields forms use shared dialogs. Dedicated QA is **34/34 static and 102/102 browser**; Step 42.2C is **193/193**, Step 42.2D **159/159**, Step 42.2E **250/250**, Step 44B **65/65**, Step 44C **54/54**, Step 42.2G **77/77**, Design System browser **56/56**, broad Production **1468/1468 across 56 routes**, and the current static chain is **56/56**. UI/Web builds pass. Step 44A now reports **4 remaining gap classes**. Next frozen slice is **Step 44E — Visual Parity**. Frozen Design System V1.26 / UI Contract 1.20.0 remain unchanged. **Do not merge or deploy unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-01 — Step 44B**
>
> **Step 44B Shared Interaction Foundations is complete** on `ux/step44b-shared-interaction-foundations`.
>
> Read `INNO-One-Step44B-Next-Chat-Handoff.md` first. Step 44B implements shared Product foundations for the Step 44A remediation matrix: `INNORowActions`, `INNODialog`, `INNODrawer`, `INNOPurposeNote/INNOInfoCallout`, integrated editor actions with opt-in docking, and shared spacing ownership. Passive explanatory copy is no longer modeled as application state; legacy floating footer chrome and known spacing overrides were removed. Dedicated QA is **65/65 static and 65/65 browser**; Step 42.2G is **77/77**; Design System browser is **56/56**; broad Production regression is **1366/1366 across 51 routes**; the current static chain is **54/54**; UI/Web builds pass. Step 44A now reports **6 remaining gap classes**. Next is **Step 44C — Hierarchy Component Parity**. Frozen Design System V1.26 / UI Contract 1.20.0 remain unchanged. **Do not merge or deploy unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-01 — Step 44A**
>
> **Step 44A Screen Interaction Architecture Audit is complete** on `ux/step44a-screen-interaction-architecture`.
>
> Read `INNO-One-Step44A-Next-Chat-Handoff.md` first. Step 44A reclassifies all 51 concrete Production routes by P01–P10 interaction architecture and freezes the correct route/modal/drawer/master-detail/tree/treegrid/builder decisions before visual remediation. The source audit confirms all 9 reported gap classes in current Production: side-card form/detail misuse, floating-card editor footer appearance, explanatory `INNOState` misuse, row-action inconsistency, spacing drift, missing hero illustration parity, missing Workflow Canvas foundation, missing Tree/TreeGrid production wrappers, and Assets User Profiles IA ambiguity. Dedicated Step 44A QA is **60/60 with 0 failures**; 4 routes are Critical and 11 are High priority. Frozen Design System V1.26 / UI Contract 1.20.0 remain unchanged. **Do not merge or deploy unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-01 — Step 43**
>
> **Step 43 Inventory Query is complete** on `implementation/step43-inventory-query`.
>
> Read `INNO-One-Step43-Next-Chat-Handoff.md` first. Step 43 implements real Saved Queries → Query Builder → shared Operation polling → materialized Results at `/devices/query`, backed only by the existing Devices software inventory source. Runtime Implementation Contract is 0.32.0; frozen Design System V1.26 / UI Contract 1.20.0 / API Contract 0.5.0 / Data Model Contract 0.6.0 are unchanged. Dedicated QA is 69/69 static, 35/35 runtime and 32/32 browser; Step 42.2G remains 77/77; broad Production regression final rerun is 1366/1366 across 51 existing routes; Web/UI builds and Platform API Release build pass. Meeting remains deferred. **Do not merge or deploy unless explicitly requested.**
>
> [!IMPORTANT]
> **Previous production override — 2026-10-01 — Step 42.2H**
>
> **Step 42.2H Final Structural Visual QA is complete** on `ux/step42.2h-final-visual`.
>
> Read `INNO-One-Step42.2H-Next-Chat-Handoff.md` first. Step 42.2 structural fidelity is now closed through A–H. Final evidence covers 51 Production routes at 1366 / 1024 / 768 with an exact 153-image top screenshot matrix, bottom-state captures for every scrollable route, compact Context Sidebar open-state evidence, viewport-clipping checks, and document/main/chrome scroll ownership. Dedicated Step 42.2H browser QA is 2206/2206 with 0 failures and its static guard is 21/21. Existing A–G regressions remain green (12/12, 117/117, 213/213, 183/183, 250/250, 174/174, 77/77), Design System browser QA is 56/56, broad Production regression is 1366/1366 across 51 routes, the full static chain is 51/51, and build/typecheck/production build are green. Visual review found no product UI defect requiring a Production source change in 42.2H. `main` still contains Step 42.2B and earlier at `8e5be5e`; Steps 42.2C–42.2H are not merged yet. The next feature slice is **Step 43 — Inventory Query**, consuming the Step 41 shared Operation resource. Meeting remains deferred. **Do not merge or deploy unless explicitly requested.**

> [!IMPORTANT]
> **Current production override — 2026-09-29**
>
> Production Steps **15–28 are implemented**, **Step 29 React UI Parity is completed**, **Step 30 Module SDK / Plugin Contract Foundation is completed**, **Step 31 Admin Center Core is completed**, **Step 32 Admin Integrations Center is completed**, **Step 33 Audit Center is completed**, **Step 34 Security Center is completed**, **Step 35 Branding Foundation is completed**, **Step 36 Platform Settings Foundation is completed**, **Step 37 Platform Notification Center is completed**, **Step 38 Global Search is completed**, **Step 39 Workspace Home is completed**, **Step 40 Profile & Settings is completed**, **Step 41 Asynchronous Operation Resource is completed**, **Step 42 Production UX/UI Reconciliation is completed**, and **Step 42.1 Wireframe Fidelity Pass is completed** on `ux/step42.1-wireframe-fidelity`.
>
> Read `INNO-One-Step42.1-Next-Chat-Handoff.md` first. Step 42.1 restores visual fidelity between the frozen HTML wireframes and Production React rather than treating consistency audits as proof of visual parity. Shared page rhythm, shell density, Workspace, Admin Overview, Notifications, Profile proportions, Agent Deployment, Ticket Create, resource breadcrumbs and Device/Asset detail tabs were reconciled against the canonical 1366px baseline and rechecked at 1024 / 768. Unsupported controls were not reintroduced; Profile preferences remain hidden without persistence and Helpdesk Automation remains a bounded Trigger → Condition → Action editor. Final broad browser QA is 1251/1251, detail QA is 156/156, Step 42.1 fidelity QA is 96/96, detailed shell/empty-state QA is 38/38, micro-spacing QA is 630/630, and the full static chain is 43/43. The next feature slice is Step 43 Inventory Query using the Step 41 operation resource. React Flow remains reserved for a future true branching workflow canvas. Meeting remains intentionally deferred. **Do not merge or deploy unless explicitly requested.**

# INNO.One — Next Chat Handoff

Last updated: 2026-09-29
Current project: `C:\Projects\INNO-One-Wireframe` on Windows
Current production scope: **Implementation complete through Step 42.1 Wireframe Fidelity Pass** — frozen UX baseline remains Design System V1.26 / UI Contract 1.20.0. Historical UX-only sections below are retained as project history.

---

## 1. เป้าหมายของ Project ตอนนี้

INNO.One กำลังถูกปรับจาก TOR coverage prototype ให้กลายเป็น UI/UX ที่ดูและทำงานเหมือนระบบ Production จริงมากขึ้น

หลักที่ล็อกไว้แล้ว:

> **One screen = one primary job**

ไม่เอา List + Edit Form + Settings + Monitor + History มากองรวมในหน้าเดียวอีก

และต้องรักษา Product Surface แยกกันให้ชัดเจน:

- Web Portal
- Endpoint Agent
- Android Mobile

กฎสำคัญ:

> **Share contracts, not navigation.**

---

## 2. Current UI Baseline

- Design System: **V1.26**
- UI Contract: **1.20.0**
- Registry Schema: **10**

Source of truth หลัก:

- `design-system.html`
- `inno-design-system.css`
- `inno-design-contract.js`
- `inno-interactions.js`
- `inno-inputs.js`
- `inno-states.js`
- `inno-responsive.js`
- `inno-navigation.js`
- `INNO-One-Final-Visual-QA-Baseline.md`
- `INNO-One-Action-Layout-Contract.md`
- `action-layout-audit.py`
- `INNO-One-Accessibility-Contract.md`
- `accessibility-audit.py`
- `INNO-One-Availability-Contract.md`
- `availability-audit.py`
- `INNO-One-Language-Terminology-Contract.md`
- `language-terminology-audit.py`
- `INNO-One-Interaction-Feedback-Contract.md`
- `interaction-feedback-audit.py`
- `INNO-One-Table-List-Density-Contract.md`
- `table-list-density-audit.py`
- `INNO-One-State-Coverage-Contract.md`
- `state-coverage-audit.py`
- `inno-icons.js`
- `INNO-One-Design-System-V1-Frozen.md`
- `INNO-One-Surface-Boundaries.md`
- `INNO-One-Special-UI-Components.md`
- `INNO-One-UI-Prototype-Summary.md`
- `INNO-One-Screen-Architecture-Refactor-Plan.md`

---

## 3. Screen Pattern ที่ใช้เป็นมาตรฐาน

ทุกหน้าควรระบุได้ว่าใช้ Pattern ไหน

| Code | Pattern | ใช้กับ |
| --- | --- | --- |
| P01 | Overview | สรุป Module / Entry points |
| P02 | List | ค้นหา/เลือกหลายรายการ |
| P03 | Resource Detail | ดู Resource เดียว + Tabs |
| P04 | Create / Edit | Form สำหรับ Resource เดียว |
| P05 | Settings | Configuration domain |
| P06 | Builder | Query / Report / Workflow builder |
| P07 | Monitor / Operations | งาน real-time / operational |
| P08 | Wizard | งานหลายขั้นตอน |
| P09 | Master–Detail | Tree/List + selected detail |
| P10 | History / Log | Timeline / audit / execution log |

Form rule:

- 1–5 fields → Dialog / Drawer ได้
- 6–12 fields → Dedicated page
- หลาย section / conditional logic → Dedicated page
- Sequential task → Wizard / `INNOStepper`
- History ไม่ควรกองท้าย Form
- Preview อยู่ข้าง Editor ได้ เฉพาะตอน preview สิ่งเดียวกับที่กำลังแก้

---

## 4. Screen Architecture Refactor ที่ทำแล้ว

### Helpdesk Notifications

แยกจากหน้าเดียวที่ยำทุกอย่าง เป็น:

- `helpdesk-notifications.html` — Rule list
- `helpdesk-notification-rule.html` — Rule editor
- `helpdesk-notification-templates.html` — Template list
- `helpdesk-notification-template.html` — Template editor + live preview
- `helpdesk-notification-delivery.html` — Delivery log
- `helpdesk-notification-settings.html` — Channel / retry settings

### Helpdesk Configuration

- `helpdesk-settings.html` — Overview
- `helpdesk-categories.html` — Category Tree + selected category editor
- `helpdesk-statuses.html` — Status list + transitions
- `helpdesk-requester-groups.html` — Master–Detail
- `helpdesk-calendar.html` — Business hours / holidays

### Device Alerts

- `device-alerts.html` — Active monitor
- `device-alert-rules.html` — Rule list
- `device-alert-rule.html` — Rule editor
- `device-alert-channels.html` — Console / Sound / Email
- `device-alert-history.html` — History

### Deployment Jobs

- `deployment-jobs.html` — Job list
- `deployment-new.html` — 6-step Wizard
- `deployment-job-detail.html` — Job detail

Wizard:

1. Type
2. Targets
3. Payload
4. Schedule
5. Options
6. Review

### Agent Maintenance

- `agent-maintenance.html` — Overview
- `agent-updates.html`
- `agent-rollout-new.html`
- `software-maintenance.html`
- `software-maintenance-new.html`
- `restart-operations.html`
- `restart-schedule.html`
- `maintenance-history.html`

### Remote Consent

- `remote-consent.html` — Overview
- `remote-consent-policy.html` — Policy
- `remote-consent-message.html` — Message + Endpoint Preview
- `remote-consent-rules.html` — Bypass Rules
- `remote-consent-history.html` — Audit / decisions

### Access Scopes

- `access-scopes.html` — Assignment list
- `access-scope-edit.html` — Assignment editor
- `access-scope-browser.html` — TreeGrid / hierarchy browser
- `access-scope-evaluate.html` — Evaluate Access utility

### Asset Ownership

- `asset-ownership.html` — Overview
- `asset-users.html` — User list
- `asset-user-detail.html` — User detail
- `asset-ownership-submissions.html` — Endpoint Agent submissions
- `asset-custom-fields.html` — Custom field definitions

### Inventory Query

`device-query.html` ปรับเป็น Builder-centric layout:

- Saved Queries / Fact Types = supporting area
- Query Builder = primary job
- Results = output area

---

## 5. หน้าที่ intentionally ไม่แตก

หน้าต่อไปนี้ข้อมูลเยอะ แต่ Primary Job ชัดเจนอยู่แล้ว:

- `device-detail-v2.html` → P03 Resource Detail
- `asset-detail.html` → P03 Resource Detail
- `meeting-detail.html` → P03 Resource Detail
- `ticket-new.html` → P04 Create
- `report-builder.html` → P06 Builder
- `remote-session.html` → P07 Operations

อย่าแตกหน้าเหล่านี้โดยไม่มีเหตุผล UX ชัดเจน

---

## 6. Illustration System ที่ทำแล้ว

มี SVG local อยู่ที่:

`illustrations/`

Hero / spacious pages ใช้ illustration แบบ controlled เช่น:

- Workspace
- App Launcher
- Meeting
- Knowledge Base
- Assets Overview
- Device setup

State illustrations:

- no results
- empty files
- success / healthy
- notifications empty

กฎ:

- ไม่ใส่ decorative illustration ในหน้าที่เป็น operational/dense เช่น:
  - Remote Session
  - Device Detail
  - Ticket Detail
  - Permissions
  - Workflow canvas

---

## 7. Special UI Component Decision

ใช้ component ตามชนิดข้อมูล ไม่ใช่ตามความสวย

- Fixed ordered sequence → `INNOStepper`
- Chronological events → `INNOTimeline`
- Lifecycle state → `INNOStatusStepper`
- Nested hierarchy → `INNOTree`
- Hierarchy + columns → `INNOTreeGrid`
- Organization reporting line → `INNOOrgChart`
- Editable branching workflow → `INNOWorkflowCanvas`
- BPMN 2.0 จริง ๆ → `INNOBpmnDesigner`

Library direction:

- React Flow + ELK.js → Workflow
- TanStack Table → TreeGrid/Data Table
- React Arborist → Tree
- d3-org-chart → Org Chart
- bpmn-js → BPMN only

ดูรายละเอียดใน:

`INNO-One-Special-UI-Components.md`

---

## 8. Surface Boundary

### Web Portal

Workspace / Devices / Assets / Helpdesk / Meeting / Reports / Admin

### Endpoint Agent

- Request Help
- Ownership Confirmation
- Runtime Remote Consent

Files:

- `helpdesk-agent-request.html`
- `agent-ownership-confirmation.html`

### Android Mobile

- Asset QR scanner
- Mobile asset lookup

File:

- `asset-mobile.html`

ห้ามเอา Agent/Mobile operational screen กลับไปใส่ใน Web navigation

---

## 9. QA ล่าสุด

หลัง Screen Architecture Refactor:

- Modern prototype pages: **78**
- Source-of-truth files: **15**
- Design audit issues: **0**
- Missing HTML links: **0**
- Inline JS errors: **0**
- New route metric failures: **0**

ทดสอบ representative routes ที่ 1366px / 768px แล้ว:

- page overflow = false
- rail active = 1
- sidebar active = 1
- UI contract = 1.12.0

Historical QA screenshot folders were removed after the final freeze.

Current canonical visual baseline:

- `qa-final-visual/`

---

# 10. สิ่งที่ต้องทำต่อในแชทใหม่

## NEXT 1 — Navigation / Placeholder / Dead Action Cleanup ✅ COMPLETED 2026-09-24

รอบนี้ทำเสร็จแล้ว และ NEXT 2 เป็นงานถัดไป

เป้าหมาย:

- หา `href="#"`
- หา Coming Soon
- หา button ที่กดแล้วไม่มี behavior
- หา fake link
- หา action ซ้ำ
- หา route ที่ไม่สัมพันธ์กับ Information Architecture ใหม่
- ตรวจ Breadcrumb / Back behavior
- ตรวจ Side navigation ของ child routes ใหม่
- ตรวจ Web / Agent / Mobile boundary อีกครั้ง

แนวทาง:

1. สแกนทุก 78 หน้า
2. ทำ inventory ของ placeholder/dead actions
3. แก้ route จริงก่อน
4. ถ้ายังไม่มี screen จริง ให้ Disabled + Coming Soon อย่างชัดเจน
5. ห้ามปล่อย clickable UI ที่ไม่ทำอะไร

ผล cleanup ล่าสุด:

- สแกน modern prototype ครบ 78 หน้า
- Missing local HTML links = 0
- Web → Agent/Mobile route leak = 0
- Legacy route leak = 0
- Runtime raw `href="#"` = 0
- Dead `.btn` ที่ไม่มี behavior ถูก disable เพิ่ม 85 จุด
- ปุ่มที่มี canonical route จริงใน Devices ถูกเปลี่ยนเป็น route จริง 4 action
- Disabled navigation placeholder รวม 93 จุดใน 64 หน้า และแสดง Coming Soon ชัดเจน
- Design System audit = 0 issues
- Inline JS syntax errors = 0 จาก 53 inline scripts
- Visual smoke QA = 5 representative routes × 1366/768 = 10 screenshots ใน `qa-final-visual/` (historical run screenshots removed after freeze)
- Representative nav metrics: Rail active = 1, Sidebar active = 1, raw placeholder = 0

---

## NEXT 2 — Component Consistency Pass ✅ COMPLETED 2026-09-24

รอบ Component Consistency ทำเสร็จแล้ว และ NEXT 3 เป็นงานถัดไป

Baseline ที่ใช้ตรวจ:

### Page Header

มาตรฐาน:

- Eyebrow
- H1
- Subtitle
- 1 Primary Action
- 0–2 Secondary Actions

ห้ามมี Save หลายจุดใน visual level เดียว

### Buttons

Standardize:

- Primary
- Secondary
- Ghost
- Danger
- Icon-only

ตรวจ:

- ขนาด
- icon position
- label
- disabled state
- hover/focus state

### Tables

ให้ใช้ pattern เดียวกัน:

- Search
- Filters
- Column controls
- Bulk action
- Pagination
- Empty state
- No-results state
- Error state
- Partial failure

### Forms

ตรวจ:

- Label alignment
- input/select/textarea height
- required indicator
- help text
- validation
- section spacing
- sticky save footer
- unsaved state

### Tabs / Subnav

- sibling views เท่านั้น
- horizontal scroll บนจอแคบ
- active state เหมือนกันทั้งระบบ

### Dialog / Drawer

- Drawer สำหรับ contextual edit สั้น ๆ
- Dialog สำหรับ confirm/focused task
- Form ใหญ่ไป Dedicated page

ผล Component Consistency ล่าสุด:

- Modern prototype = 78 หน้า / Web Portal = 74 หน้า
- Page Header ที่ตรวจด้วย shared contract = 68 ชุด; Eyebrow / H1 / Subtitle inconsistencies = 0
- Buttons = 256; standardized height / variants / disabled / focus state ผ่าน audit
- Fields = 132; control height 36px + label/control semantics ถูก normalize ใน shared layer
- Tables = 45; ทุก `.table` อยู่ใน `.table-wrap`; table headers ได้ semantic `scope=col`
- Section Subnav = 36 ชุด; active state ใช้ visual language เดียวกับ Tabs และรองรับ horizontal overflow
- Canonical tabsets = 6 ชุด; keyboard behavior เดิมคงไว้
- Sticky editor/form action areas = 18 จุด
- ย้าย Save ออกจาก Page Header เข้า editor sticky actions ใน Asset User, Alert Channels, Helpdesk Calendar, Notification Settings, Remote Consent Message และ Remote Consent Policy
- `report-builder.html` และ `ticket-new.html` ใช้ sticky form footer สำหรับ commit actions
- Dialog / Drawer ถูก normalize role / modal semantics และ responsive behavior
- เพิ่ม shared visual contract สำหรับ Unsaved / Saving / Saved; dirty tracking + leave-page confirmation จงใจเลื่อนไป NEXT 4
- เพิ่ม `component-consistency-audit.py` สำหรับ regression QA รอบนี้
- Design System audit = 0 issues
- Component Consistency audit = 0 issues
- Shared/inline JavaScript syntax QA = 0 errors
- Browser smoke QA 8 representative routes × 1366/768 = 16 screenshots; page overflow = false และ Rail/Sidebar active ถูกต้อง
- Final visual correction ของ routed Subnav ตรวจเพิ่มที่ 1366/768 และผ่าน
- QA screenshots อยู่ที่ `qa-final-visual/` (historical run screenshots removed after freeze)

ยังไม่ทำ Backend และยังไม่เปลี่ยน frozen component API / route architecture

---

## NEXT 3 — Density / Spacing / Typography ✅ COMPLETED 2026-09-24

รอบ Density / Spacing / Typography ทำเสร็จแล้ว และ NEXT 4 เป็นงานถัดไป

ตรวจทั้งระบบ:

- page max width
- content width
- vertical rhythm
- section spacing
- card padding
- card nesting
- table row height
- form density
- Thai/English typography
- heading hierarchy
- excessive whitespace
- overly dense regions

สำคัญ:

> อย่าแก้ความโล่งด้วยการใส่ Card หรือ Illustration เพิ่มอย่างเดียว

ต้องดูว่า whitespace เกิดจาก:
- content architecture
- max-width
- grid
- missing supporting information
- bad alignment
- over-separated sections

ผล Density / Spacing / Typography ล่าสุด:

- Web Portal ตรวจครบ 74 หน้า จาก modern prototype 78 หน้า
- กำหนด content max-width = 1520px เพื่อไม่ให้หน้า stretch เต็ม 1920px มากเกินไป
- เพิ่ม spacing tokens ตาม frozen scale 4 / 8 / 12 / 16 / 24 / 32 และ normalize inline spacing ที่หลุด scale
- Inline off-scale spacing หลังแก้ = 0
- Inline typography ต่ำกว่า 10px ใน Web surface = 0
- Nested card/panel surfaces = 0; ไม่แก้ whitespace ด้วยการซ้อน card เพิ่ม
- Normalize page/content gutter, Page Header, panel/card padding, section gap, form gap และ editor spacing ใน shared CSS
- คง frozen control height 36px และ table row 48px ไว้เหมือนเดิม
- เพิ่ม Thai/English font fallback และ body line-height 1.45 เพื่อให้อ่านภาษาไทยได้สบายขึ้น
- เพิ่ม readability ให้ primary operational metadata ใน Architecture pages, Inventory Query, Agent Maintenance, Scoped Access, Alerts, Remote Consent และ Remote Session collaboration
- Embedded mock content เช่น remote screen/email-style preview จงใจคง miniature scale แยกจาก primary UI
- Data-driven whitespace เช่น Access Scopes ที่มีเพียง 2 rows ถูกคงไว้ ไม่ใส่ card/illustration ปลอมเพื่อเติมพื้นที่
- เพิ่ม `density-spacing-audit.py` สำหรับ regression QA
- Design System audit = 0 issues
- Component Consistency audit = 0 issues
- Density / Spacing / Typography audit = 0 issues
- Browser smoke QA 8 representative routes × 1366/768 = 16 screenshots; page overflow = false และ Rail/Sidebar active ถูกต้อง
- Wide-screen QA ที่ 1920px ยืนยัน contentWidth = 1520px / contentMax = 1520px และไม่มี page overflow ใน Workspace, Fleet Overview และ Remote Session
- QA screenshots รวม 26 ภาพ อยู่ที่ `qa-final-visual/` (historical run screenshots removed after freeze)

ยังไม่ทำ Backend และยังไม่เปลี่ยน frozen component API / route architecture

---

## NEXT 4 — Interaction Consistency ✅ COMPLETED 2026-09-24

รอบ Interaction Consistency ทำเสร็จแล้ว และ NEXT 5 เป็นงานถัดไป

Behavior ที่ใช้เป็น baseline:

- Save / Saved / Saving
- Validation
- Unsaved changes
- Cancel
- Delete confirm
- Retry
- Filters + reset
- Bulk select
- Toast
- Error state
- Permission state
- Loading / Skeleton
- Partial failure

ผล Interaction Consistency ล่าสุด:

- Web Portal = 74 หน้า / modern prototype = 78 หน้า
- Active commit controls ที่ใช้ shared `data-inno-save` = 23 จุด
- Page-local inline commit handlers = 0
- Legacy Web `showToast()` / `ds-toast` = 0; Web feedback ใช้ shared `INNOToast`
- Save flow กลางรองรับ Saving → Saved → idle และ recoverable Error โดย preserve input/dirty state
- Dirty tracking ทำงานกับ input/select/textarea, checkbox/settings toggles, field chips และ semantic mode toggles
- Unsaved changes มี indicator กลาง + confirm ก่อน Cancel / navigation / close dialog และ `beforeunload` fallback
- Validation กลางรองรับ native `required` / `data-inno-required`, field-level error, `aria-invalid` และ focus ไป field แรกที่ผิด
- `ticket-new.html` เป็น representative validation flow ด้วย Subject + Description required และ Create Ticket แบบ async save → navigate
- Filters = 8 triggers; Apply เก็บ applied values, reopen แล้วยังอยู่ และ Reset คืนค่า default พร้อม update badge
- Canonical bulk selection = 2 tables (Devices / Asset Inventory); select-all, indeterminate, selected count, row state และ bulk bar ใช้ shared behavior
- Search targets = 7; shared search filtering + No Results state + Escape clear
- Destructive confirmations = 16 contract markers; active danger action ใช้ shared confirmation
- Partial failure เพิ่ม shared retry flow พร้อม succeeded/failed metrics และ resolved state
- Standard query states รองรับ `uiState=loading`, `permission`, `error`, `partial` และ offline/disabled เดิมยังคงอยู่
- Dialog editor เช่น Remote Consent Bypass Rules รองรับ dirty-close confirmation และ save-then-close
- Toast จำกัด stack, warning/error ใช้ assertive alert semantics, success/info ใช้ polite status
- เพิ่ม `interaction-consistency-audit.py` สำหรับ static regression QA
- เพิ่ม `qa-interaction-browser.py` สำหรับ real browser interaction regression ผ่าน Chrome DevTools
- Design System audit = 0 issues
- Component Consistency audit = 0 issues
- Density / Spacing / Typography audit = 0 issues
- Interaction Consistency audit = 0 issues
- Functional browser QA = 33 checks / 0 failures
- Functional interaction screenshots = 13 ภาพ
- Layout regression = 8 representative routes × 1366/768 = 16 screenshots; page overflow = false และ Rail/Sidebar active ถูกต้อง
- QA screenshots รอบนี้รวม 29 ภาพ อยู่ที่ `qa-final-visual/` (historical run screenshots removed after freeze)

ยังไม่ทำ Backend และยังไม่เปลี่ยน frozen component API / route architecture

---

## NEXT 5 — Responsive Pass ✅ COMPLETED 2026-09-24

รอบ Responsive Pass ทำเสร็จแล้ว และ NEXT 6 เป็นงานถัดไป

Web Portal baseline:

- 1366 desktop
- 1024 compact desktop
- 768 narrow portal

Endpoint Agent และ Mobile ทดสอบแยกตาม Surface

ตรวจ:

- sidebar collapse
- table overflow
- sticky action
- editor/preview stacking
- wizard stepper
- Master–Detail collapse
- toolbar wrapping

ผล Responsive Pass ล่าสุด:

- Web Portal = 74 หน้า / modern prototype = 78 หน้า
- Full route regression = 74 หน้า × 1366 / 1024 / 768 = 222 combinations
- Full route responsive failures = 0
- 1366 ใช้ inline contextual sidebar และรองรับ collapse / expand
- 1024 และ 768 ใช้ contextual sidebar แบบ overlay; open / backdrop / Escape close ผ่าน browser QA
- Table overflow ถูกกักอยู่ใน `.table-wrap`; 1024 มี scrollable tables 4 จุด และ 768 มี 24 จุด โดยไม่มี page-level horizontal overflow
- Sticky action areas = 18 จุด; narrow footer อยู่ใน viewport และไม่ล้นความกว้าง
- Report Builder: 1366 = 2 columns, 1024/768 = stacked
- `arch-editor` editor/preview: 1366 = side-by-side, 1024/768 = stacked
- Master–Detail `arch-split-list`: 1366 = split, 1024/768 = stacked
- Deployment 6-step wizard: 1024 = 3 columns × 2 rows, 768 = 2 columns × 3 rows
- Agent rollout 4-step wizard แก้ inline grid เป็น shared modifier `arch-stepper-4`; 1024/768 = 2 columns × 2 rows
- Narrow table/panel search header ถูก normalize ให้ขึ้นเต็ม row; แก้ overflow จริงใน Alert Rules, Notification Templates และ Roles & Permissions
- 768 data toolbar ให้ search กว้างเต็ม row และ controls wrap โดยไม่เกิด toolbar/page overflow
- Endpoint Agent ทดสอบแยก 2 surfaces ที่ 820 / 640 / 390; 820 คง window shell และ 640/390 เปลี่ยนเป็น full-width one-column compact layout; page overflow = 0
- Android Mobile ทดสอบที่ 430 / 390 / 360; full-width phone shell + local horizontal tabs; page overflow = 0
- Surface boundary ยังคงถูกต้อง: Web 74 / Agent 2 / Mobile 1 และ Agent/Mobile ไม่โหลด Web shell/navigation
- เพิ่ม `responsive-pass-audit.py`, `qa-responsive-baseline.py`, `qa-responsive-browser.py`
- Design System audit = 0 issues
- Component Consistency audit = 0 issues
- Density / Spacing / Typography audit = 0 issues
- Interaction Consistency audit = 0 issues
- Responsive Pass audit = 0 issues
- Responsive browser behavior QA = 43 checks / 0 failures
- Responsive visual screenshots = 33 ภาพ อยู่ที่ `qa-final-visual/` (historical run screenshots removed after freeze)

ยังไม่ทำ Backend และยังไม่เปลี่ยน frozen component API / route architecture

---

## NEXT 6 — Final Visual QA ✅ COMPLETED 2026-09-24

Historical NEXT 6 baseline was frozen at **Design System V1.18 / UI Contract 1.12.0**. The current accepted baseline is **Design System V1.24 / UI Contract 1.18.0** after Accessibility + Availability + Language/Terminology + Interaction/Feedback + Table/List Density + State Coverage final polish.

Checklist ที่ทำครบ:

1. screenshot ทุก canonical route
2. screenshot important states
3. compare visual consistency
4. ตรวจ overflow
5. ตรวจ dead control
6. ตรวจ active nav
7. ตรวจ Design Contract
8. freeze baseline ใหม่

ผล Final Visual QA:

- Canonical route screenshots = **97**: Web Portal 93 + Design System 1 + Endpoint Agent 2 + Android Mobile 1
- Important state screenshots = **14**
- Frozen screenshot baseline รวม = **111 ภาพ**
- `qa-final-visual.py` frozen manifest = **127 browser checks / 0 failures**
- Screenshot manifest hash verification = **111 / 111**
- ทุก Web route: page overflow = false, Rail active = 1, Sidebar active = 1, raw placeholder = 0
- Web shell canonical 1366px: Rail 60px / Sidebar 216px / Platform Header 56px ทุก 93 route
- Final dead-control review แก้ Saved Query, Category Tree, Requester Groups, Upcoming Meeting, Ticket composer และ Mobile history/action ที่ยังไม่สมบูรณ์
- Important states ที่ Freeze: Loading, Partial, Permission, Disabled, Error, Offline, No Results, Validation, Unsaved Confirm, Filter Drawer, Bulk Selection, Destructive Confirm, Select Open
- Visual contact sheets review ครบ Platform/Admin, Devices, Assets/Reports, Helpdesk/Meeting และ important states
- Design System audit = 0 issues
- Component Consistency audit = 0 issues
- Density / Spacing / Typography audit = 0 issues
- Interaction Consistency audit = 0 issues
- Responsive Pass audit = 0 issues
- Final Visual audit = 0 issues
- Final baseline อยู่ที่ `qa-final-visual/` และ contract อธิบายใน `INNO-One-Final-Visual-QA-Baseline.md`

**สถานะ UI Prototype ปัจจุบัน: ✅ FINAL UX/UI FROZEN AT V1.26 / CONTRACT 1.20.0 — STEP 8 COMPLETE — READY FOR IMPLEMENTATION HANDOFF — BACKEND STILL PAUSED**

หมายเหตุ: Backend planning documents may exist on a separate branch, but the user explicitly paused Backend work. Do not resume Backend unless the user asks again.

---

# 11. หลัง UI Freeze — สิ่งที่ไม่ควรทำแบบอัตโนมัติ

หลัง Freeze **อย่าเปลี่ยน UI baseline แบบไม่มี version/review** และอย่าเพิ่งเขียน Backend แบบ ad-hoc ก่อนทำ API / Event / Permission mapping จาก UI Contract:

- อย่าเริ่ม Backend implementation ก่อนตกลง Backend Architecture + API/Event contract
- เพิ่ม TOR page ใหม่โดยไม่จำเป็น
- เพิ่ม Illustration ทุกหน้า
- แตก Resource Detail ที่โครงสร้างดีอยู่แล้ว
- เปลี่ยน Design System direction ใหม่
- รวม Agent/Mobile กลับเข้า Web
- rewrite CSS ทั้งไฟล์แบบ blind overwrite

Prototype CSS เป็น append-heavy อยู่แล้ว ต้องแก้แบบ controlled patch

---

# 12. Prompt สำหรับเริ่มแชทใหม่

ใช้ข้อความนี้ได้เลย:

> เปิดโปรเจกต์ `/Users/adisaip/Desktop/INNO-One-Wireframe/` ผ่าน MCP แล้วอ่าน `INNO-One-Next-Chat-Handoff.md`, `INNO-One-Final-UX-UI-Freeze.md`, `INNO-One-Final-Visual-QA-Baseline.md`, `INNO-One-Action-Layout-Contract.md`, `INNO-One-Language-Terminology-Contract.md`, `INNO-One-UI-Prototype-Summary.md` และ Design System ก่อน ปัจจุบัน UI Final Freeze อยู่ที่ **Design System V1.26 / UI Contract 1.20.0**. ห้ามเปลี่ยน baseline แบบ silent; ถ้าจะเปลี่ยน UX/UI ต้อง version + regenerate QA ใหม่. Backend ยังถูกพักไว้จนกว่าจะตกลง Architecture + API/Event + Permission contract.

---

## 13. Definition of Done ก่อนเริ่ม Backend

**Status: ✅ UI Definition of Done ผ่านแล้ว — Backend intentionally paused; continue only when explicitly requested**

UI Prototype ถือว่าพร้อมต่อ Backend เมื่อ:

- ทุกหน้ามี Primary Job ชัดเจน
- ไม่มี mixed-purpose mega form ที่ไม่จำเป็น
- Navigation ไม่มี dead route
- ไม่มี fake clickable control
- Forms/Tables/Buttons/Tabs ใช้มาตรฐานเดียวกัน
- Loading/Empty/Error/Success/Permission states ครบ
- Responsive ผ่าน
- Web / Agent / Mobile boundary ชัดเจน
- Final visual regression ผ่าน
- Design System baseline ถูก Freeze ใหม่



## Project cleanup — 2026-09-24

- Removed the legacy pre-Design-System prototype (`index.html`, old Devices/Users/Admin-era pages, `app.js`, `styles.css`) because it was isolated from the canonical route graph.
- Removed superseded historical QA screenshot folders; `qa-final-visual/` is the only frozen screenshot baseline kept in Git.
- Removed duplicate downloaded illustration SVG files that had no references.
- QA scripts are retained because they regenerate their output folders when regression testing is required.


## UX/UI Input System pass — 2026-09-24

- Added shared `inno-inputs.js` to all 74 Web Portal routes.
- Visible browser-default selects were replaced by shared Select / Combobox / Resource Picker / Segmented patterns while preserving native backing state.
- Restructured the four C-grade screens from `INNO-One-UX-UI-Page-Review.md`: Asset QR, Create Ticket, Notification Rule and Report Builder.
- System-wide browser QA: 74 routes × 1366 / 1024 / 768 passed with no page overflow or visible native Web select.
- Representative Input System interaction QA passed 20 / 20 before final freeze.


## B-grade operational UX pass — 2026-09-24

Completed on branch `ux/input-system-pass` after the 1.12.0 Input System freeze:

- Software Maintenance New: staged operational job editor + summary.
- Restart Schedule: target/time/notification hierarchy + progressive offline handling.
- Device Alert Rule: signal/scope/detection rule builder + channel summary.
- Remote Consent Policy: policy decisions expressed as mode/segmented controls instead of a generic form matrix.
- Access Scope Edit: Who / Where / What assignment model with resource pickers.
- Inventory Query: explicit condition builder; Saved Query updates enhanced controls; builder is first on narrow screens.
- Deployment New: existing six-step wizard upgraded with resource pickers and segmented decisions.
- Extended `qa-ux-input-browser.py`; current targeted + system-wide input regression checks = 37 / 37 before final visual freeze.


## B-grade configuration / account UX pass — 2026-09-25

Second B-grade batch completed on branch `ux/input-system-pass`:

- Endpoint Policies, Alert Channels, Helpdesk SLA, Categories, Requester Groups, Business Calendar, Notification Settings, Meeting New, Apps & Modules and Profile were polished around one primary user intent per screen.
- Meeting now uses a mode switch so Record and Upload forms are never shown together.
- Modules keeps registry operations primary and moves the technical manifest behind an Inspect flow.
- Profile separates identity/security from personal preferences.
- Calendar working hours are presented as readable day cards.
- Categories and Requester Groups now refresh enhanced controls when a master-list selection changes.
- Extended `qa-ux-input-browser.py`; current targeted + system-wide UX/input regression checks = 55 / 55 before final visual freeze.


## Route ownership cleanup — 2026-09-25

The navigation architecture pass is now complete for application-shell routes:

- Replaced legacy `#devices`, `#tickets`, `#assigned`, `#team`, `#meetings`, `#upcoming` navigation with canonical pages.
- Added 9 Web routes: Devices, Helpdesk Tickets, Assigned to Me, Team Queue, My Meetings, Upcoming Meetings, Continue Working, Needs Attention and Recent Activity.
- App Launcher filters and Reports catalog use query-state routes instead of hash routing.
- Device / Ticket / Meeting detail breadcrumb-back ownership now points to canonical parent lists.
- Overview screens were reduced to previews where a dedicated list route now owns the full list job.
- Application hash-link regression guard reports `app_hash_links=0`; local-route validation reports `broken_local_routes=0`.
- Current Web route count = 83. Browser navigation/input regression = 63 / 63.
- Current frozen screenshot baseline = 87 canonical route screenshots + 14 state screenshots = 101 files.


# Final Action/Layout Consistency Pass ✅ COMPLETED 2026-09-25

Branch: `ux/final-action-layout-pass`

Backend work remains out of scope. This pass standardizes action ownership and layout across the frozen Web prototype.

Key changes:

- Added `INNO-One-Action-Layout-Contract.md` and `action-layout-audit.py`.
- Design System = **V1.19** / UI Contract = **1.13.0**.
- Classified all **83 / 83** Web routes by action-layout page type.
- Editor 18 / Builder 4 / Wizard 1 / Resource Detail 6 / Overview-List 54.
- All 18 editors now use canonical `INNOActionFooter`; legacy editor footer classes = 0.
- Builders use `inno-builder-footer`; Deployment uses `inno-wizard-footer`.
- Clean task footers stay in normal flow so they never cover untouched content; editor footers dock to the exact owning pane only after that editor has unsaved changes and reserve bottom safe space.
- `endpoint-policies.html` was restructured into separate Policies and Compliance views; disabled Preview Impact no longer competes with Save.
- Inventory Query puts Query Builder before Saved Queries on narrow layouts and contains wide results inside the table scroll region.
- High-emphasis disabled actions = 0; multiple primary action-zone violations = 0.
- Application hash links = 0; broken local routes = 0.

Do not begin Backend implementation until the user explicitly asks. Further work after this freeze should be visual/content-specific QA or production frontend implementation.
- Follow-up visual QA confirmed clean action bars no longer float over long forms; dirty-state editor docking is covered by browser regression.


# UX/UI Final Polish — Step 1 Accessibility ✅ COMPLETED 2026-09-25

Branch: `ux/accessibility-semantic-pass`

Source of truth: `INNO-One-Accessibility-Contract.md`

Completed:

- Replaced interactive non-semantic toggles with keyboard-native button switches.
- Added `role=switch`, `aria-checked`, accessible names and focus-visible behavior.
- Added shared field-label association for single-control fields.
- Improved custom select labelling so field label + selected value are exposed.
- Added labelled segmented-control groups.
- Added contextual names for table row/select-all checkboxes and Meeting action-item checkboxes.
- Added Global Rail accessible names through Platform Shell.
- Added accessible names to icon-only buttons/links across Web, Design System and Mobile surface.
- Added `accessibility-audit.py` and expanded browser regression with rendered-DOM accessibility gates.

QA:

- Canonical pages: **87**.
- `accessibility-audit.py`: **0 issues**.
- unnamed icon controls: **0**.
- non-semantic clicks: **0**.
- invalid switches: **0**.
- images missing alt: **0**.
- `qa-ux-input-browser.py`: **74 / 74 checks**, including 83 Web routes at 1366 / 1024 / 768.

Next UX/UI step:

**Step 2 — Coming Soon / Disabled Action Cleanup**

Do not begin backend implementation.


# UX/UI Final Polish — Step 2 Availability Cleanup ✅ COMPLETED 2026-09-25

Branch: `ux/availability-cleanup-pass`

Source of truth: `INNO-One-Availability-Contract.md`

Design System: **V1.20**
UI Contract: **1.14.0**

Completed:

- Removed all 33 Web Coming Soon task actions found at the start of Step 2.
- Removed the remaining unavailable Mobile software-list action.
- Future sidebar placeholders remain in source for roadmap continuity but are hidden from normal contextual navigation.
- Replaced dead controls with canonical routes where available, including Workspace Recent history and Asset ownership.
- Converted read-only configuration surfaces to passive status instead of fake Edit/Add controls.
- Kept prototype-local commands active only when they provide visible feedback/confirmation.
- Removed fake Install from future Module Registry entries while keeping Inspect.
- Removed non-interactive Admin tiles that looked like navigation.
- Enhanced pagination Previous/Next so accessible icon controls also have real prototype behavior.
- Added `availability-audit.py` and browser availability regression gates.

QA:

- canonical pages = **87**.
- Coming Soon task actions = **0**.
- visible future sidebar entries = **0**.
- hidden future navigation placeholders retained in source = **102**.
- non-interactive Admin navigation tiles = **0**.
- `availability-audit.py` = **0 issues**.
- `accessibility-audit.py` = **0 issues**.
- `qa-ux-input-browser.py` = **80 / 80 checks**.
- `qa-final-visual.py` = **116 / 116 checks**.
- frozen screenshots = **87 routes + 13 states = 100**.

Next UX/UI step:

**Step 3 — Language & Terminology Consistency**

Do not begin Backend implementation.


# UX/UI Final Polish — Step 3 Language & Terminology ✅ COMPLETED 2026-09-25

Branch: `ux/language-terminology-pass`

Source of truth: `INNO-One-Language-Terminology-Contract.md`

Design System: **V1.21**
UI Contract: **1.15.0**

Language ownership:

- Web Portal: **English** (`lang=en`).
- Design System: **English** (`lang=en`).
- Endpoint Agent: **Thai** (`lang=th`).
- Android Assets Mobile: **Thai** (`lang=th`).
- Thai business/sample content shown inside English Web pages is retained and explicitly scoped with `lang=th`.

Terminology normalized:

- Helpdesk root = `Overview`, not `Home`.
- Admin route `modules.html` = `Apps & Modules`.
- Account route `profile.html` = `Profile & Settings`.
- Web helper text / configuration descriptions use English consistently.
- Canonical spelling includes `Email`, `Wi-Fi`, and `Sign in`.

QA:

- Web routes = **83**.
- English Web + Design System surfaces = **84 / 84**.
- Thai Agent/Mobile surfaces = **3 / 3**.
- unscoped Thai fragments on English surfaces = **0**.
- terminology mismatches = **0**.
- `language-terminology-audit.py` = **0 issues**.
- `qa-ux-input-browser.py` = **80 / 80 checks** including rendered language/terminology gates at 1366 / 1024 / 768.

Backend remains paused. Continue UX/UI only until explicitly requested otherwise.


# UX/UI Final Polish — Step 4 Interaction & Feedback ✅ COMPLETED 2026-09-25

Branch: `ux/interaction-feedback-pass`

Source of truth: `INNO-One-Interaction-Feedback-Contract.md`

Design System: **V1.22**
UI Contract: **1.16.0**

Completed:
- Save/Create actions expose Saving/Saved/Error feedback and prevent duplicate submit while busy.
- Save controls expose `aria-busy=true` while processing.
- Required-field validation uses `aria-invalid`, associated `aria-describedby`, inline `role=alert`, focus on the first invalid field and one summary toast.
- Confirmation actions now declare explicit Warning vs Danger severity.
- Danger is reserved for destructive/unavailable-producing actions; interruptive/reversible actions use Warning.
- Generated filter drawer close control now has an accessible name.
- Direct prototype toasts now use explicit Success vs Info intent for the reviewed actions.
- Browser-native alert/confirm/prompt are forbidden by regression audit.

QA:
- canonical pages: **87**.
- confirmation actions: **12**.
- save actions: **25**.
- native browser dialogs: **0**.
- `interaction-feedback-audit.py`: **0 issues**.
- `qa-ux-input-browser.py`: **85 / 85 checks**, including busy save, Danger/Warning confirmation and validation association.

Backend remains paused.


# UX/UI Final Polish — Step 5 Table / List / Data Density ✅ COMPLETED 2026-09-25

Branch: `ux/table-list-density-pass`

Source of truth: `INNO-One-Table-List-Density-Contract.md`

Design System: **V1.23**
UI Contract: **1.17.0**

Completed:
- Primary collection tables now share compact density, horizontal desktop toolbars and responsive stacked tablet controls.
- Shared search wiring replaces one-off inline filtering on canonical collections.
- Search now inherits the standard no-results and Escape-to-clear behavior.
- Collection title/context is separated from search/filter controls instead of combining everything into one section-title row.
- Row action columns are explicitly named and aligned; table action buttons use compact sizing.
- Devices and Asset Inventory were aligned to the same compact/action-column contract.
- Domain-specific Helpdesk queues and Meeting lists remain list components instead of being forced into generic tables.

QA:
- Web routes: **83**.
- pages containing tables: **40**.
- tables: **46**.
- canonical primary collections: **12**.
- compact primary tables: **12 / 12**.
- shared search targets: **12 / 12**.
- canonical action columns: **7 / 7**.
- `table-list-density-audit.py`: **0 issues**.
- `qa-ux-input-browser.py`: **90 / 90 checks**.

Backend remains paused.


# UX/UI Final Polish — Step 6 State Coverage ✅ COMPLETED 2026-09-26

Branch: `ux/state-coverage-pass`

Source of truth: `INNO-One-State-Coverage-Contract.md`

Design System: **V1.24**
UI Contract: **1.18.0**

Completed:
- Added canonical full-page Empty preview state.
- Loading skeleton now exposes `role=status`, `aria-live=polite` and screen-reader loading text.
- Error recovery uses `Try again` and exits the forced preview error URL instead of reloading the same failure state.
- No-results collections now show `0 matching results` and hide pagination until matching rows return.
- Clearing search restores the original collection count and pagination.
- Partial retry resolves warning copy to `Retry completed` and failed count to 0.
- Added shared `.sr-only` utility and resolved partial-state styling.

QA:
- Web routes: **83**.
- canonical shared states: **8 / 8**.
- frozen state screenshots: **14**.
- frozen screenshot/hash baseline: **101 / 101**.
- `state-coverage-audit.py`: **0 issues** after frozen-state regeneration.
- `final-visual-audit.py`: **0 issues**.
- `qa-ux-input-browser.py`: **96 / 96 checks**.
- All 5 visual contact sheets were regenerated from the current frozen screenshots and reviewed; the important-state sheet includes Empty.
- Frozen visual state set includes Empty, Loading, Error, Permission, Disabled, Offline, Partial and No Results.

Backend remains paused.

# Pre-Step 7 — TOR-required management surfaces ✅ COMPLETED 2026-09-26

Branch: `ux/tor-required-surfaces-pass`

Design System: **V1.25**
UI Contract: **1.19.0**

Completed before Step 7:
- Enforced **one screen = one primary job** for the new TOR-required surfaces.
- Admin organization work is split into **Structure**, **Locations**, **Positions**, and **Users**.
- Users is now **List → User Detail → User Create/Edit** instead of list + long editor on one screen.
- Helpdesk Automation is now **Rule List → Rule Editor**; escalation details appear only for the escalation action.
- Saved Reports has working Search/Owner/Dataset filtering, a focused Run result dialog, and Edit restores the chosen definition in Report Builder.
- Device Group Detail has working member filtering, and member Open links restore the requested device identity in Device Detail.
- Shared collection filtering lives in `inno-interactions.js`, not duplicated page-local filter code.
- Remaining future placeholders stay hidden under the Availability contract.

QA:
- Web routes: **93**; canonical pages: **97**.
- `qa-final-visual.py`: **127 / 127**, failures 0.
- `qa-ux-input-browser.py`: **114 / 114**, failures 0.
- Frozen screenshots: **97 routes + 14 states = 111 hashes**.
- Primary collections: **15 / 15** compact + shared search; action columns: **10 / 10**.
- Full static audit chain: **0 issues**.
- Five contact sheets regenerated and visually reviewed.
- Affected Web screens additionally reviewed at **1024** and **768**.

**Historical checkpoint: Step 7 completed here; Step 8 Final UX/UI Freeze is now complete. Backend remains paused.**

# Pre-Step 7 — Shared Hierarchy Components ✅ COMPLETED 2026-09-26

Branch: `ux/tor-required-surfaces-pass`

Design System: **V1.26**
UI Contract: **1.20.0**

Completed before Step 7:
- Implemented shared `INNOTree` behavior in the central interaction/design layers.
- Implemented shared `INNOTreeGrid` behavior with real hierarchy rows, expand/collapse, contextual search and keyboard navigation.
- Added live Tree / TreeGrid / OrgChart references to Design System.
- Migrated Organization Structure, Organization Locations and Helpdesk Categories from page-local category-tree markup to `INNOTree`.
- Migrated Access Scope Browser from a visually indented table to a real `INNOTreeGrid`.
- Scope assignment changes effective actions without changing the hierarchy model.
- Production direction remains React Arborist / TanStack Table / d3-org-chart; AG Grid remains enterprise-only when justified.

QA:
- Web routes: **93**; canonical pages: **97**.
- `qa-final-visual.py`: **127 / 127**, failures 0.
- `qa-ux-input-browser.py`: **124 / 124**, failures 0.
- Frozen screenshots: **97 routes + 14 states = 111 hashes**.
- Static hierarchy component checks are enforced by `component-consistency-audit.py`.
- All five contact sheets were regenerated; affected hierarchy screens were visually checked at 1366 / 1024 / 768 with no page-level overflow.

**Historical checkpoint: Step 7 completed here; Step 8 Final UX/UI Freeze is now complete. Backend remains paused.**

# Step 7 — Final Page-by-Page UX Review ✅ COMPLETED 2026-09-26

Branch: `ux/final-page-review`

Design System: **V1.26**
UI Contract: **1.20.0**

Completed:
- Visually reviewed all **93 Web routes** at **1366 / 1024 / 768**.
- Reviewed Design System, both Endpoint Agent surfaces and Android Assets Mobile.
- Checked page hierarchy, title/helper balance, action emphasis, whitespace/density, table/list balance, card/panel hierarchy, duplicate controls, active navigation and responsive balance.
- Confirmed Web / Endpoint Agent / Android Mobile surface boundaries remain intact.
- No additional UX/UI source changes were required after the pre-Step 7 TOR and hierarchy passes.
- Review record: `INNO-One-Step7-Page-Review.md`.

Baseline remains unchanged:
- Web routes: **93**; canonical pages: **97**.
- Design System: **V1.26**.
- UI Contract: **1.20.0**.
- Frozen screenshots: **97 routes + 14 states = 111 verified hashes**.

**Historical checkpoint: Step 8 Final UX/UI Freeze is now complete. Backend remains paused.**

# Step 8 — Final UX/UI Freeze ✅ COMPLETED 2026-09-26

Branch: `ux/final-ux-freeze`

Final baseline:
- Design System: **V1.26**.
- UI Contract: **1.20.0**.
- Registry Schema: **10**.
- Web routes: **93**.
- Canonical route screenshots: **97**.
- State screenshots: **14**.
- Frozen screenshot/hash set: **111 / 111**.

Final QA:
- `qa-final-visual.py`: **127 / 127**, failures 0.
- `qa-ux-input-browser.py`: **124 / 124**, failures 0.
- Full static audit chain: **0 issues**.
- All five contact sheets regenerated and visually reviewed.
- Representative complex Web screens rechecked at 1024 / 768 with no overflow/navigation/footer defects.
- Endpoint Agent and Android Mobile surface boundaries rechecked and preserved.

Final handoff record: `INNO-One-Final-UX-UI-Freeze.md`.

**UX/UI prototype status: FINAL FROZEN and ready for implementation handoff. Backend remains paused until Architecture + API/Event + Permission contracts are agreed.**

# Step 9–10 — Implementation Architecture + Permission Scope ✅ COMPLETED 2026-09-26

Branch: `architecture/step9-10-contracts`

UX/UI remains final frozen at **Design System V1.26 / UI Contract 1.20.0**.

Step 9 decisions:
- One React Web Portal initially; no micro-frontends by default.
- One .NET Platform API as a modular monolith for Platform / Devices / Assets / Helpdesk / Reports.
- Meeting processing may remain a separately deployed service boundary.
- Endpoint Agent and Android/Expo Assets Mobile remain separate clients.
- Keycloak owns Authentication/SSO; INNO.One owns business profile/RBAC/scopes.
- MeshCentral is only reachable through the Devices adapter.
- Module persistence ownership is explicit; modules do not write each other's tables.
- Cross-module integration uses API/event contracts.

Step 10 decisions:
- Permission and resource scope are separate concepts.
- Existing registry permission IDs retained: **43**.
- Reserved implementation permission IDs: **27**, including explicit `devices.deploy` plus Platform/Admin capabilities.
- Logical scopes: `own`, `team`, `org`, `all`.
- Concrete v1 assignment scope types: `organization`, `location`, `device_group`.
- Organization scope supports descendant inheritance.
- Server-side authorization is authoritative; client permission checks are UX only.
- Module visibility remains installed + enabled + requiredPermission.

New source-of-truth planning files:
- `INNO-One-Implementation-Architecture-Contract.md`
- `INNO-One-Permission-Scope-Contract.md`
- `inno-implementation-contract.json`
- `implementation-contract-audit.py`

Current implementation contract audit: **0 issues**.

**Historical checkpoint: Step 11 API Contract completed here; Step 12 Event & Audit Contract is now complete. No backend feature code has started.**

# Step 11 — API Contract ✅ COMPLETED 2026-09-26

Branch: `architecture/step11-api-contract`

UX/UI remains FINAL FROZEN at **Design System V1.26 / UI Contract 1.20.0**.

API Contract: **0.2.0**

Frozen API decisions:
- Public base path: `/api/v1`.
- Normal user auth: Keycloak Bearer JWT.
- Page-number pagination: `page`, `pageSize`, `search`, `sort`, `order`.
- Error shape: `application/problem+json` with canonical INNO.One error codes.
- Mutable configuration: ETag + If-Match.
- High-impact POST jobs: Idempotency-Key.
- Long-running jobs: HTTP 202 + operation resource.
- Stable opaque IDs for cross-module references.
- MeshCentral/vendor DTOs remain behind Devices adapter APIs.
- Agent-only API calls use provisional `authMode=agent-device`; exact agent credential provisioning is deferred.

Coverage:
- **172 operations**.
- **137 unique paths**.
- **93 / 93 frozen Web routes** mapped to APIs.
- **3 / 3 runtime Agent/Mobile surfaces** mapped to APIs.
- OpenAPI 3.1 planning skeleton: **172 operations**.
- Async operations: **17**.

Permission refinement from API mapping:
- Existing registry permissions: **43**.
- Reserved implementation permissions: **33**.
- Additional gaps captured include `admin.access`, `helpdesk.kb.view`, `helpdesk.ticket.reply`, `helpdesk.automation.view`, `helpdesk.automation.manage`, `meeting.files.manage`, plus explicit `devices.deploy` from Step 10.

New source-of-truth files:
- `INNO-One-API-Contract.md`
- `inno-api-contract.json`
- `openapi-inno-one-v1.json`
- `api-contract-audit.py`

Current checks:
- `api-contract-audit.py`: **0 issues**.
- `implementation-contract-audit.py`: **0 issues**.
- `final-visual-audit.py`: **0 issues**; frozen UX/UI baseline unchanged.

**Historical checkpoint: Step 12 Event & Audit Contract completed here. Step 13 Data Ownership / Database Model is now complete. No backend feature code has started.**

# Step 12 — Event & Audit Contract ✅ COMPLETED 2026-09-26

Branch: `architecture/step12-event-audit-contract`

UX/UI remains FINAL FROZEN at **Design System V1.26 / UI Contract 1.20.0**.

Implementation planning contract: **0.3.0**
API Contract remains: **0.2.0**
Event & Audit Contract: **0.3.0**

Event contract:
- Preserves all **37** event IDs declared in `platform-registry.js`.
- **34 active** event types.
- **3 future Workflow** event types.
- Cross-module/service delivery = **at-least-once**.
- Database-backed integration events = **transactional outbox**.
- Consumers must deduplicate by `eventId`.
- No global ordering guarantee; best-effort per-subject partition ordering only.
- Retry = exponential backoff + jitter; failed messages are never silently discarded.
- Correlation/causation/trace identity propagates API → event → audit.

Audit contract:
- **62 canonical audit actions**.
- Append-only audit history.
- Privileged successful mutations write audit in the same transaction where practical.
- Privileged authorization denial is auditable.
- Future Audit read permission = `admin.audit.view`.
- Retention classes: `security_long`, `admin_long`, `operational_standard`, `data_access_standard`.
- Exact retention durations remain governance/deployment policy.
- Secrets, raw tokens, ticket/reply bodies, meeting transcript/audio content, remote chat bodies and file contents are excluded from generic event/audit payloads.

New source-of-truth files:
- `INNO-One-Event-Audit-Contract.md`
- `inno-event-audit-contract.json`
- `event-audit-contract-audit.py`

Current checks:
- `event-audit-contract-audit.py`: **0 issues**.
- `api-contract-audit.py`: **0 issues**.
- `implementation-contract-audit.py`: **0 issues**.
- `final-visual-audit.py`: **0 issues**; frozen UX/UI baseline unchanged.

**No backend feature code has started. Step 13 Data Ownership / Database Model is complete; next is Step 14 Production Project Skeleton.**

# Step 13 — Data Ownership / Database Model ✅ COMPLETED 2026-09-26

Branch: `architecture/step13-data-model`

UX/UI remains FINAL FROZEN at **Design System V1.26 / UI Contract 1.20.0**.

Implementation planning contract: **0.4.0**
API Contract: **0.2.0**
Event & Audit Contract: **0.3.0**
Data Model Contract: **0.4.0**

Database decisions:
- Production relational engine = **PostgreSQL**.
- Core database = `inno_core`.
- Meeting database = `inno_meeting`.
- Keycloak owns its own database.
- MeshCentral owns its own persistence; INNO.One never queries it directly.

Core schema ownership:
- `platform`
- `devices`
- `assets`
- `helpdesk`
- `reports`
- `integration`
- `audit`
- `readmodel`

Planning catalog:
- `inno_core`: **83 logical tables**.
- `inno_meeting`: **9 logical tables**.
- Total: **92 logical tables**.

Key data rules:
- DB PKs = UUID; API IDs remain opaque/prefixed at serialization boundary.
- Cross-module / cross-database references = stable IDs, **no DB foreign keys**.
- Same-module relationships use normal relational constraints.
- Explicit bigint `version` backs ETag/If-Match concurrency.
- No universal `is_deleted`; use domain status/archive/retention rules.
- JSONB is bounded; canonical relationships stay relational.
- Object storage owns binary/audio/export contents; DB stores metadata only.
- Core transactional outbox/inbox/operation tables live under `integration`.
- Core append-only audit records live under `audit`.
- Meeting writes its own local outbox; central audit/event projection consumes durable facts without cross-DB transactions.
- Reports/Search may use read models/query contracts, never direct cross-module business-table shortcuts.
- v1 is not generic SaaS multi-tenant; do not add `tenant_id` without a dedicated contract.

New source-of-truth files:
- `INNO-One-Data-Ownership-Database-Contract.md`
- `inno-data-model-contract.json`
- `data-model-contract-audit.py`

Current checks:
- `data-model-contract-audit.py`: **0 issues**.
- `event-audit-contract-audit.py`: **0 issues**.
- `api-contract-audit.py`: **0 issues**.
- `implementation-contract-audit.py`: **0 issues**.
- Full static UX/UI audit chain: **0 issues**.
- `qa-ux-input-browser.py`: **124 / 124**, failures 0.
- Frozen visual baseline remains unchanged/green.

**Historical checkpoint: Step 13 completed here; Step 14 Production Project Skeleton is now complete.**

# Step 14 — Production Project Skeleton ✅ COMPLETED 2026-09-26

Branch: `implementation/step14-production-skeleton`

UX/UI remains FINAL FROZEN at **Design System V1.26 / UI Contract 1.20.0**.

Implementation planning contract: **0.5.0**
API Contract: **0.2.0**
Event & Audit Contract: **0.3.0**
Data Model Contract: **0.4.0**
Production Skeleton Contract: **0.5.0**

Production root: `production/`

Implemented skeleton:
- React 19.2 + TypeScript 5.9 + Vite 6.4 Web Portal shell.
- Top-level Web route boundaries for Workspace / Apps / Devices / Assets / Helpdesk / Meeting / Reports / Admin.
- pnpm workspaces with `@inno/ui`, `@inno/contracts`, `@inno/auth`, `@inno/shared`.
- .NET 10 solution with **12 projects**.
- Platform API modular monolith with 5 module projects: Platform / Devices / Assets / Helpdesk / Reports.
- Keycloak and MeshCentral adapter projects.
- Separate .NET 10 Meeting service skeleton.
- **8 DbContext boundaries** aligned to Step 13 schemas.
- EF migration ownership directories and local `dotnet-ef` 10.0.4 tool manifest.
- Local Docker PostgreSQL + Keycloak bootstrap.
- Reverse-proxy, monitoring, deployment and test boundaries.
- Endpoint Agent repository boundary remains language-deferred.
- Assets Mobile boundary retains Android/Expo direction; heavy Expo runtime is deferred to its first vertical slice.

Validation:
- Web typecheck: pass.
- Web production build: pass.
- Web local dev port: **5180**; 1366px + 768px production-shell visual smoke reviewed.
- Responsive shell defect found during review and fixed before checkpoint.
- .NET restore/build: **12 projects, 0 warnings, 0 errors**.
- Platform API `/health/ready`: pass.
- Meeting service `/health/ready`: pass.
- Docker Compose config validation: pass.
- `production-skeleton-audit.py`: **0 issues**.
- Contract audit chain: **0 issues**.
- Full static frozen UX/UI audit chain: **0 issues**.
- `qa-ux-input-browser.py`: **124 / 124**, failures 0.
- Frozen visual baseline remains unchanged.

Source-of-truth additions:
- `INNO-One-Production-Project-Skeleton.md`
- `production/production-skeleton.json`
- `production-skeleton-audit.py`
- `production/`

**Historical checkpoint: Step 14 completed here; Step 15 First Vertical Slice is now complete.**

# Step 15 — First Vertical Slice ✅ COMPLETED 2026-09-26

Branch: `implementation/step15-first-vertical-slice`

UX/UI remains FINAL FROZEN at **Design System V1.26 / UI Contract 1.20.0**.

Implementation Contract: **0.6.0** — `implementation-in-progress`
API Contract: **0.2.0**
Event & Audit Contract: **0.3.0**
Data Model Contract: **0.4.0**
Production Skeleton Contract: **0.5.0**

Implemented production flow:
- Keycloak normal Web sign-in uses Authorization Code + PKCE S256.
- Platform API validates Keycloak Bearer JWT with `MapInboundClaims=false` so `sub` stays canonical.
- `sub` maps to `platform.user_profiles.keycloak_subject`.
- `IAccessEvaluator` resolves active profile, module availability, role permission, Access Assignment, action override and Organization/Location/Device Group scope.
- Organization/Location `includeChildren` is supported.
- Devices reads Platform names through `IPlatformDirectoryReader`; no Devices → Platform project/table dependency was introduced.
- `platform.me.get`, `devices.list`, `devices.get` are implemented from the existing API Contract.
- Device list scope filtering happens before `totalItems`/pagination.
- Device detail returns 403 outside scope and 404 for a missing resource.
- Public Device IDs are `dev_...`; MeshCentral external IDs stay private.
- Offline Device detail preserves cached inventory.

Persistence:
- Platform migration: `Step15IdentityAccess`.
- Devices migration: `Step15DeviceCatalog`.
- Physical PostgreSQL names use snake_case via `EFCore.NamingConventions`.
- No cross-module database FK was introduced.

Production Web:
- `keycloak-js` + React Query.
- `/profile`
- `/devices`
- `/devices/:deviceId`
- Search + Status + OS filters.
- Loading / Error / Permission / No Results / Offline state handling.
- Future actions/modules remain hidden until their backend is implemented.

Runtime QA:
- normal auth redirect: Authorization Code + PKCE S256 verified.
- unauthenticated API: **401**.
- admin Device scope: **4**.
- HR-scoped viewer: **1** Device.
- out-of-scope Device detail: **403**.
- missing Device: **404**.
- search/status/OS/pagination: pass.
- offline cached detail: pass.
- MeshCentral external ID leakage: none.
- DB fixtures: profiles=2, assignments=2, devices=4, mappings=4.
- Web typecheck/build: pass.
- .NET build: pass, 0 warnings / 0 errors.
- production component visual QA: **1366 / 1024 / 768**, no page overflow or unnamed visible controls.
- frozen browser regression: **124 / 124**, failures 0.
- full contract + static audit chain: **0 issues**.
- Docker Compose config + Web typecheck/build + .NET build: pass.

Source of truth:
- `INNO-One-Step15-First-Vertical-Slice.md`
- `inno-step15-vertical-slice.json`
- `step15-vertical-slice-audit.py`
- `production/scripts/step15-local-smoke.py`

Next recommended slice: **Devices Management — Device Groups → Discovery / Add Device → Agent enrollment → live MeshCentral synchronization**. This recommendation is not a newly frozen product requirement.

# Step 16 — Devices Management ✅ COMPLETED 2026-09-26

Branch: implementation/step16-devices-management

UX/UI remains FINAL FROZEN at **Design System V1.26 / UI Contract 1.20.0**.

Implementation Contract: **0.7.0** — implementation-in-progress

Implemented:

- Device Groups list/create/detail/update/member list.
- Organization / Location / Device Group effective-scope enforcement.
- ETag / If-Match concurrency.
- bounded private IPv4 Network Discovery as a durable async operation.
- integration.operations progress/state.
- Agent Enrollment guarded by devices.deploy.
- real MeshCentral /control.ashx WebSocket adapter.
- real Device Group provisioning/update in MeshCentral.
- periodic MeshCentral node to canonical Device synchronization.
- device_external_mappings keeps MeshCentral node IDs private.
- existing device.online / device.offline facts can be written through the transactional outbox.
- shared execution/audit/outbox persistence migration.
- React routes: /devices/groups, /devices/groups/:groupId, /devices/discovery, /devices/add.

Runtime QA:

- Device Groups scope/create/update: PASS.
- stale ETag: 412 PASS.
- Agent Enrollment: PASS.
- private-range Discovery async flow: PASS.
- real live MeshCentral synchronization: PASS.
- durable operation + audit + external mapping persistence: PASS.
- vendor ID leakage: none.
- Step 15 regression: PASS.
- Web typecheck/build: PASS.
- .NET build: 0 warnings / 0 errors.
- Step 16 audit: 0 issues.
- full contract/static audit chain: 0 issues.
- frozen browser regression: **124 / 124**.
- Step 16 visual QA: **12 / 12 route-width screens**, failures 0.

QA detail: MeshCentral AddLocalDevice only supports an agentless mesh, so the synthetic live-sync harness uses a temporary agentless MeshCentral group solely to manufacture a test node. Normal product Agent Enrollment still uses a standard agent group.

Source of truth:

- INNO-One-Step16-Devices-Management.md
- inno-step16-devices-management.json
- step16-devices-management-audit.py
- production/scripts/step16-local-smoke.py

**Do not merge to main without explicit instruction.**

## Step 16 — deferred fresh re-validation

User decision on 2026-09-26: **skip the additional Step 16 re-test for now and continue forward**.

Keep the existing recorded PASS evidence as the last known QA result, but do not claim a newer re-run. Before merge/release, return to Step 16 and rerun `production/scripts/step16-local-smoke.py`, Step 16 audit, Web/.NET builds, frozen browser regression, Step 16 visual QA and `git diff --check`.

Step 16 implementation may be checkpointed to Git and the next implementation branch may proceed, but **do not merge `main` until the deferred re-validation has been completed**.

# Step 17 — Helpdesk Core ✅ COMPLETED 2026-09-26

Branch: `implementation/step17-helpdesk-core`

Implementation Contract: **0.8.0** — project implementation remains in progress.

Implemented:

- Helpdesk Overview with scoped operational metrics.
- Ticket Queue / Assigned to Me / Team Queue.
- Create Ticket with requester profile, Category, Impact/Urgency and optional Device reference.
- Ticket Detail with Conversation, Activity, Properties, SLA and related Device context.
- Ticket reply / internal-note flow.
- Assignment with ETag / If-Match concurrency.
- Resolve flow with status history and SLA finalization.
- Helpdesk Categories / Statuses read APIs.
- Helpdesk persistence migration for tickets, replies, assignments, status history, SLA policies, ticket SLA, categories and statuses.
- Server-authoritative Helpdesk permission/scope filtering.
- Platform and Devices cross-module reads only through `IPlatformDirectoryReader` / `IDeviceDirectoryReader`.
- No Helpdesk → Platform / Devices / Assets database FK.
- `ticket.created`, `ticket.assigned`, `ticket.status.changed`, `ticket.resolved` outbox facts.
- Helpdesk audit actions without copying ticket/reply body text into audit/event payloads.

QA:

- Step 17 runtime smoke: **PASS**.
- Step 17 audit: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- EF pending-model checks: **PASS**.
- contract/static audit chain: **0 issues**.
- Helpdesk route visual QA: **15 / 15 screens**, failures 0.
- frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.

Source of truth:

- `INNO-One-Step17-Helpdesk-Core.md`
- `inno-step17-helpdesk-core.json`
- `step17-helpdesk-core-audit.py`
- `production/scripts/step17-local-smoke.py`

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge to `main` without explicit instruction.**

# Step 18 — Helpdesk SLA & Automation ✅ COMPLETED 2026-09-27

Branch: `implementation/step18-helpdesk-sla-automation`

Implementation Contract: **0.9.0**.

Implemented:

- SLA policy management with Business Calendar references, pause behavior, requester notification intent, breach reassignment and ordered escalation levels.
- Business Calendar working windows, holidays/exceptions and business-time calculation.
- Ticket SLA pause/resume with accumulated paused time and due-date extension.
- SLA at-risk / escalation worker with three-level escalation and optional breach reassignment.
- Helpdesk automation rules with bounded triggers/actions and idempotent execution history.
- React routes for SLA, Business Calendar, Automation list/new/detail.
- Helpdesk-owned persistence for Business Calendar and Automation with no cross-module database FK.
- UTC normalization at the persistence boundary for SLA due dates written to PostgreSQL `timestamp with time zone`.

Final QA:

- Step 18 runtime smoke: **PASS**.
- Step 18 audit: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- EF pending-model checks: **PASS**.
- contract/static audit chains: **0 issues**.
- production Step 18 visual QA: **15 / 15 screens**, failures 0.
- frozen browser regression: **124 / 124**, failures 0.
- `git diff --check`: **PASS**.

Source of truth:

- `INNO-One-Step18-Helpdesk-SLA-Automation.md`
- `inno-step18-helpdesk-sla-automation.json`
- `step18-helpdesk-sla-automation-audit.py`
- `production/scripts/step18-local-smoke.py`

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction. No Step 19 work has been started.**

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


# Step 25 — Assets Final Integration Pass ✅ COMPLETED 2026-09-27

Branch: `integration/step25-assets-final-integration`

Implementation Contract: **0.16.0**.

Validated the full canonical chain without adding APIs or database tables:

`Devices → Assets → Helpdesk related Device → QR → Software Licenses → Contracts`

Live fixture:

- Device `DESKTOP-HR-014`
- Asset `AST-PC-000142`
- Helpdesk ticket `HD-2026-001048`
- Microsoft 365 Apps allocation
- Contract `CTR-2568-IT-014`
- Live-generated QR label

Live integration results:

- Device `assetReference` = Asset tag: **PASS**
- Asset `linkedDevice.id` = Device opaque ID: **PASS**
- Asset owner/custom fields/warranty remain available: **PASS**
- Helpdesk `relatedDevice.id` = same Device opaque ID: **PASS**
- Live QR resolve = same Asset + Device identity: **PASS**
- Microsoft 365 allocation = same Asset + endpoint: **PASS**
- Contract coverage = same Asset: **PASS**
- Ownership summary: **PASS**
- Marker: **STEP25_ASSETS_INTEGRATION_SMOKE_PASS**

Remote DB guards on `172.10.1.58`:

- cross-module DB FKs across Assets / Devices / Helpdesk: **0**
- Asset → Device links: 3
- Helpdesk → Device links: 4
- Software License → Asset links: 10
- Contract → Asset links: 5
- QR scan rows observed: 5

Final QA:

- Step 25 audit: **0 issues**
- contract/API/data/event/skeleton audit chain: **0 issues**
- frozen static UX audit chain: **0 issues**
- final visual frozen hash checks: **111 / 111**, issues 0
- Web typecheck/build: **PASS**
- .NET build: **0 warnings / 0 errors**
- EF pending-model checks for Assets / Platform / Devices / Helpdesk: **PASS**
- `git diff --check`: **PASS**
- No Web UI source changed in Step 25; the legacy Web input harness is not a Step 25 acceptance surface.

Remaining work before merge/release:

1. **Step 16 fresh re-validation** — explicitly deferred until now; this is the next required gate.
2. Software Baselines remain deferred because no standalone frozen API/route contract exists.
3. Do not merge `main` without explicit user instruction.

Source of truth:

- `INNO-One-Step25-Assets-Final-Integration.md`
- `inno-step25-assets-final-integration.json`
- `step25-assets-integration-audit.py`
- `production/scripts/step25-assets-integration-smoke.py`


# Step 16 — Fresh Re-validation ✅ COMPLETED 2026-09-27

On `integration/step25-assets-final-integration`, the deferred Step 16 release gate was rerun against the current code and relocated development stack:

- Runtime smoke: **STEP16_RUNTIME_SMOKE_PASS**.
- Step 16 audit: **0 issues**.
- Web typecheck/build: **PASS**.
- .NET build: **0 warnings / 0 errors**.
- Frozen browser regression: **124 / 124**, failures 0.
- Live Step 16 React visual QA: **12 / 12**, failures 0 at 1366 / 1024 / 768.
- `git diff --check`: **PASS** before checkpoint.

The browser harness was updated to keep its CDP tab visible and wait for asynchronous UI state. Step 16 smoke leaves synthetic QA group/node fixtures on the development stack. See `INNO-One-Step16-Devices-Management.md` section 14 for the full evidence and boundary.

Step 16 fresh re-validation is **no longer deferred**. Software Baselines remain deferred pending a standalone frozen API/route contract. **Do not merge `main` without explicit user instruction.**


# Main integration — 2026-09-27

The user explicitly authorized merging after Step 16 fresh re-validation. `integration/step25-assets-final-integration` was fast-forwarded into `main` and pushed to `origin/main` at `3ca1c72`. Working tree was clean after the push. This closes the prior merge gate; historical notes above are retained as records of decisions at those steps.

Next development candidate: define and freeze a standalone Software Baselines API/route/data contract before implementing baseline evaluation. This is a recommendation, not an already frozen Step 26. Main integration does not itself deploy the Web Portal/API as persistent services; release deployment and environment verification remain separate operational work.


# Step 26 — Software Baseline Definitions ✅ COMPLETED 2026-09-27

Branch: `implementation/step26-software-baselines`, branched from `main` at `37eb754`. Implementation Contract **0.17.0**, API Contract **0.3.0**.

Assets now manages baseline definitions through `/assets/software-baselines` and GET/POST/GET-by-id/PATCH APIs, with `assets.view` for read, `assets.baseline.manage` for writes, ETag preconditions, unique code and package validation, Assets-owned migration, and same-transaction create/update audit. The production Web page offers search/filter and single-definition editing.

**Boundary:** Devices has no authoritative installed-software inventory/read contract. The API returns `evaluationStatus=awaiting_inventory`. `baseline_results` remains reserved and `baseline.drift` is not emitted. License allocations cannot prove a package is installed or absent. Do not mark any device compliant/missing from absent or stale observations.

QA: .NET 0 warnings/0 errors; Web typecheck/build PASS; Step 26/API/Implementation/historical audit chain 0 issues; live `STEP26_DEFINITIONS_SMOKE_PASS`; dev DB guards migration 1, permission 1, audit rows 3, drift events 0, cross-module FKs 0, temporary QA definitions cleaned; React visual QA list 1366/1024/768 and create editor 1366/768, 5 screens with 0 overflow/errors. `git diff --check` PASS. See `INNO-One-Step26-Software-Baselines.md` and `inno-step26-software-baselines.json`.

**Next dependency:** define/freeze and implement a Devices-owned installed-software observation contract/feed (device ID, normalized product identity, observed timestamp, completeness and provenance). Then implement Assets baseline evaluation/result projection with unknown handling for incomplete/stale evidence and drift events only on evidence-backed transitions. This Step 26 branch is not merged. User explicitly requested **no deployment**; temporary local API/Vite QA sessions are not a release.


# Step 27 — Devices Installed Software Inventory ✅ COMPLETED 2026-09-27

Branch: `implementation/step27-devices-software-inventory`, based on pushed Step 26 commit `22b4e34`. Implementation Contract **0.18.0**, API **0.4.0**, Event/Audit **0.4.0**, Data Model **0.5.0**.

Devices now owns immutable software observation snapshots and normalized package rows. GET/PUT `/devices/{deviceId}/software-inventory` enforce `devices.view` / `devices.manage` plus effective Device scope. Reports carry observation time, receipt time, completeness and provenance; stale/equal reports return 409. Partial observations prove presence only, so absent software remains unknown. Assets can consume the latest evidence through `IDeviceSoftwareInventoryReader` without reading Devices tables.

Device Detail shows the latest packages and visibly distinguishes Complete from Partial evidence. Same-transaction audit and `device.software_inventory.observed` outbox event contain snapshot metadata only.

QA: .NET 0 warnings/0 errors; Web typecheck/build PASS; contract/static audits 0 issues; `STEP27_SOFTWARE_INVENTORY_SMOKE_PASS`; development DB migration 1, audit 1, event 1, external Devices FK 0, QA snapshot cleaned; complete/partial React visual QA 6 screens at 1366/1024/768 with 0 failures.

**Next step:** implement Assets baseline evaluation and `baseline_results` projection from `IDeviceSoftwareInventoryReader`. Use freshness policy and completeness: stale/missing inventory → unknown; partial inventory cannot prove missing; only fresh complete inventory may produce compliant/missing. Emit `baseline.drift` only on evidence-backed result transitions. User requested no deployment.
