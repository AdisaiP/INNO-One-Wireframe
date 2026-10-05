# INNO.One - Step45N Next Chat Handoff

**Status:** COMPLETE
**Branch:** `implementation/step45n-bilingual-cleanup`
**Base before Step45N:** `b5e8786`
**Date:** 2026-10-05

This file is part of the Step45N completion commit. After checkout, use `git log -1` as the source of truth for the exact completion commit ID.

## Read first

1. `INNO-One-Step45N-Bilingual-Cleanup.md`
2. `INNO-One-Next-Chat-Handoff.md`
3. `INNO-One-Language-Terminology-Contract.md`
4. `INNO-One-Automation-I18N-Rearchitecture-Plan.md`
5. `INNO-One-Surface-Boundaries.md`

## Step45N outcome

Step45N is complete for the implemented Product scope.

- Product Web chrome across Workspace, Admin, Devices, Assets, Helpdesk, Reports, Search, Notifications and related pages completes the shared `en-US` / `th-TH` runtime cleanup.
- Business records, technical identifiers, permission IDs, event names, audit codes and user-authored values remain language-neutral or preserved as authored. Do not silently translate them.
- Durable Platform notifications store EN/TH title/message pairs, resolve effective locale from user preference -> organization/platform default, return `contentLocale`, and render nested content with explicit `lang`.
- The standalone Dynamic Workflows Product remains retired.
- `/workflows/*` exists only as a compatibility redirect to `/helpdesk/automation`.
- Generic `workflows.*` permissions are absent from the active Platform permission catalog and role links.
- Legacy `legacy_unassigned` workflow ownership is cleaned into explicit module ownership.
- Shared Workflow/Automation Core remains technical infrastructure behind module-owned Product surfaces.

## Step45N migrations

Platform:
- `20261005094647_Step45NRetireGenericWorkflowPermissions`
- `20261005132928_Step45NBilingualNotifications`

Workflows:
- `20261005094527_Step45NWorkflowOwnershipCleanup`

Platform and Workflows EF pending-model checks both report no pending model changes.

## Final QA source of truth

Copy / static:
- AST copy scanner: `unique=0`, `occurrences=0`, `missingComponent=0`;
- Step45N audit: `step45n_checks=3982`, `step45n_translation_keys=1945`, `step45n_raw_copy_offenders=0`, `step45n_failures=0`;
- Language & Terminology audit: Web/Design System **94/94**, Agent/Mobile **3/3**, unscoped Thai **0**, terminology mismatches **0**, issues **0**;
- Step30 module/plugin contract audit: issues **0**;
- `git diff --check`: PASS.

Build:
- i18n build: PASS;
- Web Portal typecheck: PASS;
- Web Portal production build: PASS;
- full .NET solution: **0 warnings / 0 errors**;
- Platform EF pending model changes: none;
- Workflows EF pending model changes: none.

Browser/runtime:
- broad Product QA: **1791/1791 across 68 routes**, 1366 / 1024 / 768, **0 failures**;
- dedicated Step45N QA: **122/122**, **0 failures**, **21 screenshots**;
- dedicated QA explicitly checks EN/TH durable notifications, `contentLocale`, DOM `lang`, retired standalone Workflows Product routing, and retired generic workflow permissions;
- representative EN/TH Workspace/Admin/Notifications screenshots were inspected, including responsive TH Notifications at 768 px.

The first dedicated run produced five false failures because assertions read Notifications while React Query was still loading. The QA was corrected to wait for the real notification row; the final rerun is fully green.

## Visual / language contract note

Thai runtime pages may still show business/resource/activity values that were authored or persisted in English. That is allowed by the Language & Terminology Contract and is not the same as untranslated Product UI chrome. Do not translate business data silently.

## Cleanup complete

The Step45N API/Web/Chrome runtime, temporary PostgreSQL/Keycloak forwards, temporary Chrome profile and generated QA screenshot/output folders were removed after testing. QA restored user and organization locale state.

## Environment note

The repository pins .NET SDK `10.0.103` with `latestPatch`; this Windows machine currently has `10.0.201`. Final .NET QA used the installed 10.0.201 MSBuild directly without changing repository configuration. EF checks temporarily substituted the SDK version inside a restore-in-finally flow; the original `global.json` was restored exactly.

## Roadmap state

- Step45J Admin Approval Automation remains deferred by product decision.
- Step45M Android device/emulator visual QA remains explicitly deferred. Do not claim it passed.
- Step45N completes the current Step45 automation/i18n re-architecture acceptance criteria for the implemented Product scope.
- No new implementation slice is frozen by Step45N. Choose the next roadmap step explicitly before starting new Product work.

## Safety / integration rule

Do not merge `main` unless explicitly requested.
