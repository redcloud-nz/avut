# System Admin Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global, non-org `system-admin` module — gated by the Better Auth `User.role === "admin"` flag — providing cross-org organization management (list, create, detail, membership, settings) and user management (list, delete, impersonate, promote/demote, ban).

**Architecture:** Introduce a `global`-scope branch in the existing `Modules` registry, a `requireGlobalAdmin()` server guard, and a `systemAdminProcedure` tRPC procedure. All system-admin pages live under `src/app/(authenticated)/system-admin/`, all server logic in a single `system-admin-router.ts`. Org management reuses the existing `OrganizationSettings` abstraction (`src/lib/schemas/organization-settings.ts` + `src/server/organization-settings.ts`) and the existing settings form components, refactored to be keyed by `organizationId` rather than requiring org membership.

**Tech Stack:** Next.js 16 App Router, tRPC 11 + React Query 5, Better Auth (`admin` + `organization` plugins), Prisma 7, `Kaga` table block, nuqs `?action=` mutation dialogs, Vitest + `prisma-mock`.

**Spec:** GitHub issue #78 and its children (#10, #11, #12, #13, #14, #15, #16, #77, #79, #80, #81, #82). Each phase below implements one issue.

## Global Constraints

- tRPC procedures within `system-admin-router.ts` must be kept in **alphabetical order**.
- Register `systemAdmin: systemAdminRouter` in `src/trpc/routers/_app.ts` in its alphabetical position (verify against the current order in that file).
- Every state-changing procedure calls `ctx.logEvent(...)` **inside** `ctx.prisma.$transaction([...])` — see `docs/patterns/transactional-writes.md`.
- Never import `@/server/auth`, `@/server/prisma`, or anything importing them from a test file or a router file. Use `import type` only.
- New record IDs: `nanoId16()` from `src/lib/id.ts`; branded fixture IDs in tests via `.create()`.
- Server Components use `trpc` from `@/trpc/server`; Client Components use `trpc` from `@/trpc/client`. Never cross them.
- Mutation cache side-effects declared via `meta: { effects }` (`src/trpc/mutation-effector.tsx`), not manual `queryClient` calls — **except** when the mutation is a Better Auth `authClient.*` call (not tRPC), where an explicit `queryClient.invalidateQueries` in `onSuccess` is correct (mirror `src/components/admin/users/users-list.tsx`).
- New `page.tsx` files require `npx next typegen` before `route()` calls typecheck.
- Data-fetching / dialog shapes: follow `docs/patterns/detail-page-data-fetching.md` and `docs/patterns/mutation-dialog.md` verbatim — do not infer from neighbors.
- `<Protect>` is org-permission based and will NOT gate system-admin UI. Gate on the session `user.role === "admin"` instead (see Phase 1).
- Run `npm run test:run` and `npx tsc --noEmit` green before every commit.

---

## Phase order & dependency graph

Sequenced by the user's priorities: foundation → users list → **all organization management** → hard-delete → then the low-priority user actions (#12/#13/#14/#15) last.

```
Phase 1  (#10)  foundation: global module scope, guard, procedure
Phase 2  (#11)  global users list + user detail page (shell for later user actions)
Phase 3  (#77)  global organizations list
Phase 4  (#79)  create organization from the list          [needs Phase 3]
Phase 5  (#80)  organization detail page                   [needs Phase 3]
Phase 6  (#81)  assign/remove organization members         [needs Phase 5]
Phase 7  (#82)  edit organization settings from system-admin [needs Phase 5]
Phase 8  (#16)  hard-delete a user account                 [needs Phase 2]
--- lower priority, do last ---
Phase 9  (#12)  per-user actions dropdown + impersonate    [needs Phase 2]
Phase 10 (#13)  app-wide impersonation banner              [needs Phase 9]
Phase 11 (#14)  promote/demote global admin role           [needs Phase 2, 9]
Phase 12 (#15)  ban/unban a user account                   [needs Phase 2, 9]
```

Phases 3–7 (org management) are the priority track and only need Phase 1. Phase 2 and Phase 3 can run in parallel off Phase 1. Phase 8 only needs Phase 2. Phases 9–12 are the deferred track; 10/11/12 all build on the actions menu created in Phase 9.

## PR & branch structure

Three stacked PRs, each retargeted to `master` once its parent merges:

| PR    | Branch                           | Base                                          | Phases              | Issues                            |
| ----- | -------------------------------- | --------------------------------------------- | ------------------- | --------------------------------- |
| **A** | `feat/system-admin-foundation`   | `master`                                      | 1                   | #10                               |
| **B** | `feat/system-admin-core`         | A's tip → retarget to `master` after A merges | 2, 3, 4, 5, 6, 7, 8 | #11, #77, #79, #80, #81, #82, #16 |
| **C** | `feat/system-admin-user-actions` | B's tip → retarget to `master` after B merges | 9, 10, 11, 12       | #12, #13, #14, #15                |

- Each phase is committed individually on its PR's branch (commit messages in the phase steps).
- After all phases of a PR pass review, open the PR with `gh pr create --base master` (retarget if the parent hasn't merged yet: `--base <parent-branch>`, then change base after).
- PR body: link the issues it closes (`Closes #11`, `Closes #77`, …) and reference the tracking issue #78.
- Do **not** commit directly to `master` for this work — this supersedes the old solo-workflow default.

> **Note on the actions menu:** Phase 2 creates `user-actions-menu.tsx` as an empty dropdown shell on the user detail page so Phase 8's "Delete" item has a home. Phase 9 fills it with "Impersonate" and adds the list-row actions column; Phases 11–12 add their items. If executing Phase 8 before Phase 9, the menu simply has one item.

---

## Phase 1 — Foundation: global module scope, guard, procedure (#10)

**Files:**

- Modify: `src/lib/modules.ts` — add `scope`, `system-admin` module, adjust `href` typing
- Modify: `src/components/nav/module-list-menu.tsx:~93` — implement `PersonalModuleOptions()`
- Modify: `src/components/nav/module-sidebar.tsx` — handle `scope: "global"`
- Create: `src/server/system-admin-access.ts` — `requireGlobalAdmin()`
- Modify: `src/trpc/init.ts` — add `systemAdminProcedure`
- Create: `src/trpc/routers/system-admin-router.ts` — router with a `health` query to start
- Modify: `src/trpc/routers/_app.ts` — register `systemAdmin`
- Modify: `src/test/trpc-helpers.ts` — thread `user.role` into the mock context
- Create: `src/app/(authenticated)/system-admin/layout.tsx` — calls `requireGlobalAdmin()`, renders `ModuleSidebar scope="global"`
- Create: `src/app/(authenticated)/system-admin/page.tsx` — placeholder landing (redirects to `/system-admin/users` once Phase 2 lands; for now a `Std.IndexPage` stub)
- Test: `src/server/system-admin-access.test.ts`, `src/trpc/routers/system-admin-router.test.ts`

**Interfaces:**

- Produces:
  - `requireGlobalAdmin(): Promise<{ user: AuthUser }>` — `forbidden()` if `session.user.role !== "admin"`, via the React-cached `requireSession()`
  - `systemAdminProcedure` — tRPC procedure on `authenticatedProcedure`, throws `TRPCError({ code: "FORBIDDEN" })` unless `ctx.session.user.role === "admin"`
  - `ModuleDef.scope: "organization" | "global"`; global modules have `href: () => Route`
  - `Modules["system-admin"]` = `{ id: "system-admin", label: "System Admin", icon: ShieldIcon, segment: "system-admin", scope: "global", href: () => "/system-admin" }`

- [ ] **Step 1: Write failing test for `systemAdminProcedure` rejecting a non-admin**

```ts
// src/trpc/routers/system-admin-router.test.ts
import { describe, it, expect } from "vitest";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { systemAdminRouter } from "./system-admin-router";
import { UserId } from "@/lib/schemas/user";

describe("systemAdminProcedure gate", () => {
  const db = createMockPrisma();

  it("rejects a user whose session role is not admin", async () => {
    const ctx = createAuthenticatedMockContext({
      user: { id: UserId.create(), role: "user" },
      prisma: db,
    });
    await expect(systemAdminRouter.createCaller(ctx).health()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows a user whose session role is admin", async () => {
    const ctx = createAuthenticatedMockContext({
      user: { id: UserId.create(), role: "admin" },
      prisma: db,
    });
    await expect(systemAdminRouter.createCaller(ctx).health()).resolves.toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test, verify it fails** — `npm run test:run -- system-admin-router` → FAIL (module not found / `role` not on mock context).

- [ ] **Step 3: Extend `createAuthenticatedMockContext`** — in `src/test/trpc-helpers.ts`, thread an optional `role?: string` on the `user` param into `ctx.session.user.role` (default `"user"`).

- [ ] **Step 4: Add `systemAdminProcedure` to `src/trpc/init.ts`**

```ts
export const systemAdminProcedure = authenticatedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "System administrator access required." });
  }
  return next({ ctx });
});
```

- [ ] **Step 5: Create `src/trpc/routers/system-admin-router.ts`**

```ts
import { createTrpcRouter, systemAdminProcedure } from "../init";

export const systemAdminRouter = createTrpcRouter({
  health: systemAdminProcedure.query(() => ({ ok: true as const })),
});
```

- [ ] **Step 6: Register in `_app.ts`** (alphabetical) and run the test → PASS.

- [ ] **Step 7: Write failing test for `requireGlobalAdmin()`** — `src/server/system-admin-access.test.ts`, mocking `auth.api.getSession`: non-admin → throws (Next `redirect` throws); admin → returns `{ user }`. Mirror the mocking style of any existing `src/server/*-access.test.ts`; if none exists, skip the unit test and rely on the layout integration (note this in a comment).

- [ ] **Step 8: Implement `src/server/system-admin-access.ts`**

```ts
import "server-only";
import { forbidden } from "next/navigation";
import { requireSession } from "./session"; // React-cached; also handles the signed-out → sign-in redirect

export async function requireGlobalAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") forbidden(); // renders src/app/forbidden.tsx (experimental.authInterrupts)
  return { user: session.user };
}
```

House-convention notes (from the PR-A final review): use the request-cached `requireSession()` from `src/server/session.ts` — not a bare `auth.api.getSession` — so nested layouts + page don't each re-validate; and use `forbidden()` (this repo enables `experimental.authInterrupts` and ships `src/app/forbidden.tsx`), mirroring `src/server/organization-access.ts`, not `redirect("/")`.

- [ ] **Step 9: Add `scope` to `ModuleDef` and the `system-admin` entry in `src/lib/modules.ts`** — add `"system-admin"` to `ModuleId`; add `scope: "organization"` to existing entries (or default in consumers); add the `system-admin` entry (`ShieldIcon` from lucide-react). Filter `orgModules` / settings-gated derivations to `scope === "organization"` so `system-admin` never leaks into org nav or dashboard.

- [ ] **Step 10: Implement `PersonalModuleOptions()` in `src/components/nav/module-list-menu.tsx`** — render global-scope modules, each shown only when the client session's `user.role === "admin"` (use the existing session hook in `src/client/`). Link via `module.href()`.

- [ ] **Step 11: Extend `ModuleSidebar` (`src/components/nav/module-sidebar.tsx`) for `scope: "global"`** — reconcile with the existing unused `"personal"` scope value. Global sidebar shows one item for now ("Overview"); Phase 2 adds "Users", Phase 3 adds "Organizations".

- [ ] **Step 12: Create `system-admin/layout.tsx` and stub `page.tsx`**

```tsx
// layout.tsx
export default async function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  await requireGlobalAdmin();
  return (
    <SidebarProvider>
      <ModuleSidebar scope="global" />
      {children}
    </SidebarProvider>
  );
}
```

`page.tsx` — a `Std.IndexPage` stub titled "System Admin".

- [ ] **Step 13: `npx next typegen && npx tsc --noEmit && npm run test:run`** — all green.

- [ ] **Step 14: Commit**

```bash
git add src/lib/modules.ts src/components/nav src/server/system-admin-access.ts src/server/system-admin-access.test.ts src/trpc/init.ts src/trpc/routers/system-admin-router.ts src/trpc/routers/system-admin-router.test.ts src/trpc/routers/_app.ts src/test/trpc-helpers.ts "src/app/(authenticated)/system-admin"
git commit -m "feat(system-admin): global module scope, requireGlobalAdmin guard, systemAdminProcedure (#10)"
```

---

## Phase 2 — Global users list + user detail page (#11)

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts` — add `getUser`, `listUsers`
- Create: `src/app/(authenticated)/system-admin/users/page.tsx` — list shell
- Create: `src/components/system-admin/users/users-list.tsx` — `"use client"`, `Kaga` table
- Create: `src/app/(authenticated)/system-admin/users/[user_id]/page.tsx` — detail shell + `generateMetadata`
- Create: `src/components/system-admin/users/user-content.tsx` — `"use client"`, detail render
- Create: `src/components/system-admin/users/user-actions-menu.tsx` — empty `DropdownMenu` shell (items added in Phases 8–12)
- Modify: `src/components/nav/module-sidebar.tsx` — add "Users" nav item
- Modify: `src/app/(authenticated)/system-admin/page.tsx` — `redirect("/system-admin/users")`
- Test: `src/trpc/routers/system-admin-router.test.ts` (extend)

**Interfaces:**

- Consumes: `systemAdminProcedure`, `Kaga`, `Saratoga`, `Std`
- Produces:
  - `systemAdmin.listUsers` → `{ users: Array<{ id; name; email; role: string; banned: boolean; emailVerified: boolean; createdAt: Date; organizationCount: number }> }`
  - `systemAdmin.getUser({ userId })` → `{ id; name; email; role: string; banned: boolean; emailVerified: boolean; createdAt: Date; organizations: Array<{ id; name; slug; role: string }> }`; `NOT_FOUND` for unknown id
  - Routes `/system-admin/users`, `/system-admin/users/[user_id]`
  - Components `SystemAdmin_Users_List`, `SystemAdmin_User_Content`, `SystemAdmin_UserActions_Menu`

- [ ] **Step 1: Write failing tests — `listUsers` + `getUser`**

```ts
describe("systemAdmin users", () => {
  const T = {
    admin: UserId.create(),
    u1: UserId.create(),
    u2: UserId.create(),
    org: OrganizationId.create(),
  };
  const db = createMockPrisma();

  beforeAll(async () => {
    for (const id of [T.admin, T.u1, T.u2]) {
      await db.user.create({
        data: {
          id,
          name: `U-${id}`,
          email: `${id}@x.test`,
          emailVerified: true,
          createdAt: new Date(),
        },
      });
    }
    await db.organization.create({
      data: { id: T.org, name: "Org", slug: "org", createdAt: new Date() },
    });
    await db.organizationUser.create({
      data: {
        id: nanoId16(),
        organizationId: T.org,
        userId: T.u1,
        role: "member",
        createdAt: new Date(),
      },
    });
  });
  const call = () =>
    systemAdminRouter.createCaller(
      createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
    );

  it("listUsers returns every user with membership count", async () => {
    const { users } = await call().listUsers();
    expect(users).toHaveLength(3);
    expect(users.find((u) => u.id === T.u1)?.organizationCount).toBe(1);
    expect(users.find((u) => u.id === T.u2)?.organizationCount).toBe(0);
  });
  it("getUser returns the user with organization memberships", async () => {
    const user = await call().getUser({ userId: T.u1 });
    expect(user.organizations).toEqual([{ id: T.org, name: "Org", slug: "org", role: "member" }]);
  });
  it("getUser throws NOT_FOUND for an unknown id", async () => {
    await expect(call().getUser({ userId: UserId.create() })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `getUser` and `listUsers`** (alphabetical: `getUser`, `health`, `listUsers`). Use `ctx.prisma.user` directly — the router file cannot import `@/server/auth`. **Verify the `User` → `OrganizationUser` relation name** in `schema.prisma` (assume `organizationUsers` below).

```ts
listUsers: systemAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.user.findMany({
        select: {
            id: true, name: true, email: true, role: true, banned: true, emailVerified: true, createdAt: true,
            _count: { select: { organizationUsers: true } },
        },
        orderBy: { createdAt: "asc" },
    });
    return { users: rows.map(({ _count, ...u }) => ({
        ...u, role: u.role ?? "user", banned: u.banned ?? false, organizationCount: _count.organizationUsers,
    })) };
}),

getUser: systemAdminProcedure.input(z.object({ userId: UserId.schema })).query(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        include: { organizationUsers: { include: { organization: { select: { id: true, name: true, slug: true } } } } },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: `User ${input.userId} not found.` });
    const { organizationUsers, ...rest } = user;
    return {
        ...rest, role: user.role ?? "user", banned: user.banned ?? false,
        organizations: organizationUsers.map((m) => ({ ...m.organization, role: m.role })),
    };
}),
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Build the list shell** `system-admin/users/page.tsx` — list-page shape from `docs/patterns/detail-page-data-fetching.md`: `prefetch(trpc.systemAdmin.listUsers.queryOptions())` + `<HydrateClient>`, `Std.SidebarInset` / `Std.Navbar` / `Std.ScrollContainer`.

- [ ] **Step 6: Build `users-list.tsx`** — copy the `Kaga` column/table setup from `src/components/admin/users/users-list.tsx`. Columns: name (link to `/system-admin/users/[user_id]`), email, role (badge), status (Active/Banned badge), org count, created. `useSuspenseQuery(trpc.systemAdmin.listUsers.queryOptions())`.

- [ ] **Step 7: Build the detail shell** `system-admin/users/[user_id]/page.tsx` — per `docs/patterns/detail-page-data-fetching.md` (id-keyed): `generateMetadata` via `fetchQuery(trpc.systemAdmin.getUser.queryOptions({ userId }))` for the `<title>`; body does `prefetch` + `<HydrateClient>` and renders `<SystemAdmin_User_Content userId={userId} />`.

- [ ] **Step 8: Build `user-content.tsx`** — `"use client"`, `useSuspenseQuery(trpc.systemAdmin.getUser...)`. `Saratoga.Columns`: main = identity card + org memberships table (rows link to `/system-admin/organizations/[organizationId]` once Phase 5 lands — plain text until then); secondary = metadata + `<SystemAdmin_UserActions_Menu user={user} />`.

- [ ] **Step 9: Build `user-actions-menu.tsx`** — a `DropdownMenu` trigger (icon button) with no items yet (or a single disabled "No actions" placeholder). Takes `user` prop. Later phases add items.

- [ ] **Step 10: Add "Users" to the global sidebar; make `/system-admin` redirect to `/system-admin/users`.**

- [ ] **Step 10b: Add a UI entry point to `/system-admin`** (deferred from Phase 1 — the global nav code currently isn't reachable except by typing the URL). Add a "System Admin" item to the user menu (`src/components/nav/user-menu.tsx`), shown only when the client session `user.role === "admin"`, linking to `/system-admin`. Verify in-browser that a non-admin never sees it and hitting the URL directly renders `forbidden()`.

- [ ] **Step 11: `npx next typegen && npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 12: Manual check** (use the `test-in-browser` skill) — sign in as an admin, visit `/system-admin/users`, open a user; confirm a non-admin is redirected from both routes.

- [ ] **Step 13: Commit** `feat(system-admin): global users list + user detail page (#11)`

---

## Phase 3 — Global organizations list page (#77)

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts` — add `listOrganizations`
- Create: `src/app/(authenticated)/system-admin/organizations/page.tsx` — shell
- Create: `src/components/system-admin/organizations/organizations-list.tsx` — `Kaga` table
- Modify: `src/components/nav/module-sidebar.tsx` — add "Organizations" nav item
- Test: extend router test

**Interfaces:**

- Produces:
  - `systemAdmin.listOrganizations` → `{ organizations: Array<{ id; name; slug; logo: string | null; createdAt: Date; memberCount: number; ownerCount: number; enabledModules: ModuleId[] }> }`
  - Route `/system-admin/organizations`
  - Component `SystemAdmin_Organizations_List`

- [ ] **Step 1: Write failing test**

```ts
it("lists every organization with member count, owner count, enabled modules", async () => {
  // seed T.org with 2 members (1 owner) + an OrganizationConfig enabling "notes"
  const { organizations } = await call().listOrganizations();
  const org = organizations.find((o) => o.id === T.org)!;
  expect(org.memberCount).toBe(2);
  expect(org.ownerCount).toBe(1);
  expect(org.enabledModules).toContain("notes");
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `listOrganizations`** — `prisma.organization.findMany` with `_count` on the members relation, `configs` (the `OrganizationConfig` relation), and either a grouped owner query or `users: { where: { role: "owner" }, select: { id: true } }`. Derive `enabledModules` via `OrganizationSettings.fromRecords(o.configs).modules` — `@/lib/schemas/organization-settings` is import-safe for a router file (no `server-only`).

```ts
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
// enabledModules:
Object.entries(OrganizationSettings.fromRecords(o.configs).modules)
  .filter(([, v]) => v.enabled)
  .map(([k]) => k as ModuleId);
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Build the page shell + `organizations-list.tsx`** — `Kaga` columns: name (link `/system-admin/organizations/[organizationId]` — Phase 5), slug, members, owners, modules (badges), created. `prefetch` + `HydrateClient` + `useSuspenseQuery`. `Saratoga.Actions` left empty (Phase 4 adds the create button).

- [ ] **Step 6: Add "Organizations" to the global sidebar.**

- [ ] **Step 7: `npx next typegen && npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 8: Commit** `feat(system-admin): global organizations list page (#77)`

---

## Phase 4 — Create an organization from the list (#79)

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts` — add `createOrganization`
- Create: `src/components/system-admin/organizations/create-organization-dialog.tsx` — `?action=create`
- Modify: `organizations-list.tsx` — "Create Organization" button in `Saratoga.Actions`
- Check/reuse: `src/lib/schemas/organization.ts` — create-input schema (name + slug); reuse the slug refinement #6's dialog uses
- Test: extend router test

**Interfaces:**

- Produces: `systemAdmin.createOrganization({ name, slug, addSelfAsOwner: boolean })` → `{ id, slug }`. Slug uniqueness → `CONFLICT`; slug format via the existing zod refinement. Creates `Organization` (`id: nanoId16()`), seeds default config from `OrganizationSettings.default()` → `OrganizationSettings.flatten()` → `OrganizationConfig` rows, and (only if `addSelfAsOwner`) an `OrganizationUser` `role: "owner"` for `ctx.session.user.id`. One `$transaction` with `ctx.logEvent` against the new org.

- [ ] **Step 1: Check how #6's create-org flow / better-auth `organization` plugin seeds default `OrganizationConfig`.** NOTE (from Phase 4 execution): it turns out normal org creation seeds **zero** config rows — `create-org.tsx` calls better-auth `organization.create` with no hook, and `OrganizationSettings.fromRecords` supplies defaults implicitly. Phase 4 chose to **eagerly materialise** the default config rows anyway (`OrganizationSettings.flatten(OrganizationSettings.default())`); this was reviewed as provably equivalent for every settings consumer. So: system-admin-created orgs carry ~30 materialised `OrganizationConfig` rows; user-created orgs carry none. Phase 7's settings write path must work for **both**.

- [ ] **Step 2: Write failing tests**

```ts
it("creates an org with default config and no membership by default", async () => {
  const { id, slug } = await call().createOrganization({
    name: "New Co",
    slug: "new-co",
    addSelfAsOwner: false,
  });
  expect(slug).toBe("new-co");
  expect(await db.organizationUser.count({ where: { organizationId: id } })).toBe(0);
  expect(await db.organizationConfig.count({ where: { organizationId: id } })).toBeGreaterThan(0);
});
it("adds the actor as owner when addSelfAsOwner is true", async () => {
  const { id } = await call().createOrganization({
    name: "Mine",
    slug: "mine",
    addSelfAsOwner: true,
  });
  expect(
    await db.organizationUser.findFirst({ where: { organizationId: id, userId: T.admin } }),
  ).toMatchObject({ role: "owner" });
});
it("rejects a duplicate slug", async () => {
  await expect(
    call().createOrganization({ name: "Dup", slug: "org", addSelfAsOwner: false }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
```

- [ ] **Step 3: Run → FAIL.** → **Step 4: Implement `createOrganization`.** → **Step 5: Run → PASS.**

- [ ] **Step 6: Build `create-organization-dialog.tsx`** per `docs/patterns/mutation-dialog.md` — `?action=create`, `react-hook-form` + zod, name + slug (auto-slugify from name, editable) + "Add me as owner" checkbox. `meta.effects` invalidates `listOrganizations`; `onSuccess` routes to `/system-admin/organizations/[id]`.

- [ ] **Step 7: Add the button to `organizations-list.tsx` `Saratoga.Actions`.**

- [ ] **Step 8: `npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 9: Commit** `feat(system-admin): create organization from the list (#79)`

---

## Phase 5 — Organization detail page (#80)

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts` — add `getOrganization`
- Create: `src/app/(authenticated)/system-admin/organizations/[organizationId]/page.tsx`
- Create: `src/components/system-admin/organizations/organization-content.tsx` — `"use client"`
- Test: extend router test

**Interfaces:**

- Produces:
  - `systemAdmin.getOrganization({ organizationId })` → `{ id; name; slug; logo; createdAt; members: Array<{ userId; name; email; role }>; teams: Array<{ id; name; memberCount }>; enabledModules: ModuleId[]; d4hTokenCount: number; recordCounts: Record<string, number> }`; `NOT_FOUND` for unknown id.
  - Route `/system-admin/organizations/[organizationId]`
  - Component `SystemAdmin_Organization_Content`

- [ ] **Step 1: Write failing tests** — `getOrganization` returns aggregated data (members, teams, modules, counts); throws `NOT_FOUND` for an unknown id.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `getOrganization`** — one `findUnique` with nested `include`/`_count`: members (+ `user` select), teams (+ `_count` on memberships), `configs`, `_count` for `d4hAccessTokens` and the owned-record relations (personnel, skillChecks, notes, …). Map `configs` through `OrganizationSettings.fromRecords`.

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Build `page.tsx`** per `docs/patterns/detail-page-data-fetching.md` — `generateMetadata` via `fetchQuery(trpc.systemAdmin.getOrganization.queryOptions({ organizationId }))`; body `prefetch` + `<HydrateClient>`.

- [ ] **Step 6: Build `organization-content.tsx`** — `Saratoga.Columns`: main = identity card + members table + teams list; secondary = enabled modules, D4H token count, record counts. Members rows link to `/system-admin/users/[user_id]`. Prominent link to the in-org `/orgs/[slug]/admin`.

- [ ] **Step 7: Wire `organizations-list.tsx` rows + `user-content.tsx` membership rows to link here.**

- [ ] **Step 8: `npx next typegen && npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 9: Commit** `feat(system-admin): organization detail page (#80)`

---

## Phase 6 — Assign / remove organization members (#81)

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts` — add `addOrganizationMember`, `removeOrganizationMember`, `setOrganizationMemberRole`
- Create: `src/components/system-admin/organizations/add-member-dialog.tsx` — `?action=add-member`
- Create: `src/components/system-admin/organizations/member-actions-menu.tsx` — per-row remove / change role
- Modify: `organization-content.tsx` — wire the members table actions
- Test: extend router test

**Interfaces:**

- Consumes: `systemAdmin.listUsers` (user picker), `systemAdmin.getOrganization`
- Produces:
  - `systemAdmin.addOrganizationMember({ organizationId, userId, role })` → `{ id }` — `CONFLICT` if already a member; creates `OrganizationUser` (`id: nanoId16()`); `ctx.logEvent`
  - `systemAdmin.removeOrganizationMember({ organizationId, userId })` → `{ ok: true }` — `BAD_REQUEST` if removing the last owner
  - `systemAdmin.setOrganizationMemberRole({ organizationId, userId, role })` → `{ id, role }` — `BAD_REQUEST` if demoting the last owner
  - shared helper `assertNotLastOwner(prisma, organizationId, userId)`

- [ ] **Step 1: Write failing tests**

```ts
it("adds an existing user as a member", async () => {
  await call().addOrganizationMember({ organizationId: T.org, userId: T.u2, role: "member" });
  expect(
    await db.organizationUser.findFirst({ where: { organizationId: T.org, userId: T.u2 } }),
  ).toMatchObject({ role: "member" });
});
it("rejects adding a user who is already a member", async () => {
  await expect(
    call().addOrganizationMember({ organizationId: T.org, userId: T.u1, role: "member" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("refuses to remove the last owner", async () => {
  await expect(
    call().removeOrganizationMember({ organizationId: T.org, userId: T.owner }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
it("refuses to demote the last owner", async () => {
  await expect(
    call().setOrganizationMemberRole({ organizationId: T.org, userId: T.owner, role: "member" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
```

- [ ] **Step 2: Run → FAIL.** → **Step 3: Implement the three procedures + helper** (alphabetical order). → **Step 4: Run → PASS.**

- [ ] **Step 5: Build `add-member-dialog.tsx`** — `?action=add-member`; a `Command` combobox over `systemAdmin.listUsers` filtered to non-members; role `Select`. `meta.effects` invalidates `getOrganization`.

- [ ] **Step 6: Build `member-actions-menu.tsx`** — "Change role" (`?action=set-member-role`), "Remove" (`?action=remove-member`, destructive) — both confirm dialogs.

- [ ] **Step 7: Wire into the members table in `organization-content.tsx`.**

- [ ] **Step 8: `npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 9: Commit** `feat(system-admin): assign/remove organization members (#81)`

---

## Phase 7 — Edit organization settings from system-admin (#82)

**Files:**

- Modify: `src/server/organization-settings.ts` — confirm `getOrganizationSettings(organizationId)` / `revalidateOrganizationSettings(...)` key purely on `organizationId`; extract `writeOrganizationSettings(prisma, organizationId, settings)` if the write is currently inline in a router
- Refactor: settings form components out of `src/app/(authenticated)/orgs/[slug]/admin/organization/settings/` into `src/components/admin/organization/settings/`, parameterised by `{ organizationId, settings, onSubmit }` instead of `useOrganization()`
- Modify: `src/app/(authenticated)/orgs/[slug]/admin/organization/settings/page.tsx` — consume the extracted components (no behavior change)
- Modify: `src/trpc/routers/system-admin-router.ts` — add `getOrganizationSettings`, `updateOrganizationSettings`
- Create: `src/app/(authenticated)/system-admin/organizations/[organizationId]/settings/page.tsx` + content component
- Test: extend router test; keep existing org-settings tests green

**Interfaces:**

- Produces:
  - `systemAdmin.getOrganizationSettings({ organizationId })` → `OrganizationSettings`
  - `systemAdmin.updateOrganizationSettings({ organizationId, settings })` → `OrganizationSettings` — validates against `organizationSettingsSchema`, writes via `writeOrganizationSettings`, `revalidateOrganizationSettings`, `ctx.logEvent` against the org
  - shared component `<OrganizationSettingsForm organizationId settings onSubmit />` used by both the in-org page and the system-admin page

- [ ] **Step 1: Map the current write path** — find where the in-org settings page persists changes (`settings-router.ts` / `organizations-router.updateOrganization` / inline). Identify the function turning an `OrganizationSettings` object into `OrganizationConfig` upserts; extract to `src/server/organization-settings.ts` as `writeOrganizationSettings` if inline.

- [ ] **Step 2: Write a failing test** — `systemAdmin.updateOrganizationSettings` enables a module for an org the caller is not a member of.

```ts
it("enables a module for an org the admin does not belong to", async () => {
  const next = OrganizationSettings.default();
  next.modules.notes.enabled = true;
  const result = await callAs(T.outsiderAdmin).updateOrganizationSettings({
    organizationId: T.org,
    settings: next,
  });
  expect(result.modules.notes.enabled).toBe(true);
});
```

- [ ] **Step 3: Run → FAIL.** → **Step 4: Implement `getOrganizationSettings` / `updateOrganizationSettings`** using the extracted helper + `OrganizationSettings.fromRecords`. → **Step 5: Run → PASS**, and re-run the existing suite: `npm run test:run -- organization-settings settings-router organizations-router` — must stay green.

- [ ] **Step 6: Extract `<OrganizationSettingsForm>`** — move form JSX/logic to a shared component taking `organizationId` + `settings` + `onSubmit(settings)`; in-org page passes a callback hitting the existing mutation, system-admin page passes one hitting `systemAdmin.updateOrganizationSettings`.

- [ ] **Step 7: Rewire the in-org settings page** to the extracted component; verify no visual/behavior change (manual + existing tests).

- [ ] **Step 8: Build the system-admin settings page** at `/system-admin/organizations/[organizationId]/settings` — `prefetch` + `HydrateClient` + `useSuspenseQuery(trpc.systemAdmin.getOrganizationSettings...)`. Add a "Settings" link on the Phase 5 detail page.

- [ ] **Step 9: `npx next typegen && npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 10: Commit** `feat(system-admin): edit organization settings from system-admin (#82)`

---

## Phase 8 — Hard-delete a user account (#16)

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts` — add `deleteUser`
- Create: `src/components/system-admin/users/delete-user-dialog.tsx` — `?action=delete`, type-to-confirm
- Modify: `user-actions-menu.tsx` — add the "Delete user" item
- Modify: `user-content.tsx` if needed
- Possibly: `prisma/schema.prisma` migration for FK cascades
- Test: extend router test

**Interfaces:**

- Produces: `systemAdmin.deleteUser({ userId })` → `{ id }`. Refuses self; refuses the last admin; refuses a sole org owner (`BAD_REQUEST` listing the orgs — operator must transfer via Phase 6 or delete the org). Deletes `User`; explicit deletes in the `$transaction` for any relation not `onDelete: Cascade`.

- [ ] **Step 1: Audit `schema.prisma`** for the FK behavior of every relation pointing at `User` (`Account`, `Session`, `OrganizationUser`, `TeamUser`, invitations, log entries, …). Note which cascade and which need explicit deletes. If a migration is needed: `npm run prisma migrate dev --name user_delete_cascades`.

- [ ] **Step 2: Write failing tests**

```ts
it("deletes a user and their memberships", async () => {
  await call().deleteUser({ userId: T.u2 });
  expect(await db.user.findUnique({ where: { id: T.u2 } })).toBeNull();
});
it("refuses to delete a sole organization owner", async () => {
  await expect(call().deleteUser({ userId: T.owner })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});
it("refuses to delete yourself", async () => {
  await expect(call().deleteUser({ userId: T.admin })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});
```

- [ ] **Step 3: Run → FAIL.**

- [ ] **Step 4: Implement `deleteUser`** — self-check; last-admin check (`prisma.user.count({ where: { role: "admin", id: { not: input.userId } } })`); sole-owner check (per org owned, count other owners); then `ctx.prisma.$transaction([...explicit deletes..., ctx.prisma.user.delete(...)])`.

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: Build `delete-user-dialog.tsx`** — `?action=delete`, requires typing the user's email to enable the destructive button; `meta.effects` invalidates `listUsers`; `onSuccess` navigates to `/system-admin/users`.

- [ ] **Step 7: Add the "Delete user" item to `user-actions-menu.tsx`** (destructive styling, hidden for self).

- [ ] **Step 8: `npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 9: Commit** `feat(system-admin): hard-delete user accounts (#16)`

---

## Phase 9 — Per-user actions dropdown + impersonate (#12) — lower priority

**Files:**

- Modify: `src/client/auth-client.ts` — ensure `adminClient()` in `plugins`
- Modify: `src/server/auth.ts` — `admin({ impersonationSessionDuration })` only if a non-default is wanted (optional)
- Modify: `src/components/system-admin/users/user-actions-menu.tsx` — add "Impersonate"
- Create: `src/components/system-admin/users/impersonate-user-dialog.tsx` — `?action=impersonate` confirm
- Modify: `src/components/system-admin/users/users-list.tsx` — add the actions column

**Interfaces:**

- Consumes: `authClient.admin.impersonateUser({ userId })` / `stopImpersonating()`
- Produces: `?action=impersonate` dialog — on confirm `await authClient.admin.impersonateUser({ userId }); router.push("/")`. No tRPC procedure (Better Auth owns the impersonation session).

- [ ] **Step 1: Confirm `authClient.admin.impersonateUser` / `stopImpersonating` exist** — add `adminClient()` to `src/client/auth-client.ts` `plugins` if missing.

- [ ] **Step 2: Build `impersonate-user-dialog.tsx`** per `docs/patterns/mutation-dialog.md` — `?action=impersonate`, confirm copy, `onConfirm` calls the client method then `router.push("/")`.

- [ ] **Step 3: Add "Impersonate" to `user-actions-menu.tsx`** (hidden when the row user is the current user).

- [ ] **Step 4: Add the actions column to `users-list.tsx`** (icon button → the same menu).

- [ ] **Step 5: `npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 6: Manual check** — impersonate a user, confirm the session switches (Stop path is Phase 10).

- [ ] **Step 7: Commit** `feat(system-admin): user actions dropdown + impersonate (#12)`

---

## Phase 10 — App-wide impersonation banner (#13) — lower priority

**Files:**

- Create: `src/components/system-admin/impersonation-banner.tsx` — `"use client"`
- Create: `src/components/system-admin/impersonation-banner.test.tsx`
- Modify: `src/app/(authenticated)/layout.tsx` — render the banner above `{children}`

**Interfaces:**

- Consumes: the client session — Better Auth marks an impersonated session with `session.session.impersonatedBy` (verify field name during a live impersonation)
- Produces: `<ImpersonationBanner />` — `null` unless impersonating; otherwise a sticky `bg-warning` bar with the impersonated user's name/email + "Stop impersonating" → `authClient.admin.stopImpersonating()` then `router.push("/system-admin/users")`

- [ ] **Step 1: Confirm the impersonation marker field** on the client session (log it during a Phase 9 impersonation).

- [ ] **Step 2: Write a component test** — render with a mocked session hook returning `impersonatedBy: "admin-id"` → banner text renders; without it → renders `null`.

- [ ] **Step 3: Run → FAIL.** → **Step 4: Implement `impersonation-banner.tsx`.** → **Step 5: Run → PASS.**

- [ ] **Step 6: Mount in `src/app/(authenticated)/layout.tsx`** above `{children}` (covers org and system-admin pages alike).

- [ ] **Step 7: `npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 8: Manual check** — impersonate → banner everywhere → Stop → clears.

- [ ] **Step 9: Commit** `feat(system-admin): app-wide impersonation banner (#13)`

---

## Phase 11 — Promote / demote global admin role (#14) — lower priority

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts` — add `setUserRole`
- Create: `src/components/system-admin/users/set-user-role-dialog.tsx` — `?action=promote` / `?action=demote`
- Modify: `user-actions-menu.tsx` — add the items
- Test: extend router test

**Interfaces:**

- Produces: `systemAdmin.setUserRole({ userId, role: "admin" | "user" })` → `{ id, role }`. Refuses to change your own role; refuses to demote the last admin. See Step 1 re: audit logging.

- [ ] **Step 1: Check the logging model** — `OrganizationLogEntry` requires `organizationId`, so global-role changes have no home in it. If no system-level audit log exists, add a code comment noting global-role changes are not yet audited (a system audit log is a separate deferred issue on #78) and skip `ctx.logEvent` for this procedure.

- [ ] **Step 2: Write failing tests**

```ts
it("promotes a user to admin", async () => {
  const { role } = await call().setUserRole({ userId: T.u2, role: "admin" });
  expect(role).toBe("admin");
});
it("refuses to change your own role", async () => {
  await expect(call().setUserRole({ userId: T.admin, role: "user" })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});
it("refuses to demote the last admin", async () => {
  // with T.admin the only admin, demoting any other admin-less state
  await expect(
    callAs(T.otherAdmin).setUserRole({ userId: T.otherAdmin, role: "user" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" }); // caught by the self-check first; add a dedicated last-admin case with two admins
});
```

- [ ] **Step 3: Run → FAIL.** → **Step 4: Implement `setUserRole`** — `input.userId !== ctx.session.user.id`; if `role === "user"`, `prisma.user.count({ where: { role: "admin", id: { not: input.userId } } })` must be `> 0`; `prisma.user.update`. → **Step 5: Run → PASS.**

- [ ] **Step 6: Build `set-user-role-dialog.tsx`** — one component parsing `["promote", "demote"]`; confirm copy differs by action; `trpc.systemAdmin.setUserRole` mutation with `meta.effects` invalidating `listUsers` + `getUser`.

- [ ] **Step 7: Wire menu items** — Promote when `role !== "admin"`, Demote when `role === "admin"` && not self.

- [ ] **Step 8: `npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 9: Commit** `feat(system-admin): promote/demote global admin role (#14)`

---

## Phase 12 — Ban / unban a user account (#15) — lower priority

**Files:**

- Modify: `src/client/auth-client.ts` — `adminClient()` already added in Phase 9
- Create: `src/components/system-admin/users/ban-user-dialog.tsx` — `?action=ban` / `?action=unban`
- Modify: `user-actions-menu.tsx` — add the items
- Modify: `users-list.tsx` — "Banned" badge already added in Phase 2

**Interfaces:**

- Consumes: `authClient.admin.banUser({ userId, banReason })` / `authClient.admin.unbanUser({ userId })` — used directly (not tRPC) so Better Auth revokes the banned user's sessions
- Produces: `?action=ban` (optional reason textarea) / `?action=unban` (plain confirm) dialogs

- [ ] **Step 1: Confirm `authClient.admin.banUser` / `unbanUser` signatures.**

- [ ] **Step 2: Build `ban-user-dialog.tsx`** — `?action=ban` with an optional reason; `?action=unban` plain confirm. `onSuccess` → explicit `queryClient.invalidateQueries` for the `systemAdmin.listUsers` / `systemAdmin.getUser` query keys (these are `authClient` calls, so `meta.effects` doesn't apply — mirror the invalidation style in `src/components/admin/users/users-list.tsx`).

- [ ] **Step 3: Wire menu items** — Ban when `!banned && !self`, Unban when `banned`.

- [ ] **Step 4: Add a component test** for the dialog's `?action=` open/close + disabled-while-pending, following any existing dialog test; if none exist, a manual check suffices (note it).

- [ ] **Step 5: `npx tsc --noEmit && npm run test:run` green.**

- [ ] **Step 6: Manual check** — ban a test user → they're signed out / cannot sign in; unban restores.

- [ ] **Step 7: Commit** `feat(system-admin): ban/unban user accounts (#15)`

---

## Self-Review notes

- **Spec coverage:** Phases 1–12 map 1:1 to #10, #11, #77, #79, #80, #81, #82, #16, #12, #13, #14, #15 — the user's priority order (org management before the deferred user actions). All #78 children covered. Deferred #78 items (system dashboard, cross-org audit log) are out of scope; the audit-log gap surfaces in Phase 11 where system-level `logEvent` has no home — flagged with a code comment there.
- **Sequencing fix vs. the original draft:** the user detail page + `getUser` moved into Phase 2 (#11) so the list's name-column links resolve and Phase 8 (#16, now ahead of #12) has a page to host its menu. `user-actions-menu.tsx` is created empty in Phase 2; Phases 8–12 each add one item.
- **PR B holds Phase 2** (not PR C) because Phase 6's add-member dialog consumes `systemAdmin.listUsers` and Phase 8 hosts its menu on the Phase 2 detail page. PR C is purely the deferred low-priority user actions (#12–15).
- **Type consistency:** `systemAdminProcedure`, `requireGlobalAdmin`, `OrganizationSettings.fromRecords/.default/.flatten`, `writeOrganizationSettings`, `assertNotLastOwner`, `Modules["system-admin"]`, and the `systemAdmin.*` procedure names are used consistently across phases.
- **Open verifications the executor must resolve (each noted in its phase, not a blocker to starting):**
  1. `User` ↔ `OrganizationUser` relation name (`organizationUsers`?) — Phases 2, 3.
  2. `onDelete` behavior of every FK into `User` — Phase 8 Step 1 (may need a migration).
  3. Whether `OrganizationLogEntry` can represent a system-level (org-less) event — Phase 11.
  4. Better Auth client `adminClient()` plugin presence + `impersonateUser`/`banUser`/`unbanUser`/`stopImpersonating` signatures + the `impersonatedBy` session field — Phases 9, 10, 12.
  5. The current in-org settings write path / whether a reusable write helper exists — Phase 7 Step 1.
  6. How #6's create-org flow seeds default `OrganizationConfig` — Phase 4 Step 1.
- **Scope:** a roadmap across two subsystems. With subagents, treat each Phase as an independently reviewable unit; Phases 2 and 3 can run on parallel branches off Phase 1. The org-management track (3→7) is the priority; the user-action track (9→12) is deferred and can slip without blocking anything except each other.
