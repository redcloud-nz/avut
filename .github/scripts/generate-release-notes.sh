#!/usr/bin/env bash
set -euo pipefail

# Prints a "## What's Changed" section listing the PRs actually shipped in
# <prev_tag>..<range_end>, categorized like .github/release.yml (keep the two
# in sync if that file's categories change).
#
# Resolves each commit to its originating PR by SHA
# (`gh api repos/{owner}/{repo}/commits/{sha}/pulls`) instead of using GitHub's
# built-in `generate_release_notes`, which only picks up PRs whose *base
# branch* is the one being tagged. That's useless for this repo's model: every
# feature PR targets `integration`, not `production`, so the built-in
# generator only ever found the release PR itself.
#
# Usage: generate-release-notes.sh <prev_tag-or-empty> [range_end (default HEAD)]
# Requires an authenticated `gh` with read access to the repo.

prev_tag="${1:-}"
range_end="${2:-HEAD}"

repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

if [ -n "$prev_tag" ]; then
    range="${prev_tag}..${range_end}"
else
    range="${range_end}"
fi

exclude_labels=("ignore-for-release")
exclude_authors=("github-actions" "github-actions[bot]" "dependabot" "dependabot[bot]")

seen=""
features="" fixes="" docsec="" other=""

has_label() {
    local labels="$1"
    shift
    for want in "$@"; do
        if grep -qxF "$want" <<<"$labels"; then
            return 0
        fi
    done
    return 1
}

is_excluded_author() {
    local author="$1"
    for a in "${exclude_authors[@]}"; do
        [ "$author" = "$a" ] && return 0
    done
    return 1
}

while IFS= read -r sha; do
    [ -z "$sha" ] && continue

    # A commit is typically contained by both the small feature PR that
    # introduced it *and* the umbrella release PR that later carried it into
    # `production` — exclude anything based on `production` so we land on the
    # actual originating PR, not the release PR that's shipping it.
    pr_json="$(gh api "repos/${repo}/commits/${sha}/pulls" \
        --jq '[.[] | select(.base.ref != "production")] | .[0] // empty')"
    [ -z "$pr_json" ] && continue

    number="$(jq -r '.number' <<<"$pr_json")"
    grep -qxF "$number" <<<"$seen" && continue
    seen+="${number}"$'\n'

    title="$(jq -r '.title' <<<"$pr_json")"
    author="$(jq -r '.user.login' <<<"$pr_json")"
    labels="$(jq -r '.labels[].name' <<<"$pr_json")"

    has_label "$labels" "${exclude_labels[@]}" && continue
    is_excluded_author "$author" && continue

    line="- ${title} by @${author} in #${number}"

    if has_label "$labels" "feature" "enhancement"; then
        features+="${line}"$'\n'
    elif has_label "$labels" "bug" "fix"; then
        fixes+="${line}"$'\n'
    elif has_label "$labels" "documentation"; then
        docsec+="${line}"$'\n'
    else
        other+="${line}"$'\n'
    fi
done < <(git log --no-merges --format=%H "$range")

print_section() {
    local title="$1" content="$2"
    [ -z "$content" ] && return
    echo "### ${title}"
    echo
    printf '%s' "$content"
    echo
}

echo "## What's Changed"
echo
print_section "Features" "$features"
print_section "Fixes" "$fixes"
print_section "Documentation" "$docsec"
print_section "Other changes" "$other"

if [ -n "$prev_tag" ]; then
    echo "**Full Changelog**: https://github.com/${repo}/compare/${prev_tag}...${range_end}"
fi
