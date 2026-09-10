# Console CLI

**Date:** 2026-09-09

## Idea

Promote the existing dev-only `window.avut` helper into a curated, flag-gated
browser-console CLI that ships in all environments. A thin convenience layer over
the existing `authClient` and the already-exported vanilla tRPC client — no new
server surface. The goal of a first pass is to experiment with the _ergonomics_
of driving the app from the console, not broad API coverage.

Primary interaction model: curated namespaces whose query helpers return
**handles** — the plain record plus non-enumerable methods — so lookups compose
into actions:

```js
(await avut.person.find("John"))?.open();
(await avut.person.list()).filter((p) => !p.email).forEach((p) => p.open());
```

A `Person` is not a `User` here (people are org records, users are auth
accounts). Impersonation acts on a user id, so there is no `person.impersonate()`
— `session.impersonateUser({ userId })` stays the only impersonation path.

## Notes

Current state:

- [`src/client/dev-tools.ts`](../../src/client/dev-tools.ts) exports
  `installDevTools()`, binding a flat `window.avut` with `signIn` / `signOut` /
  `impersonateUser` / `stopImpersonating` / `getSession`. Each mutating call does
  a full navigation to guarantee no identity-scoped cache lingers.
- Installed from [`src/components/providers.tsx`](../../src/components/providers.tsx)
  in a `useEffect`, gated on `process.env.NODE_ENV !== "production"`.
- Feature flags use `flags/next` with `@flags-sdk/vercel`, declared in
  [`src/lib/flags.ts`](../../src/lib/flags.ts), evaluated server-side. Root
  [`src/app/layout.tsx`](../../src/app/layout.tsx) is an async server component
  rendering `CommonProviders` — the seam to evaluate a flag and pass it to the
  client provider as a prop.
- A vanilla tRPC client is exported as `trpcClient` from
  [`src/trpc/client.ts`](../../src/trpc/client.ts).

Decisions from earlier brainstorming:

| Question            | Decision                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interface           | The literal DevTools console, documented `window.avut` API. Richer in-app UI possible later, out of scope now.                                              |
| Capability          | Read-mostly conveniences over existing tRPC queries + auth. No new procedures.                                                                              |
| Org context         | Inferred from the URL (`/orgs/[slug]/…`); no explicit `avut.use()`.                                                                                         |
| API surface         | Hand-curated namespaces only. Raw `avut.trpc` proxy deferred.                                                                                               |
| Production exposure | Real feature flag (`console-cli`), `defaultValue: false`.                                                                                                   |
| Navigation          | `session.*` keeps hard navigation. Everything else uses client-side navigation that preserves caches, exposed as methods on handles, not a `nav` namespace. |

Sketched architecture:

- **Rename** `src/client/dev-tools.ts` → `src/client/console.ts` (no longer
  dev-only). Single module, plain object literal assembled in one
  `installConsole()`; revisit `src/client/console/*` split past ~10 namespaces.
- Public shape: `help()`, `session.{signIn,signOut,impersonateUser,stopImpersonating,whoami}`,
  `person.{find,list}`, `team.{find,list}`. `find`/`list` are async (they call
  tRPC), so `avut.person.find("John")?.open()` reads
  `(await avut.person.find("John"))?.open()`; `help()` shows the `await` form.
- Handles: the plain record with methods attached non-enumerably via
  `Object.defineProperties`, so `console.log` prints clean data and
  `JSON.stringify` / destructuring see only fields. `open()` resolves the slug
  from the URL, builds the route with `route()`, and calls a stashed
  `window.__avutRouter.push(path)` (client-side nav, caches preserved); throws if
  the router is not installed.
- Org context: private `currentOrgSlug()` matches `^/orgs/([^/]+)` against the
  pathname; `requireOrgSlug()` throws a fix-naming message when null. Org-scoped
  helpers resolve slug → `organizationId` client-side via
  `authClient.organization.list()`, memoized per slug, then pass
  `{ organizationId }` into the underlying `organizationProcedure` query (which
  still enforces permissions server-side).
- `list()` → all people/teams for the current org via the existing list query,
  mapped through a handle factory. `find(query)` → case-insensitive substring
  match against display name (email as fallback), first match or `undefined` —
  deliberately loose.
- Flag wiring: new `consoleCliFlag` (`key: "console-cli"`, `defaultValue: false`)
  in `src/lib/flags.ts`; `layout.tsx` awaits it and passes `enableConsole` to
  `CommonProviders`, which uses it in place of the `NODE_ENV` check and also
  stashes the Next router in the same effect.
- Tests (`src/client/console.test.ts`, jsdom): `currentOrgSlug` parsing; handle
  field enumerability + `JSON.stringify` round-trip; `handle.open()` against a
  mock router; `person.find` filter semantics; slug → id resolution; idempotent
  `installConsole()`.
- User docs (`docs/console-cli.md`): what it is, how to enable
  (`vercel flags enable console-cli --environment <env>`), namespace reference,
  the `await` gotcha, worked examples.

Out of scope / deferred: raw `avut.trpc` proxy over every procedure; mutations
beyond impersonation; an in-app command bar / terminal UI; `avut.use(slug)`
explicit org override; per-namespace module split.
