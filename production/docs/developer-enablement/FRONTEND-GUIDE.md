# Frontend Development Guide

## Current stack

Web Portal uses React, TypeScript, Vite, React Router, TanStack React Query, Keycloak JS, and shared workspace packages.

## Ownership

A page belongs to the business module that owns the user job.

For new substantial work, prefer module-oriented organization:

```text
src/modules/<module>/
|-- pages/
|-- components/
|-- hooks/
|-- api/
`-- routes.tsx
```

Existing pages under `src/pages/` remain valid. Refactor incrementally when a module is actively developed.

## Shared UI

Reuse `@inno/ui` and existing shared components before creating a module-local duplicate.

## Data access

- Use the shared API client pattern.
- Use TanStack React Query for server state where appropriate.
- Keep API transport types separate from view state when they differ.
- Handle loading, error, permission, empty, no-results, offline, and partial-failure states.

## Authentication and authorization

Authentication uses Keycloak. Navigation/launcher visibility may use module availability and permissions, but backend APIs independently enforce authorization.

## Module registration

User-facing modules register in `production/module-manifests.json`.

The manifest declares stable module id, route, launcher visibility, entry permission, dependencies, permissions, navigation, events, and capabilities.

## Language

- Web Portal and Design System UI: English.
- Endpoint Agent and Android Mobile UI: Thai.
- Thai business/sample content in Web pages is allowed when semantically marked.

## Avoid

- copies of shared buttons/tables/modals,
- direct module-to-module data coupling in the browser,
- hard-coded authorization assumptions,
- fake controls with no working behavior,
- new design patterns that bypass frozen UX contracts.
