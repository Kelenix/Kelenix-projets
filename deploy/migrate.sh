#!/usr/bin/env bash
# Applique les migrations de supabase/migrations non encore jouées, chacune dans une transaction.
# Même table de suivi que la Supabase CLI (supabase_migrations.schema_migrations).
set -euo pipefail
cd "$(dirname "$0")"

# PROJECT et ENV_FILE sont fournis par deploy.sh (ex. kelenix-prod et .env.prod).
psql() {
  docker compose -p "$PROJECT" --env-file "$ENV_FILE" exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
    psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

psql -c "set client_min_messages to warning;
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"

for file in migrations/*.sql; do
  base=$(basename "$file" .sql)
  version=${base%%_*}
  name=${base#*_}
  if [ -n "$(psql -tAc "select 1 from supabase_migrations.schema_migrations where version = '$version'")" ]; then
    continue
  fi
  echo "Migration $base"
  {
    echo "begin;"
    cat "$file"
    echo
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');"
    echo "commit;"
  } | psql
done
