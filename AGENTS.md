# AVUT — Assorted Vaguely Useful Tools

A Next.js web application providing organizational management tools with optional D4H platform integration.

## Stack

- **Framework**: Next.js 16, App Router, React 19, TypeScript
- **Database**: PostgreSQL via Prisma 7 (generated client in `src/generated/prisma/` — never edit manually)
- **API layer**: tRPC 11 with React Query 5 — standard data-fetching pattern
- **Auth**: better-auth with organization plugin
- **UI**: Tailwind CSS 4, shadcn/ui primitives, lucide-react icons, radix-ui
- **Forms**: react-hook-form + zod 4
- **D4H API**: openapi-fetch with a generated OpenAPI schema (`src/server/d4h-api/schema.d.ts`)
- **Package manager**: npm

## Project Structure

```
src/
  app/                        # Next.js App Router pages
    (authenticated)/orgs/[slug]/   # Org-scoped pages (admin, i3, skill-track, notes, …)
    (authenticated)/user-settings/ # Account settings (not org-scoped)
    (public)/policies/        # Privacy / terms pages (no auth)
    api/                      # API routes (auth)
    trpc/[trpc]/              # tRPC HTTP handler
  client/                     # Browser-side auth client + query helpers
  components/
    blocks/                   # Named high-level layout blocks (see below)
    ui/                       # shadcn/ui primitives + custom UI (see ui/README.md for a catalogue)
    nav/                      # Navigation components
  emails/                     # React Email templates (preview: npm run dev-email)
  forms/                      # Form definitions for the forms/i3 flows
  hooks/                      # Shared React hooks (use-organization, use-person, …)
  lib/
    collections/              # TanStack DB collection factories (experimental)
    schemas/                  # Zod schemas used across client and server (incl. schemas/d4h/)
    modules.ts                # Single source of truth for org modules (ids, labels, routes)
    permissions.ts            # Role definitions and permission statements
    routes.ts                 # route() helper for dynamic typed routes
  server/                     # Server-only utilities (auth, prisma, etc.)
    d4h-api/                  # D4H API client + generated OpenAPI schema
  test/                       # Test helpers (create-prisma-mock, trpc-helpers, setup)
  trpc/
    init.ts                   # tRPC init, context, procedure factories
    routers/                  # One file per domain router
    routers/_app.ts           # Root app router
  generated/prisma/           # Auto-generated Prisma client — DO NOT EDIT
  proxy.ts                    # Request proxy / middleware entry
```

All org-scoped pages, module or not, live under `/orgs/[slug]/…`.

---

# Workflow

How to operate in this repo — commands, tooling gotchas, and git.

## Commands

```bash
npm run dev                  # Start dev server (with Node inspector)
npm run dev-email            # React Email preview server (src/emails, port 3001)
npm run build                # Run migrations + build
npm run lint                 # ESLint
npm run lint:fix             # ESLint with --fix
npm run test                 # Vitest (watch mode)
npm run test:run             # Vitest (single run)
npx tsc --noEmit             # Type check
npx next typegen             # Regenerate typed routes — required after adding a page

# Prisma (always uses .env.local)
npm run prisma migrate dev   # Create and apply migration
npm run prisma studio        # Open Prisma Studio
```

- After adding a new `page.tsx`, run `npx next typegen` — the dev server does not regenerate route types on its own, so `route()` calls for the new path will fail to typecheck until you do
- If `npx tsc --noEmit` fails with `.next/types/routes` "Cannot find module" errors unrelated to your change, `.next/types` is just stale/missing (e.g. no dev server has run recently) — run `npx next typegen` to regenerate before investigating further
- If `npx tsc --noEmit` fails inside `.next/types/validator.ts` with `LayoutRoutes`/`Route` mismatches between `.next/types/routes` and `.next/dev/types/routes`, the running dev server's `.next/dev/types` is stale against the current branch's routes — `rm -rf .next/dev/types && npx next typegen`. Common when checking out branches that add or remove `page.tsx`/route groups.
- Formatting is handled by a husky + lint-staged pre-commit hook running `prettier --write`; don't hand-format for style

## Database

There is **one** shared PostgreSQL dev database, reached through `.env.local`, and every checkout and worktree points at it. A schema or data change from one place is seen everywhere.

- **Never run a command that mutates the database without explicit permission each time.** That covers, at least: `npm run prisma migrate dev` / `migrate deploy` / `migrate reset` / `db push`, `npm run prisma db execute`, `npm run seed:demo`, and `npm run build` (its first step is `prisma migrate deploy`). When one of these is the right next step, stop and ask.
- Read-only Prisma commands are fine unprompted: `npm run prisma studio`, `prisma generate`, `prisma migrate status`, `prisma validate`.
- Editing `prisma/schema.prisma` and running `npx prisma generate` (regenerates the client only, no DB contact) is fine; turning that into a migration is not — ask first.

## Git

- When you judge it's a good point to commit, stage the relevant changes and commit them without asking, then show the commit message you used.
- Never `git push`, open a PR, or otherwise publish commits without explicit approval — committing locally is fine, sharing is not.

## Worktrees

- All git worktrees go under `.claude/worktrees/<name>` inside the repo (gitignored). Don't create them as siblings of the repo or anywhere else — a single location keeps `git worktree list` and cleanup predictable.
- Remove a worktree with `git worktree remove` when done; run `git worktree prune` if a directory was deleted by hand.

### Setting up a fresh worktree

The scanning tools (`tsc`, `eslint`, `vitest`) already skip `.claude/worktrees/`, so a worktree doesn't disturb the main checkout. But a new worktree is missing every gitignored file, so from the worktree root:

```bash
ln -s ../../../.env.local .env.local     # shared env — needed by prisma, build, seed, dev server
ln -s ../../../.vercel .vercel            # only if using the Vercel CLI / skills
npm install                              # node_modules is gitignored; also required for the pre-commit hook. Runs `prisma generate` via postinstall
npx next typegen                          # .next/ is per-worktree; typed routes won't resolve without this
```

- If the worktree's branch changed `prisma/schema.prisma`, also run `npx prisma generate` (the committed `src/generated/` may be stale).
- Run the dev server on its own port — `npm run dev -- -p 3100` — so it doesn't collide with a dev server in the main checkout (3000, and 3001 for `dev-email`).
- The database is shared (see **Database** above) — a worktree on a schema branch must not run migrations without permission.
- `.claude/settings.local.json` (personal permission allowlist) is not copied; expect more permission prompts until you re-add entries.

---

# Codebase Conventions

How the code is written. Read the linked pattern doc before writing a new page or mutation rather than inferring the pattern from a neighbouring file.

## tRPC Routers

- One file per domain in `src/trpc/routers/`
- Register new routers in `src/trpc/routers/_app.ts`
- Procedures within each router must be kept in alphabetical order
- Use `organizationProcedure()` for org-scoped mutations/queries — it injects `organizationId` into input and checks permissions automatically
- Use `authenticatedProcedure` for user-scoped procedures
- Use `publicProcedure` only for truly unauthenticated endpoints
- Always call `ctx.logEvent(...)` after state-changing operations on records — org-scoped, user-scoped, or system-wide
- Pair a write with `ctx.logEvent(...)` inside `ctx.prisma.$transaction([...])`, not `Promise.all([...])` — see [`docs/patterns/transactional-writes.md`](docs/patterns/transactional-writes.md) for the shape and its gotchas (non-Prisma operations can't join the array)
- Never write `prisma.logEntry.create` by hand. Every entry goes through a `ctx.logEvent`, which delegates to `recordLogEntry` in `src/server/log-entry.ts` — the one place the write-time invariants and the closed vocabularies are enforced

## Audit logging — which `logEvent` am I holding?

All three procedure factories put a `logEvent` on `ctx`, and they differ only in which log the entry lands in. Each returns the un-awaited `PrismaPromise`, so all three compose into `$transaction([...])`.

| Procedure                | `ctx.logEvent` writes                                           | Extra options                                                    |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `organizationProcedure`  | `scope: "organization"`, the org from the procedure's own input | none — the org is not a parameter                                |
| `authenticatedProcedure` | `scope: "user"`, owned by the **calling** user                  | none — the owner is not a parameter                              |
| `systemAdminProcedure`   | whichever of the three the call chooses                         | exactly one of `organizationId`, `ownerId`, or `scope: "system"` |

A system admin acts outside any one organization, so its `logEvent` takes the target:

```ts
ctx.logEvent({ organizationId, action: "Create", objectType: "Organization", objectId });
ctx.logEvent({
  ownerId: input.userId,
  action: "Update",
  objectType: "User",
  objectId: input.userId,
});
ctx.logEvent({ scope: "system", action: "Delete", objectType: "User", objectId: input.userId });
```

The union forces exactly one. Which one to pick:

- **`organizationId`** — the action changed something inside that organization.
- **`ownerId`** — the action belongs on that user's own account timeline. `log_entries.ownerId` is `onDelete: Cascade`, so the entry dies with the user. Never use this arm for an action that deletes the user it names: the entry would be cascaded away inside the very transaction that wrote it.
- **`scope: "system"`** — no organization, no owner, so no FK for anything to cascade through. This is the arm for an action that must outlive its subject (`deleteUser`). The subject survives only as `objectId` plus whatever the `description` denormalizes, so put the name/email in the description.

**`LogBatch` and the `Operations` registry.** A multi-entry operation opens a `LogBatch` with `createLogBatch` (`src/server/log-entry.ts`) and passes the resulting `batch.id` as `batchId` on each of its entries, correlating them. `operationKey` must be a key of the `Operations` registry (`src/lib/operations.ts`) — that registry is the closed vocabulary, and `createLogBatch` rejects anything off it.

A batch correlates **independently meaningful events** — ones that would each belong, on their own, on their own entity's timeline. It is not for grouping the row-writes of a single event. A D4H team import creating people and memberships earns an entry per person, so it is a batch; a reorder writing a `sequence` integer across five rows is one event whose five-ness is an implementation detail, so it is one entry.

A batch also supplies provenance for an unattended run: `recordLogEntry` allows a null `actor` only alongside a `batchId`, so an entry with no human behind it is still traceable to the operation that produced it.

## Data Fetching

AVUT has two distinct tRPC entry points — `trpc` from `@/trpc/server` (Server Components: calls the router in-process, preserving the request's session) and `trpc` from `@/trpc/client` (Client Components: goes out over HTTP). Never use the `@/trpc/client` one in a Server Component — its `queryFn` arrives unauthenticated.

Mutations declare their cache side-effects once via `meta: { effects: ... }` (`src/trpc/mutation-effector.tsx`), not with manual `queryClient.setQueryData`/`invalidateQueries` calls at each call site.

See the pattern docs for the full shapes, code, and rationale — read the relevant one before writing a new page or mutation dialog rather than inferring the pattern from a neighboring file, since these are exactly the details easy to get subtly wrong (and where they've drifted before):

- [`docs/patterns/detail-page-data-fetching.md`](docs/patterns/detail-page-data-fetching.md) — `page.tsx`/`<entity>-content.tsx` split, `fetchQuery` vs `prefetch`+`HydrateClient`, `useSuspenseQuery`
- [`docs/patterns/mutation-dialog.md`](docs/patterns/mutation-dialog.md) — create/update/delete/confirm dialogs driven by a `?action=` search param via nuqs (`NuqsAdapter`, `useQueryState` + `parseAsStringLiteral`, `history` push-on-open/replace-on-close, controlled `…_Dialog` components)

## Permissions

Defined in `src/lib/permissions.ts`. Roles: `owner`, `admin`, `member`, `i3-editor`, `skills-assessor`, `skill-package-author`.

**Server-side** (tRPC): pass a permissions object to `organizationProcedure`:

```ts
organizationProcedure({ person: ["create", "update"] });
```

**Client-side**: use `<Protect>` from `@/components/protect` to conditionally render UI based on the current user's permissions. It reads the current org's roles from `useOrganization()` itself, so it takes no `orgId` prop. It renders `children` if the user has all required permissions, or `fallback` (default: `null`) otherwise:

```tsx
import { Protect } from "@/components/protect";

<Protect permissions={{ skillCheckSession: ["update"] }}>
    <Button>Approve</Button>
</Protect>

// With a fallback
<Protect permissions={{ person: ["delete"] }} fallback={<DisabledButton />}>
    <DeleteButton />
</Protect>
```

For cases where the permission boolean needs to flow into the markup (e.g. disabling rather than hiding a control), pass `render` instead of `children`/`fallback`:

```tsx
<Protect
  permissions={{ person: ["delete"] }}
  render={(hasPermission) => <DeleteButton disabled={!hasPermission} />}
/>
```

Inside a dropdown/menu of actions, and for verifying a given `<Protect>`'s `permissions` actually match the mutation it guards, see [`docs/patterns/protect-permission-gating.md`](docs/patterns/protect-permission-gating.md).

## Zod Schemas

- Domain schemas live in `src/lib/schemas/`
- Use Zod 4 syntax (`.parse`, `.safeParse`, `z.object`, etc.)
- Schemas shared between client and server go in `src/lib/schemas/`; server-only in `src/server/`

## IDs

Use `nanoId16()` from `src/lib/id.ts` for new record IDs.

## D4H Integration

- D4H is an optional feature — code that depends on a D4H access token must handle the case where none is configured
- D4H API client: `src/server/d4h-api/client.ts` — use `getD4HFetchClient(token)` (note the capital `H`)
- The client is server-only; it takes a `D4HAccessToken_ServerOnly`. Never import it from a client component
- Cached D4H fetches use the standard Next.js 16 `"use cache"` directive with `cacheLife` + `cacheTag`
- D4H resource schemas validated with Zod live in `src/lib/schemas/d4h/`

## Internal URLs

Next.js typed routes are enabled, so static route strings are type-checked automatically. Use `route()` from `src/lib/routes.ts` only when a route has dynamic segments — it substitutes `[param]` placeholders and returns a typed `Route` string.

```ts
import { route } from "@/lib/routes";

// Static route — plain string is fine
href = "/orgs/acme/admin";

// Dynamic route — use route() to substitute params
route("/orgs/[slug]/admin", { slug: organization.slug });
route("/orgs/[slug]/admin/personnel/[person_id]", { slug, person_id: id });
```

- Route patterns must match the actual file-system path under `src/app/` (minus route group segments like `(authenticated)`)
- The params object is fully typed — TypeScript will error if a required param is missing or the route pattern doesn't exist
- Routes are auto-discovered from the filesystem — no manual registration needed. New `page.tsx` files become valid route patterns automatically after the next dev server start or build

## Testing

Vitest with jsdom environment. Tests live alongside source files; the include glob is `**/*.{test,spec}.{ts,tsx}`.

### In-memory Prisma

Tests use `prisma-mock` (not `prismock` — that library is unmaintained and incompatible with Prisma 7). A thin wrapper in `src/test/create-prisma-mock.ts` hides the messy Prisma 7 API:

```ts
import { createMockPrisma } from "@/test/create-prisma-mock";

const db = createMockPrisma(); // fresh in-memory PrismaClient
```

`prisma-mock` requires schema metadata at runtime. A generator in `prisma/schema.prisma` outputs `src/generated/dmmf.ts` — never edit it manually; regenerate with `npx prisma generate` after schema changes.

### tRPC router tests

Use `router.createCaller(ctx)` to call procedures directly. Build the context with `createAuthenticatedMockContext` from `src/test/trpc-helpers.ts`:

```ts
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";
import { myRouter } from "./my-router";

const ctx = createAuthenticatedMockContext({
  user: { id: nanoId16() }, // required
  permissions: { thing: ["create"] }, // defaults to {}
  prisma: db, // required — inject the mock db
});
const caller = myRouter.createCaller(ctx);
```

**Fixture IDs**: use the `.create()` factory on branded ID types instead of casting — `PersonId.create()`, `TeamId.create()`, `SkillId.create()`, etc. Use plain `nanoId16()` only for unbranded string IDs.

**Dataset structure**: seed a single shared dataset in `beforeAll` scoped inside the outer `describe`, then write each test as an assertion about the correct slice of that data. Only use `beforeEach` seeding when tests genuinely need isolated state.

```ts
describe("myRouter.someQuery", () => {
    const T = { org: OrganizationId.create(), person1: PersonId.create(), ... };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({ data: { id: T.org, ... } });
        // seed all fixtures once
    });

    function makeCaller() {
        return myRouter.createCaller(createAuthenticatedMockContext({ ..., prisma: db }));
    }

    it("returns ...", async () => { ... });
});
```

**`server-only` constraint**: `@/server/auth`, `@/server/prisma`, and anything that imports them will throw in the jsdom test environment. Never import them in test files or router files. `@/trpc/init.ts` is safe because it uses `import type` for server-only deps.

## UI Block Components

Reusable layout systems in `src/components/blocks/`:

| Block      | Purpose                                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Std`      | Outer page shell — `Std.SidebarInset`, `Std.Navbar` (breadcrumbs), `Std.ScrollContainer`, `Std.IndexPage`, `Std.Breadcrumbs`                                                                                            |
| `Saratoga` | Content layout within the shell — `Saratoga.Root`, `Saratoga.Header`, `Saratoga.Title`, `Saratoga.Actions`, `Saratoga.Columns`/`.Column`                                                                                |
| `Kaga`     | Data table system wrapping TanStack Table — `Kaga.Table`, `Kaga.TableToolbar`, `Kaga.TablePagination`, `Kaga.defineColumns`, `Kaga.filterFns`                                                                           |
| `Argus`    | Centered card layout for auth/form pages                                                                                                                                                                                |
| `Eagle`    | JSON diff/parse comparison display (used in dev/import tooling)                                                                                                                                                         |
| `Glorious` | Full-height matrix table — `Glorious.Root`, `Glorious.Header`/`.Title`/`.Subtitle`/`.Actions`, `Glorious.ScrollFrame`, `Glorious.Table`, `Glorious.TableHeader`, `Glorious.GroupSection` (collapsible sticky `<tbody>`) |

Typical page layout — shell in `page.tsx`, content in the client component:

```tsx
// page.tsx
<Std.SidebarInset>
    <Std.Navbar breadcrumbs={[...]} />
    <Std.ScrollContainer>
        <ClientComponent />
    </Std.ScrollContainer>
</Std.SidebarInset>

// client component — list page
<Saratoga.Root>
    <Saratoga.Header>
        <Saratoga.Title>Title</Saratoga.Title>
        <Saratoga.Actions>{/* buttons */}</Saratoga.Actions>
    </Saratoga.Header>
    <div>
        <Kaga.TableToolbar table={table} />
        <Kaga.Table table={table} />
        <Kaga.TablePagination table={table} />
    </div>
</Saratoga.Root>
```

For detail pages use `Saratoga.Columns` with `<Saratoga.Column slot="main">` and `slot="secondary"` (2/3 + 1/3 responsive grid). Index pages (nav-list only, no client component) wrap their content in `Std.IndexPage`, which supplies its own logo/title header — `title` is a **required** prop.

`Saratoga.Root` is a fixed `max-w-5xl`; it has no width variants. Constrain narrower content with `className` on a case-by-case basis.

## Modules (per org)

`src/lib/modules.ts` is the single source of truth — module ids, labels, icons, route segments, and hrefs all come from the `Modules` registry there. Update it when adding a module; don't hardcode module paths elsewhere.

| `ModuleId`              | Path                                 | Description                                                      |
| ----------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `admin`                 | `/orgs/[slug]/admin`                 | Org management — users, teams, personnel, invitations. Always on |
| `d4h-views`             | `/orgs/[slug]/d4h-views`             | Read-only views of D4H data                                      |
| `forms`                 | —                                    | Vestigial — form machinery lives under the `i3` module           |
| `i3`                    | `/orgs/[slug]/i3`                    | Equipment issue/inspect/return (I3) & PPE templates              |
| `notes`                 | `/orgs/[slug]/notes`                 | Rich-text notes                                                  |
| `skill-track`           | `/orgs/[slug]/skill-track`           | Skill checks, sessions, catalogue, reports                       |
| `skill-package-builder` | `/orgs/[slug]/skill-package-builder` | Authoring skill packages                                         |

- A module's route segment can differ from its id — `skill-track` is the id _and_ segment, but don't assume they always match; read `segment` from the registry
- All modules except `admin` are gated by org settings (`OrganizationSettings.modules`, keyed by `ModuleId`); `admin` is `alwaysOn`
- Only modules with an `href` appear in the nav switcher and dashboard (`orgModules`), which is why `forms` is absent from those
- The `forms` id is inert: the public `/pub` form experiment was deleted, and the live form flows (`forms-router`, `src/forms/i3-issue-items/`, `form-processor`) are reached through `i3`. It's retained only because it's a settings-gated key
