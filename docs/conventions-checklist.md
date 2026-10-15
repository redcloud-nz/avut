# Conventions checklist

These are AVUT's house rules that ESLint doesn't enforce. A generic review catches bugs and bad patterns that any TypeScript or Next.js reviewer would flag. It won't catch these, because none of them are wrong in general, only wrong _here_. Examples: a tRPC procedure list out of alphabetical order, a missing `ctx.logEvent`, a `Promise.all` where a `$transaction` was needed, or a hand-built `/orgs/${slug}/...` string where `route()` was required.

The checklist has two uses:

- **When writing code:** check the sections your change touches before you start.
- **When reviewing a diff:** apply it alongside a normal correctness review. That's the `avut-code-reviewer` agent, `/avut-review-pr`, or an ad-hoc review. Report only what the diff touches or introduces, and name the rule, the `file:line` and the concrete fix. Skip sections that don't apply without comment.

This file tracks the checks. The reasoning lives in `AGENTS.md` and the `docs/patterns/` docs it links to.

## Enforced by ESLint — don't re-check

CI fails on `npm run lint` errors, so skip these; the rule message explains any fix (rules are in `eslint.config.mjs`):

- ID creation via `<Model>Id.create()`; Zod import form and v3 string formats; `@/trpc/client` in a Next entry file without `"use client"`
- `import "server-only"` in every `src/server` module, and the layering (`src/lib` is the leaf, server never imports UI, `client`/`hooks` import server code as types only, Prisma singleton only in `src/server` and `src/trpc/init.ts`)
- Hand-written `logEntry` writes
- Also: Resend, `process.env`, `auth.api`, `authClient.useSession`, deep relative imports, en-NZ spelling

Check only that an added `eslint-disable` for one of these has a genuine exemption and a stated reason.

## tRPC routers (`src/trpc/routers/`)

- **Alphabetical order.** Procedures within a router file must stay alphabetically sorted by name. A new procedure inserted in call-flow order (e.g. `create` grouped next to `update` instead of before `delete`) is a violation even if nothing else is wrong. Check the position of any added/renamed procedure against its neighbors.
- **Right procedure type.** `organizationProcedure(...)` for anything org-scoped (it injects `organizationId` and checks permissions), `authenticatedProcedure` for user-scoped-but-not-org work, `publicProcedure` only for genuinely unauthenticated endpoints. A new mutation/query using `publicProcedure` should almost always be one of the other two — treat it as a finding unless there's a clear reason (e.g. a webhook or the sign-in flow).
- **Permissions object matches the action.** `organizationProcedure({ person: ["update"] })` must name the resource/action actually being mutated or queried, not a copy-pasted neighbor's permissions. Cross-check the permission keys in `src/lib/permissions.ts` against what the procedure body actually does — a `create` that only asserts `["update"]`, or an update to `team` gated on `person` permissions, is a bug worth flagging.
- **`ctx.logEvent(...)` after state changes.** Every mutation that creates, updates, or deletes an org record should call `ctx.logEvent(...)` after the write. A new mutation missing this call is a finding; check whether it's a genuine state-changing operation first (a query, or a mutation that only reads and returns data, doesn't need it).
- **A write paired with `ctx.logEvent(...)` uses `ctx.prisma.$transaction([...])`, never `Promise.all([...])` or two bare sequential `await`s.** See [`docs/patterns/transactional-writes.md`](patterns/transactional-writes.md) for the shape and its two gotchas (non-Prisma operations — a Next.js cache revalidation, a better-auth API call — can't join the `$transaction` array and must run sequentially outside it). `Promise.all` here is a real bug, not a style nit: the write and the log start concurrently with no dependency, so a rejected write can still leave behind a log entry claiming it succeeded.
- **New router registered.** A brand-new router file must be added to `src/trpc/routers/_app.ts`, or its procedures are unreachable.

## D4H integration

D4H is optional per-organization — no org is guaranteed to have an access token configured.

- **Handles the no-token case.** Any code path that depends on a D4H access token must branch on its absence (skip the feature, show empty state, etc.) rather than assuming it exists. A new component or procedure that calls into D4H without checking for a token first is a finding.
- **Cache directives on cached fetches.** D4H fetches that are cached should use the Next.js 16 `"use cache"` directive with `cacheLife` + `cacheTag`, not ad-hoc memoization.
- **Resource shapes validated.** Data read from the D4H API should be validated against a Zod schema in `src/lib/schemas/d4h/`, not consumed as untyped/unvalidated JSON.

## IDs

Lint catches ID imports but not an ID built without one:

- Check any `.create({ data: { id: ... } })` for a new model — not a Prisma default or string concatenation.
- Branded IDs, in tests too (lint exempts them), come from the type's `.create()` (`PersonId.create()`), not a cast (`as PersonId`) — a cast bypasses whatever the factory enforces.

## Zod schemas

- Lint covers only Zod's import form and v3 string formats. Watch for other v3-era patterns copied from an older file or from training data (e.g. `.errors` where Zod 4 has `.issues`, `message:` where it has `error:`).
- Placement: a schema used by both client and server belongs in `src/lib/schemas/`; a schema that only makes sense server-side (e.g. touching a `D4HAccessToken_ServerOnly`-shaped value) belongs under `src/server/`. A shared-looking schema added under `src/server/` (or vice versa) is worth double-checking against where it's actually imported from.

## Routes and internal links

- **Dynamic segments use `route()`.** Any internal link or redirect to a route with a `[param]` segment must go through `route()` from `src/lib/routes.ts`, not a hand-built template string (`` `/orgs/${slug}/admin` `` for a _static_ route is fine; `` `/orgs/${slug}/admin/personnel/${id}` `` is not — that has a dynamic segment and should be `route("/orgs/[slug]/admin/personnel/[person_id]", { slug, person_id: id })`).
- **Pattern matches the filesystem.** The first argument to `route()` must match the actual path under `src/app/` (minus route-group segments like `(authenticated)`) — this is normally caught by TypeScript, so if it compiles it's fine, but flag any place a route pattern was manually typed as a plain string in a context where TS wouldn't verify it (e.g. inside a template literal built up from `route()`'s output).
- **`npx next typegen` after a new page.** If the diff adds a new `page.tsx`, the PR should show typegen has been run (types compile) — a broken `route()` call to a route that "should" exist but doesn't typecheck is the tell that this was skipped.

## Generated files

- `src/generated/` (the Prisma client and `dmmf.ts`) is gitignored — it's produced by `prisma generate`. If a diff includes files under it, they were force-added: flag it, and the real change belongs in `prisma/schema.prisma`.

## Server/client data fetching

The authoritative walkthrough (code + rationale) is [`docs/patterns/detail-page-data-fetching.md`](patterns/detail-page-data-fetching.md) and [`docs/patterns/mutation-dialog.md`](patterns/mutation-dialog.md) — read the relevant one fresh rather than relying on a summary here, since this file only tracks the checks, not the reasoning. What to verify against the diff:

- **Server Components import `trpc` from `@/trpc/server`.** Lint catches `@/trpc/client` only in Next entry files (`page`, `layout`, `route`, …). A non-entry file without `"use client"` that imports `@/trpc/client` is a finding: its query goes out over HTTP without the request's session.
- **`fetchQuery` vs `prefetch`.** `fetchQuery` (awaited, throws Next interrupts on `TRPCError`) is for when the Server Component needs the value itself (metadata title, a not-found/forbidden decision). `prefetch` (fire-and-forget, wrapped in `<HydrateClient>`) is for warming the cache ahead of a Client Component's `useSuspenseQuery`. Absence of `prefetch`/`HydrateClient` isn't itself a finding (it's opportunistic) — but a page that `fetchQuery`s for metadata and _also_ cold-fetches the same data client-side is double-fetching; worth a note.
- **`useSuspenseQuery`, not `useQuery` + manual loading/error state.** Loading/error handling is structural here (ambient `Suspense` in `Std.SidebarInset`/`Std.ScrollContainer`, route-level `error.tsx`/`not-found.tsx`) — a component adding its own spinner or error branch is a deviation, not a style choice.
- **Every mutation sets `meta: { effects: ... }`** sourced from a `src/client/<domain>-effects.ts` file. A `useMutation(...)` with no `meta.effects` and no manual `queryClient` call in `onSuccess` is a real bug (stale data everywhere else that reads it until reload/`staleTime` expiry), not a nit — check that a new mutation either has effects wired up or reuses an existing one that already covers it.

## UI structure

- Page layout should be built from the existing block system (`Std`, `Saratoga`, `Kaga`, `Argus` in `src/components/blocks/`) rather than reimplementing shell/header/table chrome by hand. A new list or detail page that hand-rolls its own header/actions row instead of `Saratoga.Header`/`Saratoga.Actions`, or a new data table built directly on `@tanstack/react-table` instead of `Kaga`, is worth a note — check whether there's a reason it can't fit the existing pattern before flagging it as a must-fix.
- Client-side permission gating uses `<Protect permissions={{...}}>` (`src/components/protect.tsx`), not an ad-hoc `if (role === "admin")` check scattered in JSX — see AGENTS.md's Permissions section for the signature. An inline role/permission check gating rendered UI is a finding — it duplicates logic that `<Protect>` centralizes and is easy to get out of sync with the server-side permission the same action actually requires.
- **`Protect` usage must comply with [`docs/patterns/protect-permission-gating.md`](patterns/protect-permission-gating.md)** — read it fresh for the full rationale and examples. The two things to check against every `<Protect>` the diff touches:
  1. Its `permissions` match what the mutation it guards actually requires — trace the wrapped element's `onClick`/`onSubmit` to the `useMutation(...)` it calls, then compare against that procedure's `organizationProcedure({...})` gate. Fewer/looser permissions on the `Protect` side than the procedure requires is the dangerous direction (a control the server will reject). Watch especially for one `Protect` wrapping several menu items that call _different_ mutations — it can only check one permission for all of them.
  2. Every permission-gated `DropdownMenuItem` uses the per-item `render` form, disabling rather than hiding — never `children`/`fallback`, and never one `Protect` wrapping multiple items. This is a hard rule for menus regardless of whether the permissions themselves are correct.
- New modules (a new top-level feature area under `/orgs/[slug]/...`) should be registered in `src/lib/modules.ts` rather than having their routes/labels/icons hardcoded elsewhere — check `src/lib/modules.ts` was updated if the diff adds a genuinely new module rather than a page within an existing one.

## Tests

- New tests seed a single shared dataset in `beforeAll` inside the outer `describe` and assert against slices of it, reserving `beforeEach` for cases that genuinely need isolated/mutated state per test. A test file that reseeds the same fixtures in every `beforeEach` for no isolation reason is worth a simplification note (this is a `simplify`/style concern, not a correctness one).
- Router tests call procedures via `router.createCaller(ctx)` with `createAuthenticatedMockContext(...)`, not by mocking tRPC's HTTP layer.
- Tests don't import `@/server/auth` or `@/server/prisma` (they build the real clients) — use `createMockPrisma()`; routers don't import `@/server/auth` (lint already blocks the Prisma client). Other `src/server` modules are fine in tests. See `.claude/rules/testing.md`.
