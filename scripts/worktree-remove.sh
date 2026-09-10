#!/usr/bin/env bash
#
# worktree-remove — remove a worktree under .claude/worktrees/, first dropping any
# db:branch database copy it still points at (a branch DB should never outlive its
# worktree).
#
# Usage:  npm run worktree:remove <name> [-- <git worktree remove flags>]
#   e.g.  npm run worktree:remove skill-package-io
#         npm run worktree:remove skill-package-io -- --force
#
# <name> is a directory name under .claude/worktrees/ (a path also works).
#
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

name="${1:-}"
if [ -z "$name" ]; then
  echo "usage: npm run worktree:remove <name> [-- <git worktree remove flags>]" >&2
  exit 1
fi
shift

# repo root = parent of the shared git dir (works from any linked worktree)
common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
root="$(cd "$(dirname "$common_dir")" && pwd)"
wt="$root/.claude/worktrees/$(basename "$name")"

if [ ! -d "$wt" ]; then
  echo "error: no worktree at $wt" >&2
  exit 1
fi

# Drop the branch DB (if any) before removing the tree. Run *this* checkout's
# db-unbranch against the target worktree's .env.local — the worktree's own copy
# of the script may predate the --yes flag.
if [ -f "$wt/.env.local" ]; then
  cur_db="$(sed -nE 's/^POSTGRES_DATABASE="?([^"]+)"?.*/\1/p' "$wt/.env.local")"
  if [ -n "$cur_db" ] && [ "$cur_db" != "avut" ]; then
    echo "worktree is on branch DB '$cur_db' — dropping it first ..."
    (cd "$wt" && bash "$script_dir/db-unbranch.sh" --yes)
  fi
fi

git worktree remove "$@" "$wt"
git worktree prune
echo "removed worktree $wt"
