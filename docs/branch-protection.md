# Branch Protection Rules

`integration` and `production` are protected branches. These rules aren't managed
in code — configure them under **Settings → Branches** (or via the GitHub
API/`gh api repos/{owner}/{repo}/branches/{branch}/protection`) for each
branch listed below.

## `integration`

- Require a pull request before merging
  - Require approvals: **1**
  - Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging
  - Require branches to be up to date before merging
- Do not allow bypassing the above settings, **except** allow
  `github-actions[bot]` (or the "GitHub Actions" app) to bypass the PR
  requirement — the `sync-integration` job in
  [`manage-release-version.yml`](../.github/workflows/manage-release-version.yml)
  pushes `production` back into `integration` directly using `GITHUB_TOKEN`
  after every release, and that push would otherwise be rejected

## `production`

Everything required for `integration`, plus:

- Restrict who can push to matching branches: **admins only**
- Do not allow auto-merge

## Rationale

- `integration` is where every feature PR merges.
- `production` only receives merges from a `release/*` branch cut from
  `integration` (see [`releasing.md`](releasing.md)) or a hotfix branch cut
  from `production` itself. Restricting direct pushes to admins and disabling
  auto-merge keeps releases deliberate — merging to `production` is what
  triggers
  [`manage-release-version.yml`](../.github/workflows/manage-release-version.yml),
  which tags and publishes a GitHub Release from `nz.avut.version`, then syncs
  the merge back onto `integration`.
