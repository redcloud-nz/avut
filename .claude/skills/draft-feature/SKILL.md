---
name: draft-feature
description: Use when drafting or filing a GitHub feature request issue for this repo, before running gh issue create for an enhancement
---

# Draft Feature Request

## Overview

Produces a feature-request GitHub issue whose body matches `.github/ISSUE_TEMPLATE/feature_request.yml` field-for-field, so every issue — human-filed via the web form or Claude-filed via `gh` — reads the same.

## Process

1. Read `.github/ISSUE_TEMPLATE/feature_request.yml` fresh (fields may change) — build the body around its exact field labels as `##` headers, in the same order as the template.
2. Ground the draft in the actual code: locate the relevant page/module under `src/app/` before describing behavior. If the request doesn't match what the code currently does, name the specific ambiguity (e.g. "extend the existing X report vs add a new Y report") and ask the user instead of guessing. Wait for the answer before drafting.
3. Fill each field:
   - **What problem does this solve?** — the pain point, grounded in current behavior
   - **Proposed solution** — concrete, references real file/route paths where it helps
   - **Alternatives considered** — smaller-scope or different-location options ruled out
   - **Related module** — one of the `ModuleId`s from `src/lib/modules.ts`
   - **Additional context** — optional
4. Show the drafted title + body to the user and get explicit confirmation before creating anything. Filing an issue is visible to others and creates public state — confirm even if the user seems in a hurry or says to just file it; a quick "here's the draft, filing now unless you want changes" satisfies this without blocking on a full back-and-forth.
5. Once confirmed, create it:

```
gh issue create --repo redcloud-nz/avut \
  --title "<title>" \
  --label "enhancement" \
  --body-file <tmpfile>
```

Use `--body-file`, not inline `--body` — the body is multi-paragraph markdown and inline quoting mangles it.

## Common mistakes

- Inventing labels beyond `enhancement` that don't exist in the repo's label set
- Skipping confirmation because the ask sounded final ("just file it")
- Guessing at scope when the user's wording doesn't match the current code structure instead of asking
