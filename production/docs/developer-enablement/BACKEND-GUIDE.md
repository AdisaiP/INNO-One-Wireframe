# Backend Development Guide

## Canonical module shape

```text
services/platform-api/src/Modules/<Module>/
|-- Api/
|-- Application/
|-- Domain/
|-- Infrastructure/
|-- Persistence/
|-- <Module>Module.cs
`-- INNO.One.Modules.<Module>.csproj
```

Add only folders with a real responsibility.

## Layer responsibilities

### Api

Endpoint mapping, HTTP translation/status codes, permission entry points, and ETag/concurrency behavior.

### Application

Use-case orchestration, commands/queries, access-aware readers/providers, validation, and audit/event orchestration.

### Domain

Entities, value objects, invariants, business rules, and state transitions. Domain code must not import another product module namespace.

### Infrastructure

External adapters, workers, integration implementations, and operational health adapters.

### Persistence

Module DbContext, EF mappings, migrations, and approved development seed.

## Project reference rule

A product module may reference `INNO.One.Contracts` and `INNO.One.SharedKernel`.

It must not reference another `INNO.One.Modules.*` project.

## Data ownership

Current PostgreSQL schemas:

- Platform -> `platform`
- Devices -> `devices`
- Assets -> `assets`
- Helpdesk -> `helpdesk`
- Reports -> `reports`
- Workflows -> `workflows`

Never query another module's tables as an integration API, create cross-module database foreign keys, or run migrations against another module's schema.

## Authorization

Every protected use case evaluates a real permission server-side. UI visibility is not authorization. Resource-scoped access must honor effective Platform scope.

## Audit

Meaningful/privileged changes should record actor, module, action, target type/id, outcome, correlation ID, and trace ID. Never log secrets, tokens, passwords, or sensitive payloads.

## External integrations

Integrations such as MeshCentral and Keycloak stay behind adapter boundaries. Optional integrations must not make the platform unhealthy when intentionally disabled.
