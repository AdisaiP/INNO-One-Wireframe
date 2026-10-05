# INNO.One — Step45O Product Polish, Language Access & Login Concepts

**Date:** 2026-10-06
**Status:** SOURCE/UI COMPLETE — LIVE DEPLOYMENT PENDING SSH AUTHORIZATION
**Branch:** `ux/step45o-product-polish-login-themes`
**Base:** `81eef6a` (Step45N merged main)

## Scope completed

- Added persistent EN / ไทย quick language switch to the global Top bar.
- Moved Sign out out of the Top bar into the user/profile menu.
- Clarified `/admin/settings` as organization defaults + read-only effective runtime configuration.
- Corrected organization hierarchy connector geometry and last-sibling termination.
- Reworked Helpdesk SLA escalation editor density, labels and save ownership.
- Reworked Business Calendar from oversized day cards to a compact seven-row weekly schedule with locale-aware weekday names.
- Closed additional Thai UI leaks found by runtime coverage checks.
- Added five static Keycloak login design concepts using the same INNO.One visual language and Product illustrations. These are preview-only and are not active in the realm.

## Language boundary

Thai localization covers Product UI labels, headings, actions, statuses and supporting copy. Business data remains source-owned and is not forcibly translated, including organization names, role names, device names, OS names, policy names, locations and vendor data.

Runtime Thai coverage verification specifically closed:

- New/Edit User Profile titles,
- Keycloak subject label,
- Devices Last Seen column selector,
- localized online/offline status,
- locale-aware relative last-seen time,
- QR label Serial No.,
- the four-step QR workflow.

## Login concepts

Preview source:

`production/infrastructure/keycloak/login-concepts/index.html`

Concepts:

1. Corporate Clean
2. Modern Workspace
3. Security & Trust
4. Operations Command
5. Friendly Enterprise

Existing Product illustrations are bundled inside the preview folder so the concepts are self-contained. Do not wire a concept into Keycloak until the user chooses one.

## QA evidence

Final source gates:

- i18n build: PASS
- Web TypeScript typecheck: PASS
- Web production build: PASS, 2262 modules
- Step45N bilingual audit: 4036 checks / 1972 translation keys / 0 raw-copy offenders / 0 failures
- Language & terminology audit: 0 issues
- Step44C hierarchy audit: 40 / 40
- Step45O focused static audit: 36 / 36
- focused Step45O browser QA: 85 / 85, 17 screenshots
- broad React browser regression: 68 routes / 1791 checks / 0 failures at 1366 / 1024 / 768
- targeted Thai browser QA after final leak cleanup: PASS
- `git diff --check`: PASS

The older Step44H-A and Step18 audit scripts already fail the same historical 11 checks on base `81eef6a`; detached-baseline comparison proved those are stale contracts, not Step45O regressions.

## Live environment findings

Target: `172.10.1.58`

Observed services:

- HTTP :80 — reachable, but serves an older static Web build.
- PostgreSQL :5432 — reachable and local API health reports connected.
- Keycloak :8080 — reachable and OIDC discovery reports connected.
- MeshCentral :8443 — reachable, but INNO.One integration health is degraded.

Exact MeshCentral control failure from Platform API log:

`MeshCentral closed the control connection: noauth (noauth-2d).`

The repo already contains the intended idempotent integration-account bootstrap:

`production/scripts/step16-meshcentral-init.py`

The Docker compose definition starts MeshCentral but does not itself provision the integration account. The init script creates/promotes the account and restarts MeshCentral. This should be rerun on the live Docker stack before remote-management validation.

## Remote-control boundary discovered

Current source is not yet full operator remote-control end-to-end:

- Agent-side remote consent request / approve / decline APIs exist.
- MeshCentral adapter currently supports group/node sync and enrollment links.
- `IRemoteDeviceEngine` does not yet expose remote-session launch.
- Device Detail does not yet expose an operator Start Remote Session action.

Therefore do not claim remote desktop is complete after fixing MeshCentral authentication alone. The next implementation slice must add the operator session-launch boundary/UI, connect it to approved consent, and audit the session start/end.

## Deployment blocker

Windows MCP can reach the Linux target, but no passwordless SSH credential is installed on the Windows MCP device. Interactive password submission is blocked by the MCP safety layer, so live deployment was not performed and no credential-bypass workaround was attempted.

To resume deployment, authorize an SSH public key for `inno360` on the Linux target (or connect the Linux host as its own MCP device). Then:

1. inspect the live Docker/Kestrel deployment,
2. back up current config/artifacts,
3. deploy the tested Web/API revision,
4. run `step16-meshcentral-init.py` against the live compose stack,
5. re-test Admin Integrations until MeshCentral = connected,
6. run live login/UI smoke,
7. implement and then validate the missing remote-session launch slice before claiming remote-control completion.

## Merge boundary

This branch is a checkpoint only. Do not merge `main` without explicit user instruction.
