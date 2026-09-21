---
name: avut-develop-feature
description: Start building a feature from a GitHub issue — resolves the source, moves into a fresh worktree, does the worktree setup via the avut-worktree-setup skill, and summarizes the plan before writing code. Trigger when the user types /avut-develop-feature with an issue number/URL.
effort: high
manual: true
---

# Develop Feature

Takes a feature from "captured somewhere" to "worktree set up and ready to implement." `$ARGUMENTS` is a GitHub issue — a bare number, `#123`, or an issue URL.

If it doesn't parse as one, try it as a fuzzy title search against open `brainstorm`-labeled issues (`gh issue list --repo redcloud-nz/avut --label brainstorm --search "<text>"`). If more than one matches, list them and ask which. If `$ARGUMENTS` is missing or nothing matches, ask the user which issue to build from and stop.

## Step 1 — Resolve the source

`gh issue view <n> --repo redcloud-nz/avut --json number,title,url,body,labels,comments`. Read the body and comments — a `brainstorm` issue carries `## Idea`/`## Context`, `## Options considered`, `## Open questions`, and any `## Review` comment from `/avut-review-ideas`; a bug issue filed via `avut-bug` carries its own structure (What happened / Steps to reproduce / Expected behavior / Environment); a feature issue via `avut-draft-feature` carries its own (Proposed solution / Alternatives considered / Related module).

Show the user a one-line summary and confirm this is the right source before continuing:

> Building from #142 — "Organization groups". Proceed?

## Step 2 — Check for unresolved ambiguity

If the source has open questions that materially change scope (a `brainstorm` issue's `## Open questions`, or a feature issue's `Alternatives considered` left unresolved), surface them and ask before setting up a worktree — don't build the wrong shape of the thing. Skip this if the source is already concrete (most bug reports are).

## Step 3 — Pick a name and check for an existing worktree

Derive a short kebab-case slug from the idea/issue title (e.g. `organization-groups`, `fix-skill-check-timezone`). Check whether a worktree for it already exists:

```bash
git worktree list
```

- If `.claude/worktrees/<slug>` is already there, resume it — call `EnterWorktree` with `path`, not `name`.
- Otherwise call `EnterWorktree` with `name: "<slug>"`. This creates the worktree under `.claude/worktrees/<slug>` on a fresh branch off `origin/integration` and switches the session into it.

## Step 4 — Worktree setup

Follow the `avut-worktree-setup` skill — do this every time, `EnterWorktree` only handles the git side:

```bash
cp ../../../.env.local .env.local
ln -s ../../../.vercel .vercel   # only if using the Vercel CLI / skills
npm install
npx next typegen
```

Don't start a dev server — check whether the user already has one running (elsewhere) and ask them to start one for this worktree on its own port (`npm run dev -- -p 3100` or similar) rather than launching one yourself.

If the work is very likely to need a schema migration (the idea/issue says so explicitly), flag now that the branch will need `npm run db:branch <slug>` before `prisma migrate dev` — per the Database section of `AGENTS.md`, that's a step to run once you're actually about to migrate, not preemptively.

## Step 5 — Summarize the plan

Before writing any code, restate in your own words: what's being built, the relevant existing files/routers/pages it touches or extends, and the first concrete step. Point out anywhere the source's plan doesn't match what the code currently looks like — a signal to re-confirm scope, not to silently reinterpret it.

Then proceed with implementation as normal, following the rest of `AGENTS.md`'s conventions (tRPC router patterns, data-fetching patterns, permissions, etc. — read the relevant pattern doc before writing a new page or mutation rather than inferring it).

## Common mistakes

- Creating a second worktree for a slug that already has one instead of resuming it
- Skipping the worktree setup steps (especially `npx next typegen`) and hitting confusing typecheck failures later
- Starting a dev server unprompted instead of asking the user to start one
- Treating an idea's open questions or an issue's unresolved alternatives as already decided
- Proactively branching the database before a migration is actually about to be written
