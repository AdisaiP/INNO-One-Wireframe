# INNO.One Final Visual QA Baseline

**UI Contract:** 1.14.0
**Design System Documentation:** V1.19
**Status:** Frozen visual baseline
**Frozen:** 2026-09-25
**Backend:** Not implemented by this baseline

## 1. Purpose

This document freezes the final HTML prototype baseline after Navigation, Component Consistency, Density/Typography, Interaction Consistency and Responsive passes.

The baseline is used to:
- review future React implementation against the approved prototype language,
- detect accidental visual/navigation/state regressions,
- preserve Web / Endpoint Agent / Android Mobile boundaries,
- separate UI acceptance from backend implementation.

## 2. Canonical screenshot baseline

Baseline directory:

- `qa-final-visual/routes-web/` — 83 Web Portal route screenshots.
- `qa-final-visual/surfaces/` — Design System + 2 Endpoint Agent + 1 Android Mobile screenshots.
- `qa-final-visual/states/` — 13 important state/interaction screenshots.
- `qa-final-visual/manifest.json` — route metrics, file hashes and QA summary.
- `qa-final-visual/contact-sheets/` — review-only visual contact sheets.

Canonical review viewports:

| Surface | Viewport |
| --- | --- |
| Web Portal | 1366 × 900 |
| Design System reference | 1366 × 900 |
| Endpoint Agent | 820 × 900 |
| Android Mobile | 390 × 844 |

Responsive behavior is additionally covered by the NEXT 5 baseline at Web 1366 / 1024 / 768, Agent 820 / 640 / 390 and Mobile 430 / 390 / 360.

## 3. Important state baseline

The frozen state screenshots cover:

1. Loading / skeleton
2. Partial failure
3. No permission
4. Disabled module
5. Error
6. Offline device / cached mode
7. No results
8. Validation error
9. Unsaved-change confirmation
10. Filter drawer
11. Bulk selection
12. Destructive confirmation
13. Select / resource picker open state

These are prototype UI contracts. They do not certify live network, persistence, permission or backend behavior.

## 4. Frozen shell consistency

At the canonical Web viewport:

- Global Rail width = 60px on all 83 Web routes.
- Contextual Sidebar width = 216px on all 83 Web routes.
- Platform Header height = 56px on all 83 Web routes.
- Canvas background = `#F7F8FA` on all 83 Web routes.
- Every Web route has exactly one active Rail route and one active contextual route.
- No Web route has page-level horizontal overflow.
- No raw placeholder `href="#"` remains actionable after navigation normalization.
- Page-header primary-action hierarchy follows the shared component contract.

Intentional title variants:
- Standard Page Header H1 = 23px on 77 Web routes.
- Workspace hero H1 = 22px.
- Remote Session specialized operations title = 20px.
- Device Detail, Asset Detail, Ticket Detail and Meeting Detail use the Resource Detail title pattern rather than a Page Header H1.

## 5. Dead-control policy at freeze

An enabled control must have one of:
- a real route,
- a local prototype behavior,
- a shared `data-inno-*` behavior,
- a dialog/drawer/tab/list selection behavior.

Not-yet-implemented actions are disabled and labeled Coming Soon rather than left clickable.

Mock controls rendered inside the simulated remote desktop are visual content of the remote screen, not Web Portal actions.

## 6. Surface boundary freeze

- Web Portal canonical product routes: 83.
- Endpoint Agent prototype routes: 2.
- Android Mobile prototype routes: 1.
- Design System reference: 1.

Endpoint Agent and Mobile surfaces do not load the Web platform shell or Web contextual navigation.

## 7. Regression tooling

Final QA tooling:

- `design-system-audit.py`
- `component-consistency-audit.py`
- `density-spacing-audit.py`
- `interaction-consistency-audit.py`
- `responsive-pass-audit.py`
- `qa-responsive-baseline.py`
- `qa-responsive-browser.py`
- `qa-final-visual.py`
- `final-visual-audit.py`

A future UI change should update the contract version and regenerate the visual baseline only when the change is intentionally accepted.

## 8. Change rule after this freeze

- Patch: visual/accessibility correction without component API or behavior change.
- Minor: additive token/component/state/behavior with backward compatibility.
- Major: breaking navigation, interaction, semantic token or component API change.

Do not silently overwrite the screenshots after a regression. Fix the regression or explicitly approve and version the new baseline first.


## 9. Freeze verification result

Final verification on 2026-09-25:

- `qa-final-visual.py`: 116 browser checks, 0 failures.
- Canonical route screenshots: 87.
- Important state screenshots: 13.
- Screenshot files verified against manifest SHA-256: 100 / 100.
- Design System audit: 0 issues.
- Component Consistency audit: 0 issues.
- Density / Spacing / Typography audit: 0 issues.
- Interaction Consistency audit: 0 issues.
- Responsive Pass audit: 0 issues.
- Final Visual audit: 0 issues.

The frozen UI baseline is internally consistent. Backend work is intentionally paused by user instruction; backend implementation and TOR acceptance remain separate work.


## 10. Repository cleanup policy

After the 1.11.0 freeze, superseded QA screenshot folders and the disconnected legacy prototype were removed from the repository. `qa-final-visual/` is the retained screenshot baseline. Regression scripts remain source-controlled and may regenerate temporary QA output folders locally when needed.


## 11. UX Input System freeze — 1.12.0

The final visual baseline now includes the shared Input System and an additional `select-open` state screenshot. Total frozen screenshots: 78 canonical routes + 13 states = 91. The C-grade screens reviewed in `INNO-One-UX-UI-Page-Review.md` were restructured before this freeze.


## 12. B-grade operational page refresh

The 1.12.0 visual baseline was regenerated after the first B-grade operational editor pass. Screenshot counts remain 78 canonical routes + 13 states = 91 images; affected route screenshots include Software Maintenance New, Restart Schedule, Device Alert Rule, Remote Consent Policy, Access Scope Edit, Inventory Query and Deployment New.


## 13. B-grade configuration/account refresh

The 1.12.0 visual baseline was regenerated after the second B-grade pass. Screenshot counts remain 78 canonical routes + 13 states = 91 images. Affected route screenshots include Endpoint Policies, Alert Channels, Helpdesk SLA, Categories, Requester Groups, Business Calendar, Notification Settings, Meeting New, Apps & Modules and Profile.


## 14. Canonical route ownership refresh — 2026-09-25

At the 1.12.0 route-ownership pass, the prototype gained distinct application routes for Devices, Helpdesk ticket queues, Meeting lists and Workspace activity views. The current baseline is 1.13.0. App Launcher and Reports use query-state routes for true filters instead of hash navigation.

Current baseline counts supersede the earlier snapshot counts recorded in historical pass sections above:

- Web Portal routes: 83.
- Canonical route screenshots: 87 (83 Web + Design System + 2 Agent + 1 Mobile).
- Important state screenshots: 13.
- Total frozen screenshots / hash checks: 100 / 100.
- Application-shell hash navigation: 0.
- Missing local route targets: 0.


## 15. Action/Layout consistency baseline — 2026-09-25

The canonical visual baseline now includes Design System V1.20 / UI Contract 1.14.0 action-placement behavior:

- 83 / 83 Web routes are classified by action-layout page type.
- Editor Save/Create/Schedule actions use pane-owned canonical action footers.
- Builder/Wizard actions use their owning footer zones.
- Resource Detail operations stay in resource action zones.
- Overview/List create actions remain in Page Headers while table tools stay with the table.
- Clean action footers remain in normal flow; dirty editor footers may dock while preserving editor-pane width and bottom safe space.
- Endpoint Policies editing and Compliance monitoring are separate views.
- Action/Layout automated audit must remain at 0 issues.

Action/Layout verification at freeze:
- Page type coverage: 83 / 83.
- Editor / Builder / Wizard / Resource Detail / Overview-List = 18 / 4 / 1 / 6 / 54.
- `action-layout-audit.py`: 0 issues.
- `qa-ux-input-browser.py`: 80 checks / 0 failures, including all 83 Web routes at 1366 / 1024 / 768, accessibility gates, availability gates and clean-vs-dirty editor footer behavior.
- `qa-final-visual.py`: 116 checks / 0 failures.
- Screenshot manifest verification: 100 / 100 hashes.


## 16. Accessibility / Availability final-polish baseline — 2026-09-25

The current frozen baseline is **Design System V1.20 / UI Contract 1.14.0**.

Accessibility baseline:
- 87 canonical pages covered by `accessibility-audit.py`.
- unnamed icon-only controls = 0.
- non-semantic clickable controls = 0.
- invalid interactive switches = 0.
- images missing alt = 0.

Availability baseline:
- Coming Soon task actions = 0.
- visible future sidebar placeholders = 0.
- hidden future navigation placeholders retained in source = 102.
- non-interactive Admin navigation tiles = 0.
- legitimate non-future disabled controls = 4.

Final verification:
- `qa-ux-input-browser.py`: 80 / 80 checks, 0 failures.
- `qa-final-visual.py`: 116 / 116 checks, 0 failures.
- canonical route screenshots: 87.
- state screenshots: 13.
- screenshot/hash baseline: 100 / 100.
