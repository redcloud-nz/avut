# Calling tRPC from Server Components

**Date:** 2026-08-12
**Status:** Approved, ready for implementation planning

## Goals

1. Call tRPC procedures from server components, replacing the parallel server fetch modules
   (`server/person.ts`, `server/team.ts`, `server/skill-check-session.ts`).
2. Prefetch tRPC queries on the server so client components render with a warm cache.
3. State each route's permission requirement exactly once — in the procedure — rather than
   redeclaring it on the page.
4. Render permission failures the same way regardless of whether they surfaced from
   `requireOrganization` on the server or from a client refetch.

## Decisions

| Decision                                                                           | Rationale                                                                                                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Pages prefetch; page bodies stay client components                                 | Keeps the existing server/client split. Removes the fetch-on-mount waterfall without rewriting rendering.                        |
| `prefetch` is fire-and-forget and non-throwing                                     | Server render does not block. Failures surface on the client, which section C makes acceptable.                                  |
| No `caller` export; server-side reads use `fetchQuery`                             | `fetchQuery` populates the request-scoped cache, so the page's later `prefetch` of the same key is a hit. `createCaller` is not. |
| Direct router access (`{ ctx, router }`), not an HTTP link                         | The HTTP path cannot forward cookies and is the cause of the earlier prerender auth failures.                                    |
| Session seeded once at `(authenticated)/layout.tsx`; `HydrateClient` used by pages | Fewest wrappers. `SessionHydration` disappears from seven module layouts.                                                        |
| tRPC error codes translated by a shared error component                            | One place holds the wording for both the server `forbidden()` boundary and client-side `TRPCClientError`.                        |
| Server permission failures use Next's `forbidden()` interrupt                      | Server-thrown errors lose their class and message across the RSC boundary (finding 4), so a thrown error cannot carry the copy.  |
| Scope: machinery plus three pilot pages                                            | Proves the pattern against the pages that force the server-module deletions, before it spreads to the other ~70 routes.          |

## Prior findings

Three defects in the current code that this work depends on:

1. **`getQueryClient()` is not request-scoped on the server.** `src/trpc/query-client.ts`
   returns a fresh client on every server call. Prefetching in a page and calling
   `dehydrate()` in a wrapper would ship an empty payload.
2. **Server-side tRPC calls would go over HTTP without cookies.** `src/trpc/client.ts`
   `getUrl()` points server-side calls at `http://localhost:PORT/trpc`. This is the
   most likely cause of the auth failures seen on an earlier attempt.
3. **`errorFormatter` clobbers `data`.** `src/trpc/init.ts` sets `data: { ...shape, conflict }`,
   so on the client `error.data.code` is tRPC's numeric code and the string `"FORBIDDEN"`
   is buried at `error.data.data.code`.
4. **Server-thrown errors do not survive the RSC boundary.** Next serialises them to the
   client error boundary with the class lost and, in production, the message replaced by
   "An error occurred in the Server Components render" plus a digest. `app/error.tsx`
   rendering `error.name` / `error.message` therefore only works in development, and an
   `error instanceof ForbiddenError` check on the client can never be true.

## A. Foundations

### `src/trpc/query-client.ts` — unchanged

Keeps `makeQueryClient()` and its existing `getQueryClient()`. The
`environmentManager.isServer()` branch is correct for the client-component path, where
each SSR render must receive a fresh client.

### `src/server/trpc-context.ts` — new

`createTrpcContext` lifted verbatim out of `src/app/trpc/[trpc]/route.ts` (lines 17–47),
still wrapped in React `cache`. Marked `import "server-only"`. The route handler imports
it rather than defining it.

### `src/trpc/server.tsx` — new

```tsx
import "server-only";

export const getServerQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTrpcContext,
  router: appRouter,
  queryClient: getServerQueryClient,
});

export function prefetch(queryOptions) {
  void getServerQueryClient().prefetchQuery(queryOptions);
}

export async function HydrateClient({ children }) {
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>{children}</HydrationBoundary>
  );
}
```

No `caller` export. No infinite-query branch in `prefetch` until a caller needs one.

### Naming

Two similarly-shaped functions exist; the names are distinct on purpose.

| Import                                      | Behaviour                                        | Used by           |
| ------------------------------------------- | ------------------------------------------------ | ----------------- |
| `getServerQueryClient` from `@/trpc/server` | Request-scoped via React `cache`                 | Server components |
| `getQueryClient` from `@/trpc/client`       | Browser singleton; fresh instance per SSR render | Client components |

Likewise, `trpc` from `@/trpc/server` is the only proxy safe to prefetch with — the client
proxy's `queryFn` goes over HTTP without cookies. Importing the client proxy into a server
component fails loudly, because that module carries `"use client"`.

## B. Session hoist and `HydrateClient`

`src/app/(authenticated)/layout.tsx` seeds the session once and wraps the tree:

```tsx
await requireSession();
await ensureSession(getServerQueryClient());
return (
  <HydrateClient>
    {props.modal}
    {props.children}
  </HydrateClient>
);
```

`HydrateClient` carries no session responsibility of its own — it dehydrates whatever the
request-scoped client holds at the moment it renders.

`src/components/auth/session-hydration.tsx` is deleted, along with its eight call sites:
the seven module layouts under `orgs/[slug]/`, plus `user-settings/page.tsx` and
`@modal/(.)user-settings/page.tsx`.

Pages that prefetch nest their own `HydrateClient`. Nesting is additive and harmless. The
only cost is the session appearing twice in a prefetching page's payload, which is accepted
rather than filtered.

**Ordering constraint:** in RSC a layout's body executes before its page's body, so a
`HydrateClient` in a layout captures only what that layout prefetched. Page-level
prefetches require a `HydrateClient` in the page.

## C. Error handling

### 1. Fix `errorFormatter`

In `src/trpc/init.ts`, change `data: { ...shape, conflict }` to `data: { ...shape.data, conflict }`.
This restores `error.data.code === "FORBIDDEN"` on the client while preserving
`error.data.conflict`, which is read by `update-team.tsx`, `create-team.tsx`,
`create-person.tsx` and `update-person.tsx`.

### 2. `src/components/errors/app-error.tsx` — new (client)

Exports three things:

- `ErrorDescription` — `{ title, description, pose }`, where `pose` is an `ArtiePose`.
- `ErrorDescriptions` — the fixed descriptions for `Forbidden`, `NotFound` and
  `Unauthorized`, so the server boundaries and the client mapper share one copy of the wording.
- `describeError(error)` — maps a _client-side_ error to an `ErrorDescription`.
- `AppErrorPanel({ title, description, pose })` — the `Empty`/`Artie` panel that
  `app/error.tsx` renders today.

`describeError` handles `TRPCClientError` only, keyed off `data.code` (`FORBIDDEN`,
`NOT_FOUND`, `UNAUTHORIZED`). It deliberately does **not** test for `ForbiddenError`: per
prior finding 4, that check is unreachable on the client. Everything else falls back to
`error.name` + `error.message`, as today.

`ArtiePose` in `src/components/art/artie.tsx` is currently declared but not exported; it
needs exporting.

### 3. Server-side interrupts

Enable `experimental.authInterrupts` in `next.config.ts`. `assertPermission` in
`src/server/organization-access.ts` calls `forbidden()` from `next/navigation` instead of
throwing `ForbiddenError`, so the failure reaches a real boundary rather than a stripped
error object.

`src/app/forbidden.tsx` renders `<AppErrorPanel {...ErrorDescriptions.Forbidden}/>`, giving
the server path the same panel the client path produces.

`requireSession` is left alone — it already redirects to sign-in with a return path, which
is better UX than `unauthorized()`. That interrupt is not adopted.

`ForbiddenError` in `src/lib/errors.ts` becomes unused once `assertPermission` stops
throwing it; delete it.

### 4. Error boundaries

`src/app/error.tsx` becomes a thin wrapper around `<AppError/>` (which calls `describeError`
then renders `AppErrorPanel`). A new `src/app/(authenticated)/orgs/[slug]/error.tsx` renders
the same component, so a failure inside a module does not replace the whole page shell.

## D. Pilot

### New procedure

Add `getTeam` to `src/trpc/routers/teams-router.ts` in alphabetical position, wrapping the
existing private `getTeam` helper (line 763). `personnel.getPerson`,
`personnel.getLinkedUser` and `skills.getSession` already exist.

### Conversions

Each pilot route ends up as two files: `page.tsx` (server — resolves params, calls
`requireOrganization`, prefetches, returns `<HydrateClient><Content/></HydrateClient>`) and
`content.tsx` (client — the existing render body, reading via `useSuspenseQuery`).

| Page                                | Change                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `admin/teams/[team_id]`             | Server body split out to `content.tsx` as a client component; `page.tsx` prefetches `teams.getTeam`                 |
| `admin/personnel/[person_id]`       | Existing client `page.tsx` renamed to `content.tsx`; new server `page.tsx` prefetches `getPerson` + `getLinkedUser` |
| `skill-track/sessions/[session_id]` | Server body split out to `content.tsx` as a client component; `page.tsx` prefetches `skills.getSession`             |

Each `generateMetadata` switches to `getServerQueryClient().fetchQuery(…)` on the same
query options the page prefetches, so the two collapse into a single read.

Note that metadata now runs a permission-checked procedure and can therefore throw. This is
intentional: the resulting error renders through the same shared component as the layout's
`ForbiddenError`.

### Deletions

- `src/server/person.ts`, `src/server/team.ts`, `src/server/skill-check-session.ts`
- The now-dead `revalidatePerson` / `revalidateTeam` / `revalidateSkillCheckSession` calls
  in `personnel-router.ts`, `teams-router.ts` and `skills-router.ts`
- `vi.mock("@/server/person", …)` in `users-router.test.ts`

The `"use cache"` + `cacheTag` layer these modules provided is dropped. React Query's
`staleTime` and the request-scoped query client are the replacement.

## E. Testing

- `describeError` is pure — unit tests for each recognised code and the fallback. Build
  fixtures with `TRPCClientError.from({ error: { message, code: -32603, data: { code } } })`,
  which is verified to produce `error.data.code === "FORBIDDEN"`.
- `errorFormatter` — a test asserting both `data.code === "FORBIDDEN"` and that
  `data.conflict` survives.
- `src/trpc/server.tsx` is not unit-testable under jsdom: it imports `server-only`, and
  React `cache` has no meaningful behaviour outside a request scope. `getServerQueryClient`'s
  request-scoping is verified by the pilot pages — specifically, that a query prefetched in
  `page.tsx` arrives hydrated in `content.tsx` with no client refetch.

## Out of scope

- Converting the other ~70 pages. They keep working unchanged; convert opportunistically.
- Normalising tRPC errors at the client link. Rejected in favour of the shared component.
- Restoring a `"use cache"` layer for tRPC procedures.
- Adopting `unauthorized()` / `unauthorized.tsx`. `requireSession`'s sign-in redirect is
  better UX and stays.

## Risks

- `experimental.authInterrupts` is an unstable Next flag. If it is removed or changes
  shape, `assertPermission` reverts to throwing and the server path degrades to the generic
  production message — the status quo, not a regression.
