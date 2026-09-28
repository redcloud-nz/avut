/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { organizationsRouter } from "./organizations-router";

// `revalidateTag` needs a Next.js render/request store, which the test environment has no
// business standing up — the router's contract here is just that it invalidates the tag.
vi.mock("@/server/cache/organization-user-revalidate", () => ({
    organizationUserCacheTag: (id: string) => `organization-user-${id}`,
    revalidateOrganizationUser: vi.fn(async () => {}),
}));

describe("organizations member management — permission gate", () => {
    // Dataset: an org with an owner (full member permissions) and a plain member (view only),
    // plus a system admin with no membership of their own.
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        member: UserId.create(),
        other: UserId.create(),
        org: OrganizationId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.admin, T.owner, T.member, T.other]) {
            await db.user.create({
                data: { id, name: `U-${id}`, email: `${id}@x.test`, emailVerified: true },
            });
        }
        await db.organization.create({
            data: { id: T.org, name: "Org", slug: "gate-org", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.owner, role: "owner" },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.member, role: "member" },
        });
    });

    it("lets a system admin with no membership of their own through", async () => {
        const caller = organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

        await expect(
            caller.addOrganizationMember({
                organizationId: T.org,
                userId: T.other,
                roles: ["member"],
            }),
        ).resolves.toMatchObject({ id: expect.any(String) });
    });

    it("lets a member holding the required permission through", async () => {
        const caller = organizationsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.owner },
                permissions: { organization: ["view"], member: ["update"] },
                prisma: db,
            }),
        );

        const res = await caller.setOrganizationMemberRole({
            organizationId: T.org,
            userId: T.member,
            roles: ["member", "i3-editor"],
        });
        expect(res.roles).toEqual(["member", "i3-editor"]);
    });

    it("refuses a member lacking the required permission", async () => {
        const caller = organizationsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.member },
                permissions: { organization: ["view"], member: ["view"] },
                prisma: db,
            }),
        );

        await expect(
            caller.removeOrganizationMember({ organizationId: T.org, userId: T.owner }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("refuses a caller who is neither a member nor a system admin", async () => {
        const caller = organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.other }, prisma: db }),
        );

        await expect(
            caller.removeOrganizationMember({ organizationId: T.org, userId: T.owner }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("gives a system admin a clean NOT_FOUND for a nonexistent organization, not a raw insert failure", async () => {
        // A non-admin gets this for free — `hasPermission` finds no membership of a nonexistent
        // org and refuses before anything else runs. The `allowSystemAdmin` bypass skips that
        // lookup, so `organizationProcedure` has to re-assert existence itself; without it this
        // would fall through to the create and fail as an unrelated FK violation.
        const caller = organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

        await expect(
            caller.addOrganizationMember({
                organizationId: OrganizationId.create(),
                userId: T.other,
                roles: ["member"],
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("organizations member management (system admin)", () => {
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        u1: UserId.create(),
        u2: UserId.create(),
        org: OrganizationId.create(),
    };
    let db: ReturnType<typeof createMockPrisma>;

    // Every case here adds, removes or re-roles a member, so each one gets a fresh dataset
    // rather than depending on what the cases before it left behind.
    beforeEach(async () => {
        db = createMockPrisma();

        for (const id of [T.admin, T.owner, T.u1, T.u2]) {
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
            data: { id: T.org, name: "Org", slug: "members-org", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.owner,
                role: "owner",
                createdAt: new Date(),
            },
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
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("adds an existing user as a member", async () => {
        await call().addOrganizationMember({
            organizationId: T.org,
            userId: T.u2,
            roles: ["member"],
        });
        expect(
            await db.organizationUser.findFirst({
                where: { organizationId: T.org, userId: T.u2 },
            }),
        ).toMatchObject({ role: "member" });
    });

    it("rejects adding a user who is already a member", async () => {
        await expect(
            call().addOrganizationMember({
                organizationId: T.org,
                userId: T.u1,
                roles: ["member"],
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("throws NOT_FOUND for an unknown user", async () => {
        await expect(
            call().addOrganizationMember({
                organizationId: T.org,
                userId: UserId.create(),
                roles: ["member"],
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("refuses to remove the last owner", async () => {
        await expect(
            call().removeOrganizationMember({ organizationId: T.org, userId: T.owner }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("changing the last owner's non-owner roles never demotes them — ownership is separate now", async () => {
        const res = await call().setOrganizationMemberRole({
            organizationId: T.org,
            userId: T.owner,
            roles: ["member"],
        });
        expect(res.roles).toEqual(["member"]);
        expect(
            await db.organizationUser.findFirst({
                where: { organizationId: T.org, userId: T.owner },
            }),
        ).toMatchObject({ role: "owner,member" });
    });

    it("removes a non-owner member", async () => {
        await call().removeOrganizationMember({ organizationId: T.org, userId: T.u1 });
        expect(
            await db.organizationUser.findFirst({
                where: { organizationId: T.org, userId: T.u1 },
            }),
        ).toBeNull();
    });

    it("changes a member's role", async () => {
        const res = await call().setOrganizationMemberRole({
            organizationId: T.org,
            userId: T.u1,
            roles: ["member", "i3-editor"],
        });
        expect(res.roles).toEqual(["member", "i3-editor"]);
    });

    it("turns a concurrent duplicate add into CONFLICT", async () => {
        // The pre-check passes (u2 is not a member yet); the insert then loses the race.
        const uniqueViolation = Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
        });
        vi.spyOn(db.organizationUser, "create").mockImplementationOnce((() =>
            Promise.reject(uniqueViolation)) as never);

        await expect(
            call().addOrganizationMember({
                organizationId: T.org,
                userId: T.u2,
                roles: ["member"],
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("does not disguise other insert failures as CONFLICT", async () => {
        vi.spyOn(db.organizationUser, "create").mockImplementationOnce((() =>
            Promise.reject(new Error("connection lost"))) as never);

        await expect(
            call().addOrganizationMember({
                organizationId: T.org,
                userId: T.u2,
                roles: ["member"],
            }),
        ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    });
});

describe("organizations multi-role memberships (system admin)", () => {
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        other: UserId.create(),
        org: OrganizationId.create(),
    };
    let db: ReturnType<typeof createMockPrisma>;

    // Each case rewrites the owner's roles or membership, so each starts from a fresh dataset.
    beforeEach(async () => {
        db = createMockPrisma();

        for (const [id, role] of [
            [T.admin, "admin"],
            [T.owner, null],
            [T.other, null],
        ] as const) {
            await db.user.create({
                data: {
                    id,
                    name: `U-${id}`,
                    email: `${id}@x.test`,
                    emailVerified: true,
                    role,
                    createdAt: new Date(),
                },
            });
        }
        await db.organization.create({
            data: { id: T.org, name: "Org", slug: "multi-role-org", createdAt: new Date() },
        });
        // The sole owner also holds a non-owner role, so the column reads "owner,i3-editor".
        // `owner` sits outside `OrganizationRole` entirely — granted/revoked only through
        // `makeOwner`/`removeOwner` — so it's seeded directly here, never through
        // `roles: [...]` on `addOrganizationMember`/`setOrganizationMemberRole`.
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.owner,
                role: "owner,i3-editor",
                createdAt: new Date(),
            },
        });
    });

    const call = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    const storedRole = async (userId: string) =>
        (await db.organizationUser.findFirst({ where: { organizationId: T.org, userId } }))?.role;

    it("adds a member with a freely-combinable role set, in submitted order", async () => {
        await call().addOrganizationMember({
            organizationId: T.org,
            userId: T.other,
            roles: ["skills-assessor", "admin", "i3-editor"],
        });

        // The primary/secondary split is gone, so `serialize` no longer reorders — a plain
        // comma-join of whatever order the caller submitted.
        expect(await storedRole(T.other)).toBe("skills-assessor,admin,i3-editor");
    });

    it("replaces a member's non-owner role set, preserving their existing owner status", async () => {
        const res = await call().setOrganizationMemberRole({
            organizationId: T.org,
            userId: T.owner,
            roles: ["skills-assessor"],
        });

        // `roles` in the response never includes `owner` — it's outside `OrganizationRole`.
        expect(res.roles).toEqual(["skills-assessor"]);
        // But the stored column keeps it, since `setOrganizationMemberRole` never touches
        // ownership — only `makeOwner`/`removeOwner` do.
        expect(await storedRole(T.owner)).toBe("owner,skills-assessor");
    });

    it.each([
        ["a repeated role", ["member", "member"]],
        ["no roles at all", []],
    ] as const)("rejects a role set with %s", async (_label, roles) => {
        await expect(
            call().addOrganizationMember({
                organizationId: T.org,
                userId: T.other,
                roles: [...roles],
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects `owner` in the assignable role set — it's granted only through makeOwner", async () => {
        await expect(
            call().addOrganizationMember({
                organizationId: T.org,
                userId: T.other,
                // @ts-expect-error -- `owner` was removed from `OrganizationRole` entirely
                roles: ["owner"],
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("still treats an owner with other roles as the last owner when removing them", async () => {
        await expect(
            call().removeOrganizationMember({ organizationId: T.org, userId: T.owner }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("admin and member can be held simultaneously — the primary/secondary split is gone", async () => {
        await call().addOrganizationMember({
            organizationId: T.org,
            userId: T.other,
            roles: ["admin", "member"],
        });
        expect(await storedRole(T.other)).toBe("admin,member");
    });
});

describe("organizations.makeOwner / removeOwner (system admin)", () => {
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        other: UserId.create(),
        org: OrganizationId.create(),
    };
    let db: ReturnType<typeof createMockPrisma>;

    beforeEach(async () => {
        db = createMockPrisma();

        for (const id of [T.admin, T.owner, T.other]) {
            await db.user.create({
                data: { id, name: `U-${id}`, email: `${id}@x.test`, emailVerified: true },
            });
        }
        await db.organization.create({
            data: { id: T.org, name: "Org", slug: "owner-transfer-org", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.owner, role: "owner" },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.other, role: "member" },
        });
    });

    const storedRole = async (userId: string) =>
        (await db.organizationUser.findFirst({ where: { organizationId: T.org, userId } }))?.role;

    const callAsSystemAdmin = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    const callAsOwner = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.owner },
                permissions: { organization: ["view"], member: ["owner"] },
                prisma: db,
            }),
        );

    const callAsMember = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.other },
                permissions: { organization: ["view"], member: ["view"] },
                prisma: db,
            }),
        );

    // `makeOwner`/`removeOwner` have no `allowSystemAdmin` bypass (org-admin Users page only,
    // per the plan) — a caller needs `member: ["owner"]` on this org specifically. `T.other`
    // isn't a DB owner, but the permission override is enough to exercise the mutation's own
    // guards (last-owner, self-removal) against someone other than the target.
    const callAsOtherWithOwnerPermission = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.other },
                permissions: { organization: ["view"], member: ["owner"] },
                prisma: db,
            }),
        );

    it("grants ownership in addition to a member's existing roles", async () => {
        await callAsOwner().makeOwner({ organizationId: T.org, userId: T.other });
        expect(await storedRole(T.other)).toBe("owner,member");
    });

    it("is a no-op when the target is already an owner", async () => {
        await callAsOwner().makeOwner({ organizationId: T.org, userId: T.owner });
        expect(await storedRole(T.owner)).toBe("owner");
    });

    it("strips ownership from a member while keeping their other roles", async () => {
        await db.organizationUser.update({
            where: {
                organizationId_userId: { organizationId: T.org, userId: T.other },
            },
            data: { role: "owner,i3-editor" },
        });

        await callAsOwner().removeOwner({ organizationId: T.org, userId: T.other });
        expect(await storedRole(T.other)).toBe("i3-editor");
    });

    it("refuses to remove ownership from the last owner", async () => {
        await expect(
            callAsOtherWithOwnerPermission().removeOwner({
                organizationId: T.org,
                userId: T.owner,
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(await storedRole(T.owner)).toBe("owner");
    });

    it("blocks an owner from removing their own ownership", async () => {
        // A second owner exists, so the last-owner guard alone wouldn't catch this.
        await db.organizationUser.update({
            where: { organizationId_userId: { organizationId: T.org, userId: T.other } },
            data: { role: "owner" },
        });

        await expect(
            callAsOwner().removeOwner({ organizationId: T.org, userId: T.owner }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(await storedRole(T.owner)).toBe("owner");
    });

    it("refuses a caller who does not hold member:owner", async () => {
        await expect(
            callAsMember().makeOwner({ organizationId: T.org, userId: T.other }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
            callAsMember().removeOwner({ organizationId: T.org, userId: T.owner }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("gives a system admin with no membership of their own no bypass here — unlike the other member mutations", async () => {
        await expect(
            callAsSystemAdmin().makeOwner({ organizationId: T.org, userId: T.other }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});

describe("organizationsRouter — audit entries", () => {
    /** A fresh database with a system-admin caller, an organization, its owner, and a plain member. */
    async function seedOrganizationWithMembers() {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();
        const adminId = UserId.create();
        const ownerId = UserId.create();
        const memberId = UserId.create();
        const membershipId = OrganizationUserId.create();

        await db.organization.create({
            data: { id: orgId, name: "Org", slug: `org-${nanoId16()}`, createdAt: new Date() },
        });
        await db.user.create({
            data: { id: adminId, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
        });
        await db.user.create({
            data: { id: ownerId, name: "Lee Owner", email: "lee@example.com" },
        });
        await db.user.create({
            data: { id: memberId, name: "Kim Park", email: "kim@example.com" },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: orgId, userId: ownerId, role: "owner" },
        });
        await db.organizationUser.create({
            data: { id: membershipId, organizationId: orgId, userId: memberId, role: "member" },
        });

        const caller = organizationsRouter.createCaller(
            createAuthenticatedMockContext({
                user: {
                    id: adminId,
                    name: "Dana Okafor",
                    email: "dana@example.com",
                    role: "admin",
                },
                prisma: db,
            }),
        );

        return { db, caller, orgId, adminId, memberId, membershipId };
    }

    it("records an organization-scoped entry when adding a member", async () => {
        const { db, caller, orgId, adminId } = await seedOrganizationWithMembers();
        const newMemberId = UserId.create();
        await db.user.create({
            data: { id: newMemberId, name: "Sam New", email: "sam@example.com" },
        });

        await caller.addOrganizationMember({
            organizationId: orgId,
            userId: newMemberId,
            roles: ["member"],
        });

        const entries = await db.logEntry.findMany({
            where: { objectType: "OrganizationMembership", action: "Create" },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: orgId,
            ownerId: null,
            userId: adminId,
            action: "Create",
        });
        expect(entries[0].actorLabel).toBe("Dana Okafor <dana@example.com>");
    });

    it("records an organization-scoped entry when removing a member", async () => {
        const { db, caller, orgId, adminId, memberId, membershipId } =
            await seedOrganizationWithMembers();

        await caller.removeOrganizationMember({ organizationId: orgId, userId: memberId });

        const entries = await db.logEntry.findMany({
            where: { objectType: "OrganizationMembership" },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: orgId,
            ownerId: null,
            userId: adminId,
            action: "Delete",
            objectId: membershipId,
        });
    });

    it("records an organization-scoped entry when changing a member's role", async () => {
        const { db, caller, orgId, adminId, memberId, membershipId } =
            await seedOrganizationWithMembers();

        await caller.setOrganizationMemberRole({
            organizationId: orgId,
            userId: memberId,
            roles: ["admin"],
        });

        const entries = await db.logEntry.findMany({
            where: { objectType: "OrganizationMembership" },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: orgId,
            ownerId: null,
            userId: adminId,
            action: "Update",
            objectId: membershipId,
        });
        expect(entries[0].description).toContain("from member to admin");
    });

    it("records an organization-scoped entry when creating an organization", async () => {
        const { db, caller, adminId } = await seedOrganizationWithMembers();

        const { id } = await caller.createOrganization({
            name: "New Co",
            slug: "new-co",
            addSelfAsOwner: false,
        });

        const entries = await db.logEntry.findMany({ where: { objectType: "Organization" } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: id,
            ownerId: null,
            userId: adminId,
            action: "Create",
            objectId: id,
        });
    });
});

describe("organizations.getOrganizationAsAdmin", () => {
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        member: UserId.create(),
        org: OrganizationId.create(),
        team: TeamId.create(),
        person: PersonId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.admin, T.owner, T.member]) {
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
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.owner,
                role: "owner",
                createdAt: new Date(),
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.member,
                role: "member",
                createdAt: new Date(),
            },
        });
        await db.organizationConfig.create({
            data: { organizationId: T.org, key: "modules.notes.enabled", value: true },
        });
        await db.team.create({
            data: { id: T.team, name: "Alpha", organizationId: T.org, createdAt: new Date() },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Person One",
                email: "p1@x.test",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        await db.teamMembership.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                teamId: T.team,
                personId: T.person,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        await db.d4HAccessToken.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                label: "Token",
                token: "secret",
                serverCode: "us",
                status: "active",
                expiresAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        await db.note.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                authorId: T.owner,
                content: "hi",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    });

    const call = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("returns aggregated organization data", async () => {
        const org = await call().getOrganizationAsAdmin({ organizationId: T.org });

        expect(org).toMatchObject({ id: T.org, name: "Acme", slug: "acme" });
        expect(org.members).toHaveLength(2);
        expect(org.members.find((m) => m.userId === T.owner)?.role).toBe("owner");
        expect(org.teams).toEqual([{ id: T.team, name: "Alpha", memberCount: 1 }]);
        expect(org.enabledModules).toContain("notes");
        expect(org.d4hTokenCount).toBe(1);
        expect(org.recordCounts.notes).toBe(1);
        expect(org.recordCounts.personnel).toBe(1);
    });

    it("throws NOT_FOUND for an unknown id", async () => {
        await expect(
            call().getOrganizationAsAdmin({ organizationId: OrganizationId.create() }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("organizations.createOrganization", () => {
    const T = {
        admin: UserId.create(),
        existingOrg: OrganizationId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.user.create({
            data: {
                id: T.admin,
                name: "Admin",
                email: "admin@x.test",
                emailVerified: true,
                createdAt: new Date(),
            },
        });
        await db.organization.create({
            data: { id: T.existingOrg, name: "Existing", slug: "org", createdAt: new Date() },
        });
    });

    const call = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("creates an org with default config and no membership by default", async () => {
        const { id, slug } = await call().createOrganization({
            name: "New Co",
            slug: "new-co",
            addSelfAsOwner: false,
        });
        expect(slug).toBe("new-co");
        expect(await db.organizationUser.count({ where: { organizationId: id } })).toBe(0);
        expect(
            await db.organizationConfig.count({ where: { organizationId: id } }),
        ).toBeGreaterThan(0);
    });

    it("adds the actor as owner when addSelfAsOwner is true", async () => {
        const { id } = await call().createOrganization({
            name: "Mine",
            slug: "mine",
            addSelfAsOwner: true,
        });
        expect(
            await db.organizationUser.findFirst({
                where: { organizationId: id, userId: T.admin },
            }),
        ).toMatchObject({ role: "owner" });
    });

    it("rejects a duplicate slug", async () => {
        await expect(
            call().createOrganization({ name: "Dup", slug: "org", addSelfAsOwner: false }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("turns a concurrent duplicate slug into CONFLICT", async () => {
        // The pre-check passes (the slug is free); the insert then loses the race.
        const uniqueViolation = Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
        });
        vi.spyOn(db.organization, "create").mockImplementationOnce((() =>
            Promise.reject(uniqueViolation)) as never);

        await expect(
            call().createOrganization({ name: "Race", slug: "race-co", addSelfAsOwner: false }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });
});

describe("organizations.listOrganizations counts owners with other roles", () => {
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        other: UserId.create(),
        org: OrganizationId.create(),
    };
    let db: ReturnType<typeof createMockPrisma>;

    beforeEach(async () => {
        db = createMockPrisma();

        for (const [id, role] of [
            [T.admin, "admin"],
            [T.owner, null],
            [T.other, null],
        ] as const) {
            await db.user.create({
                data: {
                    id,
                    name: `U-${id}`,
                    email: `${id}@x.test`,
                    emailVerified: true,
                    role,
                    createdAt: new Date(),
                },
            });
        }
        await db.organization.create({
            data: { id: T.org, name: "Org", slug: "multi-role-org", createdAt: new Date() },
        });
        // The sole owner also holds a secondary role, so the column reads "owner,i3-editor".
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.owner,
                role: "owner,i3-editor",
                createdAt: new Date(),
            },
        });
    });

    const call = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("counts owners with other roles in the organization list", async () => {
        const { organizations } = await call().listOrganizations();
        expect(organizations.find((o) => o.id === T.org)?.ownerCount).toBe(1);
    });
});

describe("organizations.listOrganizations", () => {
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        member: UserId.create(),
        org: OrganizationId.create(),
        emptyOrg: OrganizationId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.admin, T.owner, T.member]) {
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
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.emptyOrg, name: "Empty", slug: "empty", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.owner,
                role: "owner",
                createdAt: new Date(),
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.member,
                role: "member",
                createdAt: new Date(),
            },
        });
        await db.organizationConfig.create({
            data: { organizationId: T.org, key: "modules.notes.enabled", value: true },
        });
    });

    const call = () =>
        organizationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("lists every organization with member count, owner count, enabled modules", async () => {
        const { organizations } = await call().listOrganizations();
        expect(organizations).toHaveLength(2);

        const org = organizations.find((o) => o.id === T.org)!;
        expect(org.memberCount).toBe(2);
        expect(org.ownerCount).toBe(1);
        expect(org.enabledModules).toContain("notes");

        const empty = organizations.find((o) => o.id === T.emptyOrg)!;
        expect(empty.memberCount).toBe(0);
        expect(empty.ownerCount).toBe(0);
        expect(empty.enabledModules).toEqual([]);
    });
});
