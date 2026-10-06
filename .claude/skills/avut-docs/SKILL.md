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

## Step 1 — Find the milestone and its docs issue

Milestones are titled `v<version>`, optionally followed by ` - <codename>` (`v0.11`, `v1 - veronica`).

```bash
gh api 'repos/redcloud-nz/avut/milestones?state=open&per_page=100' --jq '.[] | "\(.number)\t\(.title)\t\(.open_issues)"'
```

With a version given, pick the milestone whose title starts with `v<version>` followed by a space or the end. Without one, pick the lowest version (compare the numbers, not the strings: `v0.9` < `v0.11` < `v1`). Then find the issue:

```bash
gh issue list --repo redcloud-nz/avut --state open --label documentation --milestone "<milestone>" \
  --search 'in:title "Docs: <milestone>"' --json number,title
```

No issue means no PR in the milestone has declared a docs impact. Say so and stop.

## Step 2 — Consolidate

Fold the item comments `/avut-ship` posted into the issue body's `## Items` list. Only this skill edits the body. Ships only ever comment, so nothing else writes the body concurrently.

1. **Read** the body and the item comments. Item comments start with the `<!-- avut-docs-item -->` marker. Any other comment is discussion: leave it alone.

   ```bash
   gh issue view <n> --repo redcloud-nz/avut --json body --jq .body
   gh api --paginate repos/redcloud-nz/avut/issues/<n>/comments \
     --jq '.[] | select(.body | startswith("<!-- avut-docs-item -->")) | {id, body}'
   ```

2. **Merge** each comment's item line(s) into `## Items`, in PR-number order. Skip an item whose PR number is already in the list, so a re-run never duplicates. Keep existing ticks as they are.
3. **Write the body first:** `gh issue edit <n> --repo redcloud-nz/avut --body-file <tmpfile>`. Re-read it and confirm every folded item is there.
4. **Then delete the folded comments,** by the ids you read in 1, and only those: `gh api -X DELETE repos/redcloud-nz/avut/issues/comments/<id>`. A ship that commented after step 1 keeps its comment for the next consolidate. If the body edit failed, delete nothing.

Show the checklist: ticked and unticked counts, and the unticked items. For `consolidate`, stop here.

## Docs pass

### Step 3 — Is the milestone ready?

List the milestone's other open issues (`gh issue list --repo redcloud-nz/avut --milestone "<milestone>" --state open`). Docs written while features are still being built go stale in the same way. If any are open, show them and ask whether to go ahead anyway.

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

Items that need no change once you look (a later PR already covered them, or the change turned out invisible) get ticked with a short note: `— no change needed: <why>`.

### Step 6 — Visual checkpoint

Give the user the local `/docs/...` URLs of every page you changed, on the worktree's port, and the in-app `?help=<slug>` URL of one page, since that renders the same MDX differently. Iterate on feedback without committing each round (as in `/avut-develop-feature`'s visual checkpoints), then commit once.

### Step 7 — Tick and ship

Tick every finished item in the issue body (`gh issue edit` with the full body: the same read-then-write as Step 2). Then continue into `/avut-ship`, telling it:

- the PR closes the docs issue: `Closes #<n>` in the Summary
- there's no docs impact to record, because this PR is the docs work

If items are left unticked on purpose (the user deferred them), say so in the PR body, and leave out `Closes`. Move the issue and the leftover items to the next milestone instead.

## Common mistakes

- Running the docs pass while the milestone's features are still open, without asking.
- Deleting item comments before the body edit is confirmed. That loses items.
- Deleting comments that weren't folded: discussion, or items that arrived after the read.
- Taking screenshots outside the `demo` org, or under a new id when re-shooting an existing one.
- Documenting the PR description instead of the UI as it is now.
- Writing "What's new" entries here. `content/updates/` is part of `/avut-release`.
