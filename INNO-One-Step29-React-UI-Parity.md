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
2. Shared React primitives: page header, buttons, status, collection toolbar/table, resource header, form/footer and states. **NEXT.**
3. Devices routes.
4. Assets routes.
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
