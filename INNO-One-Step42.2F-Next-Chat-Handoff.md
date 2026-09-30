# INNO.One — Step 42.2F Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2f-states`
**Base Step 42.2E checkpoint:** `6961f74 refactor: normalize resource detail anatomy`
**Main remains:** `8e5be5e merge: integrate design system fidelity through step42.2B`
**Scope:** Application States
**Backend/API changes:** none
**Do not merge this branch to `main` or deploy unless explicitly requested.**

## Canonical state model

Step 42.2F normalizes the State Coverage Contract around eight shared states:

```text
Empty
No Results
Loading
Error
Permission
Module Disabled
Offline
Partial Failure
```

## Shared state runtime

`@inno/ui` now owns the canonical semantics:

- `INNOState`
  - Error uses `role="alert"`.
  - Non-error states use `role="status"`.
  - Loading uses `aria-live="polite"`, `aria-label="Loading content"`, `aria-busy`, an SR-only loading label, and the shared loading icon animation.
  - `banner` supports contextual Offline / Partial Failure states without replacing useful loaded content.
- `INNOCollectionState`
  - owns compact collection-local Empty / No Results / Loading / Error / Permission presentation.
  - No Results keeps the collection heading and controls visible.
  - No Results renders a truthful `0 matching results` footer.
- `INNOPagination`
  - when `totalItems === 0`, shows `0 matching results`.
  - does not render fake Previous / Page / Next controls for zero results.

Production feedback helpers now include:

- `LoadingState`
- `ErrorState`
- `PermissionState`
- `ModuleDisabledState`
- `CollectionLoadingState`
- `CollectionErrorState`

403 responses map to Permission rather than generic Error, and 401 remains a sign-in/session error.

## Normalized collection-local states

Shared collection-state ownership was applied to the main searchable/filterable and supporting collections, including:

- Devices
- Device Groups
- Asset Inventory
- Asset Owners
- Admin Users
- Tickets
- Automation Rules
- Audit Log
- Access Scopes
- Organization hierarchy
- Positions
- Roles / Permissions
- Discovery Results
- Software Baselines
- Device Software
- Device Group Members
- Apps

Filtered No Results states preserve collection controls and offer Clear Search / Clear Filters where the page owns that operation. Audit Log keeps its existing toolbar-level Clear Filters ownership rather than duplicating the action inside the state.

## Permission / Disabled / Offline / Partial Failure

Permission:
- canonical title: `You do not have access`
- explains that the current role lacks permission
- safe route back to Workspace where used as a deferred page

Module Disabled:
- canonical title: `Module is not available`
- explains that an administrator must enable the module
- safe route to Apps

Offline:
- Device Detail no longer uses page-local `.offline-banner`.
- shared `INNOState banner kind="offline"` explains cached vs live-only behavior.
- cached resource summary and tabs remain visible.

Partial Failure:
- Workspace and Admin overview warnings use contextual shared banners.
- successfully loaded data remains visible.
- the Design System reference demonstrates deterministic retry semantics:
  `8 succeeded, 2 failed` → `Retry failed` → `Retry completed` / `10 of 10 devices updated`.

The internal Design System now documents and previews all eight canonical state kinds.

## QA / regression

Dedicated Step 42.2F browser QA at 1366 / 1024 / 768:

```text
step42_2f_state_checks=174
step42_2f_state_failures=0
```

It verifies:
- real No Results behavior on searchable Production collections;
- collection heading / toolbar preservation;
- exact `0 matching results` footer;
- no fake pagination controls;
- Clear action restores real data;
- all eight canonical state kinds;
- Loading / Error accessibility semantics;
- Permission / Module Disabled canonical copy;
- Partial Failure retry preserving successful work;
- a real Offline Device discovered from the Production list;
- cached detail remains visible under Offline status;
- no page-level horizontal overflow.

Final regression gates:

- full static audit chain: **49/49**, failures=0
- Step 42.2A scroll QA: **12/12**, failures=0
- Step 42.2B surface QA: **117/117**, failures=0
- Step 42.2C collection QA: **213/213**, failures=0
- Step 42.2D editor/settings QA: **183/183**, failures=0
- Step 42.2E resource-detail QA: **250/250**, failures=0
- Step 42.2F states QA: **174/174**, failures=0
- Design System browser QA: **56/56**, failures=0
- broad Production browser regression: **51 routes / 1366 checks / 0 failures**
- `@inno/ui` build: PASS
- web-portal typecheck: PASS
- web-portal production build: PASS
- `git diff --check`: PASS before checkpoint

## QA harness hardening completed during this step

The Product implementation was not changed to hide QA-environment issues.

- Design System browser login accepts both the previous `172.10.1.58:8080` Keycloak host and the current `localhost:8080` redirect.
- Step 42.2E detail QA waits for resource tabs to mount before interaction, reducing timing-only misses.
- The local Vite QA server was restored on port 5180 from the actual `apps/web-portal` root after the previous process stopped.

## Next step

# Step 42.2G — Responsive normalization

Roadmap scope:

- normalize the final 1366 / 1024 / 768 behavior now that structural page patterns are fixed;
- inspect shared shell, collections, resource details, editors, state banners and horizontal-scroll ownership at each breakpoint;
- remove remaining page-local responsive exceptions when a shared rule can own the behavior;
- preserve the frozen Design System V1.26 / UI Contract 1.20.0 and all Step 42.2A–F regression gates.

Step 42.2H after that is Final Structural Visual QA (scroll tests, screenshot matrix and full-route visual inspection).

Do not merge to `main` or deploy unless explicitly requested.
