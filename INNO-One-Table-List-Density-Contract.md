# INNO.One — Table, List & Data Density Contract

**Status:** UX/UI final polish — Step 5
**Date:** 2026-09-25
**UI Contract:** 1.17.0
**Documentation:** Design System V1.23
**Scope:** 93 Web routes / 97 canonical pages
**Backend:** Not in scope

## 1. Goal

Collection screens should feel related without forcing every dataset into the same visual component.

Use the pattern that matches the user's task:

- primary collection table,
- operational queue/list,
- supporting table,
- timeline/activity list.

Consistency means shared density, action hierarchy, search/filter behavior and responsive rules — not identical markup everywhere.

## 2. Primary collection table

Use for resources that users browse, search and open repeatedly.

Examples:
- Devices
- Asset Inventory
- Asset Users
- Deployment Jobs
- Alert Rules
- Alert History
- Notification Templates
- Delivery Log
- Maintenance History
- Consent History
- Bypass Rules
- Software Maintenance

Canonical structure:

```
Collection heading
Title / context                         [count/status]

Search                         Filter   Filter

Table
-------------------------------------------------
Primary identity | context | status | Action
```

Primary collection tables use:
- `.data-collection-head`
- `.data-toolbar`
- `.table[data-density="compact"]`

## 3. Toolbar contract

Desktop:
- Search first.
- Search width: flexible, normally up to ~380 px.
- Inline filters follow search.
- Columns / Export sit after filters or at the right edge where relevant.
- Do not put search/filter controls inside the same flex row as the section heading.

Tablet/mobile:
- Search becomes full width.
- Select/filter controls wrap below it.
- Controls must not shrink below readable widths.

Do not stack every filter vertically on desktop.

## 4. Search behavior

Primary collection search must use the shared search system:

```html
<input data-inno-search-target="#rows">
<tbody id="rows">...</tbody>
```

Benefits:
- one implementation,
- shared no-results state,
- Escape-to-clear,
- consistent search semantics.

Do not implement page-specific `oninput` filtering for primary collections.

## 5. Density

Primary collection tables use compact enterprise density:

- header height: 38 px,
- row height: 44 px,
- metadata may use a second line,
- row primary identity remains visually strongest,
- status badges remain compact.

Supporting tables may retain standard 48 px rows where extra readability is more useful than scan density.

Do not reduce rows below a comfortable pointer/scan target simply to show more records.

## 6. Action column

If a table has row actions:
- the column header is `Action`,
- cells use `.table-action`,
- actions align right,
- table buttons use the compact 32 px action height.

At narrow widths the action cell may remain sticky on the right so the user does not lose the row operation while horizontally scrolling.

Do not create a blank unnamed action header.

## 7. Numeric columns

Use `.num` when a column is primarily numeric.

Numeric columns:
- align right,
- use tabular numerals,
- retain semantic header names.

Identifiers or timestamps that need stable digit spacing may use `.mono` without adopting code-font styling.

## 8. Bulk selection

Bulk actions appear only after one or more rows are selected.

The canonical bulk pattern:
- select-all checkbox in header,
- row checkboxes,
- `.ds-bulkbar`,
- selected-count text,
- contextual bulk actions only.

Do not permanently show bulk actions when zero rows are selected.

## 9. Pagination

Use pagination when the collection logically exceeds the visible sample/page.

Canonical footer:
- result/count text on the left,
- pages on the right.

Do not add fake pagination to very small configuration lists merely for visual consistency.

## 10. Operational queues and lists

Helpdesk and Meeting use row-based list components where the task benefits from richer hierarchy.

Examples:
- Tickets
- Assigned to Me
- Team Queue
- My Meetings

These do **not** need to become HTML tables.

Rules:
- stable row grid,
- primary subject/title visually strongest,
- priority/status/SLA aligned consistently,
- row navigation at the trailing edge,
- search/filter only when useful to the scope.

A small personal queue such as Assigned to Me does not require search just because the global Tickets view has search.

## 11. Supporting tables

Supporting tables exist inside detail/configuration pages and should remain visually quiet.

Examples:
- owned assets on a user detail,
- recent history inside a detail view,
- preview/output tables.

Do not add collection toolbars, pagination or bulk actions unless that table becomes a primary task itself.

## 12. Responsive behavior

At <= 850 px:
- collection search becomes full width,
- filters wrap below,
- tables use horizontal scrolling instead of compressing text into unreadable columns,
- action cells may remain sticky right,
- page-level primary action stays outside the table toolbar.

Do not hide important identity/status data solely to avoid horizontal scroll unless a dedicated mobile row layout exists.

## 13. Regression gates

### `table-list-density-audit.py`

Checks:
- 12 canonical primary collection tables,
- compact density,
- shared search target wiring,
- canonical data toolbar,
- no toolbar nested inside section title,
- named/marked action columns,
- no one-off inline search filtering,
- required shared CSS rules.

### Browser regression

Rendered QA verifies:
- compact collection/action-column semantics,
- shared no-results search state,
- tablet toolbar stacking,
- collection toolbar separation from headings,
- canonical history search/filter toolbar.

## 14. Step 5 baseline

As of 2026-09-26:

- Web routes: **93**
- pages containing tables: **45**
- total tables: **51**
- canonical primary collections: **15**
- compact primary tables: **15 / 15**
- shared search targets: **15 / 15**
- action-column collections: **10 / 10**
- table/list density audit issues: **0**
- browser regression: **114 / 114**

## 15. Out of scope

This step does not:
- implement backend filtering,
- implement server-side pagination,
- define database query limits,
- add virtual scrolling,
- replace domain-specific queue/list layouts with generic tables.

It freezes the prototype's collection UX and density behavior only.
