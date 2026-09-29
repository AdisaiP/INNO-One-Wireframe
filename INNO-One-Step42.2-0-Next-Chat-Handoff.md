# INNO.One â€” Step 42.2-0 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2-design-system-baseline`
**Scope:** Production Design System Baseline
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0
**Backend/API changes:** none
**Meeting:** still deferred
**React Flow:** not introduced

## 1. Why this checkpoint exists

Step 42.2-0 was inserted before the structural UI reset so future work stops deciding spacing, surfaces, editor footers, list/detail anatomy and responsive behavior page-by-page.

The repository now has two explicit layers:

1. a read-only frozen prototype/contract snapshot;
2. a Production React reference page built from real `@inno/ui` primitives.

Future Step 42.2 work should compare Production implementation against these references before adding page-local CSS.

## 2. Frozen reference snapshot

Created:

```text
production/design-system/frozen/v1.26/
```

The snapshot includes the frozen reference page, design-system CSS/JS helpers, design contract and the key UX contracts used by Production.

Important files include:

```text
design-system.html
workspace-v2.css
inno-design-system.css
inno-design-contract.js
inno-inputs.js
inno-interactions.js
inno-states.js
inno-responsive.js
inno-navigation.js
inno-icons.js
platform-shell.js

INNO-One-Design-System-V1-Frozen.md
INNO-One-Final-Visual-QA-Baseline.md
INNO-One-Action-Layout-Contract.md
INNO-One-State-Coverage-Contract.md
INNO-One-Table-List-Density-Contract.md
INNO-One-Accessibility-Contract.md
INNO-One-Availability-Contract.md
INNO-One-Language-Terminology-Contract.md
INNO-One-Interaction-Feedback-Contract.md
INNO-One-Surface-Boundaries.md
INNO-One-Special-UI-Components.md
```

Also added:

```text
README.md
manifest.sha256
```

The SHA-256 manifest guards the frozen snapshot against accidental edits.

Production React must **not** import prototype HTML/CSS/JS from this directory.

## 3. Production React reference route

Added internal route:

```text
/internal/design-system
```

Behavior:

- requires existing `admin.access`;
- intentionally absent from normal Rail/Sidebar navigation;
- inherits Admin Center shell ownership when opened directly;
- uses real `@inno/ui` React components;
- lazy-loaded so normal user flows do not load the internal reference page.

Source:

```text
production/apps/web-portal/src/pages/InternalDesignSystemPage.tsx
production/apps/web-portal/src/pages/InternalDesignSystemPage.css
```

## 4. Reference sections

The React page contains:

1. Foundations
   - frozen colors
   - spacing scale
   - control height
   - table-row target
   - radius scale

2. Actions & Status
   - primary / secondary / ghost / danger
   - busy state
   - status variants

3. Forms
   - visible labels
   - input / select / textarea
   - field help text

4. Primary Collection
   - collection heading
   - search
   - filter
   - table
   - collection-local no-results state
   - real pagination demo

5. State Hierarchy
   - empty
   - no results
   - loading
   - error
   - permission
   - offline
   - partial failure

6. Screen Patterns
   - P02 List
   - P03 Resource Detail
   - P04 Create / Edit
   - target anatomy plus React primitive previews

7. Navigation Ownership
   - Global Header
   - Global Rail
   - Context Sidebar
   - Main Content

8. Responsive Contract
   - Wide >=1600
   - Desktop 1367â€“1599
   - Compact 1181â€“1366
   - Tablet 851â€“1180
   - Narrow <=850
   - Very Narrow <=680

## 5. Pattern decisions frozen for Step 42.2

### P02 List

```text
Page Header
Collection Heading
Search / Filters / Columns / Export
Table or operational list
Pagination or collection-local state
```

### P03 Resource Detail

```text
Breadcrumb + logical back
Resource identity + resource actions
Status / summary
Tabs
Flat detail sections / related collection
```

### P04 Create / Edit

```text
Page Header
Editor sections + fields
One owning action footer
```

Save/Create must not be duplicated in the Page Header.

The internal reference page scopes the P04 preview footer to the intended integrated/flat anatomy. The global Production editor-footer implementation is **not** structurally reset in this checkpoint; that belongs to Step 42.2D.

## 6. Code splitting

The internal reference route is lazy loaded.

Final Vite output includes separate chunks similar to:

```text
InternalDesignSystemPage CSS  ~8.5 kB
InternalDesignSystemPage JS   ~17.5 kB
main app JS                   ~646 kB
```

The existing >500 kB main chunk warning remains a separate performance follow-up.

## 7. Dedicated QA

Static guard:

```text
step42_2-design-system-baseline-audit.py
issues = 0
```

This validates:

- frozen snapshot presence;
- V1.26 / UI 1.20.0 markers;
- SHA-256 manifest integrity;
- internal admin-gated route;
- lazy loading;
- no frozen prototype imports into Production React;
- hidden route does not leak into normal navigation;
- P02 / P03 / P04 reference sections are present.

Browser QA:

```text
step42_2-design-system-browser-qa.py
checks = 39
failures = 0
```

Coverage includes:

- real Keycloak login;
- Admin shell ownership;
- route hidden from normal navigation;
- frozen path/banner;
- all eight reference sections;
- live Collection search/filter;
- Detail tab interaction;
- Editor save feedback;
- integrated editor-footer target preview;
- 1366 / 1024 / 768;
- no horizontal overflow;
- compact contextual hamburger behavior.

Screenshots were generated and visually inspected at all three widths.

## 8. Regression

Final static chain:

```text
STATIC_TOTAL = 44
STATIC_FAILED = 0
```

Build/typecheck:

```text
@inno/ui build       PASS
web-portal typecheck PASS
web-portal build     PASS
```

Broad Production browser regression after the final lazy-loaded route change:

```text
routes = 47
checks = 1287
failures = 0
```

## 9. Contract versions

No frozen contract version changed.

```text
Design System V1.26
UI Contract   1.20.0
```

This checkpoint adds a Production reference implementation; it does not redefine the frozen contract.

## 10. Next step

Next work is:

# Step 42.2A â€” Application Shell & Scroll Ownership

Primary goal:

- one viewport-height application shell;
- Header / Rail / Context Sidebar remain application chrome;
- Main Content owns the page scroll;
- eliminate conflicting `fixed / sticky / relative` sidebar rules;
- verify that scrolling long Device Groups / Tables does not make the contextual sidebar float with document content;
- retain the existing 1024 / 768 off-canvas drawer behavior.

After 42.2A:

```text
42.2B Surface / Card hierarchy
42.2C List / Collection
42.2D Create / Edit forms + Save footer
42.2E Resource Detail
42.2F Empty / Loading / Error states
42.2G Responsive normalization
42.2H Final structural visual QA
```

Do not merge to `main` unless explicitly requested.
Do not deploy.
