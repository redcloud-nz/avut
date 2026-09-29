/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { UserSessionId } from "@/lib/schemas/user-session";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { personnelRouter } from "./personnel-router";
import { usersRouter } from "./users-router";

// The routers under test reach server-only modules at import time. The procedures
// exercised here use ctx.prisma (the injected mock), so an empty stub is enough to let
// them import in jsdom.
vi.mock("server-only", () => ({}));

// `revalidateTag` needs a Next.js render/request store, which the test environment has no
// business standing up — the router's contract here is just that it invalidates the tag.
vi.mock("@/server/cache/organization-user-revalidate", () => ({
    organizationUserCacheTag: (id: string) => `organization-user-${id}`,
    revalidateOrganizationUser: vi.fn(async () => {}),
}));

// `revokeSession`/`banUser`/`unbanUser` delegate to Better Auth so its session cache is
// invalidated properly. The tests assert on that delegation rather than standing up a real
// auth instance.
const revokeSessionMock = vi.fn();
const banUserMock = vi.fn().mockResolvedValue({});
const unbanUserMock = vi.fn().mockResolvedValue({});
vi.mock("@/server/auth", () => ({
    auth: {
        api: {
            revokeSession: (...args: unknown[]) => revokeSessionMock(...args),
            banUser: (...args: unknown[]) => banUserMock(...args),
            unbanUser: (...args: unknown[]) => unbanUserMock(...args),
        },
    },
}));

describe("user↔person linking", () => {
    // Dataset:
    //   user1 → org member, initially unlinked
    //   user2 → org member, already linked to person2
    //   person1 Alice (Active, unlinked)
    //   person2 Bob   (Active, linked to user2)
    //   person3 Charlie (Archived, unlinked)
    const T = {
        org: OrganizationId.create(),
        user1: UserId.create(),
        user2: UserId.create(),
        orgUser1: nanoId16(),
        orgUser2: nanoId16(),
        person1: PersonId.create(),
        person2: PersonId.create(),
        person3: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        await db.person.create({
            data: {
                id: T.person1,
                organizationId: T.org,
                name: "Alice Anderson",
                email: `${T.person1}@example.com`,
                status: "Active",
                tags: [],
                properties: {},
            },
        });
        await db.person.create({
            data: {
                id: T.person2,
                organizationId: T.org,
                name: "Bob Baker",
                email: `${T.person2}@example.com`,
                status: "Active",
                tags: [],
                properties: {},
            },
        });
        await db.person.create({
            data: {
                id: T.person3,
                organizationId: T.org,
                name: "Charlie Clark",
                email: `${T.person3}@example.com`,
                status: "Archived",
                tags: [],
                properties: {},
            },
        });

        // The membership's user must exist: the link paths now filter on `user.status`.
        for (const id of [T.user1, T.user2]) {
            await db.user.create({ data: { id, name: id, email: `${id}@example.com` } });
        }
        await db.organizationUser.create({
            data: { id: T.orgUser1, organizationId: T.org, userId: T.user1, role: "member" },
        });
        await db.organizationUser.create({
            data: {
                id: T.orgUser2,
                organizationId: T.org,
                userId: T.user2,
                role: "member",
                personId: T.person2,
            },
        });
    });

    function makeContext() {
        return createAuthenticatedMockContext({
            user: { id: T.user1 },
            permissions: {
                organization: ["view"],
                member: ["view", "update"],
                person: ["view", "update"],
            },
            prisma: db,
        });
    }

    const users = () => usersRouter.createCaller(makeContext());
    const personnel = () => personnelRouter.createCaller(makeContext());

    it("links a person to a user and reflects it in getLinkedPerson", async () => {
        expect(
            await users().getLinkedPerson({ organizationId: T.org, userId: T.user1 }),
        ).toBeNull();

        await users().linkPerson({ organizationId: T.org, userId: T.user1, personId: T.person1 });

        const linked = await users().getLinkedPerson({ organizationId: T.org, userId: T.user1 });
        expect(linked?.id).toBe(T.person1);
    });

    it("no longer lists a linked person in personnel.listUnlinkedPersonnel", async () => {
        const unlinked = await personnel().listUnlinkedPersonnel({ organizationId: T.org });
        const ids = unlinked.map((p) => p.id);

        // person1 now linked (to user1), person2 linked (to user2), person3 archived
        expect(ids).not.toContain(T.person1);
        expect(ids).not.toContain(T.person2);
        expect(ids).not.toContain(T.person3);
    });

    it("returns every link from listPersonLinks", async () => {
        const links = await users().listPersonLinks({ organizationId: T.org });

        expect(links).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    userId: T.user1,
                    person: expect.objectContaining({ id: T.person1 }),
                }),
                expect.objectContaining({
                    userId: T.user2,
                    person: expect.objectContaining({ id: T.person2 }),
                }),
            ]),
        );
        expect(links).toHaveLength(2);
    });

    it("rejects linking a person already linked to another user", async () => {
        await expect(
            users().linkPerson({ organizationId: T.org, userId: T.user1, personId: T.person2 }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("unlinks a person and returns null from getLinkedPerson", async () => {
        const { personId } = await users().unlinkPerson({
            organizationId: T.org,
            userId: T.user1,
        });
        expect(personId).toBe(T.person1);

        expect(
            await users().getLinkedPerson({ organizationId: T.org, userId: T.user1 }),
        ).toBeNull();

        // person1 is now available to link again
        const unlinked = await personnel().listUnlinkedPersonnel({ organizationId: T.org });
        expect(unlinked.map((p) => p.id)).toContain(T.person1);
    });

    it("rejects linking a user already linked to another person", async () => {
        // The mirror of "rejects linking a person already linked to another user", and it has to
        // run after the unlink above: while person1 is still taken the *person-side* guard fires
        // first and this would pass either way. With person1 free, only the user-side guard can
        // reject it — without that guard the update silently overwrites
        // `OrganizationUser.personId`, unlinking person2 with no conflict and no audit entry.
        await expect(
            users().linkPerson({ organizationId: T.org, userId: T.user2, personId: T.person1 }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        // person2 kept its account.
        const linked = await users().getLinkedPerson({ organizationId: T.org, userId: T.user2 });
        expect(linked?.id).toBe(T.person2);
    });
});

describe("users.listUnlinkedMembers", () => {
    // Dataset:
    //   user1 → unlinked member
    //   user2 → linked to person1
    //   otherOrgUser → unlinked member of a different organization
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user1: UserId.create(),
        user2: UserId.create(),
        otherOrgUser: UserId.create(),
        person1: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other Org", slug: T.otherOrg, createdAt: new Date() },
        });

        await db.person.create({
            data: {
                id: T.person1,
                organizationId: T.org,
                name: "Alice Anderson",
                email: `${T.person1}@example.com`,
                status: "Active",
                tags: [],
                properties: {},
            },
        });

        await db.user.create({
            data: { id: T.user1, name: "User One", email: `${T.user1}@example.com` },
        });
        await db.user.create({
            data: { id: T.user2, name: "User Two", email: `${T.user2}@example.com` },
        });
        await db.user.create({
            data: {
                id: T.otherOrgUser,
                name: "Other Org User",
                email: `${T.otherOrgUser}@example.com`,
            },
        });

        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.user1, role: "member" },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.user2,
                role: "member",
                personId: T.person1,
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.otherOrg,
                userId: T.otherOrgUser,
                role: "member",
            },
        });
    });

    function makeContext(
        permissions: Permissions = {
            organization: ["view"],
            member: ["view"],
            person: ["view"],
        },
    ) {
        return createAuthenticatedMockContext({
            user: { id: T.user1 },
            permissions,
            prisma: db,
        });
    }

    it("excludes linked members and members of other organizations", async () => {
        const caller = usersRouter.createCaller(makeContext());

        const unlinked = await caller.listUnlinkedMembers({ organizationId: T.org });

        expect(unlinked.map((m) => m.userId)).toEqual([T.user1]);
    });

    it("is forbidden without member:view permission", async () => {
        const caller = usersRouter.createCaller(
            makeContext({ organization: ["view"], person: ["view"] }),
        );

        await expect(caller.listUnlinkedMembers({ organizationId: T.org })).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });
});

describe("usersRouter.revokeSession", () => {
    // Dataset:
    //   user1 → current session (sessionCurrent) + another device (sessionOther)
    //   user2 → an unrelated session, to prove cross-user access is refused
    const T = {
        user1: UserId.create(),
        user2: UserId.create(),
        sessionCurrent: UserSessionId.create(),
        sessionOther: UserSessionId.create(),
        sessionOtherUser: UserSessionId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        const base = { createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date() };

        await db.session.create({
            data: {
                ...base,
                id: T.sessionCurrent,
                token: "token-current",
                userId: T.user1,
                expiresAt: new Date("2099-01-01T00:00:00Z"),
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0",
            },
        });
        await db.session.create({
            data: {
                ...base,
                id: T.sessionOther,
                token: "token-other",
                userId: T.user1,
                expiresAt: new Date("2099-01-01T00:00:00Z"),
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1",
            },
        });
        await db.session.create({
            data: {
                ...base,
                id: T.sessionOtherUser,
                token: "token-other-user",
                userId: T.user2,
                expiresAt: new Date("2099-01-01T00:00:00Z"),
                userAgent: null,
            },
        });
    });

    function users(sessionId: string = T.sessionCurrent) {
        return usersRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user1 },
                session: { id: sessionId, token: "token-current" },
                prisma: db,
            }),
        );
    }

    it("revokes another of the user's sessions through Better Auth", async () => {
        await users().revokeSession({ sessionId: T.sessionOther });

        expect(revokeSessionMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: { token: "token-other" } }),
        );
    });

    it("refuses to revoke a session belonging to another user", async () => {
        await expect(
            users().revokeSession({ sessionId: T.sessionOtherUser }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        expect(revokeSessionMock).not.toHaveBeenCalled();
    });

    it("refuses to revoke the current session", async () => {
        await expect(users().revokeSession({ sessionId: T.sessionCurrent })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });

        expect(revokeSessionMock).not.toHaveBeenCalled();
    });
});

describe("users admin", () => {
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
        usersRouter.createCaller(
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

    it("getUser returns only the fields the admin screens use, not the whole row", async () => {
        const user = await call().getUser({ userId: T.u1 });
        expect(Object.keys(user).sort()).toEqual([
            "banned",
            "createdAt",
            "email",
            "emailVerified",
            "id",
            "name",
            "organizations",
            "role",
        ]);
    });

    it("getUser throws NOT_FOUND for an unknown id", async () => {
        await expect(call().getUser({ userId: UserId.create() })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });
});

describe("users.deleteUser refuses to orphan an organization, whatever roles are involved", () => {
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
        usersRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("refuses to delete a user who is the sole owner, whatever other roles they hold", async () => {
        await expect(call().deleteUser({ userId: T.owner })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });
});

describe("users.deleteUser", () => {
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
        usersRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("soft-deletes a user into the Rubbish bin, keeping their memberships for recovery", async () => {
        const memberships = await db.organizationUser.count({ where: { userId: T.plain } });
        const res = await call().deleteUser({ userId: T.plain });
        expect(res).toEqual({ id: T.plain });
        expect((await db.user.findUnique({ where: { id: T.plain } }))?.status).toBe("Deleted");
        expect(await db.organizationUser.count({ where: { userId: T.plain } })).toBe(memberships);

        const { users } = await call().listUsers();
        expect(users.map((u) => u.id)).not.toContain(T.plain);
        expect((await call().listDeletedUsers()).map((u) => u.id)).toContain(T.plain);
    });

    it("deletes an org owner when another owner remains", async () => {
        await call().deleteUser({ userId: T.coOwnerA });
        expect((await db.user.findUnique({ where: { id: T.coOwnerA } }))?.status).toBe("Deleted");
    });

    it("then refuses the remaining co-owner, since a deleted owner can't act for the org", async () => {
        await expect(call().deleteUser({ userId: T.coOwnerB })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });

    it("recoverUser brings a deleted user back", async () => {
        await call().recoverUser({ userId: T.plain });
        expect((await db.user.findUnique({ where: { id: T.plain } }))?.status).toBe("Active");
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

describe("users.deleteUser last-admin guard", () => {
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
        const caller = usersRouter.createCaller(
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

describe("users.setUserRole", () => {
    const T = {
        adminA: UserId.create(),
        adminB: UserId.create(),
        plain: UserId.create(),
        noop: UserId.create(),
    };
    let db: ReturnType<typeof createMockPrisma>;

    // Promoting, demoting and the session revocation that comes with it all mutate the users
    // below, so each case gets a fresh dataset instead of relying on the order they run in.
    beforeEach(async () => {
        db = createMockPrisma();

        for (const [id, role] of [
            [T.adminA, "admin"],
            [T.adminB, "admin"],
            [T.plain, null],
            [T.noop, null],
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
        // A live session for the already-plain user — a no-op "user" update must leave it.
        await db.session.create({
            data: {
                id: nanoId16(),
                userId: T.noop,
                token: nanoId16(),
                expiresAt: new Date(Date.now() + 1_000_000),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        // Two live sessions for the admin we later demote — they must be gone afterwards.
        for (let i = 0; i < 2; i++) {
            await db.session.create({
                data: {
                    id: nanoId16(),
                    userId: T.adminB,
                    token: nanoId16(),
                    expiresAt: new Date(Date.now() + 1_000_000),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        }
    });

    const call = () =>
        usersRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.adminA, role: "admin" }, prisma: db }),
        );

    it("promotes a user to admin", async () => {
        const { role } = await call().setUserRole({ userId: T.plain, role: "admin" });
        expect(role).toBe("admin");
        expect((await db.user.findUnique({ where: { id: T.plain } }))?.role).toBe("admin");
    });

    it("is a no-op when the role is unchanged and keeps sessions intact", async () => {
        const { role } = await call().setUserRole({ userId: T.noop, role: "user" });
        expect(role).toBe("user");
        expect(await db.session.count({ where: { userId: T.noop } })).toBe(1);
    });

    it("refuses to change your own role", async () => {
        await expect(call().setUserRole({ userId: T.adminA, role: "user" })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
    });

    it("demotes an admin while another admin remains and revokes their sessions", async () => {
        expect(await db.session.count({ where: { userId: T.adminB } })).toBe(2);

        const { role } = await call().setUserRole({ userId: T.adminB, role: "user" });
        expect(role).toBe("user");

        expect(await db.session.count({ where: { userId: T.adminB } })).toBe(0);
    });

    it("throws NOT_FOUND for an unknown user", async () => {
        await expect(
            call().setUserRole({ userId: UserId.create(), role: "admin" }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("users.setUserRole last-admin guard", () => {
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
        const caller = usersRouter.createCaller(
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

describe("users.banUser / unbanUser", () => {
    const T = { admin: UserId.create(), target: UserId.create() };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.user.create({
            data: {
                id: T.admin,
                name: "Dana Okafor",
                email: "dana@example.com",
                emailVerified: true,
                role: "admin",
                createdAt: new Date(),
            },
        });
        await db.user.create({
            data: {
                id: T.target,
                name: "Kim Park",
                email: "kim@example.com",
                emailVerified: true,
                role: null,
                createdAt: new Date(),
            },
        });
    });

    beforeEach(() => vi.clearAllMocks());

    const call = () =>
        usersRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("bans a user via better-auth and logs a Ban entry with the reason", async () => {
        const res = await call().banUser({ userId: T.target, banReason: "spam" });
        expect(res).toEqual({ id: T.target });

        expect(banUserMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: { userId: T.target, banReason: "spam" } }),
        );

        const entries = await db.logEntry.findMany({ where: { objectType: "User" } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "user",
            ownerId: T.target,
            organizationId: null,
            userId: T.admin,
            action: "Ban",
            objectId: T.target,
        });
        expect(entries[0].changes).toContainEqual({
            type: "obj_add",
            path: ["banReason"],
            curr: "spam",
        });
    });

    it("bans without a reason when none is given", async () => {
        await call().banUser({ userId: T.target });
        expect(banUserMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: { userId: T.target } }),
        );
    });

    it("unbans a user via better-auth and logs an Unban entry", async () => {
        const res = await call().unbanUser({ userId: T.target });
        expect(res).toEqual({ id: T.target });
        expect(unbanUserMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: { userId: T.target } }),
        );

        const entries = await db.logEntry.findMany({ where: { action: "Unban" } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "user",
            ownerId: T.target,
            action: "Unban",
            objectId: T.target,
        });
    });

    it("refuses to ban yourself", async () => {
        await expect(call().banUser({ userId: T.admin })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
        expect(banUserMock).not.toHaveBeenCalled();
    });

    it("refuses to unban yourself", async () => {
        await expect(call().unbanUser({ userId: T.admin })).rejects.toMatchObject({
            code: "BAD_REQUEST",
        });
        expect(unbanUserMock).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND for an unknown user", async () => {
        await expect(call().banUser({ userId: UserId.create() })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });
});

describe("users — audit entries", () => {
    it("records a user-scoped entry against the subject when changing a global role", async () => {
        const db = createMockPrisma();
        const adminId = UserId.create();
        const subjectId = UserId.create();

        await db.user.create({
            data: { id: adminId, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
        });
        await db.user.create({
            data: { id: subjectId, name: "Kim Park", email: "kim@example.com", role: "user" },
        });

        const caller = usersRouter.createCaller(
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

        await caller.setUserRole({ userId: subjectId, role: "admin" });

        const entries = await db.logEntry.findMany({ where: { objectType: "User" } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "user",
            ownerId: subjectId,
            organizationId: null,
            userId: adminId,
            action: "Update",
            objectId: subjectId,
        });
        expect(entries[0].changes).toContainEqual({
            type: "obj_mod",
            path: ["role"],
            prev: "user",
            curr: "admin",
        });
    });

    it("purging a deleted user keeps their entries elsewhere — the FK policy keeps them", async () => {
        const db = createMockPrisma();
        const orgId = OrganizationId.create();
        const adminId = UserId.create();
        const subjectId = UserId.create();

        await db.organization.create({
            data: { id: orgId, name: "Org", slug: `org-${nanoId16()}`, createdAt: new Date() },
        });
        await db.user.create({
            data: { id: adminId, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
        });
        await db.user.create({
            data: { id: subjectId, name: "Kim Park", email: "kim@example.com" },
        });

        // An action the subject took in an organization, which must survive their deletion.
        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: orgId,
                userId: subjectId,
                actorLabel: "Kim Park <kim@example.com>",
                action: "Update",
                objectType: "Person",
                objectId: "person_1",
                changes: [],
            },
        });

        const caller = usersRouter.createCaller(
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

        await caller.deleteUser({ userId: subjectId });
        await caller.purgeUser({ userId: subjectId });
        expect(await db.user.findUnique({ where: { id: subjectId } })).toBeNull();

        const survivors = await db.logEntry.findMany({ where: { objectId: "person_1" } });
        expect(survivors).toHaveLength(1);
        expect(survivors[0].userId).toBeNull();
        expect(survivors[0].actorLabel).toBe("Kim Park <kim@example.com>");
    });
});

describe("users.deleteUser — the deletion's own audit entry", () => {
    const T = { admin: UserId.create(), subject: UserId.create() };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.user.create({
            data: { id: T.admin, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
        });
        await db.user.create({
            data: { id: T.subject, name: "Kim Park", email: "kim@example.com" },
        });
    });

    function makeCaller() {
        return usersRouter.createCaller(
            createAuthenticatedMockContext({
                user: {
                    id: T.admin,
                    name: "Dana Okafor",
                    email: "dana@example.com",
                    role: "admin",
                },
                prisma: db,
            }),
        );
    }

    /*
     * The regression this guards: the entry used to be written with `ownerId: input.userId`
     * inside the same `$transaction` as `user.delete`. `log_entries.ownerId` is
     * `onDelete: Cascade`, so it was inserted and cascaded away before the transaction
     * committed — a write with a zero-length lifetime that nothing could ever read.
     */
    it("survives the deletion, because a system-scoped entry has no owner FK to cascade through", async () => {
        await makeCaller().deleteUser({ userId: T.subject });

        const entries = await db.logEntry.findMany({
            where: { objectType: "User", objectId: T.subject, action: "Delete" },
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "system",
            organizationId: null,
            ownerId: null,
            userId: T.admin,
            actorLabel: "Dana Okafor <dana@example.com>",
        });
        expect(entries[0].description).toContain("Kim Park <kim@example.com>");
    });
});

describe("systemAdminProcedure gate", () => {
    const db = createMockPrisma();

    it("rejects a user whose session role is not admin", async () => {
        const ctx = createAuthenticatedMockContext({
            user: { id: UserId.create(), role: "user" },
            prisma: db,
        });
        await expect(usersRouter.createCaller(ctx).listUsers()).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("allows a user whose session role is admin", async () => {
        const ctx = createAuthenticatedMockContext({
            user: { id: UserId.create(), role: "admin" },
            prisma: db,
        });
        await expect(usersRouter.createCaller(ctx).listUsers()).resolves.toMatchObject({
            users: expect.any(Array),
        });
    });
});
