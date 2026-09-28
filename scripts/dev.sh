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
set -euo pipefail

port="${PORT:-$(bash "$(dirname "${BASH_SOURCE[0]}")/dev-port.sh")}"
inspect="--inspect"
if [ "$port" != 3000 ]; then inspect="--inspect=$((port + 6229))"; fi

PORT="$port" exec next dev "$inspect" -p "$port" "$@"
