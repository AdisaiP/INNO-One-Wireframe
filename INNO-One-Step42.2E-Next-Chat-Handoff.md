# INNO.One — Step 42.2E Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.2e-resource-detail`
**Base Step 42.2D checkpoint:** `67d2873 refactor: normalize editor footer anatomy`
**Main remains:** `8e5be5e merge: integrate design system fidelity through step42.2B`
**Scope:** Resource Detail (P03)
**Backend/API changes:** none
**Do not merge this branch to `main` or deploy unless explicitly requested.**

## Canonical P03 anatomy

Step 42.2E normalizes production resource details around:

```text
Breadcrumb
  -> Resource identity + resource actions
  -> Status / summary
  -> Tabs
  -> Flat detail section or related collection
```

Shared `@inno/ui` additions:

- `INNOResourceSummary`
- `INNOResourceSummaryItem`

The shared summary is four columns at desktop / 1024, two columns at the 768 QA breakpoint, and stacks to one column below the existing narrow breakpoint.

Normalized P03 pages:

- Admin User Detail
- Device Detail
- Device Group Detail
- Asset Detail
- Asset Owner Detail
- Ticket Detail

`/helpdesk/automation/:ruleId` remains a P04 editor and is intentionally not treated as P03.

## Detail / edit ownership changes

Admin User:
- opens as read-only Resource Detail rather than an editor;
- Overview / Access tabs;
- `Edit Profile` is a resource action;
- edit mode owns Cancel / Save Profile in the canonical editor footer;
- tabs are hidden while editing so unsaved changes cannot be orphaned.

Asset:
- opens as read-only Resource Detail;
- Overview / Custom Fields / Ownership tabs;
- `Edit Asset` is a resource action;
- edit mode keeps Overview / Custom Fields available but hides Ownership until Save/Cancel;
- Cancel restores persisted asset/custom-field values.

Device Group:
- Overview / Members tabs;
- `Edit Group` enters an explicit edit state;
- Cancel / Save Changes remain in the editor footer;
- tabs are hidden while editing.

Asset Owner:
- Overview / Assets tabs;
- Platform-owned identity remains read-only.

Ticket:
- Conversation / Activity / Details tabs replace the previous long stacked detail layout;
- Resolve / Reassign remain resource-level actions;
- Reassign uses Start(Cancel) / End(Reassign) footer ownership;
- inactive Ticket tab panels are explicitly hidden even when their inner layout uses grid.

Device:
- existing Overview / Software semantics remain;
- CPU / Memory / Disk / Last seen moved to the shared resource summary;
- Offline remains a contextual banner while cached detail remains visible.

## Removed / reduced one-off detail layout

Obsolete page-specific detail CSS removed:

- `.admin-user-layout`
- `.ticket-detail-grid`
- `.helpdesk-detail-stats`
- `.ticket-resource-actions`
- `.helpdesk-resource-head`

Visual review found and fixed one real issue that DOM geometry alone did not catch: Ticket `.panel-stack { display:grid }` could override the HTML `hidden` state. `.ticket-detail-tabs [hidden]` now enforces inactive-panel visibility correctly, and dedicated browser QA guards it.

## QA

Dedicated Step 42.2E browser QA at 1366 / 1024 / 768:

```text
step42_2e_detail_checks=250
step42_2e_detail_failures=0
```

It dynamically discovers all six real P03 routes and verifies:
- breadcrumb / identity / resource-action ownership;
- exactly four shared summary items;
- responsive summary columns;
- one active tab and real tab switching;
- no page-level horizontal overflow;
- default detail vs explicit edit mode;
- Cancel/Save footer ownership;
- edit-safe tabs;
- Ticket inactive-panel visibility;
- Ticket Reassign ownership.

Regression gates:

- full static audit chain: **48/48**, failures=0
- Step 42.2A scroll QA: **12/12**, failures=0
- Step 42.2B surface QA: **117/117**, failures=0
- Step 42.2C list/collection QA: **213/213**, failures=0
- Step 42.2D editor/settings QA: **183/183**, failures=0
- Design System browser QA: **56/56**, failures=0
- broad Production browser regression: **51 routes / 1366 checks / 0 failures**
- `@inno/ui` build: PASS
- web-portal typecheck: PASS
- web-portal production build: PASS
- `git diff --check`: PASS before checkpoint

Step 31's older Admin User shell guard was updated to recognize the canonical P03 resource-detail shell rather than requiring the old `INNOPage` wrapper.

## Next step

# Step 42.2F — States

Primary goals from the existing Step 42.2 roadmap / State Coverage Contract:

- normalize Empty / No Results / Loading / Error / Permission / Offline / Partial states;
- preserve collection heading and controls for collection-local Empty / No Results;
- keep collection-local states compact inside the owning collection;
- keep Offline as contextual banner when cached detail remains meaningful;
- preserve successful work during Partial Failure and retry only failed work where supported;
- keep loading/error/accessibility semantics aligned with the State Coverage Contract;
- validate representative states at 1366 / 1024 / 768.

Do not merge to `main` or deploy unless explicitly requested.
