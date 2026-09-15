---
name: avut-bug
description: Use when drafting or filing a GitHub bug report issue for this repo, before running gh issue create for a bug. Trigger when the user types /avut-bug or describes something broken they want investigated.
effort: medium
manual: true
---

# Report Bug

## Overview

Produces a bug-report GitHub issue whose body matches `.github/ISSUE_TEMPLATE/bug_report.yml` field-for-field, so every issue — human-filed via the web form or Claude-filed via `gh` — reads the same. This skill is for capturing and grounding the report, not for fixing the bug; it ends at a filed issue ready for investigation (by you, later, or by whoever picks it up).

## Process

1. Read `.github/ISSUE_TEMPLATE/bug_report.yml` fresh (fields may change) — build the body around its exact field labels as `##` headers, in the same order as the template.
2. Ground the report in the actual code before drafting: locate the relevant page/route/component under `src/app/` (or the router/procedure if it's a data bug), and read enough of it to describe the symptom precisely rather than restating the user's words. If you can identify a plausible cause (a specific `file:line`, a missing null check, a stale cache, …), note it — but as a lead for whoever investigates, not as a fix. Don't change any code from this skill.
   - Also work out which environment it was seen in: **Local dev server**, **Preview deployment (Vercel)**, or **Production (avut.nz)**. Infer it where you can — a URL the user pasted, which checkout/branch is running, whether a dev server is active — and only ask if it's genuinely ambiguous. Don't guess silently; if you infer it, say so in the draft so the user can correct it.
3. If reproduction is unclear or the user wants it confirmed live, offer to use the `avut-test-in-browser` skill to reproduce it against the running dev server before filing. Optional — skip it if the bug is already clearly described (e.g. from a stack trace or an obvious code read), or if there's no dev server available.
4. Fill each field:
   - **What happened?** — precise description of the actual (wrong) behavior, grounded in step 2
   - **Steps to reproduce** — numbered, concrete; from step 3's reproduction if you did one, otherwise from the user's description
   - **Expected behavior** — what should happen instead
   - **Organization / module** — the org/module it was seen in, if known (a `ModuleId` from `src/lib/modules.ts` where applicable)
   - **Environment** — Local dev server / Preview deployment (Vercel) / Production (avut.nz) / Other-not sure, from step 2
   - **Additional context** — screenshots, error messages, suspected cause from step 2, links to related code
5. Show the drafted title + body to the user and get explicit confirmation before creating anything. Filing an issue is visible to others and creates public state — confirm even if the user seems in a hurry or says to just file it; a quick "here's the draft, filing now unless you want changes" satisfies this without blocking on a full back-and-forth.
6. Once confirmed, create it:

```bash
gh issue create --repo redcloud-nz/avut \
  --title "<title>" \
  --label "bug" \
  --body-file <tmpfile>
```

Use `--body-file`, not inline `--body` — the body is multi-paragraph markdown and inline quoting mangles it.

## Common mistakes

- Inventing labels beyond `bug` that don't exist in the repo's label set
- Skipping confirmation because the ask sounded final ("just file it")
- Restating the user's description verbatim instead of grounding it in the actual code path
- Trying to fix the bug instead of just reporting it — this skill ends at a filed issue
- Reproducing in the browser when the bug is already unambiguous (stack trace, clear code read) — don't add a step the report doesn't need
