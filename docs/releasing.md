# Releasing

How a version of AVUT gets from `integration` to a tagged, deployed release.

> **Status:** exercised once. **v0.8 (Philomel)** was cut this way on
> 2026-09-11 (PRs [#125](https://github.com/redcloud-nz/avut/pull/125) then
> [#126](https://github.com/redcloud-nz/avut/pull/126)) — tag `v0.8`, GitHub
> Release **0.8 - Philomel**, first `production` deploy. The [`release`
> skill](../.claude/skills/avut-release/SKILL.md) automates the mechanical steps;
> this doc is the rationale.

## The model

Two long-lived branches:

- **`integration`** — every feature PR merges here. Vercel deploys it as a
  pre-production environment. [`increment-build-number.yml`](../.github/workflows/increment-build-number.yml)
  bumps `nz.avut.build` on every push. Non-production environments don't render
  the version or codename at all — they show just `DEV.{build}` (see
  [`next.config.ts`](../next.config.ts) and
  [`version-string.tsx`](../src/components/ui/version-string.tsx)).
- **`production`** — the release target. Admin-only pushes, no auto-merge (see
  [`branch-protection.md`](branch-protection.md)). The only environment that
  renders a real version: `v{version} ({versionName})`. A push here runs
  [`manage-release-version.yml`](../.github/workflows/manage-release-version.yml),
  which tags `v{version}` and publishes a GitHub Release **if that tag doesn't
  already exist**.

The single source of truth for the version is the `nz.avut` block in
[`package.json`](../package.json): `version` (e.g. `0.7`) and `versionName`, the
codename (e.g. `Philomel`). `nz.avut.build` is a separate monotonic counter that
only appears as `DEV.{build}` outside production.

**The rule:** `package.json`'s version is only ever edited by a PR into
`integration`. `production` only ever receives it by merging `integration` (or a
hotfix branch — see below). The two branches never diverge on `package.json`.

## Cutting a release

### 1. Bump the version on `integration`

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
sentences plus highlights — GitHub's full PR list gets appended automatically.
The `/avut-release` skill drafts it from the commit range.

```bash
git commit -am "chore(release): v0.8 (Laburnum)"
git push -u origin release/v0.8
gh pr create --base integration --title "chore(release): v0.8 (Laburnum)"
```

Get it reviewed and merged like any other PR. Nothing tags or releases at this
point — `integration` still just renders `DEV.{build}`, and `v0.8` only comes
into existence once it reaches `production`. Confirm the bump landed with
`git show origin/integration:package.json`.

### 2. Open the release PR

```bash
git fetch origin
gh pr create --repo redcloud-nz/avut --base production --head integration \
  --title "Release v0.8 (Laburnum)" \
  --body "$(git log --oneline origin/production..origin/integration)"
```

The diff is everything on `integration` that production hasn't seen yet. Sanity
check it — this is the whole payload going live.

### 3. Merge it

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

### 4. Automated, on the push to `production`

- Vercel deploys production.
- `manage-release-version.yml` sees no matching tag, creates the annotated tag
  and publishes the GitHub Release (`{version} - {versionName}`). The body is
  `docs/releases/v{version}.md` with GitHub's auto-generated PR list appended
  below it (categorised by [`.github/release.yml`](../.github/release.yml)). The
  run fails if that notes file is missing. For v0.8 the run took ~15s.

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

For a fix that can't wait for the next `integration` release train:

```bash
git switch production && git pull
git switch -c hotfix/<slug>
```

Fix, PR **into `production`** directly, admin-merge. Then bring it back so
`integration` doesn't regress:

```bash
git switch integration && git pull
git merge origin/production          # merge commit
git push
```

A hotfix does **not** bump `version` unless you intend it to be its own release
(`v0.8.1`) — and the current `manage-release-version.yml` only understands
`v{version}` from the `nz.avut` block, so patch releases would need that workflow
extended first.

## Notes

- The README's **Production** badge is served live by
  [`/api/version?format=shields`](../src/app/api/version/route.ts) on
  `www.avut.nz`, so it always reflects what's actually deployed and moves only
  when a release lands. The **Integration** badge reads `nz.avut.build` straight
  off `integration`'s `package.json` on GitHub and shows `DEV.{build}` (the
  integration deployment sits behind Vercel auth, so shields can't reach its
  endpoint). The CI badge follows the default branch.
- `curl https://www.avut.nz/api/version` (or the local dev server) returns the
  ground-truth `version` / `versionName` / `build` / `branch` / `commit` as JSON
  regardless of environment — handy for support.
- `manage-release-version.yml` is idempotent: re-pushing `production` at an
  already-released version does nothing.
- If a release needs to be re-cut at the same version (tag already exists),
  delete the tag and release first, or the workflow will skip.
