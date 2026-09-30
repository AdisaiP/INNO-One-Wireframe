# INNO.One â€” Step 42.2 Design System Fidelity In-Progress Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2-design-system-baseline`
**Base HEAD before fidelity checkpoint:** `bea21bd feat: add production design system baseline`
**Checkpoint state:** verified; commit/push follows this handoff update
**Do not merge main. Do not deploy.**

## Current running preview

- Web: `http://localhost:5180`
- Design System: `http://localhost:5180/internal/design-system`
- API: `http://localhost:5080`
- API readiness confirmed HTTP 200.

## Why this follow-up exists

The first Step 42.2-0 React page was only a summarized Design System reference and did not visually match:

`file:///C:/Projects/INNO-One-Wireframe/design-system.html`

The current in-progress pass corrects that mistake by matching the frozen page structure and visual rhythm much more closely while still using Production React and `@inno/ui`.

## What has already changed in the new fidelity pass

Modified files:

- `production/apps/web-portal/src/app/AppShell.tsx`
- `production/apps/web-portal/src/pages/InternalDesignSystemPage.tsx`
- `production/apps/web-portal/src/pages/InternalDesignSystemPage.css`
- `step42_2-design-system-baseline-audit.py`
- `step42_2-design-system-browser-qa.py`

Implemented:

- contextual sidebar title is now **Design System**, not Admin Center;
- Design System sidebar has 13 anchors matching the frozen HTML:
  - Frozen Contract
  - Foundations
  - Actions
  - Forms
  - Data Table
  - Hierarchy
  - States
  - Interactions
  - Dialog & Sheet
  - Responsive
  - Navigation
  - Icons
  - Implementation Map
- header now matches frozen structure:
  - INNO.ONE UI FOUNDATION
  - Design System V1.26
  - Frozen
  - View Pilot Page
  - Copy Pattern
- restored:
  - frozen contract banner;
  - implementation direction alert;
  - Frozen UI contract / What is frozen / Source of truth;
  - foundations 2-column cards;
  - action placement;
  - forms;
  - data table;
  - hierarchy examples;
  - states;
  - interaction examples;
  - dialog/sheet;
  - responsive table;
  - navigation architecture;
  - icon vocabulary;
  - implementation map.
- geometry now follows the frozen CSS much more closely:
  - section rhythm 28px;
  - cards radius 12px;
  - cards padding 18px;
  - 2-column frozen/foundation grids at 1366;
  - stacked grids at 1024/768.

Latest 1366 screenshot:
`qa-ds-compare/react-1366.png`

Visually inspected and now much closer to the frozen `design-system.html`.

## Current QA state

Static Design System fidelity audit:

```text
section_parity=13
issues=0
```

Web TypeScript typecheck: PASS.

Dedicated browser QA latest run:

```text
checks=56
failures=0
```

The six timing-related failures were resolved by replacing the post-hash raw `Page.navigate(...); sleep(.25)` reset with the existing `nav('/internal/design-system')` readiness helper. No product interaction behavior needed to be changed.

## What is still unfinished from the OLD production UI cleanup

The larger Step 42.2 structural UI reset has **not started yet**. Existing real Production pages can still have the issues the user reported.

Remaining:

### Step 42.2A â€” Application Shell & Scroll Ownership
- sidebar/rail/header scroll ownership;
- fix contextual sidebar floating/moving with document scroll;
- main content should own the page scroll;
- remove conflicting sticky/relative/fixed overrides.

### Step 42.2B â€” Surface / Card Hierarchy
- reduce unnecessary nested cards;
- define Page / Section / Collection / Inset hierarchy.

### Step 42.2C â€” List / Collection Pages
- normalize Devices, Groups, Assets, Tickets, Admin lists.

### Step 42.2D â€” Create / Edit Forms
- normalize field spacing and sections;
- fix strange input blocks;
- fix Save/Create footer so it belongs to the editor instead of looking like a floating card.

### Step 42.2E â€” Resource Detail
- normalize identity / summary / tabs / detail sections;
- reduce strange detail cards/blocks.

### Step 42.2F â€” States
- normalize Empty / No Results / Loading / Error / Permission / Offline / Partial states;
- collection-local states such as â€œNo tickets in this queueâ€ must remain compact inside the collection.

### Step 42.2G â€” Responsive
- normalize 1366 / 1024 / 768 behavior after the structure is fixed.

### Step 42.2H â€” Final Structural Visual QA
- scroll tests;
- screenshot matrix;
- full route visual inspection.

## Design System fidelity checkpoint completion

Completed on 2026-09-30:

- dedicated Design System browser QA: **56/56**, failures=0;
- full static audit chain: **44/44**, failures=0;
- `@inno/ui` build: PASS;
- web-portal typecheck: PASS;
- web-portal production build: PASS;
- broad Production browser regression: **47 routes / 1287 checks / 0 failures**;
- `git diff --check`: PASS before commit.

Next slice: **Step 42.2A â€” Application Shell & Scroll Ownership**.

## New-chat instruction

The Design System fidelity checkpoint is complete and should remain intact. Continue with **Step 42.2A â€” Application Shell & Scroll Ownership** on the same branch unless a later handoff supersedes it. Do not merge or deploy without explicit instruction.
