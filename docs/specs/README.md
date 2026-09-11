# Specs

Design specs for non-trivial changes — the agreed shape of a feature before
implementation, and the record of why it is that shape once built.

## Conventions

- **Every spec carries a date.** Put a `**Date:** YYYY-MM-DD` line in the header
  block, directly under the `# Spec: …` title. It is the date the spec was
  written or last substantively revised — a spec with no date cannot be weighed
  against the code as it stands now. Use an absolute date, never "today" or a
  relative phrase.
- Header block, in order: `**Date:**`, `**Status:**`
  (`Draft` / `Approved` / `Implemented` / `Superseded`), and `**Supersedes:**`
  when it replaces earlier behaviour or another spec.
- One file per spec, kebab-case, named for the subject (`d4h-linking.md`).
- Close with the resolved decisions (a table works well) so a later reader sees
  what was settled without re-reading the discussion.
