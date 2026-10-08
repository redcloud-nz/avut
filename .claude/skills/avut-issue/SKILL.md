---
name: avut-issue
description: Draft and file a GitHub issue for this repo — a bug, an enhancement to something that exists, or a new feature — grounded in the code and matching the repo's issue template. Trigger when the user types /avut-issue, or asks to file, report or write up a bug, enhancement or feature request.
effort: medium
manual: true
---

# Issue

Produces a GitHub issue whose body matches the repo's issue form field for field, so an issue filed here reads the same as one filed through the web form. It ends at a filed issue. It doesn't fix the bug or build the feature, and it changes no code.

`$ARGUMENTS` is the user's description, optionally led by the kind (`bug …`, `enhancement …`, `feature …`).

## Step 1 — Pick the kind

| Kind            | When                                                                         | Template                                  | Label         | Type      |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------------------- | ------------- | --------- |
| **bug**         | Something that exists behaves wrongly                                        | `.github/ISSUE_TEMPLATE/bug_report.yml`   | `bug`         | `Bug`     |
| **enhancement** | Something that exists works as built, and should work differently or do more | `.github/ISSUE_TEMPLATE/feature_request.yml` | `enhancement` | `Feature` |
| **feature**     | A capability the app doesn't have yet                                        | `.github/ISSUE_TEMPLATE/feature_request.yml` | `enhancement` | `Feature` |

Take the kind from `$ARGUMENTS` or the description. When the line between bug and enhancement is unclear ("the dialog doesn't let me…"), read the code first: if it does what it was built to do, it's an enhancement. Say which kind you chose in the draft so the user can correct it.

A feature that's still a big open question (several plausible shapes, no clear scope) isn't ready for an issue. Suggest `/avut-brainstorm` (ends in a `brainstorm` issue) or `/avut-explore` (tries it live) instead, and file it here only if the user still wants a plain issue.

## Step 2 — Read the template

Read the kind's template fresh, since its fields may change. Build the body from its field labels as `##` headings, in the template's order.

## Step 3 — Ground it in the code

Find the page, route or component under `src/app/` (or the router or service, for a data problem), and read enough to describe the current behaviour precisely, rather than restating the user's words.

- **bug:** note a plausible cause if you find one (a `file:line`, a missing check, a stale cache) as a lead for whoever investigates, not a fix. Work out the environment it was seen in (local dev server, preview deployment, or production) from a pasted URL or what's running. Ask only if it's genuinely ambiguous, and say in the draft that you inferred it. If the reproduction is unclear, offer to reproduce it with `avut-test-in-browser`. Skip that when the bug is already clear from a stack trace or the code.
- **enhancement:** name the exact screen and component it changes.
- **feature:** if the request could land in more than one place ("extend the X report, or add a Y report?"), ask, and wait for the answer before drafting.

## Step 4 — Fill the fields

**bug** (`bug_report.yml`):

- **What happened?**: the actual, wrong behaviour, from Step 3.
- **Steps to reproduce**: numbered and concrete.
- **Expected behavior**
- **Organization / module**: the module's id from `src/lib/modules.ts`, and the org if known.
- **Environment**: one of the template's dropdown options, word for word.
- **Additional context**: error messages, the suspected cause, links to code.

**enhancement / feature** (`feature_request.yml`):

- **What problem does this solve?**: the need, grounded in what the app does now.
- **Proposed solution**: concrete, with real file or route paths where they help.
- **Alternatives considered**: smaller or differently placed options ruled out.
- **Related module**: a module id from `src/lib/modules.ts`.
- **Additional context**: optional.

## Step 5 — Confirm, then file

Show the title, kind and body, and get the user's go-ahead before creating anything. Filing is visible to others, so confirm even when the ask sounded final ("just file it"); "here's the draft, filing unless you want changes" is enough. Ask then whether it goes on a milestone. Leave it off unless the user says so.

Write the body to a file in the scratchpad, then:

```bash
gh issue create --repo redcloud-nz/avut \
  --title "<title>" \
  --label "<label>" \
  --type "<type>" \
  --body-file <file>
```

Add `--milestone "<title>"` if the user picked one. Use `--body-file`, not `--body`: inline quoting mangles multi-paragraph Markdown. Give the user the issue's URL.

## Common mistakes

- Using labels that aren't in the repo's label set. Each kind gets exactly the one label in Step 1.
- Leaving out `--type`: the web form sets the issue type, so a `gh` issue without it doesn't match.
- Skipping the confirmation because the ask sounded final.
- Restating the user's description instead of grounding it in the code.
- Fixing the bug, or starting the feature, instead of just filing it.
- Reproducing in the browser when the bug is already unambiguous.
