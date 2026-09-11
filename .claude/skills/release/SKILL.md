---
name: release
description: Cut an AVUT release — bump the version on integration, open the integration→production release PR, then verify the tag/Release/deploy after the admin merges. Trigger when the user types /release with a version.
effort: high
manual: true
---

# Release

Cuts a release of AVUT following [`docs/releasing.md`](../../../docs/releasing.md).
Read that doc first — it carries the rationale (two-tier branch model, why the
merge must be a merge commit, why `package.json`'s version only ever moves on
`integration`). This skill is the mechanical procedure.

`$ARGUMENTS` is the target version, optionally with a codename:

- `0.8` — bump to `0.8`, keep the current codename.
- `0.8 Laburnum` — bump to `0.8` **and** advance the codename to `Laburnum`.

If `$ARGUMENTS` is missing, ask for the version and stop. If the codename is
given, check it's the next unused name at the top of
[`docs/version-names.md`](../../../docs/version-names.md); if it's further down or
already marked used, flag that and ask before continuing.

Work happens in the main checkout, not a worktree.

## Step 0 — Preflight

```bash
git fetch origin -q --prune --tags
git switch integration && git pull --ff-only
node -p "require('./package.json')['nz.avut']"          # current version / build / versionName
git ls-remote --tags origin | grep "refs/tags/v$NEW" || echo "tag free"
git log --oneline origin/production..origin/integration | wc -l   # size of the payload
```

Stop if:

- the working tree is dirty,
- `v$NEW` already exists as a tag (the release workflow is idempotent and would
  skip — the user must delete the tag + Release first, see the doc's Notes),
- `origin/production..origin/integration` is empty (nothing to release).

Confirm the plan with the user before touching anything: old version → new
version, codename change or not, and the commit count going live.

## Step 1 — Bump the version on `integration`

```bash
git switch -c "release/v$NEW"
```

Edit `package.json` → `nz.avut.version` (targeted edit — the file is 2-space
indented and the pre-commit hook runs prettier; do **not** hand-reformat). If the
codename advances, also set `nz.avut.versionName` and mark that name used in
`docs/version-names.md` in the same commit.

```bash
git commit -am "chore(release): v$NEW ($CODENAME)"     # include the Co-Authored-By trailer
git push -u origin "release/v$NEW"
gh pr create --repo redcloud-nz/avut --base integration --head "release/v$NEW" \
  --title "chore(release): v$NEW ($CODENAME)" \
  --body "Step 1 of docs/releasing.md. Bumps nz.avut.version. Nothing tags or deploys from this PR."
```

Wait for the `Typecheck & test` check to pass, then squash-merge:

```bash
gh pr merge <n> --repo redcloud-nz/avut --squash --delete-branch
git fetch origin -q && git switch integration && git pull --ff-only
git show origin/integration:package.json | grep -A5 '"nz.avut"'   # confirm the bump landed
```

`increment-build-number.yml` will bump `nz.avut.build` right after — expected.
`integration` still renders `DEV.{build}`; `v$NEW` doesn't exist yet.

## Step 2 — Open the release PR

```bash
git fetch origin -q
gh pr create --repo redcloud-nz/avut --base production --head integration \
  --title "Release v$NEW ($CODENAME)" \
  --body "$(git log --oneline origin/production..origin/integration | head -60)"
```

If the payload is more than ~60 commits, summarise in the body and give the
count rather than pasting hundreds of lines. Sanity-check the diff — this is the
whole payload going live.

## Step 3 — Hand off the merge (STOP here)

The release PR will show **BLOCKED**: `production-protection` requires one
approving review with no bypass actors, and `gh pr merge --admin` is refused by
the local command classifier. This is deliberately a human step.

Tell the user, in these words:

> Release PR #<n> is open and BLOCKED pending review. Merge it **in the GitHub
> UI** with **"Create a merge commit"** — not squash, not rebase. Approve it or
> use the admin override. Tell me once it's merged and Vercel has deployed.

Then stop and wait. Do not poll.

## Step 4 — Verify (after the user confirms the merge)

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

- workflow run succeeded,
- tag `v$NEW` pushed and Release `$NEW - $CODENAME` published and marked Latest,
- `/api/version` shows `"environment":"production"` and `"display":"v$NEW ($CODENAME)"`,
- the shields endpoint is `brightgreen` and the badge renders `production: v$NEW ($CODENAME)`.

If anything is off, the doc's Notes cover the common cases (tag already existed,
re-cutting at the same version, workflow idempotency).

## Step 5 — Fold back anything that surprised you

If the run diverged from this skill or from `docs/releasing.md`, update whichever
is wrong before finishing.
