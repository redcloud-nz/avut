#!/usr/bin/env bash
#
# Prints ONLY the value of DEV_ADMIN_TEST_PASSWORD from .env.local — the password
# for the admin test account (delivered+admin-test@resend.dev) that the
# test-in-browser skill signs in as via window.avut.signIn().
#
# This exists so the agent can retrieve just that one value for the sign-in step
# without a broad `cat .env.local` / `source .env.local && echo` that surfaces
# every other secret. It is allow-listed in .claude/settings.local.json.
#
# The value is a gitignored local-only dev credential. Do not write it to a file,
# commit it, or save it into agent memory.
set -euo pipefail

root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
env_file="$root/.env.local"

if [[ ! -f "$env_file" ]]; then
    echo "error: $env_file not found" >&2
    exit 1
fi

line="$(grep -E '^DEV_ADMIN_TEST_PASSWORD=' "$env_file" | head -n1)"
if [[ -z "$line" ]]; then
    echo "error: DEV_ADMIN_TEST_PASSWORD not set in .env.local" >&2
    exit 1
fi

value="${line#DEV_ADMIN_TEST_PASSWORD=}"
# strip a single layer of surrounding single or double quotes
value="${value%\"}"; value="${value#\"}"
value="${value%\'}"; value="${value#\'}"
printf '%s\n' "$value"
