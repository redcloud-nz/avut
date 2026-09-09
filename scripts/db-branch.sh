#!/usr/bin/env bash
#
# db-branch — give the current checkout its own copy of the dev database.
#
# Run this before `npm run prisma migrate dev` on a branch that ADDS a migration,
# so the shared `avut` database never drifts to a branch's schema. The copy is made
# with `CREATE DATABASE ... TEMPLATE avut`, which needs zero other connections to
# `avut` — stop your dev server first (the script will refuse otherwise).
#
# Usage:   npm run db:branch <slug>          e.g. npm run db:branch add-widget-table
# Undo:    npm run db:unbranch
#
set -euo pipefail

BASE_DB="avut"
slug="${1:-}"

if [ -z "$slug" ]; then
  echo "usage: npm run db:branch <slug>" >&2
  exit 1
fi
# normalise: lowercase, non-alnum -> _
slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+|_+$//g')"
branch_db="${BASE_DB}_${slug}"

env_file=".env.local"
if [ -L "$env_file" ]; then
  target="$(readlink "$env_file")"
  rm "$env_file"
  cp "$target" "$env_file"
  echo "note: converted .env.local from a symlink to a copy (so DB config stays local to this checkout)"
fi
[ -f "$env_file" ] || { echo "error: no .env.local in $(pwd)" >&2; exit 1; }

cur_db="$(sed -nE 's/^POSTGRES_DATABASE="?([^"]+)"?.*/\1/p' "$env_file")"
if [ "$cur_db" != "$BASE_DB" ]; then
  echo "error: .env.local already points at '$cur_db', not '$BASE_DB'. Run 'npm run db:unbranch' first." >&2
  exit 1
fi

nonpool="$(sed -nE 's/^POSTGRES_URL_NON_POOLING="?([^"]+)"?.*/\1/p' "$env_file")"
[ -n "$nonpool" ] || { echo "error: POSTGRES_URL_NON_POOLING not found in .env.local" >&2; exit 1; }
admin_url="${nonpool%/*}/postgres"

live="$(psql "$admin_url" -tAc "SELECT count(*) FROM pg_stat_activity WHERE datname = '$BASE_DB' AND pid <> pg_backend_pid();")"
if [ "${live:-0}" -ne 0 ]; then
  echo "error: $live active connection(s) to '$BASE_DB'. Stop the dev server (and Prisma Studio) and retry." >&2
  exit 1
fi

echo "creating '$branch_db' from template '$BASE_DB' ..."
psql "$admin_url" -v ON_ERROR_STOP=1 -q <<SQL
DROP DATABASE IF EXISTS "$branch_db";
CREATE DATABASE "$branch_db" TEMPLATE "$BASE_DB";
SQL

perl -i -pe "
  s{(POSTGRES_(?:PRISMA_URL|URL_NON_POOLING)=\"[^\"]*/)\Q$BASE_DB\E\"}{\${1}$branch_db\"};
  s{(POSTGRES_DATABASE=\")\Q$BASE_DB\E\"}{\${1}$branch_db\"};
" "$env_file"

echo
echo "done — .env.local now points at '$branch_db'."
echo "next: restart the dev server, then 'npm run prisma migrate dev'."
