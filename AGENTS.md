# AVUT — Assorted Vaguely Useful Tools

A Next.js web application providing organizational management tools with optional D4H platform integration.

## Project Structure

All org-scoped pages, module or not, live under `/orgs/[slug]/…`.

### Modules

UI code private to one module lives in `src/modules/<module-id>/`: components in `components/`, other module-private code (hooks, helpers) in `lib/`. Create a subfolder only when something goes in it. Folders use `modules.ts` ids, not route segments (`org-admin` and `system-admin` both have segment `admin`). The one folder that isn't a registry id is `user-settings`, for the `/user/settings/*` pages.

- UI that more than one module uses lives in `src/components/` (the shared layer), never in either module. So do areas that aren't modules (`auth`, `invitations`, `docs`, `marketing`, the org dashboard).
- `src/components/teams/` holds the team record cards and dialogs that `org-admin` and `team-admin` share. It is distinct from `src/components/team/`, the team scope root's own UI.
- Schemas stay in `src/lib/schemas/`: they're per domain, not per module.
- A module never imports another module (lint). Outside `src/app`, which may import any module, only the sidebar-menu registry (`nav/{org,team,scope}-sidebar-modules.tsx`) and the docs demos (`docs/demo-*.tsx`) may import from `src/modules/`.
- No barrel `index.ts` files: import each file directly.

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
- A migration comes only from `npm run prisma migrate dev` against a `db:branch` copy, with permission. Never hand-write migration SQL or substitute `prisma migrate diff`. If local Postgres is down or unreachable, that's a fault: stop and tell the user, don't work around it.

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
- Issues in redcloud-nz/avut are the build backlog. Ideas and brainstorms not ready to build live in redcloud-nz/avut-ideas (`/avut-brainstorm` files there; `/avut-develop-feature` promotes one into an avut issue).
- `/avut-brainstorm`, `/avut-issue` and `/avut-status` are user-level skills (`~/.claude/skills/`), not in this repo, because they serve every repo in `avut-project`. The other `avut-*` skills live in `.claude/skills/`.
- Repo skills (`.claude/skills/`) depend on nothing outside the repo except those user-level `avut-*` skills. Personal setup (a notes vault, personal skills like `/pickup`, `/wrapup` or `/track`) may call into a repo skill and pass it what it needs, but a repo skill never reads paths or calls skills that only exist on one machine.
- Feature PRs merge to `integration` (the default branch). `production` is the release target — see [`docs/releasing.md`](docs/releasing.md) for how a version gets there, and [`docs/branch-protection.md`](docs/branch-protection.md) for the branch rules.

## Worktrees

- All git worktrees go under `.claude/worktrees/<name>` inside the repo (gitignored). Don't create them as siblings of the repo or anywhere else — a single location keeps `git worktree list` and cleanup predictable.
- Remove a worktree with `npm run worktree:remove <name>` — it drops the worktree's `db:branch` database copy first (a branch DB must never outlive its worktree), then runs `git worktree remove` + `prune`. Pass `git worktree remove` flags after `--` (e.g. `npm run worktree:remove <name> -- --force` when the tree has uncommitted changes). Plain `git worktree remove` still works but leaks the branch DB.
- If a worktree directory was deleted by hand, run `git worktree prune` — and `npm run db:unbranch` from wherever `.env.local` was last pointed, or `dropdb avut_<slug>` directly, to clean up its branch DB.
- Set up a fresh worktree with `npm run worktree:setup` (from inside it, or pass its name) — it copies `.env.local`, links `.vercel`, installs dependencies (on macOS by cloning the main checkout's `node_modules`, otherwise `npm ci`), generates route types and allocates the worktree's dev-server port (see [Dev servers](#dev-servers)), and is safe to re-run — a re-run also regenerates the Prisma client, so use it after a schema change. `.claude/settings.local.json` (the personal permission allowlist) isn't copied, so expect more permission prompts until you re-add entries.
- **"Run <skill> in worktree x"** (or `in:x` in a skill's arguments): if `.claude/worktrees/x` exists, enter it (`EnterWorktree` with `path`); otherwise create it (`EnterWorktree` with `name: "x"`, which branches from `origin/integration`) and run `npm run worktree:setup`. When the work is an existing branch, `git worktree add .claude/worktrees/x <branch>` first, then enter it. Then run the skill as usual: whatever it says about "the main checkout" or "the current checkout" means that worktree — its dev server, its branch, its `db:branch`. Stay there until the skill ends; removal is the user's call (`npm run worktree:remove`).

## Dev servers

Every checkout gets its own port, and Next allows only one `next dev` per checkout (a second one exits with "Another next dev server is already running").

| Port  | Whose                                                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3000  | The user's server in the main checkout. Agents may use it but never start it.                                                                                   |
| 3001  | The user's `dev-email`. Agents don't run it.                                                                                                                    |
| 3100  | An agent's server in the main checkout, only when the user's 3000 isn't running: `PORT=3100 npm run dev`. Stop it when you're done, since it blocks the user's. |
| 3101+ | One fixed port per worktree, in its `.dev-port` (gitignored). `npm run dev` there serves on it.                                                                 |

- Agents may start and stop servers on 3100 and up without asking. Never touch 3000 or 3001.
- `npm run dev:port` prints the checkout's port: 3000 in the main checkout, the `.dev-port` in a worktree (allocating one on first use — the lowest free port from 3101).
- `npm run dev` always passes the port explicitly, so a busy port fails instead of drifting onto 3001. Off 3000, the inspector moves too (port + 6229).
- `npm run dev` first runs a read-only `prisma migrate status` and warns if the database is missing migrations this checkout has. It separates two cases:
  - **Already on `integration`:** shared `avut` fell behind after someone merged a migration. `npm run prisma migrate deploy` catches it up, with permission like any other shared-database write.
  - **Only on this branch:** never deploy these to `avut`. They go on a `db:branch` copy.

  `AVUT_SKIP_MIGRATION_CHECK=1` skips the check.

- better-auth's `baseURL` follows the server's own port (`src/lib/dev-server.ts`), and any localhost port is a trusted origin. Session cookies are shared across ports, so signing in once on 3000 (Google included) signs you in on every server on the same database — and signing in as someone else on any of them replaces that session everywhere. Google and GitHub sign-in only work on ports registered with the provider, so on other ports sign in on 3000 first, or use email and password.

---

# Codebase Conventions

How the code is written. Read the linked pattern doc before writing a new page or mutation rather than inferring the pattern from a neighbouring file. [`docs/conventions-checklist.md`](docs/conventions-checklist.md) is the checklist of the rules below that lint doesn't enforce. Apply it when reviewing any diff here, alongside the correctness pass.

Design specs live in [`docs/specs/`](docs/specs/README.md). Every spec, plan, research doc, and review under `docs/` carries a `**Date:**` line in its header _and_ the same date as a filename prefix (`YYYY-MM-DD-subject.md`) — see that folder's README before adding or renaming one.

## tRPC Routers

Router conventions and the audit-logging guide (which `ctx.logEvent` you hold, `LogBatch`, the `Operations` registry) are in [`src/trpc/CLAUDE.md`](src/trpc/CLAUDE.md), loaded when working under `src/trpc/`. Domain-service conventions (the `src/server/services/<domain>.ts` layer routers call into) are in [`src/server/services/CLAUDE.md`](src/server/services/CLAUDE.md) instead. The rules that apply everywhere:

- Always call `ctx.logEvent(...)` after state-changing operations on records — org-scoped, user-scoped, or system-wide. Log rows are never written by hand (lint): every entry goes through `ctx.logEvent`, which delegates to `recordLogEntry` in `src/server/log-entry.ts`
- Pair a write with `ctx.logEvent(...)` inside `ctx.prisma.$transaction([...])`, not `Promise.all([...])` — see [`docs/patterns/transactional-writes.md`](docs/patterns/transactional-writes.md) for the shape and its gotchas (non-Prisma operations can't join the array)

## Data Fetching

AVUT has two distinct tRPC entry points — `trpc` from `@/trpc/server` (Server Components: calls the router in-process, preserving the request's session) and `trpc` from `@/trpc/client` (Client Components: goes out over HTTP from the browser, and fails every call during a server render rather than fetch without the session, so what a client component reads there must be prefetched). Lint catches the wrong one in Next entry files (`page`, `layout`, `route`, …); any other Server Component is on you.

Mutations declare their cache side-effects once via `meta: { effects: ... }` (`src/trpc/mutation-effector.tsx`), not with manual `queryClient.setQueryData`/`invalidateQueries` calls at each call site.

See the pattern docs for the full shapes, code, and rationale — read the relevant one before writing a new page or mutation dialog rather than inferring the pattern from a neighboring file, since these are exactly the details easy to get subtly wrong (and where they've drifted before):

- [`docs/patterns/detail-page-data-fetching.md`](docs/patterns/detail-page-data-fetching.md) — `page.tsx`/`<entity>-content.tsx` split, `fetchQuery` vs `prefetch`+`HydrateClient`, `useSuspenseQuery`
- [`docs/patterns/mutation-dialog.md`](docs/patterns/mutation-dialog.md) — create/update/delete/confirm dialogs driven by a `?action=` search param via nuqs (`NuqsAdapter`, `useQueryState` + `parseAsStringLiteral`, `history` push-on-open/replace-on-close, controlled `…_Dialog` components)

## Permissions

Defined in `src/lib/permissions.ts`. Roles: `owner`, `admin`, `member`, plus per-module roles: `i3-editor`, `i3-admin` (I3); `skills-assessor`, `skills-reporter`, `skills-admin` (Skill Track); `skills-author` (Skill Package Builder). A member holds any combination; `owner` is granted separately (`makeOwner`/`removeOwner`).

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

**Route access**: the procedure is the check, not the page or the layout. Layouts don't re-run on client-side navigation, so they guard nothing. A page checks permissions itself only when it reads data outside tRPC. See [`docs/patterns/route-access-control.md`](docs/patterns/route-access-control.md).

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

| Block      | Purpose                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Std`      | Outer page shell — `Std.SidebarInset` (rendered once by the authenticated layout, with `AppNavbar` above its `<Suspense>`), `Std.ScrollContainer` (rendered by `page.tsx`), `Std.IndexPage`                                                                                                                                                                                           |
| `Saratoga` | Content layout within the shell — `Saratoga.Root`, `Saratoga.Breadcrumbs`, `Saratoga.Header`, `Saratoga.Title`, `Saratoga.Actions`, `Saratoga.Columns`/`.Column`                                                                                                                                                                                                                      |
| `Kaga`     | Data table system wrapping TanStack Table — `Kaga.Table`, `Kaga.TableToolbar`, `Kaga.TablePagination`, `Kaga.defineColumns`, `Kaga.filterFns`                                                                                                                                                                                                                                         |
| `Argus`    | Centered card layout for auth/form pages                                                                                                                                                                                                                                                                                                                                              |
| `Eagle`    | JSON diff/parse comparison display (used in dev/import tooling)                                                                                                                                                                                                                                                                                                                       |
| `Glorious` | Full-height matrix table — `Glorious.Root`, `Glorious.Header`/`.Breadcrumbs`/`.Title`/`.Subtitle`/`.Actions`, `Glorious.ScrollFrame`, `Glorious.Table`, `Glorious.TableHeader`, `Glorious.GroupSection` (collapsible sticky `<tbody>`)                                                                                                                                                |
| `Hermes`   | Master-detail layout under the navbar, in place of `Std.ScrollContainer` — `Hermes.Root` (render from the route's `layout.tsx`; picks the active pane from `useSelectedLayoutSegment()`), `Hermes.List`, `Hermes.Detail`, `Hermes.Placeholder`. Both panes at `md`+, only the active one below. `Hermes.Detail` crossfades on record change, so the record route has no `loading.tsx` |

Typical page layout. The authenticated layout renders the one navbar (`AppNavbar`: ☰, logo, notifications, theme, user menu, Help) and `Std.SidebarInset`, so a page renders neither. `page.tsx` renders `Std.ScrollContainer` around the client component, and the page's breadcrumb trail sits **in the page**, above its title:

```tsx
// page.tsx
<HydrateClient>
    <Std.ScrollContainer>
        <ClientComponent />
    </Std.ScrollContainer>
</HydrateClient>

// client component — a list at its module's top level, so no trail
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

**The trail** (`Saratoga.Breadcrumbs`, items `SaratogaBreadcrumb = { label, href: Route }`) shows the **record hierarchy** above the page, every crumb a link. It leaves out the module (the sidebar already shows it) and the page itself (its `<h1>` names it). A page at its module's top level (a module root, or a module list like Personnel, Sessions or Teams) has no trail; below that, trails are short: a person shows `Personnel`, a person's History `Personnel › Aaron Gray`, a session's By Person page `Sessions › Session #2`. An ancestor with no page to link to is dropped, except "Access Tokens", which links to `/user/settings/d4h`. Exceptions to the rule are decided case by case; so far only Notes, whose note pages keep a "Notes" crumb as the way back to the list on phones. Where the trail is built depends on who renders the page's root:

| Page shape                                                                     | Where the trail goes                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content component owns `Saratoga.Root` (detail pages)                          | The content component renders `<Saratoga.Breadcrumbs items={[…]} />` first inside `Saratoga.Root`, built from the data it reads (a record's name on its History page).                                                                                                          |
| List component owns `Saratoga.Root`, `page.tsx` knows the trail                | A top-level list has none. Otherwise the list takes `breadcrumbs?: SaratogaBreadcrumb[]` and renders `{breadcrumbs && <Saratoga.Breadcrumbs items={breadcrumbs} />}`; `page.tsx` passes the static trail. A list that reads the record its trail names builds the trail itself. |
| History page (`ObjectHistory`)                                                 | Pass `breadcrumbs` to `ObjectHistory`, ending with the record itself.                                                                                                                                                                                                           |
| `Glorious` matrix                                                              | `<Glorious.Breadcrumbs items={…} />` first inside `Glorious.Header`, before `Glorious.Title`, in every branch that renders a header. No `Std.ScrollContainer`: Glorious is full height.                                                                                         |
| `Hermes` (notes)                                                               | In the detail pane only, from `notesBreadcrumbs()` (`src/components/notes/notes-breadcrumbs.ts`). The list pane and the index route have none. No `Std.ScrollContainer`.                                                                                                        |
| `Std.IndexPage`                                                                | None. No trail and no on-page logo: the navbar carries the logo, and the sidebar is the way back up.                                                                                                                                                                            |
| No Saratoga or Glorious header (a bare `Card`)                                 | `<Saratoga.Breadcrumbs items={…} className="mb-2" />` directly above the content, inside `Std.ScrollContainer`.                                                                                                                                                                 |
| Playground pages                                                               | None.                                                                                                                                                                                                                                                                           |
| The content needs a `Std.ScrollContainer` `className` that depends on its data | `page.tsx` renders a plain `Std.ScrollContainer`; the content renders its own wrapper for that branch (e.g. `<div className="flex min-h-full flex-col">` in place of `className="flex"`).                                                                                       |

Converting an existing page to this shape, case by case with before/after code, is in [`docs/patterns/detail-page-data-fetching.md` → Page shell](docs/patterns/detail-page-data-fetching.md#page-shell-scrollcontainer-and-the-trail).

For detail pages use `Saratoga.Columns` with `<Saratoga.Column slot="main">` and `slot="secondary"` (2/3 + 1/3 responsive grid). Index pages (nav-list only, no client component) wrap their content in `Std.IndexPage` inside `Std.ScrollContainer`; it renders `title` (a **required** prop) above the links.

`Saratoga.Root` is a fixed `max-w-5xl`; it has no width variants. Constrain narrower content with `className` on a case-by-case basis.

## Entity Links

Render an entity's name as a link to its detail page with the wrappers in `src/components/entity-links/` (`PersonLink`, `TeamLink`, `TeamMembershipLink`, `UserLink`), not a bare `<Link>` — see [`docs/patterns/entity-link.md`](docs/patterns/entity-link.md) for the prop-typing convention (intersect the entity's `Ref` schema, don't hand-roll the shape) and how to add a new entity type.

## Scope roots and modules

The app has four real scope roots, each with its own sidebar and module set: **organization** (`/orgs/[slug]/…`), **team** (`/teams/[slug]/…`, entered through `requireTeam`, an entry gate that needs a `TeamUser` grant on a slugged, Active team; its pages then read through the org procedures, checked by org roles — see [`route-access-control.md`](docs/patterns/route-access-control.md)), **user** (`/user/…`, always available), and **system** (`/system/…`, gated on the Better Auth `admin` role). `ScopeSwitcher` (`src/components/nav/scope-switcher.tsx`) is the persistent control for jumping between them.

`src/lib/modules.ts` is the single source of truth for all four — module ids, labels, icons, route segments, and hrefs all come from the `Modules` registry there. Update it when adding a module; don't hardcode module paths elsewhere. A module's UI code lives in `src/modules/<module-id>/` (see [Modules](#modules)).

- A module's route segment can differ from its id — `skill-track` is the id _and_ segment, but don't assume they always match; read `segment` from the registry. The org-scoped `org-admin` and system-scoped `system-admin` modules both use segment `"admin"` — they don't collide because each scope's module lookup is scoped to its own `ModuleScope`
- An org module can also live in team scope: it keeps its `OrganizationModuleId` and declares a `team` entry (`TeamScopeEntry`: an optional `segment` and `href(teamSlug)`), and is still enabled by its one org settings key. Team-only modules are `TeamModuleDef`s (`scope: "team"`, always on); `team-admin` (`/teams/[slug]/admin`) is the first. Like every team page it writes through the org procedures with the team's ids, not team-scope procedures. `teamModules` is derived from both
- A component used in both the org and team scopes builds its links with `scopedRoute(ref, { organization, team }, params)` (`src/lib/scoped-routes.ts`), or `useScopedRoute()` (`src/hooks/use-scoped-route.ts`) to bind it to `useCurrentScope()`. Both roots name their param `[slug]`, so both patterns stay typed routes
- Only org-scoped modules are gated by org settings (`OrganizationSettings.modules`, keyed by `OrganizationModuleId`); `org-admin` is `alwaysOn`, as are all user and system modules
- Only org modules with an `href` appear in the org nav switcher and dashboard (`orgModules`), which is why `forms` is absent from those
- The `forms` id is inert: the public `/pub` form experiment was deleted, and the live form flows (`forms-router`, `src/forms/i3-issue-items/`, `form-processor`) are reached through `d4h-i3`. It's retained only because it's a settings-gated key

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
