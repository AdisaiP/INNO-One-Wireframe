# INNO.One — Step 44B Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step44b-shared-interaction-foundations`
**Base:** `892b2a6 docs: freeze screen interaction architecture`
**Scope:** Shared Interaction Foundations
**Frozen Design System:** V1.26
**Frozen UI Contract:** 1.20.0

## What Step 44B implemented

Shared Production primitives now exist in `@inno/ui`:

- `INNORowActions`
- `INNODialog`
- `INNODrawer`
- `INNOPurposeNote`
- `INNOInfoCallout`
- integrated `INNOEditorFooter` with optional `docked`
- shared spacing tokens for surface / form / table rhythm

`react-dom` is now a peer/development dependency of `@inno/ui` because menus/dialogs/drawers portal to `document.body`.

## Row actions

`INNORowActions` supports:
- direct single action;
- multiple-action More menu;
- destructive tone;
- busy / disabled state;
- portal rendering outside table overflow containers;
- viewport placement;
- keyboard Arrow/Home/End;
- Escape;
- outside click;
- close on scroll/resize;
- focus restoration.

Admin Integrations `Test` is the first real Product migration.

Do not claim the global row-action inconsistency is complete yet. Legacy `Select/Open` actions remain for route-specific remediation.

## Dialog / Drawer

Both shared overlays provide:
- portal rendering;
- dialog semantics;
- labelled title and optional description;
- initial focus / `data-autofocus`;
- Tab focus trap;
- Escape close;
- body scroll lock;
- focus restoration;
- optional backdrop-close policy.

Drawer keeps context visible at tablet width and becomes full-width below 680px.

Internal Design System now uses these shared primitives; the old custom demo overlay implementation and obsolete CSS were removed.

## Passive explanation vs application state

Passive explanatory copy must use Purpose Note / Info Callout, not `INNOState`.

Migrated:
- Admin Integrations
- Admin Audit
- Branding
- Platform Settings
- Roles
- Security
- Search
- Agent Deployment
- Automation Rule
- Business Calendar
- Helpdesk SLA
- Profile
- Ticket Create

Legacy page-local `.purpose-note` markup is removed.

## Editor footer / spacing

Default `INNOEditorFooter`:
- normal flow;
- transparent;
- no rounded card;
- no floating shadow;
- top divider;
- visually attached to the owning editor.

`docked` is opt-in only.

Removed old page-local footer chrome from:
- Agent Deployment
- Ticket Create
- Software Baselines
- standalone / QR action footer patterns

Asset QR Labels now uses canonical footer anatomy.

Shared spacing tokens now own:
- surface padding;
- form gap;
- table cell spacing;
- common spacing scale;
- 36px control height.

Business Calendar's 3-column Holiday Exceptions table no longer forces a wide local scroller.

## Step 44A gap status

Step 44A still models all original 9 issue classes.

After Step 44B:

```text
step44a_reported_gap_classes=9
step44a_current_gap_classes=6
```

Remediated:
- floating-card editor footer
- explanatory state misuse
- baseline spacing drift

Still present:
- permanent side-card form/detail architecture
- legacy row-action inconsistency
- hero illustration parity
- Workflow Canvas missing
- Tree / TreeGrid missing
- Assets User Profiles IA ambiguity

## QA

Dedicated static:

```text
step44b_checks=65
step44b_failures=0
```

Dedicated browser:

```text
step44b_browser_checks=65
step44b_browser_failures=0
```

Other regression gates:

```text
Step 42.2G responsive = 77/77
Design System browser = 56/56
Broad Production = 51 routes / 1366 checks / 0 failures
Current static chain = 54/54 / 0 failures
```

Build:
- `@inno/ui` build PASS
- Web Portal typecheck PASS
- Web Portal production build PASS
- `git diff --check` PASS
- only existing Vite chunk-size advisory remains

## Broad browser QA hardening

`step42-production-ux-browser-qa.py` was still using the old route-ready predicate and intermittently failed Workspace `/`.

It now waits for:
- `.inno-production-shell`
- `.prod-main`
- `.inno-page` or `.workspace-home-page`
- non-zero main width
- no boot/loading state
- 20 second timeout

This matches the proven Step 42.2H readiness approach.

Historical `step42_1-detail-polish-audit.py` was updated to assert the Step 44B integrated footer contract instead of requiring obsolete floating-card CSS.

## Screenshots inspected

Dedicated Step 44B screenshots include:
- Integrations at 1366 / 1024 / 768
- Business Calendar at 1366 / 768
- Design System Dialog at 1366
- Design System Drawer at 1366 / 768

Visual review also caught and removed the unnecessary Business Calendar local horizontal scrollbar.

## Next

**Step 44C — Hierarchy Component Parity**

Implement:
- `INNOTree`
- `INNOTreeGrid`
- keyboard navigation
- expand/collapse
- selection semantics

Then apply them to:
- Organization Structure
- Locations
- Access Scope hierarchy browser

Do not merge to `main` or deploy unless explicitly requested.
