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
routes:
  - "/orgs/[slug]/admin/personnel"
  - "/orgs/[slug]/admin/personnel/[person_id]"
  - "/orgs/[slug]/admin/personnel/[person_id]/history"
keyTerms: ["person", "user", "team"]
---

**Personnel** has a person record for everyone your organisation tracks. …
```

| Field      | Required | Notes                                                                              |
| ---------- | -------- | ---------------------------------------------------------------------------------- |
| `title`    | yes      | The sheet title. Don't repeat it as a `#` heading                                  |
| `guide`    | yes      | A doc slug, optionally with a heading `#anchor`. Not `""` (the docs home)          |
| `routes`   | yes      | The pages the card covers, as route patterns (see below)                           |
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

A card lists every page it covers in `routes`. Each entry is a typed-route
pattern: the page's folder under `src/app/` with route groups `(…)` and parallel
slots `@…` left out, the same pattern `route()` takes
(`/orgs/[slug]/admin/teams/[team_id]`). There are no wildcards, so list each page,
in both org and team scope where a screen is used in both.

The navbar's help button (`PageHelpButton`) picks the card from the current
path. It matches patterns segment by segment, `[param]` matching any one
segment, and the most specific pattern wins: a static segment beats a `[param]`
at the first difference, so `/admin/teams/new` doesn't fall to
`/admin/teams/[team_id]`. A page no card lists shows no help button.

A page that shouldn't have a card goes on `OPT_OUT_ROUTES` in
`src/components/docs/help-cards.test.ts`, with a short reason comment where it
isn't obvious.

## Checks

- **Build.** The `helpCards` transform throws when `guide` isn't a doc, or its
  `#anchor` isn't one of that doc's heading ids (the error lists the valid
  ones). Heading ids are GitHub-style (`rehype-slug`), e.g.
  `skill-track/sessions#4-record-results`. The throw is fatal only in
  `npx content-collections build` and production builds. Under `npm run dev` the
  bad card is just dropped with a logged error, so run the build command after
  changing a `guide`.
- **Tests.** `src/components/docs/help-cards.test.ts` fails if a page under
  `src/app/(wrapper)/(authenticated)` is listed by no card and isn't on
  `OPT_OUT_ROUTES`, or by more than one card; if a card's route isn't a real
  page; if an `OPT_OUT_ROUTES` entry is a card's route or not a page; or if a
  page doesn't resolve to the card that lists it. `src/lib/glossary.test.ts`
  fails on an unknown `keyTerms` slug.

## Keeping them current

A PR that changes what a user sees updates that screen's card in the same PR.
A PR that adds a page lists it on a card's `routes` or on `OPT_OUT_ROUTES`, and
one that removes or moves a page updates them to match. Guide changes can wait:
note them on the milestone's docs issue and update the guides there.
