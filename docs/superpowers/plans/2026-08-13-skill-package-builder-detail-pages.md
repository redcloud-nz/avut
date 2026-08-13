# Skill Package Builder detail pages → standard pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the three `skill-package-builder` entity detail pages (package, group,
skill) in line with `docs/patterns/detail-page-data-fetching.md`: thin server `page.tsx`
shells with `generateMetadata` + `prefetch`, client content components that own
`useSuspenseQuery`, and page-specific components relocated out of the route folders into
`src/components/skill-package-builder/`.

**Architecture:** Add three single-entity `get*` tRPC queries (`getPackage`, `getGroup`,
`getSkill`) to replace the current `list* + Array.find` hooks. Rewrite each of the three
`page.tsx` files as async server shells that call `generateMetadata`/`prefetch`. Move
every page-specific component (menus, dialogs, list cards) into
`src/components/skill-package-builder/`, flat, prefixed by entity name — mirroring
`src/components/admin/teams/`. Delete the now-unused `useSkillPackage`/`useSkillGroup`/
`useSkill` hooks. Update mutations that already return the full updated entity to also
`setQueryData` the new detail query, so edits/archives/etc. reflect on screen without a
`router.refresh()`.

**Tech Stack:** Next.js 16 App Router, tRPC 11 + React Query 5, Zod 4, Prisma 7, Vitest +
prisma-mock.

**Spec:** `docs/patterns/detail-page-data-fetching.md`

## Global Constraints

- Follow `docs/patterns/detail-page-data-fetching.md` exactly for the `page.tsx` /
  `<entity>-content.tsx` split — no shared `resolveX` helper, no `<Suspense>` wrapper
  (`Std.SidebarInset` already provides one), content component owns `Std.Navbar` +
  `Std.ScrollContainer`.
- New components live in `src/components/skill-package-builder/`, flat, one file per
  responsibility, named `<entity>-<thing>.tsx` (e.g. `package-menu.tsx`,
  `group-content.tsx`) — no per-entity subfolders.
- `organizationProcedure` router files keep procedures alphabetical
  (`src/trpc/routers/skill-package-builder-router.ts`).
- Use `nanoId16()`/`.create()` id helpers, `route()` for dynamic links, Zod 4 syntax —
  per `AGENTS.md`.
- Router tests use `createMockPrisma` + `createAuthenticatedMockContext`, one
  `describe` per procedure, seeded once in `beforeAll` — per `AGENTS.md` testing
  conventions.

---

## File Structure

```
src/trpc/routers/skill-package-builder-router.ts        # + getPackage, getGroup, getSkill
src/trpc/routers/skill-package-builder-router.test.ts    # new — tests for the 3 new queries

src/components/skill-package-builder/                    # new directory
    package-content.tsx      # new — package detail body (was packages/[package_id]/page.tsx)
    package-menu.tsx         # moved from packages/[package_id]/package-menu.tsx
    package-contents.tsx     # moved from packages/[package_id]/package-contents.tsx
    update-package.tsx       # moved from packages/[package_id]/update-package.tsx
    delete-package.tsx       # moved from packages/[package_id]/delete-package.tsx
    reorder-groups.tsx       # moved from packages/[package_id]/reorder-groups.tsx
    create-package.tsx       # moved from packages/create-package.tsx
    packages-list.tsx        # moved from packages/packages-list.tsx

    group-content.tsx        # new — group detail body (was .../groups/[group_id]/page.tsx)
    group-menu.tsx           # moved from .../groups/[group_id]/group-menu.tsx
    group-contents.tsx       # moved from .../groups/[group_id]/group-contents.tsx
    update-group.tsx         # moved from .../groups/[group_id]/update-group.tsx
    delete-group.tsx         # moved from .../groups/[group_id]/delete-group.tsx
    reorder-skills.tsx       # moved from .../groups/[group_id]/reorder-skills.tsx
    create-group.tsx         # moved from .../groups/create-group.tsx

    skill-content.tsx        # new — skill detail body (was .../skills/[skill_id]/page.tsx)
    skill-menu.tsx           # moved from .../skills/[skill_id]/skill-menu.tsx
    update-skill.tsx         # moved from .../skills/[skill_id]/update-skill.tsx
    delete-skill.tsx         # moved from .../skills/[skill_id]/delete-skill.tsx
    move-skill.tsx           # moved from .../skills/[skill_id]/move-skill.tsx
    create-skill.tsx         # moved from .../skills/create-skill.tsx

src/app/(authenticated)/orgs/[slug]/skill-package-builder/
    page.tsx                                              # update import of packages-list
    packages/[package_id]/page.tsx                        # rewritten — thin server shell
    packages/[package_id]/contents/page.tsx                # update — use getPackage, not the deleted hook
    packages/[package_id]/history/page.tsx                  # update — use getPackage, not the deleted hook
    packages/[package_id]/groups/[group_id]/page.tsx       # rewritten — thin server shell
    packages/[package_id]/skills/[skill_id]/page.tsx       # rewritten — thin server shell

src/hooks/use-skill-package.ts   # deleted
src/hooks/use-skill-group.ts     # deleted
src/hooks/use-skill.tsx          # deleted
```

---

### Task 1: Add `getPackage`, `getGroup`, `getSkill` queries

**Files:**

- Modify: `src/trpc/routers/skill-package-builder-router.ts`
- Test: `src/trpc/routers/skill-package-builder-router.test.ts` (new)

**Interfaces:**

- Produces: `trpc.skillPackageBuilder.getPackage` — input
  `{ skillPackageId: SkillPackageId }`, output `SkillPackage.schema`.
- Produces: `trpc.skillPackageBuilder.getGroup` — input `{ skillGroupId: SkillGroupId }`,
  output `SkillGroup.schema.extend({ skillPackage: SkillPackage.schema })`.
- Produces: `trpc.skillPackageBuilder.getSkill` — input `{ skillId: SkillId }`, output
  `Skill.schema.extend({ skillGroup: SkillGroup.schema, skillPackage: SkillPackage.schema })`.
- All three permission-gated on `skillPackageBuilder: ["view"]`, org-scoped, throwing
  `TRPCError({ code: "NOT_FOUND" })` via the existing `Messages.skillPackageNotFound` /
  `Messages.skillGroupNotFound` / `Messages.skillNotFound` helpers.

- [ ] **Step 1: Write the failing router tests**

Create `src/trpc/routers/skill-package-builder-router.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// skill-package-builder-router reaches @/server/auth at import time via ../init. The
// procedures under test only touch ctx.prisma (the injected mock), so stubbing
// server-only is enough to let the module load under jsdom.
vi.mock("server-only", () => ({}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillPackageBuilderRouter } from "./skill-package-builder-router";

describe("skillPackageBuilderRouter.getPackage / getGroup / getSkill", () => {
  const T = {
    org: OrganizationId.create(),
    otherOrg: OrganizationId.create(),
    user: nanoId16(),
    pkg: SkillPackageId.create(),
    otherOrgPkg: SkillPackageId.create(),
    group: SkillGroupId.create(),
    skill: SkillId.create(),
  };

  const db = createMockPrisma();

  beforeAll(async () => {
    await db.organization.create({
      data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
    });
    await db.organization.create({
      data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
    });
    await db.skillPackage.create({
      data: {
        id: T.pkg,
        organizationId: T.org,
        name: "Rescue Skills",
        description: "",
        properties: {},
        tags: [],
      },
    });
    await db.skillPackage.create({
      data: {
        id: T.otherOrgPkg,
        organizationId: T.otherOrg,
        name: "Other Org Package",
        description: "",
        properties: {},
        tags: [],
      },
    });
    await db.skillGroup.create({
      data: {
        id: T.group,
        skillPackageId: T.pkg,
        name: "Rope Access",
        description: "",
        properties: {},
        tags: [],
        sequence: 1,
      },
    });
    await db.skill.create({
      data: {
        id: T.skill,
        skillPackageId: T.pkg,
        skillGroupId: T.group,
        name: "Tie a Bowline",
        description: "",
        properties: {},
        tags: [],
        sequence: 1,
      },
    });
  });

  function makeCaller() {
    return skillPackageBuilderRouter.createCaller(
      createAuthenticatedMockContext({
        user: { id: T.user },
        permissions: { skillPackageBuilder: ["view"], organization: ["view"] },
        prisma: db,
      }),
    );
  }

  it("getPackage returns the package", async () => {
    const result = await makeCaller().getPackage({
      organizationId: T.org,
      skillPackageId: T.pkg,
    });
    expect(result.id).toBe(T.pkg);
    expect(result.name).toBe("Rescue Skills");
  });

  it("getPackage throws NOT_FOUND for a package in another organization", async () => {
    await expect(
      makeCaller().getPackage({ organizationId: T.org, skillPackageId: T.otherOrgPkg }),
    ).rejects.toThrow(/not found/i);
  });

  it("getGroup returns the group with its parent package", async () => {
    const result = await makeCaller().getGroup({
      organizationId: T.org,
      skillGroupId: T.group,
    });
    expect(result.id).toBe(T.group);
    expect(result.skillPackage.id).toBe(T.pkg);
    expect(result.skillPackage.name).toBe("Rescue Skills");
  });

  it("getGroup throws NOT_FOUND for an unknown group", async () => {
    await expect(
      makeCaller().getGroup({ organizationId: T.org, skillGroupId: SkillGroupId.create() }),
    ).rejects.toThrow(/not found/i);
  });

  it("getSkill returns the skill with its parent group and package", async () => {
    const result = await makeCaller().getSkill({
      organizationId: T.org,
      skillId: T.skill,
    });
    expect(result.id).toBe(T.skill);
    expect(result.skillGroup.id).toBe(T.group);
    expect(result.skillPackage.id).toBe(T.pkg);
  });

  it("getSkill throws NOT_FOUND for an unknown skill", async () => {
    await expect(
      makeCaller().getSkill({ organizationId: T.org, skillId: SkillId.create() }),
    ).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/trpc/routers/skill-package-builder-router.test.ts`
Expected: FAIL — `getPackage is not a function` (procedures don't exist yet).

- [ ] **Step 3: Add the three procedures**

In `src/trpc/routers/skill-package-builder-router.ts`, insert immediately after
`deleteSkill` and before `listGroups` (keeps the block alphabetical: `getGroup`,
`getPackage`, `getSkill` come before `listGroups`):

```ts
    /**
     * Get a single skill group by ID, including its parent skill package.
     * @param skillGroupId The ID of the skill group to retrieve.
     * @returns The skill group with its parent skill package.
     * @throws TRPCError(NOT_FOUND) if the skill group does not exist or does not belong to the organization.
     */
    getGroup: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(z.object({ skillGroupId: SkillGroupId.schema }))
        .output(SkillGroup.schema.extend({ skillPackage: SkillPackage.schema }))
        .query(async ({ ctx, input: { organizationId, skillGroupId } }) => {
            const group = await ctx.prisma.skillGroup.findUnique({
                where: {
                    id: skillGroupId,
                    skillPackage: { organizationId },
                },
                include: { skillPackage: true },
            });

            if (!group) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillGroupNotFound(skillGroupId),
                });
            }

            return {
                ...SkillGroup.fromRecord(group),
                skillPackage: SkillPackage.fromRecord(group.skillPackage),
            };
        }),

    /**
     * Get a single skill package by ID.
     * @param skillPackageId The ID of the skill package to retrieve.
     * @returns The skill package.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or does not belong to the organization.
     */
    getPackage: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(SkillPackage.schema)
        .query(async ({ ctx, input: { skillPackageId } }) => getSkillPackageOrThrow(ctx, skillPackageId)),

    /**
     * Get a single skill by ID, including its parent skill group and skill package.
     * @param skillId The ID of the skill to retrieve.
     * @returns The skill with its parent skill group and skill package.
     * @throws TRPCError(NOT_FOUND) if the skill does not exist or does not belong to the organization.
     */
    getSkill: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(z.object({ skillId: SkillId.schema }))
        .output(
            Skill.schema.extend({
                skillGroup: SkillGroup.schema,
                skillPackage: SkillPackage.schema,
            }),
        )
        .query(async ({ ctx, input: { organizationId, skillId } }) => {
            const skill = await ctx.prisma.skill.findUnique({
                where: {
                    id: skillId,
                    skillPackage: { organizationId },
                },
                include: { skillGroup: true, skillPackage: true },
            });

            if (!skill) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillNotFound(skillId),
                });
            }

            return {
                ...Skill.fromRecord(skill),
                skillGroup: SkillGroup.fromRecord(skill.skillGroup),
                skillPackage: SkillPackage.fromRecord(skill.skillPackage),
            };
        }),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/trpc/routers/skill-package-builder-router.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `skill-package-builder-router.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/skill-package-builder-router.ts src/trpc/routers/skill-package-builder-router.test.ts
git commit -m "Add getPackage/getGroup/getSkill queries to skill-package-builder router"
```

---

### Task 2: Package detail page → thin shell + `package-content.tsx`

**Files:**

- Create: `src/components/skill-package-builder/package-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/page.tsx`
- Move: `packages/[package_id]/package-menu.tsx` → `src/components/skill-package-builder/package-menu.tsx`
- Move: `packages/[package_id]/package-contents.tsx` → `src/components/skill-package-builder/package-contents.tsx`
- Move: `packages/[package_id]/update-package.tsx` → `src/components/skill-package-builder/update-package.tsx`
- Move: `packages/[package_id]/delete-package.tsx` → `src/components/skill-package-builder/delete-package.tsx`
- Move: `packages/[package_id]/reorder-groups.tsx` → `src/components/skill-package-builder/reorder-groups.tsx`
- Move: `packages/create-package.tsx` → `src/components/skill-package-builder/create-package.tsx`
- Move: `packages/packages-list.tsx` → `src/components/skill-package-builder/packages-list.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-package-builder/page.tsx` (import path)

**Interfaces:**

- Consumes: `trpc.skillPackageBuilder.getPackage` from Task 1.
- Produces: `SkillPackageBuilder_Package_Content({ skillPackageId: SkillPackageId })` — the
  package detail body, used by the new `page.tsx`.

- [ ] **Step 1: Move the package-scoped components**

```bash
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/package-menu.tsx" src/components/skill-package-builder/package-menu.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/package-contents.tsx" src/components/skill-package-builder/package-contents.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/update-package.tsx" src/components/skill-package-builder/update-package.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/delete-package.tsx" src/components/skill-package-builder/delete-package.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/reorder-groups.tsx" src/components/skill-package-builder/reorder-groups.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/create-package.tsx" src/components/skill-package-builder/create-package.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/packages-list.tsx" src/components/skill-package-builder/packages-list.tsx
```

- [ ] **Step 2: Fix the moved files' relative imports**

In `src/components/skill-package-builder/package-menu.tsx`, the import of the delete
dialog is already `./delete-package` — no change needed (both files moved together).

In `src/components/skill-package-builder/package-contents.tsx`, update the two relative
imports (still correct as `./reorder-groups` and `./groups/create-group` before the
move — the second one changes since `groups/create-group.tsx` becomes a flat sibling in
Task 3):

```tsx
import { SkillPackageBuilder_ReorderGroups_Dialog } from "./reorder-groups";
import { SkillPackageBuilder_CreateGroup_Dialog } from "./create-group";
```

In `src/components/skill-package-builder/packages-list.tsx`, the import of
`./create-package` is unchanged (both moved together).

- [ ] **Step 3: Create `package-content.tsx`**

Create `src/components/skill-package-builder/package-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Package_Contents_List } from "./package-contents";
import { SkillPackageBuilder_Package_Menu } from "./package-menu";
import { SkillPackageBuilder_UpdatePackage_Dialog } from "./update-package";

export function SkillPackageBuilder_Package_Content({
  skillPackageId,
}: {
  skillPackageId: SkillPackageId;
}) {
  const organization = useOrganization();

  const { data: skillPackage } = useSuspenseQuery(
    trpc.skillPackageBuilder.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Package Builder",
            href: route("/orgs/[slug]/skill-package-builder", {
              slug: organization.slug,
            }),
          },
          skillPackage.name,
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>{skillPackage.name}</Saratoga.Title>
            <Saratoga.Actions>
              <SkillPackageBuilder_Package_Menu skillPackage={skillPackage} />
            </Saratoga.Actions>
          </Saratoga.Header>
          <Saratoga.Columns>
            <Saratoga.Column slot="main">
              <Card>
                <CardHeader>
                  <CardTitle>Package Details</CardTitle>
                  <CardAction>
                    <Protect permissions={{ skillPackageBuilder: ["update"] }}>
                      <SkillPackageBuilder_UpdatePackage_Dialog skillPackage={skillPackage} />
                    </Protect>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <DL>
                    <DLTerm>Package ID</DLTerm>
                    <DLDetails>{skillPackage.id}</DLDetails>
                    <DLTerm>Name</DLTerm>
                    <DLDetails>{skillPackage.name}</DLDetails>
                    <DLTerm>Description</DLTerm>
                    <DLDetails>{skillPackage.description}</DLDetails>
                    <DLTerm>Status</DLTerm>
                    <DLDetails>{skillPackage.status}</DLDetails>
                    <DLTerm>Published</DLTerm>
                    <DLDetails>{skillPackage.published ? "Yes" : "No"}</DLDetails>
                  </DL>
                </CardContent>
              </Card>
              <SkillPackageBuilder_Package_Contents_List skillPackage={skillPackage} />
            </Saratoga.Column>
            <Saratoga.Column slot="secondary">
              <Card>
                <CardContent>
                  <DL>
                    <DLTerm>Created</DLTerm>
                    <DLDetails>
                      <div>{formatDateTime(skillPackage.createdAt)}</div>
                      <div className="text-muted-foreground">
                        {formatRelativeDateTime(skillPackage.createdAt)}
                      </div>
                    </DLDetails>
                    <DLTerm>Updated</DLTerm>
                    <DLDetails>
                      <div>{formatDateTime(skillPackage.updatedAt)}</div>
                      <div className="text-muted-foreground">
                        {formatRelativeDateTime(skillPackage.updatedAt)}
                      </div>
                    </DLDetails>
                  </DL>
                </CardContent>
              </Card>
            </Saratoga.Column>
          </Saratoga.Columns>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

- [ ] **Step 4: Rewrite `page.tsx` as a thin server shell**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]
 */

import { Metadata } from "next";

import { SkillPackageBuilder_Package_Content } from "@/components/skill-package-builder/package-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, package_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillPackageId = SkillPackageId.schema.parse(package_id);
  const skillPackage = await fetchQuery(
    trpc.skillPackageBuilder.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );

  return { title: `${skillPackage.name} ${TITLE_SEPARATOR} Skill Package Builder` };
}

export default async function SkillPackageBuilder_Package_Page(props: Props) {
  const { slug, package_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillPackageId = SkillPackageId.schema.parse(package_id);

  prefetch(
    trpc.skillPackageBuilder.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );
  prefetch(
    trpc.skillPackageBuilder.listGroups.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );
  prefetch(
    trpc.skillPackageBuilder.listSkills.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillPackageBuilder_Package_Content skillPackageId={skillPackageId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 5: Update the top-level index page's import**

In `src/app/(authenticated)/orgs/[slug]/skill-package-builder/page.tsx`, change:

```tsx
import { SkillPackageBuilder_Packages_List } from "./packages/packages-list";
```

to:

```tsx
import { SkillPackageBuilder_Packages_List } from "@/components/skill-package-builder/packages-list";
```

- [ ] **Step 6: Sync mutations that return the full package to the detail cache**

In `src/components/skill-package-builder/package-menu.tsx`, each of the four mutations
(`archiveMutation`, `publishMutation`, `restoreMutation`, `unpublishMutation`) currently
has an `onSuccess` that only invalidates `listPackages`. Add a `setQueryData` write on
the new `getPackage` key, destructuring the mutation's actual output field name
(`updated`, `published`, `updated`, `unpublished` respectively):

```tsx
const archiveMutation = useMutation(
  trpc.skillPackageBuilder.archivePackage.mutationOptions({
    onError(error) {
      console.error("Failed to archive skill package:", error);
    },
    async onSuccess({ updated }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getPackage.queryKey({
          organizationId: organization.id,
          skillPackageId: skillPackage.id,
        }),
        updated,
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listPackages.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);

const publishMutation = useMutation(
  trpc.skillPackageBuilder.publishPackage.mutationOptions({
    onError(error) {
      console.error("Failed to publish skill package:", error);
    },
    async onSuccess({ published }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getPackage.queryKey({
          organizationId: organization.id,
          skillPackageId: skillPackage.id,
        }),
        published,
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listPackages.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);

const restoreMutation = useMutation(
  trpc.skillPackageBuilder.restorePackage.mutationOptions({
    onError(error) {
      console.error("Failed to restore skill package:", error);
    },
    async onSuccess({ updated }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getPackage.queryKey({
          organizationId: organization.id,
          skillPackageId: skillPackage.id,
        }),
        updated,
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listPackages.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);

const unpublishMutation = useMutation(
  trpc.skillPackageBuilder.unpublishPackage.mutationOptions({
    onError(error) {
      console.error("Failed to unpublish skill package:", error);
    },
    async onSuccess({ unpublished }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getPackage.queryKey({
          organizationId: organization.id,
          skillPackageId: skillPackage.id,
        }),
        unpublished,
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listPackages.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);
```

In `src/components/skill-package-builder/update-package.tsx`, the mutation's
`onSuccess` already receives nothing destructured — change to destructure `updated` and
add the same `setQueryData` call, keeping the existing `listPackages` invalidation:

```tsx
            async onSuccess({ updated }) {
                toast.success("Skill package updated");

                handleOpenChange(false);

                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    updated,
                );

                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
```

`delete-package.tsx` needs no change — it redirects away from the detail page on
success, so there's no detail cache left to sync.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors referencing files under `skill-package-builder/packages/[package_id]`
or `src/components/skill-package-builder/`.

- [ ] **Step 8: Manual smoke check**

Ask the user to confirm their dev server is running (per project convention — don't start
your own), then visit `/orgs/<slug>/skill-package-builder/packages/<id>` and confirm: the
page loads, the browser tab title is `<package name> • Skill Package Builder`, and
archiving/publishing/updating the package via the menu updates the page without a full
reload.

- [ ] **Step 9: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-package-builder/page.tsx \
        src/app/"(authenticated)"/orgs/"[slug]"/skill-package-builder/packages/"[package_id]"/page.tsx \
        src/components/skill-package-builder/
git commit -m "Move skill package detail page to the standard detail-page pattern"
```

---

### Task 3: Group detail page → thin shell + `group-content.tsx`

**Files:**

- Create: `src/components/skill-package-builder/group-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/page.tsx`
- Move: `.../groups/[group_id]/group-menu.tsx` → `src/components/skill-package-builder/group-menu.tsx`
- Move: `.../groups/[group_id]/group-contents.tsx` → `src/components/skill-package-builder/group-contents.tsx`
- Move: `.../groups/[group_id]/update-group.tsx` → `src/components/skill-package-builder/update-group.tsx`
- Move: `.../groups/[group_id]/delete-group.tsx` → `src/components/skill-package-builder/delete-group.tsx`
- Move: `.../groups/[group_id]/reorder-skills.tsx` → `src/components/skill-package-builder/reorder-skills.tsx`
- Move: `.../groups/create-group.tsx` → `src/components/skill-package-builder/create-group.tsx`

**Interfaces:**

- Consumes: `trpc.skillPackageBuilder.getGroup` from Task 1; `SkillPackageBuilder_CreateGroup_Dialog`
  now imported as `./create-group` from `package-contents.tsx` (Task 2, Step 2).
- Produces: `SkillPackageBuilder_Group_Content({ packageId: SkillPackageId, groupId: SkillGroupId })`.

- [ ] **Step 1: Move the group-scoped components**

```bash
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/group-menu.tsx" src/components/skill-package-builder/group-menu.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/group-contents.tsx" src/components/skill-package-builder/group-contents.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/update-group.tsx" src/components/skill-package-builder/update-group.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/delete-group.tsx" src/components/skill-package-builder/delete-group.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/reorder-skills.tsx" src/components/skill-package-builder/reorder-skills.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/create-group.tsx" src/components/skill-package-builder/create-group.tsx
```

- [ ] **Step 2: Fix the moved files' relative imports**

In `src/components/skill-package-builder/group-contents.tsx`, update the two relative
imports (previously reaching up out of the route folder, now flat siblings):

```tsx
import { SkillPackageBuilder_CreateSkill_Dialog } from "./create-skill";
import { SkillPackageBuilder_ReorderSkills_Dialog } from "./reorder-skills";
```

`group-menu.tsx`'s `./delete-group` import is unchanged (both moved together).

- [ ] **Step 3: Create `group-content.tsx`**

Create `src/components/skill-package-builder/group-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Group_Contents_List } from "./group-contents";
import { SkillPackageBuilder_Group_Menu } from "./group-menu";
import { SkillPackageBuilder_UpdateGroup_Dialog } from "./update-group";

export function SkillPackageBuilder_Group_Content({ groupId }: { groupId: SkillGroupId }) {
  const organization = useOrganization();

  const { data: skillGroup } = useSuspenseQuery(
    trpc.skillPackageBuilder.getGroup.queryOptions({
      organizationId: organization.id,
      skillGroupId: groupId,
    }),
  );

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Package Builder",
            href: route("/orgs/[slug]/skill-package-builder", {
              slug: organization.slug,
            }),
          },
          {
            label: skillGroup.skillPackage.name,
            href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
              slug: organization.slug,
              package_id: skillGroup.skillPackageId,
            }),
          },
          "Groups",
          skillGroup.name,
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>{skillGroup.name}</Saratoga.Title>
            <Saratoga.Actions>
              <SkillPackageBuilder_Group_Menu skillGroup={skillGroup} />
            </Saratoga.Actions>
          </Saratoga.Header>
          <Saratoga.Columns>
            <Saratoga.Column slot="main">
              <Card>
                <CardHeader>
                  <CardTitle>Skill Group Details</CardTitle>
                  <CardAction>
                    <Protect permissions={{ skillPackageBuilder: ["update"] }}>
                      <SkillPackageBuilder_UpdateGroup_Dialog skillGroup={skillGroup} />
                    </Protect>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <DL>
                    <DLTerm>Group ID</DLTerm>
                    <DLDetails>{skillGroup.id}</DLDetails>
                    <DLTerm>Package</DLTerm>
                    <DLDetails>
                      <Link
                        href={route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                          slug: organization.slug,
                          package_id: skillGroup.skillPackageId,
                        })}
                      >
                        {skillGroup.skillPackage.name}
                      </Link>
                    </DLDetails>
                    <DLTerm>Name</DLTerm>
                    <DLDetails>{skillGroup.name}</DLDetails>
                    <DLTerm>Description</DLTerm>
                    <DLDetails>{skillGroup.description ?? "-"}</DLDetails>
                    <DLTerm>Status</DLTerm>
                    <DLDetails>{skillGroup.status}</DLDetails>
                  </DL>
                </CardContent>
              </Card>
              <SkillPackageBuilder_Group_Contents_List
                skillGroup={skillGroup}
                skillPackage={skillGroup.skillPackage}
              />
            </Saratoga.Column>
            <Saratoga.Column slot="secondary">
              <Card>
                <CardContent>
                  <DL>
                    <DLTerm>Created</DLTerm>
                    <DLDetails>
                      <div>{formatDateTime(skillGroup.createdAt)}</div>
                      <div className="text-muted-foreground">
                        {formatRelativeDateTime(skillGroup.createdAt)}
                      </div>
                    </DLDetails>
                    <DLTerm>Updated</DLTerm>
                    <DLDetails>
                      <div>{formatDateTime(skillGroup.updatedAt)}</div>
                      <div className="text-muted-foreground">
                        {formatRelativeDateTime(skillGroup.updatedAt)}
                      </div>
                    </DLDetails>
                  </DL>
                </CardContent>
              </Card>
            </Saratoga.Column>
          </Saratoga.Columns>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

- [ ] **Step 4: Rewrite `page.tsx` as a thin server shell**

Replace the full contents of
`.../packages/[package_id]/groups/[group_id]/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]
 */

import { Metadata } from "next";

import { SkillPackageBuilder_Group_Content } from "@/components/skill-package-builder/group-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props =
  PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, group_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillGroupId = SkillGroupId.schema.parse(group_id);
  const skillGroup = await fetchQuery(
    trpc.skillPackageBuilder.getGroup.queryOptions({
      organizationId: organization.id,
      skillGroupId,
    }),
  );

  return { title: `${skillGroup.name} ${TITLE_SEPARATOR} Skill Package Builder` };
}

export default async function SkillPackageBuilder_Group_Page(props: Props) {
  const { slug, group_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillGroupId = SkillGroupId.schema.parse(group_id);

  prefetch(
    trpc.skillPackageBuilder.getGroup.queryOptions({
      organizationId: organization.id,
      skillGroupId,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillPackageBuilder_Group_Content groupId={skillGroupId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

Note `group-contents.tsx` (the skills-in-group list card) fetches `listSkills` itself via
`useQuery` (not suspense) — leave that as-is; it isn't part of the suspense boundary the
pattern requires prefetching for, since the card already renders its own loading
skeleton independent of the page shell.

- [ ] **Step 5: Sync mutations that return the full group to the detail cache**

In `src/components/skill-package-builder/group-menu.tsx`, both `archiveMutation` and
`restoreMutation` need to merge the mutation's `updated` (a bare `SkillGroup`, no
`skillPackage`) with the `skillPackage` already known from props, then write it to the
`getGroup` cache key:

```tsx
const archiveMutation = useMutation(
  trpc.skillPackageBuilder.archiveGroup.mutationOptions({
    onError(error) {
      console.error("Failed to archive skill group:", error);
    },
    async onSuccess({ updated }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getGroup.queryKey({
          organizationId: organization.id,
          skillGroupId: skillGroup.id,
        }),
        { ...updated, skillPackage: skillGroup.skillPackage },
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listGroups.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);
const restoreMutation = useMutation(
  trpc.skillPackageBuilder.restoreGroup.mutationOptions({
    onError(error) {
      console.error("Failed to restore skill group:", error);
    },
    async onSuccess({ updated }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getGroup.queryKey({
          organizationId: organization.id,
          skillGroupId: skillGroup.id,
        }),
        { ...updated, skillPackage: skillGroup.skillPackage },
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listGroups.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);
```

In `src/components/skill-package-builder/update-group.tsx`, the `onSuccess({ updated })`
handler currently only writes to `listGroups`. Add the same merge-and-write to
`getGroup`:

```tsx
            async onSuccess({ updated }) {
                toast.success("Skill group updated");

                handleOpenChange(false);

                const merged = { ...updated, skillPackage: skillGroup.skillPackage };

                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getGroup.queryKey({
                        organizationId: organization.id,
                        skillGroupId: skillGroup.id,
                    }),
                    merged,
                );

                queryClient.setQueryData(
                    trpc.skillPackageBuilder.listGroups.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillGroup.skillPackageId,
                    }),
                    (old = []) => old.map((group) => (group.id === updated.id ? updated : group)),
                );
            },
```

`delete-group.tsx` needs no change — it redirects to the package page on success.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors referencing `groups/[group_id]` or the new
`src/components/skill-package-builder/*group*` files.

- [ ] **Step 7: Manual smoke check**

With the user's dev server running, visit a group detail page, confirm the tab title is
`<group name> • Skill Package Builder`, and confirm archiving/restoring/updating the
group updates the page in place.

- [ ] **Step 8: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-package-builder/packages/"[package_id]"/groups \
        src/components/skill-package-builder/
git commit -m "Move skill group detail page to the standard detail-page pattern"
```

---

### Task 4: Skill detail page → thin shell + `skill-content.tsx`

**Files:**

- Create: `src/components/skill-package-builder/skill-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/page.tsx`
- Move: `.../skills/[skill_id]/skill-menu.tsx` → `src/components/skill-package-builder/skill-menu.tsx`
- Move: `.../skills/[skill_id]/update-skill.tsx` → `src/components/skill-package-builder/update-skill.tsx`
- Move: `.../skills/[skill_id]/delete-skill.tsx` → `src/components/skill-package-builder/delete-skill.tsx`
- Move: `.../skills/[skill_id]/move-skill.tsx` → `src/components/skill-package-builder/move-skill.tsx`
- Move: `.../skills/create-skill.tsx` → `src/components/skill-package-builder/create-skill.tsx`

**Interfaces:**

- Consumes: `trpc.skillPackageBuilder.getSkill` from Task 1.
- Produces: `SkillPackageBuilder_Skill_Content({ skillId: SkillId })`.

- [ ] **Step 1: Move the skill-scoped components**

```bash
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/skill-menu.tsx" src/components/skill-package-builder/skill-menu.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/update-skill.tsx" src/components/skill-package-builder/update-skill.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/delete-skill.tsx" src/components/skill-package-builder/delete-skill.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/move-skill.tsx" src/components/skill-package-builder/move-skill.tsx
git mv "src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/create-skill.tsx" src/components/skill-package-builder/create-skill.tsx
```

`skill-menu.tsx`'s `./delete-skill` and `./move-skill` imports are unchanged (all moved
together). No other relative imports need fixing for this group.

- [ ] **Step 2: Create `skill-content.tsx`**

Create `src/components/skill-package-builder/skill-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Skill_Menu } from "./skill-menu";
import { SkillPackageBuilder_UpdateSkill_Dialog } from "./update-skill";

export function SkillPackageBuilder_Skill_Content({ skillId }: { skillId: SkillId }) {
  const organization = useOrganization();

  const { data: skill } = useSuspenseQuery(
    trpc.skillPackageBuilder.getSkill.queryOptions({
      organizationId: organization.id,
      skillId,
    }),
  );

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Package Builder",
            href: route("/orgs/[slug]/skill-package-builder", {
              slug: organization.slug,
            }),
          },
          {
            label: skill.skillPackage.name,
            href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
              slug: organization.slug,
              package_id: skill.skillPackageId,
            }),
          },
          "Skills",
          skill.name,
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>{skill.name}</Saratoga.Title>
            <Saratoga.Actions>
              <SkillPackageBuilder_Skill_Menu skill={skill} />
            </Saratoga.Actions>
          </Saratoga.Header>
          <Saratoga.Columns>
            <Saratoga.Column slot="main">
              <Card>
                <CardHeader>
                  <CardTitle>Skill Details</CardTitle>
                  <CardAction>
                    <Protect permissions={{ skillPackageBuilder: ["update"] }}>
                      <SkillPackageBuilder_UpdateSkill_Dialog skill={skill} />
                    </Protect>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <DL>
                    <DLTerm>Skill ID</DLTerm>
                    <DLDetails>{skill.id}</DLDetails>
                    <DLTerm>Package</DLTerm>
                    <DLDetails>
                      <Link
                        href={route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                          slug: organization.slug,
                          package_id: skill.skillPackageId,
                        })}
                      >
                        {skill.skillPackage.name}
                      </Link>
                    </DLDetails>
                    <DLTerm>Group</DLTerm>
                    <DLDetails>
                      <Link
                        href={route(
                          "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                          {
                            slug: organization.slug,
                            package_id: skill.skillPackageId,
                            group_id: skill.skillGroup.id,
                          },
                        )}
                      >
                        {skill.skillGroup.name}
                      </Link>
                    </DLDetails>
                    <DLTerm>Name</DLTerm>
                    <DLDetails>{skill.name}</DLDetails>
                    <DLTerm>Description</DLTerm>
                    <DLDetails>{skill.description}</DLDetails>
                    <DLTerm>Required</DLTerm>
                    <DLDetails>{skill.defaultRequired ? "Yes" : "No"}</DLDetails>
                    <DLTerm>Revalidation Frequency</DLTerm>
                    <DLDetails>{skill.frequency ? `${skill.frequency} months` : "None"}</DLDetails>
                    <DLTerm>Status</DLTerm>
                    <DLDetails>{skill.status}</DLDetails>
                  </DL>
                </CardContent>
              </Card>
            </Saratoga.Column>
            <Saratoga.Column slot="secondary">
              <Card>
                <CardContent>
                  <DL>
                    <DLTerm>Created</DLTerm>
                    <DLDetails>
                      <div>{formatDateTime(skill.createdAt)}</div>
                      <div className="text-muted-foreground">
                        {formatRelativeDateTime(skill.createdAt)}
                      </div>
                    </DLDetails>
                    <DLTerm>Updated</DLTerm>
                    <DLDetails>
                      <div>{formatDateTime(skill.updatedAt)}</div>
                      <div className="text-muted-foreground">
                        {formatRelativeDateTime(skill.updatedAt)}
                      </div>
                    </DLDetails>
                  </DL>
                </CardContent>
              </Card>
            </Saratoga.Column>
          </Saratoga.Columns>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

The original page always rendered the Group `<DLDetails>` unconditionally-if-present
(`{skill.skillGroup ? <Link>… : ""}`) because the old `useSkill` hook could theoretically
resolve a skill whose group lookup failed independently. `getSkill`'s output schema
requires `skillGroup` — Prisma's `skillGroupId` is non-nullable on `Skill`, so it's
always present; the ternary is dead code and is dropped in the version above.

- [ ] **Step 3: Rewrite `page.tsx` as a thin server shell**

Replace the full contents of
`.../packages/[package_id]/skills/[skill_id]/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]
 */

import { Metadata } from "next";

import { SkillPackageBuilder_Skill_Content } from "@/components/skill-package-builder/skill-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillId } from "@/lib/schemas/skill";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props =
  PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, skill_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillId = SkillId.schema.parse(skill_id);
  const skill = await fetchQuery(
    trpc.skillPackageBuilder.getSkill.queryOptions({
      organizationId: organization.id,
      skillId,
    }),
  );

  return { title: `${skill.name} ${TITLE_SEPARATOR} Skill Package Builder` };
}

export default async function SkillPackageBuilder_Skill_Page(props: Props) {
  const { slug, skill_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillId = SkillId.schema.parse(skill_id);

  prefetch(
    trpc.skillPackageBuilder.getSkill.queryOptions({
      organizationId: organization.id,
      skillId,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillPackageBuilder_Skill_Content skillId={skillId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 4: Sync mutations that return the full skill to the detail cache**

In `src/components/skill-package-builder/skill-menu.tsx`, both `archiveMutation` and
`restoreMutation` need to merge `updated` (a bare `Skill`) with the `skillGroup` and
`skillPackage` already known from props:

```tsx
const archiveMutation = useMutation(
  trpc.skillPackageBuilder.archiveSkill.mutationOptions({
    onError(error) {
      console.error("Failed to archive skill:", error);
    },
    async onSuccess({ updated }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getSkill.queryKey({
          organizationId: organization.id,
          skillId: skill.id,
        }),
        { ...updated, skillGroup: skill.skillGroup, skillPackage: skill.skillPackage },
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listSkills.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);
const restoreMutation = useMutation(
  trpc.skillPackageBuilder.restoreSkill.mutationOptions({
    onError(error) {
      console.error("Failed to restore skill:", error);
    },
    async onSuccess({ updated }) {
      queryClient.setQueryData(
        trpc.skillPackageBuilder.getSkill.queryKey({
          organizationId: organization.id,
          skillId: skill.id,
        }),
        { ...updated, skillGroup: skill.skillGroup, skillPackage: skill.skillPackage },
      );
      await queryClient.invalidateQueries(
        trpc.skillPackageBuilder.listSkills.queryFilter({
          organizationId: organization.id,
        }),
      );
    },
  }),
);
```

In `src/components/skill-package-builder/update-skill.tsx`, the `onSuccess({ updated })`
handler currently only writes to `listSkills`. Add the merged write to `getSkill`:

```tsx
            async onSuccess({ updated }) {
                toast.success("Skill updated successfully");

                handleOpenChange(false);

                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getSkill.queryKey({
                        organizationId: organization.id,
                        skillId: skill.id,
                    }),
                    { ...updated, skillGroup: skill.skillGroup, skillPackage: skill.skillPackage },
                );

                queryClient.setQueryData(
                    trpc.skillPackageBuilder.listSkills.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skill.skillPackageId,
                    }),
                    (old = []) => old.map((s) => (s.id === updated.id ? updated : s)),
                );
            },
```

In `src/components/skill-package-builder/move-skill.tsx`, the `onSuccess({ updated })`
handler currently only navigates and toasts. Add a `getSkill` cache write with the
resolved destination group/package (both already looked up as `destinationPackage` /
`destinationGroup` in that same block) right before `handleOpenChange(false)`:

```tsx
            async onSuccess({ updated }) {
                const destinationPackage = skillPackages.find(
                    (pkg) => pkg.id === updated.skillPackageId,
                );
                const destinationGroup = skillGroups.find(
                    (group) => group.id === updated.skillGroupId,
                );

                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getSkill.queryKey({
                        organizationId: organization.id,
                        skillId: updated.id,
                    }),
                    destinationPackage && destinationGroup
                        ? {
                              ...updated,
                              skillGroup: destinationGroup,
                              skillPackage: destinationPackage,
                          }
                        : undefined,
                );

                toast.success(
                    <>
                        Skill moved from <ObjectName>{originPackage?.name}</ObjectName>
                        {" > "}
                        <ObjectName>{originGroup?.name}</ObjectName> to{" "}
                        <ObjectName>{destinationPackage?.name}</ObjectName>
                        {" > "}
                        <ObjectName>{destinationGroup?.name}</ObjectName>.
                    </>,
                );

                handleOpenChange(false);

                router.replace(
                    route(
                        "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]",
                        {
                            slug: organization.slug,
                            package_id: updated.skillPackageId,
                            skill_id: updated.id,
                        },
                    ),
                );
            },
```

`setQueryData` with `undefined` is a no-op (React Query ignores it), so the fallback
just leaves the existing cache entry — the subsequent `listSkills` invalidation in
`onSettled` still keeps things eventually consistent. `delete-skill.tsx` needs no
change — it redirects to the group page on success.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors referencing `skills/[skill_id]` or the new
`src/components/skill-package-builder/*skill*` files.

- [ ] **Step 6: Manual smoke check**

With the user's dev server running, visit a skill detail page, confirm the tab title is
`<skill name> • Skill Package Builder`, and confirm archiving/restoring/updating/moving
the skill updates the page in place (moving should land on the new package/group's skill
page with correct breadcrumbs, no stale data).

- [ ] **Step 7: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-package-builder/packages/"[package_id]"/skills \
        src/components/skill-package-builder/
git commit -m "Move skill detail page to the standard detail-page pattern"
```

---

### Task 5: Retire the list-based hooks and fix their remaining callers

**Files:**

- Delete: `src/hooks/use-skill-package.ts`
- Delete: `src/hooks/use-skill-group.ts`
- Delete: `src/hooks/use-skill.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/contents/page.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/history/page.tsx`

**Interfaces:**

- Consumes: `trpc.skillPackageBuilder.getPackage` from Task 1.

- [ ] **Step 1: Confirm no remaining references to the three hooks**

Run: `grep -rn "use-skill-package\|use-skill-group\|from \"@/hooks/use-skill\"" src/`
Expected: only the two files edited in the next steps (`contents/page.tsx` and
`history/page.tsx`) — the three detail pages were already converted in Tasks 2–4.

- [ ] **Step 2: Update `contents/page.tsx` to use `getPackage`**

This page currently derives `skillPackage` via `listPackages` + `Array.find`. Replace
that with `getPackage`. In
`.../packages/[package_id]/contents/page.tsx`, change:

```tsx
const [{ data: skillPackages }, { data: groups }, { data: skills }] = useSuspenseQueries({
  queries: [
    trpc.skillPackageBuilder.listPackages.queryOptions({
      organizationId: organization.id,
    }),
    trpc.skillPackageBuilder.listGroups.queryOptions({
      organizationId: organization.id,
      skillPackageId: package_id,
    }),
    trpc.skillPackageBuilder.listSkills.queryOptions({
      organizationId: organization.id,
      skillPackageId: package_id,
    }),
  ],
});

const skillPackage = skillPackages.find((pkg) => pkg.id === package_id);
if (!skillPackage) throw new Error(`SkillPackage(${package_id}) not found`);
```

to:

```tsx
const [{ data: skillPackage }, { data: groups }, { data: skills }] = useSuspenseQueries({
  queries: [
    trpc.skillPackageBuilder.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId: package_id,
    }),
    trpc.skillPackageBuilder.listGroups.queryOptions({
      organizationId: organization.id,
      skillPackageId: package_id,
    }),
    trpc.skillPackageBuilder.listSkills.queryOptions({
      organizationId: organization.id,
      skillPackageId: package_id,
    }),
  ],
});
```

The `package_id` route param there is a plain `string`, but `getPackage`'s input expects
`SkillPackageId` — check the surrounding code: `props.params` for this route is typed as
`{ package_id: string }` by Next's generated `PageProps`, and the existing `listGroups`/
`listSkills` calls already pass it straight through as `skillPackageId` without parsing,
so the router's own `SkillPackageId.schema` parse on the server does the validation; no
extra client-side parse is needed here (this mirrors the pre-existing pattern in this
file).

- [ ] **Step 3: Update `history/page.tsx` to use `getPackage`**

Replace the full contents of `.../packages/[package_id]/history/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/history
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Std } from "@/components/blocks/std";
import { NotImplemented } from "@/components/nav/errors";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export default function SkillPackageBuilder_Package_History_Page(
  props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/history`>,
) {
  const { slug, package_id } = use(props.params);
  const organization = useOrganization();

  const { data: skillPackage } = useSuspenseQuery(
    trpc.skillPackageBuilder.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId: package_id,
    }),
  );

  return (
    <Std.SidebarInset>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Package Builder",
            href: route("/orgs/[slug]/skill-package-builder", { slug }),
          },
          {
            label: skillPackage.name,
            href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
              slug,
              package_id,
            }),
          },
          "History",
        ]}
      />
      <Std.ScrollContainer>
        <NotImplemented />
      </Std.ScrollContainer>
    </Std.SidebarInset>
  );
}
```

This page did not use `useOrganization` before (it was commented out) because
`useSkillPackage` sourced the organization internally; now that the query is made
directly here, `useOrganization` is needed.

- [ ] **Step 4: Delete the three hooks**

```bash
git rm src/hooks/use-skill-package.ts src/hooks/use-skill-group.ts src/hooks/use-skill.tsx
```

- [ ] **Step 5: Typecheck, lint, and run the full test suite**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`
Expected: all pass, no references to the deleted hooks remain.

- [ ] **Step 6: Manual smoke check**

With the user's dev server running, visit both
`/orgs/<slug>/skill-package-builder/packages/<id>/contents` and
`/orgs/<slug>/skill-package-builder/packages/<id>/history` and confirm both render with
correct breadcrumbs (package name links back to the detail page).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-skill-package.ts src/hooks/use-skill-group.ts src/hooks/use-skill.tsx \
        src/app/"(authenticated)"/orgs/"[slug]"/skill-package-builder/packages/"[package_id]"/contents/page.tsx \
        src/app/"(authenticated)"/orgs/"[slug]"/skill-package-builder/packages/"[package_id]"/history/page.tsx
git commit -m "Retire list-based skill-package-builder hooks in favor of get* queries"
```

---

### Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the repo.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: no errors or warnings introduced by this change.

- [ ] **Step 3: Full test suite**

Run: `npm run test:run`
Expected: all tests pass, including the new
`skill-package-builder-router.test.ts`.

- [ ] **Step 4: Confirm the route folders now hold only `page.tsx`**

Run:

```bash
find "src/app/(authenticated)/orgs/[slug]/skill-package-builder" -type f
```

Expected: only `layout.tsx`, `sidebar-menu.tsx`, `page.tsx`, and the five `page.tsx`
files under `packages/[package_id]/{, contents/, history/, groups/[group_id]/,
skills/[skill_id]/}` — no menus, dialogs, or list components remain in route folders.

- [ ] **Step 5: Final manual walkthrough**

With the user's dev server running, walk the full flow once end-to-end: create a
package → create a group → create a skill → update each → archive/restore each →
move the skill to another group → delete the skill → delete the group → delete the
package. Confirm no console errors and no stale data at any step.
