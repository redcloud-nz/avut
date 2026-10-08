---
name: avut-explore
description: Explore a half-formed idea by building it live in the main checkout (or a named worktree) — a short conversation, then small visible changes with the user's feedback after each, then keep (finish in place, plan the rest in a worktree, or rebuild), park, or drop. Trigger only when the user types /avut-explore.
effort: high
manual: true
---

# Explore

For an idea the user wants to try now, before it's an issue or a plan. `$ARGUMENTS` is the rough idea. The aim is to find out what the user actually wants by showing them, fast, in the real app. It ends when the user decides to keep the idea, park it, or drop it.

It runs in the **main checkout** by default. The dev server there hot-reloads each change, and the user can read the code as it stands in their editor. With `in:<name>` in the arguments (or "in worktree <name>"), it runs in that worktree instead, as AGENTS.md → Worktrees describes; "the checkout" below then means the worktree.

Between rounds, keep it cheap: no commits, no review subagent, no `npm run check`. The ceremony comes at the end, and only on Keep.

## Step 1 — Set up

1. `git status --short` and `git branch --show-current`. Remember both; the Park and Drop exits restore them.
   - Uncommitted changes: ask whether to **set them aside** (explore without them), **build on top** of them, or **cancel**. Either way, stash them first, so every exit can give them back to the user's own branch untouched.
   - The stash stack is shared by every checkout and session, so never a bare `git stash`/`pop`: `git stash push -u -m "explore-<slug>"`, note its SHA from `git stash list --format='%H %gs'`, and later restore with `git stash apply <sha>`, then drop that entry (found again by its message).
2. Create `explore/<slug>` from `origin/integration` (`git fetch origin integration` first), or from the current branch when the idea builds on it (a feature branch with unpushed commits, say). Say which.
   - **Build on top:** `git stash apply <sha>` on the new branch and commit it straight away as `wip(explore): carried over from <branch>`. **Keep the stash entry**: it's the user's copy, and the exits restore it to their branch. The explore branch's copy is only for building on.
3. Find the dev server (AGENTS.md → Dev servers). In the main checkout, use the user's 3000 if it answers (`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000`). Otherwise, start `PORT=3100 npm run dev` in the background yourself, and stop it when the exploration ends. In a worktree, `npm run dev` there serves on its `.dev-port`.

## Step 2 — A short conversation

Read enough of the relevant code to talk concretely. Then restate the idea in two or three lines, and ask only the questions whose answers change the **first** change: where it lives, what it replaces, what data it shows. Give a default for each, and state defaults for everything else rather than asking. One round is usually enough.

Then say "First cut: <what>. Look at `<URL>`." and build it. If the conversation turns into weighing designs with no code in sight, suggest `/avut-brainstorm` instead.

## Step 3 — The loop

Each round, make one small visible change and report:

- what changed, in a line or two (file links, not diffs)
- the exact URL, and the state to see it in: which org, which record, which dialog to open, what to click
- anything you're unsure about, or a choice you made that the user may want to reverse

Then wait for feedback. Keep the code compiling: the dev server's overlay or `npx tsc --noEmit` when you've changed types. Check the page yourself with `avut-test-in-browser` or a screenshot when the change is fiddly, before handing it over.

Keep a running **Decisions** list (what was tried, what was settled, what was rejected and why). Show it when asked, and at the end. The back-and-forth loses things otherwise.

### Code quality

Write real code from the start, because part of the point is seeing what the code would look like: `route()`, the Std/Saratoga/Kaga blocks, the pattern docs, a real tRPC procedure with the right permission. Skip tests, `ctx.logEvent` and edge-case polish until Keep, and note each skip in the Decisions list so Keep can pick them up.

### Comparing variants

When the question is "which is better", build the variants and let the user compare. Pick the form that suits the case:

- **Side by side on one page** — when the variants fit together on screen and don't need their real surroundings: a scratch page at `orgs/[slug]/system/scratch/<task>/page.tsx` (see its README; gitignored, delete when done).
- **Separate pages** — when each variant needs the full width, its own layout, or its own route to be judged fairly: `system/scratch/<task>/a/page.tsx`, `.../b/page.tsx`, and so on. Give the user every URL.
- **In situ** — when a component has to be judged where it's actually used. Duplicate the component's file next to the original as `<name>.explore-<variant>.tsx`, keeping every export name the same, change the copy, and point the **single import** in the consumer at it. Swapping variants is then a one-line import change, and the original stays untouched. Say which variant is live after each swap.

Don't commit variants. When one wins, fold it back: an in-situ winner overwrites the original file and the import is restored; losers are deleted.

### Guardrails

- Editing `prisma/schema.prisma` and running `npx prisma generate` is fine. **Needing a migration ends the exploration**: a migration needs `db:branch`, which needs every dev server on `avut` stopped. Say so and go to Keep, which will choose Plan the rest.
- No seeding or database writes to get data to look at. Fake data goes inline in the component or scratch page, marked as such.
- Nothing that sends email.

## Step 4 — End it

The user says when. Or, once the idea has stopped changing, ask once whether to keep, park or drop it. Show the Decisions list either way.

### Keep — "I like this, let's build it properly"

The idea is settled, so don't clarify it again. What's left to judge is the **gap** between the exploration and shippable code.

1. **Tidy.** Fold the winning variant back in, and delete the losing copies and scratch pages.
2. **List the gaps.** Read `git diff origin/integration...` against the Decisions list, and group what's missing:
   - **Data:** inline fake data to replace with real queries, schema changes, a migration.
   - **Server:** the right permission on each procedure, `ctx.logEvent` inside `$transaction`, the no-D4H-token case, a service-layer home for the logic.
   - **UI:** loading, empty and error states; `<Protect>` on actions; the mutation-dialog pattern.
   - **Tests.**
   - **Wiring:** `modules.ts`, typegen, entity links, pattern docs.
3. **Checkpoint: pick the route.** Show the gap list, recommend one route, and wait:
   - **Finish in place** (the usual one): the gaps fit the quick-path criteria in `/avut-develop-feature` Step 3. Work stays here.
   - **Plan the rest:** the gaps are big by those criteria, or a migration is needed. The work moves to a worktree, so the user can do something else in the main checkout.
   - **Rebuild:** the exploration wandered, and its code is shaped by turns that were reversed. Start a fresh branch from `origin/integration` with the Decisions list as the spec. Keep `explore/<slug>`, under that name, as a reference until the new one merges.
4. **Rename** (Finish in place and Plan the rest only): `git branch -m explore/<slug> <type>/<slug>`. If the exploration carried over the user's changes, ask whether they belong in the feature. If not, drop that commit (`git rebase --onto <it>~1 <it>`). Either way, the user's own branch gets them back from the stash when they return to it: give them the stash SHA, or restore it yourself when the work leaves the main checkout.
5. **Commit the exploration** in one to three commits by layer (not one per round), so the history shows what came from exploring and what came from finishing. Put the Decisions list in the body of the last one.
6. **Hand off** to `/avut-develop-feature` as an exploration, with the branch, the Decisions list, the gap list and the route (its Step 1 describes each route). **Plan the rest** moves the branch to a worktree, and this session moves with it, keeping the exploration's context. Tell the user the main checkout is free for a new session. **Rebuild** goes to `/avut-develop-feature` as a plain description, with the Decisions list attached.

The Decisions list ends up in the PR body too; `/avut-ship` picks it up from the commit.

If this session started a server on 3100, stop it once the work leaves the main checkout.

### Park

1. Commit the work as it stands on `explore/<slug>` as `wip(explore): <idea>`, with the Decisions list in the body. Don't push.
2. Offer to file it as a `brainstorm` issue in redcloud-nz/avut-ideas, in `/avut-brainstorm`'s body format: the Decisions list goes under `## Options considered`, what's still undecided under `## Open questions`, and the branch name under `## Notes`. Show the draft and confirm before creating it. A parked idea isn't ready to build, so it doesn't go on avut's backlog.
3. Switch back to the branch from Step 1, and restore the stash (by its SHA) if you made one: the user's uncommitted changes return exactly as they were, whatever the WIP commit holds. Stop your 3100 server if you started one.

### Drop

1. Confirm first: this discards the work.
2. `git restore` and remove any new files (scratch pages are gitignored, so remove those by hand), switch back to the branch from Step 1, `git branch -D explore/<slug>`, and restore the stash (by its SHA) if you made one: that's the user's work, and it's the one thing Drop must not lose. Stop your 3100 server if you started one.

## Common mistakes

- Asking a long list of questions before showing anything. One round, then build.
- Committing each round. Commits happen at Keep or Park.
- Running `npm run check` or a review subagent inside the loop.
- A round with no URL, or a URL without the state to see it in.
- An in-situ variant with renamed exports, so the swap touches more than one import.
- Leaving `.explore-*` copies or scratch pages behind after Keep.
- Starting a server on 3000, or leaving your 3100 server running after the exploration ends (it blocks the user's `npm run dev`).
- Running a migration against shared `avut`.
- Re-asking clarifying questions at Keep. Judge the gap, not the idea.
- A bare `git stash pop`, which can take another session's stash.
- Building on top of the user's uncommitted changes without a stash to give them back from. Drop and Park would lose them.
