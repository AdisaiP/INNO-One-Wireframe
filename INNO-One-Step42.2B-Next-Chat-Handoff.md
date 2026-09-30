# INNO.One — Step 42.2B Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2-design-system-baseline`
**Scope:** Surface / Card Hierarchy
**Base checkpoint:** `c232f12 fix: stabilize shell scroll ownership`
**Backend/API changes:** none
**Do not merge main. Do not deploy.**

## What changed

Step 42.2B establishes one shared Production surface hierarchy:

```text
Page
  -> Section / Collection
       -> Inset
```

The frozen Design System rule remains unchanged: use border and surface separation first; reserve strong shadows for overlays.

Implementation:

- Page uses the application background and does not become a card.
- Standard Section (`.prod-panel`) uses white surface + 1px border + 12px radius + no shadow.
- Standard Collection (`.collection-card` / shared `.inno-collection`) uses white surface + 1px border + 12px radius + no shadow.
- Inset summary cells use `var(--ds-surface-subtle)`, no border, 8px radius and no shadow.
- Notification feed/stat surfaces and Branding shell preview no longer use standard-card shadows.
- Overlay/focus shadows are intentionally preserved.
- Collection-local Empty / No Results states remain flat inside their owning collection.
- No direct nested standard Section/Collection surfaces were found in the representative DOM scan; the main issue was every surface visually presenting as a floating card.

Shared primitive updated:

`production/packages/ui/src/styles.css`

Production hierarchy tokens/rules updated:

`production/apps/web-portal/src/shell.css`

## QA

Added:

- `step42_2b-surface-hierarchy-audit.py`
- `step42_2b-surface-browser-qa.py`

Dedicated surface QA validates Workspace, Profile, Notifications, Admin Access Scopes, Helpdesk SLA, Devices and dynamic Device Detail at 1366 / 1024 / 768.

Result:

```text
step42_2b_surface_checks=117
step42_2b_surface_failures=0
```

Static regression:

```text
STATIC_TOTAL=45
STATIC_FAILED=0
```

Other regression:

- `@inno/ui` build: PASS
- web-portal typecheck: PASS
- web-portal build: PASS
- Design System browser QA: 56/56, failures=0
- Step 42.2A scroll QA: 12/12, failures=0
- broad Production browser regression final rerun: 48 routes / 1305 checks / 0 failures
- `git diff --check`: PASS

The first broad regression run had one transient `ready /` timing miss immediately after Keycloak login; a complete rerun passed with zero failures. No product code was changed for that transient harness timing.

Visual review completed on representative 1366 / 1024 / 768 screenshots, including Workspace, Device Detail and Notifications.

## Next step

# Step 42.2C — List / Collection Pages

Primary goals:

- normalize primary collection anatomy across Devices, Groups, Assets, Tickets and Admin lists;
- enforce Page Header -> Collection Heading -> Search/Filters/Columns/Export -> Table/List -> Footer/state;
- keep row actions compact and named;
- keep collection-local states inside the collection;
- remove remaining list-page one-off toolbar/table patterns before moving to Create/Edit normalization.

Do not merge to `main` or deploy unless explicitly requested.
