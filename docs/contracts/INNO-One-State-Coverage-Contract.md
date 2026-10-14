# INNO.One — Empty / Loading / Error / Permission State Contract

**Status:** UX/UI final polish — Step 6
**Date:** 2026-09-26
**UI Contract:** 1.18.0
**Documentation:** Design System V1.24
**Scope:** 93 Web routes / 97 canonical pages
**Backend:** Not in scope

## 1. Goal

A screen must never fail silently or show contradictory UI when its data is empty, loading, unavailable, denied, partially failed or filtered to zero results.

State UX is part of the page architecture, not an afterthought.

## 2. Canonical state types

INNO.One defines these shared states:

- Empty
- No Results
- Loading
- Error
- Permission Denied
- Module Disabled
- Resource Offline
- Partial Failure

Validation and Unsaved Changes are interaction states and remain covered by the Interaction & Feedback contract.

## 3. Empty

Use Empty when the dataset is legitimately empty before search/filtering.

Canonical copy:
- title: `Nothing here yet`
- description: explain that no data exists in this view.

Empty is not the same as No Results.

Do not tell the user to change filters when there are no records in the first place.

## 4. No Results

Use No Results when data exists, but the current search/filter returns zero matches.

Canonical behavior:
- show the no-results state inside the owning collection,
- preserve collection heading and toolbar,
- show `0 matching results` in the collection footer,
- suppress pagination while zero results are shown,
- expose Clear Search when a search keyword caused the state,
- restore the original count and pagination when results return.

Do not leave a footer saying `Showing 1–4 of 128` while the table visibly contains zero matches.

## 5. Loading

Use skeletons for page/collection loading where the page structure is predictable.

Loading skeleton requirements:
- `role=status`,
- `aria-live=polite`,
- an accessible `Loading content` label,
- visually-hidden text for assistive technology,
- no fake interactive controls during loading.

Loading is not an Error state and must not show retry actions until failure is known.

## 6. Error

Use Error when the page or owning section failed to load.

Canonical full-page error:
- title explains that content could not load,
- short non-technical description,
- `Try again` action.

Prototype preview rule:
- Try again must leave the forced `uiState=error` preview and return to the normal page.
- A preview Reload that reloads the same forced error URL is forbidden.

Production implementation may retry the actual request before falling back to navigation.

## 7. Permission Denied

Permission state means the user is authenticated but not allowed to access the resource/page.

Canonical behavior:
- lock icon,
- `You do not have access`,
- explain that the current role does not include permission,
- provide a safe navigation path such as Back to Workspace.

Do not display inaccessible business data underneath the permission message.

## 8. Module Disabled

Use when a module is installed but disabled for the organization.

Canonical behavior:
- disabled-module icon,
- explain that an administrator must enable it,
- route the user to App Launcher / appropriate administration context.

Do not represent module-disabled as a generic network error.

## 9. Resource Offline

Offline is normally a contextual banner, not a full-page replacement.

For a cached Device detail:
- retain last known inventory,
- clearly mark the Device Offline,
- disable live-only actions,
- explain that the page is showing cached information.

Offline must not imply that cached detail is current.

## 10. Partial Failure

Partial failure preserves successful work.

Canonical behavior:
- show succeeded / failed counts,
- expose Retry failed,
- retry only failed items,
- after successful retry:
  - Failed count becomes 0,
  - state becomes visually resolved,
  - heading changes to `Retry completed`,
  - explanation confirms the failed items were retried,
  - retry action becomes unavailable.

Do not leave warning copy saying failures remain after failed count reaches zero.

## 11. State placement

### Full-page replacement
Use for:
- Loading
- Empty when the entire page resource does not exist yet
- Error
- Permission
- Module Disabled

The global rail/sidebar/topbar remain available where safe.

### Collection-local
Use for:
- No Results
- Empty list/table inside an otherwise valid page

Keep the collection heading and controls visible.

### Context banner
Use for:
- Offline resource
- Partial operational warning where the rest of the page remains meaningful.

## 12. Accessibility

State components:
- Error uses alert semantics.
- Loading uses polite status semantics.
- Non-error state messages use status semantics.
- State actions remain keyboard-accessible.
- Visually hidden loading text uses shared `.sr-only`.

## 13. Preview-state query contract

The HTML prototype supports deterministic QA states through:

- `?uiState=empty`
- `?uiState=loading`
- `?uiState=error`
- `?uiState=permission`
- `?uiState=disabled`
- `?uiState=partial`
- `?uiState=offline`

These are QA/prototype switches, not production URL contracts.

## 14. Regression gates

### `state-coverage-audit.py`

Verifies:
- all canonical shared states exist in runtime,
- loading semantics,
- truthful no-results collection metadata,
- pagination suppression/restoration,
- resolved partial-retry behavior,
- recoverable error preview behavior,
- required frozen state screenshots.

### `qa-ux-input-browser.py`

Rendered QA verifies:
- full-page Empty,
- accessible Loading,
- recoverable Error,
- No Results footer/pagination,
- restoration after clearing search,
- Partial retry resolution.

## 15. Step 6 baseline

As of 2026-09-26:

- Web routes: **93**
- shared canonical runtime states: **8 / 8**
- browser regression: **114 / 114**
- state coverage audit target: **0 issues**
- frozen visual states include Empty, No Results, Loading, Error, Permission, Disabled, Offline and Partial Failure.

## 16. Out of scope

Step 6 does not implement:
- real network retries,
- server-side permission checks,
- actual offline cache synchronization,
- backend error codes,
- production loading duration,
- retry backoff.

It freezes the frontend state contract before backend integration.
