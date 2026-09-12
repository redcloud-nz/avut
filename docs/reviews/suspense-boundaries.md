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
boundary that _is_ above all that blocking is the app-level `loading.tsx`, which
is why removing it breaks the `/orgs/[slug]` build (#96's experiment).

**Both issues are now closed.** The fix for each was one file, and neither was
the fix this review originally proposed — see §1's resolution and §3's
Correction 3.

Three things turned out to be narrower or simply wrong, all corrected in §1 and
§3 after implementation. They are recorded inline rather than silently edited,
because each cost real time:

- **`loading.tsx` is not interchangeable with `<Suspense>` _for its own
  segment's page_.** It sits above that page's validation boundary and outside
  its own layout, so there it satisfies the prerender check but not
  instant-navigation validation. For segments _below_ it, it is an ordinary
  ancestor boundary and does satisfy validation.
- **The root `loading.tsx` only obstructed `/`**, not the other public routes.
  `/policies/*` and the synchronous `/auth/*` pages have been prerendering at
  26–35KB all along.
- **`/` was not blocked by segment mechanics at all.** It was `new Date()` in a
  Client Component — a hard build error that the boundary above it had been
  silently absorbing. Three structural hypotheses were tested against the
  resulting spinner and none could be falsified, because the evidence was being
  eaten. See Correction 3.

`export const instant = false` does not fix #135 because it does not cascade.
That is confirmed in framework source, not inferred. The eventual fix needed
neither that nor `unstable_disableValidation`: moving the loading boundary into
a `(wrapper)` route group put it above the authenticated layout's session read,
which satisfies validation honestly.

---

## 1. Why `instant = false` doesn't silence #135

[`src/app/(wrapper)/(authenticated)/layout.tsx`](<../../src/app/(wrapper)/(authenticated)/layout.tsx>)
set `export const instant = false`, added in `bad7e99` precisely to suppress
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

|     | Approach                                                                                  | Blast radius                                                                                                                             | Verdict                                           |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | `export const instant = { unstable_disableValidation: true }` on the authenticated layout | Kills validation for the authenticated tree only — `disabled` short-circuits the whole walk, and public routes never include that layout | Taken in `ae00561`, **since removed** — see below |
| 2   | `experimental.instantInsights.validationLevel: 'manual-warning'` in `next.config.ts`      | App-wide; also silences the public routes we _want_ validated for #96                                                                    | Reject — throws away the signal we need           |
| 3   | `use cache: private` + push the session read behind a boundary                            | Correct and permanent                                                                                                                    | Turned out to be unnecessary — see below          |

### Resolution: a boundary above the layout, not a suppression

> **Added 2026-09-12, after step 4.** The options above framed this as a choice
> between suppressing validation and restructuring the session read. There was a
> third thing, missed at the time, and step 4 landed it by accident.

`unstable_disableValidation` was removed in `681a153` and **nothing replaced
it**. Step 4 moved the loading boundary to `(wrapper)/loading.tsx`, which put a
`<Suspense>` boundary _above_ `(authenticated)/layout.tsx` — and therefore above
its `requireSession()`. The blocking read now happens inside a boundary, so
validation is satisfied honestly rather than switched off.

This was verified by control, not assumed. Removing `(wrapper)/loading.tsx`
fails the build on every `/orgs/[slug]/…` route:

```
Error: Route "/orgs/[slug]/admin/d4h-access-tokens": Next.js encountered
uncached or runtime data during prerendering.
    at <unknown> (src/components/providers.tsx:23:35)
```

Restoring it passes. Option 3 — the `use cache: private` migration — was also
tried and measured: it builds green, but a control run with the directive
reverted and the suppression still absent **also** builds green. The private
cache is not what retires the suppression, and was not kept for that reason.

The practical consequence is that `(wrapper)/loading.tsx` is load-bearing in a
way its filename does not advertise. Both it and the authenticated layout carry
comments pointing at each other.

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
2. **It does not satisfy instant-navigation validation for its _own_ segment's
   page.** Validation honours a `<Suspense>` only when it sits _below_ the
   segment's validation boundary (the component-stack index comparison in
   `dynamic-rendering.js`). A `loading.tsx` sits above its own page's boundary.
   So for that page it satisfies the prerender/static-shell check but **not**
   instant validation — E1430 kept firing at
   [`docs.ts:34`](../../src/server/docs.ts) with a `docs/loading.tsx` in place,
   and stopped only once the boundary moved inside `page.tsx`.

> **Narrowed 2026-09-12, after step 4.** Point 2 is about a `loading.tsx` and a
> `page.tsx` in the **same segment**. It does not generalise: for segments
> _below_ it, a `loading.tsx` is an ordinary ancestor boundary and does satisfy
> validation. That is precisely what `(wrapper)/loading.tsx` now does for the
> whole authenticated tree (§1). Stating point 2 as a general rule — which an
> earlier draft of this section did — is what made the suppression look
> permanent when it was not.

**`loading.tsx` is therefore the weaker of the two tools _for its own page_.**
Prefer an explicit `<Suspense>` inside `page.tsx` when the blocking read is in
that page. As an ancestor boundary for a subtree it is the right tool, and
cheaper than threading a boundary through every layout beneath it.

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

`/` is the exception. At the time of writing this section the explanation on
offer was that **`app/loading.tsx` and `app/page.tsx` share a segment**, so the
loading boundary wraps the page directly and becomes its static-shell cut. The
prerendered `index.html` had 8 divs, 3 of them the rainbow spinner, and none of
the page's text, while child segments were unaffected — `/auth/sign-in`
prerendered its logo and skeleton with no spinner at all.

### Correction 3: what was actually wrong with `/`

> **Added 2026-09-12, after step 4.** The same-segment explanation above was
> never confirmed, and it was not the cause. It is left in place because the
> shape of the mistake matters more than the conclusion.

Moving the boundary out of `/`'s segment did not make the landing page
prerender. It made it **fail the build**:

```
Error: Route "/": Next.js encountered the unstable value `new Date()` in a
Client Component.
    at src/components/ui/copyright.tsx:8:26
```

`CopyrightString` was a `"use client"` component calling
`new Date().getFullYear()` during render. Under Cache Components that is an
unstable value and a hard build error. The root `loading.tsx` had been absorbing
it for as long as the page existed — which is why `/` rendered a spinner, why
`HomePage` being correctly structured made no difference, and why every
structural hypothesis about segments and route groups failed to move it.

The fix was to hoist the year to module scope, where it is evaluated once at
build time. `/` then went from **4,354 bytes** (8 divs, 3 spinners, no text) to
**25,049 bytes** (55 divs, 0 spinners, full content), classified `◐`. All other
public routes were unchanged: `auth/sign-in` 6,080, `policies/privacy` 29,939,
`policies/terms-of-service` 33,460, `docs` 8,124.

**The lesson is about method, not about `new Date()`.** A Suspense boundary
above a failing subtree converts a build error into a silent spinner. Three
successive structural hypotheses were tested against that spinner and none could
be falsified, because the boundary was hiding the evidence that would have
settled them. When a page renders a fallback and nothing you change affects it,
suspect that something beneath is erroring and the boundary is eating it —
remove the boundary to surface the error before theorising about the structure.

This also resolves the question §4 previously left open. The earlier suspicion
that `CommonProviders` was bailing the tree out is **ruled out**:
`createAdapterProvider` passes nuqs's hook through context as a value without
calling it, and nuqs wraps its own `NavigationSpy` in a `<Suspense>`.

### What the routes needed

| Route(s)                                                 | Problem                                                             | Fix                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/policies/*`, `/auth/forgot-password`, `/auth/sign-out` | None — already fully prerendered                                    | None                                                                |
| `/auth/sign-in`, `/auth/sign-up`, `/auth/reset-password` | Top-level `await searchParams` → E1439                              | Sync shell + async child in `<Suspense>`                            |
| `/auth/verify-email/[email]`                             | Top-level `await params` → same class                               | Same                                                                |
| `/docs/[[...slug]]`                                      | Flag reads block in **both** layout and page                        | A `<Suspense>` in each — not `loading.tsx`                          |
| `/`                                                      | `new Date()` in a Client Component, masked by the boundary above it | Hoist to module scope + move the boundary into `(wrapper)` (step 4) |

The `/docs` fix deliberately sidesteps the open product question of whether flag
overrides should apply to public docs. That decision is no longer on the
critical path for #96.

### Effect on the authenticated tree

92 pages plus `@modal` keep a boundary above them — now `(wrapper)/loading.tsx`
rather than `app/loading.tsx` — so the blocking chain is still absorbed and
nothing regressed.

> **Revised 2026-09-12.** This subsection previously concluded that the boundary
> "does nothing for instant validation of the pages beneath it… which is exactly
> why #135 needed `unstable_disableValidation` rather than a boundary." That is
> wrong, and it is the generalisation Correction 1 above now narrows. The
> boundary does satisfy validation for the segments below it, and once it moved
> into `(wrapper)` it sat above `(authenticated)/layout.tsx` for the first time.
> #135's suppression was redundant from that moment and was removed in `681a153`.

The route group is doing real work here. `(wrapper)` is transparent to routing,
so it costs nothing in the URL, but it lets one boundary cover the entire
authenticated tree while stopping short of `/`. That is the whole difference
between the boundary being a fix and being the thing that masked Correction 3.

The forward-looking caveat from before still stands, now narrowed: the boundary
no longer covers `src/app/layout.tsx`'s own render, so a blocking await added
there later is caught by nothing. `Root_Layout` is `async` but awaits nothing
(§4) — dropping the `async` would make that regression impossible to introduce
by accident.

---

## 4. Other findings

**`src/components/boundary.tsx` is dead code.** Zero usages across `src/`. It is
the only place pairing an `ErrorBoundary` with a `<Suspense>` — the pattern the
app actually wants. Either adopt it as the house pattern or delete it; leaving
it is a trap for the next person who greps for one.

**Only two error boundaries exist** — `src/app/error.tsx` and
`src/app/(wrapper)/(authenticated)/orgs/[slug]/error.tsx`. Every `useSuspenseQuery` in a
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

| #   | Action                                                                                        | Addresses          | Status                                                   |
| --- | --------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------- |
| #   | Action                                                                                        | Addresses          | Status                                                   |
| --- | --------------------------------------------------------------------------------------------- | ------------------ | ------------------------------                           |
| 1   | `instant = { unstable_disableValidation: true }` on the authenticated layout                  | #135 (suppression) | Done `ae00561`, **reverted** `681a153` — superseded by 4 |
| 2   | Sync shell + async child in `<Suspense>` on the 4 `/auth/*` pages                             | Prereq for #96     | **Done** — `d7ae72d`                                     |
| 3   | `<Suspense>` around the docs nav (layout) and article (page)                                  | Prereq for #96     | **Done** — `0604e08`                                     |
| 4   | Move `(authenticated)` and `loading.tsx` into a `(wrapper)` group; fix `copyright.tsx`        | #96 **and** #135   | **Done** — `fd77866`                                     |
| 5   | ~~Migrate the session read to `use cache: private` behind a boundary~~                        | #135 (properly)    | **Not needed** — see §1                                  |
| 5a  | Give the session read a cache lifetime so the App Shell can carry it                          | Latency only       | **Closed — measured, no win.** See below                 |
| 5b  | The 29 authenticated pages with no guard of their own                                         | Correctness        | Open — unrelated to caching                              |
| 6   | Decide `Boundary`'s fate; add card/list-level error boundaries                                | §4                 | Open — medium                                            |

Steps 1–4 are verified by `npx next build`: exit 0, no E1437 in either the build
output or the dev overlay, `/` classified `◐` with 25,049 bytes of real content,
and every authenticated route `◐`.

**Step 5 as originally written no longer exists.** It bundled three unrelated
things under one heading: retiring the suppression (done by step 4), giving the
session read a cache lifetime (a latency question, 5a), and hoisting
`requireOrganization` out of 59 page bodies (a correctness question, 5b). The
first is complete; the other two are split out because neither depends on the
other and only one of them is about caching.

### 5a: why there is no performance win in `requireSession`

Tried and rejected on measurement, 2026-09-12. Recorded so it is not reopened on
the strength of the Next guide alone.

**1. There is no database round trip to save.** better-auth's
[`cookieCache`](../../src/server/auth.ts) is already enabled with
`maxAge: 5 * 60` — the same five minutes `cacheLife({ stale: 300 })` would have
set. Its `/get-session` endpoint returns straight from the signed `session_data`
cookie and never reaches the adapter while that cookie is valid. A private cache
would be a five-minute cache layered on a five-minute cache.

**2. What remains to save is 0.02 ms.** The cookie-cache path is a base64
decode, an HMAC-SHA256 verify and a `JSON.parse`. Benchmarked on a
representative 499-byte session payload: **0.0235 ms per call**, and React
`cache()` already dedupes it to one call per request.

**3. The App Shell argument doesn't reach this codebase.** The real prize in the
Next guide is skipping a server round trip, not CPU. But for the App Shell to
carry an authenticated route, everything from root to page must be static or
privately cached. `requireOrganization` still calls
`auth.api.hasPermission({ headers })` — an uncached runtime read that _does_ hit
the database — plus `getOrganizationUserById` and `resolveModuleFlags()`. The
session is not the binding constraint, so caching it alone changes nothing.
Making it change something means privately caching the permission check too,
which is the large restructuring whose prize is small (see the retraction
below), and which would put permission data behind a plain-text cache key.

A build with the directive applied produced **byte-identical** prerendered
shells (`orgs/[slug]/admin.html` 4,722 b, 8 divs, before and after) — expected,
since `use cache: private` is excluded from static shell generation, and a
reminder that its benefit is not locally observable.

**The risk side is not zero**, which matters when the gain is. This app supports
impersonation (`window.avut.impersonateUser`, `ImpersonationBanner`). A second
five-minute identity cache is another place a stale identity can survive an
identity change. Both `impersonateUser` and `stopImpersonating` do a full page
load, which drops a private cache, so it is probably safe — but "probably safe"
for a 0.02 ms saving is a bad trade.

**5b deserves its own issue.** Of 92 authenticated pages, 59 call
`requireOrganization` and 5 call `requireSession`; **29 call neither** and are
gated entirely by an ancestor layout. That is fine while the layouts block, but
it is the constraint that makes any future "push the session read below a
boundary" work risky: a boundary lets `{children}` render in parallel with the
guard, and for those 29 pages nothing else would stop them. The original step 5
proposed hoisting _more_ guards into layouts, which points the wrong way.

Use `npx next build`, not `npm run build` — the latter runs `prisma migrate
deploy` first, which per AGENTS.md must not touch the shared database without
explicit permission.

One claim from the first draft is worth retracting explicitly: that step 5 would
turn `Std.SidebarInset`'s boundary "from decorative into the real
partial-prerender cut point." That overstated the prize. `requireOrganization`
is not only a guard — it supplies the `organization`, `settings` and `roles`
that feed `OrganizationProvider`, and therefore the sidebar, the nav switcher
and module gating. All of that is session-derived, so even a perfect
restructuring leaves `/orgs/[slug]/*` prerendering the `Std` chrome and little
else. Worth knowing before anyone budgets time against it.
