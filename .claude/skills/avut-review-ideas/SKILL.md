---
name: avut-review-ideas
description: Review open `brainstorm`-labeled GitHub issues and post a structured review as a comment on each. Trigger when the user types /avut-review-ideas.
effort: medium
manual: true
---

# Idea Review

You are an idea review agent. Your job is to assess open `brainstorm`-labeled
issues and post a structured review as a comment on each.

Optional filter: $ARGUMENTS (if provided, only review issues whose title contains this string; otherwise review all open `brainstorm` issues)

## Step 1 — Find ideas to review

```bash
gh issue list --repo redcloud-nz/avut --label brainstorm --state open --json number,title,body,comments
```

If `$ARGUMENTS` is non-empty, filter to issues whose title contains that string. If none match, tell the user and stop.

## Step 2 — Load project context

Read `CLAUDE.md` from the project root so you understand the stack, conventions, and architecture before assessing anything.

## Step 3 — Review each idea

For each issue:

**a) Read the body and comments** (already fetched in Step 1). Check whether any comment already starts with `## Review`.

**b) If a review comment already exists**, skip the issue and note it was already reviewed (unless `$ARGUMENTS` was provided, in which case re-review it).

**c) Assess the idea** across these dimensions, informed by the project context:

- **Feasibility**: Is this achievable within the current stack and architecture? Note any blockers or gotchas.
- **Effort**: Rough size estimate — Small (hours), Medium (1-2 days), Large (days+).
- **Value**: What problem does this solve? Who benefits and how much?
- **Implementation path**: Key steps or the most natural entry point in the codebase. Reference specific files, routers, or components where relevant.
- **Risks / open questions**: Anything that needs clarification before starting, or known constraints that could complicate delivery.

**d) Post the review as a comment** on the issue, in this format:

```bash
gh issue comment <n> --repo redcloud-nz/avut --body-file <tmpfile>
```

```
## Review

**Feasibility:** <one sentence>

**Effort:** <Small / Medium / Large> — <brief reason>

**Value:** <one sentence on the benefit>

**Implementation path:**
<2-5 bullet points covering the key steps or codebase entry points>

**Risks / open questions:**
<bullet points, or "None identified" if clear>
```

(No need for a `**Reviewed:**` date line — the comment's own timestamp covers that.)

## Step 4 — Summarise

After processing all issues, output a short table listing each issue number + title, its effort estimate, and whether it was reviewed or skipped. Keep it to one line per issue.

## Common mistakes

- Editing the issue body instead of posting a review comment — the body is the idea's own canonical proposal, reviews live in the timeline
- Re-reviewing an issue that already has a review comment when no filter was given
