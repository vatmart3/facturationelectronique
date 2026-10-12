#!/usr/bin/env bash
# Démarre un Supabase local : Postgres (déjà lancé), supabase/auth, PostgREST, routeur.
# Variables : PG_ADMIN_URL, AUTH_BIN, POSTGREST_BIN, BASE (nom de la base), DOSSIER_LOGS.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$ICI/../.."
PG_ADMIN_URL="${PG_ADMIN_URL:-postgres://postgres:postgres@localhost:54329/postgres}"
BASE="${BASE:-pastille_local}"
LOGS="${DOSSIER_LOGS:-/tmp/pastille-local}"
SECRET="${JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters}"
mkdir -p "$LOGS"
# Arrête une éventuelle pile précédente (PID enregistrés au lancement).
for f in "$LOGS"/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
sleep 0.5
PG_HOTE="${PG_ADMIN_URL#*@}"; PG_HOTE="${PG_HOTE%%/*}"

psql "$PG_ADMIN_URL" -qc "drop database if exists $BASE with (force)" -c "create database $BASE"
DB_URL="${PG_ADMIN_URL%/*}/$BASE"
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$ICI/preparer.sql"

# 1. Service d'authentification : crée le schéma auth (users, sessions, auth.uid()…).
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:auth@$PG_HOTE/$BASE" \
  GOTRUE_SITE_URL="${SITE_URL:-http://localhost:3300}" GOTRUE_URI_ALLOW_LIST="*" API_EXTERNAL_URL="http://localhost:54321/auth/v1" \
  GOTRUE_JWT_SECRET="$SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false \
  GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_LOG_LEVEL=warn
(cd "$(dirname "$AUTH_BIN")" && "$AUTH_BIN" migrate > "$LOGS/auth-migrate.log" 2>&1) || { echo "migrations auth en échec"; tail -20 "$LOGS/auth-migrate.log"; exit 1; }
(cd "$(dirname "$AUTH_BIN")" && nohup "$AUTH_BIN" serve > "$LOGS/auth.log" 2>&1 & echo $! > "$LOGS/auth.pid")
for i in $(seq 1 40); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 0.5; done
curl -sf http://127.0.0.1:9999/health >/dev/null || { echo "auth ne démarre pas"; tail -20 "$LOGS/auth.log"; exit 1; }

# 2. Stockage minimal puis migrations de l'application.
psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid default auth.uid());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
SQL
for f in "$RACINE"/supabase/migrations/*.sql; do psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$DB_URL" -qc "notify pgrst, 'reload schema'"

# 3. PostgREST.
cat > "$LOGS/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:authenticator@$PG_HOTE/$BASE"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3010
CONF
nohup "$POSTGREST_BIN" "$LOGS/postgrest.conf" > "$LOGS/postgrest.log" 2>&1 &
echo $! > "$LOGS/postgrest.pid"

# 4. Routeur.
PORT= nohup node "$ICI/routeur.mjs" > "$LOGS/routeur.log" 2>&1 &
echo $! > "$LOGS/routeur.pid"
sleep 1
node "$ICI/cles.mjs" "$SECRET"
