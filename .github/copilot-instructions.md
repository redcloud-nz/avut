# AVUT AI Coding Agent Instructions

## Project Overview

AVUT (Assorted Vaguely Useful Tools) is a Next.js + Prisma + tRPC SaaS platform with organization-based multi-tenancy and role-based access control. Built with TypeScript, it uses Better Auth for authentication, React Query for data fetching, and email-based verification.

## Tech Stack & Key Dependencies

- **Frontend**: Next.js 15 (App Router), React Server Components, TanStack React Query
- **Backend**: tRPC v11 for type-safe APIs, Prisma v7 with PostgreSQL
- **Auth**: Better Auth (email/password + OTP + organization plugin + access control)
- **Database**: PostgreSQL with Prisma migrations
- **Testing**: Vitest + jsdom
- **Email**: React Email + React components for templating
- **UI**: shadcn/ui components, Sonner for toasts

## Architecture Patterns

### Multi-Tenancy & Permissions Model

- **Organizations** are the tenant boundary; users can belong to multiple orgs
- **Roles** within orgs: Owner (full control), Admin (manage org/people/packages), Member (view-only org)
- **Teams** are sub-groups within organizations with their own members
- Permissions enforced via Better Auth's access control plugin + `<Protect>` wrapper component
- Permission checks: `hasPermission(organizationId, { resource: [actions] })`

### tRPC Router Architecture

- Router mounted at `/src/trpc/routers/_app.ts` aggregates all subrouters
- Each domain (organizations, personnel, teams, settings, invitations, notifications) gets dedicated router file
- All routers use `createTrpcRouter()` from `/src/trpc/init.ts` for consistent middleware setup
- Context includes `auth` session, `prisma` client, and `hasPermission()` function

### Server Utilities & Schemas

- **Data Layer**: `/src/server/*.ts` contains database queries (organization.ts, team.ts, person.ts, etc.)
- **Schemas**: `/src/lib/schemas/` contains Zod schemas + fromRecord/toRecord converters for type-safe Prisma→DTO transforms
  - Pattern: `export const EntityData = { fromRecord(), toRecord(), schema }`
  - This prevents exposing internal DB fields (IDs, timestamps) to client
- **Validation**: `/src/lib/validation.ts` has reusable Zod schemas (zodSlug, zodNanoId16, propertiesSchema, etc.)

### Next.js Layout & Protected Routes

- `(authenticated)` and `(public)` route groups separate auth/unauth UIs
- Auth wrapper uses `<Providers>` component that sets up React Query + tRPC client
- Use `<Protect orgId permissions={...}>` component to gate server components on client side
- Cache invalidation: `revalidateTag('organization-${slug}')` after mutations affecting org data

## Development Workflows

### Running Locally

```bash
npm run dev                    # Start dev server (http://localhost:3000)
npm run dev-email             # Email preview (http://localhost:3001)
npm run prisma migrate dev    # Create/apply migrations after schema changes
npm run test                  # Run tests in watch mode
npm run lint                  # Next.js linting
```

### Database Migrations

- Edit `/prisma/schema.prisma` then run `npm run prisma migrate dev -- --name description`
- Migrations live in `/prisma/migrations/` with auto-generated SQL
- **Never** edit migration SQL directly; rollback and recreate instead

### Testing

- Tests colocate with source: `*.test.ts` or `*.spec.ts`
- Setup file at `/src/test/setup.ts`; test helpers in `/src/test/trpc-helpers.ts`
- Use `vitest` for unit tests; can test tRPC procedures via helpers

## Key Conventions

### Naming & IDs

- Resource IDs use nanoId16 format (16-char alphanumeric, unique per resource)
- URL slugs: lowercase alphanumeric + hyphens, validated via `zodSlug`
- File naming: kebab-case for files

### Zod Validation & Type Safety

- **Always** create Zod schemas for router inputs/outputs
- Use `z.ZodType.refine()` for cross-field validation
- For database records: create dto schema separate from DB model (use EntityData.fromRecord to transform)
- Custom zod formats via `z.stringFormat("format-name", regex, error)`

### Better Auth Patterns

- Access control statements in `/src/lib/permissions.ts` define resource+action combinations
- Use `auth.api.hasPermission({ headers, body: { organizationId, permissions } })` for server-side checks
- Client-side: `authClient.organization.hasPermission()` wrapped in React Query
- Org invitations trigger `revalidateOrganization(slug)` to clear caches

### Async Server Functions & Caching

- Server utilities use React's `cache()` + Next.js `cacheTag()`/`revalidateTag()` for request-level deduplication
- Pattern: `"use cache"` directive at function start + `cacheTag(key)` for invalidation
- Revalidate after mutations: `revalidateTag('resource-key', { expire: 0 })`

### Components & Client State

- Server Components by default; mark with `"use client"` only when needed
- Use React Query hooks for data fetching from tRPC (auto-generated client in `/src/trpc/client.ts`)
- Form state via React Hook Form + Zod validation
- UI components from `/src/components/` (cards, blocks, controls) + shadcn/ui

## Critical Files & Their Purpose

- [.env.local](.env.local) - Auth secrets, database URL (not in git)
- [prisma/schema.prisma](prisma/schema.prisma) - Complete data model (auth + domain models)
- [src/trpc/init.ts](src/trpc/init.ts) - tRPC context factory & middleware (auth, permissions, headers)
- [src/server/auth.ts](src/server/auth.ts) - Better Auth config, email templates, permission roles
- [src/lib/permissions.ts](src/lib/permissions.ts) - Access control rules & role definitions
- [src/trpc/routers/\_app.ts](src/trpc/routers/_app.ts) - Main router aggregating all subrouters

## Common Tasks

**Adding a new protected endpoint:**

1. Define input/output Zod schema in router file
2. Add procedure to router: `protectedProcedure.input(schema).mutation(async ({ ctx, input }) => { ... })`
3. Check permissions: `await ctx.hasPermission(orgId, { resource: ['action'] })`
4. Use server utils (e.g., `team.ts`) for queries; transform via schema's `toRecord()`

**Modifying data models:**

1. Update [prisma/schema.prisma](prisma/schema.prisma)
2. Run `npm run prisma migrate dev -- --name description`
3. Update corresponding schema in [src/lib/schemas/](src/lib/schemas/)
4. Update server utility if queries change

**Email templates:**

1. Create React component in [src/emails/](src/emails/)
2. Register in Better Auth config in [src/server/auth.ts](src/server/auth.ts) or send via `sendEmail()`
3. Preview via `npm run dev-email`

## What NOT to Do

- Don't bypass permission checks; always call `ctx.hasPermission()` for sensitive operations
- Don't expose internal Prisma fields (IDs, timestamps) in API responses; use EntityData transformers
- Don't edit migration SQL; recreate migrations if needed
- Don't forget to invalidate caches after mutations (use `revalidateTag()`)
- Don't commit `.env.local`; ensure CI/CD handles secrets via environment variables
