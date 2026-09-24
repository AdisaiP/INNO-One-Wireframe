# INNO.One Final Visual QA Baseline

**UI Contract:** 1.11.0  
**Design System Documentation:** V1.17  
**Status:** Frozen visual baseline  
**Frozen:** 2026-09-24  
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

- `qa-final-visual/routes-web/` — 74 Web Portal route screenshots.
- `qa-final-visual/surfaces/` — Design System + 2 Endpoint Agent + 1 Android Mobile screenshots.
- `qa-final-visual/states/` — 12 important state/interaction screenshots.
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

These are prototype UI contracts. They do not certify live network, persistence, permission or backend behavior.

## 4. Frozen shell consistency

At the canonical Web viewport:

- Global Rail width = 60px on all 74 Web routes.
- Contextual Sidebar width = 216px on all 74 Web routes.
- Platform Header height = 56px on all 74 Web routes.
- Canvas background = `#F7F8FA` on all 74 Web routes.
- Every Web route has exactly one active Rail route and one active contextual route.
- No Web route has page-level horizontal overflow.
- No raw placeholder `href="#"` remains actionable after navigation normalization.
- Page-header primary-action hierarchy follows the shared component contract.

Intentional title variants:
- Standard Page Header H1 = 23px on 68 Web routes.
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

- Web Portal canonical product routes: 74.
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

Final verification on 2026-09-24:

- `qa-final-visual.py`: 106 browser checks, 0 failures.
- Canonical route screenshots: 78.
- Important state screenshots: 12.
- Screenshot files verified against manifest SHA-256: 90 / 90.
- Design System audit: 0 issues.
- Component Consistency audit: 0 issues.
- Density / Spacing / Typography audit: 0 issues.
- Interaction Consistency audit: 0 issues.
- Responsive Pass audit: 0 issues.
- Final Visual audit: 0 issues.

The frozen UI is ready for backend architecture, API, event and permission mapping. Backend implementation and TOR acceptance remain separate work.


## 10. Repository cleanup policy

After the 1.11.0 freeze, superseded QA screenshot folders and the disconnected legacy prototype were removed from the repository. `qa-final-visual/` is the retained screenshot baseline. Regression scripts remain source-controlled and may regenerate temporary QA output folders locally when needed.
