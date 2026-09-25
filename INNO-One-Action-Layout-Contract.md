# INNO.One — Action & Layout Contract

**Status:** UX/UI consistency contract
**Date:** 2026-09-25
**Scope:** 93 Web Portal routes
**Backend:** Out of scope

## 1. Goal

Every INNO.One screen must answer three questions immediately:

1. What page/resource am I on?
2. What is the primary job of this screen?
3. Where is the primary action for that job?

The same kind of screen must place actions in the same place.

This contract supersedes ad-hoc use of generic `.actions` blocks for editor saves.

---

## 2. Canonical page types

### A. Overview / List

Purpose:
- browse,
- search/filter,
- select,
- create a new resource.

Action placement:

```
Page Header
Title / description                    [Secondary] [Primary Create]

Stats / filters / table
```

Rules:
- Primary create/new action belongs in the page header.
- Filters / columns / export belong in the table toolbar.
- Row actions stay on the row or row menu.
- Do not put Save/Apply actions in the page header.

Examples:
- Devices
- Tickets
- Meeting List
- Deployment Jobs

### B. Resource Detail

Purpose:
- inspect one resource,
- operate on that resource.

Action placement:

```
Breadcrumb

Resource Header
Resource identity                       [Secondary] [Primary resource action]

Tabs / detail panels
```

Rules:
- Resource-level actions belong in `.resource-actions`.
- Section-local actions belong in the owning panel/section header.
- Destructive actions must not visually compete with the normal primary action.

Examples:
- Device Detail
- Ticket Detail
- Meeting Detail
- Asset Detail

### C. Create / Edit / Configuration

Purpose:
- change one logical configuration/resource.

Action placement:

```
Page / Resource Header
Title / status

Editor content
  Section 1
  Section 2
  Advanced

┌────────────────────────────────────────────┐
│ [Discard / Cancel]              [Save]     │
└────────────────────────────────────────────┘
       canonical editor footer
```

Rules:
- Save/Create/Schedule/Apply belongs in the canonical editor footer.
- The footer sits at the end of the owning editor in normal flow. After that editor becomes dirty, it may dock to the bottom of the viewport while preserving the editor column width.
- Primary action is always the right-most action.
- Cancel/Discard is left-most when present.
- Secondary preview/testing action may sit before Primary only when it is implemented and relevant.
- Disabled / Coming Soon actions are forbidden in the editor footer.
- Do not place Save both in page header and footer.
- A long editor must keep the footer reachable without forcing the user to scroll past unrelated output/history.

Examples:
- Consent Policy
- Alert Rule
- Notification Rule
- Access Scope Edit
- Restart Schedule
- Endpoint Policy

### D. Builder / Wizard

Purpose:
- multi-step or iterative construction.

Action placement:

Wizard:
```
[Cancel]                     [Back] [Continue]
```

Builder:
```
[Secondary]                 [Run/Preview] [Save]
```

Rules:
- navigation/final actions live in a canonical builder/wizard footer at the end of that workflow; they do not float over untouched content.
- Back precedes Continue.
- Final step changes Continue to the final command.
- Preview belongs in the builder toolbar only if it updates an adjacent preview; otherwise use the footer.

Examples:
- New Deployment
- Report Builder

---

## 3. Canonical action zones

### 3.1 Page Header Actions

Class:
- existing `.page-head .actions`

Allowed:
- New / Create
- Import
- context navigation such as Business Calendar when it is a peer resource
- one normal secondary action

Not allowed:
- Save current form
- Apply current form
- disabled Coming Soon clutter
- table filters

### 3.2 Resource Actions

Class:
- `.resource-actions`

Allowed:
- resource operations such as Remote, Resolve, Reassign, Share, Export.

Rules:
- highest-frequency safe action receives Primary style,
- destructive action stays Danger,
- low-frequency actions move to menu if actions exceed 3–4.

### 3.3 Editor Footer

Canonical class:
- `.inno-editor-footer`

Structure:

```html
<div class="inno-editor-footer">
  <div class="inno-editor-footer-start">
    <button class="btn secondary">Discard</button>
  </div>
  <div class="inno-editor-footer-end">
    <button class="btn secondary">Preview</button>
    <button class="btn">Save</button>
  </div>
</div>
```

Rules:
- exactly one Primary action,
- Primary is right-most,
- no disabled actions,
- no navigation to unrelated settings,
- footer width equals owning editor pane,
- sticky bottom with translucent surface,
- on narrow screens actions remain ordered and do not reverse.

Legacy aliases to migrate:
- `.arch-editor-actions`
- `.form-footer`
- `.editor-footer`
- `.sticky-actions`

### 3.4 Section Actions

Location:
- section / panel header.

Allowed:
- actions affecting only that section.

Examples:
- Add Action Item in Meeting detail,
- Test Critical Alert in Channel section,
- Edit a specific subsection.

Not allowed:
- Save the entire page.

### 3.5 Table Actions

Location:
- table toolbar.

Order:
1. Search
2. Filters
3. Columns
4. Export
5. bulk actions only after selection

Create/New does not belong in the table toolbar if it creates a page-level resource.

---

## 4. Editor layout contract

### Standard editor

```
minmax(0, 1fr) + optional 320–360px supporting aside
```

- Main column contains editable fields.
- Aside contains summary / impact / explanation only.
- Aside must not contain a competing Save action.
- Main content uses 12–16px section gaps.

### Master + editor

For objects selected from a list:

```
280px master list | minmax(0, 1fr) editor
```

The editor owns its footer.

Do not place the footer underneath both columns when only the editor changes.

### Editor + results/history

If editing and monitoring are separate jobs:
- use tabs/views,
- or separate routes.

Do not force the user to scroll through results/history to reach Save.

---

## 5. Status and metrics

Metrics answer "what is happening?"

Editors answer "what am I changing?"

If KPI/stat cards belong primarily to monitoring/compliance:
- show them in a monitoring/compliance view,
- do not automatically place them above an editor.

Status badge for the edited resource belongs in the editor/resource header.

---

## 6. Coming Soon rule

Unavailable actions must not occupy high-emphasis action zones.

Forbidden:
- disabled Coming Soon next to Save,
- disabled Coming Soon as page primary action,
- blank icon button with Coming Soon tooltip.

Allowed:
- low-emphasis explanatory note,
- disabled navigation item when the whole destination is unavailable,
- clearly labeled roadmap/preview area outside the main task flow.

---

## 7. Responsive rules

All breakpoints:
- action footer belongs to the editor/builder/wizard that owns the pending change,
- untouched screens keep action footers in normal document flow so buttons never cover content,
- editor footers may dock only after the editor has unsaved changes,
- a docked editor footer retains the exact left/width of its owning pane,
- the owning pane reserves bottom safe space while docked so the final field/section can scroll clear of the action bar,
- builder/wizard footers remain in normal flow unless a future workflow explicitly requires persistent navigation.

Desktop:
- editor footer aligns to the owning editor column, never the supporting aside or the full page by accident,
- supporting aside may be sticky.

Tablet / narrow (≤850px):
- supporting aside moves below the primary editor,
- dirty-state docking uses the stacked editor width after the sidebar collapses,
- untouched content is never hidden behind an action bar.

Mobile:
- footer actions may stack only when necessary,
- Primary remains last in reading order and visually strongest,
- no horizontal page overflow.

---

## 8. Endpoint Policies reference architecture

```
Endpoint Policies

[ Policies ] [ Compliance ]

Policies view
┌──────────────────────┬────────────────────────────────┐
│ Policy list          │ Selected Policy                │
│                      │ Behavior                       │
│                      │ Assignment                     │
│                      │ Advanced exceptions            │
│                      ├────────────────────────────────┤
│                      │ Discard            Save Policy │
└──────────────────────┴────────────────────────────────┘

Compliance view
┌──────────┬───────────────┬─────────┐
│ Compliant│ Non-compliant │ Pending │
└──────────┴───────────────┴─────────┘

Compliance result table
```

Policy editing and compliance monitoring are separate views.

---

## 9. Audit rules

The automated UX action/layout audit must report:

- editor pages with Save/Create/Schedule/Apply outside canonical/legacy editor footer,
- editor footers with zero or more than one Primary action,
- disabled action inside editor footer,
- Save/Apply in page header,
- generic `.actions` containing editor-save actions,
- pages with both editor save and unrelated monitoring output after the editor,
- known master/editor pages whose footer spans the wrong ownership boundary,
- page header with more than two high-emphasis actions,
- application hash navigation (existing navigation audit remains authoritative).

The audit is a regression guard, not a substitute for visual review.

---

## 10. Final consistency process

1. Freeze this Action/Layout Contract.
2. Refactor Endpoint Policies as reference.
3. Refactor all Create/Edit/Configuration pages.
4. Refactor List/Overview header actions.
5. Refactor Detail resource actions.
6. Review every route at 1366 / 1024 / 768.
7. Regenerate visual baseline only after the action/layout audit is clean.
