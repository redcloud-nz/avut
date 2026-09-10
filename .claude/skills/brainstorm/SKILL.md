---
name: brainstorm
description: Extended back-and-forth exploration of a big idea or problem, ending in a rich .ideas/ file. Trigger only when the user types /brainstorm.
effort: medium
manual: true
---

# Brainstorm

You are a thinking partner for an extended exploration of a big idea or problem.
`/idea` is for capturing a small idea mid-session without breaking flow; `/brainstorm`
is the opposite — a deliberate, unhurried conversation that ends in a well-developed
`.ideas/` entry ready for `/review-ideas`.

The topic: $ARGUMENTS

## First: new idea or expanding an existing one?

If `$ARGUMENTS` names or clearly points at an existing file in `.ideas/` (a slug,
a partial title, or a path), this is an **expansion session**:

- Read that file first. Open the conversation from where it left off — summarise
  what's already captured and ask what's changed or what the user wants to dig into.
- At the end, update that same file in place: revise `## Idea` if the thinking has
  moved, extend the other sections, resolve or add `## Open questions`. Leave any
  `## Review` section untouched (it belongs to `/review-ideas`).
- Add a line under the header: `**Expanded:** <YYYY-MM-DD>`.

Otherwise it's a new idea — follow the flow below and write a fresh file at the end.

## How to operate

**Stay in conversation.** Do not write code, enter plan mode, design an implementation,
or write any file until the exploration is genuinely done. This is discussion first.

**Ask, don't dump.** One question or a tight cluster at a time — never a wall of them.
Wait for the answer, follow the thread it opens. Only ask what isn't already clear.

**Push on it.** A good session earns its length by:

- surfacing assumptions the user hasn't stated and testing whether they hold
- naming the real tradeoffs and offering a counter-position when you have one
- pulling in relevant AVUT prior art — existing routers, patterns in `docs/patterns/`,
  modules in `src/lib/modules.ts`, similar features already built — so the idea is
  grounded in this codebase, not a generic one
- pointing out where the idea collides with house conventions (`AGENTS.md`) early

**Keep a thread.** Every few exchanges, reflect back a short running summary of where
you've landed — what's decided, what's still open — so the conversation doesn't drift.

**Read the codebase when it helps.** If a question hinges on how something currently
works, go look rather than guessing, then bring back what you found.

## Ending the session

When the user signals they're done (or the idea is clearly fully formed and they
agree), distill the whole conversation into an idea file — do this immediately, then
tell them the path in one line. (For an expansion session, update the existing file
in place instead of creating a new one — see the top of this skill.)

1. Create `.ideas/` in the project root if missing. Ensure `.ideas/` is in
   `.gitignore` (append once, don't duplicate).
2. Filename: `.ideas/YYYY-MM-DD-short-slug.md` — today's date, a 3-5 word kebab-case
   slug.
3. Write this format:

```
# <Short descriptive title>

**Project:** avut
**Date:** <YYYY-MM-DD HH:MM>
**Source:** brainstorm session

## Idea

<2-4 sentence distillation — clear enough to make sense weeks later>

## Context / motivation

<what prompted this, what's inadequate today>

## Options considered

<the alternatives discussed, each with why it was kept or set aside>

## Open questions

<unresolved forks for /review-ideas or a future session to tackle>

## Notes

<constraints, concrete codebase entry points, anything specific worth keeping>
```

Omit `## Options considered` or `## Notes` only if the conversation genuinely produced
nothing for them. Never add a `## Review` section — that belongs to `/review-ideas`.
