# INNO.One — Step 42.2G Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2g-responsive`
**Base Step 42.2F checkpoint:** `a409141 refactor: normalize application states`
**Main remains:** `8e5be5e merge: integrate design system fidelity through step42.2B`
**Scope:** Responsive normalization
**Backend/API changes:** none
**Frozen Design System V1.26 / UI Contract 1.20.0 changes:** none
**Do not merge this branch to `main` or deploy unless explicitly requested.**

## What changed

Step 42.2G normalizes shared Web Portal responsive ownership after Steps 42.2A–F fixed the structural page patterns.

Canonical QA widths remain:

```text
1366  -> desktop / inline contextual sidebar
1024  -> compact shell / off-canvas contextual sidebar
768   -> narrow Web / compact rail + controlled local wrapping/scrolling
```

### Shared shell cleanup

`production/apps/web-portal/src/shell.css` now has one shared owner for the shell breakpoints instead of duplicate Step 29-era media blocks.

Key behavior:

- exact `1600px` remains the wide shell;
- `1599px` enters the compact wide shell;
- `<=1180px`
  - rail = 58px;
  - contextual sidebar becomes off-canvas;
  - sidebar width token is removed from the main grid;
  - context reveal owns opening/closing the drawer;
  - page padding remains 24 / 16 / 32.
- `<=850px`
  - rail = 56px;
  - compact header/action treatment;
  - page padding becomes 16 / 12 / 32.
- `<=680px`
  - rail = 52px;
  - narrow header uses `var(--prod-rail-w)` rather than a hard-coded width;
  - global search/avatar/header spacing tightens;
  - page padding becomes 14 / 10 / 30.

Legacy 54px / 50px rail values and duplicate 1180 / 850 / 680 shell blocks were removed.

No page-specific layout was flattened merely to reduce media-query count; page-local breakpoints remain where the owning page genuinely needs them.

## Responsive ownership verified

Shared component behavior remains owned by the existing `@inno/ui` responsive layer:

- collection Search owns the first row at narrow Web width;
- wide tables scroll inside `.inno-table-wrap`, not at document level;
- sticky Action remains reachable;
- Resource Detail summary stays four columns at 1366 / 1024 and two columns at 768;
- resource actions and tabs remain inside the main surface;
- editor footers remain within the main column and wrap only where required;
- state banners preserve contextual content and keep actions accessible;
- shell/document scroll ownership from Step 42.2A is preserved.

## Dedicated Step 42.2G QA

Static responsive guard:

```text
step42_2g_responsive_static_checks=25
step42_2g_responsive_static_failures=0
```

Dedicated browser responsive QA:

```text
step42_2g_responsive_checks=77
step42_2g_responsive_failures=0
```

It verifies:

- exact 1600 / 1599 shell boundary;
- rail widths 60 / 58 / 56 at 1366 / 1024 / 768;
- inline vs off-canvas contextual sidebar ownership;
- drawer open + Escape close;
- page gutters;
- Devices collection toolbar/search/table/sticky Action behavior;
- Device Detail summary/tabs/resource-header behavior;
- Ticket Create editor footer ownership;
- state-banner wrap behavior;
- no page-level horizontal overflow.

## Visual review

Representative screenshots were reviewed at the canonical widths:

- Workspace: 1366 / 1024 / 768
- Devices collection: 1024 / 768
- Device Detail: 1366 / 768

Observed result:

- no clipping;
- no document-level horizontal overflow;
- 1024 contextual sidebar moves off-canvas correctly;
- 768 search owns the first collection row;
- table overflow remains local to the collection;
- Device summary becomes two columns at 768;
- header/actions remain readable without collisions.

Screenshots were produced in `qa-step42_2g-responsive/` by the dedicated browser QA and are QA artifacts, not product source.

## Final regression gates

- full static audit chain: **50/50**, failures=0
- Step 42.2A scroll QA: **12/12**, failures=0
- Step 42.2B surface QA: **117/117**, failures=0
- Step 42.2C list/collection QA: **213/213**, failures=0
- Step 42.2D editor/settings QA: **183/183**, failures=0
- Step 42.2E resource-detail QA: **250/250**, failures=0
- Step 42.2F state QA: **174/174**, failures=0
- Step 42.2G responsive QA: **77/77**, failures=0
- Design System browser QA: **56/56**, failures=0
- broad Production browser regression: **51 routes / 1366 checks / 0 failures**
- `@inno/ui` build: PASS
- web-portal typecheck: PASS
- web-portal production build: PASS
- `git diff --check`: PASS before checkpoint

The production build still emits the existing Vite chunk-size warning for the main bundle; it is not a build failure and was not introduced by responsive CSS changes.

## Next step

# Step 42.2H — Final Structural Visual QA

Roadmap scope:

- scroll tests;
- screenshot matrix;
- full route visual inspection.

Step 42.2H should treat Steps 42.2A–G as the structural baseline and focus on final visual evidence rather than introducing another page pattern.

Recommended final QA emphasis:

- full route matrix at 1366 / 1024 / 768;
- shell/main/local-scroll ownership;
- contextual sidebar open/closed screenshots at compact widths;
- collection, editor, resource-detail and state representative screenshots;
- visual outlier review before the Design System fidelity checkpoint is considered complete.

Do not merge to `main` or deploy unless explicitly requested.
