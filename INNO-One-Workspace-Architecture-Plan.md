# INNO.One — Workspace Architecture & Information Architecture Plan

> สถานะ: Planning / ยังไม่แก้ Production Code
> เป้าหมาย: เปลี่ยน INNO.One จาก “Portal ที่รวมหลายระบบ” ให้เป็น “Workspace / Product Suite” แบบที่ผู้ใช้รู้สึกว่าเป็นแพลตฟอร์มเดียว แต่แต่ละ App ยังมีพื้นที่ทำงานของตัวเอง

## 1. Product Vision

INNO.One ไม่ควรเป็น Dashboard ใหญ่ที่เอา Devices, Helpdesk, Meeting และระบบอื่นมาวางรวมกัน
แต่ควรเป็น “Workspace Platform” ที่ทำหน้าที่ 3 อย่าง:

1. เป็นประตูเข้าใช้งานทุก App ด้วย Account เดียว
2. ให้ผู้ใช้สลับ App ได้อย่างต่อเนื่อง โดยยังคงบริบทและ Design Language เดียวกัน
3. ให้ Admin เปิด/ปิด App, กำหนดสิทธิ์ และจัดการองค์กรจากศูนย์กลาง

แนวคิดหลัก:
- Workspace = จุดเริ่มต้นและตัวเชื่อม
- App = พื้นที่ทำงานเฉพาะเรื่อง
- Admin Center = พื้นที่บริหาร Platform
- Engine/Provider = ระบบเบื้องหลัง เช่น MeshCentral, Keycloak, Email, AI Provider

---

## 2. Mental Model ใหม่

```text
User
  │
  ▼
INNO.One Workspace
  │
  ├── App Launcher
  ├── Global Search
  ├── Notifications
  ├── Account / SSO
  │
  ├──────────────┬──────────────┬──────────────┐
  ▼              ▼              ▼              ▼
Devices        Helpdesk       Meeting        Future Apps
  │              │              │
  ▼              ▼              ▼
MeshCentral    .NET/API      Web/Agent/AI
Engine         Services      Services
```
## 3. กฎสำคัญที่สุดของ UX

### 3.1 Global UI มีน้อย แต่คงที่ทุก App
สิ่งที่ผู้ใช้เห็นเหมือนกันตลอด:
- INNO.One logo / brand
- App Launcher
- Global Search
- Notifications
- Profile / Account
- Breadcrumb ระดับ Platform
- Design tokens เช่น font, spacing, buttons, form, modal, table

### 3.2 App Navigation เป็นของ App นั้นเอง
ห้ามมี Sidebar กลางที่ยัดทุก Feature ของทุก App รวมกัน

ตัวอย่างเมื่ออยู่ Devices:
```text
Global Bar: INNO.One | Apps | Search | Notifications | Profile

Devices
├─ Overview
├─ My Devices
├─ Groups
├─ Remote Sessions
├─ Policies
└─ Settings
```

เมื่อกดไป Helpdesk:
```text
Global Bar: INNO.One | Apps | Search | Notifications | Profile

Helpdesk
├─ Home
├─ My Tickets
├─ Assigned to Me
├─ All Tickets
├─ SLA
├─ Knowledge Base
└─ Reports
```

ดังนั้นผู้ใช้รู้ว่า “ตอนนี้ฉันอยู่ใน App ไหน” ชัดเจนเสมอ

---

## 4. Information Architecture ระดับ Platform

### A. Workspace Layer
- Home
- App Launcher
- Global Search
- Notifications
- My Account
- Continue Working
- For You / Action Center

### B. Application Layer
- Devices
- Helpdesk
- Meeting
- Assets (future)
- Workflow (future)
- Reports (future)
- Other plugins/modules

### C. Admin Layer
- Organization
- Users
- Groups
- Roles & Permissions
- Apps & Modules
- Integrations
- Security
- Audit Log
- Branding
- Platform Settings
## 5. Workspace Home — ต้องมีอะไร

Home ต้องเป็น “Start Page” ไม่ใช่ Operational Dashboard

```text
┌─────────────────────────────────────────────────────────┐
│ INNO.One    [ Search across workspace... ]   🔔   👤   │
└─────────────────────────────────────────────────────────┘

Good morning, Adisai

Your Apps
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Devices  │ │ Helpdesk │ │ Meeting  │ │ More     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

Continue Working
- DESKTOP-HR-014                 Devices
- HD-1048 VPN issue              Helpdesk
- Daily Product Sync             Meeting

For You
- 2 tickets assigned to you
- 1 meeting summary ready
- 3 devices need attention

Recent
- รายการล่าสุดแบบ cross-app
```

สิ่งที่ “ไม่ควร” อยู่หน้า Home:
- Device CPU chart
- SLA dashboard ขนาดใหญ่
- Ticket queue ทั้งหมด
- Meeting analytics
- Admin settings
- Module configuration

ข้อมูลพวกนั้นต้องอยู่ใน App ของตัวเอง

---

## 6. App Launcher

App Launcher เป็นหัวใจของ Workspace

### รูปแบบ
```text
Apps
─────────────────────────────
Pinned
🖥 Devices     🎫 Helpdesk
🎙 Meeting     📦 Assets

All Apps
📊 Reports     🔁 Workflow
...
```

### Behavior
- แสดงเฉพาะ App ที่ Organization เปิดใช้งาน
- แสดงเฉพาะ App ที่ User มีสิทธิ์
- User สามารถ Pin/Unpin App ได้
- Admin เปลี่ยนชื่อ/ไอคอน/ลำดับระดับองค์กรได้
- App ใหม่ไม่ต้องแก้ Global Sidebar โดยตรง
## 7. Devices App

เป้าหมาย: ทำให้ผู้ใช้รู้จัก “INNO.One Devices” ไม่ใช่ “MeshCentral”

### Navigation
- Overview
- Devices
- Device Groups
- Remote Sessions
- Policies
- Agent Deployment
- Reports
- Settings

### Device Detail
- Overview
- Hardware / OS
- Health
- Remote
- Terminal
- Files
- Activity
- Related Tickets

### Integration Boundary
```text
INNO.One Devices UI
        │
Devices Service / Adapter
        │
MeshCentral API / Engine
```

กฎ:
- ห้าม Embed หน้าตา MeshCentral ทั้งหน้าเป็น UX หลัก
- MeshCentral เป็น Engine
- Device ID กลางของ INNO.One ต้อง map กับ MeshCentral Node ID
- Permission ตรวจที่ INNO.One ก่อนเรียก Engine

---

## 8. Helpdesk App

### Navigation
- Home
- My Tickets
- Assigned to Me
- Team Queue
- All Tickets
- SLA
- Knowledge Base
- Automation
- Reports
- Settings

### Ticket Detail
- Conversation
- Requester
- Assignee
- Priority
- SLA
- Attachments
- Related Device
- Activity Timeline

Cross-App:
- Ticket สามารถ link กับ Device
- จาก Ticket กด “Open Device” ได้
- จาก Device กด “Create Ticket” ได้
- แต่ไม่ย้าย Device UI มาวางใน Helpdesk

---

## 9. Meeting App

### Navigation
- Home
- Upcoming
- Record
- Upload
- My Meetings
- Shared With Me
- Templates
- Reports
- Settings

### Meeting Detail
- Summary
- Transcript
- Action Items
- Participants
- Files
- Sharing
- Export

### Backend Boundary
```text
Meeting UI
   │
Meeting API
   ├─ Recording Agent
   ├─ Transcription Provider
   ├─ Summary Provider
   └─ Storage
```
## 10. Admin Center ต้องแยกจาก Workspace

Admin Center ไม่ใช่ App ธรรมดาของ User

```text
INNO.One Admin Center

Organization
├─ Organization Profile
├─ Org Units
├─ Branches
└─ Teams

Identity & Access
├─ Users
├─ Groups
├─ Roles
└─ Permissions

Apps
├─ Installed Apps
├─ App Catalog
├─ App Access
└─ Dependencies

Platform
├─ Integrations
├─ Notifications
├─ Search
├─ Audit
├─ Security
├─ Branding
└─ Settings
```

Admin Center ใช้ Global Design System เดียวกัน แต่มี Navigation ของ Admin โดยเฉพาะ

---

## 11. Module / Plugin Contract

ทุก App ที่ต้องการเสียบเข้า INNO.One ต้องประกาศ Manifest กลาง

ตัวอย่างเชิง Concept:

```json
{
  "id": "devices",
  "name": "Devices",
  "icon": "computer",
  "route": "/devices",
  "permissions": [
    "devices.view",
    "devices.remote",
    "devices.manage"
  ],
  "navigation": [
    "overview",
    "devices",
    "groups",
    "sessions"
  ],
  "events": [
    "device.online",
    "device.offline",
    "remote.started"
  ]
}
```

Platform อ่าน Manifest เพื่อ:
- สร้าง App Launcher
- ตรวจ Permission
- Register Navigation
- Subscribe Notification
- Register Global Search source
- Register Audit events
## 12. Platform Core ที่ควรมีจริง

### Identity
- SSO
- User session
- User profile
- Organization membership

### RBAC
- Roles
- Permissions
- App access
- Scope เช่น Own / Team / Org

### App Registry
- Installed apps
- Enabled/disabled
- Version
- Dependency
- Health

### Navigation Registry
- Global navigation
- App navigation declaration
- Pin / Favorites

### Notification Hub
- In-app notifications
- Email provider
- Read/unread
- Deep link กลับไปยัง App

### Global Search
Search across:
- Apps
- People
- Devices
- Tickets
- Meetings

แต่ผลลัพธ์ต้อง deep-link กลับเข้า App เจ้าของข้อมูล

### Audit
Event format กลาง เช่น:
```text
actor
action
module
target
timestamp
metadata
```

---

## 13. User Journey — User ทั่วไป

```text
Login
  ↓
INNO.One Home
  ↓
เห็นเฉพาะ Apps ที่มีสิทธิ์
  ↓
เลือก App
  ↓
ทำงานใน App
  ↓
App Launcher
  ↓
สลับ App โดยไม่ต้อง Login ใหม่
```

ตัวอย่าง:
```text
Somchai Login
→ Home
→ Helpdesk
→ Create Ticket
→ Link DESKTOP-HR-014
→ Submit
→ Notification แจ้งเมื่อ Support ตอบ
→ เปิด Notification
→ กลับ Ticket Detail
```
## 14. User Journey — Support Agent

```text
Login
→ Home
→ For You: 5 Assigned Tickets
→ Helpdesk
→ Assigned to Me
→ Open HD-1048
→ เห็น Related Device
→ Open in Devices
→ Remote
→ แก้ปัญหา
→ Return to Ticket
→ Resolve
```

จุดสำคัญ:
- Helpdesk และ Devices เชื่อมกันด้วย Deep Link + Shared Identity
- ไม่เอา UI สอง App มายำในหน้าเดียว
- Context ส่งต่อกันได้ เช่น ticketId / deviceId

---

## 15. User Journey — Admin

```text
Login
→ Workspace
→ Account menu
→ Admin Center
→ Apps & Modules
→ Enable Meeting
→ Assign access to Development Team
→ Meeting ปรากฏใน App Launcher ของทีม
→ Audit event ถูกบันทึก
```

---

## 16. URL / Route Model ที่แนะนำ

```text
/                         Workspace Home
/apps                     App Launcher
/search                    Global Search
/notifications             Notification Center
/account                   User Account

/devices/...               Devices App
/helpdesk/...              Helpdesk App
/meeting/...               Meeting App

/admin/...                 Admin Center
```

ตัวอย่าง:
```text
/devices/abc123
/helpdesk/tickets/HD-1048
/meeting/meet-123
/admin/apps
/admin/users
```
## 17. App Shell Standard

ทุก App ต้องใช้โครงนี้:

```text
┌──────────────────────────────────────────────────────┐
│ Global Bar                                           │
│ INNO.One | App Launcher | Search | 🔔 | Profile      │
├──────────────┬───────────────────────────────────────┤
│ App Nav      │ App Content                           │
│              │                                       │
│ Overview     │                                       │
│ Feature A    │                                       │
│ Feature B    │                                       │
│ Settings     │                                       │
└──────────────┴───────────────────────────────────────┘
```

Global Bar = Platform เป็นเจ้าของ
App Nav = Module เป็นเจ้าของ
Content = Module เป็นเจ้าของ

นี่คือ boundary ที่ต้องรักษาให้ชัด

---

## 18. Design System

เหมือนกันทุก App:
- Typography
- Color tokens
- Spacing
- Buttons
- Inputs
- Tables
- Modal
- Drawer
- Toast
- Empty state
- Error state
- Loading
- Avatar
- Badge
- Status
- Breadcrumb

ไม่บังคับให้เหมือนกัน:
- Layout ของ Device Detail
- Layout ของ Ticket
- Layout ของ Meeting Summary
- Workflow ภายใน App

เป้าหมายคือ “เป็นครอบครัวเดียวกัน” ไม่ใช่ “ทุกหน้าต้องเหมือนกัน”
## 19. Technology Boundary

ไม่ควร Rewrite ทุกอย่างให้เป็นภาษาเดียว

```text
                   INNO.One Platform
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     Devices          Helpdesk          Meeting
        │                │                │
   Adapter/API        .NET API       Meeting API
        │                                 │
  MeshCentral                         Agent / AI
   Node.js
```

สิ่งที่ Standardize:
- Auth token
- Permission model
- API conventions
- Error contract
- Event contract
- Audit contract
- Module manifest
- Design System
- Logging / observability

สิ่งที่ไม่จำเป็นต้อง Standardize:
- Programming language
- Internal database ทุก App
- Internal library
- Vendor engine

---

## 20. สิ่งที่ควรหยุดทำจาก Prototype เดิม

1. หยุดใช้ Sidebar กลางเป็นรายการทุก Module
2. หยุดเอา Operational KPI ของทุก App ไปรวม Home
3. หยุดให้ Admin menu ปนกับ User Workspace
4. หยุดให้ External Engine เป็น Product UI หลัก
5. หยุดเพิ่ม App ใหม่ด้วยการ hard-code เมนู
6. หยุดแชร์ Business Logic ข้าม Module แบบตรง ๆ
7. หยุดสร้าง User/Role ซ้ำในแต่ละ App ถ้าเป็น Platform Identity

---

## 21. Sitemap เป้าหมาย

```text
INNO.One
│
├─ Workspace
│  ├─ Home
│  ├─ Apps
│  ├─ Search
│  ├─ Notifications
│  └─ Account
│
├─ Devices
│  ├─ Overview
│  ├─ Devices
│  ├─ Groups
│  ├─ Sessions
│  ├─ Policies
│  ├─ Deployment
│  └─ Settings
│
├─ Helpdesk
│  ├─ Home
│  ├─ My Tickets
│  ├─ Assigned
│  ├─ Queue
│  ├─ SLA
│  ├─ Knowledge
│  ├─ Automation
│  └─ Reports
│
├─ Meeting
│  ├─ Home
│  ├─ Upcoming
│  ├─ Record
│  ├─ Upload
│  ├─ My Meetings
│  ├─ Shared
│  ├─ Templates
│  └─ Reports
│
└─ Admin Center
   ├─ Organization
   ├─ Users
   ├─ Groups
   ├─ Roles
   ├─ Apps & Modules
   ├─ Integrations
   ├─ Security
   ├─ Audit
   ├─ Branding
   └─ Platform Settings
```

---

## 22. Phase การปรับจากระบบปัจจุบัน

### Phase 0 — Freeze UX Structure
ยังไม่ Rewrite backend
- Approve IA
- Approve Global Bar
- Approve App Launcher
- Approve App Shell
- Approve Admin boundary

### Phase 1 — Platform Shell
สร้าง:
- Workspace Home
- App Launcher
- Global Bar
- Profile
- Notification shell
- Route structure

### Phase 2 — App Registry + Permission
- Module manifest
- Enable/disable
- App visibility by permission
- Dynamic launcher/navigation

### Phase 3 — Devices Facade
- INNO.One Devices UI
- Adapter to MeshCentral
- Mapping Device ID
- Deep link Helpdesk ↔ Devices

### Phase 4 — Helpdesk
- ย้าย Helpdesk เข้า App Shell
- ใช้ Identity/RBAC กลาง
- เชื่อม Related Device

### Phase 5 — Meeting
- ย้าย Meeting เข้า App Shell
- Notification / Search / Audit integration

### Phase 6 — Admin Center
- Organization
- Users
- Roles
- Apps
- Integration
- Audit
## 23. Wireframe รอบถัดไปที่ควรทำ

ไม่ต้องทำ 24 หน้าในครั้งเดียว

ทำเพียง 8 “Canonical Screens” ก่อน:

1. Login
2. Workspace Home
3. App Launcher
4. Devices App Shell + Overview
5. Device Detail
6. Helpdesk App Shell + Ticket Detail
7. Meeting App Shell + Meeting Detail
8. Admin Center + Apps & Modules

ถ้า 8 หน้านี้ดูเป็น Workspace จริงแล้ว
ค่อยแตกหน้ารองทั้งหมด

---

## 24. Definition of Done ของ Prototype รอบใหม่

Prototype ผ่านเมื่อ:

- มอง Home แล้วไม่รู้สึกว่าเป็น Dashboard IT
- เข้า Devices แล้วรู้ทันทีว่าอยู่ Devices App
- เข้า Helpdesk แล้ว Navigation เปลี่ยนเป็นของ Helpdesk
- App Launcher สลับ App ได้ทุกหน้า
- ไม่มี Sidebar ที่รวมทุก Feature ของทุก App
- Admin ถูกแยกออกจาก User Workspace
- MeshCentral ไม่โผล่เป็น Product หลัก
- เปิด/ปิด Module แล้ว App Launcher เปลี่ยนตาม
- UI ดูเป็น Brand เดียวกัน แม้แต่ละ App layout ต่างกัน
- Cross-App ใช้ deep link ไม่ใช้การยำหน้าจอ

---

## 25. ข้อสรุปสำหรับ INNO.One

คำจำกัดความใหม่:

> **INNO.One คือ Workspace Platform ที่รวม Identity, Navigation, Search, Notification และ Administration ไว้ส่วนกลาง แล้วให้ Business Apps แต่ละตัวเสียบเข้ามาเป็น Module ที่มีพื้นที่ทำงานของตัวเอง**

นี่ควรเป็นหลักก่อนเริ่มออก Wireframe และก่อน Refactor code จริง

## 26. Surface Boundary — Web / Agent / Mobile

INNO.One ต้องแยก application surface ให้ชัดเจน แม้จะใช้ Identity, Permission, API, Event และ Audit contract ร่วมกัน

```text
INNO.One Platform
├─ Web Portal      → Workspace / Devices / Assets / Helpdesk / Meeting / Reports / Admin
├─ Endpoint Agent  → Request Help / Ownership Confirmation / Runtime Remote Consent
└─ Android Mobile  → Asset QR Scanner / Mobile Asset Lookup
```

กฎหลัก: **Share contracts, not navigation.**

- `inno-navigation.js` เป็นเจ้าของเฉพาะ Web Portal routes
- Agent/Mobile prototype ต้องไม่โหลด Web platform shell หรือ contextual sidebar
- Web สามารถแสดง preview ของ Agent/Mobile เพื่อใช้ตั้ง policy ได้ แต่ต้องไม่ทำให้ดูเหมือนเป็น operational UI ของ Web
- TOR หนึ่งข้อสามารถครอบคลุมหลาย surface ได้ ไม่ควรแปลง `1 TOR clause = 1 Web page`

ดูรายละเอียดที่ `INNO-One-Surface-Boundaries.md`

---

## 27. Special UI Decision Rules

เลือก UI จากความหมายของข้อมูล ไม่ใช่จากหน้าตา:

- Fixed ordered sequence → `INNOStepper`
- Chronological events → `INNOTimeline`
- Lifecycle state → `INNOStatusStepper`
- Nested hierarchy → `INNOTree`
- Hierarchy + columns → `INNOTreeGrid`
- Reporting line → `INNOOrgChart`
- Editable branching workflow → `INNOWorkflowCanvas`
- BPMN 2.0 requirement → `INNOBpmnDesigner`

ดู library mapping และ usage rules ที่ `INNO-One-Special-UI-Components.md`


## 23. Backend contract mapping — 2026-09-25

The conceptual platform/module architecture in this document is now translated into implementation planning documents under `INNO-One-Backend-Planning-Index.md`. The selected initial shape is an ASP.NET Core modular monolith with PostgreSQL schema ownership per module, Keycloak identity adapter, MeshCentral Devices adapter, transactional integration events and an explicit worker boundary. No backend code was added during this planning pass.
