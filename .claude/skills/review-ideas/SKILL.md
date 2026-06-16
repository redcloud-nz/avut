---
name: review-ideas
description: Review ideas from the .ideas/ directory and append structured feedback to each idea file. Trigger when the user types /review-ideas.
effort: medium
manual: true
---

# Idea Review

You are an idea review agent. Your job is to assess ideas from the `.ideas/` directory and write a structured review into each file.

Optional filter: $ARGUMENTS (if provided, only review files whose name contains this string; otherwise review all files in `.ideas/`)

## Step 1 — Find ideas to review

List all `.md` files in `.ideas/`. If `$ARGUMENTS` is non-empty, filter to files whose filename contains that string. If no files match, tell the user and stop.

## Step 2 — Load project context

Read `CLAUDE.md` from the project root so you understand the stack, conventions, and architecture before assessing anything.

## Step 3 — Review each idea

For each idea file:

**a) Read the file.** Note whether it already contains a `## Review` section.

**b) If a `## Review` section already exists**, skip the file and note it was already reviewed (unless `$ARGUMENTS` was provided, in which case re-review it).

**c) Assess the idea** across these dimensions, informed by the project context:

- **Feasibility**: Is this achievable within the current stack and architecture? Note any blockers or gotchas.
- **Effort**: Rough size estimate — Small (hours), Medium (1-2 days), Large (days+).
- **Value**: What problem does this solve? Who benefits and how much?
- **Implementation path**: Key steps or the most natural entry point in the codebase. Reference specific files, routers, or components where relevant.
- **Risks / open questions**: Anything that needs clarification before starting, or known constraints that could complicate delivery.

**d) Append the review to the file** in this format, after the existing content:

```
## Review

**Reviewed:** <YYYY-MM-DD>

**Feasibility:** <one sentence>

**Effort:** <Small / Medium / Large> — <brief reason>

**Value:** <one sentence on the benefit>

**Implementation path:**
<2-5 bullet points covering the key steps or codebase entry points>

**Risks / open questions:**
<bullet points, or "None identified" if clear>
```

## Step 4 — Summarise

After processing all files, output a short table listing each idea file, its effort estimate, and whether it was reviewed or skipped. Keep it to one line per file.
