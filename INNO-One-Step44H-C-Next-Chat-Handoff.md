# INNO.One — Step 44H-C Next Chat Handoff

**Status:** IMPLEMENTED — browser verification pending test-infra recovery  
**Branch:** `ux/step44h-c-page-architecture-cleanup`  
**Base:** `190a047 feat: make licenses roles and inventory query dynamic`  
**Frozen Design System:** V1.26  
**Frozen UI Contract:** 1.20.0  
**Current route definitions:** 61

## Read first

```text
INNO-One-Step44H-C-Page-Architecture-Cleanup.md
INNO-One-Step44H-B-Next-Chat-Handoff.md
INNO-One-Step44A-Screen-Interaction-Architecture.md
inno-step44a-screen-interaction-matrix.json
```
## Current implementation

### Software Baselines
- list-only `/assets/software-baselines`
- create `/assets/software-baselines/new`
- detail/evaluation `/assets/software-baselines/:baselineId`
- edit `/assets/software-baselines/:baselineId/edit`

### Device Groups
- New Device Group -> Dialog
- Edit Group -> Dialog
- list/detail remain mounted while overlays are open

### Assets
- `/assets/:assetId` is read-only detail
- `/assets/:assetId/edit` is the multi-section editor
- Change Owner -> separate Dialog

### Ticket Detail
- Reassign -> Dialog
- inline reassign panel removed

### Admin Apps
- Inspect -> Drawer
- native inline `<details>` removed

### Helpdesk SLA
- reviewed and deliberately remains P05 Settings
- Live SLA Monitor remains supporting context
## Current QA

Static:
- H-C = 51 / 51
- Step 44A = 97 / 97, gaps=0, routes=61
- Step 44E = 35 / 35
- Step 44H-A = 43 / 43
- `git diff --check` PASS

Frontend:
- `@inno/ui` build PASS
- Web Portal typecheck PASS
- Web Portal production build PASS

H-C browser harness:
- exists,
- Python syntax compile PASS,
- runtime verification currently BLOCKED by external infra.
## Infra blocker

At the time of this checkpoint the Windows test machine cannot reach:

```text
172.10.1.58:5432  PostgreSQL
172.10.1.58:8080  Keycloak
```

Observed:
- Platform API startup fails with Npgsql connection timeout to PostgreSQL,
- Chrome QA redirects to Keycloak but the host is unreachable,
- therefore authenticated Product browser QA cannot proceed.

This is an infrastructure/network dependency, not a compile/static failure.

Do not claim H-C browser QA, screenshot review, broad Production browser regression, or Design System browser regression passed until the host is reachable.
## When infra returns

Run in this order:

```text
python step44h-c-page-architecture-cleanup-browser-qa.py
python step42-production-ux-browser-qa.py
python step42_2-design-system-browser-qa.py
```

Do not run the two browser harnesses concurrently because they share the same CDP tab.

Then:
- open H-C screenshots at 1366 / 1024 / 768,
- run the full Step 44 static chain,
- run `git diff --check`,
- update H-C docs from IMPLEMENTED/PENDING to COMPLETE,
- commit/push any final QA/doc changes.

Do not merge to `main` unless explicitly requested.
