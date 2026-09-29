---
name: avut-status
description: Where everything stands in this repo — every checkout and worktree, local branch, open PR, stash and dev server — with suggested tidy-ups. Trigger when the user types /avut-status, or asks for the status of their branches or worktrees.
effort: low
---

# Status

The gathering is one script call. It fetches `origin` (with `--prune`), then reads git, `gh` and the listening ports. It changes nothing else.

```bash
node .claude/skills/avut-status/status.ts             # markdown report
node .claude/skills/avut-status/status.ts --json      # the raw report, if you need a field it doesn't print
node .claude/skills/avut-status/status.ts --offline   # no fetch, no GitHub (no PR column)
```

The report has:
- **Checkouts:** the main checkout and each worktree, with branch, uncommitted files, `↑ahead ↓behind` against `origin/integration` (or `merged`), push state, open PR (CI, review decision, auto-merge), dev-server port (● when it's up) and database.
- **Branches without a worktree**, and **stashes**.
- **Dev servers** that are up, and whose they are.
- **Suggestions.** 🗑 marks the ones that delete something.

## What to do with it

1. Show the report as it is. Don't re-render it.
2. Under it, in two or three lines, say what matters: something failing, something waiting on the user (a plan to pick up, a PR to look at), work at risk (uncommitted changes in a worktree nobody's in, a stash that has sat for weeks), or anything surprising. Skip it if the report speaks for itself.
3. Offer the suggestions, and run the ones the user picks.
   - **🗑 suggestions need a yes for each one**, since they delete a worktree, a branch or a branch database. Removing a worktree is `npm run worktree:remove`, never plain `git worktree remove`, which would leak its branch DB.
   - `git push origin --delete` publishes, so it needs its own yes too.
   - A worktree with uncommitted changes is never a cleanup candidate, whatever its branch says.

If the user asked about one branch or worktree in particular, answer that from the report, and don't walk through the rest.

## Reading it

- `merged` means the branch has no commits `integration` lacks. Merges here are merge commits, so that's exact. It also shows for a branch that never got a commit of its own.
- `hotfix/*` branches come off `production`, so their numbers against `integration` mean little.
- Numbers are only as fresh as the fetch. The report says so when it couldn't fetch.
