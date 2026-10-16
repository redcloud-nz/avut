#!/usr/bin/env bash
#
# dev — `next dev` on this checkout's port (see AGENTS.md → Dev servers).
#
# The port is $PORT if set, otherwise scripts/dev-port.sh's: 3000 in the main checkout, the
# worktree's .dev-port in a worktree. It is always passed explicitly, so Next fails on a busy
# port rather than quietly moving to the next one (3001 is `dev-email`'s). Off 3000, the
# inspector gets its own port too (port + 6229, so 3101 → 9330), instead of clashing on 9229.
#
# Usage:  npm run dev                 # the user, main checkout → 3000
#         PORT=3100 npm run dev       # an agent in the main checkout
#         npm run dev                 # anyone in a worktree → its .dev-port
#
# Set the port with PORT=, not `npm run dev -- -p`: the inspector port is worked out from PORT.
#
# Before starting, it checks (read-only) whether the database .env.local points at is missing
# migrations this checkout has. It only warns, and it tells two cases apart:
#   - migrations already on origin/integration: shared `avut` fell behind after someone merged
#     one. `npm run prisma migrate deploy` catches it up (the user's call).
#   - migrations only on this branch: they must never be deployed to shared `avut`. The branch
#     needs its own database copy first (`npm run db:branch <slug>`, AGENTS.md → Database).
# The check takes about two seconds; AVUT_SKIP_MIGRATION_CHECK=1 skips it.
#
set -euo pipefail

if [ "${AVUT_SKIP_MIGRATION_CHECK:-}" != 1 ]; then
    status="$(dotenv -e .env.local -- prisma migrate status 2>&1 || true)"
    if grep -q "not yet been applied" <<<"$status"; then
        pending="$(sed -n '/not yet been applied/,/^$/p' <<<"$status" | sed '1d;/^$/d')"
        merged="$(git ls-tree --name-only origin/integration prisma/migrations/ 2>/dev/null | sed 's#.*/##' || true)"
        on_integration="" branch_only=""
        while IFS= read -r name; do
            [ -n "$name" ] || continue
            if grep -qxF "$name" <<<"$merged"; then
                on_integration+="  $name"$'\n'
            else
                branch_only+="  $name"$'\n'
            fi
        done <<<"$pending"
        yellow=$'\033[1;33m' reset=$'\033[0m'
        if [ -n "$on_integration" ]; then
            printf '\n%s⚠ The database is behind integration. Missing:%s\n%s' "$yellow" "$reset" "$on_integration"
            printf '%s  Pages that use them will fail. Apply with: npm run prisma migrate deploy%s\n' "$yellow" "$reset"
        fi
        if [ -n "$branch_only" ]; then
            printf '\n%s⚠ This branch has migrations the database lacks:%s\n%s' "$yellow" "$reset" "$branch_only"
            printf '%s  Never deploy these to shared avut. On a db:branch copy, apply them with migrate dev;%s\n' "$yellow" "$reset"
            printf '%s  otherwise make one first: npm run db:branch <slug>%s\n' "$yellow" "$reset"
        fi
        echo
    fi
fi

port="${PORT:-$(bash "$(dirname "${BASH_SOURCE[0]}")/dev-port.sh")}"
inspect="--inspect"
if [ "$port" != 3000 ]; then inspect="--inspect=$((port + 6229))"; fi

PORT="$port" exec next dev "$inspect" -p "$port" "$@"
