# Releasing

How a version of AVUT gets from `integration` to a tagged, deployed release.

> **Status:** reworked 2026-09-22 to a single-PR flow. **v0.8 (Philomel)**
> through **v0.9.2** were cut with an older two-PR version of this process
> (a version-bump PR into `integration`, then a separate
> `integration→production` PR) — see git history on this file if you need the
> old procedure. The [`release` skill](../.claude/skills/avut-release/SKILL.md)
> automates the mechanical steps below; this doc is the rationale.

## The model

Two long-lived branches:

- **`integration`** — every feature PR merges here. Vercel deploys it as a
  pre-production environment. Non-production environments don't render a real
  version or codename — they show `DEV.{branch}@{commit}` (see
  [`next.config.ts`](../next.config.ts) and
  [`src/app/api/version/route.ts`](../src/app/api/version/route.ts)).
- **`production`** — the release target. Admin-only pushes, no auto-merge (see
  [`branch-protection.md`](branch-protection.md)). The only environment that
  renders a real version: `v{version} ({versionName})`. A push here runs
  [`manage-release-version.yml`](../.github/workflows/manage-release-version.yml),
  which tags `v{version}` and publishes a GitHub Release **if that tag doesn't
  already exist**, then merges `production` back into `integration` so the
  version bump isn't lost there.

The single source of truth for the version is the `nz.avut` block in
[`package.json`](../package.json): `version` (e.g. `0.7`) and `versionName`, the
codename (e.g. `Philomel`).

**The rule:** `package.json`'s version only ever changes on a release branch
cut from `integration`, PR'd into `production`. `integration` gets it back
automatically (see below), so the two branches never diverge on
`package.json` for long.

## Cutting a release

### 1. Cut the release branch and open the one release PR

```bash
git switch integration && git pull
git switch -c release/v0.8
```

Edit [`package.json`](../package.json) → `nz.avut.version` (and `versionName` if
the codename advances — pick the next unused name from the top of
[`version-names.md`](version-names.md), and mark it used there in the same PR).

Write the release notes: [`docs/releases/v0.8.md`](releases/README.md), the
hand-written top of the GitHub Release. The workflow **fails the release if this
file is missing**, so it has to land in this PR. Keep it to a couple of
sentences plus highlights — the actual PR list gets appended automatically
(see [Release notes](#release-notes) below). The `/avut-release` skill drafts
it from the commit range.

```bash
git commit -am "chore(release): v0.8 (Laburnum)"
git push -u origin release/v0.8
gh pr create --repo redcloud-nz/avut --base production --head release/v0.8 \
  --title "Release v0.8 (Laburnum)"
```

The diff is everything on `integration` that `production` hasn't seen yet,
plus the version bump. Sanity check it — this is the whole payload going live.

### 2. Merge it

- **Merge commit — not squash, not rebase.** `integration` and `production` must
  keep shared history; squashing makes them diverge and every subsequent release
  PR shows spurious conflicts. (`production-protection` currently still _allows_
  all three merge methods — the discipline is manual. Pick "Create a merge
  commit" in the UI.)
- The PR will sit at **BLOCKED** — `production-protection` requires one approving
  review and has no bypass actors. An admin approves it (or uses the admin
  override) and merges **in the GitHub UI**. `gh pr merge --admin` is refused by
  the local command classifier, so this step is not scriptable from here.
- Expect the first release PR to be enormous — for v0.8 it was the entire ~203
  commit history, because `production` had only ever held the initial scaffold.
  Every release after that is a normal-sized diff.

### 3. Automated, on the push to `production`

- Vercel deploys production.
- `manage-release-version.yml` sees no matching tag, creates the annotated tag
  and publishes the GitHub Release (`{version} - {versionName}`). The body is
  `docs/releases/v{version}.md` with a categorized PR list appended below it —
  see [Release notes](#release-notes). The run fails if that notes file is
  missing.
- The same workflow then merges `production` back into `integration` and
  pushes directly (bypassing the PR requirement the same way
  `github-actions[bot]` always has — see
  [`branch-protection.md`](branch-protection.md)). If that merge conflicts —
  rare, since `production` only ever moves via an admin-merged PR — the
  workflow fails loudly and it needs resolving by hand:
  `git switch integration && git merge origin/production`, fix, push.

Confirm:

```bash
gh release list --repo redcloud-nz/avut          # {version} - {versionName}, Latest
git ls-remote --tags origin | grep v0.8          # tag pushed
curl -s https://www.avut.nz/api/version          # "environment":"production","display":"v0.8 (Philomel)"
curl -s "https://www.avut.nz/api/version?format=shields"   # "color":"brightgreen"
```

and the production site's footer version string (`AVUT v0.8 (Philomel)` —
production is the only place it appears).

## Hotfixes

For fixes that can't wait for the next `integration` release train, use a
shared branch per production minor, named after the version it patches
(`hotfix/0.9` while `production` is on `0.9.x`):

```bash
git switch production && git pull
git switch -c hotfix/0.9        # only if it doesn't already exist — otherwise git switch hotfix/0.9 && git pull
```

Land one or more fixes on that branch over time (PRs into `hotfix/0.9`, or
direct commits — it's a working branch, not `production`). When the
accumulated fixes are ready to ship, merge into `production`:

```bash
git switch production && git pull
git merge --no-ff hotfix/0.9
git push
```

`manage-release-version.yml` runs on that push the same as any release — it
tags, publishes, and merges `production` back into `integration`
automatically, so there's no separate manual "back into integration" step
anymore.

Bump `nz.avut.version` (e.g. `0.9.2` → `0.9.3`) on `hotfix/0.9` before merging
into `production`, and add its `docs/releases/v0.9.3.md` — same requirement as
a normal release. The branch survives the merge; keep accumulating on it and
repeat until `production` moves to the next minor, at which point cut a fresh
`hotfix/<minor>` branch.

## Release notes

`manage-release-version.yml` appends a `## What's Changed` section below the
hand-written notes, generated by
[`.github/scripts/generate-release-notes.sh`](../.github/scripts/generate-release-notes.sh)
— **not** GitHub's built-in `generate_release_notes`. That built-in feature
only picks up PRs whose _base branch_ is the one being tagged
(`production`), which in this model is just the release PR itself — every
feature PR targets `integration` and would never show up. The script instead
walks the commit range since the previous tag and resolves each commit to its
originating PR by SHA (`gh api repos/{owner}/{repo}/commits/{sha}/pulls`,
excluding any PR based on `production` so it doesn't attribute the commit to
the umbrella release PR that's just carrying it along), then categorizes by
the same labels as [`.github/release.yml`](../.github/release.yml).

## Notes

- The README's **Production** badge is served live by
  [`/api/version?format=shields`](../src/app/api/version/route.ts) on
  `www.avut.nz`, so it always reflects what's actually deployed and moves only
  when a release lands. The **Integration** badge reads GitHub's
  `last-commit` for the `integration` branch directly (the integration
  deployment sits behind Vercel auth, so shields can't reach its own
  `/api/version` endpoint). The CI badge follows the default branch.
- `curl https://www.avut.nz/api/version` (or the local dev server) returns the
  ground-truth `version` / `versionName` / `branch` / `commit` / `display` as
  JSON regardless of environment — handy for support. Non-production
  environments render `display` as `DEV.{branch}@{commit}`.
- `manage-release-version.yml` is idempotent: re-pushing `production` at an
  already-released version does nothing.
- If a release needs to be re-cut at the same version (tag already exists),
  delete the tag and release first, or the workflow will skip.
