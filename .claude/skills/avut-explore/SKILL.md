---
name: avut-explore
description: Explore a half-formed idea by building it live in the main checkout — a short conversation, then small visible changes with the user's feedback after each, then keep (hand off to /avut-ship or /avut-develop-feature), park, or drop. Trigger only when the user types /avut-explore.
effort: high
manual: true
---

# Explore

For an idea the user wants to try now, before it's an issue or a plan. `$ARGUMENTS` is the rough idea. The aim is to find out what the user actually wants by showing them, fast, in the real app. It ends when the user decides to keep the idea, park it, or drop it.

It runs in the **main checkout**, not a worktree. The user's dev server there hot-reloads each change, and the user can read the code as it stands in their editor.

Between rounds, keep it cheap: no commits, no review subagent, no `npm run check`. The ceremony comes at the end, and only on Keep.

## Step 1 — Set up

1. `git status --short` and `git branch --show-current`. Remember both; the Park and Drop exits restore them.
   - Uncommitted changes, or a feature branch with unpushed commits: ask whether to **stash** them, **build on top** of them (explore from the current branch, changes and all), or **cancel**.
2. Create `explore/<slug>` from `origin/integration` (`git fetch origin integration` first), or from the current branch when the idea builds on it. Say which.
3. Check for the dev server: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000`. If nothing answers, ask the user to start it. Don't start one yourself.

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

- Editing `prisma/schema.prisma` and running `npx prisma generate` is fine. **Needing a migration ends the exploration**: a migration needs `db:branch`, which needs the dev server stopped. Say so and go to Keep.
- No seeding or database writes to get data to look at. Fake data goes inline in the component or scratch page, marked as such.
- Nothing that sends email.

## Step 4 — End it

The user says when. Or, once the idea has stopped changing, ask once whether to keep, park or drop it. Show the Decisions list either way.

### Keep

1. Fold back or delete any variants and scratch pages.
2. Commit in sensible units. Squash the exploration into commits that make sense on their own, not one per round.
3. List what was skipped (tests, `logEvent`, edge cases, the migration) and choose the next step:
   - **Small, and the skips are few:** do them now, run `npm run check`, then `/avut-ship`.
   - **Big, or it needs a migration:** `/avut-develop-feature` with the branch and the Decisions list as the starting point. Its plan covers what's left. It usually takes the long path, which will move the work to a worktree.

### Park

1. Commit the work as it stands on `explore/<slug>` as `wip(explore): <idea>`, with the Decisions list in the body. Don't push.
2. Offer to file it with `/avut-idea`, passing the idea, the Decisions list and the branch name, so the issue follows the usual idea format.
3. Switch back to the branch from Step 1 and `git stash pop` if you stashed.

### Drop

1. Confirm first: this discards the work.
2. `git restore` and remove any new files (scratch pages are gitignored, so remove those by hand), switch back to the branch from Step 1, `git branch -D explore/<slug>`, and `git stash pop` if you stashed.

## Common mistakes

- Asking a long list of questions before showing anything. One round, then build.
- Committing each round. Commits happen at Keep or Park.
- Running `npm run check` or a review subagent inside the loop.
- A round with no URL, or a URL without the state to see it in.
- An in-situ variant with renamed exports, so the swap touches more than one import.
- Leaving `.explore-*` copies or scratch pages behind after Keep.
- Starting a dev server, or running a migration against shared `avut`.
