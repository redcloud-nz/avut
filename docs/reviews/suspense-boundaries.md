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
boundary that _is_ above all that blocking is the root `src/app/loading.tsx` —
which is why it is simultaneously load-bearing for the authenticated app (#96
found removing it breaks the `/orgs/[slug]` build) and an obstacle for the
public routes it also happens to cover.

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

## 3. Moving `loading.tsx` (#96)

`loading.tsx` is sugar for wrapping a segment's children in `<Suspense>`. Moving
it from `src/app/` to `src/app/(authenticated)/` changes one thing — which
routes have a boundary above them — with very different consequences per side.

**Authenticated tree: no change.** 92 pages plus `@modal` keep the boundary
directly above them, still absorbing the blocking chain. #135 is unaffected.
This is deliberate; #96 only aims to stop that boundary reaching routes that
don't need it.

One forward-looking caveat: the root boundary currently also covers
`src/app/layout.tsx`'s own render. That file is clean today (fonts and metadata
only), but after the move nothing catches a blocking await added there later.

**Public routes: this is where it bites.** All ten non-authenticated pages were
read. They split three ways.

### Already clean — the win (5 pages)

| Route                                             | Why                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/`                                               | No top-level await; session CTAs already isolated at [`page.tsx:173`](../../src/app/page.tsx) and `:201` |
| `/policies/privacy`, `/policies/terms-of-service` | Pure static JSX, sync components                                                                         |
| `/auth/forgot-password`, `/auth/sign-out`         | Sync, no awaits                                                                                          |

These prerender to a real static shell the moment the root boundary is gone.
`/` is the case #96 investigated: the 4.3KB `index.html` of nothing but spinner
markup becomes the actual landing page.

### Will break the build — URL data outside Suspense (4 pages)

`/auth/sign-in`, `/auth/sign-up` and `/auth/reset-password` each
`await props.searchParams` at the top of the page body;
`/auth/verify-email/[email]` does the same with `props.params`. With no boundary
above them that is **E1439** (`createLinkBodyErrorInNavigation`).

Cheap to fix — split the static `Argus` shell from a small async child, and pass
the promise down unawaited so the page function stops being `async`:

```tsx
export default function SignIn_Page(props: PageProps<"/auth/sign-in">) {
  return (
    <Argus.Root>
      <Argus.Column>
        <Argus.AppLogo /> {/* prerenders */}
        <Suspense fallback={<SignInSkeleton />}>
          <SignInCardWithParams searchParams={props.searchParams} />
        </Suspense>
      </Argus.Column>
    </Argus.Root>
  );
}
```

### Will break the build — runtime data, and harder (1 route)

`/docs/[[...slug]]` blocks in its **layout**, not just its page.
[`docs/layout.tsx:20`](<../../src/app/(public)/docs/layout.tsx>) awaits
`getVisibleDocsNav()`; the page awaits `getVisibleDocBySlug()`. Both funnel into
`resolveModuleFlags()` → `flag()` from `flags/next`, which reads cookies and
headers to support overrides. So the sidebar _and_ the article body are
runtime-dependent, above and below.

This is the route that most deserves a static shell — it already has
`generateStaticParams`. Fixing it means either giving the nav its own boundary
in the layout, or deciding that flag overrides needn't apply to public docs and
hoisting the flag read out of the request path. That carries a product decision
and should be scoped on its own rather than smuggled into the `loading.tsx`
move.

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

---

## Recommendations

Ordered. Each step is independently shippable.

| #   | Action                                                                                                                             | Addresses          | Size                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------- |
| 1   | `instant = { unstable_disableValidation: true }` on the authenticated layout, comment referencing #135                             | #135 (suppression) | One line                      |
| 2   | Add local Suspense boundaries to the 4 `/auth/*` pages; verify with `npm run build` while the root `loading.tsx` is still in place | Prereq for #96     | Small                         |
| 3   | Scope and fix `/docs/[[...slug]]`'s flag reads                                                                                     | Prereq for #96     | Small, but carries a decision |
| 4   | Move `loading.tsx` → `(authenticated)/loading.tsx`; confirm by diffing `.next/server/app/index.html` for real content on `/`       | #96                | Small                         |
| 5   | Migrate the session read to `use cache: private` behind a boundary; then hoist `requireOrganization` out of the 59 page bodies     | #135 (properly)    | Large                         |
| 6   | Decide `Boundary`'s fate; add card/list-level error boundaries                                                                     | §4                 | Medium                        |

Steps 2–4 should land as separate commits so the tree is never broken: the
breakage introduced by step 4 is entirely pre-empted by steps 2 and 3, and all
of it fails loudly at `next build` rather than silently in production.

Step 5 is what retires the step-1 suppression and turns `Std.SidebarInset`'s
existing boundary from decorative into the real partial-prerender cut point. The
first four steps are worth doing on their own merits, but they are also the
groundwork for it.
