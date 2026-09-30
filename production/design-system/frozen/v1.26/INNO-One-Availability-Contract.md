# INNO.One — Availability & Unavailable-Feature UX Contract

**Status:** UX/UI final polish — Step 2
**Date:** 2026-09-25
**UI Contract:** 1.14.0
**Documentation:** Design System V1.20
**Scope:** 97 canonical pages
**Backend:** Not in scope

## 1. Principle

An unavailable capability must never masquerade as a working action.

Users should not have to discover product availability by clicking grey buttons, reading "Coming soon" tooltips, or scanning disabled navigation.

Normal task flow contains only:
- working prototype actions,
- routes that exist,
- state-disabled controls whose disabled state is meaningful now,
- passive status / roadmap information that does not look actionable.

## 2. Visible action rule

Visible buttons and links must do one of the following:

1. navigate to a canonical route,
2. open a real prototype UI state,
3. execute a prototype interaction with visible feedback,
4. represent a legitimate current state such as a disabled wizard Back action.

A visible control must not exist only to say:
- Coming soon,
- not implemented,
- future capability.

## 3. Future navigation

Future routes may remain in source metadata for roadmap/reference purposes, but normal contextual navigation hides them.

Canonical behavior:

```css
.side a.nav-disabled {
  display: none !important;
}
```

This prevents sidebars from looking half-finished while preserving existing roadmap markup for later implementation work.

Future navigation must not:
- receive focus,
- occupy visible sidebar space,
- display a "Soon" badge in normal product navigation.

## 4. When a real route already exists

Replace the unavailable action with the real route.

Example:

```
Workspace Recent Activity
View history → workspace-recent.html
```

Do not keep a disabled "View History" button once the canonical route exists.

## 5. Read-only information

If the prototype presents data but does not support editing that resource yet:

- show the data,
- mark it as read-only/reference only when useful,
- remove Edit / Configure / Add buttons that do nothing.

Examples:
- Helpdesk Statuses show lifecycle configuration without fake Edit controls.
- Software License detail uses a passive Read only tag.
- Asset baseline panel uses a passive Reference tag.

## 6. Prototype-local actions

A UI prototype may keep an action active when the interaction itself is part of the UX contract even though no backend exists.

Requirements:
- the action produces visible feedback,
- it does not pretend that external persistence/network work actually occurred,
- wording may explicitly state "prototype state" where necessary.

Examples:
- Generate Installer → prototype success feedback.
- Create Screenshot Job → prototype success feedback.
- Wake Selected → prototype confirmation + queued feedback.
- Apply Helpdesk report filters → prototype feedback.

## 7. Duplicate actions

If an active action already exists deeper in the task surface, remove redundant disabled copies.

Example:
- Meeting Files keeps the active "Upload file" empty-state action.
- The disabled panel-header Upload action is removed.

## 8. Module Registry

Future modules remain visible in Apps & Modules because the registry intentionally communicates package availability.

Rules:
- Available / not-installed status may be shown.
- Inspect remains active.
- Do not show a disabled Install button until install workflow exists.
- Installed modules keep the real enable/disable switch.

## 9. Admin overview tiles

An Admin Center tile styled as navigation must be a real link.

Unavailable administration domains do not use visually identical non-clickable tiles.

Current Admin navigation tiles point only to canonical pages such as:
- Roles & Permissions,
- Access Scopes,
- Apps & Modules,
- Design System.

## 10. Table / toolbar actions

Unavailable toolbar actions are removed rather than disabled.

Examples:
- Asset Inventory Export removed.
- Contracts Export removed.
- Software Licenses Export removed.

Where a real workflow exists, route to it instead:
- Asset bulk ownership → Ownership & Users.
- Generate QR → QR Labels.

## 11. Legitimate disabled controls

Disabled controls are still allowed when the disabled state is meaningful to the current workflow rather than a placeholder.

Examples may include:
- Back at the first wizard step,
- terminal/ended operational state,
- state-dependent controls that become enabled through an existing prototype interaction.

The Availability audit records these separately from unavailable-feature placeholders.

## 12. Regression gates

### `availability-audit.py`

Fails when:
- a canonical page contains a visible-task control labelled Coming Soon,
- future sidebar placeholders are not globally hidden,
- Admin contains non-interactive tiles styled as navigation.

### `qa-ux-input-browser.py`

Rendered Web regression fails when:
- future sidebar navigation is visible,
- a visible button/link still exposes Coming Soon,
- Step 2 reference flows regress.

## 13. Step 2 baseline

As of 2026-09-26:

- canonical pages: **97**
- Coming Soon task actions: **0**
- hidden future navigation placeholders retained in source: **126**
- non-interactive Admin action tiles: **0**
- legitimate non-future disabled controls: **4**
- browser UX regression: **114 / 114 checks**
- Final Visual QA: **127 / 127 checks**
- canonical route screenshots: **97**
- state screenshots: **14**

## 14. Examples changed in Step 2

- Asset Custom Fields: dead Edit column removed.
- Asset Inventory: dead Export/Add Category removed; ownership uses a real route.
- Ownership Submissions: dead Review buttons removed.
- Device Add: Generate Installer is an active prototype action.
- Device Services: Start uses the same command pattern as Stop.
- Network Discovery: dead Edit Settings removed.
- Helpdesk Reports: Apply is active.
- Helpdesk Statuses: read-only lifecycle view; dead editing controls removed.
- Meeting Detail: duplicate unavailable Add/Upload controls removed.
- Modules: future modules keep Inspect without fake Install.
- Remote Operations: passive context replaces dead filter-like buttons; job/wake commands are active prototype interactions.
- Software Licenses: dead Export/Edit removed.
- Workspace: View history uses the canonical Recent route.
- Android Assets Mobile: unavailable full-list button replaced with passive software-list context.
- Admin Center: unavailable navigation-like tiles removed.

## 15. Next polish step

Step 3 is Language & Terminology Consistency.

Do not begin backend implementation as part of this UX/UI sequence.
