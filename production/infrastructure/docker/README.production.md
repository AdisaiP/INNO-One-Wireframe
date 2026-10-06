# INNO.One production Docker deployment

The production stack is defined by `compose.production.yml`. It is intentionally separate from the local development compose file.

## Default ports on 172.10.1.58

- Web Portal / reverse proxy: 8082
- PostgreSQL: 5433
- Keycloak: 8180
- MeshCentral: 8445

These defaults avoid the existing legacy `innoone` stack and allow acceptance before retiring `inno-one-step18`.

## Prepare

```bash
cd production/infrastructure/docker
cp .env.production.example .env.production
# Replace every CHANGE_ME value with a strong secret.
docker compose --env-file .env.production -f compose.production.yml config
```

## Build

```bash
docker compose --env-file .env.production -f compose.production.yml build
```

## Migrate Step18 data

Start only the new PostgreSQL service first:

```bash
docker compose --env-file .env.production -f compose.production.yml up -d postgres
../../scripts/production-migrate-step18.sh
```

The migration script restores `inno_core` and `inno_meeting`. It also retains a Keycloak SQL backup for rollback, but the production Keycloak database is intentionally initialized from the current main-branch realm so redirect URIs match the production Portal.

## Start the stack

```bash
docker compose --env-file .env.production -f compose.production.yml up -d
python3 ../../scripts/production-meshcentral-init.py
```

## Acceptance

```bash
curl -fsS http://172.10.1.58:8082/health
curl -fsS http://172.10.1.58:8082/health/web
curl -fsS http://172.10.1.58:8082/health/platform
curl -fsS http://172.10.1.58:8082/health/meeting
curl -fsS http://172.10.1.58:8180/realms/inno-one/.well-known/openid-configuration
curl -kfsS https://172.10.1.58:8445/health.ashx
```

Do not retire `inno-one-step18` until the new stack passes runtime and browser acceptance. Do not remove old volumes until a rollback backup has been verified.
