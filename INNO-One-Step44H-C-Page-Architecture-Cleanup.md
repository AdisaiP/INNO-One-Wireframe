# INNO.One — Step 44H-C Remaining Page Architecture Cleanup

**Status:** COMPLETE — implementation, browser verification and visual review passed
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
main CSS = 105.43 kB / 17.96 kB gzip
```

Existing Vite large-chunk advisory only.
## Browser QA

The recovered test infrastructure was verified before rerunning the browser gates:
- PostgreSQL `172.10.1.58:5432` reachable,
- Keycloak `172.10.1.58:8080` reachable,
- local Platform API listening on `127.0.0.1:5080`,
- authenticated Chrome/CDP flow completes.

Dedicated H-C browser verification:

```text
step44h_c_browser_checks=145
step44h_c_browser_failures=0
step44h_c_browser_screenshots=38
```

Coverage at 1366 / 1024 / 768 includes:
- Software Baseline list/create/detail/edit ownership,
- Device Group create/edit dialogs,
- read-only Asset detail + dedicated editor + Change Owner dialog,
- Ticket Reassign dialog,
- Admin Apps Inspect drawer,
- retained Helpdesk SLA P05 layout,
- page-level horizontal overflow.

The current database contains zero Software Baseline records. The list empty state is verified against the real API, while Detail/Edit visual evidence uses a browser-only fetch fixture (`baseline_qa_visual`) that does not mutate PostgreSQL or Product data.

### Visual review

Affected H-C screenshots were opened and reviewed directly, not inferred only from browser metrics.

Reviewed evidence includes:
- Software Baseline Detail at 1366 and 768,
- Software Baseline Edit,
- Asset Edit at 768,
- Device Group Create dialog,
- Device Group Edit dialog,
- Ticket Reassign dialog,
- Admin Apps Inspect drawer.

Visual review found one real issue in the Admin Apps Inspect drawer: the generic two-column KV grid compressed metadata into narrow columns and broke words vertically. The drawer now uses a dedicated single-column metadata layout; the browser suite was rerun after the fix and the corrected screenshot was reviewed.

### Broad browser regression

```text
step42_routes=60
step42_browser_checks=1572
step42_browser_failures=0
```

The broad harness accepts the real Software Baseline empty collection as a valid state; Baseline Detail/Edit are covered by the dedicated H-C fixture QA because no real baseline row currently exists.

Design System browser regression:

```text
step42_2_design_system_checks=56
step42_2_design_system_failures=0
```

## Final verification

Final Step 44 static chain remains green:
- Step 44A = 97 / 97, current gaps = 0,
- Step 44B = 65 / 65,
- Step 44C = 40 / 40,
- Step 44D = 34 / 34,
- Step 44E = 35 / 35,
- Step 44F = 24 / 24,
- Step 44G = 46 / 46,
- Step 44H-A = 43 / 43,
- Step 44H final static = 34 / 34,
- Step 44H-B = 40 / 40,
- Step 44H-C = 51 / 51,
- `git diff --check` PASS,
- `@inno/ui` build PASS,
- Web Portal typecheck PASS,
- Web Portal production build PASS.

Step 44H-C is therefore COMPLETE.

Do not merge to `main` unless explicitly requested.
