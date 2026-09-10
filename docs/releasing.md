# Releasing

How a version of AVUT gets from `integration` to a tagged, deployed release.

> **Status:** procedure, not yet exercised. No release has been cut. Follow this
> for the first one and correct it from what actually happens; once it's proven,
> it should become a `release` skill.

## The model

Two long-lived branches:

- **`integration`** — every feature PR merges here. Vercel deploys it as a
  pre-production environment. [`increment-build-number.yml`](../.github/workflows/increment-build-number.yml)
  bumps `nz.avut.build` on every push, so builds are identified as
  `{version}-build.{build}` (e.g. `0.7-build.61`).
- **`production`** — the release target. Admin-only pushes, no auto-merge (see
  [`branch-protection.md`](branch-protection.md)). Vercel deploys it as
  production, rendering a bare `v{version}` (no build suffix — see
  [`next.config.ts`](../next.config.ts)). A push here runs
  [`manage-release-version.yml`](../.github/workflows/manage-release-version.yml),
  which tags `v{version}` and publishes a GitHub Release **if that tag doesn't
  already exist**.

The single source of truth for the version is the `nz.avut` block in
[`package.json`](../package.json): `version` (e.g. `0.7`) and `versionName`, the
codename (e.g. `Philomel`).

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

```bash
git commit -am "chore(release): v0.8 (Laburnum)"
git push -u origin release/v0.8
gh pr create --base integration --title "chore(release): v0.8 (Laburnum)"
```

Get it reviewed and merged like any other PR. After it lands, `integration`
builds immediately read `0.8-build.N` — that's the signal the bump is in place.

Nothing tags or releases at this point; `v0.8` only exists once it reaches
`production`.

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
  PR shows spurious conflicts.
- Merging is admin-only and auto-merge is disabled, so an admin does this
  deliberately in the GitHub UI.

### 4. Automated, on the push to `production`

- Vercel deploys production.
- `manage-release-version.yml` sees no `v0.8` tag, creates the annotated tag
  `v0.8` and publishes the GitHub Release **0.8 - Laburnum**.

Confirm: `gh release list --repo redcloud-nz/avut` and the production site's
footer version string (`AVUT v0.8 (Laburnum)`, no `-build.` suffix).

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

- The README version badge reads `nz.avut.version` from `production` — it only
  moves when a release lands. The CI badge follows the default branch
  (`integration`).
- `manage-release-version.yml` is idempotent: re-pushing `production` at an
  already-released version does nothing.
- If a release needs to be re-cut at the same version (tag already exists),
  delete the tag and release first, or the workflow will skip.
