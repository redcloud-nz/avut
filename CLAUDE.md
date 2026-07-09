# AVUT — Assorted Vaguely Useful Tools

A Next.js web application providing organizational management tools with optional D4H platform integration.

## Stack

- **Framework**: Next.js 16, App Router, React 19, TypeScript
- **Database**: PostgreSQL via Prisma 7 (generated client in `src/generated/prisma/` — never edit manually)
- **API layer**: tRPC 11 with React Query 5 — standard data-fetching pattern
- **Auth**: better-auth with organization plugin
- **UI**: Tailwind CSS 4, shadcn/ui primitives, lucide-react icons, radix-ui
- **Forms**: react-hook-form + zod 4
- **D4H API**: openapi-fetch with a generated OpenAPI schema (`src/lib/d4h-api/schema.d.ts`)
- **Package manager**: npm

## Commands

```bash
npm run dev                  # Start dev server (with Node inspector)
npm run build                # Run migrations + build
npm run lint                 # ESLint
npm run test                 # Vitest (watch mode)
npm run test:run             # Vitest (single run)
npx tsc --noEmit             # Type check

# Prisma (always uses .env.local)
npm run prisma migrate dev   # Create and apply migration
npm run prisma studio        # Open Prisma Studio
```

## Project Structure

```
src/
  app/                        # Next.js App Router pages
    (authenticated)/orgs/[slug]/   # Org-scoped authenticated pages
    pub/orgs/[slug]/          # Public-facing forms (no auth)
    api/                      # API routes (auth)
    trpc/[trpc]/              # tRPC HTTP handler
  components/
    blocks/                   # Named high-level layout blocks (see below)
    ui/                       # shadcn/ui primitives + custom UI
    nav/                      # Navigation components
  lib/
    d4h-api/                  # D4H API client, resource types, fetch helpers
    collections/              # TanStack DB collection factories (experimental)
    schemas/                  # Zod schemas used across client and server
  server/                     # Server-only utilities (auth, prisma, etc.)
  trpc/
    init.ts                   # tRPC init, context, procedure factories
    routers/                  # One file per domain router
    routers/_app.ts           # Root app router
  generated/prisma/           # Auto-generated Prisma client — DO NOT EDIT
  paths.ts                    # Centralised typed route helpers — always use this for hrefs
  lib/permissions.ts          # Role definitions and permission statements
```

## Key Conventions

### tRPC Routers

- One file per domain in `src/trpc/routers/`
- Register new routers in `src/trpc/routers/_app.ts`
- Procedures within each router must be kept in alphabetical order
- Use `organizationProcedure()` for org-scoped mutations/queries — it injects `organizationId` into input and checks permissions automatically
- Use `authenticatedProcedure` for user-scoped procedures
- Use `publicProcedure` only for truly unauthenticated endpoints
- Always call `ctx.logEvent(...)` after state-changing operations on org records

### Permissions

Defined in `src/lib/permissions.ts`. Roles: `owner`, `admin`, `member`, `i3-editor`, `skills-assessor`, `skill-package-author`.

**Server-side** (tRPC): pass a permissions object to `organizationProcedure`:

```ts
organizationProcedure({ person: ["create", "update"] });
```

**Client-side**: use `<Protect>` from `@/components/protect` to conditionally render UI based on the current user's permissions. It renders `children` if the user has all required permissions, or `fallback` (default: `null`) otherwise:

```tsx
import { Protect } from "@/components/protect";

<Protect orgId={organization.id} permissions={{ skillCheckSession: ["update"] }}>
    <Button>Approve</Button>
</Protect>

// With a fallback
<Protect orgId={organization.id} permissions={{ person: ["delete"] }} fallback={<DisabledButton />}>
    <DeleteButton />
</Protect>
```

### Zod Schemas

- Domain schemas live in `src/lib/schemas/`
- Use Zod 4 syntax (`.parse`, `.safeParse`, `z.object`, etc.)
- Schemas shared between client and server go in `src/lib/schemas/`; server-only in `src/server/`

### IDs

Use `nanoId16()` from `src/lib/id.ts` for new record IDs.

### D4H Integration

- D4H is an optional feature — code that depends on a D4H access token must handle the case where none is configured
- D4H API client: `src/lib/d4h-api/client.ts` — use `getD4hFetchClient(token)`
- Cached D4H fetches use the standard Next.js 16 `"use cache"` directive with `cacheLife` + `cacheTag`
- D4H resource schemas validated with Zod live in `src/lib/d4h-api/`

### Internal URLs

Next.js typed routes are enabled, so static route strings are type-checked automatically. Use `route()` from `src/lib/routes.ts` only when a route has dynamic segments — it substitutes `[param]` placeholders and returns a typed `Route` string.

```ts
import { route } from "@/lib/routes";

// Static route — plain string is fine
href = "/main/acme/admin";

// Dynamic route — use route() to substitute params
route("/main/[slug]/admin", { slug: organization.slug });
route("/main/[slug]/personnel/[person_id]", { slug, person_id: id });
```

- Route patterns must match the actual file-system path under `src/app/` (minus route group segments like `(authenticated)`)
- The params object is fully typed — TypeScript will error if a required param is missing or the route pattern doesn't exist
- Routes are auto-discovered from the filesystem — no manual registration needed. New `page.tsx` files become valid route patterns automatically after the next dev server start or build

## Testing

Vitest with jsdom environment. Tests live alongside source files as `*.test.ts`.

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

| Block       | Purpose                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Lexington` | Outer page shell — `Lexington.Root`, `Lexington.Header` (breadcrumbs), `Lexington.Page`, `Lexington.Column`                                     |
| `Hermes`    | Content section within a Lexington column — `Hermes.Header`, `Hermes.Title`, `Hermes.BackButton`, `Hermes.Search`                               |
| `Akagi`     | Data table system wrapping TanStack Table — `Akagi.Table`, `Akagi.TableSearch`, `Akagi.TableHeadCell`, `Akagi.TableCell`, `Akagi.defineColumns` |
| `Argus`     | Centered card layout for auth/form pages                                                                                                        |
| `Eagle`     | JSON diff/parse comparison display (used in dev/import tooling)                                                                                 |

Typical page layout:

```tsx
<Lexington.Root>
  <Lexington.Header breadcrumbs={[...]} />
  <Lexington.Page>
    <Lexington.Column width="xl">
      <Hermes.Header>
        <Hermes.BackButton to={...} />
        <Hermes.Title>Title</Hermes.Title>
      </Hermes.Header>
      {/* content */}
    </Lexington.Column>
  </Lexington.Page>
</Lexington.Root>
```

## App Modules (per org)

| Module                | Path prefix                          | Description                                           |
| --------------------- | ------------------------------------ | ----------------------------------------------------- |
| `admin`               | `/orgs/[slug]/admin`                 | Org management — users, teams, personnel, invitations |
| `skills`              | `/orgs/[slug]/skills`                | Skill checks, sessions, reports                       |
| `skillPackageBuilder` | `/orgs/[slug]/skill-package-builder` | Authoring skill packages                              |
| `d4HViews`            | `/orgs/[slug]/d4h-views`             | Read-only views of D4H data                           |
| `i3`                  | `/orgs/[slug]/i3`                    | Equipment issue/inspect/return (I3) & PPE templates   |
| `notes`               | `/orgs/[slug]/notes`                 | Rich-text notes                                       |
| `availability`        | `/orgs/[slug]/availability`          | (in progress)                                         |
| `fog`                 | `/orgs/[slug]/fog`                   | Field Operations Guide                                |
