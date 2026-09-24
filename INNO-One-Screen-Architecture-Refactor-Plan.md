# INNO.One — Screen Architecture Refactor Plan

Last updated: 2026-09-24  
Status: Completed UI architecture baseline; frozen for backend planning under UI Contract 1.12.0.

## 1. Problem statement

The current prototype was built to prove TOR coverage quickly. As a result, some screens combine several independent user jobs into one page. This is acceptable for requirement coverage, but it is not the desired production UX.

The refactor goal is:

> One screen should have one primary job. Supporting views may exist on the same screen only when they directly support that job.

Do not treat every TOR clause as a reason to add another panel or form to an existing page.

## 2. Canonical screen patterns

| Pattern | Purpose | Typical UI |
| --- | --- | --- |
| P01 Overview | summarize a module | KPI + attention + recent activity + primary CTA |
| P02 List | find/select many records | filters + table/list + bulk actions |
| P03 Resource Detail | inspect one resource | header + summary + related-data tabs |
| P04 Create/Edit | edit one resource | dedicated form + sections + sticky actions |
| P05 Settings | configure a domain | settings navigation + one settings section at a time |
| P06 Builder | construct a query/report/workflow | palette/config + canvas/preview + inspector |
| P07 Monitor/Operations | watch live/running work | status + command bar + logs/history |
| P08 Wizard | complete a multi-step operation | Stepper + one step at a time + review |
| P09 Master–Detail | select an item and inspect/edit it | list/tree + detail inspector, when both are one job |
| P10 History/Log | inspect past events | filters + timeline/table + details drawer |

## 3. Form rules

- 1–5 simple fields: dialog or drawer is acceptable.
- 6–12 fields: use a dedicated create/edit page.
- Multi-section or conditional forms: dedicated page with section navigation.
- Sequential configuration: use INNOStepper / Wizard.
- A list page should not permanently expose a large edit form beside the list unless it is a true Master–Detail task.
- Preview may sit beside an editor only when it previews the exact thing currently being edited.

## 4. Action rules

- Page header: 1 primary action, 0–2 secondary actions.
- Save belongs to the editor, not the list/overview page.
- Test/Preview actions belong to the relevant configuration/editor section.
- Destructive actions use menu/dialog confirmation.
- Avoid multiple different Save buttons on one visual level.

## 5. High-priority architecture refactors

### A. helpdesk-notifications.html — HIGH

Current page mixes:
- rule list,
- rule editor,
- template editor,
- email preview,
- delivery health,
- delivery history,
- connection/test actions.

Refactor:
- Notifications / Rules → P02 List
- Notification Rule → P04 Edit
- Templates → P02 List
- Template → P04 Edit + sticky Preview
- Delivery → P10 History/Log
- Settings → P05 Settings

Proposed routes:
- /helpdesk/notifications/rules
- /helpdesk/notifications/rules/:id
- /helpdesk/notifications/templates
- /helpdesk/notifications/templates/:id
- /helpdesk/notifications/delivery
- /helpdesk/notifications/settings

### B. agent-maintenance.html — HIGH

Current page mixes:
- agent release,
- rollout policy,
- rollout plan,
- version distribution,
- software maintenance,
- restart scheduling,
- upcoming restart windows,
- maintenance history.

Refactor:
- Agent Maintenance Overview → P01
- Agent Versions / Rollouts → P02 + P08 New Rollout
- Software Maintenance → P02 + P08 New Maintenance Job
- Restart Operations → P02/P07 + P08 Schedule Restart
- Maintenance History → P10

The current tabs are not sufficient because each tab still contains creation form + status + history.

### C. deployment-jobs.html — HIGH

Current page mixes create forms and running/history jobs.

Refactor:
- Deployment Jobs → P02/P07 list
- New Deployment → P08 Wizard
  1. Type
  2. Targets
  3. Package / Files
  4. Schedule
  5. Options
  6. Pre-flight / Review
- Deployment Job Detail → P03/P07
- History → filter on list or P10

Do not keep full Agent/Software/File creation forms expanded on the main list page.

### D. device-alerts.html — HIGH

Current page mixes:
- alert monitoring,
- alert rules,
- rule editor,
- console/sound channel settings,
- email settings,
- delivery health,
- alert history.

Refactor:
- Alerts → P07 Monitor
- Alert Rules → P02 List
- Alert Rule → P04 Edit
- Notification Channels → P05 Settings
- Alert History → P10

The current tabs are a useful first separation, but the rule editor and channel forms should no longer be embedded inside the list/monitor page.

### E. remote-consent.html — HIGH

Current page mixes:
- default policy,
- consent message editor,
- bypass rules,
- endpoint preview,
- policy evaluation,
- consent decision history,
- add bypass rule form.

Refactor:
- Remote Consent Overview → P01
- Consent Policy → P05 Settings
- Consent Message → P04 Edit + endpoint preview
- Bypass Rules → P02 List
- Bypass Rule → drawer only if <=5 fields; otherwise P04
- Consent Decisions → P10

Preview is allowed beside Consent Message because both represent one editing job.

### F. helpdesk-settings.html — HIGH

Current tabs are better than a single long form, but each configuration domain should become a settings subsection with its own editor behavior.

Refactor:
- Configuration shell → P05 Settings
- Categories → Tree + detail editor
- Statuses → list/status flow + status editor
- Requester Groups → rule list + dedicated rule editor
- Business Calendar → calendar settings + holiday table

Do not show unrelated forms in the same scroll surface.

### G. access-scopes.html — MEDIUM/HIGH

Current page mixes:
- assignment list,
- hierarchy,
- assignment editor,
- effective-access preview,
- evaluation.

Refactor:
- Access Assignments → P02 List
- New/Edit Assignment → P04
- Scope Browser → P09 Tree/TreeGrid + detail
- Effective Access → dedicated inspector/drawer
- Access Evaluation → separate test/evaluate utility

### H. asset-ownership.html — MEDIUM

Current page mixes profile data, ownership relations, incoming Agent submissions and custom fields.

Refactor:
- Ownership & Users Overview → P01
- Users → P02
- User Detail → P03
- Ownership Assignments → P02/P10
- Agent Submissions → P02 review queue
- Custom Fields → P05 Settings

The endpoint confirmation explanatory card can remain on Overview as integration context.

### I. device-query.html — MEDIUM

Current layout contains Builder, supported facts, saved queries, result table and summary.

Keep as P06 Builder, but structure as:
- left: Saved Queries / Facts
- center: Query Builder
- bottom/secondary region: Results
- right drawer: Result Summary / selected device detail

Do not render Saved Queries, documentation, builder and results as equal cards.

### J. report-builder.html — LOW/MEDIUM

This is a legitimate P06 Builder. Definition + Preview belong together.

Polish rather than split:
- editor/definition left,
- preview right,
- sticky Run/Save actions,
- move definition summary into collapsible inspector.

### K. ticket-new.html — LOW

This is one primary job: create a ticket.

Keep as P04 Create, but improve hierarchy:
- Issue
- Priority
- Context
- Requester
- Routing preview

If future fields grow substantially, convert to P08 Wizard. Do not split merely because the form has several sections.

## 6. Pages that are dense but structurally correct

These should be polished, not aggressively split:

- device-detail-v2.html → P03 Resource Detail with tabs.
- asset-detail.html → P03 Resource Detail with tabs.
- meeting-detail.html → P03 Resource Detail with tabs.
- remote-session.html → P07 Operations.
- report-builder.html → P06 Builder.
- remote-operations.html → module operations with sibling views; review tabs, but no immediate route explosion.
- modules.html → P09 Master–Detail is appropriate.
- device-groups.html → P09 can work if list and selected-group rule editor are clearly linked.

## 7. Full-System Polish sequence

### Round 1 — Screen Architecture
Audit every route and assign one P01–P10 pattern.
Refactor all HIGH-risk mixed-purpose pages before visual polish.

Order:
1. Helpdesk Notifications
2. Agent Maintenance
3. Deployment Jobs
4. Device Alerts
5. Remote Consent
6. Helpdesk Configuration
7. Access Scopes
8. Asset Ownership
9. Device Query
10. remaining medium-risk screens

### Round 2 — Navigation / Route ownership
- remove remaining # links,
- replace fake actions with disabled/Coming Soon where necessary,
- make List → Detail → Edit → Back behavior consistent,
- keep Web / Agent / Mobile boundaries enforced.

### Round 3 — Component consistency
Standardize:
- page header,
- section header,
- button hierarchy,
- filters,
- tables,
- form fields,
- tabs,
- drawer,
- dialog,
- stepper,
- timeline,
- tree/treegrid,
- empty state,
- loading/error/success states.

### Round 4 — Density / spacing / typography
- consistent page width,
- consistent vertical rhythm,
- fewer unnecessary cards,
- remove card-within-card nesting,
- consistent section spacing,
- label/input density,
- table row height,
- readable Thai/English typography.

### Round 5 — Interaction consistency
- Create/Edit/Delete flows,
- unsaved changes,
- save/saved states,
- validation,
- confirm dialogs,
- filters and reset,
- bulk selection/actions,
- preview/test behavior,
- success/error feedback.

### Round 6 — Responsive
Validate at:
- 1366 desktop,
- 1024 compact desktop/tablet landscape,
- 768 narrow portal.

Agent/Mobile are validated separately using their own surface widths.

### Round 7 — Production-readiness cleanup
- placeholders,
- dead controls,
- fake links,
- SOON labels,
- inconsistent copy,
- duplicated actions,
- permission-aware states.

### Round 8 — Final visual regression
Screenshot every canonical route and important state.
No architecture changes after this round unless a blocker is found.

## 8. Definition of done for a polished screen

A screen is not done until:
- it has one clear primary job,
- its pattern P01–P10 is documented,
- header actions are limited and correctly scoped,
- forms are not mixed with unrelated monitoring/history,
- no dead/fake actions remain,
- empty/loading/error/success states exist where relevant,
- responsive QA passes,
- visual hierarchy matches the shared design system.

## 9. Implementation progress — 2026-09-24

Implemented in the first architecture pass:

- ✅ Helpdesk Notifications → Rules / Rule Editor / Templates / Template Editor / Delivery / Settings.
- ✅ Device Alerts → Active Monitor / Rules / Rule Editor / Channels / History.
- ✅ Deployment Jobs → Jobs List / New Deployment Wizard / Job Detail.
- ✅ Agent Maintenance → Overview / Agent Updates / New Rollout / Software Maintenance / New Software Job / Restart Operations / Schedule Restart / History.
- ✅ Remote Consent → Overview / Policy / Consent Message + Preview / Bypass Rules / History.
- ✅ Helpdesk Configuration → Overview / Categories / Statuses / Requester Groups / Business Calendar.
- ✅ Access Scopes → Assignments / Assignment Editor / Scope Browser / Evaluate Access.
- ✅ Asset Ownership → Overview / Users / User Detail / Agent Submissions / Custom Fields.
- ✅ Inventory Query → Builder-centric P06 layout with supporting Saved Queries/Facts and separated Results.

Still intentionally not split:
- device-detail-v2.html — P03 Resource Detail is structurally correct.
- asset-detail.html — P03 Resource Detail is structurally correct.
- meeting-detail.html — P03 Resource Detail is structurally correct.
- ticket-new.html — P04 Create form is still one user job.
- report-builder.html — P06 Builder is structurally correct.
- remote-session.html — P07 Operations is structurally correct.

Next pass:
1. Route/navigation QA across all new child screens.
2. Remove/deactivate remaining fake `#` actions and Coming Soon placeholders.
3. Standardize page header, table toolbar, editor footer and list/detail action hierarchy.
4. Density/spacing/typography pass after the architecture is stable.
