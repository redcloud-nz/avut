#!/usr/bin/env bash
#
# worktree-setup — make a fresh git worktree ready to work in: copy .env.local, link .vercel,
# install dependencies and generate the typed routes. Safe to re-run; steps already done are skipped.
#
# Usage:  npm run worktree:setup [<name>]
#   e.g.  npm run worktree:setup                      # from inside the worktree
#         npm run worktree:setup skill-package-io     # from anywhere, by name under .claude/worktrees/
#
# <name> is a directory name under .claude/worktrees/ (a path also works).
#
# Does not start a dev server or run `npm run db:branch` — both are your call (see AGENTS.md):
# ask before starting a dev server, and branch the database only when a migration is coming.
#
set -euo pipefail

# repo root = parent of the shared git dir (works from any linked worktree)
common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
root="$(cd "$(dirname "$common_dir")" && pwd)"

name="${1:-}"
if [ -z "$name" ]; then
  wt="$(git rev-parse --show-toplevel)"
elif [ -d "$name" ]; then
  wt="$(cd "$name" && pwd)"
else
  wt="$root/.claude/worktrees/$(basename "$name")"
fi

if [ ! -d "$wt" ]; then
  echo "error: no worktree at $wt" >&2
  exit 1
fi
if [ "$wt" = "$root" ]; then
  echo "error: $wt is the main checkout, not a worktree" >&2
  exit 1
fi
if [ ! -f "$root/.env.local" ] && [ ! -f "$wt/.env.local" ]; then
  echo "error: no .env.local in the main checkout ($root) to copy" >&2
  exit 1
fi

cd "$wt"
echo "worktree-setup: $wt"

# .env.local is copied, not symlinked, so db:branch can repoint this worktree's copy without
# touching the shared one.
if [ -e .env.local ]; then
  echo "  – .env.local already present"
else
  cp "$root/.env.local" .env.local
  echo "  ✓ .env.local copied"
fi

# Only for the Vercel CLI / skills.
if [ -e .vercel ] || [ -L .vercel ]; then
  echo "  – .vercel already present"
elif [ -d "$root/.vercel" ]; then
  ln -s "$root/.vercel" .vercel
  echo "  ✓ .vercel linked"
else
  echo "  – no .vercel in the main checkout, skipped"
fi

# node_modules is gitignored. `npm ci` installs exactly what package-lock.json says (no lockfile
# churn in the new worktree), and its postinstall runs `prisma generate` and `husky`, which the
# pre-commit hook needs.
#
# `prisma generate` never opens a connection, but prisma.config.ts reads only `.env` (not
# `.env.local`) and insists the URL is set, so a bare install fails. Give it the same placeholder CI
# uses unless the shell already exports a real one.
#
# node_modules can be left half-installed by a failed run, so "done" is a marker written at the end
# rather than the directory existing.
if [ -f node_modules/.avut-installed ]; then
  echo "  – dependencies already installed (delete node_modules to reinstall)"
else
  echo "  … npm ci"
  install_log="$(mktemp)"
  if POSTGRES_PRISMA_URL="${POSTGRES_PRISMA_URL:-postgresql://user:password@localhost:5432/postgres}" \
    npm ci --no-audit --no-fund --loglevel=error >"$install_log" 2>&1; then
    rm -f "$install_log"
  else
    cat "$install_log" >&2
    rm -f "$install_log"
    echo "error: npm ci failed (log above)" >&2
    exit 1
  fi
  touch node_modules/.avut-installed
  echo "  ✓ dependencies installed"
fi

# .next is per-worktree; typed routes won't resolve until this has run.
echo "  … next typegen"
npx next typegen >/dev/null
echo "  ✓ route types generated"

# Suggest the first free port from 3100 so this doesn't collide with the main checkout's 3000.
port=3100
while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do port=$((port + 1)); done

cat <<EOF

ready. Next:
  cd $wt
  npm run check                 # typecheck, lint and related tests
  npm run dev -- -p $port       # ask first — the user may already have a dev server up
If the branch will add a Prisma migration, run \`npm run db:branch <slug>\` before \`prisma migrate dev\`.
EOF
