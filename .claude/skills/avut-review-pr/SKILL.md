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

## Step 1 — Prep (script)

The mechanical part is one script call. It collects the candidates, applies the decision table below, and fetches each PR it doesn't skip to `refs/remotes/pr/<N>`, along with its base. It also gathers failing CI (with the tail of the failed log) and the earlier review:

```bash
node .claude/skills/avut-review-pr/review-pr.ts prep <N>   # specific PR mode
node .claude/skills/avut-review-pr/review-pr.ts prep       # queue mode
```

It prints JSON: `{ mode, prs: [...] }`. Each PR has `action` (`review` / `re-review` / `skip` / `unsure`) and a `reason`. Any PR that isn't skipped also has:

- `ref` and `diffRange`: `origin/<base>...pr/<N>`
- `sinceLastReview`: `<oid>..pr/<N>`, on a re-review where the earlier commit is still reachable
- `description`
- `ci`: `failing[]` with `logTail`, and `pending`
- `previous`: the earlier review's `state`, `oid`, `reachable` and `body`

An empty `prs` in queue mode means nothing is waiting. Say so and stop.

## Step 2 — Act on the decisions

The script applies this table. `decide()` in `review-pr.ts` implements it, and `review-pr.test.ts` pins it. Change the code, the test and this table together:

| Situation | `action` |
| --- | --- |
| Closed or merged | `skip` |
| Authored by `claude-avut` | `skip` |
| Draft | `unsure` |
| No earlier review by `claude-avut` | `review` |
| Earlier review on an older commit | `re-review` |
| Earlier review at head, and a review re-requested (always true in queue mode) | `re-review` |
| Earlier review at head, no new request | `skip` |

- **`skip`:** report the reason and do nothing else.
- **`unsure`:** ask the user once about every unsure PR together, with its reason. Offer "review", "comment-only review" or "skip". In queue mode, start the clear-cut reviews first and ask while they run.
- If something in the JSON makes a decision look wrong, treat that PR as unsure and ask. For example, a `review` PR whose description says "do not review yet". Don't override the script silently.

## Step 3 — Earlier findings

For each `re-review`, take the Blocking and Non-blocking items from `previous.body`. They go to the reviewer as the findings to verify.

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

Write each body to its own file in the scratchpad, then:

```bash
node .claude/skills/avut-review-pr/review-pr.ts post <N> <approve|request-changes|comment> <body-file>
```

It posts as `claude-avut`, with that account's token scoped to the one call, and prints the review URL. The project allowlist covers every `review-pr.ts` command, `post` included, so it runs without a prompt; that is deliberate, and it is why only this skill should call `post`. Don't post with `gh pr review` directly. Posting a review clears the review request, so the queue doesn't pick the same PR up again.

If posting fails, report it and leave the other PRs alone. Don't retry under the default account.

## Step 7 — Show the output

- **One PR:** the posted review body in full, the verdict and the review URL.
- **Several PRs:** one row per PR (PR, title, verdict, blocking count, URL) and the rows for any PRs skipped, with the reason. Under the table, list each PR's blocking findings. The full bodies are at the URLs.

Afterwards, run `node .claude/skills/avut-review-pr/review-pr.ts cleanup`. It removes the `pr/<N>` refs.

## Common mistakes

- Reviewing in the main session instead of `avut-code-reviewer`.
- A reviewer reading the working tree instead of `pr/<N>`. That reviews the wrong code.
- Starting batch reviewers one at a time instead of in one message.
- Posting an unchecked blocking finding.
- Re-reviewing from scratch, and not checking the earlier findings.
- Running the `gh` or `git` steps by hand instead of `review-pr.ts`. It costs turns, it can apply the decision table inconsistently, and posting by hand risks using the wrong account (`alexwestphal`, or a `gh auth switch`).
- Asking for approval before posting. This skill posts, then shows the result.
