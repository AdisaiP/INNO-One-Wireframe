# INNO.One production Docker deployment

The production stack is defined by `compose.production.yml`. It is intentionally separate from the local development compose file.

## Default ports on 172.10.1.58

- Web Portal HTTP redirect: 8082
- Web Portal HTTPS: 8446
- PostgreSQL: 5433
- Keycloak diagnostic port: 8180, relative path `/auth`
- MeshCentral: 8445

These defaults avoid the existing legacy `innoone` stack and allow acceptance before retiring `inno-one-step18`.

## Prepare

```bash
cd production/infrastructure/docker
cp .env.production.example .env.production
# Replace every CHANGE_ME value with a strong secret.
../../scripts/production-generate-tls.sh
docker compose --env-file .env.production -f compose.production.yml config
```

The TLS generator creates an INNO.One internal CA and a server certificate under the ignored `infrastructure/docker/tls/` directory. The CA certificate must be trusted on managed client workstations before browser acceptance. Keep the CA private key on the server only.

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

Use the generated CA for command-line TLS verification:

```bash
curl --cacert tls/ca.crt -fsS https://172.10.1.58:8446/health
curl --cacert tls/ca.crt -fsS https://172.10.1.58:8446/health/web
curl --cacert tls/ca.crt -fsS https://172.10.1.58:8446/health/platform
curl --cacert tls/ca.crt -fsS https://172.10.1.58:8446/health/meeting
curl --cacert tls/ca.crt -fsS https://172.10.1.58:8446/auth/realms/inno-one/.well-known/openid-configuration
curl -kfsS https://172.10.1.58:8445/health.ashx
```

Then verify a managed browser trusts `tls/ca.crt`, completes Keycloak PKCE sign-in over HTTPS, loads the Product shell, and can call the Product API.

Do not retire `inno-one-step18` until the new stack passes runtime and browser acceptance. Do not remove old volumes until a rollback backup has been verified.
