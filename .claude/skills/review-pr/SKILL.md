---
name: review-pr
description: Review a GitHub pull request for this repo and post the review as a single PR comment. Trigger when the user types /review-pr with a PR number.
effort: high
manual: true
---

# Review PR

Reviews one GitHub pull request end-to-end and posts the result as a single comment on the PR.

`$ARGUMENTS` is the PR number (e.g. `94`). If it's missing or not a number, ask the user which PR to review and stop.

> Note: if the user says "D4H" when asking for this, they mean GitHub — the PR lives on `redcloud-nz/avut`.

> Identity note: the review is posted as `claude-avut`, a separate GitHub account registered as a second `gh` identity, not as the PR author. GitHub refuses a review where author == reviewer; this is what makes a real (not just commented) review possible. See Step 5 for how the token is scoped in.

## Step 1 — Identify the PR and confirm

```bash
gh pr view "$ARGUMENTS" --repo redcloud-nz/avut \
  --json number,title,url,author,state,isDraft,headRefName,baseRefName,body,additions,deletions,changedFiles
```

If the PR doesn't exist or the command errors, tell the user and stop.

Show the user a one-line summary and **wait for explicit confirmation** that this is the PR they meant before doing anything else:

> PR #94 — "Skill matrix header redesign" by alexwestphal (feature/skill-matrix-header → master, 12 files, +340 −80). Review this one?

Do not proceed until they confirm. If they say it's the wrong PR, ask for the right number.

## Step 2 — Gather the diff

```bash
gh pr diff "$ARGUMENTS" --repo redcloud-nz/avut
```

Also read the PR description and any existing review comments for context:

```bash
gh pr view "$ARGUMENTS" --repo redcloud-nz/avut --comments
```

Read the full current version of any non-trivially-changed file from the working tree (the local checkout is assumed to be on or near `master`; if a changed file can't be found locally, fall back to `gh` blob fetch). Don't review from the diff hunk alone when surrounding context matters.

## Step 3 — Review

Run two passes over the diff:

1. **General correctness & quality** — real bugs, broken edge cases, race conditions, missing error handling, plus reuse / simplification / efficiency cleanups. Scope findings to what the diff touches; don't relitigate unrelated pre-existing code.
2. **AVUT house conventions** — invoke the `avut-conventions-review` skill and apply its checklist against this diff (tRPC router ordering/permissions/`ctx.logEvent`, `$transaction` vs `Promise.all`, D4H optionality + server-only boundaries, `nanoId16()`, Zod placement, `route()`, generated files, server/client data-fetching boundaries, `Protect`/UI blocks, test structure).

For each finding note: severity, `file:line`, what's wrong, and the concrete fix.

## Step 4 — Compose the review body

Write a single markdown review body with this structure:

```markdown
## Review of #<n> — <title>

<1–3 sentence summary: what the PR does and the overall verdict>

### Blocking
- **`path/to/file.ts:42`** — <issue and fix>

### Non-blocking / suggestions
- **`path/to/file.tsx:88`** — <issue and fix>

### Nitpicks
- ...

### Looks good
- <notable things done well>

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Omit any section that has no items. If nothing blocking was found, say so plainly at the top.

Decide the verdict from the findings:

- Any `### Blocking` item → **Request changes**
- No blocking items → **Approve**
- Use **Comment** only if explicitly asked for feedback without a formal verdict (e.g. a WIP/draft PR)

## Step 5 — Confirm and post

Show the full drafted review and the verdict to the user and get explicit approval before posting — this is public state on someone's PR. A quick "here's the review, posting as a [verdict] unless you want changes" is fine.

Once approved, write the body to a tempfile and post it as an actual GitHub review under the `claude-avut` identity — scope the bot's token to just this command via `GH_TOKEN`, never `gh auth switch` (that would leave the wrong account active in this session):

```bash
GH_TOKEN=$(gh auth token --user claude-avut) gh pr review "$ARGUMENTS" --repo redcloud-nz/avut \
  --request-changes \   # or --approve / --comment, per the verdict above
  --body-file <tmpfile>
```

Use `--body-file`, never inline `--body` — the body is multi-paragraph markdown. Report back the review URL that `gh` prints.

## Common mistakes

- Skipping the Step 1 confirmation and reviewing the wrong PR
- Reviewing only the diff hunks without reading the surrounding code
- Posting without showing the user the drafted review first
- Running only the generic pass and missing AVUT-specific convention violations
- Posting under the default `gh` account (`alexwestphal`) instead of `claude-avut` via scoped `GH_TOKEN` — besides missing the point, GitHub silently downgrades a same-author review request or rejects it outright
- Using `gh auth switch` instead of a scoped `GH_TOKEN` prefix, leaving the wrong account active for later commands in the session
