# INNO.One — Accessibility & Semantic UI Contract

**Status:** UX/UI final polish — Step 1
**Date:** 2026-09-25
**Scope:** 93 Web routes + Design System + 2 Endpoint Agent surfaces + Android Assets Mobile
**Backend:** Not in scope

## 1. Purpose

This contract defines the minimum semantic/accessibility behavior for the INNO.One prototype.

The goal is not to change the visual design. The same visible controls must expose usable names, roles and keyboard behavior to assistive technology.

## 2. Interactive-control rule

Use native interactive elements whenever an element can be activated by the user.

Allowed:
- `button`
- `a[href]`
- `input`
- `select`
- `textarea`
- `summary`

Do not use clickable `div`, `span`, `label` or `li` elements for actions.

## 3. Icon-only controls

Every icon-only button/link requires an accessible name.

Preferred:

```html
<button type="button" aria-label="Close device actions">
  <i class="fa-solid fa-xmark"></i>
</button>
```

A visible text label is better where space permits.

`title` may remain as a visual tooltip, but product controls should prefer `aria-label` / `aria-labelledby` as the explicit name.

## 4. Switches

Interactive toggles use a native button or input.

Canonical button switch:

```html
<button
  type="button"
  class="toggle on"
  role="switch"
  aria-checked="true"
  aria-label="Email notifications">
</button>
```

Requirements:
- keyboard-activatable by native button behavior,
- `role="switch"`,
- `aria-checked="true|false"`,
- accessible name,
- visible focus state.

Read-only/decorative toggle graphics use `aria-hidden="true"` and must not appear interactive.

## 5. Form labels

A field with one obvious native input/select/textarea must expose an associated label.

The shared Input System:
- assigns an ID to an unlabeled single field control,
- connects the field label with `for`,
- keeps custom select triggers associated with the same visible field label.

Custom select trigger name contains:
- field label,
- selected value.

Segmented select controls expose:
- a labelled `role="group"`,
- visible text on every option button,
- `aria-pressed` state.

## 6. Search and utility inputs

An input without a separate visible label must have an accessible name.

For utility/search inputs, the shared Input System may derive `aria-label` from the existing placeholder.

Examples:
- Search devices
- Search transcript
- Search apps, devices, tickets and actions

## 7. Table selection controls

Table checkboxes without a visible label receive contextual accessible names.

Header:
- `Select all rows`

Row:
- `Select <resource name>`

The row's first meaningful resource cell is used as the accessible context.

## 8. Action-item checkboxes

Meeting action-item checkboxes use the task title in the accessible name.

Example:
- `Toggle action item: Finalize navigation system`

## 9. Global rail/navigation

Icon-only Global Rail links must expose:
- `aria-label`
- tooltip/title where useful.

Canonical labels:
- Home
- Apps
- Devices
- Assets
- Reports
- Helpdesk
- Meeting
- Admin Center

The shared Platform Shell applies these labels so individual pages do not need duplicate markup.

## 10. Focus

Interactive switches use a visible `:focus-visible` outline.

Custom select behavior already guarantees:
- keyboard open,
- listbox navigation,
- Escape close,
- focus restoration to the trigger.

No action should require pointer-only interaction.

## 11. Surface coverage

Accessibility static audit covers all frozen canonical pages:

- 93 Web Portal routes
- Design System reference
- 2 Endpoint Agent routes
- Android Assets Mobile

Total: **97 canonical pages**

Browser DOM regression additionally checks all 93 Web routes at:
- 1366 px
- 1024 px
- 768 px

## 12. Regression gates

### `accessibility-audit.py`

Fails on:
- unnamed icon-only controls,
- non-semantic clickable elements,
- invalid interactive switches,
- images missing `alt`.

### `qa-ux-input-browser.py`

Rendered-DOM route pass additionally fails on:
- unnamed visible button/link,
- visible input/textarea without accessible label/name,
- non-semantic visible `onclick` elements,
- malformed visible `role="switch"`.

## 13. Current Step 1 baseline

As of 2026-09-26:

- canonical pages: **97**
- unnamed icon-only controls: **0**
- non-semantic clicks: **0**
- invalid switches: **0**
- images missing alt: **0**
- Current Web browser UX/Input/A11y regression: **114 / 114 checks**
- 93 Web routes pass at 1366 / 1024 / 768

## 14. Out of scope for Step 1

The following are separate final-polish steps:

- Coming Soon / disabled-action cleanup
- Language and terminology consistency
- final micro-interaction/state wording review
- production WCAG certification / manual assistive-technology testing

Step 1 establishes the prototype's semantic baseline; it is not a claim of formal WCAG certification.
