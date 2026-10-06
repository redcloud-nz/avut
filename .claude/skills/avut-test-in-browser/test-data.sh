#!/usr/bin/env bash
#
# Read-only lookups of the records a browser test needs: which org to open, which account to
# sign in or impersonate as, which session or team to look at.
#
#   bash .claude/skills/avut-test-in-browser/test-data.sh orgs
#   bash .claude/skills/avut-test-in-browser/test-data.sh users    [--org <slug>]
#   bash .claude/skills/avut-test-in-browser/test-data.sh admins
#   bash .claude/skills/avut-test-in-browser/test-data.sh sessions [--org <slug>]
#   bash .claude/skills/avut-test-in-browser/test-data.sh teams    [--org <slug>]
#
# It exists so these lookups are one fixed, allow-listed command. Inside a worktree, the
# harness refuses an inline `psql "$POSTGRES_URL_NON_POOLING" …`, since it can't verify a
# command built from a runtime value. It also keeps the connection string out of the
# transcript. It reads this checkout's .env.local, so after `db:branch` it reads the branch
# database. Only SELECTs; the session is set read-only as well.
set -euo pipefail

root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
env_file="$root/.env.local"
[[ -f "$env_file" ]] || { echo "error: $env_file not found" >&2; exit 1; }

line="$(grep -E '^(export[[:space:]]+)?POSTGRES_URL_NON_POOLING=' "$env_file" | head -n1 || true)"
url="${line#*=}"
# strip a single layer of surrounding single or double quotes, as print-test-account-password.sh does
url="${url%\"}"; url="${url#\"}"
url="${url%\'}"; url="${url#\'}"
[[ -n "$url" ]] || { echo "error: POSTGRES_URL_NON_POOLING not set in .env.local" >&2; exit 1; }

usage() {
    echo "usage: test-data.sh orgs | admins | users|sessions|teams [--org <slug>]" >&2
    exit 1
}

kind="${1:-}"
[[ -n "$kind" ]] || usage
shift
org=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --org) [[ $# -ge 2 && -n "$2" ]] || usage; org="$2"; shift 2 ;;
        *) usage ;;
    esac
done
case "$kind" in
    orgs | admins) [[ -z "$org" ]] || { echo "error: $kind doesn't take --org" >&2; exit 1; } ;;
esac

case "$kind" in
    orgs) sql=$(cat <<'SQL'
SELECT o.slug, o.name,
    (SELECT count(*) FROM personnel p WHERE p."organizationId" = o.id) AS personnel,
    (SELECT count(*) FROM organization_users ou WHERE ou."organizationId" = o.id) AS members
FROM organizations o ORDER BY o.slug;
SQL
) ;;
    admins) sql=$(cat <<'SQL'
SELECT u.id, u.email, u.name, u.role FROM users u WHERE u.role = 'admin' ORDER BY u.email;
SQL
) ;;
    users) sql=$(cat <<'SQL'
SELECT u.id, u.email, u.name, coalesce(u.role, '') AS global_role,
    string_agg(o.slug || ':' || ou.role || CASE WHEN ou."personId" IS NULL THEN '' ELSE ' (person)' END,
               ', ' ORDER BY o.slug) AS org_roles
FROM users u
JOIN organization_users ou ON ou."userId" = u.id
JOIN organizations o ON o.id = ou."organizationId"
WHERE (:'org' = '' OR o.slug = :'org')
GROUP BY u.id ORDER BY u.email LIMIT 60;
SQL
) ;;
    sessions) sql=$(cat <<'SQL'
SELECT s.id, o.slug AS org, s.name, s.status, s."startsAt"::date AS starts,
    (SELECT count(*) FROM skill_checks c WHERE c."sessionId" = s.id) AS checks
FROM skill_check_sessions s JOIN organizations o ON o.id = s."organizationId"
WHERE (:'org' = '' OR o.slug = :'org')
ORDER BY s."startsAt" DESC NULLS LAST LIMIT 20;
SQL
) ;;
    teams) sql=$(cat <<'SQL'
SELECT t.id, o.slug AS org, t.name, t.status,
    (SELECT count(*) FROM team_memberships m WHERE m."teamId" = t.id) AS members
FROM teams t JOIN organizations o ON o.id = t."organizationId"
WHERE (:'org' = '' OR o.slug = :'org')
ORDER BY o.slug, t.name LIMIT 60;
SQL
) ;;
    *) usage ;;
esac

# Variables (:'org') are only interpolated in SQL read from stdin, not from -c.
PGOPTIONS="-c default_transaction_read_only=on" \
    psql "$url" -X -q -v ON_ERROR_STOP=1 -v org="$org" -P pager=off -P footer=off <<<"$sql"
