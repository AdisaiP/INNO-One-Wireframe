# INNO.One Production

This directory contains the canonical production implementation for INNO.One.

## Technology baseline

- Web Portal: React 19.2 + TypeScript 5.9 + Vite 6.4
- Package manager: pnpm 10.17.0 through Corepack
- Core API: ASP.NET Core / .NET 10 modular monolith
- Persistence: PostgreSQL via EF Core 10 + Npgsql
- Meeting: separate ASP.NET Core / .NET 10 service boundary
- Identity: Keycloak adapter boundary
- Device engine: MeshCentral adapter boundary

## Toolchain

Required:

- Node.js 18.18 or newer with Corepack
- .NET 10 SDK
- Docker for local infrastructure

The repository pins pnpm through `packageManager`. Use `corepack pnpm` rather than requiring a globally installed pnpm.

The .NET baseline is `10.0.103`. `global.json` uses `latestFeature` roll-forward so a newer .NET 10 feature band can build the solution while remaining on .NET 10.

On Windows, enable long-path support for this clone with git config core.longPaths true if Git reports filename-too-long warnings while cleaning Expo/React Native dependencies.

## Layout

~~~text
production/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ web-portal/
â”‚   â”œâ”€â”€ endpoint-agent/
â”‚   â””â”€â”€ assets-mobile/
â”œâ”€â”€ services/
â”‚   â”œâ”€â”€ platform-api/
â”‚   â””â”€â”€ meeting-service/
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ ui/
â”‚   â”œâ”€â”€ contracts/
â”‚   â”œâ”€â”€ auth/
â”‚   â”œâ”€â”€ i18n/
â”‚   â””â”€â”€ shared/
â”œâ”€â”€ infrastructure/
â”œâ”€â”€ tests/
â””â”€â”€ docs/
~~~

## Clean-clone setup

From `production/`:

~~~bash
corepack pnpm install --frozen-lockfile
corepack pnpm run check
~~~

`check` builds the shared TypeScript packages, type-checks and builds the Web Portal, and builds the .NET solution.

## Local infrastructure

~~~bash
cd infrastructure/docker
cp .env.example .env
docker compose up -d
~~~

This starts PostgreSQL and Keycloak for local development. MeshCentral remains behind the integration adapter boundary.

## Common commands

~~~bash
corepack pnpm dev:web
corepack pnpm typecheck
corepack pnpm build
corepack pnpm build:dotnet
~~~

The Web Portal development server uses the configured Vite port (currently 5180 unless overridden).

## Developer onboarding

Engineers extending INNO.One should start with the [Developer Enablement Kit](docs/developer-enablement/README.md). It documents the approved stack, architecture, backend/frontend conventions, module integration rules, UX/UI requirements, testing workflow, skills matrix, and new-module checklist.

## Architecture rule

The Platform CORE provides shared capabilities and contracts. Product modules own their domain and persistence boundaries and should integrate through approved contracts/events rather than direct cross-module persistence coupling.
