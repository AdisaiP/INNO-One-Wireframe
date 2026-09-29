# INNO.One — Step 42.1 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `ux/step42.1-wireframe-fidelity`
**Scope:** Wireframe Fidelity Pass
**Frozen UX baseline:** Design System **V1.26** / UI Contract **1.20.0**
**Implementation Contract:** **0.31.0** (unchanged)

## 1. Why Step 42.1 exists

Step 42 made Production React structurally consistent and standardized the icon system, but the user correctly identified that the running application still did not visually resemble the original frozen wireframes closely enough.

Step 42.1 therefore changes the acceptance model:

```text
wireframe HTML
      vs
Production React
      ↓
side-by-side visual + geometry comparison
```

The canonical comparison width is 1366px, followed by responsive verification at 1024 / 768.

This is an UX/UI-only pass. No backend/API/database contract was changed.
## 2. Shared fidelity baseline

Shared Production UI was reconciled to the final frozen values instead of older intermediate values.

Key restored values include:

- body font size 14px
- body line-height 1.45
- content max width 1520px
- canonical page padding
- page-heading vertical rhythm
- resource breadcrumb height/rhythm
- resource header spacing
- stat-strip spacing
- panel/card radius and density
- contextual rail/sidebar density
- table/list visual density

At 1366px the canonical page gutter is aligned to the frozen 24px / 16px / 32px pattern.
## 3. Workspace fidelity

Workspace Home was moved back toward `workspace-v2.html`.

Changes include:

- restored original `workspace-welcome.svg` illustration
- restored hero proportions and gradient treatment
- restored Your Apps as a supporting section rather than a large enclosing card
- desktop app grid restored to five columns
- 1024 layout uses three columns
- narrow layout collapses to one column
- Continue Working / Needs Attention ratio restored toward 1.25 / .75
- compact feed rhythm restored

Production asset:

```text
production/apps/web-portal/public/illustrations/workspace-welcome.svg
```
## 4. Admin Overview fidelity

Admin Overview no longer presents every administration destination inside one generic Collection.

The original wireframe language is restored:

```text
stat strip
group heading
3-column tile grid
semantic tile icon
title + supporting copy
```

Groups currently include:

- Organization & access
- Platform

Tiles remain permission-driven and only link to real Production routes.
## 5. Notifications fidelity

Production had introduced an extra summary strip and denser notification rows that were not present in the frozen wireframe.

Step 42.1:

- removes the extra notification stat strip
- restores feed + 260px supporting side column on desktop
- reduces notification mark size
- removes duplicated module-label copy
- removes the extra unread-dot column
- restores compact row rhythm

Unsupported notification preference controls were not invented.
## 6. Profile fidelity

Profile keeps the real Step 40 self-service boundary:

```text
Phone
Office
```

and organization-managed identity remains read-only.

The visual proportions were reconciled:

- profile/security column ratio
- panel stack spacing
- key/value row density
- settings row layout

The frozen prototype contains preference concepts, but Production still does not expose fake persistence for unsupported preferences.
## 7. Agent Deployment fidelity

`/devices/add` now follows `device-add.html` more closely.

The page retains the real Production enrollment behavior while restoring:

- original `device-setup.svg` hero illustration
- frozen hero proportions
- 2-column setup/help composition
- simple card padding instead of an extra nested panel header
- `How Enrollment Works` supporting section
- primary action copy `Generate Installer`

Production asset:

```text
production/apps/web-portal/public/illustrations/device-setup.svg
```
## 8. Ticket Create fidelity

`/helpdesk/tickets/new` was aligned to `ticket-new.html`.

Restored patterns include:

- Helpdesk → Tickets → New ticket breadcrumb
- two-column create layout
- numbered section pattern
- Describe the issue
- Add context
- advanced routing disclosure
- frozen-style editor footer geometry

Production continues to expose only supported real controls.

The pass does **not** invent unsupported Related Asset or Routing Preview behavior.
## 9. Resource Detail fidelity

A shared real tab primitive was added:

```text
INNOSurfaceTabs
```

Tabs are only exposed when the corresponding Production content exists.

Device Detail:

```text
Overview
Software
```

Asset Detail:

```text
Overview
Custom Fields
Ownership
```

The tabs switch real existing content; they are not decorative/fake controls.

Resource breadcrumbs were also restored to the frozen 30px rhythm so resource headers, stats and detail content align vertically with the original wireframes.
## 10. Helpdesk Ticket Detail

Ticket Detail already matched the frozen 2-column composition closely.

The remaining stat-strip vertical drift was corrected so the detail body starts at the same visual rhythm as the frozen ticket wireframe.

The underlying ticket functionality and API behavior were not changed.
## 11. Measured geometry evidence

Step 42.1 used live DOM geometry comparison at 1366px rather than relying only on static audits.

Examples after reconciliation:

Agent Deployment hero:

```text
wireframe:  x=292 y=80 w=1058 h=174
production: x=292 y=80 w=1058 h=174
columns:    774px / 220px
```

Ticket Create:

```text
wireframe main layout y=203
production main layout y=204

step badge:
wireframe 24x24
production 24x24

editor footer:
wireframe h=58 padding=10x12 radius=12
production h=58 padding=10x12 radius=12
```
Device Detail:

```text
resource header y=118
stat strip y=181
tabs y=283
detail grid y=336
```

Production now follows the same vertical anchors.

Differences that remain are driven by real Production content/availability, not arbitrary shell drift.
## 12. Browser QA

Broad Production regression:

```text
routes = 44
checks = 1233
failures = 0
```

Tested at:

- 1366
- 1024
- 768

Coverage includes:

- route readiness
- horizontal overflow
- viewport bounds
- global/context navigation
- icon semantics
- state semantics
- runtime ErrorState detection
Detail regression:

```text
routes = 7
checks = 156
failures = 0
```

Representative details:

- Admin User
- Device
- Device Group
- Asset
- Asset Owner
- Ticket
- Automation Rule

Fidelity-specific browser QA:

```text
step42_1-browser-qa.py
checks = 96
failures = 0
```

It verifies:

- Workspace illustration + responsive app columns
- grouped Admin tiles + semantic icons
- Notifications layout and removed extra summary strip
- Agent Deployment illustration/card/action
- Ticket Create breadcrumb/footer
- Device real tab switching
- Asset real tab switching
- no overflow at 1366 / 1024 / 768
## 13. Static regression

Step 42.1 audit:

```text
step42_1-wireframe-fidelity-audit.py
issues=0
```

Full static regression:

```text
STATIC_TOTAL=42
STATIC_FAILED=0
```

This includes implementation Steps 15–42.1 plus the frozen UX audit chain.

`git diff --check` passes. The Windows checkout reports only the existing LF→CRLF informational warning on TicketCreatePage.
## 14. Frontend build

Final sequence:

```text
@inno/ui build       PASS
web-portal typecheck PASS
web-portal build     PASS
```

Vite output:

```text
CSS ~81.7 kB
JS  ~643.0 kB
gzip ~167.5 kB
```

The existing >500 kB bundle warning remains and should be treated as a later performance/code-splitting task rather than solved by reverting shared UI fidelity.
## 15. Contract/version boundary

Step 42.1 does not change frozen versions:

```text
Design System           V1.26
UI Contract             1.20.0
Implementation Contract 0.31.0
```

No database schema or backend contract changed, so no Step 42.1 migration is required.
## 16. React Flow decision remains unchanged

Do not add React Flow merely for visual fidelity.

The frozen direction remains:

```text
@xyflow/react
ELK.js
INNOWorkflowCanvas
```

only when a real editable branching workflow exists.

The current Helpdesk Automation editor remains a bounded:

```text
Trigger
  ↓
Condition
  ↓
Primary Action
```

form/editor.
## 17. Next feature slice

The next feature remains:

# Step 43 — Inventory Query

Expected Production shape:

```text
Saved Queries
Query Builder
Run Query
Shared Operation polling
Results
```

Step 43 should consume the Step 41 shared operation resource.

Do not introduce React Flow for Inventory Query unless the frozen UX is explicitly redesigned into a graph, which it currently is not.

Meeting remains deferred.

Do not merge Step 42.1 to main unless explicitly requested.
Do not deploy.
