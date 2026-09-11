# Review: Suspense boundaries under Cache Components

**Date:** 2026-09-12
**Scope:** Every `<Suspense>` boundary, `loading.tsx`, and blocking server-side
read in `src/app/` and `src/components/`, against Next.js 16.3.4 with
`cacheComponents: true`.
**Related:** [#135](https://github.com/redcloud-nz/avut/issues/135),
[#96](https://github.com/redcloud-nz/avut/issues/96)

Issues #135 and #96 read as two unrelated complaints — a dev-overlay error that
won't go away, and a landing page that won't prerender. They are the same
problem seen from opposite ends of the app. This review establishes what that
problem is, proves it against the framework source, and sets out the order to
fix it in.

Findings below are pinned to **Next.js 16.3.4**. The `instant` validation
machinery is experimental and its behaviour is explicitly documented as liable
to change without a major version; re-verify against the installed version
before acting on this months from now.

---

## Summary

The application's Suspense boundaries are the right shape but in the wrong
place: they sit **inside** the code that blocks, not around it. Every
authenticated page awaits four layers of session and organization checks before
returning any JSX, so the boundaries in `Std.SidebarInset` and
`Std.ScrollContainer` are never reached during the prerender. The single
boundary that _is_ above all that blocking is the root `src/app/loading.tsx`,
which is why removing it breaks the `/orgs/[slug]` build (#96's experiment).

Two things turned out to be narrower than first described, both corrected in §3
after implementation:

- **`loading.tsx` is not interchangeable with `<Suspense>`.** It sits above its
  own segment's page and outside its own layout, so it satisfies the prerender
  check but not instant-navigation validation. Prefer an explicit `<Suspense>`
  in `page.tsx`.
- **The root `loading.tsx` only obstructs `/`**, not the other public routes.
  `/policies/*` and the synchronous `/auth/*` pages have been prerendering at
  26–35KB all along. `/` is affected because it is the one page sharing a
  segment with `loading.tsx`.

`export const instant = false` does not fix #135 because it does not cascade.
That is confirmed in framework source, not inferred.

---

## 1. Why `instant = false` doesn't silence #135

[`src/app/(authenticated)/layout.tsx:20`](<../../src/app/(authenticated)/layout.tsx>)
sets `export const instant = false`, added in `bad7e99` precisely to suppress
this error. It has no effect on the pages beneath it, and the reason is visible
in `node_modules/next/dist/server/app-render/instant-validation/instant-config.js`.

`anySegmentNeedsInstantValidation` walks the entire loader tree. The opt-out
branch is commented in Next's own source:

```js
if (instantConfig === false) {
  // Explicit opt-out. Doesn't itself trigger validation.
}
```

It does not set the `disabled` flag and it does not stop the walk. Traversal
continues into every descendant, where page and `default` segments without an
explicit config pick up **implicit** validation under the framework default
(`validationLevel: 'warning'`):

```js
} else if (applyDefaultValidation && isImplicitValidationSegment(tree[0])) {
    needsValidation = true;
}
```

So on `/orgs/[slug]/admin/teams` the validation boundary is planted at the
_page_ segment. `requireSession()` in the authenticated layout is a shared
parent **above** that boundary, and it prevents the boundary from rendering at
all. That lands in the `!allRequiredBoundariesRendered` path of
`dynamic-rendering.js`, which emits error **E1437**
(`createDynamicBodyErrorInNavigation`) — the exact message reported in #135.

The `instant` API reference says "Setting `instant = false` on a segment opts it
out of validation entirely." That sentence is true of _that segment_ and
misleading about its subtree. The expectation in #135 is reasonable; the code
does something narrower.

### Options

|     | Approach                                                                                  | Blast radius                                                                                                                             | Verdict                                                                                              |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `export const instant = { unstable_disableValidation: true }` on the authenticated layout | Kills validation for the authenticated tree only — `disabled` short-circuits the whole walk, and public routes never include that layout | **Take this now.** One line, correctly scoped, and the `unstable_` prefix is honest about what it is |
| 2   | `experimental.instantInsights.validationLevel: 'manual-warning'` in `next.config.ts`      | App-wide; also silences the public routes we _want_ validated for #96                                                                    | Reject — throws away the signal we need                                                              |
| 3   | `use cache: private` + push the session read behind a boundary                            | Correct and permanent                                                                                                                    | The real fix, but see §2 — it's bigger than the layout                                               |

Option 1 is a suppression and should say so in its comment, referencing #135, in
the same spirit as the existing comment it replaces.

---

## 2. The structural problem

Of **92** authenticated pages, **59** top-level-`await requireOrganization(slug)`
and **21** `await fetchQuery(...)` before returning JSX. The resulting shape:

```
(authenticated)/layout.tsx     await requireSession()        ← blocks
  [slug]/layout.tsx            await requireOrganization()   ← blocks
    admin/layout.tsx           await requireOrganization()   ← blocks
      page.tsx                 await requireOrganization()   ← blocks
        <Std.SidebarInset>       <Suspense>                  ← never reached
          <Std.ScrollContainer>  <Suspense>                  ← never reached
```

Both boundaries in [`std.tsx:35`](../../src/components/blocks/std.tsx) and
[`std.tsx:118`](../../src/components/blocks/std.tsx) are downstream of four
sequential awaits. This is why #96's experiment failed: wrapping the landing
page's session-aware CTAs in local boundaries changed nothing, because an
ancestor was already blocking. It is also why deleting the root `loading.tsx`
broke `/orgs/[slug]` — that boundary is the only one above the blocking chain.

The encouraging part is that `requireOrganization` is not the real cost.
`getOrganizationBySlug` and `getOrganizationSettings` are already `"use cache"`.
What poisons the chain is `requireSession()` and `auth.api.hasPermission()`,
both `headers()`-dependent. Fix the session read and most of the tree becomes
cacheable — which is exactly what Next's
[authentication with Cache Components](https://nextjs.org/docs/app/guides/authentication-with-cache-components)
guide prescribes: a `getCurrentUser()` marked `'use cache: private'`, called
from a component _inside_ a boundary rather than top-level-awaited in a layout.
That guide's "Keep the session read out of a layout's top level" is a direct
description of the current code.

---

## 3. `loading.tsx`, and what it actually does (#96)

> **Revised 2026-09-12 after implementation.** This section originally claimed
> `loading.tsx` is simply "sugar for wrapping a segment's children in
> `<Suspense>`", and treated the two as interchangeable. Implementing steps 2–4
> disproved that twice. Both corrections are recorded below, because both were
> load-bearing for #96 and both cost real time to discover.

### Correction 1: a `loading.tsx` boundary sits above its own segment's page

Next's own reference for `loading.js` says it plainly: "In the same folder,
`loading.js` will be nested **inside** `layout.js`. It will automatically wrap
the `page.js` file and any children below in a `<Suspense>` boundary."

Two consequences follow, and neither is obvious from that sentence:

1. **It does not cover its own layout.** A blocking `await` in `layout.tsx` is
   outside the boundary that `loading.tsx` creates. This is why a
   `docs/loading.tsx` could not rescue `/docs`: the layout's
   `getVisibleDocsNav()` still blocked.
2. **It does not satisfy instant-navigation validation for its own page.**
   Validation honours a `<Suspense>` only when it sits _below_ the segment's
   validation boundary (the component-stack index comparison in
   `dynamic-rendering.js`). A `loading.tsx` sits above it. So it satisfies the
   prerender/static-shell check but **not** instant validation — E1430 kept
   firing at [`docs.ts:34`](../../src/server/docs.ts) with a `loading.tsx` in
   place, and stopped only once the boundary moved inside `page.tsx`.

**`loading.tsx` is therefore the weaker of the two tools.** Prefer an explicit
`<Suspense>` inside `page.tsx`. Reach for `loading.tsx` only as a prerender
backstop for a whole subtree.

### Correction 2: #96's premise was half wrong

#96 states that `/`, `/auth/*` and `(public)/policies/*` "can never be served as
a real cached static shell while the root `loading.tsx` exists." Only `/` is
affected. Measured from `npx next build` on 2026-09-12, **with the root
`loading.tsx` still in place**:

| Prerendered HTML                   | Size  | Contents                  |
| ---------------------------------- | ----- | ------------------------- |
| `policies/terms-of-service.html`   | 35 KB | Full page                 |
| `policies/privacy.html`            | 32 KB | Full page                 |
| `auth/forgot-password.html`        | 29 KB | Full page                 |
| `auth/sign-out.html`               | 26 KB | Full page                 |
| `docs/…` (after §3 fix)            | 8 KB  | Header, search, frame     |
| `auth/sign-in.html` (after §3 fix) | 6 KB  | Logo + card skeleton      |
| `index.html` (`/`)                 | 4.3KB | **Spinner only** — 8 divs |

The pages that were already synchronous have been prerendering fully all along.
A boundary above static content does not prevent prerendering; it only becomes a
cut point where something beneath it actually blocks.

`/` is the exception because **`app/loading.tsx` and `app/page.tsx` are in the
same segment**. The loading boundary wraps that page directly and becomes its
static-shell cut, regardless of the page's own nested boundaries. `HomePage` is
correctly structured — synchronous, with both session reads isolated at
[`page.tsx:173`](../../src/app/page.tsx) and `:201` — and still contributes
nothing to the shell: the prerendered `index.html` has 8 divs, 3 of them the
rainbow spinner, and none of the page's text. Child segments are unaffected,
which `/auth/sign-in` proves by prerendering its logo and skeleton with no
spinner at all.

This also resolves the question §4 previously left open. The earlier suspicion
that `CommonProviders` was bailing the tree out is **ruled out**:
`createAdapterProvider` passes nuqs's hook through context as a value without
calling it, and nuqs wraps its own `NavigationSpy` in a `<Suspense>`.

### What the routes needed

| Route(s)                                                 | Problem                                        | Fix                                        |
| -------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `/policies/*`, `/auth/forgot-password`, `/auth/sign-out` | None — already fully prerendered               | None                                       |
| `/auth/sign-in`, `/auth/sign-up`, `/auth/reset-password` | Top-level `await searchParams` → E1439         | Sync shell + async child in `<Suspense>`   |
| `/auth/verify-email/[email]`                             | Top-level `await params` → same class          | Same                                       |
| `/docs/[[...slug]]`                                      | Flag reads block in **both** layout and page   | A `<Suspense>` in each — not `loading.tsx` |
| `/`                                                      | Root `loading.tsx` cuts its own segment's page | Move `loading.tsx` down (step 4)           |

The `/docs` fix deliberately sidesteps the open product question of whether flag
overrides should apply to public docs. That decision is no longer on the
critical path for #96.

### Effect on the authenticated tree: none

92 pages plus `@modal` keep the boundary directly above them, still absorbing
the blocking chain. But note what §1 established: that boundary does nothing for
instant validation of the pages beneath it. It is a prerender backstop, not a
validation fix — which is exactly why #135 needed `unstable_disableValidation`
rather than a boundary.

One forward-looking caveat: the root boundary currently also covers
`src/app/layout.tsx`'s own render. That file is clean today (fonts and metadata
only), but after the move nothing catches a blocking await added there later.

---

## 4. Other findings

**`src/components/boundary.tsx` is dead code.** Zero usages across `src/`. It is
the only place pairing an `ErrorBoundary` with a `<Suspense>` — the pattern the
app actually wants. Either adopt it as the house pattern or delete it; leaving
it is a trap for the next person who greps for one.

**Only two error boundaries exist** — `src/app/error.tsx` and
`src/app/(authenticated)/orgs/[slug]/error.tsx`. Every `useSuspenseQuery` in a
list or content component throws to one of those two, so a single failed tRPC
query blanks the entire org shell rather than the one card that failed. Suspense
boundaries without matching error boundaries is a larger day-to-day UX gap than
either issue in scope here.

**Inconsistent page shell.** Four report pages (`skill-track/reports/{skill,
team,matrix,person}`) hand-roll `<Suspense fallback={<PageLoadingSpinner/>}>`
directly under `Std.SidebarInset` instead of using `Std.ScrollContainer`, which
already provides one. Two spinner vocabularies for the same job.

**Redundant nesting in `Std`.** `SidebarInset`'s boundary
(`fallback={<PageLoadingSpinner/>}`) wraps `ScrollContainer`'s
(`fallback={<RainbowSpinner/>}`). The inner fallback can never appear on first
paint, since the outer resolves last. One of the two is doing nothing.

**`@modal/default.ts` is a DEFAULT segment**, so it is implicitly validated too —
relevant when measuring whether a fix to #135 actually worked.

**`Root_Layout` is `async` but awaits nothing.** Harmless today, and it is what
keeps §3's "nothing catches a blocking await in the root layout after the move"
caveat theoretical. Dropping the `async` would make that regression impossible to
introduce by accident.

**`Argus.AppLogo` is now the LCP element** on the `/auth/*` pages, which Next
flags with a suggestion to set `loading="eager"`. That warning is a _consequence_
of §3's fix working — the logo is the first meaningful paint instead of a
spinner. Adding `priority` is a cheap follow-up.

---

## Recommendations

Ordered. Each step is independently shippable. Status as of 2026-09-12.

| #   | Action                                                                                                                         | Addresses          | Status               |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ | -------------------- |
| 1   | `instant = { unstable_disableValidation: true }` on the authenticated layout                                                   | #135 (suppression) | **Done** — `ae00561` |
| 2   | Sync shell + async child in `<Suspense>` on the 4 `/auth/*` pages                                                              | Prereq for #96     | **Done** — `d7ae72d` |
| 3   | `<Suspense>` around the docs nav (layout) and article (page)                                                                   | Prereq for #96     | **Done** — `0604e08` |
| 4   | Move `loading.tsx` → `(authenticated)/loading.tsx`; confirm `index.html` carries real content                                  | #96                | Next — one file      |
| 5   | Migrate the session read to `use cache: private` behind a boundary; then hoist `requireOrganization` out of the 59 page bodies | #135 (properly)    | Large                |
| 6   | Decide `Boundary`'s fate; add card/list-level error boundaries                                                                 | §4                 | Medium               |

Steps 1–3 are verified: #135's E1437 is gone from both the dev overlay and the
dev server output, and `npx next build` passes with the public routes prerending
as §3's table records.

**Step 4's expected effect is now precise:** it changes exactly one route. `/`
should go from a 4.3KB spinner-only shell to real landing-page content. Nothing
else moves, because every other public route already prerenders (§3). Verify by
rebuilding and checking `index.html` for page text rather than by its size alone.

Use `npx next build`, not `npm run build` — the latter runs `prisma migrate
deploy` first, which per AGENTS.md must not touch the shared database without
explicit permission.

Step 5 is what retires the step-1 suppression and turns `Std.SidebarInset`'s
existing boundary from decorative into the real partial-prerender cut point. The
first four steps are worth doing on their own merits, but they are also the
groundwork for it.
