# New Module Checklist

Copy this into the module issue or PR.

## Ownership and shape

- [ ] Module owner/team is named.
- [ ] Primary user job is defined.
- [ ] Module ID and route are stable.
- [ ] Surface is defined: Web / Endpoint Agent / Android / internal.
- [ ] A separate service is justified if not using the Platform API modular monolith.

## Backend

- [ ] Backend project follows `INNO.One.Modules.<Module>`.
- [ ] Api/Application/Domain/Infrastructure/Persistence responsibilities are respected.
- [ ] No ProjectReference to another product module.
- [ ] No import of another product module namespace.
- [ ] Module owns its PostgreSQL schema.
- [ ] No cross-module database foreign key.
- [ ] Migrations alter only the module-owned schema.

## Integration

- [ ] Cross-module data uses stable IDs/contracts/readers/events/read models.
- [ ] Shared contract ownership is documented.
- [ ] Event payloads are minimal/versionable.
- [ ] Idempotency/retry is documented for side effects.
- [ ] External integrations expose health where appropriate.

## Security

- [ ] Entry permission is defined.
- [ ] API/use-case permissions are enforced server-side.
- [ ] Effective resource scope is honored where applicable.
- [ ] Secrets do not appear in logs/audit/health responses.

## Manifest and frontend

- [ ] `module-manifests.json` entry exists for user-facing modules.
- [ ] Entry/navigation permissions are declared.
- [ ] Dependencies are declared and acyclic.
- [ ] Frontend uses shared API/auth/UI packages.
- [ ] UX page pattern and required states are implemented.
- [ ] Accessibility rules are followed.

## Audit and tests

- [ ] Meaningful privileged changes are audited.
- [ ] Correlation/trace context is preserved.
- [ ] Unit tests cover important business rules.
- [ ] Integration tests cover API/auth/scope/persistence where relevant.
- [ ] Architecture/contract tests pass.
- [ ] Critical E2E journey exists where justified.
- [ ] `corepack pnpm run check` passes.
- [ ] `git diff --check` passes.
- [ ] CORE CI is green.
