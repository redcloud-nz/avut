# Product updates

Entries for the in-app "What's new" dialog and the `/docs/updates` page, **one
per release**. Each `v<version>.mdx` file here is one release's entry; this
README isn't collected (the `updates` collection in
[`content-collections.ts`](../../content-collections.ts) only includes `*.mdx`).
The read model and seen-cursor logic are in
[`src/lib/updates.ts`](../../src/lib/updates.ts).

## Writing an entry

Name the file after the release it describes, the same version as
`package.json` → `nz.avut.version`: `v0.11.mdx`, `v0.11.1.mdx`. The build fails
on any other name. The version comes from the filename, and the filename
without `.mdx` is the entry's `#anchor` on `/docs/updates`.

```mdx
---
title: What's new in AVUT 0.11
---

### Lock approved sessions

Once a skill check session is approved, …

### See every skill in one place

…
```

| Field         | Required | Notes                                                                   |
| ------------- | -------- | ----------------------------------------------------------------------- |
| `title`       | no       | The entry's heading; defaults to "Version 0.11". Don't repeat it as `#` |
| `description` | no       | One-line summary, shown next to the version                             |

The body is MDX, rendered with the same components as `content/docs/**`. Give
each user-visible feature or change its own `###` section, in the same plain
voice as the end-user docs. Leave out infrastructure, refactors and fixes nobody
would notice. A release with nothing user-facing gets no entry.

## When it goes live

Production shows an entry only once it's running that release or a later one:
it compares the filename with its own `nz.avut.version`. So the next release's
entry can land on `integration` early, with the features' own PRs, and grow
until the release is cut. Development and preview deployments show every entry,
drafts included.

A user has seen every release up to the newest entry they've dismissed. New
accounts start at the newest entry, so they aren't shown the backlog. Editing a
release's entry after it's live won't show it again to anyone who has dismissed
it.

## Not the release notes

These entries are separate from [`docs/releases/v*.md`](../../docs/releases/README.md),
which are the hand-written top of each GitHub Release. Both are per release,
but release notes describe the version for the team, while these describe it
for users.
