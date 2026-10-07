# Plans

The sequence of steps for one piece of work — what's being built, in what
order, and the decisions settled along the way. A plan differs from its
neighbours: a [spec](../specs/README.md) is the agreed shape of a change
_before_ it's built, and a [review](../reviews/README.md) looks at code that
already exists. A plan is the how, once the what is settled.

## Conventions

- **Every plan carries a date.** Put a `**Date:** YYYY-MM-DD` line near the top
  of the header block (after the title, alongside `**Branch:**`/`**DB:**` etc.
  where present). It's the date the plan was written or last substantively
  revised — a plan with no date can't be weighed against the code as it stands
  now. Use an absolute date, never "today" or a relative phrase.
- One file per plan, kebab-case, named for the subject, prefixed with the same
  date as the header's `**Date:**` line (`2026-09-25-entity-action-consistency.md`).
  If the plan is later substantively revised, update both the header date and
  the filename prefix together — they must never disagree.
- Link the spec it implements, if any, and note branch/worktree/DB-branching
  requirements up front.
- A plan written ahead of building (`/avut-develop-feature --plan-only`) lives on
  a `plan/<slug>` branch, in `.claude/worktrees/<slug>`, until it's picked up;
  then the branch is renamed to `feat/<slug>` or `fix/<slug>`.
  `git branch --list 'plan/*'` shows what's waiting. Such a plan also records
  `**Written against:** integration @ <sha>`, so the pickup can tell what has
  changed since.
- A `/avut-develop-feature` plan's body carries Decisions, Tasks (tagged
  `visual` and `mechanical`, and split into review groups), a one-line Docs
  impact, Out of scope, and Parked. The last of those collects side findings
  during the build, and each becomes a `follow-up` issue or is dropped before
  ship. The skill describes each section. End-user docs are never a task: the
  Docs impact line feeds the milestone's docs issue, which `/avut-docs` works
  through.
