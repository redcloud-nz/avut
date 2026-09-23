/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
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

    it("refuses to demote the last owner", async () => {
        await expect(
            call().setOrganizationMemberRole({
                organizationId: T.org,
                userId: T.owner,
                roles: ["member"],
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

    const storedRole = async (userId: string) =>
        (await db.organizationUser.findFirst({ where: { organizationId: T.org, userId } }))?.role;

    it("adds a member with a primary role and secondary roles, primary first", async () => {
        await call().addOrganizationMember({
            organizationId: T.org,
            userId: T.other,
            roles: ["skills-assessor", "admin", "i3-editor"],
        });

        expect(await storedRole(T.other)).toBe("admin,skills-assessor,i3-editor");
    });

    it("replaces a member's whole role set", async () => {
        const res = await call().setOrganizationMemberRole({
            organizationId: T.org,
            userId: T.owner,
            roles: ["owner", "skills-assessor"],
        });

        expect(res.roles).toEqual(["owner", "skills-assessor"]);
        expect(await storedRole(T.owner)).toBe("owner,skills-assessor");
    });

    it.each([
        ["no primary role", ["i3-editor"]],
        ["two primary roles", ["admin", "member"]],
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

    it("still treats an owner with secondary roles as the last owner when removing them", async () => {
        await expect(
            call().removeOrganizationMember({ organizationId: T.org, userId: T.owner }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("refuses to drop the owner role from the last owner even if other roles are kept", async () => {
        await expect(
            call().setOrganizationMemberRole({
                organizationId: T.org,
                userId: T.owner,
                roles: ["member", "i3-editor"],
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(await storedRole(T.owner)).toBe("owner,i3-editor");
    });

    it("lets the last owner change secondary roles while keeping owner", async () => {
        await call().setOrganizationMemberRole({
            organizationId: T.org,
            userId: T.owner,
            roles: ["owner"],
        });
        expect(await storedRole(T.owner)).toBe("owner");
    });

    it("allows dropping owner when another owner remains", async () => {
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.other,
                role: "owner,skills-assessor",
                createdAt: new Date(),
            },
        });

        await call().setOrganizationMemberRole({
            organizationId: T.org,
            userId: T.owner,
            roles: ["admin"],
        });
        expect(await storedRole(T.owner)).toBe("admin");
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
});
