# INNO.One — Step 29 React UI Parity / Frozen UI Port Pass

**Status:** in progress
**Branch:** `implementation/step29-react-ui-parity`
**Frozen source:** Design System V1.26 / UI Contract 1.20.0
**Backend/API/Data contracts:** unchanged from Step 28

## Goal

Bring the production React Web Portal back to the approved frozen prototype language without undoing Step 15–28 runtime behavior. The HTML prototype remains the visual/interaction source of truth; production data, permissions and API behavior remain authoritative.

## Non-negotiable invariants

- Preserve all Step 15–28 API calls, permission gates, runtime states and database behavior.
- Do not reintroduce fake actions only to match a screenshot.
- Implemented controls must remain real; unavailable frozen actions stay hidden or passive.
- Preserve Web Portal / Endpoint Agent / Android Mobile boundaries.
- No backend contract bump, database migration, merge or deploy in this step.
- Prefer shared `@inno/ui` and shell primitives over page-local visual forks.

## Port order

1. Production shell geometry, header, rail, contextual sidebar and responsive behavior. **DONE — browser regression 23/23.**
2. Shared React primitives: page header, buttons, status, collection toolbar/table, resource header, form/footer and states. **DONE — browser regression 75/75.**
3. Devices routes. **DONE — browser regression 61/61 + static parity guard.**
4. Assets routes. **NEXT.**
5. Helpdesk routes.
6. Profile and remaining currently implemented production routes.

Shell checkpoint restores icon-based global navigation, a functional global page search, the frozen 1366 geometry (56 / 60 / 216), and the frozen <=1180 contextual navigation overlay behavior. Production permissions and route availability remain authoritative.

## Canonical shell targets

At 1366px Web viewport:
- Platform Header = 56px.
- Global Rail = 60px.
- Contextual Sidebar = 216px.
- Canvas = #F7F8FA.
- Exactly one active global route and one active contextual route.
- No page-level horizontal overflow.

Responsive targets follow the frozen V1.26 behavior: 64/232 at <=1600, 60/216 at <=1366, and contextual navigation switches to an overlay at <=1180 (including 1024 and 768), with rail width 58 at <=1180, 54 at <=850 and 50 at <=680.

## Visual parity rule

Each React route already implemented in production must be mapped to its frozen HTML counterpart. Review layout hierarchy, typography, spacing, icon vocabulary, toolbar composition, table density, status treatment, action placement, responsive behavior and state presentation. Functional production-only information may remain when it is required by real authorization/evidence behavior, but it must use the frozen design language.

## Definition of Done

- Shell parity guard passes.
- All currently implemented React routes have a frozen-route mapping or an explicit justified production-only mapping.
- Shared primitives replace duplicated visual-only page CSS where practical.
- Web typecheck/build and .NET build remain green.
- Step 15–28 regression audits remain green.
- Representative React visual QA passes at 1366 / 1024 / 768 with 0 page overflow.
- Contact sheets or equivalent side-by-side review cover Devices, Assets, Helpdesk and shared shell.
- Working tree is clean after Step 29 checkpoint.

## Shared primitives checkpoint

Phase 2 moves frozen visual contracts into `@inno/ui` instead of duplicating them per page. The shared layer now owns Page/Header actions, buttons with busy state, typed UI states, status badges, collection header/toolbar, search/select controls, contained wide tables, pagination, resource headers and canonical editor footers.

Representative migrations prove reuse across module boundaries:
- Devices: `/devices` collection + Device Detail resource header.
- Assets: `/assets/inventory` collection.
- Helpdesk: `/helpdesk/automation` collection/page action + `/helpdesk/tickets/new` editor footer.
- Feedback: loading/error/permission states now use the shared state primitive.

Browser QA: **75 / 75**, 0 failures at 1366 / 1024 / 768. Primary table density remains 40px headers / 48px rows; x-wide tables scroll inside their own wrapper on narrow Web viewports; page-level overflow remains 0.

## Devices parity checkpoint

Phase 3 ports all production Devices routes back onto the frozen Devices patterns without exposing future/fake controls:
- `/devices`: real Discover/Add Device page actions, working Columns chooser, compact type/status/action treatment.
- `/devices/discovery`: real Run Scan page action and shared results collection.
- `/devices/groups`: static-group create action/editor and shared group collection; dynamic groups remain hidden until the rule engine exists.
- `/devices/groups/:groupId`: resource-detail hierarchy, canonical editor footer and shared member collection.
- `/devices/add`: frozen Agent Deployment layout with canonical editor footer and real enrollment generation.
- `/devices/:deviceId`: resource identity/icon, correct contextual navigation, and searchable/filterable Installed Software collection.

Frozen Remote/Terminal/Files and bulk Remote/Deploy/Move Group controls were not restored because the current production selection/action contracts do not support those interactions yet. Browser QA is **61 / 61** at 1366 / 1024 / 768; Device Group Detail is additionally protected by static parity checks when QA data has no visible groups.
