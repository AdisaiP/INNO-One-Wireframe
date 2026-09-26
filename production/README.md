# INNO.One Production Skeleton

Step 14 creates the production repository boundary without replacing the frozen HTML prototype.

## Technology baseline

- Web Portal: React 19.2 + TypeScript 5.9 + Vite 6.4
- Package manager: pnpm workspaces
- Core API: ASP.NET Core / .NET 10 modular monolith
- Persistence: PostgreSQL via EF Core 10 + Npgsql
- Meeting: separate ASP.NET Core / .NET 10 service boundary for the initial implementation
- Identity: Keycloak adapter boundary
- Device engine: MeshCentral adapter boundary

The current developer machine has .NET 10.0.103, Node 18.18 and pnpm 10.17; the selected Web build tool remains compatible with that machine.

## Layout

~~~text
production/
├── apps/
│   ├── web-portal/
│   ├── endpoint-agent/
│   └── assets-mobile/
├── services/
│   ├── platform-api/
│   └── meeting-service/
├── packages/
│   ├── ui/
│   ├── contracts/
│   ├── auth/
│   └── shared/
├── infrastructure/
├── tests/
└── docs/
~~~

## Local infrastructure

~~~bash
cd infrastructure/docker
cp .env.example .env
docker compose up -d
~~~

This starts PostgreSQL and Keycloak only. MeshCentral remains an external engine behind the adapter boundary.

## Local checks

~~~bash
pnpm install
pnpm typecheck
pnpm build
dotnet restore INNO.One.sln
dotnet build INNO.One.sln
~~~

Run the Web skeleton with `pnpm dev:web` and open `http://localhost:5180`.

## Scope rule

Step 14 intentionally contains no feature-heavy business implementation.
Frozen V1.26 screens are ported module-by-module in vertical slices.
