#!/usr/bin/env bash
#
# dev-port — print this checkout's dev-server port (see AGENTS.md → Dev servers).
#
#   main checkout   3000, the user's own server. An agent there runs `PORT=3100 npm run dev`
#                   instead; this script doesn't know who is asking.
#   worktree        the port in its .dev-port. The first call allocates one: the lowest port
#                   from 3101 that no other worktree's .dev-port holds. It is written once and
#                   kept, so a worktree's URLs stay the same for its whole life.
#
# Usage:  bash scripts/dev-port.sh            # from anywhere in the checkout
#
set -euo pipefail

common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
root="$(cd "$(dirname "$common_dir")" && pwd)"
top="$(git rev-parse --show-toplevel)"

if [ "$top" = "$root" ]; then
  echo 3000
  exit 0
fi

if [ -s "$top/.dev-port" ]; then
  cat "$top/.dev-port"
  exit 0
fi

# Ports held by the other worktrees git knows about. A deleted worktree's port frees itself: it
# drops out of `git worktree list` (after `git worktree prune`) along with its .dev-port.
taken=" "
while IFS= read -r line; do
  case "$line" in
    "worktree "*)
      wt="${line#worktree }"
      if [ "$wt" != "$top" ] && [ -s "$wt/.dev-port" ]; then taken="$taken$(cat "$wt/.dev-port") "; fi
      ;;
  esac
done < <(git worktree list --porcelain)

# Branches older than the .gitignore rule would show .dev-port as untracked, so exclude it for
# every worktree through the shared info/exclude as well.
exclude="$common_dir/info/exclude"
mkdir -p "$(dirname "$exclude")"
grep -qx '.dev-port' "$exclude" 2>/dev/null || echo '.dev-port' >> "$exclude"

port=3101
while [[ "$taken" == *" $port "* ]]; do port=$((port + 1)); done
echo "$port" > "$top/.dev-port"
echo "$port"
