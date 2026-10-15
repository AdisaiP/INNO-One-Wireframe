# Technology Stack

This file records the current approved baseline. Do not introduce a competing framework or runtime without an architecture decision.

## Web Portal

- React 19.2
- TypeScript 5.9
- Vite 6.4
- React Router 6.30
- TanStack React Query 5.104
- Keycloak JS 26.2
- pnpm 10.17

Shared workspace packages:

- `@inno/ui`
- `@inno/contracts`
- `@inno/auth`
- `@inno/i18n`
- `@inno/shared`

## Platform backend

- ASP.NET Core / .NET 10
- EF Core 10
- PostgreSQL
- Npgsql
- Modular Monolith architecture

## Identity

- Keycloak
- OpenID Connect
- Authorization Code + PKCE for interactive clients

## Device integration

- MeshCentral / MeshAgent
- Integration isolated behind `INNO.One.Integrations.MeshCentral`

## Endpoint Agent

- React
- TypeScript
- Vite
- Tauri 2.12

## Android Assets app

- Expo 57
- React Native 0.86
- React 19.2
- TypeScript 5.9

## Infrastructure and delivery

- Docker
- PostgreSQL
- Keycloak
- GitHub Actions
- Linux-oriented production deployment

## Rules

- Use `corepack pnpm`.
- Keep .NET projects on the repository's .NET 10 baseline.
- Shared UI belongs in `@inno/ui`.
- Cross-surface/shared contracts belong in approved shared packages/projects.
- Do not duplicate auth, permission, or transport abstractions inside a product module.
