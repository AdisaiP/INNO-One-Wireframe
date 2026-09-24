# INNO.One — UX/UI Page Review

**Review date:** 2026-09-24  
**Baseline reviewed:** Design System V1.17 / UI Contract 1.11.0  
**Scope:** 74 Web Portal pages + current Agent/Mobile surface language  
**Purpose:** Visual/UX architecture review after technical UI freeze. This is a review document, not a new frozen UI contract.

---

## 1. Executive Summary

The prototype is technically consistent, but a second-order UX problem remains:

1. Many forms still use browser-style native `<select>` controls.
2. Several pages expose too many configuration decisions at once.
3. A few pages combine setup, preview, integration information and output in one screen.
4. Some editors look structurally correct but still feel like a collection of form controls rather than a purpose-built product workflow.
5. List/detail screens are generally stronger than create/edit screens.

Static findings:

- Web pages reviewed: **74**
- Native `<select>`: **127**
- Pages containing a select: **46**
- Pages with 3+ selects: **21**
- Large-form candidates: **7**
- Multi-section form candidates: **3**

### Review grades

- **A — Keep:** architecture is appropriate; only normal polish may be needed.
- **B — Polish:** architecture is acceptable, but controls / hierarchy / density / interaction pattern should be improved.
- **C — Restructure:** page-level UX should change before backend implementation.

---

## 2. Highest-priority problems

### C1 — `asset-qr.html` — RESTRUCTURE

Current page combines:
- asset selection,
- QR generation flow,
- Android Mobile integration explanation,
- QR security policy,
- label settings,
- print preview,
- print action.

This is the clearest example of multiple workflows mixed into one page.

Recommended architecture:

```
QR Labels
  ├─ Step 1: Select Assets
  ├─ Step 2: Label Setup
  │    ├─ Size
  │    ├─ Copies
  │    └─ Content
  ├─ Step 3: Preview
  └─ Step 4: Print

Separate:
  QR Security / Mobile Integration
      -> info drawer or "How QR works" dialog
```

Do not keep Mobile Integration as a permanent right-side form card.

---

### C2 — `ticket-new.html` — RESTRUCTURE

Current screen mixes:
- issue details,
- category/subcategory,
- description,
- impact/urgency,
- calculated priority,
- related context,
- requester information,
- routing preview.

The right-side requester/routing preview is useful, but the left side asks for too much at the same visual priority.

Recommended:

```
Create Ticket

Primary
  Subject
  Description
  Category

Context
  Requester
  Device / Asset
  Attachments

Advanced routing   [collapsed by default]
  Impact
  Urgency
  Priority
  Assignment hints
```

Keep routing preview on the right only after category/requester inputs produce something meaningful.

---

### C3 — `helpdesk-notification-rule.html` — RESTRUCTURE

A notification rule is conceptually one object, but the current editor exposes too many independent form sections:

- Trigger
- Recipients
- Additional recipients
- Template
- Language
- Summary

Recommended editor pattern:

```
Rule Header
  Name / Enabled

1. When
   Event + condition

2. Send to
   Recipient chips / groups

3. Message
   Template + language

Right panel
  Live rule summary
```

Use progressive disclosure instead of showing all options equally.

---

### C4 — `report-builder.html` — RESTRUCTURE / PURPOSE-BUILT BUILDER

The two-column Builder + Preview architecture is correct.

The problem is the left pane still looks like a normal form with many native selectors:
- Data source
- Department
- Status
- Date range
- Group by
- Sort

Recommended:
- searchable dataset combobox,
- column picker with reorder,
- filter-builder rows,
- group/sort chips,
- preview toolbar,
- save draft/report actions remain sticky.

Do **not** split this into multiple pages. It should remain one builder, but stop looking like a generic form.

---

### C5 — Native Select Pattern — SYSTEM-WIDE

Do not style 127 native selects one-by-one.

Create one shared input family:

1. **Select**
   - 5–10 static choices
   - custom trigger + menu
   - keyboard accessible

2. **Combobox**
   - searchable long lists
   - Users / Devices / Groups / Templates / Packages

3. **Multi-select**
   - chips + search
   - recipients / scopes / categories

4. **Segmented / Radio Cards**
   - 2–4 mutually exclusive choices
   - mode, severity, action type where appropriate

5. **Command picker**
   - very large hierarchical resource selection
   - Device Group / Organization / Scope

The existing native `<select>` should remain as progressive-enhancement backing state where useful, but not be the visible final UI.

---

## 3. Module review

### Platform / Admin

| Page | Grade | Review |
| --- | --- | --- |
| workspace-v2.html | A | Strong workspace landing page. |
| app-launcher-v2.html | A | Clear app-oriented mental model. |
| notifications.html | A | Good list + preference separation. |
| profile.html | B | Identity and preferences are acceptable together, but Security / Preferences should feel like distinct sections or tabs. |
| admin.html | A | Good Admin Center overview. |
| modules.html | B | Registry + enable/disable + technical configuration feels slightly mixed. Prefer list → module detail/config drawer/page. |
| roles-permissions-v2.html | A | Permission matrix is appropriate. |
| access-scopes.html | A | Good list-level screen. |
| access-scope-edit.html | B | Structure is good; 4 native selects make it feel generic. Use resource/role pickers. |
| access-scope-browser.html | A | Good dedicated browser. |
| access-scope-evaluate.html | B | Focused task is correct; improve principal/resource selectors. |

---

### Devices

| Page | Grade | Review |
| --- | --- | --- |
| devices-overview-v2.html | A | Strong operational overview. |
| device-detail-v2.html | A | Good resource-detail pattern. |
| device-add.html | B | Focused flow, but target/input selection still feels plain. |
| device-discovery.html | A | Good discovery/result structure. |
| device-groups.html | B | Cards are readable; creation actions should lead to dedicated Static/Dynamic group builders. |
| remote-operations.html | A | Purpose-built operations layout. |
| remote-session.html | A | Specialized UI is appropriate. |
| remote-consent.html | A | Good overview. |
| remote-consent-policy.html | B | Correct architecture; 4 selectors should become purpose-specific controls. |
| remote-consent-message.html | A | Editor + preview is appropriate. |
| remote-consent-rules.html | A | Table + focused dialog is appropriate. |
| remote-consent-history.html | A | Good history table. |
| device-query.html | B | Correct master-detail builder; needs custom condition/query controls instead of normal selects. |
| deployment-jobs.html | A | Good list. |
| deployment-new.html | B | Wizard architecture is strong; later steps should use searchable resource/package selectors. |
| deployment-job-detail.html | A | Good resource detail. |
| agent-maintenance.html | A | Good operations overview. |
| agent-updates.html | A | Good list/rollout entry point. |
| agent-rollout-new.html | B | Stepper is correct; target/channel controls should become dedicated pickers. |
| software-maintenance.html | A | Good job list. |
| software-maintenance-new.html | B | Focused page but visually looks like six dropdowns in a box. Use action/package/scope cards + schedule control. |
| restart-operations.html | A | Good operations page. |
| restart-schedule.html | B | Focused form is correct; target scope/timezone/offline policy need richer control patterns. |
| maintenance-history.html | A | Good history table. |
| endpoint-policies.html | B | Several policy categories share one screen. Consider policy list → policy detail rather than exposing unrelated settings together. |
| device-alerts.html | A | Strong alert center. |
| device-alert-rules.html | A | Good list. |
| device-alert-rule.html | B | Detection rule should look like a rule builder, not a generic select form. |
| device-alert-channels.html | B | Console/Sound/Email are related, but Email settings could use a separate channel card with custom recipient/severity controls. |
| device-alert-history.html | A | Good history screen. |

---

### Assets / Reports

| Page | Grade | Review |
| --- | --- | --- |
| assets-overview.html | A | Strong overview. |
| asset-inventory.html | A | Good inventory list. |
| asset-detail.html | A | Good resource detail. |
| asset-ownership.html | A | Appropriate ownership dashboard. |
| asset-users.html | A | Good user list. |
| asset-user-detail.html | B | Profile + asset rules are related but selectors should be upgraded. |
| asset-ownership-submissions.html | A | Good queue/list. |
| asset-custom-fields.html | A | Good schema list. |
| asset-qr.html | C | Too many workflows combined; convert to wizard + separate information drawer. |
| software-licenses.html | A | Good operational inventory. |
| contracts-warranty.html | A | Good list + summary. |
| reports-overview.html | A | Good report catalog. |
| report-builder.html | C | Keep single-page builder, but replace generic form controls with builder-specific components. |

---

### Helpdesk

| Page | Grade | Review |
| --- | --- | --- |
| helpdesk.html | A | Good Service Desk overview. |
| ticket-new.html | C | Too much create/routing context shown at equal priority. |
| ticket-detail.html | A | Good ticket workspace. |
| helpdesk-sla.html | B | SLA rules and supporting calendar/escalation configuration should be clearer as separate subareas. |
| helpdesk-settings.html | A | Good configuration landing page. |
| helpdesk-categories.html | B | Master-detail is correct; category properties need richer controls and hierarchy interactions. |
| helpdesk-statuses.html | A | Good dedicated configuration list. |
| helpdesk-requester-groups.html | B | Master-detail is good; rule criteria should use a proper rule-builder row. |
| helpdesk-calendar.html | B | Business hours and holidays are related, but calendar exceptions should become a clearer second section/tab. |
| helpdesk-notifications.html | A | Good notification-rule list. |
| helpdesk-notification-rule.html | C | Needs progressive disclosure / rule-builder structure. |
| helpdesk-notification-templates.html | A | Good template list. |
| helpdesk-notification-template.html | A | Editor + preview architecture is correct. |
| helpdesk-notification-delivery.html | A | Good delivery history. |
| helpdesk-notification-settings.html | B | Related settings, but channels/defaults should be visually grouped as distinct configuration blocks. |
| knowledge-base.html | A | Good knowledge workspace. |
| helpdesk-reports.html | A | Good reporting page. |

---

### Meeting

| Page | Grade | Review |
| --- | --- | --- |
| meeting.html | A | Strong workspace. |
| meeting-detail.html | A | Good detail/read pattern. |
| meeting-new.html | B | Record and Upload are different entry actions; they should be clearer as two modes instead of looking like two equal forms on one page. |

---

## 4. Proposed next UX/UI pass

### Phase 1 — Input System

Build shared:
- `INNOSelect`
- `INNOCombobox`
- `INNOMultiSelect`
- `INNORadioCards`
- `INNOResourcePicker`

Then migrate high-impact pages first:
1. ticket-new
2. report-builder
3. access-scope-edit
4. deployment-new
5. device-alert-rule
6. remote-consent-policy
7. software-maintenance-new
8. restart-schedule
9. helpdesk-notification-rule

### Phase 2 — Restructure C-grade screens

Order:
1. Asset QR
2. Create Ticket
3. Notification Rule
4. Report Builder

### Phase 3 — B-grade page polish

Convert generic configuration forms into:
- purpose-built editors,
- list → detail,
- collapsible Advanced sections,
- side preview only where it adds real decision support.

---

## 5. Design rule going forward

A page should answer **one primary user intent**.

Bad:
> "This page contains every setting related to this feature."

Better:
> "This page helps the user complete one job; related advanced configuration is discoverable when needed."

Before adding a form section, ask:

1. Is this required to complete the primary task?
2. Is it needed at the same moment?
3. Does it have the same save lifecycle?
4. Does it have the same permission boundary?
5. Would a user naturally look for it here?

If the answer is no to 2 or more items, move it to:
- a dedicated page,
- a tab/subnav,
- a drawer/dialog,
- or an Advanced section.

---

## 6. Recommended implementation strategy

Do **not** edit all 46 select pages manually first.

Start with the shared Input System, migrate the four C-grade pages, then review the visual language again. Once the custom select/combobox/resource picker exists, many B-grade pages will improve automatically without another architecture rewrite.


## 7. Implementation status — UI Contract 1.12.0

Implemented from this review:
- Shared Select / Combobox / Resource Picker / Segmented input layer across all Web routes.
- C-grade restructure completed for Asset QR, Create Ticket, Notification Rule and Report Builder.
- Remaining B-grade pages now inherit the shared visible input treatment, but page-level architecture polish remains future work.
