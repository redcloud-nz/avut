---
name: avut-conventions-review
description: Review AVUT code changes for compliance with this repo's own house conventions from AGENTS.md — tRPC router ordering and permissions, ctx.logEvent, transactional writes ($transaction vs Promise.all), D4H optionality and server-only boundaries, ID generation, Zod schema placement, route() usage, generated-file edits, server/client data-fetching boundaries (trpc/server vs trpc/client, prefetch+HydrateClient, useSuspenseQuery, mutation cache effects), and UI block/Protect usage. Use this whenever reviewing a diff, PR, or newly written code in this repo, especially after adding or changing a tRPC router, a D4H-backed feature, a new page/route, a mutation, or a server/client component pair — these are exactly the places generic bug-hunting reviews miss because the rules are specific to AVUT, not to Next.js or TypeScript in general. Complements (doesn't replace) a general correctness/simplification review.
---

# AVUT Conventions Review

A generic code review catches bugs and bad patterns any TypeScript/Next.js reviewer would flag. It won't catch a tRPC procedure list going out of alphabetical order, a missing `ctx.logEvent`, a D4H import leaking into a client component, or a hand-built `/orgs/${slug}/...` string where `route()` was required — because none of those are wrong in general, only wrong *here*. This skill is the checklist for that second pass: the rules that only make sense with AGENTS.md conventions in hand.

Use it after (or alongside) a normal correctness review — run through the checks below against the actual diff, not the whole file, and only report what the diff touches or introduces.

## tRPC routers (`src/trpc/routers/`)

- **Alphabetical order.** Procedures within a router file must stay alphabetically sorted by name. A new procedure inserted in call-flow order (e.g. `create` grouped next to `update` instead of before `delete`) is a violation even if nothing else is wrong. Check the position of any added/renamed procedure against its neighbors.
- **Right procedure type.** `organizationProcedure(...)` for anything org-scoped (it injects `organizationId` and checks permissions), `authenticatedProcedure` for user-scoped-but-not-org work, `publicProcedure` only for genuinely unauthenticated endpoints. A new mutation/query using `publicProcedure` should almost always be one of the other two — treat it as a finding unless there's a clear reason (e.g. a webhook or the sign-in flow).
- **Permissions object matches the action.** `organizationProcedure({ person: ["update"] })` must name the resource/action actually being mutated or queried, not a copy-pasted neighbor's permissions. Cross-check the permission keys in `src/lib/permissions.ts` against what the procedure body actually does — a `create` that only asserts `["update"]`, or an update to `team` gated on `person` permissions, is a bug worth flagging.
- **`ctx.logEvent(...)` after state changes.** Every mutation that creates, updates, or deletes an org record should call `ctx.logEvent(...)` after the write. A new mutation missing this call is a finding; check whether it's a genuine state-changing operation first (a query, or a mutation that only reads and returns data, doesn't need it).
- **A write paired with `ctx.logEvent(...)` uses `ctx.prisma.$transaction([...])`, never `Promise.all([...])` or two bare sequential `await`s.** See [`docs/patterns/transactional-writes.md`](../../../docs/patterns/transactional-writes.md) for the shape and its two gotchas (non-Prisma operations — a Next.js cache revalidation, a better-auth API call — can't join the `$transaction` array and must run sequentially outside it). `Promise.all` here is a real bug, not a style nit: the write and the log start concurrently with no dependency, so a rejected write can still leave behind a log entry claiming it succeeded.
- **New router registered.** A brand-new router file must be added to `src/trpc/routers/_app.ts`, or its procedures are unreachable.

## D4H integration

D4H is optional per-organization — no org is guaranteed to have an access token configured.

- **Handles the no-token case.** Any code path that depends on a D4H access token must branch on its absence (skip the feature, show empty state, etc.) rather than assuming it exists. A new component or procedure that calls into D4H without checking for a token first is a finding.
- **Server-only boundary.** `getD4HFetchClient` (`src/server/d4h-api/client.ts`) and anything that takes a `D4HAccessToken_ServerOnly` must never be imported into a client component (`"use client"` files, or anything under a client component's import graph). This is a hard rule, not a style preference — flag it even if it currently "works," since it's a build-time/bundle boundary violation waiting to surface.
- **Cache directives on cached fetches.** D4H fetches that are cached should use the Next.js 16 `"use cache"` directive with `cacheLife` + `cacheTag`, not ad-hoc memoization.
- **Resource shapes validated.** Data read from the D4H API should be validated against a Zod schema in `src/lib/schemas/d4h/`, not consumed as untyped/unvalidated JSON.

## IDs

- New record IDs must come from `nanoId16()` (`src/lib/id.ts`) — not `crypto.randomUUID()`, not a Prisma default, not string concatenation. Check any `.create({ data: { id: ... } })` call for a new model.
- Branded ID types in tests come from their type's `.create()` factory (`PersonId.create()`, `TeamId.create()`, etc.), not a cast (`as PersonId`) — a cast bypasses whatever the factory enforces and is worth flagging in test code too.

## Zod schemas

- Zod 4 syntax throughout (`.parse`/`.safeParse`, `z.object({...})`) — watch for stale v3-era patterns copied from an older file or from training data.
- Placement: a schema used by both client and server belongs in `src/lib/schemas/`; a schema that only makes sense server-side (e.g. touching a `D4HAccessToken_ServerOnly`-shaped value) belongs under `src/server/`. A shared-looking schema added under `src/server/` (or vice versa) is worth double-checking against where it's actually imported from.

## Routes and internal links

- **Dynamic segments use `route()`.** Any internal link or redirect to a route with a `[param]` segment must go through `route()` from `src/lib/routes.ts`, not a hand-built template string (`` `/orgs/${slug}/admin` `` for a *static* route is fine; `` `/orgs/${slug}/admin/personnel/${id}` `` is not — that has a dynamic segment and should be `route("/orgs/[slug]/admin/personnel/[person_id]", { slug, person_id: id })`).
- **Pattern matches the filesystem.** The first argument to `route()` must match the actual path under `src/app/` (minus route-group segments like `(authenticated)`) — this is normally caught by TypeScript, so if it compiles it's fine, but flag any place a route pattern was manually typed as a plain string in a context where TS wouldn't verify it (e.g. inside a template literal built up from `route()`'s output).
- **`npx next typegen` after a new page.** If the diff adds a new `page.tsx`, the PR should show typegen has been run (types compile) — a broken `route()` call to a route that "should" exist but doesn't typecheck is the tell that this was skipped.

## Generated files

- `src/generated/prisma/` and `src/generated/dmmf.ts` must never be hand-edited. If a diff touches either, the real fix is a Prisma schema change followed by `npx prisma generate` (or `npm run prisma migrate dev`) — flag any direct edit as a finding regardless of how small it looks, and check that a schema change that should have regenerated these actually did.

## Server-only boundaries

- `@/server/auth`, `@/server/prisma`, and anything importing them are server-only. They must never be imported directly in test files (tests use `createMockPrisma()` / `createAuthenticatedMockContext` instead) or in a way that would pull them into a client bundle. `@/trpc/init.ts` is the one safe exception (it uses `import type` for these).
- A test file importing from `@/server/*` directly, rather than through the test helpers in `src/test/`, will fail in the jsdom test environment — this is usually a correctness bug, not just a style issue, so treat it as one.

## Server/client data fetching

The authoritative walkthrough (code + rationale) is [`docs/patterns/detail-page-data-fetching.md`](../../../docs/patterns/detail-page-data-fetching.md), [`docs/patterns/non-destructive-mutation-dialog.md`](../../../docs/patterns/non-destructive-mutation-dialog.md), and [`docs/patterns/destructive-mutation-dialog.md`](../../../docs/patterns/destructive-mutation-dialog.md) — read the relevant one fresh rather than relying on a summary here, since this file only tracks the checks, not the reasoning. What to verify against the diff:

- **Caller boundary.** A Server Component (`page.tsx`, `layout.tsx`, etc.) must import `trpc` from `@/trpc/server`, never `@/trpc/client` — the latter's `queryFn` goes over HTTP and arrives unauthenticated. Check the import path whenever a server file calls `trpc.<router>.<procedure>`.
- **`fetchQuery` vs `prefetch`.** `fetchQuery` (awaited, throws Next interrupts on `TRPCError`) is for when the Server Component needs the value itself (metadata title, a not-found/forbidden decision). `prefetch` (fire-and-forget, wrapped in `<HydrateClient>`) is for warming the cache ahead of a Client Component's `useSuspenseQuery`. Absence of `prefetch`/`HydrateClient` isn't itself a finding (it's opportunistic) — but a page that `fetchQuery`s for metadata and *also* cold-fetches the same data client-side is double-fetching; worth a note.
- **`useSuspenseQuery`, not `useQuery` + manual loading/error state.** Loading/error handling is structural here (ambient `Suspense` in `Std.SidebarInset`/`Std.ScrollContainer`, route-level `error.tsx`/`not-found.tsx`) — a component adding its own spinner or error branch is a deviation, not a style choice.
- **Every mutation sets `meta: { effects: ... }`** sourced from a `src/client/<domain>-effects.ts` file. A `useMutation(...)` with no `meta.effects` and no manual `queryClient` call in `onSuccess` is a real bug (stale data everywhere else that reads it until reload/`staleTime` expiry), not a nit — check that a new mutation either has effects wired up or reuses an existing one that already covers it.

## UI structure

- Page layout should be built from the existing block system (`Std`, `Saratoga`, `Kaga`, `Argus` in `src/components/blocks/`) rather than reimplementing shell/header/table chrome by hand. A new list or detail page that hand-rolls its own header/actions row instead of `Saratoga.Header`/`Saratoga.Actions`, or a new data table built directly on `@tanstack/react-table` instead of `Kaga`, is worth a note — check whether there's a reason it can't fit the existing pattern before flagging it as a must-fix.
- Client-side permission gating uses `<Protect permissions={{...}}>` (`src/components/protect.tsx`), not an ad-hoc `if (role === "admin")` check scattered in JSX — see AGENTS.md's Permissions section for the signature. An inline role/permission check gating rendered UI is a finding — it duplicates logic that `<Protect>` centralizes and is easy to get out of sync with the server-side permission the same action actually requires.
- **`Protect` usage must comply with [`docs/patterns/protect-permission-gating.md`](../../../docs/patterns/protect-permission-gating.md)** — read it fresh for the full rationale and examples. The two things to check against every `<Protect>` the diff touches:
  1. Its `permissions` match what the mutation it guards actually requires — trace the wrapped element's `onClick`/`onSubmit` to the `useMutation(...)` it calls, then compare against that procedure's `organizationProcedure({...})` gate. Fewer/looser permissions on the `Protect` side than the procedure requires is the dangerous direction (a control the server will reject). Watch especially for one `Protect` wrapping several menu items that call *different* mutations — it can only check one permission for all of them.
  2. Every permission-gated `DropdownMenuItem` uses the per-item `render` form, disabling rather than hiding — never `children`/`fallback`, and never one `Protect` wrapping multiple items. This is a hard rule for menus regardless of whether the permissions themselves are correct.
- New modules (a new top-level feature area under `/orgs/[slug]/...`) should be registered in `src/lib/modules.ts` rather than having their routes/labels/icons hardcoded elsewhere — check `src/lib/modules.ts` was updated if the diff adds a genuinely new module rather than a page within an existing one.

## Tests

- New tests seed a single shared dataset in `beforeAll` inside the outer `describe` and assert against slices of it, reserving `beforeEach` for cases that genuinely need isolated/mutated state per test. A test file that reseeds the same fixtures in every `beforeEach` for no isolation reason is worth a simplification note (this is a `simplify`/style concern, not a correctness one).
- Router tests call procedures via `router.createCaller(ctx)` with `createAuthenticatedMockContext(...)`, not by mocking tRPC's HTTP layer.

## Reporting findings

Keep findings scoped to what the diff actually touches or introduces — this skill is not a license to relitigate unrelated pre-existing code. For each finding, name the specific rule from above, the file/line, and what the fix looks like (e.g. "move `create` above `delete` to restore alphabetical order" rather than just "not alphabetical"). If a convention doesn't apply to this diff at all (no D4H code touched, no new tRPC router, etc.), skip that section silently rather than noting "N/A" for everything.
