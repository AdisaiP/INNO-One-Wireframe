# INNO.One — Step 44B Shared Interaction Foundations

**Status:** COMPLETE — shared production foundations implemented and regression-tested
**Branch:** `ux/step44b-shared-interaction-foundations`
**Base:** `892b2a6 docs: freeze screen interaction architecture`
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## Purpose

Step 44B turns the Step 44A interaction decisions into reusable Product primitives before route-by-route architecture remediation begins.

The goal is not to redesign every page in one pass. The goal is to make the correct interaction building blocks real, accessible, responsive and reusable so Step 44C–44F can remove the remaining page-specific patterns instead of creating new ones.

## Shared foundations implemented

### INNORowActions

Production shared component now supports:

- one action → canonical compact row action;
- multiple actions → More menu;
- destructive action tone;
- portal rendering to `document.body` so the menu is not clipped by table scrollers;
- viewport-aware placement above/below the trigger;
- close on outside pointer, resize or scroll;
- Arrow Up / Arrow Down / Home / End navigation;
- Escape close;
- trigger focus restoration;
- disabled / busy semantics.

The component is proven in:
- Admin Integrations `Test`;
- Internal Design System live table demo.

Full migration of all legacy `Select/Open` row actions is intentionally deferred to route remediation steps.

### INNODialog

Shared dialog now owns:

- portal rendering;
- `role="dialog"`;
- `aria-modal="true"`;
- title and optional description association;
- initial focus / `data-autofocus`;
- Tab focus trap;
- Escape close;
- body scroll lock;
- focus restoration;
- optional backdrop-close policy;
- shared header/body/footer layout;
- sm/md/lg sizing;
- responsive compact layout.

### INNODrawer

Shared drawer uses the same accessibility/focus contract as Dialog.

Behavior:
- desktop/tablet keeps parent-page context visible;
- right aligned;
- sm/md/lg widths;
- becomes full viewport width below 680px.

This foundation is intended for contextual inspection and compact edit jobs, not complex multi-section forms.

### INNOPurposeNote / INNOInfoCallout

Passive product explanation is now separate from application state.

`INNOState` remains reserved for actual:
- loading,
- empty,
- no results,
- error,
- permission,
- disabled,
- offline,
- partial failure.

Purpose Note is a lightweight explanatory surface without the generic circular state icon.

Migrated passive explanatory content includes:
- Admin Integrations,
- Admin Audit,
- Branding,
- Platform Settings,
- Roles,
- Security,
- Search authorization boundary,
- Agent Deployment,
- Automation Rule,
- Business Calendar,
- SLA,
- Profile,
- Ticket Create.

Legacy page-local `.purpose-note` markup is removed.

### Integrated editor action bar

`INNOEditorFooter` no longer looks like an unrelated rounded floating card by default.

Default:
- normal document flow;
- top divider;
- transparent background;
- no radius;
- no floating shadow;
- visually attached to the owning editor.

Optional:
- `docked` prop;
- sticky bottom only when a long dirty editor genuinely needs it.

Removed old page-local footer chrome:
- deployment override;
- ticket-create override;
- baseline footer override;
- standalone footer override;
- QR-specific footer override.

Asset QR Labels now uses:
- `INNOEditorFooterStart`;
- `INNOEditorFooterNote`;
- `INNOEditorFooterEnd`.

### Shared spacing ownership

New shared spacing tokens:

```text
--ds-space-1
--ds-space-2
--ds-space-3
--ds-space-4
--ds-space-5
--ds-space-6
--ds-surface-padding-x
--ds-surface-padding-y
--ds-field-gap
--ds-table-cell-x
--ds-table-cell-y
```

Shared collection/table/editor surfaces now consume these tokens.

Production form controls use the shared `--ds-control-h` height (36px) instead of a page-level 38px override.

Business Calendar's three-column Holiday Exceptions table no longer forces the unnecessary `wide` table preset or local horizontal scrollbar.

## Design System proof

Internal Design System now demonstrates the real shared primitives instead of carrying a second custom overlay implementation:

- `INNORowActions`;
- `INNODialog`;
- `INNODrawer`;
- `INNOInfoCallout`.

Obsolete demo-only dialog/sheet overlay CSS was removed.

## Broad QA readiness hardening

The broad Production browser QA still used the old route readiness test and intermittently failed Workspace `/`, especially immediately after Keycloak login or at 768px.

It now uses the already-proven Step 42.2H readiness rule:

- wait for `.inno-production-shell`;
- wait for `.prod-main`;
- accept `.inno-page` or `.workspace-home-page`;
- require mounted non-zero main width;
- reject boot/loading state;
- timeout 20 seconds.

After this change the full 51-route regression passes without the historical Workspace timing race.

## Step 44A gap status after Step 44B

Remediated at shared-foundation level:

1. editor footer floating-card appearance;
2. passive explanation rendered as application state;
3. baseline spacing drift covered by shared surface/form/table tokens.

Still present / intentionally scheduled later:

1. incorrect permanent side-card form/detail architecture;
2. row-action inconsistency across legacy pages;
3. hero illustration parity gap;
4. Workflow Canvas foundation;
5. Tree / TreeGrid foundation;
6. Assets User Profiles information-architecture ambiguity.

The Step 44A audit therefore reports:

```text
step44a_reported_gap_classes=9
step44a_current_gap_classes=6
```

## QA

Dedicated static guard:

```text
step44b_checks=65
step44b_failures=0
step44b_foundations=5
step44b_passive_state_migrations=7
```

Dedicated browser QA:

```text
step44b_browser_checks=65
step44b_browser_failures=0
```

Browser QA proves:

- Integrations Purpose Note at 1366 / 1024 / 768;
- no explanatory application-state icon;
- canonical row action;
- integrated editor footer;
- 36px form controls;
- no unnecessary Business Calendar local horizontal scroll;
- row menu portal / viewport placement;
- keyboard row-menu navigation;
- Escape + focus restoration;
- Dialog portal / modal semantics / autofocus / scroll lock / Escape / focus restore;
- Drawer portal / autofocus / Escape / focus restore;
- 768 contextual drawer;
- 640 full-width drawer.

Regression:

```text
Step 42.2G responsive: 77/77, failures=0
Design System browser: 56/56, failures=0
Broad Production: 51 routes / 1366 checks / failures=0
Current static chain: 54/54, failures=0
```

Build:

- `@inno/ui` build: PASS
- Web Portal typecheck: PASS
- Web Portal production build: PASS
- `git diff --check`: PASS
- existing Vite chunk-size advisory remains non-blocking.

## What Step 44B does not do

Step 44B intentionally does not:

- convert Organization/Locations to Tree;
- implement TreeGrid;
- refactor Positions into Dialog;
- split Access Scope routes;
- split Contracts detail/edit routes;
- migrate every legacy row action;
- restore hero illustrations;
- rename Assets User Profiles;
- add React Flow.

Those belong to the frozen Step 44C–44G sequence.

## Next

**Step 44C — Hierarchy Component Parity**

Implement production:
- `INNOTree`;
- `INNOTreeGrid`;
- keyboard / expand-collapse / selection contracts.

Then remediate:
- Organization Structure;
- Locations;
- Access Scope hierarchy browser.

Do not merge to `main` or deploy unless explicitly requested.
