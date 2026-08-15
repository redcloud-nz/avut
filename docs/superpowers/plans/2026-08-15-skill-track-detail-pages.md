# Skill Track detail pages → standard pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every `skill-track` page that shows a single entity —
`catalogue/[package_id]`, `reports/person/[person_id]`, and
`sessions/[session_id]` plus its six sub-pages (skills, personnel, checks,
review, by-skill, by-person) — in line with
`docs/patterns/detail-page-data-fetching.md`: thin server `page.tsx` shells
with `generateMetadata` + `prefetch`, `"use client"` content components that
own `useSuspenseQuery`/`useSuspenseQueries` and `Std.Navbar` /
`Std.ScrollContainer`, relocated to `src/components/skill-track/`.

**Architecture:** Add a single-entity `skills.getPackage` query (mirroring the
existing `listPackages` shape) to replace the catalogue detail page's
`listPackages` + `.find()` anti-pattern. Rewrite each of the nine `page.tsx`
files as async server shells. Move every content component out of its route
folder into `src/components/skill-track/`, flat, named `<page>-content.tsx`.
Server-side `prefetch` skips any query whose exact key (procedure + all
params) is already fetched by the parent `sessions/[session_id]` page, since
a user reaching a sub-page normally does so by navigating from there and the
client query cache is already warm for that key.

**Tech Stack:** Next.js 16 App Router, tRPC 11 + React Query 5, Zod 4, Prisma
7, Vitest + prisma-mock.

**Spec:** `docs/superpowers/specs/2026-08-15-skill-track-detail-pages-design.md`

## Global Constraints

- Follow `docs/patterns/detail-page-data-fetching.md` exactly: no shared
  `resolveX` helper across `generateMetadata` and the page body, no
  `<Suspense>` wrapper (`Std.SidebarInset` already provides one), content
  component owns `Std.Navbar` + `Std.ScrollContainer`, `page.tsx` only passes
  route param(s) down (organization id/slug come from `useOrganization()`
  inside the content component).
- New/moved components live in `src/components/skill-track/`, flat, named
  `<page>-content.tsx` — no per-entity subfolders.
- `organizationProcedure` router files keep procedures alphabetical
  (`src/trpc/routers/skills-router.ts`).
- Use `route()` for dynamic links, Zod 4 syntax, `TITLE_SEPARATOR` from
  `@/lib/constants` for page titles — per `AGENTS.md`.
- Router tests use `createMockPrisma` + `createAuthenticatedMockContext`,
  seeded once in `beforeAll` — per `AGENTS.md` testing conventions.
- A server-side `prefetch` is skipped only when its query key (procedure +
  every param, since `scope`/`ownChecksOnly` are part of the key) exactly
  matches a query already prefetched/fetched by the parent
  `sessions/[session_id]` page's content (`session-contents.tsx`):
  `listSkillChecks({ organizationId, sessionId })` (no scope/flags),
  `listSessionAssessees({ ..., scope: "assigned" })`,
  `listSessionSkills({ ..., scope: "assigned" })`. The content component
  still calls `useSuspenseQuery`/`useSuspenseQueries` for these — only the
  server `prefetch` call is omitted.
- `getSession` is always fetched via `generateMetadata` (every sub-page gets
  a dynamic title using the session name) and reused for free by the body's
  `prefetch(getSession)` call (same request-scoped query client → cache hit)
  — never treated as a "skip" case.

---

## File Structure

```
src/trpc/routers/skills-router.ts                         # + getPackage
src/trpc/routers/skills-router.test.ts                     # new — test for getPackage

src/components/skill-track/
    catalogue-package-content.tsx    # new — was catalogue/[package_id]/page.tsx (fully client)
    subscribe-package.tsx            # modified — setQueryData on getPackage
    unsubscribe-package.tsx          # modified — setQueryData on getPackage
    session-content.tsx              # new — moved from sessions/[session_id]/content.tsx
    session-skills-content.tsx       # new — was sessions/[session_id]/skills/page.tsx
    session-personnel-content.tsx    # new — was sessions/[session_id]/personnel/page.tsx
    session-checks-content.tsx       # new — was sessions/[session_id]/checks/page.tsx
    session-review-content.tsx       # new — was sessions/[session_id]/review/page.tsx
    session-by-skill-content.tsx     # new — was sessions/[session_id]/by-skill/page.tsx
    session-by-person-content.tsx    # new — was sessions/[session_id]/by-person/page.tsx
    reports/person-competency-report.tsx  # modified — owns Std.Navbar now

src/app/(authenticated)/orgs/[slug]/skill-track/
    catalogue/[package_id]/page.tsx           # rewritten — thin server shell
    reports/person/[person_id]/page.tsx       # modified — prefetch + parse id
    sessions/[session_id]/page.tsx            # rewritten — thin server shell
    sessions/[session_id]/content.tsx         # deleted (moved)
    sessions/[session_id]/skills/page.tsx     # rewritten — thin server shell
    sessions/[session_id]/personnel/page.tsx  # rewritten — thin server shell
    sessions/[session_id]/checks/page.tsx     # rewritten — thin server shell
    sessions/[session_id]/review/page.tsx     # rewritten — thin server shell
    sessions/[session_id]/by-skill/page.tsx   # rewritten — thin server shell
    sessions/[session_id]/by-person/page.tsx  # rewritten — thin server shell
```

---

### Task 1: Add `skills.getPackage` query

**Files:**

- Modify: `src/trpc/routers/skills-router.ts`
- Test: `src/trpc/routers/skills-router.test.ts` (new)

**Interfaces:**

- Produces: `trpc.skills.getPackage` — input `{ skillPackageId: SkillPackageId }`,
  output `SkillPackage.schema.extend({ organization: { id, name },
subscription: SkillPackageSubscription.schema.nullable(), skillCount:
number, subscriptionCount: number })` — same shape as one entry of
  `listPackages`. Permission-gated `skillPackageSubscription: ["view"]`.
  Throws `TRPCError({ code: "NOT_FOUND" })` via `Messages.skillPackageNotFound`
  if the package doesn't exist or isn't published.

- [ ] **Step 1: Write the failing router test**

Create `src/trpc/routers/skills-router.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

// skills-router reaches @/server/auth at import time via ../init. The procedure
// under test only touches ctx.prisma (the injected mock), so stubbing server-only
// is enough to let the module load under jsdom.
vi.mock("server-only", () => ({}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillsRouter } from "./skills-router";

describe("skillsRouter.getPackage", () => {
  const T = {
    org: OrganizationId.create(),
    publisherOrg: OrganizationId.create(),
    user: nanoId16(),
    pkg: SkillPackageId.create(),
    unpublishedPkg: SkillPackageId.create(),
  };

  const db = createMockPrisma();

  beforeAll(async () => {
    await db.organization.create({
      data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
    });
    await db.organization.create({
      data: {
        id: T.publisherOrg,
        name: "Publisher",
        slug: "publisher",
        createdAt: new Date(),
      },
    });
    await db.skillPackage.create({
      data: {
        id: T.pkg,
        organizationId: T.publisherOrg,
        name: "Rescue Skills",
        description: "",
        properties: {},
        tags: [],
        published: true,
      },
    });
    await db.skillPackage.create({
      data: {
        id: T.unpublishedPkg,
        organizationId: T.publisherOrg,
        name: "Draft Skills",
        description: "",
        properties: {},
        tags: [],
        published: false,
      },
    });
    await db.skillPackageSubscription.create({
      data: {
        organizationId: T.org,
        skillPackageId: T.pkg,
      },
    });
  });

  function makeCaller() {
    return skillsRouter.createCaller(
      createAuthenticatedMockContext({
        user: { id: T.user },
        permissions: { skillPackageSubscription: ["view"] },
        prisma: db,
      }),
    );
  }

  it("returns the package with subscription and counts for the caller's org", async () => {
    const result = await makeCaller().getPackage({
      organizationId: T.org,
      skillPackageId: T.pkg,
    });
    expect(result.id).toBe(T.pkg);
    expect(result.name).toBe("Rescue Skills");
    expect(result.organization.id).toBe(T.publisherOrg);
    expect(result.subscription).not.toBeNull();
    expect(result.subscriptionCount).toBe(1);
  });

  it("returns subscription: null when the org isn't subscribed", async () => {
    // A second org, never subscribed, requesting the same published package.
    const otherOrg = OrganizationId.create();
    await db.organization.create({
      data: { id: otherOrg, name: "Other", slug: "other", createdAt: new Date() },
    });
    const caller = skillsRouter.createCaller(
      createAuthenticatedMockContext({
        user: { id: T.user },
        permissions: { skillPackageSubscription: ["view"] },
        prisma: db,
      }),
    );
    const result = await caller.getPackage({
      organizationId: otherOrg,
      skillPackageId: T.pkg,
    });
    expect(result.subscription).toBeNull();
  });

  it("throws NOT_FOUND for an unpublished package", async () => {
    await expect(
      makeCaller().getPackage({ organizationId: T.org, skillPackageId: T.unpublishedPkg }),
    ).rejects.toThrow(/not found/i);
  });

  it("throws NOT_FOUND for an unknown package", async () => {
    await expect(
      makeCaller().getPackage({
        organizationId: T.org,
        skillPackageId: SkillPackageId.create(),
      }),
    ).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/trpc/routers/skills-router.test.ts`
Expected: FAIL — `getPackage is not a function`.

- [ ] **Step 3: Add the `getPackage` procedure**

In `src/trpc/routers/skills-router.ts`, insert immediately before `getSession`
(keeps the block alphabetical — `getPackage` before `getSession`):

```ts
    /**
     * Get a single published skill package by ID, including this organization's subscription
     * status and package-level counts.
     * @param skillPackageId The ID of the skill package to retrieve.
     * @returns The skill package with organization, subscription, skillCount, subscriptionCount.
     * @throws TRPCError(NOT_FOUND) if the package doesn't exist or isn't published.
     */
    getPackage: organizationProcedure({ skillPackageSubscription: ["view"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(
            SkillPackage.schema.extend({
                organization: z.object({
                    id: z.string(),
                    name: z.string(),
                }),
                subscription: SkillPackageSubscription.schema.nullable(),
                skillCount: z.number(),
                subscriptionCount: z.number(),
            }),
        )
        .query(async ({ ctx, input: { organizationId, skillPackageId } }) => {
            const pkg = await ctx.prisma.skillPackage.findUnique({
                where: {
                    id: skillPackageId,
                    published: true,
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    tags: true,
                    properties: true,
                    published: true,
                    updatedAt: true,
                    createdAt: true,
                    status: true,
                    organizationId: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    subscriptions: {
                        where: {
                            organizationId,
                        },
                    },
                    _count: {
                        select: {
                            subscriptions: true,
                            skills: {
                                where: {
                                    status: "Active",
                                },
                            },
                        },
                    },
                },
            });

            if (!pkg) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillPackageNotFound(skillPackageId),
                });
            }

            return {
                ...SkillPackage.fromRecord(pkg),
                organization: {
                    id: pkg.organization.id,
                    name: pkg.organization.name,
                },
                skillCount: pkg._count.skills,
                subscriptionCount: pkg._count.subscriptions,
                subscription:
                    pkg.subscriptions.length > 0
                        ? SkillPackageSubscription.fromRecord(pkg.subscriptions[0])
                        : null,
            };
        }),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/trpc/routers/skills-router.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `skills-router.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/skills-router.ts src/trpc/routers/skills-router.test.ts
git commit -m "Add skills.getPackage query"
```

---

### Task 2: Catalogue package detail page → thin shell + `catalogue-package-content.tsx`

**Files:**

- Create: `src/components/skill-track/catalogue-package-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/catalogue/[package_id]/page.tsx`
- Move: `src/components/skill-track/subscribe-package.tsx` (already in place — edit in place)
- Move: `src/components/skill-track/unsubscribe-package.tsx` (already in place — edit in place)

**Interfaces:**

- Consumes: `trpc.skills.getPackage` from Task 1.
- Produces: `SkillTrack_CataloguePackage_Content({ skillPackageId: SkillPackageId })`.

- [ ] **Step 1: Create `catalogue-package-content.tsx`**

Create `src/components/skill-track/catalogue-package-content.tsx`:

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
import { SkillTrack_SubscribeToPackage_Dialog } from "@/components/skill-track/subscribe-package";
import { SkillTrack_UnsubscribeFromPackage_Dialog } from "@/components/skill-track/unsubscribe-package";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillTrack_CataloguePackage_Content({
  skillPackageId,
}: {
  skillPackageId: SkillPackageId;
}) {
  const organization = useOrganization();

  const { data: skillPackage } = useSuspenseQuery(
    trpc.skills.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skills",
            href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
          },
          {
            label: "Catalogue",
            href: route("/orgs/[slug]/skill-track/catalogue", {
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
              <Protect permissions={{ skillPackageSubscription: ["subscribe"] }}>
                {skillPackage.subscription ? (
                  <SkillTrack_UnsubscribeFromPackage_Dialog skillPackage={skillPackage} />
                ) : (
                  <SkillTrack_SubscribeToPackage_Dialog skillPackage={skillPackage} />
                )}
              </Protect>
            </Saratoga.Actions>
          </Saratoga.Header>
          <Saratoga.Columns>
            <Saratoga.Column slot="main">
              <Card>
                <CardHeader>
                  <CardTitle>Package Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <DL>
                    <DLTerm>Package ID</DLTerm>
                    <DLDetails>{skillPackage.id}</DLDetails>
                    <DLTerm>Name</DLTerm>
                    <DLDetails>{skillPackage.name}</DLDetails>
                    <DLTerm>Description</DLTerm>
                    <DLDetails>{skillPackage.description}</DLDetails>
                    <DLTerm>Publisher</DLTerm>
                    <DLDetails>{skillPackage.organization.name}</DLDetails>
                    <DLTerm>Skills</DLTerm>
                    <DLDetails>{skillPackage.skillCount}</DLDetails>
                    <DLTerm>Subscribers</DLTerm>
                    <DLDetails>{skillPackage.subscriptionCount}</DLDetails>
                  </DL>
                </CardContent>
              </Card>
              {skillPackage.subscription && (
                <Card>
                  <CardHeader>
                    <CardTitle>Subscription Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DL>
                      <DLTerm>Subscription ID</DLTerm>
                      <DLDetails>{skillPackage.subscription.id}</DLDetails>
                    </DL>
                  </CardContent>
                </Card>
              )}
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

- [ ] **Step 2: Rewrite `page.tsx` as a thin server shell**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/catalogue/[package_id]/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-track/catalogue/[package_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_CataloguePackage_Content } from "@/components/skill-track/catalogue-package-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/catalogue/[package_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, package_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillPackageId = SkillPackageId.schema.parse(package_id);
  const skillPackage = await fetchQuery(
    trpc.skills.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );

  return { title: `${skillPackage.name} ${TITLE_SEPARATOR} Catalogue` };
}

export default async function SkillTrack_CataloguePackage_Page(props: Props) {
  const { slug, package_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillPackageId = SkillPackageId.schema.parse(package_id);

  prefetch(
    trpc.skills.getPackage.queryOptions({
      organizationId: organization.id,
      skillPackageId,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_CataloguePackage_Content skillPackageId={skillPackageId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Sync `subscribeToPackage`/`unsubscribeFromPackage` to the `getPackage` cache**

In `src/components/skill-track/subscribe-package.tsx`, add `useQueryClient` and
write the new subscription into the `getPackage` cache on success:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
```

```tsx
export function SkillTrack_SubscribeToPackage_Dialog({
    skillPackage,
}: {
    skillPackage: { id: SkillPackageId; name: string };
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);

    const mutation = useMutation(
        trpc.skills.subscribeToPackage.mutationOptions({
            meta: { invalidates: skillsInvalidations.subscribeToPackage },
            onError(error) {
                console.error("Failed to subscribe to skill package:", error);
                toast.error(`Failed to subscribe to skill package: ${error.message}`);
            },
            onSuccess({ created }) {
                toast.success(
                    <>
                        Subscribed to <ObjectName>{skillPackage.name}</ObjectName>.
                    </>,
                );
                queryClient.setQueryData(
                    trpc.skills.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    (old) =>
                        old
                            ? { ...old, subscription: created, subscriptionCount: old.subscriptionCount + 1 }
                            : old,
                );
                handleOpenChange(false);
            },
        }),
    );
```

(The rest of the file is unchanged — only the import line, the `queryClient`
declaration, and the `onSuccess` body change.)

In `src/components/skill-track/unsubscribe-package.tsx`, the same pattern:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
```

```tsx
export function SkillTrack_UnsubscribeFromPackage_Dialog({
    skillPackage,
}: {
    skillPackage: { id: SkillPackageId; name: string };
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.skills.unsubscribeFromPackage.mutationOptions({
            meta: { invalidates: skillsInvalidations.unsubscribeFromPackage },
            onError(error) {
                console.error("Failed to unsubscribe from skill package:", error);
                toast.error(`Failed to unsubscribe from skill package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Unsubscribed from <ObjectName>{skillPackage.name}</ObjectName>.
                    </>,
                );
                queryClient.setQueryData(
                    trpc.skills.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    (old) =>
                        old
                            ? { ...old, subscription: null, subscriptionCount: old.subscriptionCount - 1 }
                            : old,
                );
            },
        }),
    );
```

(`unsubscribeFromPackage`'s output is `{ deleted }`, not needed here since the
new subscription value is always `null` — only the import, `queryClient`
declaration, and `onSuccess` body change.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors referencing `catalogue/[package_id]` or the new
`catalogue-package-content.tsx`.

- [ ] **Step 5: Manual smoke check**

Ask the user to confirm their dev server is running, then visit
`/orgs/<slug>/skill-track/catalogue/<published-package-id>` and confirm: page
loads, tab title is `<package name> • Catalogue`, and subscribe/unsubscribe
update the page without a full reload.

- [ ] **Step 6: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/catalogue/"[package_id]"/page.tsx \
        src/components/skill-track/catalogue-package-content.tsx \
        src/components/skill-track/subscribe-package.tsx \
        src/components/skill-track/unsubscribe-package.tsx
git commit -m "Move catalogue package detail page to the standard detail-page pattern"
```

---

### Task 3: Personnel competency report page — add prefetch, move `Std.Navbar`

**Files:**

- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/reports/person/[person_id]/page.tsx`
- Modify: `src/components/skill-track/reports/person-competency-report.tsx`

**Interfaces:**

- No new queries — `trpc.skillChecks.getCompetencyMatrix` already exists and
  is already read via `useSuspenseQuery` inside the report component.

- [ ] **Step 1: Move `Std.Navbar` into `person-competency-report.tsx`**

In `src/components/skill-track/reports/person-competency-report.tsx`, add
imports:

```tsx
import { Std } from "@/components/blocks/std";
import { route } from "@/lib/routes";
```

Wrap the returned JSX in a fragment with the Navbar in front of
`<Saratoga.Root>`, for both the early-return (`!person`) and the main return.
Early-return case — replace:

```tsx
    if (!person) {
        return (
            <Saratoga.Root>
                <Empty>
```

with:

```tsx
    if (!person) {
        return (
            <>
                <Std.Navbar
                    breadcrumbs={[
                        {
                            label: "Skill Track",
                            href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
                        },
                        {
                            label: "Reports",
                            href: route("/orgs/[slug]/skill-track/reports", {
                                slug: organization.slug,
                            }),
                        },
                        {
                            label: "Personnel Competency",
                            href: route("/orgs/[slug]/skill-track/reports/person", {
                                slug: organization.slug,
                            }),
                        },
                        "Report",
                    ]}
                />
                <Std.ScrollContainer>
                    <Saratoga.Root>
                        <Empty>
```

and its matching close — replace:

```tsx
                </Empty>
            </Saratoga.Root>
        );
    }
```

with:

```tsx
                    </Empty>
                </Saratoga.Root>
                </Std.ScrollContainer>
            </>
        );
    }
```

Main return — replace the opening:

```tsx
    return (
        <Saratoga.Root>
```

with:

```tsx
    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Track",
                        href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
                    },
                    {
                        label: "Reports",
                        href: route("/orgs/[slug]/skill-track/reports", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: "Personnel Competency",
                        href: route("/orgs/[slug]/skill-track/reports/person", {
                            slug: organization.slug,
                        }),
                    },
                    "Report",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
```

and the final closing:

```tsx
        </Saratoga.Root>
    );
}
```

with:

```tsx
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
```

Re-indent the JSX between these markers by one level (existing formatting
will be fixed by prettier in Step 4 regardless, so exact indentation here
isn't critical).

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/reports/person/[person_id]/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/person/[person_id]
 */

import { Std } from "@/components/blocks/std";
import { SkillTrack_PersonCompetencyReport } from "@/components/skill-track/reports/person-competency-report";

import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { prefetch, trpc } from "@/trpc/server";

export const metadata = {
  title: `Personnel Competency`,
};

export default async function SkillTrack_ReportsPersonCompetency_Page(
  props: PageProps<"/orgs/[slug]/skill-track/reports/person/[person_id]">,
) {
  const { slug, person_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  // `?synthetic` replaces the recorded competencies with generated ones — see
  // synthetic-competency-data.
  const { synthetic } = await props.searchParams;

  const personId = PersonId.schema.parse(person_id);

  prefetch(
    trpc.skillChecks.getCompetencyMatrix.queryOptions({
      organizationId: organization.id,
      personId,
    }),
  );

  return (
    <Std.SidebarInset>
      <SkillTrack_PersonCompetencyReport personId={personId} synthetic={synthetic !== undefined} />
    </Std.SidebarInset>
  );
}
```

Note this page keeps the static `metadata` export (no `generateMetadata`)
since the title doesn't depend on fetched data — per the pattern doc's
static-title exception. It also has no `HydrateClient` wrapper import needed
change: check `@/trpc/server` already exports `HydrateClient` — wrap the
returned JSX the same way as every other converted page:

```tsx
return (
  <HydrateClient>
    <Std.SidebarInset>
      <SkillTrack_PersonCompetencyReport personId={personId} synthetic={synthetic !== undefined} />
    </Std.SidebarInset>
  </HydrateClient>
);
```

(Add `HydrateClient` to the `@/trpc/server` import list alongside `prefetch, trpc`.)

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors referencing `reports/person/[person_id]` or
`person-competency-report.tsx`.

- [ ] **Step 4: Manual smoke check**

With the user's dev server running, visit a personnel competency report,
confirm the tab title is `Personnel Competency`, breadcrumbs render, and the
page loads without a client-side loading flash for the header.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/reports/person/"[person_id]"/page.tsx \
        src/components/skill-track/reports/person-competency-report.tsx
git commit -m "Move personnel competency report page to the standard detail-page pattern"
```

---

### Task 4: Session detail page → thin shell + `session-content.tsx`

**Files:**

- Create: `src/components/skill-track/session-content.tsx`
- Delete: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/page.tsx`

**Interfaces:**

- Consumes: `trpc.skills.getSession` (existing).
- Produces: `SkillTrack_Session_Content({ sessionId: SkillCheckSessionId })`.

- [ ] **Step 1: Create `session-content.tsx`**

Create `src/components/skill-track/session-content.tsx` — same body as the
current `content.tsx`, but reading `session` itself via `useSuspenseQuery`
instead of receiving it as a prop, and owning `Std.Navbar`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { SkillsModule_Session_Contents_Card } from "@/components/skill-track/session-contents";
import { SkillsModule_SessionMenu } from "@/components/skill-track/session-menu";
import { SkillsModule_UpdateSession_Dialog } from "@/components/skill-track/update-session";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardLoadingFallback,
  CardTitle,
} from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillTrack_Session_Content({ sessionId }: { sessionId: SkillCheckSessionId }) {
  const organization = useOrganization();

  const { data: session } = useSuspenseQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId: sessionId,
    }),
  );

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Track",
            href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
          },
          {
            label: "Sessions",
            href: route("/orgs/[slug]/skill-track/sessions", {
              slug: organization.slug,
            }),
          },
          { label: session.name || session.id },
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>{session.name}</Saratoga.Title>
            <Saratoga.Actions>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Record <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Record skill checks</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("/orgs/[slug]/skill-track/sessions/[session_id]/by-person", {
                          slug: organization.slug,
                          session_id: session.id,
                        })}
                      >
                        By Person
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={route("/orgs/[slug]/skill-track/sessions/[session_id]/by-skill", {
                          slug: organization.slug,
                          session_id: session.id,
                        })}
                      >
                        By Skill
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" asChild>
                <Link
                  href={route("/orgs/[slug]/skill-track/sessions/[session_id]/review", {
                    slug: organization.slug,
                    session_id: session.id,
                  })}
                >
                  Review
                </Link>
              </Button>
              <SkillsModule_SessionMenu session={session} />
            </Saratoga.Actions>
          </Saratoga.Header>
          <Saratoga.Columns>
            <Saratoga.Column slot="main">
              <Card>
                <CardHeader>
                  <CardTitle>Session Details</CardTitle>
                  <CardAction>
                    <Protect permissions={{ skillCheckSession: ["update"] }}>
                      <SkillsModule_UpdateSession_Dialog session={session} />
                    </Protect>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <DL>
                    <DLTerm>Session ID</DLTerm>
                    <DLDetails className="font-mono">{session.id}</DLDetails>

                    <DLTerm>Name</DLTerm>
                    <DLDetails>{session.name}</DLDetails>

                    <DLTerm>Date</DLTerm>
                    <DLDetails>{formatDate(session.date)}</DLDetails>

                    <DLTerm>Notes</DLTerm>
                    <DLDetails>{session.notes}</DLDetails>

                    <DLTerm>Status</DLTerm>
                    <DLDetails>{session.status}</DLDetails>

                    <DLTerm>Assessor</DLTerm>
                    <DLDetails>{session.assessors.map((a) => a.name).join(", ") || "—"}</DLDetails>
                  </DL>
                </CardContent>
              </Card>
            </Saratoga.Column>
            <Saratoga.Column slot="secondary">
              <Suspense fallback={<CardLoadingFallback />}>
                <SkillsModule_Session_Contents_Card sessionId={session.id} />
              </Suspense>
              <Card>
                <CardContent>
                  <DL>
                    <DLTerm>Created</DLTerm>
                    <DLDateDetails date={session.createdAt} />
                    <DLTerm>Updated</DLTerm>
                    <DLDateDetails date={session.updatedAt} />
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

- [ ] **Step 2: Delete the old `content.tsx`**

```bash
git rm "src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/content.tsx"
```

- [ ] **Step 3: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_Session_Content } from "@/components/skill-track/session-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
  const session = await fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return {
    title: `${session.name || `Session ${session.id}`} ${TITLE_SEPARATOR} Skills Module`,
  };
}

export default async function SkillTrack_Session_Page(props: Props) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_Session_Content sessionId={skillCheckSessionId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors referencing `sessions/[session_id]/page.tsx`,
`sessions/[session_id]/content.tsx` (deleted), or `session-content.tsx`.

- [ ] **Step 5: Manual smoke check**

With the user's dev server running, visit a session detail page, confirm tab
title, breadcrumb, the "Contents" card still progressively loads (its own
`Suspense` fallback), and updating the session via the menu reflects in
place.

- [ ] **Step 6: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/page.tsx \
        src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/content.tsx \
        src/components/skill-track/session-content.tsx
git commit -m "Move session detail page to the standard detail-page pattern"
```

---

### Task 5: `sessions/[session_id]/skills` → thin shell + `session-skills-content.tsx`

**Files:**

- Create: `src/components/skill-track/session-skills-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/skills/page.tsx`

**Interfaces:**

- Consumes: `trpc.skills.getSession`, `trpc.skills.listAssessableSkills`,
  `trpc.skills.listSessionSkills` (all existing).
- Produces: `SkillTrack_SessionSkills_Content({ sessionId: SkillCheckSessionId })`.
- Prefetch: `getSession`, `listAssessableSkills`. **Skip**
  `listSessionSkills({ scope: "assigned" })` — redundant with the parent
  session page.

- [ ] **Step 1: Create `session-skills-content.tsx`**

Create `src/components/skill-track/session-skills-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";

import { skillsInvalidations } from "@/client/skills-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

export function SkillTrack_SessionSkills_Content({
  sessionId,
}: {
  sessionId: SkillCheckSessionId;
}) {
  const organization = useOrganization();

  const [
    {
      data: { skills, skillGroups, skillPackages },
    },
    { data: session },
    { data: assignedSkills },
  ] = useSuspenseQueries({
    queries: [
      trpc.skills.listAssessableSkills.queryOptions({
        organizationId: organization.id,
      }),
      trpc.skills.getSession.queryOptions({
        organizationId: organization.id,
        skillCheckSessionId: sessionId,
      }),
      trpc.skills.listSessionSkills.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
        scope: "assigned",
      }),
    ],
  });

  const mutation = useMutation(
    trpc.skills.updateSessionSkills.mutationOptions({
      meta: { invalidates: skillsInvalidations.updateSessionSkills },
      onError(error) {
        console.error("Failed to update session skills:", error);
        toast.error(`Failed to update session skills. ${error.message}`);
      },
      onSuccess({ updatedSkills, updatedSession }, _variables, _onMutateResult, context) {
        setChanges({});

        context.client.setQueryData(
          trpc.skills.listSessionSkills.queryKey({
            organizationId: organization.id,
            sessionId: session.id,
            scope: "assigned",
          }),
          updatedSkills,
        );
        context.client.setQueryData(
          trpc.skills.getSession.queryKey({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
          }),
          (old) => (old ? { ...old, ...updatedSession } : old),
        );
      },
    }),
  );

  const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

  const [changes, setChanges] = useState<Record<SkillId, boolean>>({});
  const [showSkillDescription, setShowSkillDescription] = useState(false);

  const assignedSkillIds = assignedSkills.map((s) => s.id);

  function isSelected(skillId: SkillId): boolean {
    return changes[skillId] ?? assignedSkillIds.includes(skillId);
  }

  function handleChangeChecked(skillId: SkillId, newValue: boolean) {
    if (mutation.status == "success") {
      mutation.reset();
    }

    const previousValue = assignedSkillIds.includes(skillId);

    let updatedChanges: typeof changes;
    if (newValue === previousValue) {
      const { [skillId]: _, ...rest } = changes;
      updatedChanges = rest;
    } else {
      updatedChanges = { ...changes, [skillId]: newValue };
    }

    setChanges(updatedChanges);

    debouncer.maybeExecute({
      organizationId: organization.id,
      skillCheckSessionId: sessionId,
      addedSkillIds: Object.entries(updatedChanges)
        .filter(([_, selected]) => selected)
        .map(([id, _]) => id as SkillId),
      removedSkillIds: Object.entries(updatedChanges)
        .filter(([_, selected]) => !selected)
        .map(([id, _]) => id as SkillId),
    });
  }

  const packageSections = R.pipe(
    skillPackages,
    R.sortBy((skillPackage) => skillPackage.name),
    R.map((skillPackage) => ({
      skillPackage,
      groups: R.pipe(
        skillGroups,
        R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
        R.sortBy((skillGroup) => skillGroup.sequence),
        R.map((skillGroup) => ({
          skillGroup,
          skills: R.pipe(
            skills.filter((skill) => skill.skillGroupId === skillGroup.id),
            R.sortBy((skill) => skill.name),
          ),
        })),
        R.filter(({ skills }) => skills.length > 0),
      ),
    })),
    R.filter(({ groups }) => groups.length > 0),
  );

  return (
    <>
      <Std.Navbar>
        <Std.Breadcrumbs
          breadcrumbs={[
            {
              label: "Skill Track",
              href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
            },
            {
              label: "Sessions",
              href: route("/orgs/[slug]/skill-track/sessions", {
                slug: organization.slug,
              }),
            },
            {
              label: session.name,
              href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                slug: organization.slug,
                session_id: sessionId,
              }),
            },
            "Skills",
          ]}
        />
        <div className="flex justify-end grow">
          <SaveStatusIndicator status={mutation.status} />
        </div>
      </Std.Navbar>
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>Session Skills</Saratoga.Title>
            <Saratoga.Actions>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">
                    <DropdownMenuTriggerIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Show</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={showSkillDescription}
                      onCheckedChange={setShowSkillDescription}
                    >
                      <span>Skill Description</span>
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </Saratoga.Actions>
          </Saratoga.Header>
          <div className="mt-6 space-y-6">
            {packageSections.map(({ skillPackage, groups }) => {
              const skillsInPackage = groups.flatMap(({ skills }) => skills);
              const packageSelectedCount = skillsInPackage.filter((s) => isSelected(s.id)).length;

              return (
                <Collapsible key={skillPackage.id} defaultOpen>
                  <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                    <span>{skillPackage.name}</span>
                    <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                      <span>
                        {packageSelectedCount} of {skillsInPackage.length} selected
                      </span>
                      <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-6 pt-4">
                      {groups.map(({ skillGroup, skills }) => (
                        <div key={skillGroup.id}>
                          <div className="text-sm font-medium text-muted-foreground mb-2">
                            {skillGroup.name}
                          </div>
                          <FieldGroup>
                            {skills.map((skill) => (
                              <Field orientation="horizontal" key={skill.id}>
                                <Checkbox
                                  id={`skill-${skill.id}`}
                                  checked={isSelected(skill.id)}
                                  onCheckedChange={(checked) =>
                                    handleChangeChecked(skill.id, !!checked)
                                  }
                                />
                                <FieldContent>
                                  <FieldLabel htmlFor={`skill-${skill.id}`}>
                                    {skill.name}
                                  </FieldLabel>
                                  {showSkillDescription && skill.description && (
                                    <FieldDescription>{skill.description}</FieldDescription>
                                  )}
                                </FieldContent>
                              </Field>
                            ))}
                          </FieldGroup>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/skills/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/skills
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionSkills_Content } from "@/components/skill-track/session-skills-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/skills">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
  const session = await fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return { title: `${session.name || session.id} ${TITLE_SEPARATOR} Skills` };
}

export default async function SkillTrack_SessionSkills_Page(props: Props) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );
  prefetch(
    trpc.skills.listAssessableSkills.queryOptions({
      organizationId: organization.id,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_SessionSkills_Content sessionId={skillCheckSessionId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Manual smoke check**

With the dev server running, visit the session skills page from the session
detail page, confirm no full-page loading flash (queries already warm), then
visit it directly via URL and confirm it still loads correctly (fresh
client fetch for `listSessionSkills`).

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/skills/page.tsx \
        src/components/skill-track/session-skills-content.tsx
git commit -m "Move session skills page to the standard detail-page pattern"
```

---

### Task 6: `sessions/[session_id]/personnel` → thin shell + `session-personnel-content.tsx`

**Files:**

- Create: `src/components/skill-track/session-personnel-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/personnel/page.tsx`

**Interfaces:**

- Consumes: `trpc.skills.getSession`, `trpc.skills.listSessionAssessees`,
  `trpc.teams.listTeams`, `trpc.teams.listTeamMemberships` (all existing).
- Produces: `SkillTrack_SessionPersonnel_Content({ sessionId: SkillCheckSessionId })`.
- Prefetch: `getSession`, `teams.listTeams`, `teams.listTeamMemberships`.
  **Skip** `listSessionAssessees({ scope: "assigned" })`.

- [ ] **Step 1: Create `session-personnel-content.tsx`**

Create `src/components/skill-track/session-personnel-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";

import { skillsInvalidations } from "@/client/skills-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillTrack_SessionPersonnel_Content({
  sessionId,
}: {
  sessionId: SkillCheckSessionId;
}) {
  const organization = useOrganization();

  const [
    { data: assignedPersonnel },
    { data: session },
    { data: teams },
    { data: teamMemberships },
  ] = useSuspenseQueries({
    queries: [
      trpc.skills.listSessionAssessees.queryOptions({
        sessionId: sessionId,
        organizationId: organization.id,
        scope: "assigned",
      }),
      trpc.skills.getSession.queryOptions({
        organizationId: organization.id,
        skillCheckSessionId: sessionId,
      }),
      trpc.teams.listTeams.queryOptions({
        organizationId: organization.id,
      }),
      trpc.teams.listTeamMemberships.queryOptions({
        organizationId: organization.id,
      }),
    ],
  });

  const mutation = useMutation(
    trpc.skills.updateSessionAssessees.mutationOptions({
      meta: { invalidates: skillsInvalidations.updateSessionAssessees },
      onError(error) {
        console.error("Failed to update session assessees:", error);
        toast.error(`Failed to update session assessees. ${error.message}`);
      },
      onSuccess({ updatedAssessees, updatedSession }, _variables, _onMutateResult, context) {
        setChanges({});

        context.client.setQueryData(
          trpc.skills.listSessionAssessees.queryKey({
            sessionId: sessionId,
            organizationId: organization.id,
            scope: "assigned",
          }),
          updatedAssessees,
        );
        context.client.setQueryData(
          trpc.skills.getSession.queryKey({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
          }),
          (old) => (old ? { ...old, ...updatedSession } : old),
        );
      },
    }),
  );

  const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

  const [changes, setChanges] = useState<Record<PersonId, boolean>>({});

  const assignedPersonIds = assignedPersonnel.map((p) => p.id);

  function isSelected(personId: PersonId) {
    return changes[personId] ?? assignedPersonIds.includes(personId);
  }

  function handleChangeChecked(personId: PersonId, newValue: boolean) {
    if (mutation.status == "success") {
      mutation.reset();
    }

    const previousValue = assignedPersonIds.includes(personId);

    let updatedChanges: typeof changes;
    if (newValue === previousValue) {
      const { [personId]: _, ...rest } = changes;
      updatedChanges = rest;
    } else {
      updatedChanges = { ...changes, [personId]: newValue };
    }
    setChanges(updatedChanges);

    debouncer.maybeExecute({
      organizationId: organization.id,
      skillCheckSessionId: sessionId,
      addedPersonIds: Object.entries(updatedChanges)
        .filter(([_, selected]) => selected)
        .map(([id, _]) => id as PersonId),
      removedPersonIds: Object.entries(updatedChanges)
        .filter(([_, selected]) => !selected)
        .map(([id, _]) => id as PersonId),
    });
  }

  const teamSections = R.pipe(
    teams,
    R.sortBy((team) => team.name),
    R.map((team) => ({
      team,
      members: R.pipe(
        teamMemberships.filter((m) => m.teamId === team.id),
        R.sortBy((m) => m.person.name),
      ),
    })),
    R.filter(({ members }) => members.length > 0),
  );

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Track",
            href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
          },
          {
            label: "Sessions",
            href: route("/orgs/[slug]/skill-track/sessions", {
              slug: organization.slug,
            }),
          },
          {
            label: session.name,
            href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
              slug: organization.slug,
              session_id: sessionId,
            }),
          },
          "Personnel",
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>Session Personnel</Saratoga.Title>
          </Saratoga.Header>
          <div className="mt-6 space-y-6">
            {teamSections.map(({ team, members }) => {
              const teamSelectedCount = members.filter((m) => isSelected(m.person.id)).length;

              return (
                <Collapsible key={team.id} defaultOpen>
                  <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                    <span>{team.name}</span>
                    <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                      <span>
                        {teamSelectedCount} of {members.length} selected
                      </span>
                      <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <FieldGroup className="pt-4">
                      {members.map((membership) => (
                        <Field orientation="horizontal" key={membership.id}>
                          <Checkbox
                            id={`membership-${membership.id}`}
                            checked={isSelected(membership.person.id)}
                            onCheckedChange={(checked) =>
                              handleChangeChecked(membership.person.id, !!checked)
                            }
                          />
                          <FieldLabel htmlFor={`membership-${membership.id}`}>
                            {membership.person.name}
                          </FieldLabel>
                        </Field>
                      ))}
                    </FieldGroup>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/personnel/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/personnel
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionPersonnel_Content } from "@/components/skill-track/session-personnel-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/personnel">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
  const session = await fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return { title: `${session.name || session.id} ${TITLE_SEPARATOR} Personnel` };
}

export default async function SkillTrack_SessionPersonnel_Page(props: Props) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );
  prefetch(
    trpc.teams.listTeams.queryOptions({
      organizationId: organization.id,
    }),
  );
  prefetch(
    trpc.teams.listTeamMemberships.queryOptions({
      organizationId: organization.id,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_SessionPersonnel_Content sessionId={skillCheckSessionId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Manual smoke check**

With the dev server running, visit the session personnel page, toggle a
person, confirm the debounced save works and status indicator updates.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/personnel/page.tsx \
        src/components/skill-track/session-personnel-content.tsx
git commit -m "Move session personnel page to the standard detail-page pattern"
```

---

### Task 7: `sessions/[session_id]/checks` → thin shell + `session-checks-content.tsx`

**Files:**

- Create: `src/components/skill-track/session-checks-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/checks/page.tsx`

**Interfaces:**

- Consumes: `trpc.skills.getSession`, `trpc.skills.listSessionAssessees`,
  `trpc.skills.listSessionAssessors`, `trpc.skills.listSessionSkills`,
  `trpc.skillChecks.listSkillChecks` (all existing).
- Produces: `SkillTrack_SessionChecks_Content({ sessionId: SkillCheckSessionId })`.
- Prefetch: `getSession`, `listSessionAssessees({ scope: "all" })`,
  `listSessionAssessors({ scope: "all" })`, `listSessionSkills({ scope: "all" })`.
  **Skip** `listSkillChecks({ sessionId })` (no scope/flags — same key as
  the parent session page's card query).

- [ ] **Step 1: Create `session-checks-content.tsx`**

Create `src/components/skill-track/session-checks-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon } from "lucide-react";
import { useMemo } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Show } from "@/components/show";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck } from "@/lib/schemas/skill-check";
import { trpc } from "@/trpc/client";

import { SKILL_CHECK_RESULT_LABELS, SKILL_CHECK_STATUS_LABELS } from "@/lib/schemas/skill-check";

export function SkillTrack_SessionChecks_Content({
  sessionId,
}: {
  sessionId: SkillCheckSessionId;
}) {
  const organization = useOrganization();

  const [
    { data: session },
    { data: assessees },
    { data: assessors },
    { data: skills },
    { data: skillChecks },
  ] = useSuspenseQueries({
    queries: [
      trpc.skills.getSession.queryOptions({
        organizationId: organization.id,
        skillCheckSessionId: sessionId,
      }),
      trpc.skills.listSessionAssessees.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
        scope: "all",
      }),
      trpc.skills.listSessionAssessors.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
        scope: "all",
      }),
      trpc.skills.listSessionSkills.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
        scope: "all",
      }),
      trpc.skillChecks.listSkillChecks.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
      }),
    ],
  });

  const assesseeById = useMemo(
    () => new Map<PersonId, PersonRef>(assessees.map((p) => [p.id, p])),
    [assessees],
  );
  const assessorById = useMemo(
    () => new Map<PersonId, PersonRef>(assessors.map((p) => [p.id, p])),
    [assessors],
  );
  const skillById = useMemo(
    () => new Map<SkillId, SkillRef>(skills.map((s) => [s.id, s])),
    [skills],
  );

  type Row = SkillCheck;

  const columns = useMemo(
    () =>
      Kaga.defineColumns<Row>((col) => [
        col.accessor((row) => assesseeById.get(row.assesseeId)?.name ?? row.assesseeId, {
          id: "assessee",
          header: "Assessee",
          enableColumnFilter: false,
          enableGlobalFilter: true,
          enableHiding: false,
          enableSorting: true,
        }),
        col.accessor((row) => skillById.get(row.skillId)?.name ?? row.skillId, {
          id: "skill",
          header: "Skill",
          enableColumnFilter: false,
          enableGlobalFilter: true,
          enableHiding: false,
          enableSorting: true,
        }),
        col.accessor("result", {
          header: "Result",
          cell: (ctx) => SKILL_CHECK_RESULT_LABELS[ctx.getValue()] ?? ctx.getValue(),
          enableColumnFilter: true,
          enableGlobalFilter: false,
          enableHiding: false,
          enableSorting: false,
          filterFn: Kaga.filterFns.oneOf,
          meta: {
            columnOptions: Object.entries(SKILL_CHECK_RESULT_LABELS).map(([value, label]) => ({
              label,
              value,
            })),
          },
        }),
        col.accessor((row) => assessorById.get(row.assessorId)?.name ?? row.assessorId, {
          id: "assessor",
          header: "Assessor",
          enableColumnFilter: false,
          enableGlobalFilter: true,
          enableHiding: true,
          enableSorting: true,
        }),
        col.accessor("status", {
          header: "Status",
          cell: (ctx) => SKILL_CHECK_STATUS_LABELS[ctx.getValue()] ?? ctx.getValue(),
          enableColumnFilter: true,
          enableGlobalFilter: false,
          enableHiding: true,
          enableSorting: false,
          filterFn: Kaga.filterFns.oneOf,
          meta: {
            columnOptions: [
              { label: "Draft", value: "Draft" },
              { label: "Approved", value: "Include" },
              { label: "Excluded", value: "Exclude" },
            ],
          },
        }),
      ]),
    [assesseeById, assessorById, skillById],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
  const table = useReactTable({
    data: skillChecks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
      sorting: [{ id: "assessee", desc: false }],
      columnVisibility: {
        assessor: false,
        status: false,
      },
    },
  });

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Track",
            href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
          },
          {
            label: "Sessions",
            href: route("/orgs/[slug]/skill-track/sessions", {
              slug: organization.slug,
            }),
          },
          {
            label: session.name || session.id,
            href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
              slug: organization.slug,
              session_id: sessionId,
            }),
          },
          "Checks",
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>Skill checks recorded in {session.name || session.id}</Saratoga.Title>
          </Saratoga.Header>
          <Show
            when={skillChecks.length > 0}
            fallback={
              <Empty>
                <EmptyMedia>
                  <ClipboardCheckIcon className="size-12 text-muted-foreground" />
                </EmptyMedia>
                <EmptyDescription>
                  No skill checks have been recorded for this session yet.
                </EmptyDescription>
              </Empty>
            }
          >
            <div>
              <Kaga.TableToolbar table={table} />
              <Kaga.Table table={table} />
              <Kaga.TablePagination table={table} />
            </div>
          </Show>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/checks/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/checks
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionChecks_Content } from "@/components/skill-track/session-checks-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/checks">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
  const session = await fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return { title: `${session.name || session.id} ${TITLE_SEPARATOR} Checks` };
}

export default async function SkillTrack_SessionChecks_Page(props: Props) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );
  prefetch(
    trpc.skills.listSessionAssessees.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      scope: "all",
    }),
  );
  prefetch(
    trpc.skills.listSessionAssessors.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      scope: "all",
    }),
  );
  prefetch(
    trpc.skills.listSessionSkills.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      scope: "all",
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_SessionChecks_Content sessionId={skillCheckSessionId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Manual smoke check**

With the dev server running, visit the session checks page and confirm the
table renders, sorts, and filters as before.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/checks/page.tsx \
        src/components/skill-track/session-checks-content.tsx
git commit -m "Move session checks page to the standard detail-page pattern"
```

---

### Task 8: `sessions/[session_id]/review` → thin shell + `session-review-content.tsx`

**Files:**

- Create: `src/components/skill-track/session-review-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/review/page.tsx`

**Interfaces:**

- Consumes: `trpc.skills.getSession`, `trpc.skills.listSessionAssessees`,
  `trpc.skills.listSessionAssessors`, `trpc.skills.listSessionSkills`,
  `trpc.skillChecks.listSkillChecks`, `trpc.skillChecks.approveSession`
  (mutation) — all existing.
- Produces: `SkillTrack_SessionReview_Content({ sessionId: SkillCheckSessionId })`.
- Prefetch: `getSession`, `listSessionAssessees({ scope: "all" })`,
  `listSessionAssessors({ scope: "all" })`, `listSessionSkills({ scope: "all" })`.
  **Skip** `listSkillChecks({ sessionId })`.

- [ ] **Step 1: Create `session-review-content.tsx`**

Create `src/components/skill-track/session-review-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Show } from "@/components/show";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MutationButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHeadCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
import { trpc } from "@/trpc/client";

import { SKILL_CHECK_RESULT_LABELS } from "@/lib/schemas/skill-check";

export function SkillTrack_SessionReview_Content({
  sessionId,
}: {
  sessionId: SkillCheckSessionId;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const [
    { data: session },
    { data: assessees },
    { data: assessors },
    { data: sessionSkills },
    { data: skillChecks },
  ] = useSuspenseQueries({
    queries: [
      trpc.skills.getSession.queryOptions({
        organizationId: organization.id,
        skillCheckSessionId: sessionId,
      }),
      trpc.skills.listSessionAssessees.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
        scope: "all",
      }),
      trpc.skills.listSessionAssessors.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
        scope: "all",
      }),
      trpc.skills.listSessionSkills.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
        scope: "all",
      }),
      trpc.skillChecks.listSkillChecks.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
      }),
    ],
  });

  const skillById = useMemo(() => new Map(sessionSkills.map((s) => [s.id, s])), [sessionSkills]);

  const assessorById = useMemo(() => new Map(assessors.map((p) => [p.id, p])), [assessors]);

  const [selected, setSelected] = useState<Set<SkillCheckId>>(
    () => new Set(skillChecks.filter((c) => c.status !== "Exclude").map((c) => c.id)),
  );

  const mutation = useMutation(
    trpc.skillChecks.approveSession.mutationOptions({
      onError(error) {
        toast.error(`Failed to approve session: ${error.message}`);
      },
      onSuccess({ updated }) {
        toast.success("Session approved.");

        queryClient.setQueryData(
          trpc.skills.getSession.queryKey({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
          }),
          (old) => (old ? { ...old, ...updated } : old),
        );
      },
    }),
  );

  function toggleCheck(id: SkillCheckId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(checkIds: SkillCheckId[]) {
    const allSelected = checkIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of checkIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function handleApprove() {
    mutation.mutate({
      organizationId: organization.id,
      sessionId: sessionId,
      includedCheckIds: [...selected],
    });
  }

  return (
    <>
      <Std.Navbar
        breadcrumbs={[
          {
            label: "Skill Track",
            href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
          },
          {
            label: "Sessions",
            href: route("/orgs/[slug]/skill-track/sessions", {
              slug: organization.slug,
            }),
          },
          {
            label: session.name || session.id,
            href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
              slug: organization.slug,
              session_id: sessionId,
            }),
          },
          "Review",
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>Review</Saratoga.Title>
          </Saratoga.Header>
          <Show when={session.status === "Include"}>
            <Alert>
              <AlertTitle>Already approved</AlertTitle>
              <AlertDescription>
                This session has already been approved. You can update the selection and re-approve.
              </AlertDescription>
            </Alert>
          </Show>

          <Show
            when={skillChecks.length > 0}
            fallback={
              <Empty>
                <EmptyMedia>
                  <ClipboardCheckIcon className="size-12 text-muted-foreground" />
                </EmptyMedia>
                <EmptyDescription>
                  No skill checks have been recorded for this session yet.
                </EmptyDescription>
              </Empty>
            }
          >
            <Card>
              <CardHeader>
                <CardTitle>Review</CardTitle>
                <CardDescription>
                  Select the skill checks you want to include in the session approval. Only the
                  selected checks will be included in the session results. You can change the
                  selection and re-approve as needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeadCell></TableHeadCell>
                      <TableHeadCell>Assessee</TableHeadCell>
                      <TableHeadCell>Skill</TableHeadCell>
                      <TableHeadCell>Result</TableHeadCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessees.map((assessee) => (
                      <AssesseeChecks
                        key={assessee.id}
                        assessee={assessee}
                        assesseeChecks={skillChecks.filter(
                          (check) => check.assesseeId === assessee.id,
                        )}
                        skillById={skillById}
                        assessorById={assessorById}
                        selected={selected}
                        toggleCheck={toggleCheck}
                        toggleGroup={toggleGroup}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="justify-end">
                <MutationButton
                  status={mutation.status}
                  onClick={handleApprove}
                  text={{
                    idle: "Approve",
                    pending: "Submitting...",
                    success: "Submitted",
                  }}
                />
              </CardFooter>
            </Card>
          </Show>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}

interface AssesseeChecksProps {
  assessee: PersonRef;
  assesseeChecks: SkillCheck[];
  skillById: Map<SkillId, SkillRef>;
  assessorById: Map<PersonId, PersonRef>;
  selected: Set<SkillCheckId>;
  toggleCheck(id: SkillCheckId): void;
  toggleGroup(ids: SkillCheckId[]): void;
}

function AssesseeChecks({
  assessee,
  assesseeChecks,
  skillById,

  selected,
  toggleCheck,
  toggleGroup,
}: AssesseeChecksProps) {
  const selectedCount = assesseeChecks.filter((check) => selected.has(check.id)).length;

  const hasChecks = assesseeChecks.length > 0;

  return (
    <>
      <TableRow>
        <TableCell>
          {hasChecks && (
            <Checkbox
              id={`select-all-${assessee.id}`}
              checked={
                selectedCount == assesseeChecks.length
                  ? true
                  : selectedCount === 0
                    ? false
                    : "indeterminate"
              }
              onCheckedChange={() => toggleGroup(assesseeChecks.map((check) => check.id))}
            />
          )}
        </TableCell>
        <TableCell className="font-medium" colSpan={2}>
          {assessee.name}
        </TableCell>
        {!hasChecks && (
          <TableCell className="text-muted-foreground">No skill checks recorded</TableCell>
        )}
      </TableRow>
      {assesseeChecks.map((check) => {
        const skill = skillById.get(check.skillId);
        return (
          <TableRow key={check.id}>
            <TableCell>
              <Checkbox
                id={`check-${check.id}`}
                checked={selected.has(check.id)}
                onCheckedChange={() => toggleCheck(check.id)}
              />
            </TableCell>
            <TableCell></TableCell>
            <TableCell>{skill?.name ?? check.skillId}</TableCell>
            <TableCell>{SKILL_CHECK_RESULT_LABELS[check.result] ?? check.result}</TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
```

(The commented-out `//const assessor = assessorById.get(check.assessorId);` line
in the original `AssesseeChecks` is dropped as dead code.)

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/review/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/review
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionReview_Content } from "@/components/skill-track/session-review-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/review">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
  const session = await fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return { title: `${session.name || session.id} ${TITLE_SEPARATOR} Review` };
}

export default async function SkillTrack_SessionReview_Page(props: Props) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );
  prefetch(
    trpc.skills.listSessionAssessees.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      scope: "all",
    }),
  );
  prefetch(
    trpc.skills.listSessionAssessors.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      scope: "all",
    }),
  );
  prefetch(
    trpc.skills.listSessionSkills.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      scope: "all",
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_SessionReview_Content sessionId={skillCheckSessionId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Manual smoke check**

With the dev server running, visit the review page for a session with
recorded checks, toggle a few checkboxes, and approve — confirm the "Already
approved" alert and status update in place.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/review/page.tsx \
        src/components/skill-track/session-review-content.tsx
git commit -m "Move session review page to the standard detail-page pattern"
```

---

### Task 9: `sessions/[session_id]/by-skill` → thin shell + `session-by-skill-content.tsx`

**Files:**

- Create: `src/components/skill-track/session-by-skill-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/by-skill/page.tsx`

**Interfaces:**

- Consumes: `trpc.skills.getSession`, `trpc.skills.listSessionAssessees`,
  `trpc.skillChecks.listSkillChecks`, `trpc.skills.listSessionSkills`,
  `trpc.personnel.getPersonSelf`, `trpc.skills.listAssessableSkills`,
  `trpc.skillChecks.upsertSessionSkillChecks` (mutation) — all existing.
- Produces: `SkillTrack_SessionBySkill_Content({ sessionId: SkillCheckSessionId })`.
- Prefetch: `getSession`, `personnel.getPersonSelf`, `listAssessableSkills`,
  `listSkillChecks({ sessionId, ownChecksOnly: true })` (different key from
  the parent's `listSkillChecks` — **not** redundant). **Skip**
  `listSessionAssessees({ scope: "assigned" })`,
  `listSessionSkills({ scope: "assigned" })`.

- [ ] **Step 1: Create `session-by-skill-content.tsx`**

Create `src/components/skill-track/session-by-skill-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
  ArrowDownAZIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  ListTreeIcon,
} from "lucide-react";
import { useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";
import { match } from "ts-pattern";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Show } from "@/components/show";
import { SkillTrack_AssessmentRow } from "@/components/skill-track/assessment-row";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RainbowSpinner } from "@/components/ui/loading";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

export function SkillTrack_SessionBySkill_Content({
  sessionId,
}: {
  sessionId: SkillCheckSessionId;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const skillChecksQueryOptions = trpc.skillChecks.listSkillChecks.queryOptions({
    organizationId: organization.id,
    sessionId: sessionId,
    ownChecksOnly: true,
  });

  const [
    { data: session },
    { data: assignedPersonnel },
    { data: skillChecks },
    { data: sessionSkills },
    { data: personSelf },
    {
      data: { skills: assessableSkills, skillGroups, skillPackages },
    },
  ] = useSuspenseQueries({
    queries: [
      trpc.skills.getSession.queryOptions({
        organizationId: organization.id,
        skillCheckSessionId: sessionId,
      }),
      trpc.skills.listSessionAssessees.queryOptions({
        sessionId: sessionId,
        organizationId: organization.id,
        scope: "assigned",
      }),
      skillChecksQueryOptions,
      trpc.skills.listSessionSkills.queryOptions({
        sessionId: sessionId,
        organizationId: organization.id,
        scope: "assigned",
      }),
      trpc.personnel.getPersonSelf.queryOptions({
        organizationId: organization.id,
      }),
      trpc.skills.listAssessableSkills.queryOptions({
        organizationId: organization.id,
      }),
    ],
  });

  const mutation = useMutation(
    trpc.skillChecks.upsertSessionSkillChecks.mutationOptions({
      onError(error) {
        console.error("Failed to save skill check changes:", error);
        toast.error(`Failed to save changes: ${error.message}`);
      },
      onSuccess({ created, updated, deleted }, variables) {
        // Surgically remove only changes whose values still match what was sent.
        // If the user edited a person again while the mutation was in flight, the
        // current value will differ from what we sent — leave those entries alone.
        setChanges((prev) => {
          const next = { ...prev };
          for (const u of variables.updates) {
            const key = `${u.assesseeId}::${u.skillId}` as `${PersonId}::${SkillId}`;
            const current = next[key];
            if (current?.result === u.result && current?.notes === u.notes) {
              delete next[key];
            }
          }
          return next;
        });

        // Surgically update the query cache from the returned records.
        queryClient.setQueryData(skillChecksQueryOptions.queryKey, (old) => {
          if (!old) return old;

          const deletedKeys = new Set(deleted.map((d) => `${d.assesseeId}::${d.skillId}`));
          const updatedMap = new Map(updated.map((c) => [`${c.assesseeId}::${c.skillId}`, c]));

          const result = old
            .filter((c) => !deletedKeys.has(`${c.assesseeId}::${c.skillId}`))
            .map((c) => updatedMap.get(`${c.assesseeId}::${c.skillId}`) ?? c);

          return [...result, ...created];
        });
      },
    }),
  );

  const isAssignedAssessor =
    !!personSelf && session.assessors.some((assessor) => assessor.id === personSelf.id);

  const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

  type Selected = { skillId: SkillId; status: "Loading" | "Selected" } | null;
  const [selected, setSelected] = useState<Selected>(null);

  async function handleSwitchSkill(skillId: SkillId) {
    mutation.reset();
    setSelected({ skillId, status: "Loading" });
    await new Promise((resolve) => setTimeout(resolve, 200));

    setSelected({ skillId, status: "Selected" });
  }

  // Keyed by `${personId}::${skillId}` — scoping by skill prevents cross-skill contamination
  // when switching between skills while changes are pending.
  const [changes, setChanges] = useState<
    Record<`${PersonId}::${SkillId}`, { result: string; notes: string }>
  >({});

  function handleChange(personId: PersonId, newValue: { result: string; notes: string }) {
    if (mutation.status === "success") mutation.reset();

    const key = `${personId}::${selected!.skillId}`;
    const updatedChanges: typeof changes = { ...changes, [key]: newValue };
    setChanges(updatedChanges);

    debouncer.maybeExecute({
      organizationId: organization.id,
      sessionId: sessionId,
      updates: R.entries(updatedChanges).map(([k, { result, notes }]) => {
        const [assesseeId, sid] = k.split("::") as [PersonId, SkillId];
        return { assesseeId, skillId: sid, result, notes };
      }),
    });
  }

  function getCurrentValue(assesseeId: PersonId, skillId: SkillId) {
    const change = changes[`${assesseeId}::${skillId}`];
    if (change) return change;

    const savedCheck = skillChecks.find(
      (check) => check.skillId == skillId && check.assesseeId == assesseeId,
    );
    return {
      result: savedCheck?.result ?? "NotAssessed",
      notes: savedCheck?.notes ?? "",
    };
  }

  const [skillOrder, setSkillOrder] = useState<"alphabetical" | "by-package-group">("alphabetical");
  const [showSkillDescription, setShowSkillDescription] = useState(false);

  // Group the session skills (the left-hand picker) by skill package and group (for the
  // "by-package-group" order). Packages are sorted by name, groups by sequence; skills keep the
  // alphabetical order of `sessionSkills`. Packages/groups with no session skills are omitted.
  const assessableSkillById = new Map(assessableSkills.map((skill) => [skill.id, skill]));
  const packageSections = R.pipe(
    skillPackages,
    R.sortBy((skillPackage) => skillPackage.name),
    R.map((skillPackage) => ({
      skillPackage,
      groups: R.pipe(
        skillGroups,
        R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
        R.sortBy((skillGroup) => skillGroup.sequence),
        R.map((skillGroup) => ({
          skillGroup,
          skills: sessionSkills.filter(
            (skill) => assessableSkillById.get(skill.id)?.skillGroupId === skillGroup.id,
          ),
        })),
        R.filter(({ skills }) => skills.length > 0),
      ),
    })),
    R.filter(({ groups }) => groups.length > 0),
  );

  // Session skills that are no longer in the assessable set (e.g. subscription removed).
  const ungroupedSkills = sessionSkills.filter((skill) => !assessableSkillById.has(skill.id));

  function skillDescription(skillId: SkillId) {
    return showSkillDescription
      ? assessableSkillById.get(skillId)?.description || undefined
      : undefined;
  }

  const renderSkillItem = (skill: (typeof sessionSkills)[number]) => (
    <Item key={skill.id} asChild variant={skill.id === selected?.skillId ? "outline" : "default"}>
      <a
        onClick={() => {
          handleSwitchSkill(skill.id);
        }}
      >
        <ItemContent>
          <ItemTitle>{skill.name}</ItemTitle>
          {skillDescription(skill.id) && (
            <ItemDescription>{skillDescription(skill.id)}</ItemDescription>
          )}
        </ItemContent>

        <ItemActions>
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </ItemActions>
      </a>
    </Item>
  );

  return (
    <>
      <Std.Navbar>
        <Std.Breadcrumbs
          breadcrumbs={[
            {
              label: "Skill Track",
              href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
            },
            {
              label: "Sessions",
              href: route("/orgs/[slug]/skill-track/sessions", {
                slug: organization.slug,
              }),
            },
            {
              label: session.name || session.id,
              href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                slug: organization.slug,
                session_id: sessionId,
              }),
            },
            "By Skill",
          ]}
        />
        <div className="flex justify-end grow">
          <SaveStatusIndicator status={mutation.status} />
        </div>
      </Std.Navbar>
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>Assess by Skill</Saratoga.Title>
            <Saratoga.Actions>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">
                    <DropdownMenuTriggerIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Skill Order</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={skillOrder}
                      onValueChange={(value) => setSkillOrder(value as typeof skillOrder)}
                    >
                      <DropdownMenuRadioItem value="alphabetical">
                        <ArrowDownAZIcon />
                        <span>Alphabetical</span>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="by-package-group">
                        <ListTreeIcon />
                        <span>By Package/Group</span>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Show</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={showSkillDescription}
                      onCheckedChange={setShowSkillDescription}
                    >
                      <span>Skill Description</span>
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </Saratoga.Actions>
          </Saratoga.Header>
          <Show
            when={!!personSelf}
            fallback={
              <Alert variant="warning">
                <AlertTitle>No linked person record</AlertTitle>
                <AlertDescription>
                  Your account is not linked to a person record in this organization. Contact an
                  administrator to link your account before recording skill checks.
                </AlertDescription>
              </Alert>
            }
          >
            <Show
              when={isAssignedAssessor}
              fallback={
                <Alert variant="warning">
                  <AlertTitle>Not an assigned assessor</AlertTitle>
                  <AlertDescription>
                    You are not an assigned assessor for this session, so you cannot record skill
                    checks here.
                  </AlertDescription>
                </Alert>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_2fr] gap-4">
                <div>
                  <FieldGroup className="block lg:hidden">
                    <Field>
                      <FieldLabel>Skill</FieldLabel>
                      <Select
                        value={selected?.skillId ?? undefined}
                        onValueChange={(value) => {
                          handleSwitchSkill(value as SkillId);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a skill" />
                        </SelectTrigger>
                        <SelectContent>
                          {match(skillOrder)
                            .with("alphabetical", () =>
                              sessionSkills.map((skill) => (
                                <SelectItem key={skill.id} value={skill.id}>
                                  {skill.name}
                                </SelectItem>
                              )),
                            )
                            .with("by-package-group", () => (
                              <>
                                {packageSections.flatMap(({ skillPackage, groups }) =>
                                  groups.map(({ skillGroup, skills }) => (
                                    <SelectGroup key={skillGroup.id}>
                                      <SelectLabel>
                                        {skillPackage.name} · {skillGroup.name}
                                      </SelectLabel>
                                      {skills.map((skill) => (
                                        <SelectItem key={skill.id} value={skill.id}>
                                          {skill.name}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  )),
                                )}
                                {ungroupedSkills.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>Other</SelectLabel>
                                    {ungroupedSkills.map((skill) => (
                                      <SelectItem key={skill.id} value={skill.id}>
                                        {skill.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                              </>
                            ))
                            .exhaustive()}
                        </SelectContent>
                      </Select>
                      {selected && skillDescription(selected.skillId) && (
                        <FieldDescription>{skillDescription(selected.skillId)}</FieldDescription>
                      )}
                    </Field>
                  </FieldGroup>
                  <ItemGroup className="hidden lg:block">
                    {match(skillOrder)
                      .with("alphabetical", () => sessionSkills.map(renderSkillItem))
                      .with("by-package-group", () => (
                        <div className="space-y-6">
                          {packageSections.map(({ skillPackage, groups }) => (
                            <div key={skillPackage.id} className="space-y-6">
                              <div className="font-semibold border-b pb-1">{skillPackage.name}</div>
                              {groups.map(({ skillGroup, skills }) => (
                                <div key={skillGroup.id}>
                                  <div className="text-sm font-medium text-muted-foreground mb-2">
                                    {skillGroup.name}
                                  </div>
                                  {skills.map(renderSkillItem)}
                                </div>
                              ))}
                            </div>
                          ))}
                          {ungroupedSkills.length > 0 && (
                            <div>
                              <div className="px-2 pt-2 font-semibold border-b">Other</div>
                              {ungroupedSkills.map(renderSkillItem)}
                            </div>
                          )}
                        </div>
                      ))
                      .exhaustive()}
                  </ItemGroup>
                </div>
                <Separator orientation="vertical" className="hidden lg:block" />
                <Separator orientation="horizontal" className="block lg:hidden" />
                <div className="flex flex-col gap-5">
                  {match(selected)
                    .with(null, () => (
                      <Empty>
                        <EmptyMedia>
                          <ArrowLeftIcon className="hidden lg:block size-12 text-muted-foreground" />
                          <ArrowUpIcon className="block lg:hidden size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>Select a skill to assess.</EmptyDescription>
                      </Empty>
                    ))
                    .with({ status: "Loading" }, () => (
                      <div className="flex justify-center items-center my-8">
                        <RainbowSpinner />
                      </div>
                    ))
                    .with({ status: "Selected" }, ({ skillId }) => (
                      <>
                        {assignedPersonnel.map((person) => (
                          <SkillTrack_AssessmentRow
                            key={person.id}
                            title={person.name}
                            value={getCurrentValue(person.id, skillId)}
                            onValueChange={(newValue) => handleChange(person.id, newValue)}
                          />
                        ))}
                      </>
                    ))
                    .exhaustive()}
                </div>
              </div>
            </Show>
          </Show>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/by-skill/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/by-skill
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionBySkill_Content } from "@/components/skill-track/session-by-skill-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/by-skill">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
  const session = await fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return { title: `${session.name || session.id} ${TITLE_SEPARATOR} By Skill` };
}

export default async function SkillTrack_SessionBySkill_Page(props: Props) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );
  prefetch(
    trpc.personnel.getPersonSelf.queryOptions({
      organizationId: organization.id,
    }),
  );
  prefetch(
    trpc.skills.listAssessableSkills.queryOptions({
      organizationId: organization.id,
    }),
  );
  prefetch(
    trpc.skillChecks.listSkillChecks.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      ownChecksOnly: true,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_SessionBySkill_Content sessionId={skillCheckSessionId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Manual smoke check**

With the dev server running (and logged in as an assigned assessor with a
linked person record), visit the by-skill page, select a skill, record a
check for a person, and confirm the debounced save + status indicator work,
and that switching "Skill Order" and toggling "Skill Description" behave as
before.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/by-skill/page.tsx \
        src/components/skill-track/session-by-skill-content.tsx
git commit -m "Move session by-skill page to the standard detail-page pattern"
```

---

### Task 10: `sessions/[session_id]/by-person` → thin shell + `session-by-person-content.tsx`

**Files:**

- Create: `src/components/skill-track/session-by-person-content.tsx`
- Modify: `src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/by-person/page.tsx`

**Interfaces:**

- Same query set as Task 9 (by-skill), symmetric page.
- Produces: `SkillTrack_SessionByPerson_Content({ sessionId: SkillCheckSessionId })`.
- Prefetch: `getSession`, `personnel.getPersonSelf`, `listAssessableSkills`,
  `listSkillChecks({ sessionId, ownChecksOnly: true })`. **Skip**
  `listSessionAssessees({ scope: "assigned" })`,
  `listSessionSkills({ scope: "assigned" })`.

- [ ] **Step 1: Create `session-by-person-content.tsx`**

Create `src/components/skill-track/session-by-person-content.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
  ArrowDownAZIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  ListTreeIcon,
} from "lucide-react";
import { useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";
import { match } from "ts-pattern";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Show } from "@/components/show";
import { SkillTrack_AssessmentRow } from "@/components/skill-track/assessment-row";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RainbowSpinner } from "@/components/ui/loading";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

export function SkillTrack_SessionByPerson_Content({
  sessionId,
}: {
  sessionId: SkillCheckSessionId;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const skillChecksQueryOptions = trpc.skillChecks.listSkillChecks.queryOptions({
    organizationId: organization.id,
    sessionId: sessionId,
    ownChecksOnly: true,
  });

  const [
    { data: session },
    { data: assignedPersonnel },
    { data: skillChecks },
    { data: sessionSkills },
    { data: personSelf },
    {
      data: { skills: assessableSkills, skillGroups, skillPackages },
    },
  ] = useSuspenseQueries({
    queries: [
      trpc.skills.getSession.queryOptions({
        organizationId: organization.id,
        skillCheckSessionId: sessionId,
      }),
      trpc.skills.listSessionAssessees.queryOptions({
        sessionId: sessionId,
        organizationId: organization.id,
        scope: "assigned",
      }),
      skillChecksQueryOptions,
      trpc.skills.listSessionSkills.queryOptions({
        sessionId: sessionId,
        organizationId: organization.id,
        scope: "assigned",
      }),
      trpc.personnel.getPersonSelf.queryOptions({
        organizationId: organization.id,
      }),
      trpc.skills.listAssessableSkills.queryOptions({
        organizationId: organization.id,
      }),
    ],
  });

  const mutation = useMutation(
    trpc.skillChecks.upsertSessionSkillChecks.mutationOptions({
      onError(error) {
        console.error("Failed to save skill check changes:", error);
        toast.error(`Failed to save changes: ${error.message}`);
      },
      onSuccess({ created, updated, deleted }, variables) {
        // Surgically remove only changes whose values still match what was sent.
        // If the user edited a skill again while the mutation was in flight, the
        // current value will differ from what we sent — leave those entries alone.
        setChanges((prev) => {
          const next = { ...prev };
          for (const u of variables.updates) {
            const key = `${u.assesseeId}::${u.skillId}` as `${PersonId}::${SkillId}`;
            const current = next[key];
            if (current?.result === u.result && current?.notes === u.notes) {
              delete next[key];
            }
          }
          return next;
        });

        // Surgically update the query cache from the returned records.
        queryClient.setQueryData(skillChecksQueryOptions.queryKey, (old) => {
          if (!old) return old;

          const deletedKeys = new Set(deleted.map((d) => `${d.assesseeId}::${d.skillId}`));
          const updatedMap = new Map(updated.map((c) => [`${c.assesseeId}::${c.skillId}`, c]));

          const result = old
            .filter((c) => !deletedKeys.has(`${c.assesseeId}::${c.skillId}`))
            .map((c) => updatedMap.get(`${c.assesseeId}::${c.skillId}`) ?? c);

          return [...result, ...created];
        });
      },
    }),
  );

  const isAssignedAssessor =
    !!personSelf && session.assessors.some((assessor) => assessor.id === personSelf.id);

  const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

  type Selected = { personId: PersonId; status: "Loading" | "Selected" } | null;
  const [selected, setSelected] = useState<Selected>(null);

  async function handleSwitchPerson(personId: PersonId) {
    mutation.reset();
    setSelected({ personId, status: "Loading" });
    await new Promise((resolve) => setTimeout(resolve, 200));

    setSelected({ personId, status: "Selected" });
  }

  // Keyed by `${personId}::${skillId}` — scoping by person prevents cross-person contamination
  // when switching between assessees while changes are pending.
  const [changes, setChanges] = useState<
    Record<`${PersonId}::${SkillId}`, { result: string; notes: string }>
  >({});

  function handleChange(skillId: SkillId, newValue: { result: string; notes: string }) {
    if (mutation.status === "success") mutation.reset();

    const key = `${selected!.personId}::${skillId}`;
    const updatedChanges: typeof changes = { ...changes, [key]: newValue };
    setChanges(updatedChanges);

    debouncer.maybeExecute({
      organizationId: organization.id,
      sessionId: sessionId,
      updates: R.entries(updatedChanges).map(([k, { result, notes }]) => {
        const [assesseeId, sid] = k.split("::") as [PersonId, SkillId];
        return { assesseeId, skillId: sid, result, notes };
      }),
    });
  }

  function getCurrentValue(assesseeId: PersonId, skillId: SkillId) {
    const change = changes[`${assesseeId}::${skillId}`];
    if (change) return change;

    const savedCheck = skillChecks.find(
      (check) => check.skillId == skillId && check.assesseeId == assesseeId,
    );
    return {
      result: savedCheck?.result ?? "NotAssessed",
      notes: savedCheck?.notes ?? "",
    };
  }

  const [skillOrder, setSkillOrder] = useState<"alphabetical" | "by-package-group">("alphabetical");
  const [showSkillDescription, setShowSkillDescription] = useState(false);

  // Group the session skills by skill package and group (for the "by-package-group" order).
  // Packages are sorted by name, groups by sequence; skills keep the alphabetical order of
  // `sessionSkills`. Packages/groups with no session skills are omitted.
  const assessableSkillById = new Map(assessableSkills.map((skill) => [skill.id, skill]));
  const packageSections = R.pipe(
    skillPackages,
    R.sortBy((skillPackage) => skillPackage.name),
    R.map((skillPackage) => ({
      skillPackage,
      groups: R.pipe(
        skillGroups,
        R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
        R.sortBy((skillGroup) => skillGroup.sequence),
        R.map((skillGroup) => ({
          skillGroup,
          skills: sessionSkills.filter(
            (skill) => assessableSkillById.get(skill.id)?.skillGroupId === skillGroup.id,
          ),
        })),
        R.filter(({ skills }) => skills.length > 0),
      ),
    })),
    R.filter(({ groups }) => groups.length > 0),
  );

  // Session skills that are no longer in the assessable set (e.g. subscription removed).
  const ungroupedSkills = sessionSkills.filter((skill) => !assessableSkillById.has(skill.id));

  return (
    <>
      <Std.Navbar>
        <Std.Breadcrumbs
          breadcrumbs={[
            {
              label: "Skill Track",
              href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
            },
            {
              label: "Sessions",
              href: route("/orgs/[slug]/skill-track/sessions", {
                slug: organization.slug,
              }),
            },
            {
              label: session.name || session.id,
              href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                slug: organization.slug,
                session_id: sessionId,
              }),
            },
            "By Person",
          ]}
        />
        <div className="flex justify-end grow">
          <SaveStatusIndicator status={mutation.status} />
        </div>
      </Std.Navbar>
      <Std.ScrollContainer>
        <Saratoga.Root>
          <Saratoga.Header>
            <Saratoga.Title>Assess by Person</Saratoga.Title>
            <Saratoga.Actions>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">
                    <DropdownMenuTriggerIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Skill Order</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={skillOrder}
                      onValueChange={(value) => setSkillOrder(value as typeof skillOrder)}
                    >
                      <DropdownMenuRadioItem value="alphabetical">
                        <ArrowDownAZIcon />
                        <span>Alphabetical</span>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="by-package-group">
                        <ListTreeIcon />
                        <span>By Package/Group</span>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Show</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={showSkillDescription}
                      onCheckedChange={setShowSkillDescription}
                    >
                      <span>Skill Description</span>
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </Saratoga.Actions>
          </Saratoga.Header>
          <Show
            when={!!personSelf}
            fallback={
              <Alert variant="warning">
                <AlertTitle>No linked person record</AlertTitle>
                <AlertDescription>
                  Your account is not linked to a person record in this organization. Contact an
                  administrator to link your account before recording skill checks.
                </AlertDescription>
              </Alert>
            }
          >
            <Show
              when={isAssignedAssessor}
              fallback={
                <Alert variant="warning">
                  <AlertTitle>Not an assigned assessor</AlertTitle>
                  <AlertDescription>
                    You are not an assigned assessor for this session, so you cannot record skill
                    checks here.
                  </AlertDescription>
                </Alert>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_2fr] gap-4">
                <div>
                  <FieldGroup className="block lg:hidden">
                    <Field>
                      <FieldLabel>Person</FieldLabel>
                      <Select
                        value={selected?.personId ?? undefined}
                        onValueChange={(value) => {
                          handleSwitchPerson(value as PersonId);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a person" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignedPersonnel.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
                  <ItemGroup className="hidden lg:block">
                    {assignedPersonnel.map((person) => (
                      <Item
                        key={person.id}
                        asChild
                        variant={person.id === selected?.personId ? "outline" : "default"}
                      >
                        <a
                          onClick={() => {
                            handleSwitchPerson(person.id);
                          }}
                        >
                          <ItemContent>
                            <ItemTitle>{person.name}</ItemTitle>
                          </ItemContent>

                          <ItemActions>
                            <ChevronRightIcon className="size-4 text-muted-foreground" />
                          </ItemActions>
                        </a>
                      </Item>
                    ))}
                  </ItemGroup>
                </div>
                <Separator orientation="vertical" className="hidden lg:block" />
                <Separator orientation="horizontal" className="block lg:hidden" />
                <div className="w-full flex flex-col gap-5">
                  {match(selected)
                    .with(null, () => (
                      <Empty>
                        <EmptyMedia>
                          <ArrowLeftIcon className="hidden lg:block size-12 text-muted-foreground" />
                          <ArrowUpIcon className="block lg:hidden size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>Select a person to assess their skills.</EmptyDescription>
                      </Empty>
                    ))
                    .with({ status: "Loading" }, () => (
                      <div className="flex justify-center items-center my-8">
                        <RainbowSpinner />
                      </div>
                    ))
                    .with({ status: "Selected" }, ({ personId }) => {
                      const renderRow = (skill: (typeof sessionSkills)[number]) => (
                        <SkillTrack_AssessmentRow
                          key={skill.id}
                          title={skill.name}
                          description={
                            showSkillDescription
                              ? assessableSkillById.get(skill.id)?.description || undefined
                              : undefined
                          }
                          value={getCurrentValue(personId, skill.id)}
                          onValueChange={(newValue) => handleChange(skill.id, newValue)}
                        />
                      );

                      return match(skillOrder)
                        .with("alphabetical", () => <>{sessionSkills.map(renderRow)}</>)
                        .with("by-package-group", () => (
                          <div className="space-y-6">
                            {packageSections.map(({ skillPackage, groups }) => (
                              <div key={skillPackage.id} className="space-y-6">
                                <div className="font-semibold border-b pb-1">
                                  {skillPackage.name}
                                </div>
                                {groups.map(({ skillGroup, skills }) => (
                                  <div key={skillGroup.id}>
                                    <div className="text-sm font-medium text-muted-foreground mb-2">
                                      {skillGroup.name}
                                    </div>
                                    <div className="flex flex-col gap-5">
                                      {skills.map(renderRow)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {ungroupedSkills.length > 0 && (
                              <div className="space-y-6">
                                <div className="font-semibold border-b pb-1">Other</div>
                                <div className="flex flex-col gap-5">
                                  {ungroupedSkills.map(renderRow)}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                        .exhaustive();
                    })
                    .exhaustive()}
                </div>
              </div>
            </Show>
          </Show>
        </Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the full contents of
`src/app/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/by-person/page.tsx`:

```tsx
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/by-person
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SessionByPerson_Content } from "@/components/skill-track/session-by-person-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/by-person">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);
  const session = await fetchQuery(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );

  return { title: `${session.name || session.id} ${TITLE_SEPARATOR} By Person` };
}

export default async function SkillTrack_SessionByPerson_Page(props: Props) {
  const { slug, session_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const skillCheckSessionId = SkillCheckSessionId.schema.parse(session_id);

  prefetch(
    trpc.skills.getSession.queryOptions({
      organizationId: organization.id,
      skillCheckSessionId,
    }),
  );
  prefetch(
    trpc.personnel.getPersonSelf.queryOptions({
      organizationId: organization.id,
    }),
  );
  prefetch(
    trpc.skills.listAssessableSkills.queryOptions({
      organizationId: organization.id,
    }),
  );
  prefetch(
    trpc.skillChecks.listSkillChecks.queryOptions({
      organizationId: organization.id,
      sessionId: skillCheckSessionId,
      ownChecksOnly: true,
    }),
  );

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <SkillTrack_SessionByPerson_Content sessionId={skillCheckSessionId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 4: Manual smoke check**

With the dev server running, visit the by-person page from the session
detail page and confirm no loading flash for the roster; visit directly by
URL and confirm a graceful client fetch instead.

- [ ] **Step 5: Full-suite check**

Run: `npm run test:run && npx tsc --noEmit && npm run lint`
Expected: all green — this is the last task in the migration.

- [ ] **Step 6: Commit**

```bash
git add src/app/"(authenticated)"/orgs/"[slug]"/skill-track/sessions/"[session_id]"/by-person/page.tsx \
        src/components/skill-track/session-by-person-content.tsx
git commit -m "Move session by-person page to the standard detail-page pattern"
```

---

## Self-Review Notes

- **Spec coverage:** Router change (Task 1), catalogue detail (Task 2),
  person competency report (Task 3), session detail (Task 4), and all six
  session sub-pages (Tasks 5–10) are each covered by a task. The redundant-
  prefetch table from the spec is reflected in each task's prefetch/skip
  list.
- **Placeholder scan:** No TBD/TODO; every step has literal file content or
  an exact command.
- **Type consistency:** All content components take `{ sessionId:
SkillCheckSessionId }` (or `{ skillPackageId: SkillPackageId }` /
  `{ personId: PersonId }`) — consistent prop name and type across every
  `page.tsx` → content component boundary. `getPackage`'s output shape
  (Task 1) matches exactly what `catalogue-package-content.tsx` (Task 2) and
  the `subscribe`/`unsubscribe` dialogs' `setQueryData` calls expect.
