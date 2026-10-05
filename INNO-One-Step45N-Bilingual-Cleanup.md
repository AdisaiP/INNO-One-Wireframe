# INNO.One - Step45N Bilingual Completion and Cleanup

**Status:** COMPLETE
**Date:** 2026-10-05
**Branch:** `implementation/step45n-bilingual-cleanup`

## Outcome

Step45N completes the bilingual cleanup slice for the current INNO.One Product Web and retires the remaining global Dynamic Workflows Product assumptions.

Production Web UI chrome for Workspace, Admin, Devices, Assets, Helpdesk, Reports, Search, Notifications and related Product pages now uses the shared `en-US` / `th-TH` runtime model. Business records, technical identifiers, permission IDs, event names, audit codes and user-authored values remain language-neutral or preserved as authored rather than being silently translated.

## Implemented

- completed the remaining Product Web i18n sweep with AST-based copy scanning/codemod support;
- expanded the stable EN/TH catalogs and removed remaining raw Product copy detected by the Step45N scanner;
- kept locale switching on the existing profile / organization-default contract;
- converted durable Platform notifications to bilingual EN/TH title/message fields;
- resolved effective notification locale from user preference -> organization/platform default and returned `contentLocale`;
- rendered notification title/message with explicit `lang="en"` / `lang="th"` ownership;
- updated development seed notification rows in place with bilingual durable copy;
- retained only the compatibility `/workflows/* -> /helpdesk/automation` redirect; there is no standalone Workflows Product surface;
- removed generic `workflows.*` permissions from the active Platform permission catalog/role links;
- cleaned legacy `legacy_unassigned` workflow ownership into explicit module ownership;
- kept the shared Workflow/Automation Core as technical infrastructure behind module-owned surfaces.

## Database migrations

Platform:
- `20261005094647_Step45NRetireGenericWorkflowPermissions`
- `20261005132928_Step45NBilingualNotifications`

Workflows:
- `20261005094527_Step45NWorkflowOwnershipCleanup`

Both Platform and Workflows EF pending-model checks report no pending model changes.

## Final QA

Static / contract:
- Step45N copy scanner: `unique=0`, `occurrences=0`, `missingComponent=0`;
- Step45N audit: **3982 checks**, **1945 translation keys**, **0 raw-copy offenders**, **0 failures**;
- Language & Terminology audit: Web/Design System **94/94**, Agent/Mobile **3/3**, unscoped Thai **0**, terminology mismatches **0**, issues **0**;
- Step30 module/plugin contract audit: issues **0**;
- `git diff --check`: PASS.

Build / persistence:
- `@inno/i18n` build: PASS;
- Web Portal typecheck: PASS;
- Web Portal production build: PASS;
- full .NET solution: **0 warnings / 0 errors**;
- Platform EF pending model changes: none;
- Workflows EF pending model changes: none.

Browser / runtime:
- broad Product regression: **1791/1791 checks across 68 routes**, 1366 / 1024 / 768, **0 failures**;
- dedicated Step45N bilingual/runtime QA: **122/122**, **0 failures**, **21 screenshots**;
- dedicated assertions cover EN/TH durable notification content, `contentLocale`, DOM `lang`, retired generic workflow permissions and the retired standalone Workflows Product route;
- representative Workspace/Admin/Notifications EN/TH screenshots were inspected; responsive Notifications at 768 px has no horizontal overflow.

The first dedicated run exposed a QA timing issue: notification assertions executed while React Query was still loading. The QA now waits for the real notification row before checking `lang`/copy; the rerun is fully green.

## Cleanup

Step45N browser/API/Web/Chrome processes and temporary PostgreSQL/Keycloak forwards were stopped. Temporary Chrome profiles and generated QA screenshot/output folders were removed after visual inspection. User and organization locale state was restored by QA.

## Environment note

The repository pins .NET SDK `10.0.103` with `latestPatch`, while this Windows machine currently has `10.0.201`. Final solution QA used the installed 10.0.201 MSBuild directly without changing the repository. EF checks used a temporary `global.json` substitution inside a restore-in-finally flow; the original repository file was restored exactly.

## Deferred item retained from Step45M

Android device/emulator visual QA remains explicitly deferred by the prior product decision. Step45N does not claim that deferred Android QA passed.

## Integration rule

Do not merge `main` unless explicitly requested.
