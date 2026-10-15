# Platform Architecture

## High-level model

```text
Web Portal / Endpoint Agent / Android
                |
                v
        Platform API (.NET 10)
                |
      +---------+---------+
      |   Platform CORE   |
      | Auth/RBAC/Audit   |
      +---------+---------+
                |
   +------------+-------------+
   |            |             |
 Devices      Assets       Helpdesk
   |            |             |
   +--------- Contracts -------+
                |
          PostgreSQL schemas

External boundaries:
- Keycloak
- MeshCentral
- separate Meeting service where justified
```

## Architecture style

The main backend is a Modular Monolith.

A new business module normally belongs under:

```text
services/platform-api/src/Modules/<Module>/
```

A module does not automatically become a microservice.

## Platform CORE responsibilities

CORE owns shared platform capabilities and contracts such as application-user gating, authentication/authorization integration, RBAC/effective scope, module registration/availability, audit/correlation/trace, health/readiness, architecture contracts, and CI/E2E foundation.

CORE should not absorb product-specific domain rules.

## Module responsibilities

Each module owns its domain model, use cases, API surface, persistence schema/migrations, permissions, audit behavior, events, and user-facing module metadata.

## Surface ownership

### Web Portal

Workspace, Apps, Devices, Assets, Helpdesk operator console, Reports, Admin Center, and browser workflows.

### Endpoint Agent

Managed-endpoint interactions such as Request Help, ownership confirmation, and real remote-consent prompts.

### Android

Mobile asset workflows such as scanning and field operations.

Do not move a feature between surfaces for implementation convenience.
