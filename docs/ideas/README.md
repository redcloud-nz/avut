# Ideas

Captured product/engineering ideas, one file per idea, named
`YYYY-MM-DD-short-slug.md`. Tracked in the repo (unlike `docs/open-issues.md`,
which is for small code-level follow-ups — ideas here are larger or less settled).

The flow:

- **`/idea`** — quick capture mid-session. 1-2 clarifying questions, then a short
  file with `## Idea` / `## Notes`.
- **`/brainstorm [topic|slug]`** — a deliberate back-and-forth exploration ending
  in a richer file (`## Context`, `## Options considered`, `## Open questions`).
  Pass an existing slug to expand that file in place. In a cloud session it pushes
  the result on a `brainstorm/*` branch (see `.claude/skills/brainstorm/SKILL.md`).
- **`/review-ideas [filter]`** — appends a `## Review` section (feasibility,
  effort, value, implementation path, risks) to each file.

Once an idea is acted on, either delete its file in the implementing PR or leave
it as a design record — judgement call per idea.
