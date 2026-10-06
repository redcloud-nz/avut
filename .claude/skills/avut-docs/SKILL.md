---
name: avut-docs
description: Bring the end-user docs (content/docs/** and its screenshots) up to date for a milestone, working through that milestone's "Docs: v<version>" issue, which /avut-ship adds an item to for each user-facing PR. With `consolidate`, only fold the item comments into the issue's checklist. Trigger only when the user types /avut-docs.
effort: high
manual: true
---

# Docs

End-user docs trail the code on purpose. A feature branch doesn't touch `content/docs/**` or its screenshots, because a screenshot taken mid-feature goes stale with the next UI tweak. Instead, `/avut-ship` posts one item per user-facing PR as a comment on the milestone's docs issue. This skill brings the docs up to date once per milestone, after the milestone's UI has settled and before `/avut-release`. The release's milestone check sees the docs issue still open until this has run.

`$ARGUMENTS`:

- `[version]`: consolidate, then work through the checklist. See [Docs pass](#docs-pass).
- `consolidate [version]`: only fold the item comments into the checklist, then show it. Use it to see the docs debt for a milestone at any point.

`version` defaults to the lowest open version milestone.

Everything that touches the docs issue goes through `milestone.ts` in this skill's folder. Its header documents each command, and `milestone.test.ts` pins the parsing and merging. Don't edit the issue by hand: the script's order of operations is what keeps items from being lost.

## Step 1 — Find the milestone and its docs issue

```bash
node .claude/skills/avut-docs/milestone.ts show [version]
```

It prints the milestone, its open issues and its docs issue number. A `docsIssue` of `null` means no PR in the milestone has declared a docs impact. Say so and stop.

## Step 2 — Consolidate

```bash
node .claude/skills/avut-docs/milestone.ts docs-consolidate [version]
```

It folds the item comments `/avut-ship` posted into the body's `## Items` list. It sorts them by PR, skips PRs already listed (so a re-run never duplicates or resets a tick), and keeps any notes you added to the section. It writes the body, re-reads it to confirm every item took, and only then deletes the comments it folded. Discussion comments, and items posted after it read, are left alone. If it reports that the write didn't take, it has deleted nothing. Show the user the error rather than retrying blindly.

Show the checklist it prints: ticked and unticked counts, and the unticked items. For `consolidate`, stop here.

## Docs pass

### Step 3 — Is the milestone ready?

Look at the milestone's other open issues, from Step 1's `show` output (everything but the docs issue). Docs written while features are still being built go stale in the same way. If any are open, show them and ask whether to go ahead anyway.

Then run `npm run prisma migrate status` (read-only). Pending migrations break the dev server, and screenshots come from it. Ask the user to run `npm run prisma migrate deploy` if any show up.

### Step 4 — Worktree

Use a worktree, so the main checkout stays free: `EnterWorktree` with `name: "docs-<version>"` (or `path`, if `.claude/worktrees/docs-<version>` exists from an earlier run), then `npm run worktree:setup`. Rename the branch to `docs/v<version>` (`git branch -m docs/v<version>`). Start the dev server in the background (`npm run dev`, on the worktree's `.dev-port`).

### Step 5 — Work the checklist

For each unticked item:

1. **Read what changed:** `gh pr view <PR> --repo redcloud-nz/avut --json title,body,files`. Look at the affected pages on the dev server, in the `demo` org. The current UI is the truth, not the PR, because later PRs may have changed it again.
2. **Update the MDX** under `content/docs/`, following the conventions of the pages around it (`section`, `order`, `keyTerms` frontmatter). A new page belongs to the section that matches its module id in `src/lib/modules.ts`.
3. **Re-shoot the screenshots** the item names, plus any others you see are out of date on the pages you touched. Follow `avut-doc-screenshots`: demo org only, the standard sizes, and the same `id` so existing references keep working.
4. **Commit** with `docs(<area>): …`, one commit per item or per page group, whichever reads better.

Several items often touch the same page. Do them together, so a page is rewritten and shot once.

Tick each item once its commit is in: `node .claude/skills/avut-docs/milestone.ts docs-tick <version> <PR>`. Items that need no change once you look (a later PR already covered them, or the change turned out invisible) get ticked with a note: `docs-tick <version> <PR> "no change needed: <why>"`.

### Step 6 — Visual checkpoint

Give the user the local `/docs/...` URLs of every page you changed, on the worktree's port, and the in-app `?help=<slug>` URL of one page, since that renders the same MDX differently. Iterate on feedback without committing each round (as in `/avut-develop-feature`'s visual checkpoints), then commit once.

### Step 7 — Ship

Run `docs-consolidate` once more, in case a ship landed an item mid-pass. Work any new items, then continue into `/avut-ship`, telling it:

- the PR closes the docs issue: `Closes #<n>` in the Summary
- there's no docs impact to record, because this PR is the docs work

If items are left unticked on purpose (the user deferred them), say so in the PR body, and leave out `Closes`. Move the issue and the leftover items to the next milestone instead.

## Common mistakes

- Running the docs pass while the milestone's features are still open, without asking.
- Editing the docs issue's body or comments by hand instead of through `milestone.ts`.
- Taking screenshots outside the `demo` org, or under a new id when re-shooting an existing one.
- Documenting the PR description instead of the UI as it is now.
- Writing "What's new" entries here. `content/updates/` is part of `/avut-release`.
