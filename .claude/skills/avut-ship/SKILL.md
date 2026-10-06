---
name: avut-ship
description: Finish a feature branch — sync with integration, run the full check, get a fresh-context review from a subagent, fix what it finds, then (after one confirmation) push, open the PR with the review in its body, and set it to auto-merge on green CI. Trigger when the user types /avut-ship.
effort: high
manual: true
---

# Ship

Takes a finished feature branch to a merged PR with one human checkpoint. The review happens **before** the push, in a subagent with no authoring context, so a blocker costs one local fix rather than a push → review → fix → re-review round on GitHub. The PR is the record of that review, not the gate for it — `integration` requires CI to pass (strict: branch up to date), not an approval.

`$ARGUMENTS` is optional free text: extra context for the PR description, or `--no-merge` to open the PR without auto-merge (e.g. something you want to look at in the Vercel preview first).

For a PR that deserves a second, independent pass after it's open — auth, credentials, migrations, someone else's code — use `/avut-review-pr` instead of, or as well as, this. When you plan to run it as well, pass `--no-merge`. `integration` needs no approval, so auto-merge would merge on green CI before that review runs, or despite a "request changes".

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

_Follow-ups_ also lists any `follow-up` issues `/avut-develop-feature` filed from its parked list (`- #n <title>`).

## Step 5b — Docs impact

End-user guides (`content/docs/**` and its screenshots) aren't written per feature. Each PR with a user-facing change adds one item to its milestone's docs issue, and `/avut-docs` works through that issue once per milestone. Help cards (`content/help/**`) are different: they're updated in the feature branch itself. If the diff changes a screen that has a `<HelpButton>` and its card isn't in the diff, check whether the card still matches, and fix it before Step 6.

1. **Decide the impact.** Use the plan's `Docs impact` line, or what `/avut-develop-feature` handed over. Failing both, judge from the diff whether user-visible behaviour, wording or layout changed. Internal refactors, tests and developer docs have no impact. If there's none, skip the rest of this step.
2. **Find the milestone:** the source issue's (`gh issue view <n> --repo redcloud-nz/avut --json milestone`). If there's no source issue, or it has no milestone, propose the lowest open version milestone, which `node .claude/skills/avut-docs/milestone.ts show` prints. The user confirms it in Step 6, alongside everything else.
3. **Draft the item text,** one line. The script adds the checkbox and the PR number in front:

   ```
   <what changed, from a user's view>. Pages: <content/docs paths, or "new page">. Screenshots: <ids that change, or "none">
   ```

   Screenshot ids are in `src/lib/screenshots.generated.json`. `git grep -n '<Screenshot id=' content/docs` shows which pages use which.

The item is posted in Step 7, once the PR number exists.

## Step 6 — The one confirmation

Show the user, compactly:

- the branch, base and commit list (`git log --oneline origin/<base>..HEAD`)
- what the review found and what you did about it — especially any blocking finding you left alone
- the PR title and body
- the docs item and the milestone it goes to, or "no docs impact"
- what happens next: "Push, open PR, auto-merge (merge commit) when CI is green; if CI fails, fix it and push the fix" — or without auto-merge if `--no-merge` was given or the change needs a look in the preview first (UI change not yet checked in a browser, or a migration). Say the CI-fix part: the user's yes is what covers those later pushes.

Then wait. This is the only prompt in the flow — pushing is publishing, so it needs an explicit yes. If the user wants changes, make them and show the diff again. Don't restart the review for small edits.

## Step 7 — Push, open, merge

```bash
git push -u origin HEAD
gh pr create --repo redcloud-nz/avut --base <base> --title "<title>" --body-file <tmpfile>
gh pr merge <n> --repo redcloud-nz/avut --auto --merge   # skip with --no-merge
```

Use `--body-file` (write the body to a file in the scratchpad), never inline `--body`. For a stacked PR, don't auto-merge; it merges after its parent.

**Post the docs item** if Step 5b drafted one:

```bash
node .claude/skills/avut-docs/milestone.ts docs-add <milestone version> <PR number> "<item text>"
```

It finds the milestone's `Docs: <milestone>` issue, creating it if needed, and adds the item as a marked comment. It never edits the body: several sessions ship in parallel, and a body edit by one would overwrite another's. Report the issue number it prints, and whether it created the issue.

Report the PR URL. Then watch CI (`gh pr checks <n> --repo redcloud-nz/avut --watch`, in the background) and report the result. If it fails, show why (`gh run view <run-id> --log-failed`), fix, commit and push. Auto-merge picks the new run up. The Step 6 yes covers a push that only fixes the CI failure. Anything more than that goes back to the user first.

**If the branch carries a migration,** the shared `avut` database won't have it once the PR merges. The branch applied it to its `db:branch` copy, and every other checkout will fail on the missing column. When you report the merge, end with the two follow-up commands for the user to run. With `--no-merge`, give them as "once it merges": deploying before then would land an unmerged migration on shared `avut`. Don't run them yourself, because `migrate deploy` mutates the shared database:

```bash
npm run db:unbranch                  # in this checkout: back to avut, drop the copy
npm run prisma migrate deploy        # apply the merged migration to avut
```

## Common mistakes

- Reviewing in the authoring session instead of a subagent. That review shares the blind spots of the author.
- Not merging `origin/<base>` first. That lets two separately-green PRs break `integration` when both merge.
- Asking for confirmation at several points. There is one, at Step 6.
- Re-reviewing the whole branch after fixes, not just the fix delta.
- Posting the review as a separate `claude-avut` GitHub review. It belongs in the PR body; `/avut-review-pr` is the tool for a formal review.
- Ticking a browser-verification box that wasn't done.
- Adding a docs item by hand, or by editing the docs issue's body. `milestone.ts docs-add` posts it as a marked comment; only `/avut-docs` edits the body.
- Writing end-user docs into the feature PR instead of adding a docs item.
- Reporting a migration-bearing merge without the `db:unbranch` / `migrate deploy` follow-up.
