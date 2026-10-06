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
# migrations from this branch, which is what happens to shared `avut` after someone merges a
# migration. It only warns: applying them is `npm run prisma migrate deploy`, and that's the
# user's call. The check takes about two seconds; AVUT_SKIP_MIGRATION_CHECK=1 skips it.
#
set -euo pipefail

if [ "${AVUT_SKIP_MIGRATION_CHECK:-}" != 1 ]; then
    status="$(dotenv -e .env.local -- prisma migrate status 2>&1 || true)"
    if grep -q "not yet been applied" <<<"$status"; then
        pending="$(sed -n '/not yet been applied/,/^$/p' <<<"$status" | sed '1d;/^$/d')"
        printf '\n\033[1;33m⚠ The database is missing migrations this branch has:\033[0m\n%s\n' "$pending"
        printf '\033[1;33m  Pages that use them will fail. Apply with: npm run prisma migrate deploy\033[0m\n\n'
    fi
fi

port="${PORT:-$(bash "$(dirname "${BASH_SOURCE[0]}")/dev-port.sh")}"
inspect="--inspect"
if [ "$port" != 3000 ]; then inspect="--inspect=$((port + 6229))"; fi

PORT="$port" exec next dev "$inspect" -p "$port" "$@"
