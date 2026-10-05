# Endpoint Agent

Endpoint Agent owns managed-endpoint user interactions:

- Request Help;
- ownership/user confirmation;
- real remote-consent prompts and decisions;
- local online/offline/error state;
- future workflow-created prompts and Meeting recording interactions.

## Step45L runtime technology

**Target native host: Tauri 2, Windows-first.**

The Product runtime is split into:

```text
Tauri native host
  -> React/Vite Agent renderer
  -> INNO.One /api/v1/agent module-owned facades
```

The renderer is independently runnable in development so API/runtime/browser QA does not depend on native packaging.

This Windows development machine currently has Node/pnpm but does not have Rust/Cargo installed, so Step45L does not claim a native executable build. The repository freezes Tauri as the host choice and keeps native-only concerns behind the Agent boundary.

The Agent must never call MeshCentral as a substitute for INNO.One business APIs.

## Development

```powershell
corepack pnpm --filter @inno/endpoint-agent dev
corepack pnpm --filter @inno/endpoint-agent typecheck
corepack pnpm --filter @inno/endpoint-agent build
```

Default development endpoint:

```text
dev_80000000000000000000000000000002
NOTEBOOK-IT-003
AST-NB-000003
```

Copy `.env.example` when different Keycloak/API/device settings are required.

## Authentication and locale

The renderer uses Keycloak Authorization Code + PKCE and the same user profile locale model as Step45E:

```text
explicit user preference
  -> organization default
  -> en-US fallback
```

Thai remains the Agent primary/fallback surface language while English is supported at runtime.

## API ownership

The Agent consumes module-owned Agent facades:

- Devices: device context and remote consent;
- Assets: ownership context/submission;
- Helpdesk: Request Help.

Agent routes are not Web Portal navigation.
