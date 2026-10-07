---
name: avut-develop-feature
description: Build a feature from a GitHub issue or a plain description. Clarify it if needed, triage it into a quick path (implement in-session) or a long path (reviewed plan executed by implementer/reviewer subagents in a worktree), pause for visual checks on UI work, park side-findings as follow-ups, and finish through /avut-ship. With --plan-only, stop once the plan is written and reviewed, on a plan/<slug> branch; given a plan (path, slug or plan/ branch), pick it up and build it. Trigger only when the user types /avut-develop-feature.
effort: high
manual: true
---

# Develop Feature

Takes a piece of work from "I want X" to a branch ready for `/avut-ship`. `$ARGUMENTS` is one of:

- a GitHub issue (a bare number, `#123`, or an issue URL) or a text description of what to achieve: the full flow below
- either of those with **`--plan-only`**: write and review the plan, then stop. See [Plan only](#plan-only)
- **a plan to pick up**: a `docs/plans/…` path, a `plan/<slug>` branch, or a slug. See [Pick up a plan](#pick-up-a-plan)

The checkpoints are deliberate, and there are few of them. Clarify only when the work is unclear. On the long path, get approval for the plan. Pause for visual checks on UI work. The final push confirmation belongs to `/avut-ship`. Between checkpoints, just work.

**End-user guides aren't part of a feature.** Don't write or change `content/docs/**` or its screenshots here. Screenshots go stale with every UI tweak, so that work happens once per milestone in `/avut-docs`. Note the feature's docs impact instead (L3, or one line on the quick path), and `/avut-ship` adds it to the milestone's docs issue. **Help cards are the exception:** a feature that changes a screen updates that screen's card in `content/help/**` in the same branch, and adds or removes cards along with the `<HelpButton>`s that use them (see `content/README.md`). Developer docs that describe the code (`AGENTS.md`, `docs/patterns/`, `src/components/ui/README.md`, CLAUDE.md files) also change in-branch.

## Step 1 — Resolve the source

- **Issue:** `gh issue view <n> --repo redcloud-nz/avut --json number,title,url,body,labels,milestone,comments`. Read the body and the comments. Brainstorm issues carry `## Idea`/`## Options considered`/`## Open questions` and often a `## Review` comment. Bug issues carry What happened / Steps to reproduce / Expected. Feature issues carry Proposed solution / Alternatives considered.
- **Description:** use it as given. If it names an existing issue or looks like one (`gh issue list --repo redcloud-nz/avut --search "<text>"`), mention the match and ask whether to build from that instead.
- **An exploration,** handed over by `/avut-explore`'s Keep step: its branch, its Decisions list, its gap list and the route chosen there. Skip Steps 2 and 3, since the exploration settled the idea and Keep chose the route:
  - **Finish in place:** the quick path from step 3, on the exploration's branch in the current checkout.
  - **Plan the rest:** the long path from L2, with the exploration's branch moved to a worktree (see L2). In L3, the exploration is **Task 0**, already done and ticked with its commits, and the gaps are the remaining tasks. The Decisions list goes into the plan's Decisions. L1 is covered by Keep's checkpoint.
- **A plan** (a `docs/plans/` path, `plan/<slug>`, or a slug that matches a `plan/*` branch): skip everything and go to [Pick up a plan](#pick-up-a-plan).
- **Nothing given:** ask what to build and stop. Mention any waiting plans (`git branch --list 'plan/*'`).

**Database preflight.** Run `npm run prisma migrate status` (read-only). The shared `avut` database falls behind `integration` whenever someone merges a migration, and the app then fails at the first visual check with a missing-column error. If migrations are pending, check each against `git ls-tree --name-only origin/integration prisma/migrations/`. Those already on `integration` mean `avut` fell behind: list them in your first message and ask the user to run `npm run prisma migrate deploy` from the main checkout. A migration that exists only on this branch must never reach shared `avut`. It needs `db:branch` (L2), not a deploy. Don't run either yourself: it mutates the shared database, and the permission classifier blocks it anyway. Carry on with reading and planning while they do. (`npm run dev` prints the same warning when it starts, but an agent doesn't always start a server, so check here regardless.)

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
5. **Finish:** run `npm run check`, commit, settle the [parked list](#side-findings-fix-now-or-park), and continue into `/avut-ship`. Tell it the docs impact (or "none"). It syncs with `integration`, runs the full check and the `avut-code-reviewer` subagent, fixes the findings, and stops for the push confirmation.

## Long path

### L1 — Say why it's the long path

Tell the user which of the Step 3 criteria apply and the rough shape: the areas it touches, and whether a migration is involved. Then carry on into L2 in the same turn, as the quick path does. The user can interrupt, and L5 is the real gate.

If Step 2 left design questions open, ask them here in the same `AskUserQuestion`, with the path as one more question, and wait for the answers. That's the only time L1 stops.

### L2 — Worktree

Derive a kebab-case slug. Run `git worktree list`. If `.claude/worktrees/<slug>` exists, resume it with `EnterWorktree` and `path`. Otherwise call `EnterWorktree` with `name: "<slug>"`, which branches off `origin/integration`. Then run `npm run worktree:setup` in it.

**From an exploration,** the branch already exists and is checked out in the main checkout. Commit everything on it, switch the main checkout back to the branch the exploration started from, and restore the stash `/avut-explore` made (by its SHA, never a bare `pop`), which gives the user their own uncommitted changes back. Then `git worktree add .claude/worktrees/<slug> <branch>`, `EnterWorktree` with `path`, and `npm run worktree:setup`. The main checkout is free again, and the user can start something else there in a new session.

If the plan has visual tasks, start the worktree's dev server in the background before the first visual checkpoint: `npm run dev` serves on the worktree's `.dev-port` (AGENTS.md → Dev servers).

If a migration is involved, `npm run db:branch <slug>` comes before the first `migrate dev`, as in the Database section of `AGENTS.md`. It needs every connection to `avut` closed: stop your own server, and ask the user to stop theirs and Prisma Studio. The `migrate dev` itself still needs permission. Do this when the migration task comes up, not upfront.

The worktree is isolated: the harness refuses shell commands it can't prove stay inside it (Python heredocs that write files, `psql` with a computed URL). Edit files, the plan included, with Edit/Write rather than scripts. Look up test records with `avut-test-in-browser`'s `test-data.sh`, not `psql`.

### L3 — Write the plan

Write `docs/plans/YYYY-MM-DD-<slug>.md`, following `docs/plans/README.md`: a `**Date:**` header matching the filename prefix, branch and DB notes up front, a `**Written against:** integration @ <short sha>` line (`git rev-parse --short origin/integration`), and a link to the issue or spec. Then:

- **Decisions:** anything settled in Step 2 or by reading the code.
- **Tasks,** numbered. Each task is one reviewable commit and has:
  - **Files:** the files it creates or changes.
  - **Do:** what to build, specific enough for someone with no session context. Name the pattern doc it follows.
  - **Done when:** acceptance criteria, plus the check that proves it (a test, `npm run check`, a query).
  - **`visual`:** marks a task that changes UI.
  - **`mechanical`:** marks a task that follows a named pattern doc or an existing example with little judgement left: UI wiring to an established dialog or page pattern, moves and renames, tests for a service that's already built, plumbing a field through schema → form. Never schema or migrations, services, routers, permissions, `ctx.logEvent`/`$transaction` pairing, D4H-token handling, or anything the plan review called tricky.

  Order the data layer first (schema → service → router → tests), then UI. Group visual tasks late, so there are one or two visual checkpoints and not one per task. Mark where each **review group** ends: the data layer is one group, and each run of visual tasks up to its checkpoint is another. Split a group of more than about four tasks.
- **Docs impact:** one line. Which user-facing behaviour changed, which `content/docs/` guide pages it likely touches (or "new page"), and which screenshots would change. "None" when nothing user-facing changed. `/avut-ship` copies it to the milestone's docs issue.
- **Out of scope:** what this deliberately doesn't do.
- **Parked:** starts empty. See [Side findings](#side-findings-fix-now-or-park).

### L4 — Plan review

Run the `avut-plan-reviewer` subagent (`run_in_background: false`) with the plan path and the source (issue number or description). Fix the plan for every blocking finding and for the non-blocking ones you agree with. If a finding reopens a design question, it goes to the user in L5. Don't settle it yourself.

### L5 — Checkpoint: approve the plan

Show the user the plan: the task list with one line per task (marking `visual` and `mechanical`), the review groups, the decisions, the docs impact, and what the plan review changed. **Wait for approval.** Commit the plan (`docs(plans): …`) once it's approved.

### L6 — Execute

Work through the plan one review group at a time. For each task in the group, in order:

1. **Implement.** Run the `avut-implementer` subagent (`run_in_background: false`) with the plan path and task number. Pass `model: "sonnet"` for a `mechanical` task; leave `model` unset otherwise. Run tasks one at a time, in this worktree. Two implementers in one tree collide, and a separate worktree per implementer would need its own `worktree:setup` and a merge back, which costs more than it saves at this size.
2. **Blocked?** If the implementer reports the plan wrong for the code, or needs a decision, fix the plan if the fix is mechanical. If it needs a decision, ask the user. Then re-run the task. A sonnet implementer that reports blocked on a `mechanical` task is a sign the tag was wrong: drop the tag and re-run it without `model`.
3. **Tick** the task in the plan: `- [x]` and the commit's subject line (not its sha, which an amend changes). Fold the tick into that task's commit: `git commit --amend --no-edit docs/plans/<plan>.md`.

At the end of the group:

4. **Review the group.** Run the `avut-code-reviewer` subagent on the group's commits (`git diff <first-sha>~1..<last-sha>`), saying what each task in the group was meant to do.
5. **Fix blocking findings now.** Re-run `avut-implementer` with the plan path, the task the finding belongs to, and the findings. Pass `model: "sonnet"` only if that task is `mechanical`. A blocker in a data-layer or permission task is exactly where the stronger model matters. It commits the fixes as a follow-up commit. One fix round is the norm. If a second review of the fix commit still shows blocking problems, bring it to the user.
6. **Collect the rest.** Add non-blocking findings worth fixing to a `## Review notes` list at the end of the plan, and drop the nits. Don't send them back one group at a time.
7. **Visual checkpoint** if the group was visual. See below.

After the last group, if `## Review notes` has anything in it, run `avut-implementer` once to fix the whole list in one commit. Use `model: "sonnet"` only if every note belongs to a `mechanical` task. Use `Task: review notes` in place of a task number.

Keep the main session as the orchestrator. Read the reports, not the full diffs; the reviewer reads the diffs. That keeps this context small over a long feature.

Report progress only at checkpoints or when blocked. Don't send an update per task.

### L7 — Finish

When every task is ticked, settle the [parked list](#side-findings-fix-now-or-park), then continue into `/avut-ship`. Its whole-branch review catches problems between groups that the group reviews couldn't see.

After the PR is open, if the user wants to start the next plan, suggest a fresh session for it. One plan per session keeps the orchestrator's context clean; chaining plans in one session has needed several compactions.

## Side findings: fix now or park

The user will notice things along the way, and so will you. Sort each one, out loud, in one line:

- **Fix now:** it's small, it's in or right next to code this branch already touches, and it needs no design decision. Fix it in its own commit, so the review and the PR stay readable. On the long path, fix it in this session, as with visual tweaks.
- **Park:** anything else, including any "while we're at it" that is really a new feature. Say "Parked: <one line>" and carry on without discussing it. On the long path, add it to the plan's `## Parked` section with enough context to file it later. On the quick path, keep the list in the session.

The user can override either way. "Just do it" on a parked item makes it fix-now. If it's bigger than a fix, add it to the plan as a new task, which goes through the implementer and the group review like any other. Saying "let's add that too" turns a parked item into a task, not a quiet in-session build.

**Settle the list before `/avut-ship`.** Show the parked items once, each with a proposed issue title. The user picks per item: file it, or drop it. Then file the kept ones with one confirmation: `gh issue create --repo redcloud-nz/avut --label follow-up`, with an `**Area:**` line and a paragraph of context. Put the source issue's milestone on them only if the user says so; otherwise leave them unmilestoned. Record the filed issue numbers in the plan's Parked section and pass them to `/avut-ship` for the PR's Follow-ups. Nothing parked outlives the branch except as an issue.

## Plan only

For `--plan-only`: the plan gets written and reviewed now, and built later, maybe in another session. The plan lives on its own branch until then, never on whatever branch the current checkout has out.

1. **Steps 1–3** as usual. If triage says quick path, say so and ask whether a plan is still wanted.
2. **Branch and worktree, without touching the current checkout:**
   ```bash
   git fetch origin integration
   git worktree add -b plan/<slug> .claude/worktrees/<slug> origin/integration
   ```
   Don't `EnterWorktree`, and don't run `worktree:setup`. Planning only reads code, and this session stays where it is. Write the plan into `.claude/worktrees/<slug>/docs/plans/` by path, and read code there too, not in the current checkout, which may be on another branch.
3. **L3 and L4:** write the plan, then run `avut-plan-reviewer`. Tell it the code to check the plan against is in `.claude/worktrees/<slug>`. Fix what it finds.
4. **Commit and stop:** `git -C .claude/worktrees/<slug> add docs/plans/<file>` and `git -C .claude/worktrees/<slug> commit -m "docs(plans): <subject>"`. Show the task list, the decisions, what the review changed, and how to pick it up: `/avut-develop-feature plan/<slug>`. Don't push.

L5's approval happens at pickup.

## Pick up a plan

1. **Find it.** In order: a `plan/<slug>` branch (`git branch --list 'plan/*<slug>*'`), a worktree at `.claude/worktrees/<slug>`, then `git log --all --oneline -- 'docs/plans/*<slug>*'`. More than one match: ask which.
2. **Enter the worktree.** If `.claude/worktrees/<slug>` exists, `EnterWorktree` with `path`. If not, `git worktree add .claude/worktrees/<slug> plan/<slug>` first. Then `npm run worktree:setup`.
3. **Rename the branch:** `git branch -m plan/<slug> <type>/<slug>`, with `<type>` being `feat` or `fix` from what the plan builds (it works with the branch checked out). From here on it's an ordinary feature branch.
4. **Check the plan is still fresh.** `git merge origin/integration`, then run Step 1's database preflight. The order matters, because the preflight compares the database with this checkout's migrations. Then compare against the plan's `Written against` commit: `git diff --stat <sha>..origin/integration -- <every file the plan names>`. If any of them changed, run `avut-plan-reviewer` again and fix the plan. If the fix is substantive, update the plan's `**Date:**` and filename prefix together, per `docs/plans/README.md`. A plan written before review groups, `mechanical` tags or a Docs impact line existed gets them added now; show them at L5.
5. **L5, then L6 and L7:** show the plan, including anything the freshness check changed, and wait for approval. Then execute and finish as on the long path. L2's migration and dev-server notes still apply.

## Visual checkpoints

The user wants to see UI work and steer it before it's final.

1. **Self-check first.** Use `avut-test-in-browser` to sign in and open the changed page(s). Take a screenshot and fix anything obviously broken (errors, a broken layout, missing data) before showing it. Don't make the user find crashes. If you can't self-check (the browser is held by another session, say), tell the user plainly that the page is unchecked, and why.
2. **Pause.** Give the user the exact URL(s) on their dev server: the current checkout's port for the quick path, the worktree's port for the long path. Also give any state needed to see it (which org, which role, which record) and what to look at. Then wait.
3. **Iterate on feedback.** Apply changes in this session, even on the long path. Small visual tweaks aren't worth an implementer round-trip. **Don't commit after each round.** Keep the changes uncommitted until the user says it looks right, then commit once. Feedback that's a new feature rather than a tweak is a [side finding](#side-findings-fix-now-or-park): park it, or make it a plan task.
4. **Resume.** Continue with the next group, or finish.

If there's no dev server running for the checkout, start one as AGENTS.md → Dev servers says: `npm run dev` in a worktree, `PORT=3100 npm run dev` in the main checkout when the user's 3000 isn't up.

## Common mistakes

- Committing a `--plan-only` plan in the current checkout, or on its branch. It goes on `plan/<slug>` in its own worktree.
- Picking up a plan without the freshness check, or leaving the branch named `plan/…` once building starts.
- Skipping the database preflight, then handing the user a visual checkpoint that fails on a missing column.
- Planning in detail before triage. Step 3 is a quick look, not a plan.
- Stopping at L1 when there's nothing to ask, or starting to build before the L5 approval.
- Waiting for approval on the quick path. Say what you'll do and do it.
- Letting an implementer's "the plan is wrong here" turn into a quiet reinterpretation.
- Tagging a data-layer, permission or D4H task `mechanical` to save time.
- Reviewing every task separately, or sending non-blocking findings back to the implementer group by group. Fix blockers per group; batch the rest.
- Writing end-user docs or re-shooting screenshots in a feature branch.
- Building a "while we're at it" in-branch without the user saying so, or letting parked items vanish instead of filing them.
- A visual checkpoint that hands the user a crash, or one checkpoint per UI task instead of per group.
- Committing every round of visual feedback.
- Running a separate final review. `/avut-ship` does that.
