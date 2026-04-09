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
- Use `organizationProcedure()` for org-scoped mutations/queries — it injects `organizationId` into input and checks permissions automatically
- Use `authenticatedProcedure` for user-scoped procedures
- Use `publicProcedure` only for truly unauthenticated endpoints
- Always call `ctx.logEvent(...)` after state-changing operations on org records

### Permissions

Defined in `src/lib/permissions.ts`. Roles: `owner`, `admin`, `member`, `d4h-ppe-admin`, `skills-admin`, `skills-assessor`, `skills-author`.

```ts
organizationProcedure({ person: ["create", "update"] });
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
| `d4HPPE`              | `/orgs/[slug]/d4h-ppe`               | D4H PPE template management                           |
| `notes`               | `/orgs/[slug]/notes`                 | Rich-text notes                                       |
| `availability`        | `/orgs/[slug]/availability`          | (in progress)                                         |
| `fog`                 | `/orgs/[slug]/fog`                   | Field Operations Guide                                |
