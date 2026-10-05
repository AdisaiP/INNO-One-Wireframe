# INNO.One - Step 45L Endpoint Agent Bilingual Runtime

**Status:** IMPLEMENTATION COMPLETE / RUNTIME QA BLOCKED BY INFRASTRUCTURE
**Branch:** `implementation/step45l-endpoint-agent-bilingual-runtime`
**Base:** Step45K `53f141e`
**Do not start Step45M until the Step45L authenticated runtime/browser QA passes.**

## Runtime decision

Endpoint Agent is now frozen as:

```text
Tauri 2 native host
  -> React/Vite renderer
  -> Keycloak Authorization Code + PKCE
  -> module-owned INNO.One Agent API facades
```

Target is Windows-first.

The current Windows development machine has Node/pnpm but no Rust/Cargo toolchain, so this checkpoint includes the real Tauri 2 native-host scaffold/config but does not claim a native executable build.

## Surface ownership

Endpoint Agent remains separate from Web Portal navigation.

Agent owns:
- Request Help;
- ownership/user confirmation;
- real remote-consent prompt/decision;
- local online/offline/error state;
- durable Agent prompts created through an explicit shared contract.

Web Portal continues to own operator/admin configuration and review surfaces.

Android Mobile remains a separate Assets surface.

## Agent renderer

New real runtime under:

```text
production/apps/endpoint-agent
```

Implemented:
- Keycloak login-required + PKCE S256;
- shared Step45E user/org locale preference model;
- Thai + English runtime;
- `document.documentElement.lang` synchronization;
- Home/device context;
- Request Help;
- Ownership Confirmation;
- remote-consent polling/countdown/Allow/Decline;
- generic Agent prompt polling/responding;
- offline/error/loading states;
- Open Portal handoff;
- sign out;
- responsive layouts for 820 / 640 / 390.

## Native host boundary

Tauri scaffold:

```text
production/apps/endpoint-agent/src-tauri/
  Cargo.toml
  build.rs
  src/main.rs
  tauri.conf.json
```

Canonical window:
- 820 x 900;
- minimum 390 x 640.

The renderer can run independently for browser/API QA.

## Module-owned Agent APIs

### Devices

New Agent endpoints:
- `GET /api/v1/agent/device-context/{deviceId}`;
- `GET /api/v1/agent/remote-consent/pending`;
- `POST /api/v1/agent/remote-consent/requests/{requestId}/decision`;
- `GET /api/v1/agent/prompts/pending`;
- `POST /api/v1/agent/prompts/{promptId}/response`.

Operator/module-side endpoints:
- `POST /api/v1/devices/{deviceId}/remote-consent-requests`;
- `POST /api/v1/devices/{deviceId}/agent-prompts`.

Agent-facing device context/consent/prompt reads are restricted to the current user's owned endpoint.

Remote consent is durable and records:
- requesting operator;
- bilingual prompt copy;
- mode;
- requested/expiry time;
- decision;
- deciding user;
- version.

Consent decision emits audit/outbox evidence.

### Assets

New Agent endpoints:
- `GET /api/v1/agent/ownership/context?deviceId=...`;
- `POST /api/v1/agent/ownership-submissions`.

The Agent may only submit against its current user's owned endpoint and the Asset actually linked to that endpoint.

Ownership confirmations are append-only review evidence. Existing pending evidence is never mutated merely because the endpoint user submits a newer confirmation.

The response exposes only active custom fields marked `ShowInAgent`.

Submission uses the existing Assets review queue/audit/outbox boundary.

### Helpdesk

New Agent facade:
- `POST /api/v1/agent/help-requests`.

It reuses the real Helpdesk ticket creation pipeline.

A user may attach their own current endpoint without needing the operator-level `devices.view` permission. A non-owned device still requires normal Devices permission/scope checks.

## Explicit Agent prompt contract

New shared contract:

```text
INNO.One.Contracts.Agent.IAgentPromptService
```

Modules/workflows can create a bilingual prompt by passing:
- device;
- requesting user;
- source module/reference;
- prompt type;
- Thai/English title and message;
- correlation ID;
- trace ID;
- expiry.

The Devices module owns prompt persistence/delivery.

The Agent polls and responds.

This prevents Workflow or another module from directly controlling Agent UI or writing Agent tables.

Prompt responses emit audit/outbox evidence.

## Persistence

Devices schema gained:

```text
remote_consent_requests
agent_prompts
```

Migrations:
- `20261005052426_Step45LAgentRemoteConsent`;
- `20261005053546_Step45LAgentPrompts`.

Final model consistency check:

```text
No changes have been made to the model since the last migration.
```

## Build/static QA currently verified

```text
Step45L static              146/146
Step45K regression          199/199
Step45A roadmap              88/88
Step45I regression          152/152
Step45H regression          127/127
Step45G regression          135/135
Step45F regression          135/135
Step45E bilingual            87/87
Step30 module contract       issues=0
Language/terminology         issues=0
```

Builds verified:
- Endpoint Agent strict TypeScript: PASS;
- Endpoint Agent production renderer build: PASS;
- Agent renderer: 32 Vite modules / ~243 KB JS;
- `@inno/i18n`: PASS;
- `@inno/ui`: PASS;
- Web Portal typecheck: PASS;
- Web Portal production build: PASS, 2262 modules;
- full .NET solution: PASS, 0 warnings / 0 errors;
- Devices EF pending model changes: none;
- `global.json` restored to SDK `10.0.103`.

Existing Web large-chunk warning remains warning-only.

## Runtime/browser QA harness prepared

Dedicated QA:

```text
step45l-endpoint-agent-browser-qa.py
```

It is prepared to verify against real Keycloak/PostgreSQL:
- authenticated Agent session;
- owned device context and non-owned denial;
- Assets ownership context;
- real Request Help ticket through Agent UI;
- real ownership submission and cleanup;
- durable remote-consent create/poll/approve;
- durable Agent prompt create/poll/respond;
- offline state;
- Thai/English switch;
- 820 / 640 / 390 overflow checks;
- screenshots.

## Current infrastructure blocker

At the time of this checkpoint the Windows machine has no route to the normal development infrastructure.

Verified unavailable:

```text
172.10.1.58:5432  PostgreSQL  -> unreachable
172.10.1.58:8080  Keycloak    -> unreachable
```

Also verified:
- no local PostgreSQL service/binary;
- no local Keycloak service;
- Docker is not installed;
- no IPv4 route to the `172.10.x` network.

Therefore authenticated runtime/API/browser QA cannot honestly be completed from this machine until VPN/infrastructure connectivity returns.

This is an infrastructure blocker, not a compile/static failure.

## Required next action before Step45M

1. Restore VPN/network access to `172.10.1.58`.
2. Start Platform API with migrations enabled.
3. Start Endpoint Agent dev renderer.
4. Run:
   ```text
   python -u step45l-endpoint-agent-browser-qa.py
   ```
5. Visually inspect representative screenshots.
6. Run broad Web Product browser regression after stopping Agent port 5180 and starting the normal Web QA server.
7. Only if those pass, change Step45L status to COMPLETE and proceed to Step45M.

Do not merge to `main` unless explicitly requested.
