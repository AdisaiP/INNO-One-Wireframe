# INNO.One — Step 40 Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step40-profile-settings`
**Scope:** Profile & Settings self-service business profile
**Frozen UX baseline:** Design System **V1.26** / UI Contract **1.20.0**
**Implementation Contract:** **0.30.0**

## 1. What Step 40 implemented

Step 40 turns the frozen Profile & Settings self-update contract into a real production flow.

Canonical route:

```text
/profile
```

Permission / scope:

```text
platform.workspace.access
self
```

Public API:

```http
GET   /api/v1/platform/me
PATCH /api/v1/platform/me/profile
```

Meeting remains intentionally deferred.
## 2. Profile ownership boundary

Keycloak remains the authentication and identity-provider boundary.

INNO.One Platform owns the business-profile projection linked by `keycloak_subject`.

Step 40 exposes only these self-editable fields:

- Phone
- Office

The following stay organization-managed / read-only on Profile & Settings:

- Full name
- Email
- Employee ID
- Organization
- Position
- Location
- Roles and effective permissions
- SSO / sign-in state
- Time zone

The update request contract therefore contains only:

```text
phone
office
```

No admin-managed identity or authorization field can be changed through the self-profile endpoint.
## 3. API behavior

Implementation:

```text
production/services/platform-api/src/Modules/Platform/Api/PlatformEndpoints.cs
```

Added:

```http
PATCH /platform/me/profile
```

Behavior:

- requires `platform.workspace.access`
- resolves the authenticated INNO.One user through the existing access evaluator
- updates only that user's `platform.user_profiles` row
- accepts Phone up to 64 characters
- accepts Office up to 120 characters
- trims supplied values
- whitespace-only values clear the optional field
- rejects a request with no supported editable fields
- increments the existing profile version
- updates `UpdatedAt`
- returns the canonical current Profile response

No new table, entity or migration was introduced.
## 4. Production Web UI

Updated:

```text
production/apps/web-portal/src/pages/ProfilePage.tsx
production/apps/web-portal/src/api/client.ts
production/apps/web-portal/src/shell.css
```

Profile & Settings now includes a real **Personal contact details** editor.

Editable controls:

- Phone
- Office

The form provides:

- dirty / saved state
- Save profile action
- busy submit protection
- API error feedback
- save success feedback
- immediate React Query profile-cache update after save
- responsive one-column form behavior at narrower widths

The frozen Profile description remains unchanged to preserve Step 29 parity.
## 5. Unsupported preferences remain hidden

The prototype contains conceptual personal preferences, but the production persistence contract is not defined yet.

Step 40 therefore does **not** expose:

- Email notifications preference
- Desktop notifications preference
- Compact tables preference
- Interface language preference

The production page explains that those controls remain unavailable until a persistence contract exists.

This avoids presenting local-only toggles that look saved but are not durable.
## 6. Contract version

Runtime contract version:

```text
Implementation Contract 0.30.0
```

Frozen UX remains unchanged:

```text
Design System V1.26
UI Contract 1.20.0
```

Step 40 does not change the frozen prototype design-system version or route architecture.
## 7. Static QA

New audit:

```text
step40-profile-settings-audit.py
```

Result:

```text
issues=0
```

The audit guards:

- PATCH profile route exists
- self permission is enforced
- request contract exposes only Phone / Office
- organization-managed identity fields are not self-editable
- field length validation exists
- production client uses PATCH
- production page exposes the real editor
- unsupported preference controls remain hidden
- frozen UX versions remain V1.26 / 1.20.0
- runtime implementation contract is at least 0.30.0
### Full static regression

Steps 15–40 plus the frozen UX audit chain:

```text
STATIC_TOTAL=39
STATIC_FAILED=0
```

Included:

- Step 15–40 implementation audits
- Action/Layout
- Accessibility
- Availability
- Language/Terminology
- Interaction/Feedback
- Table/List Density
- State Coverage
- Design System
- Component Consistency
- Density/Spacing
- Interaction Consistency
- Responsive Pass
- Final Visual

On Windows, the legacy Step 17 audit requires `PYTHONUTF8=1` because its default `Path.read_text()` otherwise uses the local cp1252 code page.
## 8. Build / EF QA

TypeScript typecheck:

```text
PASS
```

Vite production build:

```text
PASS
```

Existing warning only:

```text
application JS chunk ~603 kB before gzip exceeds the 500 kB warning threshold
```

.NET solution build:

```text
0 warnings
0 errors
```

The repository pins .NET SDK `10.0.103`, while this Windows machine currently has `10.0.201`.
For QA only, `global.json` was temporarily switched to the installed SDK inside a try/finally command and restored immediately afterward.
EF pending-model check for `PlatformDbContext`:

```text
No changes have been made to the model since the last migration.
EF_EXIT=0
```

No Step 40 migration is required.

`git diff --check` passes.
## 9. Runtime QA

New:

```text
step40-runtime-qa.py
```

Verified against real PostgreSQL + Keycloak on:

```text
172.10.1.58
```

Result:

```text
23 / 23 PASS
```

Coverage includes:

- health reports Implementation Contract 0.30.0
- current profile loads for admin and HR viewer
- authentication is required for PATCH
- empty unsupported request is rejected
- over-length Phone is rejected
- organization-managed `fullName` payload is rejected
- admin Phone / Office update succeeds
- persisted values are returned by a fresh GET
- name/email identity stays unchanged
- HR viewer can update only the viewer's own profile
- viewer update cannot alter the admin profile
- both test users are restored to their original values after QA
## 10. Browser / responsive QA

New:

```text
step40-browser-qa.py
```

Real Keycloak login tested at:

- 1366
- 1024
- 768

Result:

```text
51 / 51 PASS
```

Verified:

- Profile & Settings renders at `/profile`
- global rail active state is correct
- Account contextual navigation active state is correct
- exactly two editable profile inputs are present
- Save is disabled before a change
- Save enables after a local field edit
- no page-level horizontal overflow
- main content stays inside the viewport
- unsupported preference controls are absent
- frozen organization-managed messaging remains visible
Screenshots:

```text
qa-step40-browser-1366-1024-768/profile-1366.png
qa-step40-browser-1366-1024-768/profile-1024.png
qa-step40-browser-1366-1024-768/profile-768.png
```

All three were visually inspected against the current V1.26 production bridge.

Desktop keeps the expected two-column profile/security hierarchy.
At 1024 and 768 the layout collapses cleanly and the Phone / Office editor becomes one column without action overlap or horizontal overflow.
## 11. Git integration context

Before Step 40 started, Step 39 was explicitly merged to `main` and pushed.

Main merge checkpoint:

```text
a7c785a merge: integrate workspace home through step39
```

Step 40 was then created from that updated main on:

```text
implementation/step40-profile-settings
```

Do not merge Step 40 to main unless explicitly requested.

Do not deploy.
## 12. Next contract-backed Platform slice

After Workspace Home and Profile & Settings, the remaining unimplemented common Platform operation contract is:

# Step 41 — Asynchronous Operation Resource

Frozen API:

```http
GET /api/v1/operations/{operationId}
```

Frozen states:

```text
queued
running
succeeded
failed
partial
```

Before implementation:

1. inspect which existing commands already return operation IDs;
2. define one Platform-owned operation read-model boundary rather than module-specific polling shapes;
3. bind reads to the operation owner / originating resource authorization;
4. do not expose filesystem paths, provider secrets or raw engine payloads;
5. preserve module ownership of the underlying job;
6. keep Meeting deferred unless separately resumed.

Meeting remains intentionally deferred.
