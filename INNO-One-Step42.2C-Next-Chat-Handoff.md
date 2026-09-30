# INNO.One — Step 42.2C Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2c-list-collections`
**Base main checkpoint:** `8e5be5e merge: integrate design system fidelity through step42.2B`
**Scope:** List / Collection Pages
**Backend/API changes:** none
**Main merge:** Step 42.2B and earlier are already merged/pushed to `main`.
**Do not merge this Step 42.2C branch or deploy unless explicitly requested.**

## What changed

Step 42.2C normalizes Production collection pages around one anatomy:

```text
Page Header
  -> Collection Heading
  -> Search / Filters / Columns / supporting meta
  -> Table / Operational List
  -> Collection-local State / Pagination
```

Shared `@inno/ui` additions:

- `INNOToolbarMeta` replaces page-local `collection-scope` notes on list toolbars.
- `INNOTableWrap` now accepts `stickyAction` for constrained master-detail tables.
- `.inno-row-action` provides one compact named row-action treatment.
- numeric table cells use right alignment with tabular numerals.
- at narrow Web width, Search owns the first toolbar row and wide tables scroll horizontally while Action remains accessible at the right edge.

Named row actions are now explicit `Open` or `Select` instead of ambiguous chevrons across Devices, Groups, Assets, Tickets, Admin Users, Access Scopes, Organization/Positions, Audit, Automation, Software Baselines/Licenses and Contracts.

Operational queue semantics are preserved: the Helpdesk queue row remains the navigation target; its decorative trailing chevron is not turned into a competing action.

Collection-local empty/no-result/loading/error ownership remains inside the collection.

## Regression / guard improvements

The frozen V1.26 snapshot and manifest were **not changed**.

After Windows branch/main checkout, the frozen SHA audit exposed that the existing manifest was generated from CRLF source bytes while the committed frozen snapshot can materialize as LF. Git showed no frozen file modifications and all 23 manifest entries matched after LF -> CRLF canonicalization.

`step42_2-design-system-baseline-audit.py` now accepts either:
- exact frozen bytes; or
- the CRLF-canonical equivalent.

Semantic content edits still fail the integrity guard.

Two existing browser regressions were also made readiness-based instead of fixed-delay:
- Step 42.2A waits for the long Design System page to actually overflow before testing scroll ownership.
- Step 42.2B waits for standard surfaces to mount before measuring them.

No Product UI behavior was changed for those timing fixes.

## QA

Dedicated Step 42.2C browser QA at 1366 / 1024 / 768:

```text
step42_2c_collection_checks=213
step42_2c_collection_failures=0
```

Other gates:

- full static audit chain: **46/46**, failures=0
- Step 42.2A scroll QA: **12/12**, failures=0
- Step 42.2B surface QA: **117/117**, failures=0
- Design System browser QA: **56/56**, failures=0
- broad Production browser regression: **49 routes / 1323 checks / 0 failures**
- `@inno/ui` build: PASS
- web-portal typecheck: PASS
- web-portal production build: PASS
- `git diff --check`: PASS before checkpoint

Visual review completed on representative Devices, Assets, Tickets and Admin Access Scopes pages at desktop and narrow Web widths.

## Next step

# Step 42.2D — Create / Edit / Settings Pages

Primary goals:

- normalize P04/P05 editor anatomy;
- keep Save/Create/Schedule in the canonical editor footer;
- remove remaining page-local form action placement;
- normalize section rhythm, validation placement and destructive-action ownership;
- validate Create/Edit/Settings pages at 1366 / 1024 / 768.

Do not merge to `main` or deploy unless explicitly requested.
