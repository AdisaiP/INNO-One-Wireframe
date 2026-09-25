# INNO.One — UI Prototype Summary

Last updated: 2026-09-24  
Status: UI/UX prototype only. No statement in this document certifies backend implementation or TOR acceptance.

## 1. Purpose

This document is the handoff summary for the current INNO.One prototype. It records:
- what UI surfaces exist,
- which files belong to which product surface,
- which TOR clauses are represented,
- which parts are prototype-only,
- which shared UI contracts are frozen,
- what should happen before backend implementation.

## 2. Product surfaces

INNO.One is not a single UI surface.

| Surface | Purpose | Ownership |
| --- | --- | --- |
| Web Portal | Workspace, Devices, Assets, Helpdesk, Meeting, Reports, Admin | INNO.One Platform + module UIs |
| Endpoint Agent | Request Help, ownership/user confirmation, remote consent, endpoint context | INNO.One Agent |
| Mobile App (Android) | Asset QR scanner and mobile asset lookup | INNO.One Assets Mobile |
| External / Engine UI | MeshCentral or vendor engine internals | Hidden behind adapters where possible |

The Web Portal must not expose Agent or Mobile screens as normal web-app navigation items.

## 3. Current Web Portal prototype

### Workspace
- `workspace-v2.html`
- `app-launcher-v2.html`
- `notifications.html`
- `profile.html`

### Devices
- `devices-overview-v2.html`
- `device-detail-v2.html`
- `device-add.html`
- `device-discovery.html`
- `device-groups.html`
- `remote-operations.html`
- `remote-session.html`
- `remote-consent.html`
- `device-query.html`
- `deployment-jobs.html`
- `agent-maintenance.html`
- `endpoint-policies.html`
- `device-alerts.html`

### Assets
- `assets-overview.html`
- `asset-inventory.html`
- `asset-detail.html`
- `software-licenses.html`
- `contracts-warranty.html`
- `asset-qr.html`
- `asset-ownership.html`

### Helpdesk
- `helpdesk.html`
- `ticket-new.html`
- `ticket-detail.html`
- `helpdesk-sla.html`
- `helpdesk-settings.html`
- `helpdesk-notifications.html`
- `knowledge-base.html`
- `helpdesk-reports.html`

### Meeting
- Meeting prototype pages already present in project and use the common platform shell.

### Reports
- `reports-overview.html`
- `report-builder.html`

### Admin
- `admin.html`
- `roles-permissions-v2.html`
- `access-scopes.html`
- `modules.html`
- `design-system.html`

## 4. Separate-surface prototypes

These files are kept in the same prototype workspace for review convenience, but they are **not Web Portal routes**.

### Endpoint Agent
- `helpdesk-agent-request.html` — endpoint Request Help flow for TOR 10.1.
- `agent-ownership-confirmation.html` — Thai ownership/user confirmation flow for TOR 7.12.

### Mobile App (Android)
- `asset-mobile.html` — QR scan and mobile asset result flow for TOR 7.13.

Rules:
1. Do not add these pages to Web Portal side navigation.
2. Do not treat them as routes owned by Assets or Helpdesk Web.
3. Shared identity, permission, event and API contracts may be common across surfaces.
4. Visual language should be related, but each surface may have its own shell/layout.

## 5. Major UI work completed

### Platform shell
- Added a controlled illustration system for spacious overview/onboarding surfaces. Pilot pages: Workspace Home, App Launcher, Meeting, Knowledge Base, Asset Overview and Agent Deployment.
- Illustration SVGs are stored locally under `illustrations/` with provenance and usage guidance in `illustrations/README.md`.
- State illustrations now cover search/no-results, empty files, healthy/success and empty notifications without adding decorative art to dense operational screens.
- Fixed global header / app rail / contextual sidebar separation.
- Added responsive collapsed navigation behavior.
- Centralized navigation state, icon vocabulary and interaction patterns.
- Added reusable layout, table, form, alert, dialog and state patterns.

### Devices
- Fleet overview, device detail, discovery and device groups.
- Dynamic group rule builder.
- Remote operations, screen wall, screenshot jobs and session history.
- Remote consent policy and endpoint consent preview.
- Active remote-session workspace with collaboration, chat and file transfer.
- Inventory query across Process / Service / Software / File / Folder.
- Deployment jobs, Agent maintenance and scheduled restart.
- USB endpoint policy.
- Central alerts, offline anomaly rules and inventory-change notifications.

### Assets
- Inventory and asset detail.
- Hardware / Software / baseline / change history.
- Software license compliance.
- Contracts and warranty.
- Ownership/user administration.
- QR label selection, generation settings and print preview.

### Helpdesk
- Ticket list, create and detail flows.
- Priority and Urgency separated.
- SLA and three-level escalation UI.
- Category/Subcategory, statuses, requester groups and business calendar.
- Knowledge Base.
- Reports.
- Automatic ticket-status email notification rules, templates, preview and delivery health.

### Reports
- Report catalog.
- Cross-app report overview.
- Report builder.
- PDF/Excel export controls represented as prototype actions.

### Admin
- Roles and permissions.
- Resource-scoped access assignments.
- App/module administration.
- Design System reference.

## 6. TOR coverage status

See `TOR-UI-Coverage.md` for clause-by-clause detail.

Current interpretation:
- Functional UI clauses in Sections 4.5–10.16 have a represented prototype surface.
- TOR 4.9 (Thai language across the entire system) is not something static HTML alone can certify.
- “Represented” means a UI/interaction prototype exists. It does not mean backend behavior has been implemented or accepted.

## 7. Shared implementation files

- `workspace-v2.css` — legacy/base prototype styles.
- `inno-design-system.css` — shared modern design-system layer.
- `platform-shell.js` — global platform shell.
- `inno-navigation.js` — canonical route/navigation state.
- `inno-icons.js` — semantic icon vocabulary.
- `inno-interactions.js` — toast/dialog/menu/filter interaction helpers.
- `inno-states.js` — prototype states.
- `inno-responsive.js` — responsive helpers.
- `platform-registry.js` — module/permission/event prototype contract.
- `inno-design-contract.js` — machine-readable UI contract.
- `design-system-audit.py` — prototype contract/audit checks.
- `INNO-One-Screen-Architecture-Refactor-Plan.md` — P01–P10 screen patterns and architecture-refactor progress.

## 8. Frozen UI contract

Current accepted baseline:
- Design System: V1.24.
- UI Contract: 1.18.0.
- Registry Schema: 10.
- Surface contracts: Web / Endpoint Agent / Android Mobile.

Surface-boundary changes should be documented as an additive architecture correction, not interpreted as backend scope.

## 9. Explicit prototype-only areas

The following are currently visual/interaction representations, not live integrations:
- remote control engine,
- consent delivery to Endpoint Agent,
- chat/file transfer transport,
- Agent update orchestration,
- anomaly detection engine,
- email/SMTP queue,
- QR token generation/validation,
- Android camera/runtime,
- inventory synchronization,
- report query/export engine,
- persistence of most settings/forms.

## 10. Before backend implementation

Do these in order:
1. Keep Web / Agent / Mobile boundaries explicit.
2. Complete special-component standards in `INNO-One-Special-UI-Components.md`.
3. Run full-system visual/interaction consistency pass.
4. Replace remaining placeholder `#` links with actual route, disabled state or documented Coming Soon.
5. Freeze route ownership and permission names.
6. Only then map prototype interactions to APIs/events/backend services.

## 11. Screen Architecture Refactor — 2026-09-24

The prototype now follows the rule **one screen = one primary job**.

Major mixed-purpose screens were split into focused routes:

### Helpdesk Notifications
- `helpdesk-notifications.html` — Rule list.
- `helpdesk-notification-rule.html` — Rule editor.
- `helpdesk-notification-templates.html` — Template list.
- `helpdesk-notification-template.html` — Template editor + live preview.
- `helpdesk-notification-delivery.html` — Delivery log.
- `helpdesk-notification-settings.html` — Channel/retry settings.

### Helpdesk Configuration
- `helpdesk-settings.html` — Configuration overview.
- `helpdesk-categories.html` — Category Tree + selected-category editor.
- `helpdesk-statuses.html` — Status list + transitions.
- `helpdesk-requester-groups.html` — Requester-group Master–Detail.
- `helpdesk-calendar.html` — Working hours / holidays.

### Device Alerts
- `device-alerts.html` — Active monitor.
- `device-alert-rules.html` — Rule list.
- `device-alert-rule.html` — Rule editor.
- `device-alert-channels.html` — Console/Sound/Email settings.
- `device-alert-history.html` — Alert history.

### Deployment
- `deployment-jobs.html` — Job list/monitor.
- `deployment-new.html` — Stepper-based new deployment.
- `deployment-job-detail.html` — Single job detail.

### Agent Maintenance
- `agent-maintenance.html` — Overview.
- `agent-updates.html` / `agent-rollout-new.html` — Agent rollout.
- `software-maintenance.html` / `software-maintenance-new.html` — Software maintenance.
- `restart-operations.html` / `restart-schedule.html` — Scheduled restart.
- `maintenance-history.html` — Cross-maintenance history.

### Remote Consent
- `remote-consent.html` — Overview.
- `remote-consent-policy.html` — Consent policy.
- `remote-consent-message.html` — Message editor + endpoint preview.
- `remote-consent-rules.html` — Bypass rules.
- `remote-consent-history.html` — Decision history.

### Access Scopes
- `access-scopes.html` — Assignment list.
- `access-scope-edit.html` — Assignment editor.
- `access-scope-browser.html` — Hierarchical scope browser.
- `access-scope-evaluate.html` — Access evaluation utility.

### Asset Ownership
- `asset-ownership.html` — Overview.
- `asset-users.html` / `asset-user-detail.html` — User list/detail.
- `asset-ownership-submissions.html` — Endpoint Agent submission queue.
- `asset-custom-fields.html` — Custom-field schema.

### Builder layout
- `device-query.html` now uses a Builder-centric layout: Saved Queries/Facts support the Builder; Results are a separate output region.

Pages intentionally kept as one screen because their primary job is already clear:
- `device-detail-v2.html`
- `asset-detail.html`
- `meeting-detail.html`
- `ticket-new.html`
- `report-builder.html`
- `remote-session.html`

See `INNO-One-Screen-Architecture-Refactor-Plan.md` for the canonical P01–P10 patterns and remaining polish work.


## 12. Final Visual QA Freeze — 2026-09-25

- NEXT 1–6 UI cleanup/consistency/responsive/final visual passes are complete.
- Canonical baseline contains 83 Web routes, 1 Design System reference, 2 Endpoint Agent routes and 1 Android Mobile route.
- Important state baseline contains 13 state/interaction screenshots.
- Frozen screenshot/metric manifest is stored under `qa-final-visual/`.
- Final baseline contract is documented in `INNO-One-Final-Visual-QA-Baseline.md`.
- This freeze means the UI prototype is ready for backend mapping/planning; it does not claim that backend services or TOR acceptance are implemented.


## 13. Shared Input System & C-grade UX pass — 2026-09-24

- Web Portal forms now consume the shared Input System instead of exposing browser-default selectors.
- `ticket-new.html`, `helpdesk-notification-rule.html`, `report-builder.html` and `asset-qr.html` were restructured around one primary user job per screen.
- `inno-inputs.js` is part of the frozen UI contract and preserves native backing values for prototype validation/dirty-state compatibility.


## 14. B-grade operational form polish — 2026-09-24

The first B-grade batch has been moved from generic form layouts toward purpose-built task editors: Software Maintenance, Restart Schedule, Device Alert Rule, Remote Consent Policy, Access Assignment, Inventory Query and New Deployment. This pass reuses UI Contract 1.12.0 and does not introduce backend behavior.


## 15. Configuration and account UX polish — 2026-09-25

The second B-grade batch reduces multi-form screens and separates supporting technical/configuration context from the primary job. The pass covers Endpoint Policies, Alert Channels, Helpdesk SLA/configuration/notification settings, Meeting capture, Apps & Modules and Profile. No backend behavior was added.


## 16. Canonical route ownership — 2026-09-25

Legacy application-shell hash navigation has been removed. Distinct navigation jobs now have canonical pages, while true filters use query-state URLs. The current Web route graph contains 83 routes and preserves old Overview section IDs only as backward-compatible anchors, not as generated navigation targets.


## 18. Final Action/Layout consistency — 2026-09-25

Design System V1.19 / UI Contract 1.13.0 adds a canonical action-placement contract across all 83 Web routes. Overview/List creation actions live in Page Headers, Resource Detail operations live in Resource Actions, and editor/builder/wizard commits live in pane-owned action footers. Endpoint Policies is the reference master/editor page and separates policy editing from compliance monitoring. Docked task footers preserve the owning pane width and reserve bottom safe space at desktop and narrow viewports.


## 18. Action footer visual follow-up — 2026-09-25

The Action/Layout freeze was visually refined after route-wide review. Clean pages keep editor/builder/wizard footers in normal document flow so actions do not obscure untouched content. Once an editor becomes dirty, its canonical editor footer may dock to the owning pane until the change is saved/discarded. QR Labels now uses `Regenerate Preview` + `Print Selected` as the final builder actions, and Report Builder treats `Run Preview` as a secondary workflow action while `Save Report` remains the final primary action.


## 19. Accessibility / semantic polish — 2026-09-25

Final UX/UI Step 1 established a shared semantic baseline across all 87 canonical pages. Icon-only actions now expose names, interactive toggles use native button switch semantics, single-control field labels are associated automatically, table/action-item checkboxes receive contextual names, and Web route regression now checks rendered accessibility state at all required breakpoints. See `INNO-One-Accessibility-Contract.md`.


## 20. Availability / unavailable-feature polish — 2026-09-25

Design System V1.20 / UI Contract 1.14.0 makes availability an explicit UX rule. Unavailable features no longer appear as grey Coming Soon task controls or normal sidebar navigation. Future navigation remains in roadmap markup but is hidden from the normal product shell. Real routes are used where they exist; read-only data uses passive status; and prototype-only commands remain active only when they provide visible local feedback. `availability-audit.py` reports zero Coming Soon task actions across all 87 canonical pages, while browser regression confirms no future navigation is visible across all 83 Web routes.


## 21. Language & terminology consistency — 2026-09-25

Design System V1.21 / UI Contract 1.15.0 defines surface language ownership: Web Portal and Design System use English, while Endpoint Agent and Android Assets Mobile remain Thai. Thai business/sample content embedded in Web pages is retained with explicit `lang=th` semantics. Web helper text was normalized to English and canonical navigation terminology now uses `Overview`, `Apps & Modules`, and `Profile & Settings` consistently. `language-terminology-audit.py` reports zero unscoped Thai fragments and zero terminology mismatches.


## 22. Interaction & feedback consistency — 2026-09-25

Step 4 standardizes feedback across the prototype. Save/Create controls now expose busy/success/error state and block duplicate activation; validation errors are associated with fields and focus the first invalid control; confirmation actions distinguish Warning from Danger; native browser dialogs are disallowed. `interaction-feedback-audit.py` reports zero issues and browser regression covers the shared behaviors.


## 23. Table / list / data density consistency — 2026-09-25

Step 5 standardizes primary collection browsing without turning every dataset into the same component. Twelve canonical collection tables now share compact row density, shared search/no-result behavior, responsive toolbar layout and explicit action-column treatment. Helpdesk queues and Meeting lists keep their richer domain-specific row layouts. See `INNO-One-Table-List-Density-Contract.md`.


## 24. State coverage consistency — 2026-09-26

Step 6 freezes a shared state model for Empty, No Results, Loading, Error, Permission, Disabled, Offline and Partial Failure. Search no-results now updates collection metadata truthfully, loading is announced semantically, error previews recover to the normal view, and partial retry resolves its own warning copy. See `INNO-One-State-Coverage-Contract.md`.
