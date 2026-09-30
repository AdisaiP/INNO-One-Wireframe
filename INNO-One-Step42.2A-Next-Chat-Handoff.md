# INNO.One — Step 42.2A Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2-design-system-baseline`
**Scope:** Application Shell & Scroll Ownership
**Base checkpoint:** `6921818 fix: restore design system fidelity`
**Backend/API changes:** none
**Do not merge main. Do not deploy.**

## What changed

Step 42.2A moves page scrolling out of the document and into the Production main-content region.

Implemented in `production/apps/web-portal/src/shell.css`:

- the application shell owns the viewport height using `100vh / 100dvh`;
- shell rows are Header + remaining viewport body;
- `.prod-shell-body` is height-constrained and does not scroll;
- `.prod-main` owns vertical page scrolling;
- Rail and desktop Context Sidebar are shell chrome, not document-sticky content;
- duplicate Step 42.1 sticky overrides were removed from the final ownership layer;
- 1024 / 768 keep the existing fixed off-canvas Context Sidebar behavior.

## Dedicated scroll ownership QA

Added:

`step42_2a-shell-scroll-browser-qa.py`

Validated at 1366 / 1024 / 768:

- document does not own vertical page scroll;
- `.prod-main` has real overflow and scrolls;
- Rail position is stable while main scrolls;
- desktop Context Sidebar remains stable shell chrome;
- tablet/narrow Context Sidebar remains fixed off-canvas.

Result:

```text
step42_2a_scroll_checks=12
step42_2a_scroll_failures=0
```

## Regression

- web-portal typecheck: PASS
- web-portal build: PASS
- Design System browser QA: 56/56, failures=0
- broad Production browser regression: 49 routes / 1323 checks / 0 failures
- static audit chain: 44/44, failures=0
- `git diff --check`: PASS

The Step 42.1 detail-polish audit was updated so its shell ownership guard tracks the Step 42.2A contract instead of requiring the obsolete sticky-shell marker.

## Next step

Next UX slice:

# Step 42.2B — Surface / Card Hierarchy

Primary goals:

- reduce unnecessary nested cards;
- define clear Page / Section / Collection / Inset hierarchy;
- remove card-on-card visual noise;
- preserve collection-local states and existing action ownership;
- validate the hierarchy at 1366 / 1024 / 768 before moving to list normalization.

Do not merge to `main` or deploy unless explicitly requested.
