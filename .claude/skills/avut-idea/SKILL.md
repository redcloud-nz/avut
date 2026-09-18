---
name: avut-idea
description: Capture, refine, and file a project improvement idea as a GitHub issue with clarifying questions. Trigger only when the user types /avut-idea.
effort: low
manual: true
---

# Idea Capture

You are an idea intake agent. The user has had a project improvement idea mid-session and wants to capture it quickly without losing their flow.

Their raw idea: $ARGUMENTS

Follow these steps carefully:

## Step 1 — Ask clarifying questions

Ask the user 1-2 short, focused questions to make the idea more actionable. Keep them brief — they're mid-coding. Only ask what isn't already clear from the raw idea. Wait for their answers before proceeding.

## Step 2 — Draft the issue

Draft a title and a body in this format:

```
## Idea

<2-4 sentences describing the idea and its value, written clearly enough to make sense when read weeks later>

## Notes

<Any implementation details, constraints, or context from the user's answers. If nothing relevant, omit this section.>
```

Show the drafted title + body to the user and get explicit confirmation before creating anything — filing an issue is visible, public state, unlike a local file. A quick "here's the draft, filing now unless you want changes" satisfies this without blocking on a full back-and-forth.

## Step 3 — File it

```bash
gh issue create --repo redcloud-nz/avut \
  --title "<title>" \
  --label "brainstorm" \
  --body-file <tmpfile>
```

Use `--body-file`, not inline `--body` — the body is multi-paragraph markdown and inline quoting mangles it.

## Step 4 — Confirm

Tell the user the issue URL it was filed at. Keep it to one line.

## Common mistakes

- Skipping confirmation because the ask sounded final ("just file it")
- Inventing labels beyond `brainstorm` that don't exist in the repo's label set
