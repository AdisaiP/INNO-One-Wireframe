# INNO.One — Backend Planning Index

**Planning branch:** `planning/backend-contracts`  
**UI source of truth:** Design System V1.18 / UI Contract 1.12.0  
**UI baseline:** 83 Web Portal routes + separate Endpoint Agent / Android Mobile surfaces  
**Status:** Planning only — no backend implementation in this branch  
**Date:** 2026-09-25

## Purpose

This planning set converts the frozen UI and module boundaries into backend contracts before implementation begins.

The documents deliberately separate:
- domain ownership,
- API ownership,
- permissions,
- events,
- persistence,
- external provider adapters,
- implementation sequencing.

The HTML prototype remains the UI contract. These documents define the backend contract expected to support it.

## Documents

1. **`INNO-One-Backend-Architecture.md`**
   - target architecture,
   - module boundaries,
   - Keycloak / MeshCentral / provider adapters,
   - modular-monolith rules,
   - runtime topology,
   - implementation phases.

2. **`INNO-One-Domain-Model.md`**
   - bounded contexts,
   - aggregates/entities,
   - cross-module references,
   - invariants,
   - ownership of the 83 Web routes.

3. **`INNO-One-API-Contract.md`**
   - API conventions,
   - list/filter/error contracts,
   - page-to-endpoint mapping,
   - commands and queries,
   - provider-independent resource identifiers.

4. **`INNO-One-Event-Catalog.md`**
   - event envelope,
   - delivery semantics,
   - module events,
   - producers/consumers,
   - outbox/inbox contract.

5. **`INNO-One-Permission-Matrix.md`**
   - permission namespace,
   - route-level permission requirements,
   - action-level permissions,
   - scope evaluation,
   - baseline role mapping.

6. **`INNO-One-Database-Plan.md`**
   - PostgreSQL logical schemas,
   - table ownership,
   - cross-module reference rules,
   - indexes,
   - provider mappings,
   - migrations and retention.

7. **`backend-planning-audit.py`**
   - verifies all current Web routes are mapped by the planning documents,
   - verifies planning source files exist,
   - guards against accidentally implementing backend code in the planning branch.

## Architecture decision summary

The initial backend should be a **modular monolith with explicit integration adapters and asynchronous events**, not a microservice fleet.

Why:
- INNO.One already has clear product modules but many cross-module UX references.
- Platform Identity / RBAC / App Registry / Notifications / Audit must stay consistent.
- A single transactional deployment is simpler while product boundaries are still evolving.
- MeshCentral, Keycloak, Meeting AI and other vendor/provider engines remain behind adapters.
- Module contracts make later extraction possible without designing distributed failure modes on day one.

## Proposed implementation order

```
0. Contracts only — this branch
   ↓
1. Platform Core
   Identity / session / organization / RBAC / scopes / module registry / audit
   ↓
2. Devices vertical slice
   Device List → Device Detail → Groups → provider mapping
   ↓
3. Helpdesk vertical slice
   Tickets → Ticket Detail → Create / Assign / Status / SLA clock
   ↓
4. Assets vertical slice
   Inventory → Detail → Ownership → QR token
   ↓
5. Meeting vertical slice
   Create → recording metadata → transcript → summary
   ↓
6. Reports / cross-module read models
```

No backend code should be started until the contracts in this planning set are reviewed and accepted.
