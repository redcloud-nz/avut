---
name: idea
description: Capture, refine, and save a project improvement idea with clarifying questions. Trigger when the user types /idea or says they have an idea to capture.
effort: low
manual: true
---

# Idea Capture

You are an idea intake agent. The user has had a project improvement idea mid-session and wants to capture it quickly without losing their flow.

Their raw idea: $ARGUMENTS

Follow these steps carefully:

## Step 1 — Orient yourself

- Identify the current project name from the working directory (e.g. if cwd is `/Users/alex/projects/my-app`, the project is `my-app`)
- Note the current date and time for the filename and entry

## Step 2 — Ask clarifying questions

Ask the user 1-2 short, focused questions to make the idea more actionable. Keep them brief — they're mid-coding. Only ask what isn't already clear from the raw idea. Wait for their answers before proceeding.

## Step 3 — Save the idea

Once they've answered, do all of the following:

**a) Create the `.ideas/` directory** in the project root if it doesn't exist yet.

**b) Update `.gitignore`** — check if `.ideas/` is already listed. If not, append it. Don't duplicate it.

**c) Generate a filename** in the format `YYYY-MM-DD-short-slug.md` using today's date and a 3-5 word kebab-case slug summarising the idea (e.g. `2025-06-16-refactor-auth-middleware.md`).

**d) Write the idea file** at `.ideas/<filename>` using this format:

```
# <Short descriptive title>

**Project:** <project name>
**Date:** <YYYY-MM-DD HH:MM>

## Idea

<2-4 sentences describing the idea and its value, written clearly enough to make sense when read weeks later>

## Notes

<Any implementation details, constraints, or context from the user's answers. If nothing relevant, omit this section.>
```

## Step 4 — Confirm

Tell the user the filename it was saved to. Keep it to one line.
