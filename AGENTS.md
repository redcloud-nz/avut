# AVUT — Assorted Vaguely Useful Tools

A Next.js web application providing organizational management tools with optional D4H platform integration.

## Project Structure

All org-scoped pages, module or not, live under `/orgs/[slug]/…`.

`src/generated/` (the Prisma client and `dmmf.ts`) is generated and gitignored — never edit it manually. `npm install` regenerates it; after switching to a branch that changes `prisma/schema.prisma`, run `npx prisma generate` yourself or the client and mock metadata will be stale.

---

# Workflow

How to operate in this repo — commands, tooling gotchas, and git.

## Commands

```bash
npm run build                # Run migrations + build
npm run check                # tsc + eslint + related tests for what you changed, in one call (-- --all: what CI runs)
npm run lint                 # eslint . — CI fails on errors; enforces the rules marked (lint) below
npx next typegen             # Regenerate typed routes — required after adding a page

# Prisma (always uses .env.local) — see Database section before running migrations
npm run prisma migrate dev   # Create and apply migration
npm run prisma studio        # Open Prisma Studio
npm run db:branch <slug>     # Copy the dev DB for a migration-bearing branch (avut_<slug>)
npm run db:unbranch          # Point .env.local back at avut, drop the copy
```

- Verify with `npm run check` rather than separate `tsc`/`eslint`/`vitest` calls: it runs them together and prints output only for what fails. It runs `next typegen` when route files changed and regenerates stale route types itself, so the two tsc gotchas below are handled for you there. `npm run check -- --all` runs what CI runs
- After adding a new `page.tsx`, run `npx next typegen` — the dev server does not regenerate route types on its own, so `route()` calls for the new path will fail to typecheck until you do
- If `npx tsc --noEmit` fails with `.next/types/routes` "Cannot find module" errors unrelated to your change, `.next/types` is just stale/missing (e.g. no dev server has run recently) — run `npx next typegen` to regenerate before investigating further
- If `npx tsc --noEmit` fails inside `.next/types/validator.ts` with `LayoutRoutes`/`Route` mismatches between `.next/types/routes` and `.next/dev/types/routes`, the running dev server's `.next/dev/types` is stale against the current branch's routes — `rm -rf .next/dev/types && npx next typegen`. Common when checking out branches that add or remove `page.tsx`/route groups.
- Formatting is handled by a husky + lint-staged pre-commit hook running `prettier --write`; don't hand-format for style, run prettier by hand, or report that it ran (`npm run check` leaves it out too)

## Database

There is **one** shared PostgreSQL dev database (`avut`), reached through `.env.local`, and every checkout and worktree points at it by default. A schema or data change from one place is seen everywhere.

- **Never run a command that mutates the shared database without explicit permission each time.** That covers, at least: `npm run prisma migrate dev` / `migrate deploy` / `migrate reset` / `db push`, `npm run prisma db execute`, `npm run seed:demo`, and `npm run build` (its first step is `prisma migrate deploy`). When one of these is the right next step, stop and ask.
- Read-only Prisma commands are fine unprompted: `npm run prisma studio`, `prisma generate`, `prisma migrate status`, `prisma validate`.
- Editing `prisma/schema.prisma` and running `npx prisma generate` (regenerates the client only, no DB contact) is fine; turning that into a migration is not — ask first.

### Branching the database for a migration

A branch that only reads or runs the app should just use shared `avut`. **The moment a branch adds a Prisma migration, give it its own database copy first** — a branch's migration must never land on shared `avut`.

```bash
npm run db:branch <slug>     # CREATE DATABASE avut_<slug> TEMPLATE avut, repoint this checkout's .env.local
# ... restart the dev server, then (with permission) npm run prisma migrate dev
npm run db:unbranch          # point .env.local back at avut, offer to drop the copy — run when the branch merges
```

`db:branch` needs zero other connections to `avut` (the `TEMPLATE` copy is exclusive) — stop the dev server and Prisma Studio first; it refuses otherwise. It converts a symlinked `.env.local` to a copy so the branch DB config stays local to that checkout. Running `migrate dev` against a branch DB still needs permission, but it's an easy yes — the blast radius is one throwaway database.

## Outbound email

The dev database holds records for **real people with their real email addresses**, so anything that sends — inviting, resending an invitation, changing an email — is one click away from mailing a stranger.

`sendEmail` in `src/server/email.ts` is the single choke point every message passes through, and it fails closed: unless `VERCEL_ENV === "production"`, every `to`/`cc`/`bcc` is rewritten onto Resend's sink at `delivered+<encoded address>@resend.dev`, the subject is prefixed with the intended recipients, and they are repeated in an `X-AVUT-Intended-Recipients` header. The message still reaches Resend and still appears in its dashboard — it just never reaches a mailbox.

- Local development, `vercel dev`, and preview deployments all redirect. Only the production deployment delivers as addressed.
- `EMAIL_DELIVERY=live` forces real delivery (e.g. to test a preview against your own address) and `EMAIL_DELIVERY=redirect` mutes production. **Never set `EMAIL_DELIVERY=live` while pointed at the dev database.**
- Send mail only through `sendEmail` (lint) — calling the Resend client directly goes around the guard rail.

## Git

- When you judge it's a good point to commit, stage the relevant changes and commit them without asking, then show the commit message you used.
- Never `git push`, open a PR, or otherwise publish commits without explicit approval — committing locally is fine, sharing is not.
- Feature PRs merge to `integration` (the default branch). `production` is the release target — see [`docs/releasing.md`](docs/releasing.md) for how a version gets there, and [`docs/branch-protection.md`](docs/branch-protection.md) for the branch rules.

## Worktrees

- All git worktrees go under `.claude/worktrees/<name>` inside the repo (gitignored). Don't create them as siblings of the repo or anywhere else — a single location keeps `git worktree list` and cleanup predictable.
- Remove a worktree with `npm run worktree:remove <name>` — it drops the worktree's `db:branch` database copy first (a branch DB must never outlive its worktree), then runs `git worktree remove` + `prune`. Pass `git worktree remove` flags after `--` (e.g. `npm run worktree:remove <name> -- --force` when the tree has uncommitted changes). Plain `git worktree remove` still works but leaks the branch DB.
- If a worktree directory was deleted by hand, run `git worktree prune` — and `npm run db:unbranch` from wherever `.env.local` was last pointed, or `dropdb avut_<slug>` directly, to clean up its branch DB.
- Set up a fresh worktree with `npm run worktree:setup` (from inside it, or pass its name) — it copies `.env.local`, links `.vercel`, installs dependencies (on macOS by cloning the main checkout's `node_modules`, otherwise `npm ci`) and generates route types, and is safe to re-run — a re-run also regenerates the Prisma client, so use it after a schema change. It doesn't start a dev server: run one on its own port (`npm run dev -- -p 3100`; the main checkout uses 3000 and `dev-email` 3001), and ask first since the user may already have one up. `.claude/settings.local.json` (the personal permission allowlist) isn't copied, so expect more permission prompts until you re-add entries.

---

# Codebase Conventions

How the code is written. Read the linked pattern doc before writing a new page or mutation rather than inferring the pattern from a neighbouring file.

Design specs live in [`docs/specs/`](docs/specs/README.md). Every spec carries a `**Date:**` line in its header — see that README before adding one.

## tRPC Routers

Router conventions and the audit-logging guide (which `ctx.logEvent` you hold, `LogBatch`, the `Operations` registry) are in [`src/trpc/CLAUDE.md`](src/trpc/CLAUDE.md), loaded when working under `src/trpc/`. Domain-service conventions (the `src/server/services/<domain>.ts` layer routers call into) are in [`src/server/services/CLAUDE.md`](src/server/services/CLAUDE.md) instead. The rules that apply everywhere:

- Always call `ctx.logEvent(...)` after state-changing operations on records — org-scoped, user-scoped, or system-wide. Log rows are never written by hand (lint): every entry goes through `ctx.logEvent`, which delegates to `recordLogEntry` in `src/server/log-entry.ts`
- Pair a write with `ctx.logEvent(...)` inside `ctx.prisma.$transaction([...])`, not `Promise.all([...])` — see [`docs/patterns/transactional-writes.md`](docs/patterns/transactional-writes.md) for the shape and its gotchas (non-Prisma operations can't join the array)

## Data Fetching

AVUT has two distinct tRPC entry points — `trpc` from `@/trpc/server` (Server Components: calls the router in-process, preserving the request's session) and `trpc` from `@/trpc/client` (Client Components: goes out over HTTP, so its `queryFn` arrives unauthenticated on the server). Lint catches the wrong one in Next entry files (`page`, `layout`, `route`, …); any other Server Component is on you.

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
- Use Zod 4 — lint enforces `import * as z from "zod"` and the top-level string formats (`z.email()`, not `z.string().email()`); the rest of the Zod 3 → 4 changes are on you
- Schemas shared between client and server go in `src/lib/schemas/`; server-only in `src/server/`

## IDs

Create record IDs with `<Model>Id.create()` from the model's schema file in `src/lib/schemas/` (`PersonId.create()`, `TeamId.create()`, …). `nanoId16()` is only called inside those files (lint) — add an `Id` to the schema if a model lacks one.

## D4H Integration

- D4H is an optional feature — code that depends on a D4H access token must handle the case where none is configured
- D4H API client: `src/server/d4h-api/client.ts` — use `getD4HFetchClient(token)` (note the capital `H`)
- The client is server-only; it takes a `D4HAccessToken_ServerOnly`. It lives in `src/server`, whose modules must import `server-only` (lint), so a client import fails the build
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

Vitest with jsdom; tests live alongside source files. The conventions (prisma-mock, `createCaller` contexts, fixture IDs, dataset structure, which server modules to keep out of tests) are in [`.claude/rules/testing.md`](.claude/rules/testing.md), loaded when working on test files.

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

## Scope roots and modules

The app has three real scope roots, each with its own sidebar and module set: **organization** (`/orgs/[slug]/…`), **user** (`/user/…`, always available), and **system** (`/system/…`, gated on the Better Auth `admin` role). `ScopeSwitcher` (`src/components/nav/scope-switcher.tsx`) is the persistent control for jumping between them.

`src/lib/modules.ts` is the single source of truth for all three — module ids, labels, icons, route segments, and hrefs all come from the `Modules` registry there. Update it when adding a module; don't hardcode module paths elsewhere.

- A module's route segment can differ from its id — `skill-track` is the id _and_ segment, but don't assume they always match; read `segment` from the registry. The org-scoped `org-admin` and system-scoped `system-admin` modules both use segment `"admin"` — they don't collide because each scope's module lookup is scoped to its own `ModuleScope`
- Only org-scoped modules are gated by org settings (`OrganizationSettings.modules`, keyed by `OrganizationModuleId`); `org-admin` is `alwaysOn`, as are all user and system modules
- Only org modules with an `href` appear in the org nav switcher and dashboard (`orgModules`), which is why `forms` is absent from those
- The `forms` id is inert: the public `/pub` form experiment was deleted, and the live form flows (`forms-router`, `src/forms/i3-issue-items/`, `form-processor`) are reached through `i3`. It's retained only because it's a settings-gated key

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
