---
name: avut-ship
description: Finish a feature branch — sync with integration, run the full check, get a fresh-context review from a subagent, fix what it finds, then (after one confirmation) push, open the PR with the review in its body, and set it to auto-merge on green CI. After the merge, offer to clean up: leave and remove the worktree, fast-forward local integration, delete the branch, and deploy any migration to the shared dev DB. Trigger when the user types /avut-ship.
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

## Step 6 — The push confirmation

Show the user, compactly:

- the branch, base and commit list (`git log --oneline origin/<base>..HEAD`)
- what the review found and what you did about it — especially any blocking finding you left alone
- the PR title and body
- the docs item and the milestone it goes to, or "no docs impact"
- what happens next: "Push, open PR, auto-merge (merge commit) when CI is green; if CI fails, fix it and push the fix" — or without auto-merge if `--no-merge` was given or the change needs a look in the preview first (UI change not yet checked in a browser, or a migration). Say the CI-fix part: the user's yes is what covers those later pushes.

Then wait. This is the only prompt before the push — pushing is publishing, so it needs an explicit yes. (Step 8's cleanup prompt comes after the merge.) If the user wants changes, make them and show the diff again. Don't restart the review for small edits.

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

**If the branch carries a migration,** the shared `avut` database won't have it once the PR merges. The branch applied it to its `db:branch` copy, and every other checkout will fail on the missing column. With auto-merge, Step 8 deploys it, with the user's yes. Without auto-merge, give the user the commands as "once it merges", since deploying before then would land an unmerged migration on shared `avut`:

```bash
npm run db:unbranch                  # in this checkout: back to avut, drop the copy
npm run prisma migrate deploy        # apply the merged migration to avut
```

## Step 8 — Clean up after the merge

Step 8 runs only when auto-merge was set in Step 7. Without auto-merge (`--no-merge`, a stacked PR, or a migration or UI change held back for a preview look), stop after reporting the PR. If it carries a migration, give the `db:unbranch` / `migrate deploy` commands from Step 7 as "once it merges".

**Before the merge lands, while the branch still exists,** note two things for the prompt:

- whether the branch adds migrations: `git diff --name-only origin/<base>...HEAD -- prisma/migrations`
- any dev server you started for this branch (a worktree's `.dev-port`, or 3100)

**Wait for the merge itself.** Auto-merge can lag CI by a minute or two, or stall: a `BEHIND` state under the strict up-to-date rule, after `integration` moved. Poll in the background while the PR is open:

```bash
while [ "$(gh pr view <n> --repo redcloud-nz/avut --json state -q .state)" = OPEN ]; do sleep 30; done
gh pr view <n> --repo redcloud-nz/avut --json state,mergeStateStatus
```

`CLOSED` means it closed without merging: report that and stop. If it's still open well after CI went green, check `mergeStateStatus`. `BEHIND` means sync with the base and push again. The Step 6 yes covers that only when the merge of `origin/<base>` is conflict-free and `npm run check -- --all` passes. Otherwise take it to the user, as in Step 1. Report anything else to the user. Don't start the cleanup on green CI alone.

Then **ask once**, listing exactly what will run. A yes is the explicit permission `migrate deploy` needs (AGENTS.md → Database). The user can drop any item.

1. **Leave the worktree, if the work was in one.**
   - Stop any dev server you started in it.
   - `ExitWorktree` with `action: "keep"` releases the session's lock on the worktree. Without that, `git worktree remove` refuses ("cannot remove a locked working tree").
   - From the main checkout, run `npm run worktree:remove <name>`, which also drops a `db:branch` copy. If it refuses because of untracked or modified files, report them. Don't add `--force`.

   On the quick path, the main checkout itself is on the feature branch: `git switch integration` instead. If its `.env.local` points at a branch DB, run `npm run db:unbranch -- --yes`. That drops the database the user's 3000 server is connected to, so that server needs a restart.
2. **Bring local `integration` up to date,** fast-forward only. Note its sha first (`git rev-parse integration`) for step 3. Run `git fetch origin`, then:
   - If `integration` is checked out in the main checkout and the tree is clean: `git merge --ff-only origin/integration`.
   - If `integration` isn't checked out anywhere: `git fetch origin integration:integration`. That moves the ref but not any working tree.
   - Otherwise, skip it and say why. That covers a dirty tree, and a fast-forward that fails because local `integration` has its own commits. Never stash, reset or merge to force it.
3. **Bring the main checkout's generated files up to date,** if step 2 changed its working tree. Compare the sha you noted with the new one (`git diff --name-only <old>..integration`). On the quick path, compare from the feature branch's tip instead, since that's what `node_modules` was built against:
   - `package-lock.json` changed: `npm install`. Its `postinstall` runs `prisma generate`. If the install rewrites `package-lock.json`, report it; don't commit or revert it.
   - otherwise, `prisma/schema.prisma` changed: `npx prisma generate`.
   - `npx next typegen` in every case. It regenerates route types and the content collections (docs, help cards, updates), which `tsc` and the tests read.
4. **Delete the local feature branch** with `git branch -d <branch>`. `-d` can refuse when the merge isn't in local `integration`, because step 2 was skipped. Then compare `git rev-parse <branch>` with the merged PR's head, read now: `gh pr view <n> --repo redcloud-nz/avut --json headRefOid`.
   - If they match, use `-D` and say so.
   - If they differ, there are commits that were never pushed. Keep the branch and report it.

   Leave the remote branch alone: GitHub deletes it on merge, and `git fetch --prune` tidies the stale ref.
5. **Deploy the migration to shared `avut`,** only if the branch added one. The deploy reads `prisma/migrations` from the working tree and the database from `.env.local`. So run it only when the main checkout passes both checks:
   - it has `integration` checked out, at `origin/integration`
   - its `.env.local` has `POSTGRES_DATABASE="avut"`

   Then, in the main checkout: `npm run prisma migrate deploy`, followed by `npx prisma generate`. Otherwise, don't run it. Hand the user the command and the reason, because a deploy from any other tree or database would report success while `avut` stays without the migration.

**Report** what ran and what was skipped. The user's dev server on 3000 picks up pulled code by itself. Say it needs a restart when any of these happened:
- `npm install` ran, or the Prisma client was regenerated
- a migration ran
- `.env.local` was repointed

## Common mistakes

- Reviewing in the authoring session instead of a subagent. That review shares the blind spots of the author.
- Not merging `origin/<base>` first. That lets two separately-green PRs break `integration` when both merge.
- Asking for confirmation at several points. There is one before the push, at Step 6, and one for the cleanup, at Step 8.
- Re-reviewing the whole branch after fixes, not just the fix delta.
- Posting the review as a separate `claude-avut` GitHub review. It belongs in the PR body; `/avut-review-pr` is the tool for a formal review.
- Ticking a browser-verification box that wasn't done.
- Adding a docs item by hand, or by editing the docs issue's body. `milestone.ts docs-add` posts it as a marked comment; only `/avut-docs` edits the body.
- Writing end-user guides into the feature PR instead of adding a docs item (help cards, by contrast, do belong in the PR).
- Reporting a migration-bearing PR without auto-merge, and without the `db:unbranch` / `migrate deploy` commands for once it merges.
- Starting the cleanup on green CI rather than on the merge. Running `git worktree remove` while the session is still inside the worktree (`ExitWorktree` first). Forcing an `integration` update that isn't a clean fast-forward. Running `migrate deploy` from a tree that isn't `integration` on `avut`.
