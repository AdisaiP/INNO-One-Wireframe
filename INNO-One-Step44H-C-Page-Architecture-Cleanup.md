# INNO.One — Step 44H-C Remaining Page Architecture Cleanup

**Status:** IMPLEMENTED — browser verification pending test-infra recovery  
**Branch:** `ux/step44h-c-page-architecture-cleanup`  
**Base:** `190a047 feat: make licenses roles and inventory query dynamic`  
**Frozen Design System:** V1.26  
**Frozen UI Contract:** 1.20.0  
**Current route definitions:** 61

## Goal

Perform a second route-by-route architecture pass specifically for pages that still mixed collection/detail/editor jobs in one visible surface after Step 44H-B.

The pass applies the existing form-surface rule:
- short 1–5 field actions -> focused Dialog/Drawer,
- multi-section or conditional editors -> dedicated P04 route,
- resource details stay read-only unless editing is the page's primary job.
## Remediated surfaces

### Software Baselines

Previous:
- list,
- auto-selected baseline,
- evaluation results,
- create/edit definition form,
all on one route.

Current:

```text
/assets/software-baselines
  P02 list only

/assets/software-baselines/new
  P04 create route

/assets/software-baselines/:baselineId
  P03 detail + evaluation results

/assets/software-baselines/:baselineId/edit
  P04 edit route
```

The existing singular baseline GET endpoint is reused; no backend change was required.
### Device Groups

`/devices/groups`
- the collection remains mounted,
- **New Device Group** opens a focused three-field dialog,
- the old embedded create panel is removed.

`/devices/groups/:groupId`
- resource detail and tabs remain stable,
- **Edit Group** opens a focused three-field dialog,
- editing no longer replaces the Overview section.

### Asset Detail

`/assets/:assetId`
- read-only resource detail,
- **Edit Asset** navigates to `/assets/:assetId/edit`,
- **Change Owner** is a separate focused business-action dialog,
- custom fields are read-only on detail.

`/assets/:assetId/edit`
- dedicated P04 multi-section editor,
- core Asset metadata + dynamic custom fields,
- canonical editor footer,
- ownership is intentionally excluded from generic Edit Asset.
### Ticket Detail

The two-field **Reassign** action now opens an `INNODialog`.

The old inline reassign panel between resource summary and detail tabs is removed, so opening Reassign no longer shifts the resource-detail layout.

### Admin Apps

The Module Registry remains list-first.

Technical **Inspect** no longer expands native `<details>` inside each row. It opens a focused `INNODrawer` with:
- status,
- route,
- entry permission,
- dependencies,
- capabilities,
- events.

### Helpdesk SLA

Reviewed but intentionally retained as P05 Settings.

Reason:
- SLA policy configuration is the primary job of the page,
- the Live SLA Monitor is supporting operational context,
- there is no second competing create/detail job that requires another route in the current scope.
## Architecture result

Current matrix:

```text
route definitions = 61

P01 = 4
P02 = 23
P03 = 9
P04 = 10
P05 = 7
P06 = 1
P07 = 2
P08 = 2
P09 = 0
P10 = 3
```

No P09 Master-Detail route remains after the cleanup.

The matrix and Step 44A audit were updated to describe the current Production architecture rather than preserving superseded embedded-editor allowances.
## Static / build QA

Dedicated H-C static:

```text
step44h_c_checks=51
step44h_c_failures=0
```

Architecture:

```text
step44a_routes=61
step44a_current_gap_classes=0
step44a_checks=97
step44a_failures=0
```

Relevant regression gates:
- Step 44E visual parity = 35 / 35
- Step 44H-A architecture/spacing = 43 / 43
- `git diff --check` PASS

Frontend:
- `@inno/ui` build PASS
- Web Portal typecheck PASS
- Web Portal production build PASS

Current production bundle:

```text
main JS  = 693.68 kB / 179.80 kB gzip
main CSS = 105.27 kB / 17.93 kB gzip
```

Existing Vite large-chunk advisory only.
## Browser QA status

A dedicated browser harness was added:

```text
step44h-c-page-architecture-cleanup-browser-qa.py
```

It is prepared to verify at 1366 / 1024 / 768:
- Software Baseline list/detail/create/edit ownership,
- Device Group create/edit dialogs,
- read-only Asset detail + dedicated editor + Change Owner dialog,
- Ticket Reassign dialog,
- Admin Apps Inspect drawer,
- retained Helpdesk SLA P05 layout,
- page-level horizontal overflow.

The harness itself passes Python syntax compilation.

Runtime execution is currently blocked by external test infrastructure:
- PostgreSQL `172.10.1.58:5432` times out,
- Keycloak `172.10.1.58:8080` is unreachable from the Windows test machine,
- local Platform API therefore cannot finish startup,
- the Chrome QA tab redirects to the unreachable Keycloak host.

Because of this infrastructure outage, Step 44H-C is **not marked browser-verified or fully COMPLETE yet**.

Do not report broad Production browser regression or visual screenshot review as passed until the infra host is reachable and the browser gates are rerun.
## Remaining verification

Once `172.10.1.58` is reachable again:

1. run `step44h-c-page-architecture-cleanup-browser-qa.py`,
2. visually inspect the generated 1366 / 1024 / 768 screenshots,
3. run `step42-production-ux-browser-qa.py` with the expanded route discovery,
4. run `step42_2-design-system-browser-qa.py` separately,
5. rerun the full Step 44 static chain,
6. mark Step 44H-C COMPLETE only if those gates pass.

No merge to `main` should occur before that browser verification unless explicitly requested.
