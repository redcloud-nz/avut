# Reviews

Cross-cutting reviews of how a pattern is applied across the codebase — the
state of the thing as it stands, what's wrong with it, and what to do about it.

A review differs from its neighbours: a [spec](../specs/README.md) is the agreed
shape of a change _before_ it's built, [research](../research/) is an
investigation of something external, and a [plan](../plans/) is the sequence of
steps for one piece of work. A review looks at code that already exists and
judges it.

## Conventions

- **Every review carries a date.** Put a `**Date:** YYYY-MM-DD` line in the
  header block, directly under the `# Review: …` title. Findings are a snapshot
  against the code and dependency versions of that day; an undated review can't
  be weighed against the tree as it stands now. Absolute dates only.
- Header block, in order: `**Date:**`, `**Scope:**` (what was examined), and
  `**Related:**` (issues, PRs, specs) when there are any.
- Pin the versions the findings depend on. A review of framework behaviour is
  only true for the version it was read against.
- Cite evidence — a file and line, or the dependency source that proves the
  claim — rather than asserting behaviour from memory.
- One file per review, kebab-case, named for the subject
  (`suspense-boundaries.md`).
- Close with the recommendations, ordered and costed, so a later reader can act
  without re-reading the analysis.
