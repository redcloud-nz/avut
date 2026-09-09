#!/usr/bin/env bash
#
# db-unbranch — point .env.local back at the shared `avut` database and drop the
# branch copy made by db-branch. Run this when the branch merges or is abandoned.
#
# Usage: npm run db:unbranch
#
set -euo pipefail

BASE_DB="avut"
env_file=".env.local"

[ -f "$env_file" ] || { echo "error: no .env.local in $(pwd)" >&2; exit 1; }

cur_db="$(sed -nE 's/^POSTGRES_DATABASE="?([^"]+)"?.*/\1/p' "$env_file")"
if [ "$cur_db" = "$BASE_DB" ] || [ -z "$cur_db" ]; then
  echo "nothing to do — .env.local already points at '$BASE_DB'."
  exit 0
fi

nonpool="$(sed -nE 's/^POSTGRES_URL_NON_POOLING="?([^"]+)"?.*/\1/p' "$env_file")"
admin_url="${nonpool%/*}/postgres"

perl -i -pe "
  s{(POSTGRES_(?:PRISMA_URL|URL_NON_POOLING)=\"[^\"]*/)\Q$cur_db\E\"}{\${1}$BASE_DB\"};
  s{(POSTGRES_DATABASE=\")\Q$cur_db\E\"}{\${1}$BASE_DB\"};
" "$env_file"
echo ".env.local restored to '$BASE_DB'."

read -r -p "drop database '$cur_db'? [y/N] " ans
case "$ans" in
  y | Y)
    psql "$admin_url" -v ON_ERROR_STOP=1 -q <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$cur_db' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$cur_db";
SQL
    echo "dropped '$cur_db'."
    ;;
  *)
    echo "left '$cur_db' in place — drop it later with: dropdb '$cur_db'"
    ;;
esac
