# AVUT — Assorted Vaguely Useful Tools

A Next.js web application providing organisational management tools for teams,
with optional integration to the [D4H](https://d4h.com/) platform.

Current version: **0.7.41 "Philomel"** · License: **MIT**

---

## What is AVUT?

AVUT is a multi-tenant web app. People belong to one or more **organisations**,
and each organisation gets a set of tools it can turn on or off independently:

- Managing personnel, teams, users, and invitations
- Issuing, inspecting, and returning equipment (the "I3" flow) and PPE templates
- Tracking skill checks, assessment sessions, and a skills catalogue
- Authoring reusable skill packages
- Rich-text notes
- Read-only views of data pulled from a connected D4H account

D4H integration is entirely optional — an organisation with no D4H access token
still uses every other tool normally.

Everything an organisation sees lives under `/orgs/[slug]/…`. Which tools appear
is controlled per-organisation; a user's abilities within a tool are controlled
by their **role(s)** in that organisation.

---

## Modules

| Module                  | Path                                 | What it does                                                     |
| ----------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `admin`                 | `/orgs/[slug]/admin`                 | Org management — users, teams, personnel, invitations. Always on |
| `d4h-views`             | `/orgs/[slug]/d4h-views`             | Read-only views of D4H data                                      |
| `i3`                    | `/orgs/[slug]/i3`                    | Equipment issue / inspect / return (I3) and PPE templates        |
| `notes`                 | `/orgs/[slug]/notes`                 | Rich-text notes                                                  |
| `skill-track`           | `/orgs/[slug]/skill-track`           | Skill checks, assessment sessions, catalogue, reports            |
| `skill-package-builder` | `/orgs/[slug]/skill-package-builder` | Authoring skill packages                                         |

Every module except `admin` is gated by the organisation's settings. The full
registry (ids, labels, icons, routes) lives in [`src/lib/modules.ts`](src/lib/modules.ts).

---

## How it works

**Organisations and access.** Auth is handled by
[better-auth](https://better-auth.com/) with its organization plugin. A signed-in
user has a membership — and one or more roles — in each org they belong to. Roles
(`owner`, `admin`, `member`, `i3-editor`, `skills-assessor`,
`skill-package-author`) map to permission statements defined in
[`src/lib/permissions.ts`](src/lib/permissions.ts). The server enforces them on
every org-scoped API call; the client uses the same definitions to show or hide
UI.

**Request flow.** Pages are React Server Components under the Next.js App Router.
Data moves over [tRPC](https://trpc.io/): server components call the router
in-process (keeping the request's session), while client components call it over
HTTP through React Query. Routers live one-per-domain in
[`src/trpc/routers/`](src/trpc/routers/). Persistence is PostgreSQL via
[Prisma](https://www.prisma.io/) 7 (the generated client in `src/generated/prisma/`
is never edited by hand).

**D4H.** When an org has a D4H access token configured, server-only code in
[`src/server/d4h-api/`](src/server/d4h-api/) fetches from the D4H REST API using a
generated OpenAPI schema, with responses validated by Zod and cached with
Next.js's `"use cache"`.

---

## Tech stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Database**: PostgreSQL, Prisma 7
- **API**: tRPC 11 + TanStack React Query 5
- **Auth**: better-auth (organization plugin)
- **UI**: Tailwind CSS 4, shadcn/ui, radix-ui, lucide-react
- **Forms**: react-hook-form + Zod 4
- **Email**: React Email + Resend
- **Testing**: Vitest (jsdom), `prisma-mock` for in-memory database tests

---

## Getting started

Prerequisites: Node, npm, and a PostgreSQL database.

```bash
npm install

# Create .env.local with at least a Postgres connection string and
# better-auth secrets (see src/server/auth.ts for what's read from the environment).

npm run prisma migrate dev   # apply database migrations
npm run dev                   # start the dev server
```

Other useful commands:

```bash
npm run dev-email    # React Email preview server (port 3001)
npm run test:run     # run the test suite once
npm run lint         # ESLint
npx tsc --noEmit     # type check
```

---

## Repository layout

```
src/
  app/            # Next.js App Router pages ((authenticated)/orgs/[slug]/… for org-scoped tools)
  trpc/           # tRPC init, context, and per-domain routers
  components/     # UI primitives (ui/), layout blocks (blocks/), navigation
  lib/            # Shared schemas, permissions, module registry, route helpers
  server/         # Server-only code (auth, prisma, D4H client)
  emails/         # React Email templates
docs/             # Module specs, architecture patterns, research notes
```

For coding conventions, data-fetching patterns, and the project's house rules,
see [`AGENTS.md`](AGENTS.md) and [`docs/patterns/`](docs/patterns/).

---

## License

[MIT](LICENSE.md)
