# CORE Web E2E

This suite covers browser-level golden paths across the real local authentication and application stack.

## Current golden path

- Keycloak Authorization Code + PKCE sign-in
- authenticated `GET /api/v1/platform/me`
- Workspace shell
- Apps launcher
- opening an allowed Devices module

The CI workflow starts the existing local PostgreSQL + Keycloak stack, runs the Platform API with migrations and development seed data, starts the Vite Web Portal, and executes Playwright against Chromium.

## Test identity

The test reuses the development-only Keycloak realm identity:

- username: `adisai`
- password: `inno_dev_only`

These credentials are development fixtures only and are defined in the local realm import. They must never be used for UAT or production.

## Run locally

Prerequisites:

- Docker
- Node/Corepack
- .NET 10
- Playwright Chromium

From `production/`:

~~~bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @inno/e2e exec playwright install chromium
docker compose -f infrastructure/docker/compose.yml up -d postgres keycloak
~~~

Start the Platform API with the development migration/seed settings, start `corepack pnpm dev:web`, then run:

~~~bash
corepack pnpm --filter @inno/e2e test
~~~
