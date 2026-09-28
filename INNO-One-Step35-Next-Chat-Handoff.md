# INNO.One — Step 35 Next Chat Handoff

Last updated: 2026-09-28
Step: **35 — Branding Foundation**
Branch: `implementation/step35-branding-foundation`
Status: **COMPLETE — static/build/runtime/browser QA passed**

## Scope

Meeting remains intentionally deferred.

Step 35 activates the Branding Admin area without inventing a mutable branding model that is not present in the frozen contracts.

Implemented:
- `/admin/branding`
- one canonical Web Portal product-brand source
- effective product identity preview
- effective frozen design-token preview
- Admin navigation / search / overview integration
- `admin.branding.manage` development permission seed
- responsive Branding page

## Contract boundary

Current source contracts provide:
- Branding as an Admin Center information-architecture area
- `admin.branding.manage`
- global INNO.One logo / brand as part of Global UI
- frozen Design System V1.26 tokens

Current source contracts do **not** define:
- persisted branding resource schema
- logo upload resource/API
- organization-level brand overrides
- color override resource/API
- login-page branding resource/API
- ETag update contract for branding
- branding-specific privileged audit events

Step 35 therefore does not create a fake editor or a speculative database/API model.

## Product-brand source

New:
- `production/apps/web-portal/src/app/branding.ts`

Canonical values:
- product name: `INNO.One`
- product-name prefix: `INNO.`
- emphasized product name: `One`
- compact mark: `I1`
- browser title: `INNO.One`

The production shell now consumes `PRODUCT_BRAND` rather than duplicating `I1` / `INNO.One` in its brand markup.

The document title is initialized through:
- `applyProductDocumentBrand()`

Global search labeling also reads the canonical product name.

## Effective brand tokens

Branding page reads the effective CSS custom properties already owned by Design System V1.26:

- `--ds-primary`
- `--ds-primary-hover`
- `--ds-primary-soft`
- `--ds-bg`
- `--ds-surface`
- `--ds-text`
- `--ds-font`

The page does not redefine or override these tokens.

## React UI

New:
- `AdminBrandingPage.tsx`

Route:
- `/admin/branding`

Permission:
- `admin.branding.manage`

Pattern:
- read-only Settings/Foundation view

UI includes:
- current header-brand preview
- product name
- compact mark
- browser title
- brand scope
- six effective color/surface/text token cards
- current UI font token
- explicit customization boundary notice

Integrated into:
- Admin contextual navigation
- global search
- Admin Overview

## No fake actions

Step 35 intentionally exposes:
- no Save Branding
- no Upload Logo
- no file picker
- no color picker
- no product-name editor
- no login-page editor

Before these become editable, freeze a branding data/API/audit contract first.

## Contract version

Implementation Contract:
- **0.25.0**

Frozen contracts preserved:
- Design System V1.26
- UI Contract 1.20.0
- API Contract 0.5.0
- Event/Audit Contract 0.5.0
- Data Model Contract 0.6.0

## QA

Static:
- Step 35 audit: `issues=0`
- Step 34 regression: `issues=0`
- Step 33 regression: `issues=0`
- Step 32 regression: `issues=0`
- Step 31 regression: `issues=0`
- Step 30 regression: `issues=0`
- Step 29 parity: `issues=0`
- Steps 15–28: all `issues=0`

Runtime:
- VPN-connected runtime: `172.10.1.58`
- `step35-runtime-qa.py`: **9 / 9 PASS**

Runtime coverage:
- Platform Admin receives `admin.branding.manage`
- viewer does not receive `admin.branding.manage`
- platform API ready
- profile secret-leak checks pass
- implementation contract reported as `0.25.0`

Browser / visual:
- real Keycloak login
- `step35-browser-qa.py`: **47 / 47 PASS**
- 1366 / 1024 / 768
- no page-level horizontal overflow
- one active Admin rail entry
- document title is `INNO.One`
- effective product identity visible
- six brand-token cards visible
- font token visible
- shell mark and Branding preview use `I1`
- effective `--ds-primary` resolves to the frozen V1.26 value
- no fake branding editor
- no file/color inputs
- Admin Overview Branding link present
- representative screenshots visually reviewed

Final regression:
- Steps 15–35 static audits: PASS
- TypeScript typecheck: PASS
- Vite production build: PASS
- .NET build: **0 warnings / 0 errors**
- `git diff --check`: PASS
- final marker: `STEP35_FINAL_CHAIN=PASS`

## Next action

Step 35 is closed.

Meeting remains intentionally deferred.

Next planned Admin/platform area:
- **Step 36 — Platform Settings**

Apply the same rule as Branding/Security: inspect the current contracts before exposing editable settings. The current permission contract reserves `admin.settings.manage`, but availability alone does not define a settings data model.

Do not merge `main`.
Do not deploy.
