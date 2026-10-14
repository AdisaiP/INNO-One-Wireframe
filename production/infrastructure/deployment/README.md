# INNO.One Deployment Contract

This document defines the environment, migration, rollback, and acceptance contract for the shared INNO.One platform. Product modules must not encode deployment topology inside their business projects.

## Supported environment classes

### Local / Development

Purpose:
- developer iteration
- integration tests
- local Keycloak/PostgreSQL
- development seed identities

Rules:
- development-only credentials and seed data are allowed
- HTTP is allowed on loopback/local infrastructure
- production data must never be restored into a developer database without an explicit sanitized-data process

### Test / UAT

Purpose:
- release candidate validation
- user acceptance
- integration verification against production-like configuration

Rules:
- no development seed credentials
- separate database and Keycloak realm/data from production
- HTTPS and real origin rules
- production-like module availability and permission model
- test secrets stored outside Git

### Production

Purpose:
- customer workload

Rules:
- `ASPNETCORE_ENVIRONMENT=Production`
- `DevelopmentSeed__Enabled=false`
- HTTPS at the public reverse proxy
- public Keycloak URL must be HTTPS
- MeshCentral WebSocket URL must be WSS
- secrets are supplied at deployment time and never committed
- database migrations occur only after a verified backup/rollback point
- acceptance checks must pass before retiring the previous stack

## Production input contract

The canonical template is:

`infrastructure/docker/.env.production.example`

Create:

`infrastructure/docker/.env.production`

Required categories:

- public host and exposed ports
- public Portal, Keycloak, MeshCentral, and Endpoint Agent URLs
- PostgreSQL identity and secret
- Keycloak bootstrap identity and secret
- MeshCentral integration identity and secret

Validate before any build/start:

~~~bash
cd production
python3 scripts/production_preflight.py --env infrastructure/docker/.env.production
docker compose --env-file infrastructure/docker/.env.production \
  -f infrastructure/docker/compose.production.yml config
~~~

The preflight intentionally never prints secret values.

## Secret handling

Do not commit:

- `.env.production`
- TLS private keys
- database passwords
- Keycloak admin password
- MeshCentral password
- access tokens

Preferred deployment sources are the target platform secret store, protected environment files, or an equivalent organization-approved secret mechanism.

Rotate a secret when:
- it is exposed in logs/chat/tickets
- a privileged operator leaves the role
- the target system reports compromise
- the organization rotation policy requires it

## Fresh deployment order

1. Validate the production environment with `production_preflight.py`.
2. Generate/install TLS material.
3. Start PostgreSQL.
4. Verify PostgreSQL health.
5. Start Keycloak and import/validate the current realm.
6. Start MeshCentral and initialize the integration account.
7. Start Platform API; migrations run against the CORE/module schemas.
8. Start Meeting Service.
9. Start Web Portal and reverse proxy.
10. Run deterministic production acceptance.
11. Complete managed-browser sign-in acceptance.
12. Only then direct production users/agents to the new stack.

## Upgrade / migration order

Before changing a running production database:

1. Record the deployed Git commit/tag and current container image identifiers.
2. Back up all databases affected by the release.
3. Verify the backup files are non-empty and restorable in a disposable environment when feasible.
4. Preserve the previous application/compose configuration.
5. Apply the release migrations once.
6. Start the new services.
7. Run health and functional acceptance.
8. Keep old volumes/backups until the rollback window closes.

For the legacy Step18 transition, use:

~~~bash
cd production/infrastructure/docker
docker compose --env-file .env.production -f compose.production.yml up -d postgres
../../scripts/migrate-legacy-step18.sh
~~~

That script backs up the legacy databases before restoring CORE/Meeting data into the new PostgreSQL service.

## Rollback contract

Application rollback is allowed when the previous application version is compatible with the migrated database.

If a migration is not backward compatible:

1. stop write traffic to the failed new stack
2. stop the new application services
3. preserve the failed database for diagnosis
4. restore the verified pre-release database backup
5. restore the previous application/compose configuration
6. start the previous stack
7. run the same acceptance checks against the restored stack
8. document the failed release and migration point

Never attempt an ad-hoc destructive downgrade against live production data.

## Production acceptance

Run from `production/`:

~~~bash
python3 scripts/production_acceptance.py \
  --env infrastructure/docker/.env.production \
  --ca infrastructure/docker/tls/ca.crt
~~~

The script validates:

- reverse proxy
- Web Portal
- Platform API dependency-aware readiness
- Meeting Service
- Keycloak discovery
- MeshCentral health

During an explicitly approved coexistence window, MeshCentral may be skipped:

~~~bash
python3 scripts/production_acceptance.py \
  --env infrastructure/docker/.env.production \
  --ca infrastructure/docker/tls/ca.crt \
  --skip-meshcentral
~~~

After command-line acceptance, complete browser acceptance:

1. managed browser trusts the INNO.One CA
2. Keycloak PKCE sign-in succeeds
3. Workspace loads
4. allowed applications/modules are visible
5. one protected Platform API call succeeds
6. an auditable privileged action produces a searchable audit record

## Release evidence

For every production release record:

- Git commit/tag
- deployment timestamp
- operator
- database backup location/reference
- migration result
- `production_preflight.py` result
- `production_acceptance.py` result
- browser acceptance result
- rollback decision/window
