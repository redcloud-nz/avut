---
name: avut-ship
description: Finish a feature branch — sync with integration, run the full check, get a fresh-context review from a subagent, fix what it finds, then (after one confirmation) push, open the PR with the review in its body, and set it to auto-merge on green CI. Trigger when the user types /avut-ship.
effort: high
manual: true
---

# Ship

Takes a finished feature branch to a merged PR with one human checkpoint. The review happens **before** the push, in a subagent with no authoring context, so a blocker costs one local fix rather than a push → review → fix → re-review round on GitHub. The PR is the record of that review, not the gate for it — `integration` requires CI to pass (strict: branch up to date), not an approval.

`$ARGUMENTS` is optional free text: extra context for the PR description, or `--no-merge` to open the PR without auto-merge (e.g. something you want to look at in the Vercel preview first).

For a PR that deserves a second, independent pass after it's open — auth, credentials, migrations, someone else's code — use `/avut-review-pr` instead of, or as well as, this.

## Step 1 — Preflight

```bash
git status --short
git branch --show-current
git fetch origin
```

- On `integration` or `production` → stop; this skill ships a feature branch.
- Uncommitted changes → commit what belongs to the work (conventional-commit message, as usual) or ask about anything that looks unrelated. Don't ship a dirty tree.
- **Work out the base.** Normally `origin/integration`. If the branch is stacked on another open PR's branch (`gh pr list --repo redcloud-nz/avut --head <parent-branch>` finds it), use that branch as the base for the diff and the PR.
- **Sync with the base**: `git merge origin/<base>` (not rebase — the branch may already be pushed). Two PRs that are each green can break each other once both merge; syncing here is what catches that before CI does. Resolve conflicts if any; if they're non-trivial, stop and show the user.

## Step 2 — Full check

```bash
npm run check -- --all
```

Fix what fails and commit the fixes. This is what CI runs, so a failure here is a failure there.

If the branch adds a Prisma migration, confirm the checkout is on a branch database (`db:branch`) and that the migration was applied there — say so in the PR body.

## Step 3 — Fresh-context review

Run the `avut-code-reviewer` subagent (`run_in_background: false`, because the next step depends on it). Its brief, two-pass checklist and output format live in `.claude/agents/avut-code-reviewer.md`. Give it only the diff range and the intent, not the authoring session's reasoning:

> Diff range: `origin/<base>...HEAD`. The change is meant to: <one or two sentences, plus the issue number if there is one>.

## Step 4 — Act on the findings

- **Blocking** — fix all of them. If you disagree with one, don't silently skip it: record it for the Step 6 summary with your reasoning, and let the user decide.
- **Non-blocking** — fix the ones that are cheap and clearly right; list the rest in the PR body under _Follow-ups_ (or suggest an issue for anything substantial).
- **Nits** — fix if trivial, otherwise drop.

Re-run `npm run check` after fixing and commit (one `fix: address pre-merge review findings` commit is fine; don't make one per finding).

If a blocking fix was substantial (new logic, not a one-liner), send the **fix commit's diff only** to `avut-code-reviewer` again. Don't re-review the whole branch. A single round is the norm.

## Step 5 — Draft the PR

Title: conventional-commit style, matching the branch's main commit (`feat(scope): …`, `fix(scope): …`). Body:

```markdown
## Summary

<what and why, 1–3 sentences; link the issue / plan doc; "Closes #n" when it does>

## Changes

- **<area>:** <change>

Worth a close look: <files where a human's attention pays off most, if any>

## Decisions

- <from an exploration or plan: what was settled, and what was tried and rejected, one line each>

## Pre-merge review

Fresh-context review (correctness + AVUT conventions) before push.

- Fixed: <blocking and non-blocking findings fixed, one line each, `file:line` — or "nothing blocking found">
- Not changed: <any finding deliberately left, with the reason>

## Test plan

- [x] `npm run check -- --all`
- [ ] <browser verification, if it applies — tick it only if it was actually done>

## Follow-ups

- <deferred non-blocking findings, known gaps>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Leave out any section with nothing in it. _Decisions_ comes from a `Decisions` list in a commit body (`/avut-explore` writes one) or the plan doc's Decisions.

## Step 6 — The one confirmation

Show the user, compactly:

- the branch, base and commit list (`git log --oneline origin/<base>..HEAD`)
- what the review found and what you did about it — especially any blocking finding you left alone
- the PR title and body
- what happens next: "Push, open PR, auto-merge (merge commit) when CI is green" — or without auto-merge if `--no-merge` was given or the change needs a look in the preview first (UI change not yet checked in a browser, or a migration)

Then wait. This is the only prompt in the flow — pushing is publishing, so it needs an explicit yes. If the user wants changes, make them and show the diff again. Don't restart the review for small edits.

## Step 7 — Push, open, merge

```bash
git push -u origin HEAD
gh pr create --repo redcloud-nz/avut --base <base> --title "<title>" --body-file <tmpfile>
gh pr merge <n> --repo redcloud-nz/avut --auto --merge   # skip with --no-merge
```

Use `--body-file` (write the body to a file in the scratchpad), never inline `--body`. For a stacked PR, don't auto-merge; it merges after its parent.

Report the PR URL. Then watch CI (`gh pr checks <n> --repo redcloud-nz/avut --watch`, in the background) and report the result. If it fails, show why (`gh run view <run-id> --log-failed`), fix, commit and push. Auto-merge picks the new run up. No new confirmation is needed for a CI fix that only touches the failure.

## Common mistakes

- Reviewing in the authoring session instead of a subagent. That review shares the blind spots of the author.
- Not merging `origin/<base>` first. That lets two separately-green PRs break `integration` when both merge.
- Asking for confirmation at several points. There is one, at Step 6.
- Re-reviewing the whole branch after fixes, not just the fix delta.
- Posting the review as a separate `claude-avut` GitHub review. It belongs in the PR body; `/avut-review-pr` is the tool for a formal review.
- Ticking a browser-verification box that wasn't done.
