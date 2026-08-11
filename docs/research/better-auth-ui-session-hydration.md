# Research: `better-auth-ui` session hydration — `ensureSession`, `useAuth`, `useAuthenticate`

Investigation of how `better-auth-ui` models the current session: the `ensureSession` family of query helpers, the `useAuth` config context, the `useAuthenticate` route guard, and the server→client hydration path — to inform how avut should handle session state.

**Method**: created a throwaway worktree, then `npm pack`'d `@better-auth-ui/react@1.6.44` and `@better-auth-ui/core@1.6.44` into a scratchpad. Both tarballs ship full `src/` alongside `dist/`, so everything below is read from real source, not decompiled bundles. Docs and example wiring were read from `github.com/better-auth-ui/better-auth-ui` (`apps/docs/content/docs/`, `examples/next-shadcn-example/`). Nothing was installed into avut's `package.json`.

**Relevant source layout** (`@better-auth-ui/react`):

```
src/queries/auth/session-query.ts          # sessionOptions, ensureSession, prefetchSession, fetchSession, useSession
src/server/queries/auth/session-query.ts   # same four, server-auth flavour (exported from "@better-auth-ui/react/server")
src/hooks/auth/use-authenticate.ts         # useAuthenticate
src/hooks/auth/use-user.ts                 # useUser
src/components/auth/auth-provider.tsx      # AuthProvider + useAuth
src/components/mutation-invalidator.tsx    # global mutation→invalidation bridge
src/mutations/auth/sign-out-mutation.ts    # useSignOut (cache teardown)
```

and `@better-auth-ui/core`:

```
src/lib/auth-query-keys.ts                 # authQueryKeys
src/lib/auth-query-retry.ts                # retry policy + fetch plugin
```

The headline: there is **no bespoke session store**. The entire thing is TanStack Query with one shared query key, and both the server and the browser write to that same key.

---

## 1. The shared query key is the whole trick

`@better-auth-ui/core` exports a hierarchical key factory:

```ts
export const authQueryKeys = {
  all: ["auth"] as const,
  session: ["auth", "getSession"] as const,
  users: () => [...authQueryKeys.all, "user"] as const,
  user: (userId) => [...authQueryKeys.users(), userId] as const,
  listAccounts: (userId, query) => [...authQueryKeys.user(userId), "listAccounts", query ?? null],
  // listSessions, accountInfo, …
};
```

Everything nests under `["auth"]`, and every per-user read nests under `["auth","user",userId]`, so `invalidateQueries({ queryKey: authQueryKeys.user(id) })` sweeps one account's entire cache subtree. Plugin packages (organization, passkey, api-key, multi-session) chain their own key factories off `authQueryKeys.user(userId)` rather than inventing sibling roots.

The key lives in `core` — not in `react` — specifically so the framework packages _and_ the server-side query factory can all produce cache entries that line up. That is the mechanism the whole hydration story rests on.

## 2. `sessionOptions` / `ensureSession` — client flavour

`src/queries/auth/session-query.ts`:

```ts
export function sessionOptions<TAuthClient extends AuthClient>(authClient, params?) {
  return queryOptions({
    queryKey: authQueryKeys.session,
    queryFn: ({ signal }) =>
      authClient.getSession({
        ...params,
        fetchOptions: createAuthQueryFetchOptions(params?.fetchOptions, signal),
      }),
  });
}

export const ensureSession = (queryClient, authClient, params?) =>
  queryClient.ensureQueryData(sessionOptions(authClient, params));

export const prefetchSession = (queryClient, authClient, params?) =>
  queryClient.prefetchQuery(sessionOptions(authClient, params));

export const fetchSession = (queryClient, authClient, params?) =>
  queryClient.fetchQuery(sessionOptions(authClient, params));
```

That's it — the three helpers are one-liners over `ensureQueryData` / `prefetchQuery` / `fetchQuery`. The library's contribution is not the helpers, it's the _shared key_ plus the fetch-options wrapper. Semantics, per the docs table:

| Helper            | Behaviour                                                                       |
| ----------------- | ------------------------------------------------------------------------------- |
| `ensureSession`   | Return cached data if present, else fetch. Resolves with data. Throws on error. |
| `prefetchSession` | Fire-and-forget warm-up. Never throws, returns nothing.                         |
| `fetchSession`    | Respects `staleTime` but refetches when stale. Resolves with data, throws.      |

`createAuthQueryFetchOptions` (core, `auth-query-retry.ts`) does three things to every session fetch: threads React Query's `AbortSignal` through to better-fetch, sets `throw: true` so a failed call rejects instead of returning `{ data, error }`, and installs a small better-fetch plugin that reads `Retry-After` / `X-Retry-After` off the response and re-throws an error carrying `retryAfterMs`.

`useSession` is `useQuery(sessionOptions(...))` with the better-auth params (`query`, `fetchOptions`) split out of the React Query options, so one options object takes both:

```ts
useSession(authClient, { query: { disableCookieCache: true }, staleTime: 30_000 });
```

`useUser` is a two-line wrapper returning `session.user` as `data`.

## 3. `sessionOptions` / `ensureSession` — server flavour

`@better-auth-ui/react/server` exports a parallel set that takes the better-auth **server** instance instead of a browser client:

```ts
export function sessionOptions<TAuth extends AuthServer>(auth, params) {
  return queryOptions({
    queryKey: authQueryKeys.session, // ← identical key
    queryFn: () => auth.api.getSession(params),
  });
}

export const ensureSession = (queryClient, auth, params) =>
  queryClient.ensureQueryData(sessionOptions(auth, params));
```

Same name, same key, different `queryFn` — `auth.api.getSession({ headers })` directly, no HTTP hop back into your own app. `AuthServer` is typed as just `Pick<Auth, "api">`, so the server helpers depend on a deliberately narrow slice of the better-auth server instance.

The server entrypoint is types-and-queries only (`export type * from "./lib/auth-server"` plus the query modules) — no React, no `"use client"`, safe to import from a server component.

## 4. `useAuth` — config context, not session state

`useAuth` is **not** a session hook. It reads the merged `AuthConfig` out of `AuthContext` and throws if there's no provider:

```ts
export function useAuth(): AuthConfig {
  const context = useContext(AuthContext);
  if (!context) throw new Error("[Better Auth UI] AuthProvider is required");
  return context;
}
```

The config carries `authClient`, `navigate`, `basePaths`, `viewPaths`, `redirectTo`, `plugins`, `localization`, `additionalFields`, `Link`, etc. In practice its most-used job is handing you `authClient` so you can pass it to `useSession(authClient)` — the hooks are all explicitly client-parameterised rather than pulling the client from context implicitly.

`AuthProvider` itself does four notable things (`auth-provider.tsx`):

1. **Deep-merges** user config over `defaultAuthConfig`.
2. Redefines `redirectTo` as a **getter** via `Object.defineProperty`, so every read re-parses `?redirectTo=` off the _current_ URL and falls back to the configured value. Config that re-evaluates on access rather than on render.
3. **QueryClient resolution order**: explicit `queryClient` prop → `useContext(QueryClientContext)` → a module-level `fallbackQueryClient` (`staleTime: 5000`). So it works standalone but transparently adopts your app's client when wrapped in `QueryClientProvider`. It then calls `setQueryDefaults(authQueryKeys.all, authQueryRetryOptions)` inside a `useMemo`, with a comment noting this must land before descendants render since queries resolve defaults during render.
4. Renders `<MutationInvalidator />` as a sibling of children.

The retry defaults it installs are worth copying wholesale:

```ts
const RETRYABLE_AUTH_QUERY_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

shouldRetryAuthQuery = (failureCount, error) =>
  failureCount < 3 && (status === undefined || RETRYABLE.has(status));

authQueryRetryDelay = (failureCount, error) =>
  error.retryAfterMs ?? Math.min(1000 * 2 ** failureCount, 30_000);

retry: (n, e) => !isServer() && shouldRetryAuthQuery(n, e);
```

`status === undefined` means network-level failure → retryable. 401/403 are **not** retryable, so an unauthenticated response fails fast. Retries are disabled entirely on the server, so SSR never sits in a backoff loop.

`MutationInvalidator` is a neat pattern: rather than every mutation hook wiring its own `onSuccess`, it monkey-patches `mutationCache.config.onSuccess` once (chaining any previous handler, restoring it on unmount), matches the mutation against `authMutationKeys.all`, then reads `meta.invalidates` / `meta.awaits` off the mutation and invalidates those keys — `awaits` being returned so React Query keeps the mutation pending until the refetch settles. Mutations therefore declare their cache side effects **declaratively in `meta`**.

## 5. Server → client hydration

There is no custom serialization channel. It is exactly the canonical Next.js App Router React Query pattern, and it works _only_ because §1 and §3 give the server and client the same key.

The pieces:

**`lib/query-client.ts`** — new client per server request, singleton in the browser, `staleTime: 5000`:

```ts
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 5000 } } });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
```

**`components/providers.tsx`** — `QueryClientProvider` _outside_ `AuthProvider`, so `AuthProvider` adopts the app client (§4 step 3) instead of its fallback.

**A server component** — `ensureSession` into a per-request client, then ship the dehydrated cache:

```tsx
export default async function Dashboard() {
  const queryClient = getQueryClient();
  const session = await ensureSession(queryClient, auth, { headers: await headers() });

  if (!session) redirect("/auth/sign-in?redirectTo=/dashboard");

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1>Hello, {session.user.email}</h1>
    </HydrationBoundary>
  );
}
```

Downstream client components calling `useSession(authClient)` hit the hydrated `["auth","getSession"]` entry and render synchronously — no pending state, no auth flash, no duplicate fetch. The `staleTime: 5000` is what stops the client refetching immediately on mount.

The `Header` example shows the corollary the docs are explicit about: hydration is **per-subtree**. A `UserButton` in a layout header sits outside the page's `HydrationBoundary`, so it needs its own `ensureSession` + `HydrationBoundary` in its own server parent, or it fetches from scratch on mount.

The dehydrated state crosses the server/client boundary as a **prop from a Server Component to a Client Component**, so it travels via React's RSC flight serializer — which handles `Date` natively. That's why better-auth's `Date`-bearing session survives the trip with no superjson-style transformer, despite `dehydrate()` output looking JSON-ish.

## 6. `useAuthenticate` and sessions that go away

The entire hook is 40 lines:

```ts
export function useAuthenticate(authClient, options?) {
  const { basePaths, viewPaths, navigate } = useAuth();
  const session = useSession(authClient, options);

  useEffect(() => {
    if (session.data || session.isPending) return;

    const currentURL = window.location.pathname + window.location.search;
    const redirectTo = encodeURIComponent(currentURL);
    navigate({
      to: `${basePaths.auth}/${viewPaths.auth.signIn}?redirectTo=${redirectTo}`,
      replace: true,
    });
  }, [basePaths.auth, session.data, session.isPending, viewPaths.auth.signIn, navigate]);

  return session;
}
```

It returns the full query result, so callers still get `isPending` / `error` and typically render a spinner while `!session`.

**How the session going away is actually detected.** Nothing polls and nothing subscribes to the cookie. `useSession` is a plain `useQuery`, so the standard TanStack triggers are the detection mechanism:

- **`refetchOnWindowFocus`** (default `true`) — the dominant one. Tab away, session expires server-side, tab back → refetch → `getSession` returns `null` → `data` flips to `null` → effect fires → redirect.
- **`refetchOnReconnect`** — network returns.
- **Mount / stale-time expiry** on navigation.
- **Explicit invalidation** — `invalidateQueries({ queryKey: authQueryKeys.session })`, which is what `MutationInvalidator` triggers when a mutation declares the session key in `meta.invalidates`.

So "reactive" here means _reactive at the granularity of React Query's refetch triggers_, not real-time. The docs are honest about the split: an async server component gives you first-paint protection with no flash but can't react after load; `useAuthenticate` gives you reactivity after load but can't prevent a flash on a prerendered route. The recommendation is to use both on SSR routes and `useAuthenticate` alone on prerendered/client-only routes.

**Three sharp edges in the redirect condition** (`!session.data && !session.isPending`):

1. **Errors redirect too.** `isPending` is `status === "pending"`; an errored query is `status === "error"` with `data === undefined`, so it satisfies the condition. After retries are exhausted, a _network_ failure — not an auth failure — bounces the user to sign-in. The 3-retry/exponential-backoff policy from §4 softens this, and network errors _are_ retryable (`status === undefined`), but the terminal behaviour is still "redirect to sign-in".
2. **Keep-previous-data changes the meaning.** On a background refetch React Query holds the old `data`, so a refetch that returns `null` flips `data` to `null` in the same tick the redirect fires — that's the intended path. But it also means a _transient_ failure during a background refetch leaves `data` intact and no redirect fires, which is the desired behaviour and is worth not accidentally breaking with `select` or `placeholderData`.
3. **Sign-out is a separate mechanism.** `useSignOut` doesn't invalidate — it calls `queryClient.removeQueries({ queryKey: authQueryKeys.all })` on success, dropping every auth cache entry so nothing leaks across accounts. The comment in source is explicit that `removeQueries` is chosen over the `meta.invalidates` pattern because the goal is eviction, not refetch. Removal makes `useAuthenticate` see `data === undefined` and `isPending === true` (a fresh fetch starts), so the redirect is driven by the sign-out flow's own navigation, not by the hook.

---

## Comparison to avut, and what's worth taking

avut is a Next.js App Router + TanStack Query app already, so §5 maps onto it almost directly. Current state:

**Three session mechanisms coexist, and the dominant one isn't React Query at all.**

The most-used path is better-auth's own `authClient.useSession()` — a nanostores atom with its own cache, its own fetch, and no relationship to the React Query cache. Five call sites: [user-menu.tsx:39](src/components/nav/user-menu.tsx#L39), [sign-out.tsx:14](src/components/auth/sign-out.tsx#L14), [user-account-settings.tsx:15](src/components/user-settings/user-account-settings.tsx#L15), [user-organizations-settings.tsx:41](src/components/user-settings/user-organizations-settings.tsx#L41), [admin/users/[user_id]/page.tsx:48](<src/app/(authenticated)/orgs/[slug]/admin/users/[user_id]/page.tsx#L48>).

This is the deciding fact for everything below. **`better-auth-ui` deliberately does not use `authClient.useSession()`** — it reimplements session reads on TanStack Query precisely so the session participates in the same cache as everything else: invalidatable by key, dehydratable for SSR, subject to a shared retry policy, and evictable on sign-out. That's the actual architectural choice on offer here, and it's an either/or. Half-adopting it — leaving five components on the nanostore while a sixth reads React Query — means two independent caches of the same session that go stale independently, which is roughly avut's current state.

**Plus two competing React Query definitions, same key, different shapes.**

- [src/client/auth-queries.ts](src/client/auth-queries.ts) — `authQueries.session`, key `["auth","session"]`, `queryFn` returns the **whole `{ data, error }` envelope** (`getSession({ fetchOptions: { throw: true } })` still resolves to `{ data }`). Used in exactly one place: [issue-items/[instance_id]/page.tsx:299](<src/app/(authenticated)/orgs/[slug]/i3/forms/issue-items/[instance_id]/page.tsx#L299>).
- [src/client/auth-client.ts:26-36](src/client/auth-client.ts#L26-L36) — `sessionQueryOptions`, **same key** `["auth","session"]`, but `queryFn` unwraps and returns `data`, with `staleTime: 5 * 60 * 1000`. **Dead code** — zero references.

Two options factories writing the same cache key with different result shapes is a latent bug: whichever mounts second reads the other's data under its own type. Deleting the dead one is the fix; the surviving one should unwrap (`return data`), because everything downstream wants the session, not the envelope.

**No SSR hydration of the session at all.** avut resolves sessions server-side per page via `auth.api.getSession({ headers })` (e.g. [src/server/entry-control.ts:39](src/server/entry-control.ts#L39)) and passes the result down as props. That's fine and arguably simpler, but it means any client component that wants the session either takes a prop-drilled copy or fires its own `getSession` fetch on mount. There's no shared cache entry bridging the two.

**A hydration gotcha specific to avut.** [src/trpc/query-client.ts:20-22](src/trpc/query-client.ts#L20-L22) sets:

```ts
shouldDehydrateQuery: (query) =>
    defaultShouldDehydrateQuery(query) && query.state.status === "pending",
```

That is the tRPC streaming-prefetch idiom — only _in-flight_ queries are dehydrated, so the client picks up the promise and streams. If you copy better-auth-ui's pattern verbatim (`await ensureSession(...)` → the query is `success` → `dehydrate(queryClient)`), **the session entry is silently dropped** and the client refetches anyway. Adopting the pattern requires widening that predicate to `|| query.state.status === "success"`. avut also runs superjson through `serializeData`/`deserializeData`, which handles `Date` fine — so the RSC-serializer point in §5 is moot here, but the predicate is not.

**Recommendations, in priority order:**

0. **Decide the fork first: nanostore or React Query.** Everything else follows from it. Standardising on `authClient.useSession()` and deleting both query-options objects is the smaller change and is perfectly defensible — but it forecloses SSR hydration, key-based invalidation, and a shared retry policy. Standardising on React Query (better-auth-ui's choice) costs migrating five components but makes the session a first-class citizen of the cache avut already runs. I'd go React Query, because item 5 below is currently a real bug and it's only cleanly fixable on that side.
1. **Delete `sessionQueryOptions` from [auth-client.ts](src/client/auth-client.ts)** and make [auth-queries.ts](src/client/auth-queries.ts) the single definition, unwrapping to `data` and carrying an explicit `staleTime`. One key, one shape. Cheap, removes a real footgun regardless of how item 0 lands.
2. **Adopt the layered key factory** — `["auth"]` root, `["auth","session"]`, `["auth","user",userId,…]` — even if avut only has one auth query today. It costs nothing now and makes "blow away everything for this user on sign-out" a one-liner later.
3. **Copy the retry policy** from `auth-query-retry.ts` onto the session query: don't retry 401/403, do retry 408/429/5xx and network errors, honour `Retry-After`, never retry on the server. avut currently inherits the React Query default of 3 blind retries, which means an unauthenticated user waits through three pointless round-trips.
4. **Steal `useAuthenticate` outright** — it's 40 lines and there's no reason to depend on the package for it. Worth deliberately deciding on sharp edge #1 above: avut may prefer `if (session.error) return;` before the redirect check, so a network blip doesn't eject a user mid-session. Given avut is an internal tool where offline blips are plausible, I'd add that guard.
5. **Clear the cache on sign-out.** [sign-out.tsx](src/components/auth/sign-out.tsx) currently does `authClient.signOut().then(() => router.push(...))` and clears **nothing** — not the React Query cache, not the tRPC caches. Since `getQueryClient()` returns a browser singleton that survives navigation, every org-scoped tRPC result from the previous account is still sitting in memory when the next user signs in on the same tab. This is the concrete bug that argues for item 0 landing on React Query: the fix is `queryClient.removeQueries({ queryKey: ["auth"] })` plus a broader `queryClient.clear()`, and there's no equivalent lever on the nanostore side.
6. **Session hydration via `HydrationBoundary` is optional and lower value here.** avut's prop-drilling from server components already avoids the auth flash on the pages that matter. Only pursue it if a client component genuinely needs live session reactivity (a user menu that must notice revocation) — and if so, fix the `shouldDehydrateQuery` predicate first.

**Not worth taking**: `AuthProvider`'s config-merging machinery, the `redirectTo` getter trick, and `MutationInvalidator` all exist to serve a configurable drop-in component library. avut owns its own components and its own tRPC invalidation conventions; that layer is solving a problem avut doesn't have.
