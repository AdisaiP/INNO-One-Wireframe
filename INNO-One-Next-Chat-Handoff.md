# INNO.One — Next Chat Handoff

Last updated: 2026-09-24  
Project: `/Users/adisaip/Desktop/INNO-One-Wireframe/`  
Scope: UI/UX prototype only — **ยังไม่ทำ Backend**

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

- Design System: **V1.18**
- UI Contract: **1.12.0**
- Registry Schema: **10**

Source of truth หลัก:

- `design-system.html`
- `inno-design-system.css`
- `inno-design-contract.js`
- `inno-interactions.js`
- `inno-states.js`
- `inno-responsive.js`
- `inno-navigation.js`
- `INNO-One-Final-Visual-QA-Baseline.md`
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

Final UI baseline ถูก Freeze แล้วที่ **Design System V1.18 / UI Contract 1.12.0**

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

- Canonical route screenshots = **87**: Web Portal 83 + Design System 1 + Endpoint Agent 2 + Android Mobile 1
- Important state screenshots = **13**
- Frozen screenshot baseline รวม = **100 ภาพ**
- `qa-final-visual.py` = **116 browser checks / 0 failures**
- Screenshot manifest hash verification = **100 / 100**
- ทุก Web route: page overflow = false, Rail active = 1, Sidebar active = 1, raw placeholder = 0
- Web shell canonical 1366px: Rail 60px / Sidebar 216px / Platform Header 56px ทุก 83 route
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

**สถานะ UI Prototype: ✅ FROZEN / READY FOR BACKEND PLANNING**

หมายเหตุ: Ready for Backend Planning ไม่ได้แปลว่า Backend, integration หรือ TOR acceptance ถูก implement แล้ว

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

> เปิดโปรเจกต์ `/Users/adisaip/Desktop/INNO-One-Wireframe/` ผ่าน MCP แล้วอ่าน `INNO-One-Next-Chat-Handoff.md`, `INNO-One-Final-Visual-QA-Baseline.md`, `INNO-One-UI-Prototype-Summary.md`, `INNO-One-Screen-Architecture-Refactor-Plan.md` และ Design System ก่อน ตอนนี้ UI ถูก Freeze ที่ **Design System V1.18 / UI Contract 1.12.0** แล้ว ให้เริ่ม **Backend Planning — Domain / API / Event / Permission Mapping** จาก frozen UI contract ก่อน ยังไม่แก้ UI baseline หรือเริ่ม Backend code จนกว่า architecture mapping จะชัดเจน

---

## 13. Definition of Done ก่อนเริ่ม Backend

**Status: ✅ UI Definition of Done ผ่านแล้ว — Ready for Backend Planning**

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
- Current frozen screenshot baseline = 87 canonical route screenshots + 13 state screenshots = 100 files.


# NEXT 7 — Backend Planning: Domain / API / Event / Permission Mapping ✅ COMPLETED 2026-09-25

Planning branch: `planning/backend-contracts`

No backend implementation has been added on this branch.

Backend planning source of truth:

- `INNO-One-Backend-Planning-Index.md`
- `INNO-One-Backend-Architecture.md`
- `INNO-One-Domain-Model.md`
- `INNO-One-API-Contract.md`
- `INNO-One-Event-Catalog.md`
- `INNO-One-Permission-Matrix.md`
- `INNO-One-Database-Plan.md`
- `backend-planning-audit.py`

Planning decisions:

- Initial backend architecture = **ASP.NET Core 9 Modular Monolith** with explicit module boundaries.
- Primary database plan = **PostgreSQL, schema-per-module**.
- Keycloak stays the authentication/identity provider; INNO.One owns application RBAC and resource scopes.
- MeshCentral stays a Devices engine/provider behind an adapter; canonical INNO.One Device IDs must not equal provider node IDs.
- Web, Endpoint Agent and Android Mobile continue as separate surfaces sharing auth/RBAC/API/event contracts.
- Cross-module writes are forbidden; use module contracts, canonical IDs, events and reporting projections.
- Long-running deployment/maintenance/meeting/report work is modeled as durable jobs.
- Integration events use transactional Outbox + idempotent Inbox/consumer semantics.

Coverage QA:

- Planning documents = **7 / 7**.
- Frozen Web routes = **83**.
- Domain ownership coverage = **83 / 83**.
- API ownership coverage = **83 / 83**.
- Route permission coverage = **83 / 83**.
- Existing module-manifest permissions documented = **43 / 43**.
- Existing module-manifest events documented = **37 / 37**.
- Backend implementation files on planning branch = **0**.
- `backend-planning-audit.py` = **0 issues**.

## NEXT 8 — First Backend Vertical Slice

Do not implement all modules at once.

Recommended sequence:

1. Platform Core foundation
   - Keycloak OIDC sign-in / session
   - `GET /api/v1/me`
   - Organization / User mapping
   - Roles / Permissions
   - Access Scope evaluator
   - Module Registry visibility
   - Audit skeleton
2. Devices first business slice
   - Devices List
   - Device Detail
   - Device Groups
   - MeshCentral provider mapping / adapter
3. Only after that, expand Remote / Alerts / Deployment and then Helpdesk.

Definition of Done before NEXT 8 code:

- Review/accept the six planning documents.
- Confirm PostgreSQL as primary DB.
- Confirm the Web auth pattern (recommended BFF/session cookie around Keycloak OIDC).
- Confirm MeshCentral adapter access method/API available to the implementation.

Suggested next-chat prompt:

> เปิดโปรเจกต์ `/Users/adisaip/Desktop/INNO-One-Wireframe/` ผ่าน MCP แล้วอ่าน `INNO-One-Backend-Planning-Index.md`, `INNO-One-Backend-Architecture.md`, `INNO-One-Domain-Model.md`, `INNO-One-API-Contract.md`, `INNO-One-Permission-Matrix.md`, `INNO-One-Event-Catalog.md`, `INNO-One-Database-Plan.md` และ `INNO-One-Next-Chat-Handoff.md` ก่อน จากนั้นเริ่ม NEXT 8 เฉพาะ Platform Core foundation ตาม contract ที่วางไว้ ห้ามขยายไป module อื่นก่อน slice แรกผ่าน QA
