---
name: avut-develop-feature
description: Build a feature from a GitHub issue or a plain description. Clarify it if needed, triage it into a quick path (implement in-session) or a long path (reviewed plan executed by implementer/reviewer subagents in a worktree), pause for visual checks on UI work, and finish through /avut-ship. Trigger only when the user types /avut-develop-feature.
effort: high
manual: true
---

# Develop Feature

Takes a piece of work from "I want X" to a branch ready for `/avut-ship`. `$ARGUMENTS` is either a GitHub issue (a bare number, `#123`, or an issue URL) or a text description of what to achieve.

The checkpoints are deliberate, and there are few of them. Clarify only when the work is unclear. On the long path, get approval for the path and then for the plan. Pause for visual checks on UI work. The final push confirmation belongs to `/avut-ship`. Between checkpoints, just work.

## Step 1 — Resolve the source

- **Issue:** `gh issue view <n> --repo redcloud-nz/avut --json number,title,url,body,labels,comments`. Read the body and the comments. Brainstorm issues carry `## Idea`/`## Options considered`/`## Open questions` and often a `## Review` comment. Bug issues carry What happened / Steps to reproduce / Expected. Feature issues carry Proposed solution / Alternatives considered.
- **Description:** use it as given. If it names an existing issue or looks like one (`gh issue list --repo redcloud-nz/avut --search "<text>"`), mention the match and ask whether to build from that instead.
- **An exploration,** handed over by `/avut-explore`'s Keep step: its branch, its Decisions list, its gap list and the route chosen there. Skip Steps 2 and 3, since the exploration settled the idea and Keep chose the route:
  - **Finish in place:** the quick path from step 3, on the exploration's branch in the current checkout.
  - **Plan the rest:** the long path from L2, with the exploration's branch moved to a worktree (see L2). In L3, the exploration is **Task 0**, already done and ticked with its commits, and the gaps are the remaining tasks. The Decisions list goes into the plan's Decisions. L1 is covered by Keep's checkpoint.
- **Nothing given:** ask what to build and stop.

## Step 2 — Is it clear enough?

Look at the relevant code before deciding, because vagueness often resolves once you see what exists. The work is clear when you could state the outcome, the parts of the codebase it touches, and how you'd know it's done.

If it isn't clear, discuss. Ask the questions that change the shape of the work, a few at a time, and give your recommended answer for each. Treat a brainstorm issue's open questions and a feature issue's unresolved alternatives as undecided until the user decides them. If the discussion turns into a design exploration, suggest `/avut-brainstorm` rather than growing this session.

## Step 3 — Triage

Do a superficial scoping. Look at which areas the work touches and roughly how many steps it has. Don't plan it yet.

**Long path** if any of these hold:

- it spans several layers or areas (schema + service/router + UI, or several modules)
- it would take more than about 5 reviewable commits
- it adds a Prisma migration
- it has design decisions that are worth writing down before building

Otherwise, take the **quick path**. The user can override either way.

## Quick path

1. **Say so, then start.** In one short message: "Quick path: <what you'll change, in which files/areas>". Then carry on in the same turn. The user can interrupt. Don't wait for approval.
2. **Branch in the current checkout,** so the dev server the user already runs shows the change live. If the tree is clean, `git fetch origin && git switch -c <type>/<slug> origin/integration`. If there are uncommitted changes or you're on another feature branch, ask first.
3. **Implement** in this session, following `AGENTS.md`. Read the relevant `docs/patterns/` doc before writing a new page or mutation.
4. **Visual checkpoint,** if the work changes UI. See [Visual checkpoints](#visual-checkpoints).
5. **Finish:** run `npm run check`, commit, and continue into `/avut-ship`. It syncs with `integration`, runs the full check and the `avut-code-reviewer` subagent, fixes the findings, and stops for the push confirmation.

## Long path

### L1 — Checkpoint: confirm the path

Tell the user why you think this needs the long path (which of the Step 3 criteria apply) and what the rough shape is: the areas it touches, and whether a migration is involved. **Ask for approval to continue.** If they'd rather take the quick path, switch to it.

### L2 — Worktree

Derive a kebab-case slug. Run `git worktree list`. If `.claude/worktrees/<slug>` exists, resume it with `EnterWorktree` and `path`. Otherwise call `EnterWorktree` with `name: "<slug>"`, which branches off `origin/integration`. Then run `npm run worktree:setup` in it.

**From an exploration,** the branch already exists and is checked out in the main checkout. Commit everything on it, switch the main checkout back to the branch the exploration started from, and restore the stash `/avut-explore` made (by its SHA, never a bare `pop`), which gives the user their own uncommitted changes back. Then `git worktree add .claude/worktrees/<slug> <branch>`, `EnterWorktree` with `path`, and `npm run worktree:setup`. The main checkout is free again, and the user can start something else there in a new session.

If the plan has visual tasks, start the worktree's dev server in the background before the first visual checkpoint: `npm run dev` serves on the worktree's `.dev-port` (AGENTS.md → Dev servers).

If a migration is involved, `npm run db:branch <slug>` comes before the first `migrate dev`, as in the Database section of `AGENTS.md`. It needs every connection to `avut` closed: stop your own server, and ask the user to stop theirs and Prisma Studio. The `migrate dev` itself still needs permission. Do this when the migration task comes up, not upfront.

### L3 — Write the plan

Write `docs/plans/YYYY-MM-DD-<slug>.md`, following `docs/plans/README.md`: a `**Date:**` header matching the filename prefix, branch and DB notes up front, and a link to the issue or spec. Then:

- **Decisions:** anything settled in Step 2 or by reading the code.
- **Tasks,** numbered. Each task is one reviewable commit and has:
  - **Files:** the files it creates or changes.
  - **Do:** what to build, specific enough for someone with no session context. Name the pattern doc it follows.
  - **Done when:** acceptance criteria, plus the check that proves it (a test, `npm run check`, a query).
  - **`visual`:** marks a task that changes UI.

  Order the data layer first (schema → service → router → tests), then UI. Group visual tasks late, so there are one or two visual checkpoints and not one per task.
- **Out of scope:** what this deliberately doesn't do.

### L4 — Plan review

Run the `avut-plan-reviewer` subagent (`run_in_background: false`) with the plan path and the source (issue number or description). Fix the plan for every blocking finding and for the non-blocking ones you agree with. If a finding reopens a design question, it goes to the user in L5. Don't settle it yourself.

### L5 — Checkpoint: approve the plan

Show the user the plan: the task list with one line per task, the decisions, and what the plan review changed. **Wait for approval.** Commit the plan (`docs(plans): …`) once it's approved.

### L6 — Execute

For each task, in order:

1. **Implement.** Run the `avut-implementer` subagent (`run_in_background: false`) with the plan path and task number. Run tasks one at a time, in this worktree. Two implementers in one tree collide, and a separate worktree per implementer would need its own `worktree:setup` and a merge back, which costs more than it saves at this size.
2. **Blocked?** If the implementer reports the plan wrong for the code, or needs a decision, fix the plan if the fix is mechanical. If it needs a decision, ask the user. Then re-run the task.
3. **Review.** Run the `avut-code-reviewer` subagent on that task's commit (`git diff <sha>~1..<sha>`), saying what the task was meant to do.
4. **Fix.** If there are blocking findings, or non-blocking ones worth fixing, re-run `avut-implementer` for the same task with the findings. It commits the fixes as a follow-up commit. One fix round is the norm. If a second review still shows blocking problems, bring it to the user.
5. **Tick** the task in the plan: `- [x]` and the commit's subject line (not its sha, which the amend changes). Fold the tick into that task's last commit: `git commit --amend --no-edit docs/plans/<plan>.md`.
6. **Visual checkpoint** after the last task of each visual group. See below.

Keep the main session as the orchestrator. Read the reports, not the full diffs; the reviewer reads the diffs. That keeps this context small over a long feature.

Report progress only at checkpoints or when blocked. Don't send an update per task.

### L7 — Finish

When every task is ticked, continue into `/avut-ship`. Its whole-branch review catches problems between tasks that the per-task reviews couldn't see.

## Visual checkpoints

The user wants to see UI work and steer it before it's final.

1. **Self-check first.** Use `avut-test-in-browser` to sign in and open the changed page(s). Take a screenshot and fix anything obviously broken (errors, a broken layout, missing data) before showing it. Don't make the user find crashes.
2. **Pause.** Give the user the exact URL(s) on their dev server: the current checkout's port for the quick path, the worktree's port for the long path. Also give any state needed to see it (which org, which role, which record) and what to look at. Then wait.
3. **Iterate on feedback.** Apply changes in this session, even on the long path. Small visual tweaks aren't worth an implementer round-trip. **Don't commit after each round.** Keep the changes uncommitted until the user says it looks right, then commit once.
4. **Resume.** Continue with the next task, or finish.

If there's no dev server running for the checkout, start one as AGENTS.md → Dev servers says: `npm run dev` in a worktree, `PORT=3100 npm run dev` in the main checkout when the user's 3000 isn't up.

## Common mistakes

- Planning in detail before triage. Step 3 is a quick look, not a plan.
- Taking the long path without the L1 approval, or starting to build before the L5 approval.
- Waiting for approval on the quick path. Say what you'll do and do it.
- Letting an implementer's "the plan is wrong here" turn into a quiet reinterpretation.
- A visual checkpoint that hands the user a crash, or one checkpoint per UI task instead of per group.
- Committing every round of visual feedback.
- Running a separate final review. `/avut-ship` does that.
