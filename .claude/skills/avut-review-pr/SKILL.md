---
name: avut-review-pr
description: Review GitHub pull requests as claude-avut and post the reviews. With `#<N>`, reviews that PR if it needs one. With no argument, reviews every open PR that requests a review from claude-avut, in parallel subagents. Trigger when the user types /avut-review-pr.
effort: high
manual: true
---

# Review PR

Posts formal GitHub reviews as `claude-avut`, a second `gh` identity. GitHub refuses a review where the author and the reviewer are the same account. The review itself is done by the `avut-code-reviewer` subagent: correctness plus `docs/conventions-checklist.md`, in fresh context. This skill works out which PRs to review, builds the review bodies, and posts them.

**Posting doesn't need confirmation.** The user asked for this skill to review and post in one go. Show the result after posting.

> If the user says "D4H" when asking for this, they mean GitHub. PRs live on `redcloud-nz/avut`.

## Modes

- **`#<N>`** (or a bare number or a PR URL): **specific PR mode**. Review that PR if it needs a review.
- **No argument:** **queue mode**. Review every open PR where a review from `claude-avut` has been requested.
- Anything else: ask which PR is meant, and stop.

## Step 1 — Collect the candidates

**Specific PR mode:**

```bash
gh pr view <N> --repo redcloud-nz/avut \
  --json number,title,url,author,state,isDraft,headRefName,headRefOid,baseRefName,body,reviewRequests,reviews
```

**Queue mode:**

```bash
gh pr list --repo redcloud-nz/avut --state open --search "user-review-requested:claude-avut" \
  --json number,title,url,author,isDraft,headRefName,headRefOid,baseRefName,body,reviewRequests,reviews
```

If the queue is empty, say so and stop.

## Step 2 — Does it need a review?

Decide for each PR. `reviews` gives each earlier review's author, state and `commit.oid`. **Earlier review** below means the most recent one by `claude-avut`.

| Situation | Decision |
| --- | --- |
| Closed or merged | Skip ("#N is merged"). |
| Authored by `claude-avut` | Skip. It can't review its own PR. |
| No earlier review | **Review.** |
| Earlier review is on an older commit than `headRefOid` | **Re-review.** Pass on the earlier findings. |
| Earlier review is on `headRefOid`, and a review from `claude-avut` is requested again | **Re-review.** Someone wants another look. |
| Earlier review is on `headRefOid`, with no new request | Skip ("already reviewed at this commit"). |
| Draft | **Unsure.** |
| Anything else that doesn't fit this table | **Unsure.** |

In queue mode, being in the queue is itself a new request, so skip only closed, merged or self-authored PRs.

**Unsure:** ask the user once, listing every unsure PR together with the reason. Offer "review", "comment-only review" (for drafts) or "skip". In queue mode, start the clear-cut reviews first and ask while they run.

## Step 3 — Prepare each PR

For every PR being reviewed:

```bash
git fetch origin "pull/<N>/head:refs/remotes/pr/<N>" --force
git fetch origin <base>
gh pr checks <N> --repo redcloud-nz/avut
```

A failing check is itself a finding. Get the reason from `gh run view <run-id> --log-failed`. Pending checks don't block the review.

For a **re-review**, get the earlier review's body from `gh pr view <N> --json reviews`. Take its Blocking and Non-blocking items, and its `commit.oid`. Check that commit is still reachable (`git cat-file -e <oid>`). A force-push may have removed it.

## Step 4 — Run the reviewers

Run one `avut-code-reviewer` subagent per PR. With several PRs, start them all in **one message**, in the background. They only read, so they can share this checkout; each reads its own `pr/<N>` ref. With one PR, run it in the foreground.

Prompt for each:

> Diff range: `origin/<base>...pr/<N>`. Read code at `pr/<N>` (`git show`, `git grep`), not from the working tree.
> PR #<N> — <title>. It is meant to: <one or two sentences drawn from the PR body>.
> Failing CI: <the failure, or "none">.
> _(re-review only)_ Earlier findings to verify: <the list>. The earlier review was at `<oid>`. What changed since then is `<oid>..pr/<N>`, so look hardest at that, but judge the whole PR.

Tell it about the PR body's "Worth a close look" line, and its "Pre-merge review" section if it has one. The second shows what `/avut-ship` already fixed.

## Step 5 — Compose the review body

For each PR, build the body from the subagent's report:

```markdown
## Review of #<n> — <title>

<1–3 sentences: what the PR does, and the verdict. Say plainly when nothing blocking was found.>

### Earlier findings
- ✅ / ❌ / ◐ **`path/to/file.ts:42`** — <finding> — <fixed / what's left>

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

Leave out any empty section. Include _Earlier findings_ only on re-reviews.

Before you post it, check each blocking finding by looking at the cited line yourself (`git show pr/<N>:<file>`). Downgrade or drop a finding that doesn't hold up. A wrong "Request changes" costs a pointless fix round.

**The verdict:**

- A blocking finding, or an earlier finding marked ❌ → `--request-changes`
- Otherwise → `--approve`
- The user chose comment-only (a draft) → `--comment`

## Step 6 — Post

Write each body to its own file in the scratchpad. Post as `claude-avut`. Scope the token to the one command; never use `gh auth switch`:

```bash
GH_TOKEN=$(gh auth token --user claude-avut) gh pr review <N> --repo redcloud-nz/avut \
  --approve \   # or --request-changes / --comment
  --body-file <file>
```

Always use `--body-file`, never `--body`. Posting a review clears the review request, so the queue doesn't pick the same PR up again.

If posting fails, report it and leave the other PRs alone. Don't retry under the default account.

## Step 7 — Show the output

- **One PR:** the posted review body in full, the verdict and the review URL.
- **Several PRs:** one row per PR (PR, title, verdict, blocking count, URL) and the rows for any PRs skipped, with the reason. Under the table, list each PR's blocking findings. The full bodies are at the URLs.

Afterwards, remove the `pr/<N>` refs: `git update-ref -d refs/remotes/pr/<N>`.

## Common mistakes

- Reviewing in the main session instead of `avut-code-reviewer`.
- A reviewer reading the working tree instead of `pr/<N>`. That reviews the wrong code.
- Starting batch reviewers one at a time instead of in one message.
- Posting an unchecked blocking finding.
- Re-reviewing from scratch, and not checking the earlier findings.
- Posting as `alexwestphal`, or switching accounts with `gh auth switch` instead of a scoped `GH_TOKEN`.
- Asking for approval before posting. This skill posts, then shows the result.
