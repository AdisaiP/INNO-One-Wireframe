#!/usr/bin/env bash
set -euo pipefail

OLD_POSTGRES_CONTAINER="${OLD_POSTGRES_CONTAINER:-inno-one-step18-postgres-1}"
NEW_POSTGRES_CONTAINER="${NEW_POSTGRES_CONTAINER:-inno-one-production-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-inno}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/inno-one-production-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

mkdir -p "$BACKUP_DIR"

for container in "$OLD_POSTGRES_CONTAINER" "$NEW_POSTGRES_CONTAINER"; do
  if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "required container not found: $container" >&2
    exit 1
  fi
done

for database in inno_core inno_meeting keycloak; do
  echo "backing up $database from $OLD_POSTGRES_CONTAINER"
  docker exec "$OLD_POSTGRES_CONTAINER"     pg_dump -U "$POSTGRES_USER" -d "$database"       --clean --if-exists --no-owner --no-privileges     > "$BACKUP_DIR/$database.sql"
done

for database in inno_core inno_meeting; do
  echo "restoring $database into $NEW_POSTGRES_CONTAINER"
  docker exec -i "$NEW_POSTGRES_CONTAINER"     psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$database"     < "$BACKUP_DIR/$database.sql"
done

echo "keycloak backup retained but intentionally not restored; production imports the main-branch realm."
echo "migration_backup=$BACKUP_DIR"
