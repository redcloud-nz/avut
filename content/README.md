# Content

End-user content, compiled by [`content-collections.ts`](../content-collections.ts)
into typed records (`content-collections` imports). Only `*.mdx` is collected, so
this README isn't. There are three collections:

| Directory              | Collection  | Shown                                                                          |
| ---------------------- | ----------- | ------------------------------------------------------------------------------ |
| [`docs/`](docs/)       | `docs`      | The public `/docs` site and its search                                         |
| [`help/`](help/)       | `helpCards` | Only in the in-app `?help=` sheet                                              |
| [`updates/`](updates/) | `updates`   | "What's new" and `/docs/updates`; see [`updates/README.md`](updates/README.md) |

## Guides and help cards

A **guide** (`content/docs/<section>/<page>.mdx`) is the full explanation of a
module or task, read on its own on `/docs`. A **help card**
(`content/help/<id>.mdx`) is a short note for one screen, opened from that
screen's help button. The sheet shows the card, its key terms, and an "Open the
full guide" link.

Write a card for what someone needs while looking at the screen: what it's for,
the few things they do there, and any gotcha. Anything longer, or that spans
screens, belongs in the guide, and the card links to it.

Cards and guides are rendered with the same MDX components (`<Screenshot>`
works in both), but a card's screenshot shows only in the 480px sheet and a
guide's only on `/docs`. Cards rarely need one.

## Writing a card

```mdx
---
title: Personnel
guide: admin/user-vs-person#person
keyTerms: ["person", "user", "team"]
---

**Personnel** has a person record for everyone your organisation tracks. …
```

| Field      | Required | Notes                                                                              |
| ---------- | -------- | ---------------------------------------------------------------------------------- |
| `title`    | yes      | The sheet title. Don't repeat it as a `#` heading                                  |
| `guide`    | yes      | A doc slug, optionally with a heading `#anchor`. Not `""` (the docs home)          |
| `keyTerms` | no       | Glossary slugs (`src/lib/glossary.ts`) for the `<KeyTerms>` callout after the body |

There's no `description`: the sheet's subtitle is always "Quick Guide".

- The **id** is the path without `.mdx` (`admin/personnel`). Unlike docs, there's
  no `index` collapsing, so name the file for what it is (`admin/dashboard.mdx`).
- The body is **about 150 words, 250 at most** (`wc -w`).
- Write from the screen's components, not the guide alone. Use the app's
  on-screen names in bold, NZ English, and "Personnel" for person records.
- A card hides with its guide's section when that section is flag-hidden.

### One card or shared

Give a screen its own card when what you do there differs. Screens that are
views of the same record or task share one: a list and its detail page (`admin/teams`
covers the teams list, a team, its members and its history), or the by-skill
and by-person recording pages (`skill-track/session-recording`).

Point the screen at the card with a literal id, so call sites stay greppable:

```tsx
<HelpButton id="admin/personnel" />
```

## Checks

- **Build.** The `helpCards` transform throws when `guide` isn't a doc, or its
  `#anchor` isn't one of that doc's heading ids (the error lists the valid
  ones). Heading ids are GitHub-style (`rehype-slug`), e.g.
  `skill-track/sessions#4-record-results`. The throw is fatal only in
  `npx content-collections build` and production builds. Under `npm run dev` the
  bad card is just dropped with a logged error, so run the build command after
  changing a `guide`.
- **Tests.** `src/components/docs/help-cards.test.ts` fails if a `<HelpButton>`
  has no literal `id="…"`, names a missing card, or a card isn't used by any
  `<HelpButton>`. `src/lib/glossary.test.ts` fails on an unknown `keyTerms` slug.

## Keeping them current

A PR that changes what a user sees updates that screen's card in the same PR,
and adds or removes cards with the `HelpButton`s that use them. Guide changes
can wait: note them on the milestone's docs issue and update the guides there.
