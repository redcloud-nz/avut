#!/usr/bin/env bash
#
# check — typecheck, lint and run the tests related to what you changed, in one command.
#
# Usage:  npm run check             # files changed since the merge-base with origin/integration
#         npm run check -- --all    # whole project: `eslint .` and the full test suite
#
# Runs tsc, eslint and vitest together and prints one line per step; a step's output is shown
# only when it fails (the first lines, plus the path of the full log). Exits 1 if any step fails.
#
#   tsc     whole project (it can't be scoped), preceded by `next typegen` when route files changed
#           or .next/types is missing. Stale generated route types are retried once — see AGENTS.md.
#   eslint  changed .ts/.tsx/.mjs/.js files; the whole project if the ESLint config or rules changed.
#           Warnings don't fail it, matching CI.
#   vitest  `vitest related` for the changed src/prisma files (tests importing them, and changed tests).
#
# Deliberately does not run prettier: the pre-commit hook (lint-staged) formats what you commit,
# so a check has nothing useful to say about formatting.
#
# Never touches the database — tsc and eslint don't connect to it and the tests use prisma-mock.
#
set -uo pipefail

all=0
case "${1:-}" in
  "") ;;
  --all) all=1 ;;
  -h | --help)
    sed -n '2,/^set /p' "$0" | sed '$d'
    exit 0
    ;;
  *)
    echo "usage: npm run check [-- --all]" >&2
    exit 2
    ;;
esac

cd "$(git rev-parse --show-toplevel)"

if git rev-parse --verify -q origin/integration >/dev/null; then
  base="$(git merge-base HEAD origin/integration)"
  base_label="origin/integration"
else
  base="HEAD"
  base_label="HEAD"
fi

# Everything that differs from the base: committed, staged, unstaged and untracked.
changed_all="$({
  git diff --name-only "$base"
  git ls-files --others --exclude-standard
} | sed '/^$/d' | sort -u)"

# The subset that still exists — deleted files can't be linted or imported.
changed=""
while IFS= read -r f; do
  if [ -n "$f" ] && [ -f "$f" ]; then changed="$changed$f"$'\n'; fi
done <<<"$changed_all"

lint_files="$(printf '%s' "$changed" | grep -E '\.(ts|tsx|mjs|js)$' | grep -v '^src/generated/' || true)"
test_files="$(printf '%s' "$changed" | grep -E '^(src|prisma)/.*\.(ts|tsx)$' | grep -v '^src/generated/' || true)"

lint_all=$all
test_all=$all
if printf '%s\n' "$changed_all" | grep -qE '^(eslint\.config\.mjs|eslint-rules/)'; then lint_all=1; fi
if printf '%s\n' "$changed_all" | grep -qE '^(vitest\.config\.ts|vitest\.setup)'; then test_all=1; fi

need_typegen=0
[ -d .next/types ] || need_typegen=1
if printf '%s\n' "$changed_all" | grep -qE '^src/app/(.*/)?(page|layout|route|template|default|not-found|loading|error)\.tsx?$'; then
  need_typegen=1
fi

logs="$(mktemp -d "${TMPDIR:-/tmp}/avut-check.XXXXXX")"

step() { # step <name> <function>
  local name="$1" start=$SECONDS
  "$2" >"$logs/$name.log" 2>&1
  echo $? >"$logs/$name.rc"
  echo $((SECONDS - start)) >"$logs/$name.secs"
}

run_tsc() {
  local out="$logs/tsc.raw"
  if [ "$need_typegen" = 1 ]; then npx next typegen || return 1; fi
  if npx tsc --noEmit >"$out" 2>&1; then return 0; fi

  # Stale generated route types fail tsc for reasons unrelated to the change. Regenerate and retry once.
  if grep -qE '\.next/(dev/)?types/' "$out"; then
    if grep -q '\.next/types/validator\.ts' "$out"; then rm -rf .next/dev/types; fi
    npx next typegen >/dev/null 2>&1
    if npx tsc --noEmit >"$out" 2>&1; then
      echo "regenerated stale route types" >"$logs/tsc.note"
      return 0
    fi
  fi
  cat "$out"
  return 1
}

run_eslint() {
  if [ "$lint_all" = 1 ]; then
    npx eslint .
  else
    printf '%s\n' "$lint_files" | tr '\n' '\0' | xargs -0 npx eslint --no-warn-ignored
  fi
}

run_tests() {
  if [ "$test_all" = 1 ]; then
    npx vitest run
  else
    printf '%s\n' "$test_files" | tr '\n' '\0' | xargs -0 npx vitest related --run --passWithNoTests
  fi
}

if [ "$all" = 1 ]; then
  echo "check: whole project"
else
  echo "check: $(printf '%s\n' "$changed_all" | grep -c .) changed files vs $base_label"
fi

ran=""
step tsc run_tsc &
ran="tsc"
if [ "$lint_all" = 1 ] || [ -n "$lint_files" ]; then
  step eslint run_eslint &
  ran="$ran eslint"
fi
if [ "$test_all" = 1 ] || [ -n "$test_files" ]; then
  step vitest run_tests &
  ran="$ran vitest"
fi
wait

failed=""
for name in tsc eslint vitest; do
  case " $ran " in
    *" $name "*) ;;
    *)
      printf '– %-7s skipped (nothing to %s)\n' "$name" "$([ "$name" = vitest ] && echo test || echo lint)"
      continue
      ;;
  esac

  rc="$(cat "$logs/$name.rc")"
  secs="$(cat "$logs/$name.secs")"
  if [ "$rc" = 0 ]; then
    note=""
    [ -f "$logs/$name.note" ] && note="  ($(cat "$logs/$name.note"))"
    [ "$name" = eslint ] && [ -s "$logs/eslint.log" ] && note="  (warnings — see $logs/eslint.log)"
    printf '✓ %-7s %ss%s\n' "$name" "$secs" "$note"
  else
    failed="$failed $name"
    limit=40
    [ "$name" = vitest ] && limit=60
    lines="$(wc -l <"$logs/$name.log" | tr -d ' ')"
    detail=""
    if [ "$name" = tsc ]; then
      n="$(grep -c 'error TS' "$logs/tsc.log")"
      detail="  ($n error$([ "$n" = 1 ] || echo s))"
    fi
    printf '✗ %-7s %ss%s\n' "$name" "$secs" "$detail"
    sed -n "1,${limit}p" "$logs/$name.log" | sed 's/^/    /'
    if [ "$lines" -gt "$limit" ]; then
      echo "    … $((lines - limit)) more lines: $logs/$name.log"
    fi
  fi
done

if [ -z "$failed" ]; then
  echo "check passed"
  rm -rf "$logs"
  exit 0
fi

echo "check FAILED:$failed  (logs: $logs)"
exit 1
