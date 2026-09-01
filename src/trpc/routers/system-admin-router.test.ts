/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, it, expect, vi } from "vitest";

import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";

// `revalidateTag` needs a Next.js render/request store, which the test environment has no
// business standing up — the router's contract here is just that it invalidates the tag.
vi.mock("@/server/organization-settings-cache", () => ({
    organizationSettingsCacheTag: (id: string) => `organization-settings-${id}`,
    revalidateOrganizationSettings: vi.fn(async () => {}),
}));

import { systemAdminRouter } from "./system-admin-router";

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
        expect(user.organizations).toEqual([
            { id: T.org, name: "Org", slug: "org", role: "member" },
        ]);
    });

    it("getUser throws NOT_FOUND for an unknown id", async () => {
        await expect(call().getUser({ userId: UserId.create() })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });
});

describe("systemAdmin.getOrganization", () => {
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
        await db.d4hAccessToken.create({
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
        systemAdminRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("returns aggregated organization data", async () => {
        const org = await call().getOrganization({ organizationId: T.org });

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
            call().getOrganization({ organizationId: OrganizationId.create() }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("systemAdmin.createOrganization", () => {
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
        systemAdminRouter.createCaller(
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
});

describe("systemAdmin organization members", () => {
    const T = {
        admin: UserId.create(),
        owner: UserId.create(),
        u1: UserId.create(),
        u2: UserId.create(),
        org: OrganizationId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
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
        systemAdminRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("adds an existing user as a member", async () => {
        await call().addOrganizationMember({
            organizationId: T.org,
            userId: T.u2,
            role: "member",
        });
        expect(
            await db.organizationUser.findFirst({
                where: { organizationId: T.org, userId: T.u2 },
            }),
        ).toMatchObject({ role: "member" });
    });

    it("rejects adding a user who is already a member", async () => {
        await expect(
            call().addOrganizationMember({ organizationId: T.org, userId: T.u1, role: "member" }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("throws NOT_FOUND for an unknown organization or user", async () => {
        await expect(
            call().addOrganizationMember({
                organizationId: OrganizationId.create(),
                userId: T.u2,
                role: "member",
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(
            call().addOrganizationMember({
                organizationId: T.org,
                userId: UserId.create(),
                role: "member",
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
                role: "member",
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
            userId: T.u2,
            role: "admin",
        });
        expect(res.role).toBe("admin");
    });
});

describe("systemAdmin.listOrganizations", () => {
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
        systemAdminRouter.createCaller(
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

describe("systemAdmin organization settings", () => {
    const T = {
        admin: UserId.create(),
        // An organization with no `OrganizationConfig` rows at all — what the normal
        // (non-system-admin) org-creation path produces.
        bareOrg: OrganizationId.create(),
        // An organization whose default config rows have been fully materialised — what
        // `systemAdmin.createOrganization` produces.
        seededOrg: OrganizationId.create(),
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
            data: { id: T.bareOrg, name: "Bare", slug: "bare", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.seededOrg, name: "Seeded", slug: "seeded", createdAt: new Date() },
        });

        for (const [key, value] of Object.entries(
            OrganizationSettings.flatten(OrganizationSettings.default()),
        )) {
            await db.organizationConfig.create({
                data: { organizationId: T.seededOrg, key, value },
            });
        }
    });

    // The admin is deliberately NOT a member of either organization.
    const call = () =>
        systemAdminRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("getOrganizationSettings resolves defaults for a config-less organization", async () => {
        const settings = await call().getOrganizationSettings({ organizationId: T.bareOrg });
        expect(settings).toEqual(OrganizationSettings.default());
    });

    it("getOrganizationSettings resolves a fully materialised organization identically", async () => {
        const settings = await call().getOrganizationSettings({ organizationId: T.seededOrg });
        expect(settings).toEqual(OrganizationSettings.default());
    });

    it("enables a module for an org the admin does not belong to", async () => {
        const next = OrganizationSettings.default();
        next.modules.notes.enabled = true;

        const result = await call().updateOrganizationSettings({
            organizationId: T.bareOrg,
            settings: next,
        });

        expect(result.modules.notes.enabled).toBe(true);

        // Persisted, and only the changed leaf was materialised.
        const rows = await db.organizationConfig.findMany({
            where: { organizationId: T.bareOrg },
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ key: "modules.notes.enabled", value: true });

        const reread = await call().getOrganizationSettings({ organizationId: T.bareOrg });
        expect(reread.modules.notes.enabled).toBe(true);
    });

    it("updates an existing config row on a fully materialised organization", async () => {
        const next = OrganizationSettings.default();
        next.modules.i3.enabled = true;
        next.modules.i3.storage = "AVUT";

        const result = await call().updateOrganizationSettings({
            organizationId: T.seededOrg,
            settings: next,
        });

        expect(result.modules.i3).toEqual({ enabled: true, storage: "AVUT" });

        const row = await db.organizationConfig.findFirst({
            where: { organizationId: T.seededOrg, key: "modules.i3.storage" },
        });
        expect(row?.value).toBe("AVUT");
    });

    it("writes an audit entry against the organization", async () => {
        const next = OrganizationSettings.default();
        next.modules["skill-track"].enabled = true;

        await call().updateOrganizationSettings({
            organizationId: T.seededOrg,
            settings: next,
        });

        const entries = await db.organizationLogEntry.findMany({
            where: { organizationId: T.seededOrg, objectType: "OrganizationSettings" },
        });
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.at(-1)).toMatchObject({
            action: "Update",
            objectType: "OrganizationSettings",
            objectId: T.seededOrg,
            userId: T.admin,
        });
    });

    it("rejects settings that fail schema validation", async () => {
        const next = OrganizationSettings.default();

        await expect(
            call().updateOrganizationSettings({
                organizationId: T.bareOrg,
                settings: {
                    ...next,
                    modules: {
                        ...next.modules,
                        notes: { enabled: 7 as unknown as boolean },
                    },
                },
            }),
        ).rejects.toBeTruthy();
    });

    it("rejects a non-admin", async () => {
        const caller = systemAdminRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: UserId.create(), role: "user" },
                prisma: db,
            }),
        );
        await expect(
            caller.getOrganizationSettings({ organizationId: T.bareOrg }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});

describe("systemAdmin.deleteUser", () => {
    const T = {
        admin: UserId.create(),
        plain: UserId.create(),
        soleOwner: UserId.create(),
        coOwnerA: UserId.create(),
        coOwnerB: UserId.create(),
        soleOwnedOrg: OrganizationId.create(),
        coOwnedOrg: OrganizationId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const [id, role] of [
            [T.admin, "admin"],
            [T.plain, null],
            [T.soleOwner, null],
            [T.coOwnerA, null],
            [T.coOwnerB, null],
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
            data: { id: T.soleOwnedOrg, name: "Sole Co", slug: "sole-co", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.coOwnedOrg, name: "Co Co", slug: "co-co", createdAt: new Date() },
        });
        for (const [organizationId, userId, role] of [
            [T.soleOwnedOrg, T.soleOwner, "owner"],
            [T.soleOwnedOrg, T.plain, "member"],
            [T.coOwnedOrg, T.coOwnerA, "owner"],
            [T.coOwnedOrg, T.coOwnerB, "owner"],
        ] as const) {
            await db.organizationUser.create({
                data: { id: nanoId16(), organizationId, userId, role, createdAt: new Date() },
            });
        }
    });

    const call = () =>
        systemAdminRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("deletes a user and their memberships", async () => {
        const res = await call().deleteUser({ userId: T.plain });
        expect(res).toEqual({ id: T.plain });
        expect(await db.user.findUnique({ where: { id: T.plain } })).toBeNull();
        expect(await db.organizationUser.count({ where: { userId: T.plain } })).toBe(0);
    });

    it("deletes an org owner when another owner remains", async () => {
        await call().deleteUser({ userId: T.coOwnerA });
        expect(await db.user.findUnique({ where: { id: T.coOwnerA } })).toBeNull();
        expect(
            await db.organizationUser.count({
                where: { organizationId: T.coOwnedOrg, role: "owner" },
            }),
        ).toBe(1);
    });

    it("refuses to delete a sole organization owner", async () => {
        await expect(call().deleteUser({ userId: T.soleOwner })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
        expect(await db.user.findUnique({ where: { id: T.soleOwner } })).not.toBeNull();
    });

    it("refuses to delete yourself", async () => {
        await expect(call().deleteUser({ userId: T.admin })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });

    it("throws NOT_FOUND for an unknown user", async () => {
        await expect(call().deleteUser({ userId: UserId.create() })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });
});

describe("systemAdmin.setUserRole", () => {
    const T = {
        adminA: UserId.create(),
        adminB: UserId.create(),
        plain: UserId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const [id, role] of [
            [T.adminA, "admin"],
            [T.adminB, "admin"],
            [T.plain, null],
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
    });

    const call = () =>
        systemAdminRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.adminA, role: "admin" }, prisma: db }),
        );

    it("promotes a user to admin", async () => {
        const { role } = await call().setUserRole({ userId: T.plain, role: "admin" });
        expect(role).toBe("admin");
        expect((await db.user.findUnique({ where: { id: T.plain } }))?.role).toBe("admin");
    });

    it("refuses to change your own role", async () => {
        await expect(call().setUserRole({ userId: T.adminA, role: "user" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });

    it("demotes an admin while another admin remains", async () => {
        const { role } = await call().setUserRole({ userId: T.adminB, role: "user" });
        expect(role).toBe("user");
    });

    it("throws NOT_FOUND for an unknown user", async () => {
        await expect(
            call().setUserRole({ userId: UserId.create(), role: "admin" }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("systemAdmin.setUserRole last-admin guard", () => {
    const soloAdmin = UserId.create();
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.user.create({
            data: {
                id: soloAdmin,
                name: "Solo",
                email: "solo-role@x.test",
                emailVerified: true,
                role: "admin",
                createdAt: new Date(),
            },
        });
    });

    it("refuses to demote the last system administrator", async () => {
        const caller = systemAdminRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: UserId.create(), role: "admin" },
                prisma: db,
            }),
        );
        await expect(caller.setUserRole({ userId: soloAdmin, role: "user" })).rejects.toMatchObject(
            { code: "BAD_REQUEST" },
        );
    });
});

describe("systemAdmin.deleteUser last-admin guard", () => {
    const soloAdmin = UserId.create();
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.user.create({
            data: {
                id: soloAdmin,
                name: "Solo",
                email: "solo@x.test",
                emailVerified: true,
                role: "admin",
                createdAt: new Date(),
            },
        });
    });

    it("refuses to delete the last system administrator", async () => {
        const caller = systemAdminRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: UserId.create(), role: "admin" },
                prisma: db,
            }),
        );
        await expect(caller.deleteUser({ userId: soloAdmin })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });
});
