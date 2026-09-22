#!/usr/bin/env bash
#
# worktree-setup — make a fresh git worktree ready to work in: copy .env.local, link .vercel,
# install dependencies and generate the Prisma client and typed routes. Safe to re-run; the install
# is skipped once done, and the generated code is refreshed every time.
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

# node_modules is gitignored. Two ways to fill it, both ending with the root `postinstall`
# (`prisma generate`) and `prepare` (`husky`, which the pre-commit hook needs):
#
#   1. macOS: clone the main checkout's node_modules with one clonefile(2) call (APFS, a couple of
#      seconds, shares disk blocks so it costs almost no space), then `npm install --no-save` to
#      reconcile it with this branch's package-lock.json. --no-save keeps the lockfile untouched.
#   2. Otherwise, or if either step fails: `npm ci`, which installs exactly what the lockfile says.
#
# node_modules can be left half-installed by a failed run, so "done" is a marker written at the end
# rather than the directory existing.

# run_quiet <cmd...> — silent on success; on failure prints the captured output and returns 1.
run_quiet() {
  local log
  log="$(mktemp)"
  if "$@" >"$log" 2>&1; then
    rm -f "$log"
    return 0
  fi
  cat "$log" >&2
  rm -f "$log"
  return 1
}

# Replace ./node_modules with a copy-on-write clone of the main checkout's. Fails (so the caller falls
# back to `npm ci`) off macOS, without python3 (no shell command clones a directory tree in one call),
# without a finished install to clone, or across volumes.
clone_node_modules() {
  [ "$(uname)" = Darwin ] && command -v python3 >/dev/null 2>&1 || return 1
  [ -f "$root/node_modules/.package-lock.json" ] || return 1
  rm -rf node_modules
  python3 - "$root/node_modules" node_modules <<'PY' || return 1
import ctypes, sys
libc = ctypes.CDLL("libSystem.dylib", use_errno=True)
sys.exit(0 if libc.clonefile(sys.argv[1].encode(), sys.argv[2].encode(), 0) == 0 else 1)
PY
}

installed_now=0
if [ -f node_modules/.avut-installed ]; then
  echo "  – dependencies already installed (delete node_modules to reinstall)"
else
  installed_now=1
  install_mode=""
  if clone_node_modules; then
    echo "  … node_modules cloned from the main checkout; npm install to reconcile"
    if run_quiet npm install --no-save --prefer-offline --no-audit --no-fund --loglevel=error; then
      install_mode="cloned"
    else
      echo "  ! reconcile failed (log above), falling back to npm ci" >&2
      rm -rf node_modules
    fi
  fi
  if [ -z "$install_mode" ]; then
    echo "  … npm ci"
    if ! run_quiet npm ci --no-audit --no-fund --loglevel=error; then
      echo "error: npm ci failed (log above)" >&2
      exit 1
    fi
    install_mode="npm ci"
  fi
  touch node_modules/.avut-installed
  echo "  ✓ dependencies installed ($install_mode)"
fi

# A fresh install has just run `prisma generate` via postinstall. On a re-run it hasn't, and
# src/generated is gitignored, so refresh it here — a schema change on the branch, or a deleted
# directory, would otherwise leave a stale client that only shows up as type errors.
if [ "$installed_now" = 0 ]; then
  echo "  … prisma generate"
  if ! run_quiet npx prisma generate; then
    echo "error: prisma generate failed (log above)" >&2
    exit 1
  fi
  echo "  ✓ prisma client generated"
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
