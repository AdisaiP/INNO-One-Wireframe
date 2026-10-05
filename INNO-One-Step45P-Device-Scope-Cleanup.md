# INNO.One — Step45P Device Scope Cleanup

**Date:** 2026-10-06
**Status:** IMPLEMENTED + VERIFIED
**Branch:** `ux/step45p-device-scope-cleanup`
**Base:** `199bd66` (Step45O checkpoint)

## Decision

The Devices menu in the frozen wireframe represents the broader target product architecture, while the Production Web shell intentionally exposes only jobs that have an implemented Product route and runtime contract.

The wireframe currently includes future/expanded Device jobs such as:

- Remote Operations
- Remote Consent
- Deployment Jobs
- Agent Maintenance
- Policies
- Alerts
- Reports

Production did not lose these entries through a styling defect. They are intentionally absent until their corresponding Product surfaces are implemented and available.

The user also decided that **Devices Automation is not part of the desired Device product scope**. Step45P therefore retires it rather than merely hiding its navigation entry.

## Devices Automation retirement

Removed from active Product source:

- Device sidebar Automation navigation.
- `/devices/automation` list route.
- new/edit/history Device Automation routes.
- Device Automation React pages.
- Device Automation Web API client functions and run DTOs.
- `/api/v1/devices/automations` definition/version facade.
- Device Automation run endpoints.
- Device Automation executor registration and implementation.
- Device Automation permission catalog/DevelopmentSeed entries.
- Device Automation module-manifest permissions/navigation.
- Device Automation i18n namespace.

Old Product bookmarks under `/devices/automation/*` redirect to `/devices` instead of being interpreted as a Device ID.

## Shared automation boundary

This retirement does **not** remove the shared workflow engine and does not affect:

- Helpdesk Automation.
- Assets Automation.
- shared immutable workflow persistence/history used by those modules.

No destructive database migration is introduced. Historical Step45H definitions/runs or permission rows that may already exist in an environment are left as historical data; they are no longer exposed through active Devices Product routes/APIs/executors.

## Generic Device language keys

Several non-Automation pages had reused generic labels from the old `devices.automation.*` namespace. These were moved to `devices.shared.*` before the Automation namespace was deleted:

- Device group
- Operating system
- Notebook
- Online
- Offline

## Current Production Devices navigation

After Step45P, the currently implemented Devices navigation remains:

1. Devices
2. Discovery
3. Inventory Query
4. Device Groups
5. Agent Deployment (permission-gated)

Future wireframe entries should only be promoted into Production navigation when their Product route/runtime is implemented. Do not add dead or placeholder menu entries merely to visually match the wireframe.

## QA

Completed:

- Web i18n build: PASS
- Web typecheck: PASS
- Web production build: PASS, 2259 modules
- .NET solution build with installed .NET 10.0.201: 0 warnings / 0 errors
- Step45P retirement audit: 24 / 24
- Step45N bilingual audit: 3775 checks / 1843 keys / 0 failures
- language/terminology audit: 0 issues
- JSON manifest/screen-matrix parse: PASS
- broad browser regression: 66 routes / 1734 checks / 0 failures at 1366 / 1024 / 768
- focused browser retirement check: 2 / 2 — Device sidebar has no Automation entry and `/devices/automation` redirects to `/devices`
- `git diff --check`: PASS

## Historical boundary

Step45H documentation/audits remain in the repository as historical evidence of a feature that existed before this product-scope decision. They are not current Product scope after Step45P.

## Merge boundary

Do not merge `main` without explicit user instruction.
