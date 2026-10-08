# Branch Protection Rules

`integration` and `production` are protected by repository **rulesets**
(`integration-protection`, `production-protection`), not classic branch
protection. They aren't managed in code — edit them under **Settings → Rules →
Rulesets**, or via `gh api repos/redcloud-nz/avut/rulesets/<id>`.

## `integration`

- Block deletion and force-push
- Require a pull request before merging
  - Required approvals: **0** — review happens before the push (see below)
  - Require conversation resolution before merging
- Require status checks to pass: **`Typecheck & test`** (the `CI` workflow)
  - Require branches to be up to date before merging
- Bypass: the repo admin (always)

The repository has **auto-merge** enabled so a PR can be queued to merge as
soon as CI goes green (`gh pr merge --auto --merge`).

## `production`

- Block deletion and force-push
- Require a pull request before merging
  - Required approvals: **1**, stale approvals dismissed on push
  - Require conversation resolution before merging
  - Merge commits only
- No bypass actors

Not yet configured, though intended: a required `Typecheck & test` status
check (CI does run on PRs into `production`), and a push restriction to admins.

## Rationale

- `integration` is where every feature PR merges. Code is written and reviewed
  by agents: `/avut-ship` runs a fresh-context review in a subagent **before**
  the push, fixes what it finds, and records the review in the PR body. A
  required approval on top would just be the same model approving under a
  second account, and each fix push would cost another review round. So the
  gate on `integration` is CI. `/avut-review-pr` stays available for PRs
  that deserve a separate pass after opening.
- "Up to date before merging" is not optional. Two PRs that are each green
  against an older `integration` can still break it when both merge (#326 and
  #327 did exactly that). Strict status checks make the second PR re-run CI
  against the first.
- `production` only receives merges from a `release/*` branch cut from
  `integration` (see [`releasing.md`](releasing.md)) or a hotfix branch cut
  from `production` itself. The required approval keeps releases deliberate.
  Merging to `production` triggers
  [`manage-release-version.yml`](../.github/workflows/manage-release-version.yml),
  which tags and publishes a GitHub Release from `nz.avut.version`. Syncing the
  merge back onto `integration` is a manual push by the admin (see
  [`releasing.md`](releasing.md#4-sync-production-back-into-integration)):
  GitHub Actions can't be a bypass actor on the `integration` ruleset.
