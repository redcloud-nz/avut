# Research

Investigations of something external — a library's real behaviour, an API's
actual shape — read from source rather than assumed, to inform a decision
elsewhere in avut. A research doc differs from its neighbours: it looks
outward at a dependency rather than at avut's own code or a change to it.

## Conventions

- **Every research doc carries a date.** Put a `**Date:** YYYY-MM-DD` line
  directly under the title, before `**Method**`. Findings are only true for the
  dependency version investigated on that day — an undated doc can't be
  weighed against a since-upgraded library. Use an absolute date, never
  "today" or a relative phrase.
- State the **Method** — how the source was obtained (a throwaway worktree,
  `npm pack`, reading `node_modules`) and which package version — so a later
  reader can tell whether the findings still hold.
- One file per investigation, kebab-case, named for the subject, prefixed with
  the same date as the header's `**Date:**` line
  (`2026-08-11-better-auth-ui-session-hydration.md`). If the doc is later
  revised (e.g. re-verified against a newer version), update both the header
  date and the filename prefix together — they must never disagree.
