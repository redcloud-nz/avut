---
name: avut-release
description: Cut an AVUT release — bump the version on a release branch, open the one release/vX→production PR, then verify the tag/Release/deploy and sync production back into integration after the admin merges. Trigger when the user types /avut-release with a version.
effort: high
manual: true
---

# Release

Cuts a release of AVUT following [`docs/releasing.md`](../../../docs/releasing.md).
Read that doc first — it carries the rationale (two-tier branch model, why the
merge must be a merge commit, why the version bump lives on a release branch
that PRs straight into `production`, why the sync-back to `integration` is a
manual push). This skill is the mechanical procedure.

`$ARGUMENTS` is the target version, optionally with a codename:

- `0.8` — bump to `0.8`, keep the current codename.
- `0.8 Laburnum` — bump to `0.8` **and** advance the codename to `Laburnum`.

If `$ARGUMENTS` is missing, ask for the version and stop.

**Codename.** [`docs/version-names.md`](../../../docs/version-names.md) may
already reserve a name for this version (a `Reserved:` line, such as ``Reserved: `dunedin` (v0.12)``). If
it does, that's the codename even when `$ARGUMENTS` doesn't give one; if
`$ARGUMENTS` names a different one, ask which wins. Otherwise a given codename
should be the name after the last used one, going down the list; if it isn't,
or it's already used, flag that and ask before continuing.

Work happens in the main checkout, not a worktree.

> Identity note: the release PR this skill opens is authored as `claude-avut`,
> a separate GitHub account registered as a second `gh` identity — not as your
> default account. Scope its token to the `git push`/`gh pr create` via
> `GH_TOKEN=$(gh auth token --user claude-avut)`, never `gh auth switch` (that
> would leave the wrong account active for the rest of the session).
> Everything else in this skill (merges, `gh pr view`, reads) uses your
> default account as normal.

## Step 0 — Preflight

```bash
git fetch origin -q --prune --tags
git switch integration && git pull --ff-only
node -p "require('./package.json')['nz.avut']"          # current version / versionName
git ls-remote --tags origin | grep "refs/tags/v$NEW" || echo "tag free"
git log --oneline origin/production..origin/integration | wc -l   # size of the payload
```

Stop if:

- the working tree is dirty,
- `v$NEW` already exists as a tag (the release workflow is idempotent and would
  skip — the user must delete the tag + Release first, see the doc's Notes),
- `origin/production..origin/integration` is empty (nothing to release).

**Milestone check.** Milestones are titled `v<version>`, optionally followed by
` - <codename>` (`v0.11`, `v1 - veronica`). Find the one for `$NEW` by its
leading version, with its open issues:

```bash
node .claude/skills/avut-docs/milestone.ts show "$NEW"
```

- **`"milestone": null`** (usual for a patch release): say so, and carry on.
- **Open issues in it:** list them and ask, rather than stopping outright.
  For each one, the user can move it to the next milestone, or release anyway.
  Released-anyway issues still have to leave the milestone, or it stays open
  and becomes the default milestone that `/avut-ship` files new docs items
  under. Step 3's `close --move-to` handles that.
  The milestone's `Docs: v<version>` issue counts like any other. If it's
  open, the docs pass hasn't run: suggest `/avut-docs <version>` first.

Confirm the plan with the user before touching anything: old version → new
version, codename change or not, the commit count going live, and the
milestone's state.

## Step 1 — Cut the release branch and open the one release PR

```bash
git switch -c "release/v$NEW"
```

Edit `package.json` → `nz.avut.version` (targeted edit — the file is 2-space
indented and the pre-commit hook runs prettier; do **not** hand-reformat). If the
codename advances, also set `nz.avut.versionName` and, in
`docs/version-names.md`, move the name from `Reserved:` (if it's there) to
`Used so far:`, in the same commit. Correct the name's note in the table if
the research below shows it's wrong.

Write `docs/releases/v$NEW.md` — the workflow **fails the release if it's
missing**. Draft it from the payload and the format in
[`docs/releases/README.md`](../../../docs/releases/README.md):

```bash
git log --oneline --no-merges origin/production..origin/integration
```

Group the noteworthy commits into `### Highlights` (skip pure-internal
refactors and doc-only churn — the workflow appends the full categorized PR
list anyway). Add `### Upgrade notes` only if there's a migration / env var /
config action. Two or three sentences of framing at the top.

The file may already exist, holding only a `### The name` section, when the
codename was reserved early. Keep that section and write the rest around it.

**The name.** If the codename advances and `### The name` isn't written yet,
research it and write it, following
[`docs/releases/README.md`](../../../docs/releases/README.md#the-name). Search
the web for every HMNZS ship of that name, and every HMS ship of that name that
served on the New Zealand station or with the New Zealand Division, not only
the one in `version-names.md`. HMS and HMNZS ships only: no merchant ships. Check
the dates and facts against a second source, such as Wikipedia and the Navy
Museum (navymuseum.co.nz) or NZHistory. One paragraph
per ship, oldest first. List the sources you used when you show the draft, but
keep them out of the file.

Show the draft to the user and let them edit before committing.

Then check that the in-app "What's new" entry, `content/updates/v$NEW.mdx`, is
on `integration`. `/avut-docs` writes it during the docs pass, so it's normally
there already, and production shows it once this release deploys. If it's
missing, either the release has nothing user-facing (no docs issue, typical for
a patch) or the docs pass was skipped. In that case, list the user-facing
changes in the range and offer to draft it here, following
[`content/updates/README.md`](../../../content/updates/README.md), and `git add`
it so it lands in the release commit. This is a soft step: if the user declines,
or nothing is user-facing, carry on.

```bash
git add "docs/releases/v$NEW.md"                       # new file — `commit -a` won't pick it up
git commit -am "chore(release): v$NEW ($CODENAME)"     # include the Co-Authored-By trailer
BOT_TOKEN=$(gh auth token --user claude-avut)
GH_TOKEN="$BOT_TOKEN" git push -u origin "release/v$NEW"
GH_TOKEN="$BOT_TOKEN" gh pr create --repo redcloud-nz/avut --base production --head "release/v$NEW" \
  --title "Release v$NEW ($CODENAME)" \
  --body "$(git log --oneline origin/production..origin/integration | head -60)"
```

If the payload is more than ~60 commits, summarise in the body and give the
count rather than pasting hundreds of lines. Sanity-check the diff — this is the
whole payload going live, version bump included.

## Step 2 — Hand off the review and merge (STOP here)

This PR is authored by `claude-avut`, so it's a genuine second-party artifact
for you to review like anyone else's PR — not a rubber stamp. Note:
`production-protection`'s required-approval count is currently 0, so GitHub
won't structurally block a merge without your review; treat this as the
workflow rule to honor regardless. `gh pr merge --admin` is refused by the
local command classifier either way — merging is deliberately a human step.

Tell the user, in these words:

> Release PR #<n> is open, authored by `claude-avut`. Please review it and
> merge **in the GitHub UI** with **"Create a merge commit"** — not squash,
> not rebase. Tell me once it's merged and Vercel has deployed.

Then stop and wait. Do not poll.

## Step 3 — Verify (after the user confirms the merge)

```bash
git fetch origin -q --prune --tags
gh run list --repo redcloud-nz/avut --workflow=manage-release-version.yml --limit 1
gh release list --repo redcloud-nz/avut | head -3
git ls-remote --tags origin | grep "v$NEW"
curl -s https://www.avut.nz/api/version
curl -s "https://www.avut.nz/api/version?format=shields"
curl -s "https://img.shields.io/endpoint?url=https%3A%2F%2Fwww.avut.nz%2Fapi%2Fversion%3Fformat%3Dshields" | grep -o '<title>[^<]*</title>'
```

Report:

- workflow run succeeded (its one job, `create-release`),
- tag `v$NEW` pushed and Release `$NEW - $CODENAME` published and marked Latest,
- the Release body lists the actual feature PRs in this release under
  `## What's Changed`, not just the release PR itself,
- `/api/version` shows `"environment":"production"` and `"display":"v$NEW ($CODENAME)"`,
- the shields endpoint is `brightgreen` and the badge renders `production: v$NEW ($CODENAME)`.

If anything is off, the doc's Notes cover the common cases (tag already existed,
re-cutting at the same version, workflow idempotency).

### Sync `production` back into `integration`

The workflow doesn't do this (GitHub Actions can't bypass the `integration`
ruleset); this skill does, pushing as the user's own account, which is a
bypass actor. Not as `claude-avut`.

```bash
git merge-base --is-ancestor origin/integration origin/production && echo fast-forward
```

- **Fast-forward** (the usual case): ask, then
  `git push origin origin/production:refs/heads/integration`.
- **Not a fast-forward** (a PR merged into `integration` while the release PR
  was open): `git switch integration && git pull --ff-only && git merge
  origin/production -m "chore(release): sync v$NEW back from production"`
  (include the Co-Authored-By trailer). Stop and show the user any conflict
  rather than resolving it silently. Show the merge, ask, then
  `git push origin integration`.

Then `git log origin/integration..origin/production --oneline` must be empty.
Update the main checkout: `git switch integration && git pull --ff-only`, and
delete the local `release/v$NEW` branch.

Once everything checks out, close the release's milestone, if it has one:

```bash
node .claude/skills/avut-docs/milestone.ts close "$NEW"
```

It refuses while issues are still open in the milestone. If the user released
with issues still open (Step 0), ask which milestone they go to, then:

```bash
node .claude/skills/avut-docs/milestone.ts close "$NEW" --move-to <next-version>
```

That moves each open issue to the next milestone, and carries an open docs
issue's unticked items over to the next milestone's docs issue
(`docs-carry`), before closing. If it stops because the docs issue has
skipped item comments, resolve them as `/avut-docs` Step 2 describes, then run
it again. A partial run is safe to repeat.

## Step 4 — Fold back anything that surprised you

If the run diverged from this skill or from `docs/releasing.md`, update whichever
is wrong before finishing.
