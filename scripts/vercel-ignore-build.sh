#!/usr/bin/env bash
# Vercel "Ignored Build Step" — wired up via `ignoreCommand` in vercel.json.
#
# Exit 0  → skip the build/deployment for this commit
# Exit 1  → proceed with the build (the normal case)
#
# `brainstorm/*` branches carry only `.ideas/` documents pushed from a cloud
# `/brainstorm` session — there's nothing to deploy, so short-circuit them.
# Skill-written commits also include `[skip ci]` in the message; this is the
# belt-and-braces that also covers a human pushing to such a branch.

set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"

if [[ "$ref" == brainstorm/* ]]; then
  echo "Skipping deployment for doc-only branch: $ref"
  exit 0
fi

exit 1
