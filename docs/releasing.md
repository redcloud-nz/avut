# Releasing

How a version of AVUT gets from `integration` to a tagged, deployed release.

> **Status:** reworked 2026-09-22 to a single-PR flow. **v0.8 (Philomel)**
> through **v0.9.2** were cut with an older two-PR version of this process
> (a version-bump PR into `integration`, then a separate
> `integration→production` PR) — see git history on this file if you need the
> old procedure. The [`release` skill](../.claude/skills/avut-release/SKILL.md)
> automates the mechanical steps below; this doc is the rationale. Since
> 2026-10-08 the sync back into `integration` is a manual step (step 4), not
> part of the workflow.

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
  already exist**. `production` is then synced back into `integration` by hand
  (step 4), so the version bump isn't lost there.

The single source of truth for the version is the `nz.avut` block in
[`package.json`](../package.json): `version` (e.g. `0.7`) and `versionName`, the
codename (e.g. `Philomel`).

**The rule:** `package.json`'s version only ever changes on a release branch
cut from `integration`, PR'd into `production`. `integration` gets it back in
the sync-back (step 4), so the two branches never diverge on `package.json`
for long.

## Cutting a release

### 0. Close out the milestone

Each minor or major version has a GitHub milestone titled `v<version>`,
optionally followed by ` - <codename>` (`v0.11`, `v1 - veronica`). Patch
releases usually have none. Before cutting the release, the milestone's issues
should all be closed, or moved to the next milestone. That includes its
`Docs: v<version>` issue. Feature PRs don't write end-user guides (`content/docs/**`
and its screenshots) themselves; they do keep the in-app help cards
(`content/help/**`) current. Each user-facing PR adds an item to that issue
instead, and `/avut-docs <version>` works through them in one pass once the UI
has settled, so each screenshot is taken once. The same pass writes the
release's in-app "What's new" entry, [`content/updates/v<version>.mdx`](../content/updates/README.md),
from that checklist. `/avut-release` lists any open
issues in the milestone and asks before going on, and closes the milestone once
the release is verified.

### 1. Cut the release branch and open the one release PR

```bash
git switch integration && git pull
git switch -c release/v0.8
```

Edit [`package.json`](../package.json) → `nz.avut.version` (and `versionName` if
the codename advances — the name after the last used one in
[`version-names.md`](version-names.md), unless one was already reserved there
for this version; mark it used in the same PR).

Write the release notes: [`docs/releases/v0.8.md`](releases/README.md), the
hand-written top of the GitHub Release. The workflow **fails the release if this
file is missing**, so it has to land in this PR. Keep it to a couple of
sentences plus highlights — the actual PR list gets appended automatically
(see [Release notes](#release-notes) below). When the codename advances, it ends
with a short history of the name: every HMS or HMNZS ship with a New Zealand
connection that carried it, not just the one in `version-names.md`. The `/avut-release` skill drafts
the notes from the commit range and researches the name.

Check that the release's [`content/updates/v0.8.mdx`](../content/updates/README.md)
is on `integration` — that's what users see in the in-app "What's new" dialog,
and production shows it once this version deploys. The docs pass (step 0)
writes it. If it's missing because the release has no docs issue (typical for a
patch) but does change something users would notice, add it in this PR. It's
reviewed, not enforced.

```bash
git add docs/releases/v0.8.md content/updates/   # new files — `commit -a` won't pick them up
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

Confirm:

```bash
gh release list --repo redcloud-nz/avut          # {version} - {versionName}, Latest
git ls-remote --tags origin | grep v0.8          # tag pushed
curl -s https://www.avut.nz/api/version          # "environment":"production","display":"v0.8 (Philomel)"
curl -s "https://www.avut.nz/api/version?format=shields"   # "color":"brightgreen"
```

and the production site's footer version string (`AVUT v0.8 (Philomel)` —
production is the only place it appears).

### 4. Sync `production` back into `integration`

By hand, as the repo admin (a ruleset bypass actor). The workflow used to do
this, but GitHub Actions can't be added as a bypass actor on the `integration`
ruleset, so its push was rejected every release (`GH013`) and the job was
removed.

```bash
git fetch origin
git merge-base --is-ancestor origin/integration origin/production && echo fast-forward
```

- **Fast-forward** (nothing merged into `integration` while the release PR was
  open — the usual case):
  `git push origin origin/production:refs/heads/integration`.
- **Otherwise** a merge commit:
  `git switch integration && git pull --ff-only && git merge origin/production -m "chore(release): sync v0.8 back from production"`,
  resolve any conflict, then `git push origin integration`.

`git log origin/integration..origin/production --oneline` is empty once it's
done. `/avut-release` does this step, after asking before it pushes.

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
tags and publishes. Then sync `production` back into `integration` as in
[step 4](#4-sync-production-back-into-integration). A hotfix is the case where
that's usually a merge commit rather than a fast-forward.

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
