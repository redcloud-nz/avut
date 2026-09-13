# Instant authenticated navigation via Partial Prefetching and the App Shell

**Project:** avut
**Date:** 2026-09-12 12:27
**Source:** fell out of the Suspense boundary review (`docs/reviews/suspense-boundaries.md`)

## Idea

Enable `partialPrefetching` in `next.config.ts` and give the session read — and
then the organization access check — cache lifetimes with
`use cache: private`, so that navigating between authenticated pages costs **no
server round trip at all**. The per-session App Shell would carry the
session-dependent content into the browser ahead of the click.

This is a latency idea, not a correctness one. Nothing is broken today.

## Context / motivation

Came out of investigating #135/#96. The review closed a sub-step ("5a: give the
session read a cache lifetime") as **no win**, and that finding stands — but the
reason it's no win is narrower than it first appeared, and the wider version is
genuinely interesting.

The mechanism, as documented in Next 16.3.4:

- **Partial rendering** (what most people picture): on a client navigation,
  shared layouts are preserved and do not re-render. Moving between two pages
  under `(authenticated)` re-fetches only the page segment.
- **The App Shell** (a different thing): "a per-route prerender containing the
  parts of a page that don't depend on URL data… Routes that read `cookies()` or
  `headers()` produce one that also includes session data, cached per session on
  the client." It is the _prefetch payload_ — what's in the browser before the
  click.

The second is the lever. A page segment whose content depends on an uncached
session read is a dynamic hole: it must be fetched on click. Give that read a
lifetime of ≥ 5 minutes via `use cache: private` and the segment can ride along
in the App Shell instead, prefetched.

## What was actually verified

Worth recording precisely, because a lot of this was established the hard way.

**Verified:**

- Two scratch pages (`/zz-a`, `/zz-b`) each doing only `await requireSession()`
  build to per-segment prefetch artifacts that match the partial-rendering model
  exactly — `(wrapper).segment.rsc`, `@modal/__DEFAULT__.segment.rsc`,
  `zz-a/__PAGE__.segment.rsc`. Navigating A→B fetches only the page segment.
- At baseline that page segment contains **no rendered content** — a dynamic
  hole. This is the round trip the idea would remove.
- Applying `use cache: private` to the session read left every segment artifact
  **byte-identical**. This is expected and is the key mechanical insight: **the
  App Shell carrying session data is a runtime, per-session artifact, not a build
  one.** The build has no session to render with. A local `next build` therefore
  cannot measure this idea in either direction.
- better-auth's `cookieCache` is already enabled at `maxAge: 5 * 60`
  (`src/server/auth.ts`), and `/get-session` returns from the signed cookie
  without touching the adapter while it's valid. The remaining CPU cost is
  0.0235 ms/call (measured, 499-byte payload), already deduped per request by
  React `cache()`. **There is no data-fetch win here — only a round-trip win.**
- `partialPrefetching` is **not** enabled in `next.config.ts` (only
  `cacheComponents: true`), so `<Link>` does not currently default to prefetching
  a per-route App Shell.

**Not verified:**

- That the round-trip elimination actually materialises end-to-end. The docs say
  it does; it has not been observed in this app. The only real test is
  `next start` plus a signed-in browser, watching whether an A→B click issues a
  network request.

## The blocker, and why this needs investigation before it's worth anything

The `/zz-a` → `/zz-b` hypothetical works because those pages do _only_ a session
read. Real authenticated pages don't.

`requireOrganization(slug)` (`src/server/organization-access.ts`) calls
`auth.api.hasPermission({ headers })` — an uncached read that **does** hit the
database, and is not covered by better-auth's cookie cache. It also calls
`getOrganizationUserById`, and `[slug]/layout.tsx` additionally calls
`resolveModuleFlags()`. Any one of these keeps the hole dynamic regardless of
what the session read does.

So the session is not the binding constraint, and caching it alone changes
nothing. **The work is an audit of everything in the authenticated path that
blocks, not a one-line config change.** That audit is the actual content of this
idea and has not been done.

Known members of that set so far:

| Blocker                               | Where                          | Cacheable?                                                 |
| ------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `requireSession()` / `getSession()`   | `src/server/session.ts`        | Yes — `use cache: private`, verified to build green        |
| `auth.api.hasPermission({ headers })` | `organization-access.ts:49`    | Unknown. DB-backed. Plain-text cache-key concern (below)   |
| `getOrganizationUserById`             | `organization-access.ts:81`    | Probably — takes an org id + user id, could be `use cache` |
| `resolveModuleFlags()`                | `orgs/[slug]/layout.tsx`       | Unknown — flag evaluation                                  |
| `getOrganizationBySlug` / `…Settings` | `organization-access.ts:76-77` | Already `"use cache"`                                      |

## Options considered

- **Session read only** (the original "step 5a") — tried, measured, rejected. No
  DB round trip to save, 0.02 ms of CPU, and the App Shell benefit can't
  materialise while `requireOrganization` still blocks. Recorded in the review.
- **Enable `partialPrefetching` alone, change nothing else** — cheap to try and
  worth doing as an experiment, but expected to do little for `/orgs/[slug]/*`
  while the permission check is uncached. Might help the handful of authenticated
  routes that _don't_ go through `requireOrganization` (`/modules`,
  `/user-settings`, `/orgs/--select-org`).
- **`prefetch = 'partial'` per segment** instead of the global flag — lets this be
  piloted on one route subtree rather than app-wide. Probably the right shape for
  a first attempt.
- **Full audit + cache everything in the authenticated path** — the real version,
  and a large piece of work with a security surface (see below).

## Open questions

- **Does the round trip actually disappear?** Needs the `next start` + signed-in
  browser test. Everything else is speculation until then. Note `window.avut` is
  dev-only, so this means signing in through the real form.
- **Can the permission check be cached at all, safely?** Next's own guidance is
  explicit that "cache keys and tags are stored in plain text… keep secrets and
  sensitive personal data out of arguments and tags." Keying a permission result
  on `(organizationId, userId)` is probably fine, but caching _authorization
  decisions_ deserves more thought than caching data. A stale `true` is a
  different class of bug from a stale list.
- **How does this interact with impersonation?** `window.avut.impersonateUser` /
  `stopImpersonating` and `ImpersonationBanner` are real features. Layering
  five-minute identity caches creates more places a stale identity can survive an
  identity switch. Both impersonation calls do a full page load, which drops a
  private cache — but that wants verifying, not assuming.
- **Is the prize big enough?** One RTT per authenticated navigation (~50–200 ms
  on a real network). Real, but it should be weighed against the audit cost and
  the authorization-caching risk before anyone starts.
- **Does `staleTimes` need tuning alongside?** Untouched in `next.config.ts`.

## Notes

- Entry points: `next.config.ts` (`partialPrefetching`), `src/server/session.ts`,
  `src/server/organization-access.ts`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/layout.tsx`.
- Relevant Next docs, all present under `node_modules/next/dist/docs/01-app/`:
  `02-guides/adopting-partial-prefetching.md`, `02-guides/optimizing-prefetching.md`,
  `02-guides/authentication-with-cache-components.md`,
  `03-api-reference/01-directives/use-cache-private.md`,
  `03-api-reference/04-functions/cacheLife.md` (the threshold table under
  "Prerendering behavior"), `04-glossary.md` ("App Shell").
- The `cacheLife` thresholds that govern this: `stale` < 30s is excluded from
  prerenders entirely; 30s–5min is in prerenders but out of the App Shell; ≥ 5 min
  reaches the App Shell. So any lifetime chosen here must be ≥ 5 minutes to be
  worth anything, which is itself a constraint on how stale an authorization
  decision is allowed to be.
- Pinned to **Next.js 16.3.4**. This machinery is experimental and documented as
  liable to change without a major version — re-verify before acting on this.
- Related: `docs/reviews/suspense-boundaries.md` §1 and its "5a: why there is no
  performance win in `requireSession`" section, which this idea supersedes rather
  than contradicts.
