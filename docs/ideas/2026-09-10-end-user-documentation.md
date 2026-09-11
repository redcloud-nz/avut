# End-user documentation for AVUT

**Project:** avut
**Date:** 2026-09-10 16:21
**Source:** brainstorm session

## Idea

A first-party end-user documentation system: MDX files in `content/docs/`,
compiled at build time with **content-collections**, surfaced two ways — a
browsable public site at `/docs/[[...slug]]` (no auth, so prospective orgs can
read it) and a contextual `?help=<slug>` dialog opened from a `<HelpButton>` in
the navbar. All docs authored by the AVUT team only; audience is every user
(admins and rank-and-file alike). Taxonomy mirrors `src/lib/modules.ts` — a
section per `ModuleId` plus `getting-started` and `account`.

## Context / motivation

There is no end-user documentation today. Everything written lives in `docs/`
(specs, patterns) and is aimed at developers. As the app grows more modules
(skill-track, i3, notes, skill-package-builder, d4h-views…) and onboards more
orgs, "how do I…" questions and slow onboarding will land directly on the team.
This is partly pre-emptive — get the machinery in place while the surface area
is still small enough to document in one pass.

## Options considered

### Surfacing: standalone site + contextual entry (chosen)

A standalone `/docs` section the reader can browse, plus a `?` icon on app pages
that deep-links into the relevant topic. Rejected pure-contextual (no way to
browse / evaluate pre-signup) and pure-standalone (misses the teachable moment
on the page where the user is stuck).

### Contextual dialog: `?help=` nuqs param (chosen) vs Next.js intercepting routes

The initial ask was a route intercept so the dialog shows a `/docs/...` URL
(Instagram-modal style). Set aside: AVUT's entire dialog convention is a
search param via nuqs (`?action=`, see `docs/patterns/mutation-dialog.md`) — an
intercepting/parallel route (`(.)docs` + `@modal` slot + `default.tsx`
everywhere) would be a brand-new routing pattern with its own hard-nav and
scroll-restoration gotchas. `?help=<slug>` layered on the current page gives
deep-linking, back-button and shareable URLs for free and matches house style.
The full page at `/docs/[[...slug]]` and the dialog render the _same_ MDX.

### Auth: public (chosen)

Docs are public so prospective orgs can read them before signing up. Follows the
existing `(public)/policies/` pattern.

### Content location: `content/docs/` (chosen) vs colocated under `app/`

Top-level `content/docs/` keeps content separate from routing code, and lets a
single generated module feed both the nav tree and the search index. Colocating
`.mdx` under `src/app/(public)/docs/` would give routing for free but mixes
content and code and complicates the search corpus.

### MDX compilation: content-collections (chosen) vs Velite vs next-mdx-remote

- **content-collections** — plain zod schema via `schema: (z) => ({...})` (no new
  DSL; AVUT is already zod-4-heavy), `withContentCollections(nextConfig)` wrapper
  runs build + watch automatically inside `next dev`/`next build`, and a
  collection's `transform` can read other collections (nav tree, "other pages in
  this section" fall out for free). **Chosen.**
- **Velite** — `s.*` zod superset with content helpers; its one real edge is a
  first-class image pipeline (dimensions, blur-up). Weak pull here because
  screenshots are being minimised. You wire the build yourself.
- **next-mdx-remote/rsc** — simplest, no build tooling, but no typed frontmatter
  and no collection data to build nav/search from.
- Verify the zod-4 peer of content-collections at integration time; pin it.

### Search: build-time index + MiniSearch client-side (chosen)

Walk the compiled collection → `{ slug, heading, title, section, body }` records
→ static JSON index. Query client-side with **MiniSearch** (~6KB, typo
tolerance, prefix/fuzzy, clean API). For a first-party set of dozens–low-hundreds
of pages the index is tens of KB gzipped, no server cost. This is roughly what
Nextra v2 does internally.

- Considered **FlexSearch** (faster/smaller runtime, fiddlier API), **Orama**
  (stemming + a server `/api/docs/search` mode that keeps the index off the
  client — defer until the set is large), **Pagefind** (sharded WASM index over
  built HTML; scales to thousands of pages but awkward with a non-exported Next
  app — overkill), and **Algolia DocSearch / Typesense** (external service +
  crawler — rejected against "in-repo, just us, no external service").

### `?`→slug mapping: explicit `<HelpButton topic="...">` (chosen) vs registry field

Each page passes its own doc slug to `<HelpButton>`. Rejected adding a
`docsSlug` to the `Modules` registry — too coarse (one slug per module, not per
page/feature) and couples the module registry to docs structure.

### Section visibility: Vercel feature flags (chosen for release-gating)

The Flags SDK is already installed (`flags`, `@flags-sdk/vercel`). Use a
`flag()` per section (or one flag with variants) checked in the nav-tree builder
and the `[[...slug]]` route: a section whose flag is off 404s and drops out of
nav + the search index. This gates _unreleased-feature docs_, a different axis
from per-org module enablement (`OrganizationSettings.modules`, org settings) —
and the public `/docs` site has no org context anyway, so it shows every
released section regardless of what any one org has enabled.

## Open questions

1. **Dialog MDX rendering** — settled on a nested **server component** inside the
   Sheet (most idiomatic Next; content-collections output is import-time so a
   client-only dialog can't render arbitrary MDX). Confirm the Sheet body can
   suspend on an RSC cleanly within AVUT's dialog setup.
2. **`<HelpButton>` placement** — settled: right side of `Std.Navbar`. Needs a
   navbar actions slot if one doesn't already exist.
3. **Precompute for flags** — whether to precompute flag values so `/docs` pages
   stay statically rendered, or accept dynamic rendering for the docs routes.
4. **MDX component set** — start by reusing shadcn/ui primitives for callouts /
   note / warning / keyboard keys; develop dedicated components later only if
   they earn it.
5. **Nav / sidebar for `/docs`** — custom sidebar from the collection tree, or
   lean on an existing block. Probably custom + small.
6. **Deep-link behaviour** — `?help=<slug>` stays layered on the current page;
   no `/docs/...` URL swap. (Decided, recorded for future-me who may be tempted.)

## Notes

- Prior art / entry points:
  - `src/app/(public)/policies/{privacy,terms-of-service}` — existing public
    unauthed page pattern to follow for `(public)/docs`.
  - `src/lib/modules.ts` — the `Modules` registry; docs taxonomy mirrors its
    `ModuleId`s and should read `segment`/labels from it, not hardcode.
  - `docs/patterns/mutation-dialog.md` — the `?action=` nuqs dialog convention
    `?help=` should mirror (NuqsAdapter, `useQueryState` + `parseAsString`,
    push-on-open / replace-on-close, controlled `..._Dialog` component).
  - `src/components/blocks/` — `Std.Navbar` for the `<HelpButton>` slot; `Std`
    shell for the `/docs` layout.
  - `flags` + `@flags-sdk/vercel` already in `package.json`; `flags-sdk` skill
    available for wiring `flag()` declarations and the `vercel flags` CLI.
- Not in scope: org-authored content (that's the separate
  `2026-09-10-structured-documents.md` idea — a `structured-documents` module for
  content orgs write themselves). This idea is team-authored product docs only.
- Build wiring: `withContentCollections` handles dev watch + `next build`; the
  search index is a `.map()` over the generated collection written to a static
  JSON asset (own prebuild step or a content-collections `onSuccess`-style hook).
