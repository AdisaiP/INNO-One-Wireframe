# INNO.One - Step 45E Next Chat Handoff

**Status:** Step 45E COMPLETE  
**Branch:** `implementation/step45e-bilingual-foundation`  
**Next:** Step 45F - Helpdesk Automation Consolidation

## Read first

1. `INNO-One-Automation-I18N-Rearchitecture-Plan.md`
2. `INNO-One-Step45E-Bilingual-Foundation.md`
3. `INNO-One-Step45C-Dynamic-Workflow-Persistence-Versioning.md`
4. `INNO-One-Step44G-Dynamic-Workflow-Foundation.md`
5. `INNO-One-Language-Terminology-Contract.md`

## Current Product decisions

- Dynamic Workflows must not remain a standalone end-user App.
- Workflow technology remains shared infrastructure.
- Helpdesk owns full React Flow automation first.
- Assets later gets restricted lifecycle workflow.
- Admin later gets constrained approval/lifecycle workflow.
- Devices gets WHEN / IF / THEN Automation & Remediation first; do not expose full React Flow by default.
- Reports gets schedule/subscription behavior rather than graph workflow.
- Meeting is out of this roadmap until explicitly reintroduced.

## Step 45E completed

- new `@inno/i18n` package;
- runtime `en-US` and `th-TH`;
- user `preferred_locale` persistence;
- platform/organization default locale persistence;
- Organization default inheritance/reset;
- Profile language selector;
- Admin Platform Settings default-language editor;
- browser fallback before authenticated profile;
- authenticated profile drives active locale;
- dynamic HTML `lang`;
- locale-aware date/time/number formatting;
- bilingual shell/navigation foundation;
- bilingual shared Feedback states;
- ETag + If-Match 428/412;
- EF concurrency token and race handling;
- localization change audit.

## Runtime state after QA

QA restored locale state after testing:
- platform default: `en-US`;
- test user preferred locale: null / organization default;
- effective locale: `en-US`.

Remote QA infrastructure:
- PostgreSQL `172.10.1.58:5432` / `inno_core`;
- Keycloak `http://172.10.1.58:8080/realms/inno-one`;
- API QA `127.0.0.1:5080`;
- Vite QA `localhost:5180`.

Stop API/Vite after the current completion checkpoint if still running. Chrome debugging port 9241 may remain.

## QA baseline

- Step45E static: 77/77;
- Step45E browser/runtime: 62/62;
- screenshots: 6;
- broad Production: 1628/1628 across 62 routes;
- Step45A: 78/78;
- Step45C: 68/68;
- Step30 issues: 0;
- legacy language audit issues: 0;
- full .NET: 0 warnings / 0 errors;
- Web package builds/typecheck/production build: PASS;
- EF pending model changes: none;
- git diff check: PASS.

## Important implementation details

Locale resolution:
1. explicit user preference;
2. platform/organization default;
3. browser/device supported locale;
4. `en-US` fallback.

API/event/permission/audit identifiers remain language-neutral. User-authored business content is not silently translated.

Thai presentation formatting uses `th-TH-u-ca-gregory-nu-latn`.

`production/global.json` must remain pinned to SDK 10.0.103. This Windows machine has 10.0.201; use a temporary try/finally override for EF/.NET commands and restore the file exactly.

Bare `pnpm` is not available in the MCP PowerShell PATH. Use `C:\Program Files\nodejs\corepack.cmd pnpm ...`.

## Step 45F direction

Do not build execution/run history yet.

Step 45F must:
- replace the old Helpdesk Trigger -> Condition -> Action editor with the shared `INNOWorkflowCanvas`;
- keep routes inside Helpdesk: `/helpdesk/automation`, `/helpdesk/automation/new`, `/helpdesk/automation/:automationId`;
- add explicit definition ownership `ownerModule=helpdesk`;
- define a Helpdesk-specific node catalog;
- reuse Step45C persistence/versioning/ETag/audit;
- migrate away from generic `workflows.view/manage` Product permissions toward Helpdesk-owned permissions;
- remove Dynamic Workflows from Apps launcher and generic Product navigation;
- keep technical Workflows/Automation Core reusable;
- make all new Helpdesk Automation UI bilingual through `@inno/i18n`;
- preserve Helpdesk permission boundaries and shared UX contracts.

Do not merge to `main` unless explicitly requested.
