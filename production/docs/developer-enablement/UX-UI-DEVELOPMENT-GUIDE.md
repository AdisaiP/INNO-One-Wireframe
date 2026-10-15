# UX/UI Development Guide

Frozen UX contracts remain authoritative.

## Choose the page pattern first

- P01 Overview
- P02 List
- P03 Resource Detail
- P04 Create / Edit
- P05 Settings
- P06 Builder
- P07 Monitor / Operations
- P08 Wizard
- P09 Master-Detail
- P10 History / Log

## Action placement

- Overview/List: Create/New in page header.
- Search/Filter/Columns/Export in collection toolbar.
- Resource Detail: resource actions with resource identity.
- Create/Edit/Settings: Save/Create/Schedule in editor footer.
- Builder/Wizard: navigation and run/save actions in owning footer.
- Do not duplicate Save in header and footer.

## Required states

Loading, Empty, No Results, Error, Permission Denied, Module Disabled, Resource Offline, and Partial Failure.

## Accessibility

Use native controls, accessible names for icon-only actions, correct toggle semantics, associated labels, visible keyboard focus, and focus restoration after dialogs/menus.

## Tables and collections

Search first, filters after search, named Action column, right-aligned numeric data, bulk actions only after selection, pagination only when justified.

## Interaction feedback

Save/Create follows busy -> success/error. Prevent duplicate submit. Validation uses inline errors, first-invalid focus, and one summary toast. Avoid browser-native alert/confirm/prompt.

## Shared implementation

Check `@inno/ui`, shared Web components, and existing design-system tokens/contracts before adding local patterns.

## Authoritative references

- `../ux/INNO-One-Design-System-V1-Frozen.md`
- `../ux/INNO-One-Final-UX-UI-Freeze.md`
- `../ux/INNO-One-Surface-Boundaries.md`
- `../contracts/INNO-One-Action-Layout-Contract.md`
- `../contracts/INNO-One-Accessibility-Contract.md`
- `../contracts/INNO-One-Availability-Contract.md`
- `../contracts/INNO-One-Interaction-Feedback-Contract.md`
- `../contracts/INNO-One-State-Coverage-Contract.md`
- `../contracts/INNO-One-Table-List-Density-Contract.md`
