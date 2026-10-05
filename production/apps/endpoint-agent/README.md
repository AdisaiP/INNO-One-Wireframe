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

The Windows development machine now has Rust/Cargo plus Visual Studio 2022 Build Tools with the MSVC C++ toolchain. Tauri 2 native packaging has been verified for both MSI and NSIS on x64 Windows.

Current packaging verification:

```text
src-tauri/target/release/inno-one-endpoint-agent.exe
src-tauri/target/release/bundle/msi/INNO.One Agent_0.1.0_x64_en-US.msi
src-tauri/target/release/bundle/nsis/INNO.One Agent_0.1.0_x64-setup.exe
```

The native executable was smoke-tested and opened a responding `INNO.One Agent` window. Current development installers are not code-signed; production release signing remains a separate release-engineering requirement.

The Agent must never call MeshCentral as a substitute for INNO.One business APIs.

## Development

```powershell
corepack pnpm --filter @inno/endpoint-agent dev
corepack pnpm --filter @inno/endpoint-agent typecheck
corepack pnpm --filter @inno/endpoint-agent build
corepack pnpm --filter @inno/endpoint-agent dev:native
corepack pnpm --filter @inno/endpoint-agent build:native
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
