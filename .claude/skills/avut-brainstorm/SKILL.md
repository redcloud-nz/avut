---
name: avut-brainstorm
description: Extended back-and-forth exploration of a big idea or problem, ending in a `brainstorm`-labeled GitHub issue. Trigger only when the user types /avut-brainstorm.
effort: medium
manual: true
---

# Brainstorm

You are a thinking partner for an extended exploration of a big idea or problem.
`/avut-idea` is for capturing a small idea mid-session without breaking flow; `/avut-brainstorm`
is the opposite — a deliberate, unhurried conversation that ends in a well-developed
GitHub issue ready for `/avut-review-ideas`.

The topic: $ARGUMENTS

## First: new idea or expanding an existing one?

If `$ARGUMENTS` is a bare issue number, `#123`, or an issue URL, this is an
**expansion session** — go straight to that issue. Otherwise, if it names or
clearly points at an existing idea by title, search for it:

```bash
gh issue list --repo redcloud-nz/avut --label brainstorm --search "<topic>"
```

If exactly one match, that's an expansion session too. If several match, list
them and ask which. If none, it's a new idea — follow the flow below.

For an expansion session:

- `gh issue view <n> --repo redcloud-nz/avut --json number,title,body,comments,labels`.
  Open the conversation from where it left off — summarise what's already
  captured (including any past `## Review` comment) and ask what's changed or
  what the user wants to dig into.
- At the end, revise the body in place (see "Ending the session" below) —
  revise `## Idea` if the thinking has moved, extend the other sections,
  resolve or add `## Open questions`.

Otherwise it's a new idea — follow the flow below and file a fresh issue at the end.

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
agree), distill the whole conversation into the issue body — do this immediately, then
tell them the issue URL in one line.

Body format:

```
## Idea

<2-4 sentence distillation — clear enough to make sense weeks later>

## Context / motivation

<what prompted this, what's inadequate today>

## Options considered

<the alternatives discussed, each with why it was kept or set aside>

## Open questions

<unresolved forks for /avut-review-ideas or a future session to tackle>

## Notes

<constraints, concrete codebase entry points, anything specific worth keeping>
```

Omit `## Options considered` or `## Notes` only if the conversation genuinely produced
nothing for them. Never write a `## Review` section into the body — reviews are posted
as comments by `/avut-review-ideas`.

**New idea:**

```bash
gh issue create --repo redcloud-nz/avut \
  --title "<title>" \
  --label "brainstorm" \
  --body-file <tmpfile>
```

**Expansion:**

```bash
gh issue edit <n> --repo redcloud-nz/avut --body-file <tmpfile>
gh issue comment <n> --repo redcloud-nz/avut --body "Expanded: <one-line summary of what changed and why>"
```

The comment exists because GitHub's "edited" marker on the body doesn't show a
diff — it's the only way the expansion shows up in the issue's timeline.

Either way, this needs no branch or commit — `gh issue create`/`gh issue edit`
work identically from a local checkout or a cloud session.

## Common mistakes

- Writing a `## Review` section into the body instead of leaving reviews to `/avut-review-ideas`'s comments
- Skipping the "Expanded" comment after an in-place body edit, leaving no trace in the timeline of what changed
- Treating a fuzzy title match as certain when more than one open `brainstorm` issue matches — ask instead of guessing
