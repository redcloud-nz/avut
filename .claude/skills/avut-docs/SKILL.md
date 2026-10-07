---
name: avut-docs
description: Bring the end-user guides (content/docs/** and its screenshots) up to date for a milestone, and write its in-app "What's new" entry (content/updates/v<version>.mdx), working through that milestone's "Docs: v<version>" issue, which /avut-ship adds an item to for each user-facing PR. With `consolidate`, only fold the item comments into the issue's checklist. Trigger only when the user types /avut-docs.
effort: high
manual: true
---

# Docs

End-user guides trail the code on purpose. A feature branch doesn't touch `content/docs/**` or its screenshots, because a screenshot taken mid-feature goes stale with the next UI tweak. Instead, `/avut-ship` posts one item per user-facing PR as a comment on the milestone's docs issue. This skill brings the docs up to date once per milestone, after the milestone's UI has settled and before `/avut-release`, and writes the release's "What's new" entry from the same checklist. The release's milestone check sees the docs issue still open until this has run.

The in-app help cards (`content/help/**`) are the exception: feature branches keep them current themselves (see `content/README.md`). This pass only checks that the cards for the screens it touches still agree with the guides it rewrites.

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

It folds the item comments `/avut-ship` posted into the body's `## Items` list, sorted by PR, each with its indented detail lines. A PR that's already listed isn't added twice, and its tick is kept. Notes in the section stay put. Keep the section flat: any heading ends it.

It deletes a comment only once the re-read body provably holds all of it: the same text and detail for every item in it. Every other marked comment stays, listed under `skipped` with a reason:

- **It has text that isn't an item** (someone added a remark, or edited it).
- **Its PR is already listed with different text** (a corrected or second item for the same PR).

Resolving a skipped comment is the one time you edit the issue directly. Show the user the comment and the body's item for that PR, and ask which wins. Then either update the body's item to say what the comment says, with `gh issue edit` (re-run consolidate, and it now holds and is deleted). Or, if the comment is stale, delete it: `gh api -X DELETE repos/redcloud-nz/avut/issues/comments/<id>`. `docs-carry`, and so release's `close --move-to`, refuse while any comment is skipped.

Show the checklist it prints: ticked and unticked counts, the unticked items, and any skipped comments. For `consolidate`, stop here.

## Docs pass

### Step 3 — Is the milestone ready?

Look at the milestone's other open issues, from Step 1's `show` output (everything but the docs issue). Docs written while features are still being built go stale in the same way. If any are open, show them and ask whether to go ahead anyway.

Then run `npm run prisma migrate status` (read-only). Pending migrations break the dev server, and screenshots come from it. Ask the user to run `npm run prisma migrate deploy` if any show up.

### Step 4 — Worktree

Use a worktree, so the main checkout stays free: `EnterWorktree` with `name: "docs-<version>"` (or `path`, if `.claude/worktrees/docs-<version>` exists from an earlier run), then `npm run worktree:setup`. Rename the branch to `docs/v<version>` (`git branch -m docs/v<version>`). Start the dev server in the background (`npm run dev`, on the worktree's `.dev-port`).

### Step 5 — Work the checklist

For each unticked item:

1. **Read what changed:** `gh pr view <PR> --repo redcloud-nz/avut --json title,body,files`. Look at the affected pages on the dev server, in the `demo` org. The current UI is the truth, not the PR, because later PRs may have changed it again.
2. **Update the guide MDX** under `content/docs/`, following the conventions of the pages around it (`section`, `order`, `keyTerms` frontmatter). A new page belongs to the section that matches its module id in `src/lib/modules.ts`.
3. **Re-shoot the screenshots** the item names, plus any others you see are out of date on the pages you touched. Follow `avut-doc-screenshots`: demo org only, the standard sizes, and the same `id` so existing references keep working.
4. **Check the help cards** whose `guide` points at a page you changed (grep `content/help` for `guide: <slug>`): the anchor still exists, and the card doesn't contradict the guide. Run `npx content-collections build` after renaming any heading, since a card's anchor must still match.
5. **Commit** with `docs(<area>): …`, one commit per item or per page group, whichever reads better.

Several items often touch the same page. Do them together, so a page is rewritten and shot once.

Tick each item once its commit is in: `node .claude/skills/avut-docs/milestone.ts docs-tick <version> <PR>`. Items that need no change once you look (a later PR already covered them, or the change turned out invisible) get ticked with a note: `docs-tick <version> <PR> "no change needed: <why>"`.

### Step 6 — The "What's new" entry

Write the release's in-app "What's new" entry, `content/updates/v<version>.mdx`, following [`content/updates/README.md`](../../../content/updates/README.md). The checklist is its outline: every item is a user-facing PR in this release, so each gets a `###` section unless it's too small for users to notice. Several items about one feature become one section. Describe what users can now do, in the guides' voice, and link to the guide pages you just updated rather than repeating them.

The file may already exist, started by the features' own PRs. Fill in what's missing; don't rewrite what's there. Then commit it with `docs(updates): v<version> what's new`. Production shows it only once the release deploys, so it's safe to merge now.

### Step 7 — Visual checkpoint

Give the user the local `/docs/...` URLs of every page you changed, on the worktree's port, plus `/docs/updates#v<version>` for the entry. Iterate on feedback without committing each round (as in `/avut-develop-feature`'s visual checkpoints), then commit once.

### Step 8 — Ship

Run `docs-consolidate` once more, in case a ship landed an item mid-pass. Work any new items, adding them to the "What's new" entry too, then continue into `/avut-ship`, telling it:

- the PR closes the docs issue: `Closes #<n>` in the Summary
- there's no docs impact to record, because this PR is the docs work

If items are left unticked on purpose (the user deferred them), say so in the PR body. Once the PR is open, carry them to the next milestone with `milestone.ts docs-carry <version> <next-version>`. That re-adds each unticked item to the next milestone's docs issue and closes this one. Don't move the issue itself: the script finds a docs issue by its milestone's title, so a moved `Docs: v0.11` would never be found under v0.12.

## Common mistakes

- Running the docs pass while the milestone's features are still open, without asking.
- Editing the docs issue's body or comments by hand instead of through `milestone.ts`, other than to resolve a skipped comment with the user (Step 2).
- Taking screenshots outside the `demo` org, or under a new id when re-shooting an existing one.
- Documenting the PR description instead of the UI as it is now.
- Leaving out the "What's new" entry (Step 6). `/avut-release` only checks for it; this pass is where it gets written.
