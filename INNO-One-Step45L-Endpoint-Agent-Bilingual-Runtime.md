# INNO.One - Step 45L Endpoint Agent Bilingual Runtime

**Status:** COMPLETE
**Branch:** `implementation/step45l-endpoint-agent-bilingual-runtime`
**Base:** Step45K `53f141e`
**Implementation checkpoint:** `6043281`
**Next:** Step45M - Android Mobile bilingual completion

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

## Final build/static QA

```text
Step45L static              152/152
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

## Authenticated runtime/browser QA

The VPN/development infrastructure returned and the blocked runtime gate was executed against the real Keycloak/PostgreSQL environment.

Dedicated Agent QA:

```text
step45l_browser_checks=54
step45l_browser_failures=0
step45l_browser_screenshots=9
```

Verified:
- Keycloak authenticated Agent session;
- owned endpoint context;
- non-owned endpoint denied with 403;
- Assets ownership context for `AST-NB-000003`;
- real Request Help submission through the Agent UI;
- QA Helpdesk Ticket resolved as cleanup;
- real ownership submission through the Agent UI and rejected as cleanup;
- durable remote-consent create/poll/approve;
- durable Agent prompt create/poll/respond;
- offline runtime state;
- Thai/English runtime switch;
- 820 / 640 / 390 no-horizontal-overflow checks;
- user locale restored after QA.

Representative screenshots were visually inspected:
- 820 Thai home;
- 390 Thai home;
- Request Help success;
- Ownership success;
- Remote Consent;
- Agent Prompt;
- Offline state;
- English home.

During runtime QA a real Agent auth defect was found and fixed: `getAccessToken()` now self-initializes Keycloak before attempting token/login operations.

The QA harness was also made deterministic:
- Agent QA prepares locale before Agent boot and cleans its own Ticket/ownership evidence;
- broad Web QA forces its expected English locale and restores the user's original locale afterwards.

## Broad Web Product regression

Final:

```text
step42_routes=68
step42_browser_checks=1791
step42_browser_failures=0
```

Covered 1366 / 1024 / 768 across Workspace, Admin, Devices, Assets, Helpdesk, Reports and discovered dynamic routes.

This confirms the separate Endpoint Agent runtime did not regress the existing Web Product.

## Completion

Step45L is COMPLETE.

The next implementation is **Step45M - Android Mobile bilingual completion**.

Meeting recording client integration remains intentionally deferred to the later Meeting slice.

Do not merge to `main` unless explicitly requested.
