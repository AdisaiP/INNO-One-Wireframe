# INNO.One - Step 45E Bilingual Foundation

**Status:** COMPLETE  
**Date:** 2026-10-04  
**Branch:** `implementation/step45e-bilingual-foundation`  
**Base planning commit:** `fe02245 docs: refine devices automation scope`  
**Supported locales:** `en-US`, `th-TH`

## 1. Scope completed

Step 45E establishes the shared runtime localization foundation before new module automation UI is built.

Implemented:
- shared `@inno/i18n` package;
- persisted user language preference;
- persisted organization/platform default language;
- explicit inheritance back to organization default;
- authenticated locale resolution;
- browser locale bootstrap before the authenticated profile is available;
- dynamic `document.documentElement.lang`;
- shared date/time and number formatters;
- bilingual shell/navigation foundation;
- bilingual shared loading/error/permission states;
- bilingual Profile & Settings language selection;
- bilingual Admin Center Platform Settings default-language editor;
- optimistic concurrency and audit for the organization default;
- dedicated static and browser/runtime bilingual QA.

This step is a foundation, not the final translation sweep. Existing business-module pages are migrated progressively as their feature slices are implemented. Full remaining Product string migration is reserved for the later bilingual completion step.

## 2. Locale resolution

Authenticated Product locale resolves in this order:

1. explicit user preference;
2. organization/platform default;
3. supported browser/device locale;
4. `en-US` fallback.

Before `/platform/me` is available, the Web bootstrap uses the browser locale so sign-in/bootstrap messages can render in a supported language.

## 3. Shared i18n package

New package: `production/packages/i18n/`

Primary runtime: `src/index.tsx`

Current locale catalogs:
- `common.json`
- `navigation.json`
- `feedback.json`
- `profile.json`
- `admin.json`

Each catalog exists under `en-US` and `th-TH`.

Core exports:
- `SUPPORTED_LOCALES`
- `Locale`
- `normalizeLocale`
- `detectBrowserLocale`
- `resolveLocale`
- `translate`
- `formatDateTime`
- `formatNumber`
- `I18nProvider`
- `useI18n`

Translation keys are semantic identifiers such as `common.actions.save`, `navigation.helpdesk`, `profile.language`, and `admin.settings.language.default`. English source sentences are not used as keys.

## 4. Formatting contract

English uses `en-US`. Thai UI formatting uses `th-TH-u-ca-gregory-nu-latn`, preserving Thai UI language with Gregorian calendar and Latin digits. API timestamps remain timezone-aware ISO-8601 values.

## 5. Platform persistence

`platform.user_profiles` now includes nullable `preferred_locale varchar(16)`. Null means inherit the organization/platform default.

New table `platform.localization_settings` contains:
- `id`
- `default_locale`
- `version`
- `updated_at`

Development/default value is `en-US`.

Migration: `20261004111334_Step45EBilingualFoundation`.

## 6. Profile API

`GET /api/v1/platform/me` now returns:
- `locale`
- `preferredLocale`
- `organizationDefaultLocale`
- `supportedLocales`

`PATCH /api/v1/platform/me/profile` accepts `preferredLocale` and `useOrganizationDefault`.

Rules:
- supported explicit locales are `en-US` and `th-TH`;
- explicit locale and organization-default reset cannot be sent together;
- `useOrganizationDefault=true` clears `preferred_locale`;
- changing language does not alter roles, permissions, resource scope, or route/resource identity.

## 7. Admin localization API

`GET /api/v1/admin/settings` now includes `defaultLocale`, `supportedLocales`, `eTag`, and `updatedAt`.

New mutation: `PATCH /api/v1/admin/settings/localization`.

Permission: `admin.settings.manage`.

Concurrency contract:
- `If-Match` required;
- missing precondition -> 428;
- stale version -> 412;
- EF `Version` is a concurrency token;
- true racing writes also resolve with one successful writer and a 412 loser.

Audit action: `platform.localization.default_locale_changed`.

## 8. Web Product behavior

### Profile & Settings

Language choices:
- Organization default;
- English;
- Thai.

An explicit locale applies without changing the current route. Organization default clears the user override and resumes inheritance.

### Admin Center -> Platform Settings

Admin can edit Default language. Changing the organization default immediately updates inherited users after the authenticated profile query is invalidated. Explicit user preferences are preserved.

### Shared shell and feedback

Localized foundation covers global search/accessibility labels, account actions, rail semantics, contextual navigation, Workspace, Apps, Admin, Devices, Assets, Helpdesk, and shared loading/error/permission states.

The old standalone Dynamic Workflows Product remains temporary migration debt from Step 45C and is intentionally removed in Step 45F rather than expanded as a long-lived bilingual Product surface.

## 9. Language contract

`INNO-One-Language-Terminology-Contract.md` now has a Production runtime override. Historical fixed surface ownership remains only the frozen HTML prototype baseline.

Production runtime target is bilingual `en-US` + `th-TH`. API fields, enums, permission strings, event names and audit action codes remain language-neutral. User-authored content is never silently translated.

## 10. Automation roadmap alignment

- Helpdesk: full React Flow workflow;
- Assets: restricted lifecycle workflow;
- Admin Center: constrained approval/lifecycle workflow;
- Devices: WHEN / IF / THEN automation + remediation first, not full React Flow by default;
- Reports: scheduling/subscription rather than graph workflow;
- Meeting: out of this roadmap until explicitly reintroduced.

## 11. QA results

### Dedicated static bilingual audit

`step45e_checks=77`  
`step45e_failures=0`

### Dedicated browser/runtime QA

`step45e_browser_checks=62`  
`step45e_browser_failures=0`  
`step45e_browser_screenshots=6`

Validated Keycloak sign-in, English/Thai user preference, organization inheritance, route preservation, dynamic document language, persisted preferences, unchanged permissions, 400/428/412 error contracts, true concurrent writes `[200, 412]`, responsive Profile/Admin at 1366/1024/768, and restoration of the pre-QA database locale state.

Evidence folder: `qa-step45e-bilingual-foundation`.

### Broad Production browser regression

`step42_routes=62`  
`step42_browser_checks=1628`  
`step42_browser_failures=0`

### Existing regression chain

- Step 45A: 78/78;
- Step 45C: 68/68;
- Step 30 module/plugin audit: issues=0;
- legacy language/terminology audit: issues=0.

Legacy language audit also reports Web routes 93, English prototype surfaces 94/94, Thai prototype surfaces 3/3, unscoped Thai fragments 0, terminology mismatches 0.

### Builds

- `@inno/contracts`: PASS
- `@inno/shared`: PASS
- `@inno/auth`: PASS
- `@inno/i18n`: PASS
- `@inno/ui`: PASS
- Web typecheck: PASS
- Web production build: PASS
- full .NET solution build: PASS
- .NET warnings: 0
- .NET errors: 0
- EF pending model changes: none
- `git diff --check`: PASS

Vite retains the previously known >500 KB chunk warning; the existing React Flow/ELK workflow chunk remains lazy and isolated.

The MCP PowerShell environment does not expose bare `pnpm` to nested scripts, so the equivalent package build chain was run per workspace through `corepack.cmd`.

## 12. Step boundary

Step 45E does not move React Flow into Helpdesk, add workflow execution/run history, add Devices remediation UI, translate every business page, or implement Agent/Mobile bilingual runtime.

## 13. Next step

**Step 45F - Helpdesk Automation Consolidation**

Required direction:
- remove the old simple Helpdesk Trigger -> Condition -> Action Product editor;
- move the shared React Flow builder under Helpdesk;
- introduce explicit `ownerModule=helpdesk`;
- reuse Step 45C definition/version persistence;
- remove Dynamic Workflows from Apps launcher and generic Product navigation;
- preserve shared technical Workflow/Automation Core;
- use the Step 45E bilingual foundation for all new Helpdesk Automation UI.

Do not start the old Step 45D global workflow execution roadmap.
