# INNO.One Design System — Frozen UI Contract

**UI Contract:** 1.20.0
**Documentation:** Design System V1.26
**Status:** Frozen  
**Frozen:** 2026-09-26

> This document is the implementation handoff for the current INNO.One prototype. New modules should reuse these contracts instead of introducing parallel UI patterns.

## 1. Source of truth

The frozen UI contract is represented by:

- `design-system.html` — visual reference and usage rules
- `inno-design-system.css` — prototype tokens and component styling
- `inno-design-contract.js` — machine-readable component contract
- `inno-interactions.js` — menus, filters, columns, confirmation, toast, tabs
- `inno-inputs.js` — Select, Combobox, Multi-select, Segmented and Resource Picker prototype contract
- `inno-states.js` — loading, empty, error, permission, offline and partial states
- `inno-responsive.js` — shell breakpoints, sidebar and dense-content behavior
- `inno-navigation.js` — Rail, contextual sidebar, breadcrumb and deep-link rules
- `inno-icons.js` — semantic icon vocabulary and Lucide mapping
- `INNO-One-Surface-Boundaries.md` — Web / Agent / Mobile ownership rules
- `INNO-One-Special-UI-Components.md` — hierarchy, workflow, tree and sequence component decisions
- `INNO-One-UI-Prototype-Summary.md` — implementation/handoff summary
- `INNO-One-Screen-Architecture-Refactor-Plan.md` — canonical screen patterns and mixed-purpose page refactor plan
- `INNO-One-Final-Visual-QA-Baseline.md` — frozen route/state screenshot baseline and final visual regression contract
- `INNO-One-Action-Layout-Contract.md` — canonical page-type action zones, editor/builder/wizard footer ownership and docking behavior
- `action-layout-audit.py` — 93-route action/layout regression guard
- `INNO-One-Accessibility-Contract.md` / `accessibility-audit.py` — semantic accessibility contract and regression guard
- `INNO-One-Availability-Contract.md` / `availability-audit.py` — unavailable-feature UX contract and regression guard
- `INNO-One-Language-Terminology-Contract.md` / `language-terminology-audit.py` — surface language ownership and canonical terminology contract
- `INNO-One-Interaction-Feedback-Contract.md` / `interaction-feedback-audit.py` — save, validation, toast and confirmation feedback contract
- `INNO-One-Table-List-Density-Contract.md` / `table-list-density-audit.py` — collection table/list density and toolbar contract

The HTML prototype is not a backend implementation. It defines expected UI structure and behavior.

## 2. Foundations

| Token | Frozen value |
| --- | --- |
| Primary | `#275FD7` |
| Text | `#172033` |
| Canvas | `#F7F8FA` |
| Success | `#16794B` |
| Warning | `#A56812` |
| Danger | `#BB3847` |
| Control height | `36px` |
| Table row | `48px` |
| Control radius | `8px` |
| Card radius | `12px` |
| Dialog radius | `14px` |
| Spacing scale | `4 / 8 / 12 / 16 / 24 / 32` |

UI should use border and surface separation first; strong shadows are reserved for overlays.

## 3. Platform shell

The platform shell owns:

- INNO.One brand
- Global Search / Command Palette
- Notifications
- User profile
- Global app Rail
- App registry visibility / RBAC integration

Each app owns its own contextual sidebar.

Desktop contextual navigation is inline and collapsible. At compact/tablet widths it becomes off-canvas. A contextual navigation control must not be placed in the global header.

## 4. Component contracts

| INNO.One component | React implementation | Frozen behavior |
| --- | --- | --- |
| `INNOButton` | shadcn/ui Button | primary, secondary, ghost, danger, icon |
| `INNOActionFooter` | INNO.One composition | owning editor/builder/wizard actions; pane-aligned viewport dock with safe space |
| `INNOIcon` | Lucide | semantic token mapping; no raw FA dependency in React |
| `INNODataTable` | TanStack Table | search, filter, columns, bulk selection, pagination, overflow |
| `INNOForm` | React Hook Form + Zod | visible labels, local validation, preserved input on recoverable error |
| `INNOTabs` | shadcn/ui Tabs | mouse + Arrow keys + Home/End; horizontal overflow |
| `INNODialog` | shadcn/ui Dialog | focus trap, Esc close, trigger focus restore |
| `INNOSheet` | shadcn/ui Sheet | contextual edit/filter flow; full-width on narrow screens |
| `INNODropdownMenu` | shadcn/ui DropdownMenu | 2–6 secondary actions tied to one resource |
| `INNOCommand` | shadcn/ui Command | global search / command palette; Cmd/Ctrl+K |
| `INNOToast` | Sonner via shadcn/ui | success, warning, error, information |
| `INNOState` | INNO.One composition | loading, empty, no results, error, permission, offline, disabled, partial |
| `INNOChart` | Apache ECharts | monitoring, inventory, SLA and reports |
| `INNOStepper` | INNO.One native | fixed ordered process |
| `INNOTimeline` | INNO.One native | chronological event history |
| `INNOStatusStepper` | INNO.One native | lifecycle/status progression |
| `INNOTree` | React Arborist wrapper | nested hierarchy without data columns |
| `INNOTreeGrid` | TanStack Table | expandable hierarchy with columns |
| `INNOOrgChart` | d3-org-chart wrapper | reporting-line / org hierarchy |
| `INNOWorkflowCanvas` | React Flow + ELK.js | editable branching workflow |
| `INNOBpmnDesigner` | bpmn-js | BPMN 2.0 only when explicitly required |
| `INNOAgentEndpointForm` | INNO.One Agent surface | endpoint Request Help / ownership confirmation |
| `INNOMobileScanner` | Expo/Android Camera | Android QR scan and asset lookup |
| `WorkflowCanvas` | Alias of INNOWorkflowCanvas | deprecated prototype name |

## 5. Action hierarchy

Use one primary action per action area, and place the action according to page type rather than page-by-page preference.

- **Overview / List** — New/Create belongs in the Page Header; Search / Filters / Columns / Export belong with the table.
- **Resource Detail** — resource operations belong in Resource Actions next to the resource identity.
- **Create / Edit / Settings** — Cancel/Discard and Save/Create/Schedule belong in `INNOActionFooter`.
- **Builder / Wizard** — Run/Save or Back/Continue belongs in the owning builder/wizard footer.
- **Primary** — main next action; exactly one per action area and right-most in a footer.
- **Secondary** — normal implemented alternate action.
- **Ghost** — low emphasis.
- **Danger** — destructive action; requires explicit confirmation where impact is meaningful.
- **Context Menu** — low-frequency secondary actions, never the only discoverable primary action.

`INNOActionFooter` behavior:
- belongs to the editor pane that owns the pending change,
- docks to the viewport when its natural position is below the viewport,
- keeps the owning pane's left/width instead of spanning unrelated columns,
- reserves bottom safe space while docked,
- returns to document flow when its natural position becomes visible,
- never contains disabled / Coming Soon actions.

## 6. Forms

- Keep labels visible; do not use placeholders as the only label.
- Show validation near the owning field.
- Preserve entered values when a recoverable request fails.
- Two-column forms collapse to one column on narrow screens.
- Large multi-section creation flows use a page.
- Contextual forms of roughly 3–8 fields use a Sheet/Drawer.

## 7. Data tables

Every dense operational table follows the same pattern:

1. Search
2. Simple filters or Filter Sheet
3. Column selector
4. Bulk actions after selection
5. Table
6. Pagination

Tables with many columns preserve readable minimum widths and scroll inside the table container. The page itself must not horizontally overflow.

## 8. Feedback and states

Every async/data surface must define the relevant states before implementation is complete:

- Loading
- Empty
- No Results
- Error
- No Permission
- Offline
- Disabled Module
- Saving
- Saved
- Partial Failure

Rules:

- No Permission is not Error.
- Disabled Module is not No Permission.
- Offline should keep cached/read-only content visible where possible.
- Partial failure must show succeeded and failed counts and retry only failed items when supported.
- Skeletons are preferred when final layout is known.

## 9. Navigation

Navigation hierarchy:

```text
Global Header
Global Rail
  └─ App
     └─ Context Sidebar
        └─ Page / Resource
           └─ Breadcrumb + logical Back (detail/nested pages)
```

Rules:

- Exactly one global Rail app is active.
- Exactly one contextual section is active where the page belongs to a sidebar section.
- Detail pages inherit their logical parent section.
- Deep links must update both Rail and contextual active state.
- Silent `href="#"` navigation is not allowed; unavailable items use disabled / Coming Soon feedback.

## 10. Icons

React uses Lucide through semantic icon tokens.

Examples:

| Token | Lucide |
| --- | --- |
| `nav.workspace` | House |
| `nav.apps` | Grid2X2 |
| `nav.devices` | Monitor |
| `nav.assets` | Package |
| `nav.reports` | ChartColumn |
| `nav.helpdesk` | Headphones |
| `nav.meeting` | Mic |
| `nav.admin` | Settings |
| `action.filter` | ListFilter |
| `action.columns` | Columns3 |
| `action.save` | Save |
| `action.export` | Download |
| `action.more` | Ellipsis |
| `action.delete` | Trash2 |

Brand icons are only for actual brands. Decorative icons are aria-hidden. Icon-only controls require an accessible label.

## 11. Responsive contract

| Range | Shell behavior |
| --- | --- |
| ≥1600 | Wide, Rail 72px, Sidebar 248px |
| 1367–1599 | Desktop, Rail 64px, Sidebar 232px |
| 1181–1366 | Compact, Rail 60px, Sidebar 216px, collapsible |
| 851–1180 | Context sidebar off-canvas |
| ≤850 | Narrow shell, stacked forms/layouts, table overflow |
| ≤680 | Compact search, full-width drawers, highly compact header |

## 12. Change policy after freeze

Use semantic versioning for the UI contract:

- **Patch** — visual correction with no component API or behavior change.
- **Minor** — additive component/state/token that remains backward compatible.
- **Major** — breaking navigation, component API, interaction behavior or semantic-token change.

After this freeze, feature teams should not create new parallel button, dialog, table, navigation, state, icon or responsive patterns without first updating the central Design System contract.

## 13. Definition of UI-complete for a new module

A new module is UI-complete only when it:

- uses the Platform Shell and semantic icon tokens
- has correct Rail and contextual navigation active states
- defines loading/empty/error/permission states
- supports keyboard behavior for interactive primitives
- passes responsive behavior at 1920 / 1440 / 1366 / 1024 / 768
- avoids page-level horizontal overflow
- uses the standard action hierarchy and destructive confirmation
- exposes meaningful labels for icon-only controls
- does not introduce a duplicate component pattern

## 14. Patch 1.0.1 — Final visual QA

- Fixed narrow toolbar wrapping so action controls never push the page wider than the viewport.
- Tightened collapsed-shell header spacing while preserving the INNO.One wordmark.
- Revalidated all 36 modern pages at 1920, 1440, 1366, 1024 and 768 widths.
- No component API, semantic token, navigation contract or backend behavior changed.

## 15. Minor 1.1.0 — Agent Maintenance

- Added the Agent Maintenance product screen using existing frozen components.
- Added semantic icon token section.maintenance mapped to Lucide RefreshCw.
- Added Devices navigation route for Agent Maintenance.
- No existing component API or interaction behavior was broken.

## 16. Minor 1.2.0 — Scoped Access

- Added Access Scopes UI for organization, location and device-group boundaries.
- Added semantic token section.accessScopes mapped to Lucide ScanSearch.
- Added devices.scope.manage to the prototype permission contract.
- Resource-scoped Remote access is now represented explicitly.

## 17. Minor 1.3.0 — Remote Consent

- Added Remote Consent policy UI for user approval before remote control.
- Added centralized editable consent-message preview and bypass rules.
- Added semantic token section.remoteConsent mapped to Lucide Hand.
- Added devices.remote.consent.manage and consent lifecycle events to the prototype contract.

## 18. Minor 1.4.0 — Remote Session Collaboration

- Added active Remote Session workspace with screen, mouse and keyboard control states.
- Added administrator session chat, participants and file-transfer UI.
- Added devices.remote.collaborate permission and remote collaboration lifecycle events.
- Added semantic action tokens for remote control, keyboard, clipboard, fullscreen, chat and file transfer.

## 19. Minor 1.5.0 — Alerts & Notifications

- Added central Alerts & Notifications UI for offline anomaly and inventory-change monitoring.
- Added Console, Sound and Email notification-channel configuration.
- Added devices.alert.view / devices.alert.manage permissions and alert lifecycle events.
- Existing navigation and component APIs remain backward compatible.

## 20. Minor 1.6.0 — Mobile Asset Scanner

- Added INNOMobileScanner contract for Android/Expo camera flows.
- Added QR scan, asset result, history and invalid-token mobile states.
- Added assets.qr.scan permission and asset.qr.generated / asset.qr.scanned prototype events.
- Printed QR remains an opaque token; inventory is loaded only after authenticated lookup.

## 21. Minor 1.7.0 — Helpdesk Email Notifications

- Added INNOEmailNotificationRule for automatic ticket-status email configuration.
- Added requester/assignee/watchers/team-lead recipients, templates, preview and delivery health UI.
- Added helpdesk.notifications.view / helpdesk.notifications.manage permissions and email lifecycle events.
- Ticket Activity now represents automatic delivery results.

## 22. Minor 1.8.0 — Surface Boundary + Special UI Contracts

- Explicitly separated Web Portal, Endpoint Agent and Android Mobile surfaces.
- Removed Agent/Mobile client screens from Web Portal navigation ownership.
- Added INNOAgentEndpointForm and surface contracts.
- Added canonical special components: INNOStepper, INNOTimeline, INNOStatusStepper, INNOTree, INNOTreeGrid, INNOOrgChart, INNOWorkflowCanvas and conditional INNOBpmnDesigner.
- Added `INNO-One-Surface-Boundaries.md`, `INNO-One-Special-UI-Components.md` and `INNO-One-UI-Prototype-Summary.md` as handoff references.

## 23. Minor 1.9.0 — Illustration System

- Added `INNOIllustration`, `INNOWelcomeHero` and illustrated empty-state conventions.
- Added a local SVG illustration library under `illustrations/` so product screens do not depend on remote image loading.
- Applied the first visual-direction pass to Workspace Home, App Launcher, Meeting, Knowledge Base, Asset Overview and Agent Deployment.
- Decorative illustration is explicitly excluded from dense operational screens such as Remote Session, Device Detail, Ticket Detail, permissions and workflow canvases.
- Illustration provenance and usage rules are recorded in `illustrations/README.md`.
- State illustration variants were added for no-results, empty attachments, healthy/success and caught-up notification states.

## 24. Minor 1.10.0 — Screen Architecture Patterns

- Added P01–P10 canonical screen patterns.
- Added the rule: one screen has one primary job.
- Split mixed-purpose pages into focused list, editor, settings, monitor, history and wizard routes.
- Refactored Helpdesk Notifications, Helpdesk Configuration, Device Alerts, Deployment Jobs, Agent Maintenance, Remote Consent, Access Scopes and Asset Ownership.
- Refactored Inventory Query into a Builder-centric layout.
- Added `INNO-One-Screen-Architecture-Refactor-Plan.md` as the production UX refactor reference.


## 25. Minor 1.11.0 — Production UI Consistency & Final Visual Baseline

- Standardized Page Header, buttons, forms, tables, tabs/subnav, sticky editor actions and dialog/drawer semantics across the modern prototype.
- Added shared dirty tracking, Saving/Saved/Error states, validation, unsaved-change confirmation, filter persistence/reset, bulk selection and recoverable partial-failure retry behavior.
- Normalized content density, Thai/English typography fallback, spacing scale and metadata legibility while preserving dense operational layouts.
- Completed responsive behavior for 1366 / 1024 / 768 Web Portal viewports and separate Endpoint Agent / Android Mobile surface widths.
- Removed or deactivated remaining dead controls found during final QA; master-detail selectors now update their detail surface in representative configuration/builder screens.
- Frozen 74 Web Portal routes + Design System + 2 Endpoint Agent + 1 Android Mobile route screenshots, plus 12 important UI states.
- Added `INNO-One-Final-Visual-QA-Baseline.md`, `qa-final-visual.py` and `final-visual-audit.py` as the final pre-backend regression baseline.


## 26. Minor 1.12.0 — Shared Input System & C-Grade UX Restructure

- Added `inno-inputs.js` as the Web Portal backing-state input layer. Native `<select>` values remain the form state, while the visible UI uses INNOSelect / INNOCombobox / INNOResourcePicker / INNOSegmented patterns.
- Auto-enhanced Web Portal selects while leaving Endpoint Agent / Android Mobile surfaces independent.
- Added keyboard navigation, searchable popovers, fixed-layer menus, resource metadata presentation and selected-chip support.
- Restructured `ticket-new.html` around Describe issue → Add context → Advanced routing instead of exposing all routing fields at equal priority.
- Restructured `helpdesk-notification-rule.html` into When → Send to → Message.
- Reworked `report-builder.html` into Dataset → Visible columns → Filter Builder → Grouping/Sorting with Preview retained in context.
- Reworked `asset-qr.html` into Select assets → Label setup → Preview → Print; QR security and Android integration are progressive supporting information.
- Added `qa-ux-input-browser.py` regression coverage across 74 Web routes × 1366 / 1024 / 768 plus representative interaction checks.


## 27. Route Ownership Baseline Refresh — 2026-09-25

- Removed generated application navigation to hash routes such as `#devices`, `#tickets`, `#assigned`, `#team`, `#meetings` and `#upcoming`.
- Added 9 canonical Web routes for list/queue/workspace jobs; current Web route count is 83.
- App Launcher and Reports preserve filter semantics with query-state routes rather than separate duplicate screens.
- Added permanent navigation regression checks for application hash links and missing local route targets.
- Browser regression now covers 83 Web routes at 1366 / 1024 / 768 plus route-ownership interaction checks.
- Current frozen visual set: 87 canonical route screenshots + 13 state screenshots = 100 files.
- UI Contract remains 1.12.0 because existing component APIs are unchanged and old Overview anchor targets remain backward-compatible; only canonical generated navigation ownership changed.


## 28. Final Action / Layout Consistency Freeze — 2026-09-25

- Design System Documentation advanced to **V1.19** and UI Contract to **1.13.0**.
- Added `INNOActionFooter` as a shared layout contract instead of allowing editor Save/Create/Schedule actions to float between headers, cards and page bottoms.
- Classified all 83 Web routes into Editor, Builder, Wizard, Resource Detail or Overview/List action ownership.
- `endpoint-policies.html` is the reference master/editor implementation: Policies editing is separated from Compliance monitoring.
- Clean editor / builder / wizard action bars stay in normal flow. Editor actions dock to their owning pane only after unsaved changes exist, preserving pane width and bottom safe space.
- Removed unavailable/Coming Soon actions from high-emphasis action zones.
- Responsive primary-work ordering was corrected for Inventory Query and grid min-content no longer causes page overflow.
- `action-layout-audit.py` is now part of the frozen regression contract.


## 29. Minor 1.14.0 — Accessibility + Availability Final Polish — 2026-09-25

- Design System Documentation advanced to **V1.20** and UI Contract to **1.14.0**.
- Accessibility semantics are now part of the frozen UI contract through `INNO-One-Accessibility-Contract.md` and `accessibility-audit.py`.
- Unavailable capability UX is now governed by `INNO-One-Availability-Contract.md` and `availability-audit.py`.
- Normal task flow contains no visible Coming Soon actions. Future sidebar entries may remain as roadmap markup but are hidden from normal contextual navigation.
- Action-looking Admin tiles must link to a canonical route; unavailable Admin domains are not presented as fake navigation.
- Read-only/reference data uses passive status rather than disabled Edit/Create controls.
- Where a canonical route or prototype interaction exists, the UI uses that working path instead of a disabled placeholder.
- Browser regression now includes accessibility and availability gates across all 83 Web routes at 1366 / 1024 / 768.
- Current browser UX regression baseline: **80 / 80 checks**.
- Current Final Visual baseline: **116 / 116 checks**, 87 canonical route screenshots + 13 state screenshots.


## 30. Minor 1.15.0 — Language & Terminology Consistency — 2026-09-25

- Design System Documentation advanced to **V1.21** and UI Contract to **1.15.0**.
- Web Portal + Design System are English UI surfaces.
- Endpoint Agent + Android Assets Mobile remain Thai UI surfaces.
- Localized Thai business/sample content inside English pages now declares nested `lang=th`.
- Mixed Thai/English helper text was normalized to English across Web configuration and operational pages.
- Canonical sidebar terminology now enforces Helpdesk `Overview`, Admin `Apps & Modules`, and Account `Profile & Settings`.
- `language-terminology-audit.py` is part of the frozen regression contract.
- Browser regression checks rendered document language, unscoped Thai content and canonical sidebar terminology across all 83 Web routes.


## 31. Minor 1.16.0 — Interaction & Feedback Consistency — 2026-09-25

- Design System Documentation advanced to **V1.22** and UI Contract to **1.16.0**.
- Save controls expose progress, success/error, duplicate-submit prevention and `aria-busy`.
- Validation errors are associated with fields and announced semantically.
- Confirmation severity is explicit: Warning for interruptive/reversible actions, Danger for destructive actions.
- Native browser dialogs are prohibited.
- `interaction-feedback-audit.py` and focused rendered-DOM checks are part of the frozen regression contract.


## 32. Minor 1.17.0 — Table / List / Data Density — 2026-09-25

- Design System Documentation advanced to **V1.23** and UI Contract to **1.17.0**.
- Canonical primary collection tables use shared compact density and toolbar structure.
- Shared search target wiring replaces one-off inline collection filtering.
- Row action columns are named, aligned and compact.
- Desktop and tablet/mobile collection toolbar behavior is explicitly defined.
- Operational Helpdesk/Meeting queues remain domain-specific list layouts rather than generic tables.
- `table-list-density-audit.py` and rendered collection regression are part of the frozen contract.


## 33. Minor 1.18.0 — State Coverage & Recovery — 2026-09-26

- Design System Documentation advanced to **V1.24** and UI Contract to **1.18.0**.
- Added canonical Empty preview state.
- Loading skeletons now expose accessible status semantics.
- No-results collections keep footer counts and pagination truthful.
- Error preview recovery leaves the forced failure URL.
- Partial retry state resolves its copy and status after successful retry.
- `state-coverage-audit.py` is part of the frozen regression contract.

## 34. Minor 1.19.0 — TOR-required management surfaces — 2026-09-26

- Design System Documentation advanced to **V1.25** and UI Contract to **1.19.0**.
- Canonical Web routes increased from 83 to **93** after the TOR-required surfaces were split by primary job.
- Admin Center organization ownership is now explicit: **Structure**, **Locations**, **Positions**, and **Users** are separate navigation jobs.
- Users follows **List → Resource Detail → Create/Edit** instead of combining a table and long editor on one screen.
- Helpdesk Automation follows **Rule List → Rule Editor**; the rule editor reveals the three-level SLA escalation sequence only when that action is selected.
- Reports **Saved Reports** uses real Search/Owner/Dataset filtering, a focused Run result dialog, and restores the chosen definition in Report Builder on Edit.
- Device Groups opens a real **Device Group Detail**, and member Open actions restore the requested device identity in Device Detail.
- Shared collection filters are implemented in the shared interaction layer rather than as page-local fake controls.
- Current collection baseline: **15 / 15** compact primary tables and **10 / 10** canonical action columns.
- Current visual baseline: **97 route screenshots + 14 state screenshots = 111 verified hashes**.
- Current browser regression: **114 / 114 checks**.
- These are frontend prototype contracts only; backend/API integration is still paused.
- Step 7 page-by-page UX review has not started.

## 35. Minor 1.20.0 — Shared hierarchy components — 2026-09-26

- Design System Documentation advanced to **V1.26** and UI Contract to **1.20.0**.
- `INNOTree` is now a real shared prototype primitive with semantic tree/treeitem roles, selection, expand/collapse, search and Arrow/Home/End keyboard behavior.
- `INNOTreeGrid` is now a real shared prototype primitive for hierarchical rows with multiple columns, contextual search and keyboard expand/collapse.
- `INNOOrgChart` is represented in the Design System as the reporting-line visualization contract and remains separate from generic Tree/TreeGrid usage.
- Organization Structure, Organization Locations and Helpdesk Categories now reuse `INNOTree`.
- Access Scope Browser now reuses `INNOTreeGrid` rather than a page-local indented table.
- Shared hierarchy behavior lives in `inno-interactions.js`; shared visual tokens live in `inno-design-system.css`.
- Production mapping remains React Arborist → `INNOTree`, TanStack Table → `INNOTreeGrid`, d3-org-chart → `INNOOrgChart`; AG Grid Tree Data remains conditional.
- Browser regression: **124 / 124 checks**.
- Visual baseline remains **97 route screenshots + 14 state screenshots = 111 verified hashes**.
- Step 7 page-by-page UX review has not started; backend implementation remains paused.
