# Product updates

Entries for the in-app "What's new" dialog and the `/docs/updates` page. Each `.mdx` file here is one entry; this README isn't collected (the
`updates` collection in [`content-collections.ts`](../../content-collections.ts)
only includes `*.mdx`). The read model and seen-cursor logic are in
[`src/lib/updates.ts`](../../src/lib/updates.ts).

## Writing an entry

Name the file `YYYY-MM-DD-<slug>.mdx`, where the date is the entry's
`publishedAt`. The build fails if the filename doesn't start with
`${publishedAt}-`. The filename without `.mdx` becomes the entry's
`#anchor` on `/docs/updates`.

```mdx
---
title: Introducing "What's new"
publishedAt: 2026-09-30
description: A short note in AVUT whenever something new arrives.
---

When we add something new to AVUT, you'll now see a short note about it the next
time you sign in. …
```

| Field         | Required | Notes                                                           |
| ------------- | -------- | --------------------------------------------------------------- |
| `title`       | yes      | Shown as the entry's heading; don't repeat it as an `#` heading |
| `publishedAt` | yes      | `YYYY-MM-DD`, read as 00:00 UTC. See [Dating](#dating)          |
| `description` | no       | One-line summary                                                |
| `version`     | no       | The release it shipped in, e.g. `0.10`. Display only            |

The body is MDX, rendered with the same components as `content/docs/**`.

## What goes in

Entries are for end users. Write one per user-visible feature or change, not
one per release, in the same plain voice as the end-user docs. Leave out
infrastructure, refactors and fixes nobody would notice.

**Merging publishes an entry.** There's no scheduling: every file in this
folder is live on `/docs/updates` and in the dialog as soon as the branch it's
on deploys. An entry can land with the feature's own PR, or be added when the
release is cut (see [`docs/releasing.md`](../../docs/releasing.md)).

## Dating

A user has seen every entry dated on or before the newest one they've
dismissed, so ties count as seen. To keep an entry from being hidden:

- Date it the day it merges, in UTC — `publishedAt` is read as 00:00 UTC, so a
  New Zealand morning is still the previous day.
- Never date it earlier than the newest existing entry, and never in the future.
- If an entry with that date is already merged — released or not, since
  integration and previews show entries as soon as they merge — use the next
  day, even if that puts it a day in the future. That's harmless; being hidden
  isn't. (Two entries in the same PR can share a date: they're shown together.)

## Not the release notes

These entries are separate from [`docs/releases/v*.md`](../../docs/releases/README.md),
which are the hand-written top of each GitHub Release. Release notes describe a
version for the team; updates describe features for users, and don't depend on
release versions.
