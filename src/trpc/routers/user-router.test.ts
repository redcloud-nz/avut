/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { UserSessionId } from "@/lib/schemas/user-session";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { userRouter } from "./user-router";

// The router under test reaches server-only modules at import time. The procedures
// exercised here use ctx.prisma (the injected mock), so an empty stub is enough to let
// them import in jsdom.
vi.mock("server-only", () => ({}));

// `closeMyAccount` drops the cached org roles, which needs Next's request store.
vi.mock("@/server/cache/organization-user-revalidate", () => ({
    organizationUserCacheTag: (id: string) => `organization-user-${id}`,
    revalidateOrganizationUser: vi.fn(async () => {}),
}));

// `acceptInvitation`/`rejectInvitation` delegate to Better Auth so its role cache and
// membership creation stay in sync. The tests assert on that delegation rather than
// standing up a real auth instance.
const acceptInvitationMock = vi.fn();
const rejectInvitationMock = vi.fn();
vi.mock("@/server/auth", () => ({
    auth: {
        api: {
            acceptInvitation: (...args: unknown[]) => acceptInvitationMock(...args),
            rejectInvitation: (...args: unknown[]) => rejectInvitationMock(...args),
        },
    },
}));

describe("userRouter.listSessions", () => {
    // Dataset:
    //   user1 → current session (sessionCurrent) + another device (sessionOther)
    //          + one already expired (sessionExpired)
    //   user2 → an unrelated session, to prove cross-user access is refused
    const T = {
        user1: UserId.create(),
        user2: UserId.create(),
        sessionCurrent: UserSessionId.create(),
        sessionOther: UserSessionId.create(),
        sessionExpired: UserSessionId.create(),
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
                id: T.sessionExpired,
                token: "token-expired",
                userId: T.user1,
                expiresAt: new Date("2020-01-01T00:00:00Z"),
                userAgent: null,
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

    function user(sessionId: string = T.sessionCurrent) {
        return userRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user1 },
                session: { id: sessionId, token: "token-current" },
                prisma: db,
            }),
        );
    }

    it("lists only the current user's unexpired sessions", async () => {
        const sessions = await user().listSessions();

        expect(sessions.map((s) => s.id).sort()).toEqual([T.sessionCurrent, T.sessionOther].sort());
    });

    it("flags the requesting session as current", async () => {
        const sessions = await user().listSessions();

        expect(sessions.find((s) => s.id === T.sessionCurrent)?.isCurrent).toBe(true);
        expect(sessions.find((s) => s.id === T.sessionOther)?.isCurrent).toBe(false);
    });

    it("never exposes session tokens", async () => {
        const sessions = await user().listSessions();

        for (const session of sessions) {
            expect(session).not.toHaveProperty("token");
        }
    });
});

describe("userRouter.listMemberships", () => {
    // Dataset: caller belongs to two orgs (one with two roles); another user belongs to org1
    // and must not appear in the caller's list.
    const T = {
        org1: OrganizationId.create(),
        org2: OrganizationId.create(),
        caller: UserId.create(),
        other: UserId.create(),
        membership1: OrganizationUserId.create(),
        membership2: OrganizationUserId.create(),
        membershipOther: OrganizationUserId.create(),
        person: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const [id, name, slug] of [
            [T.org1, "First Org", "first-org"],
            [T.org2, "Second Org", "second-org"],
        ] as const) {
            await db.organization.create({ data: { id, name, slug, createdAt: new Date() } });
        }
        await db.user.create({
            data: {
                id: T.caller,
                name: "Caller",
                email: "caller@example.com",
                emailVerified: true,
            },
        });
        await db.user.create({
            data: { id: T.other, name: "Other", email: "other@example.com", emailVerified: true },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org1,
                name: "Caller Person",
                email: "caller@example.com",
                status: "Active",
                tags: [],
                properties: {},
            },
        });
        await db.organizationUser.create({
            data: {
                id: T.membership1,
                organizationId: T.org1,
                userId: T.caller,
                role: "admin,i3-editor",
                personId: T.person,
            },
        });
        await db.organizationUser.create({
            data: { id: T.membership2, organizationId: T.org2, userId: T.caller, role: "member" },
        });
        await db.organizationUser.create({
            data: {
                id: T.membershipOther,
                organizationId: T.org1,
                userId: T.other,
                role: "member",
            },
        });
    });

    it("returns only the caller's memberships, with their organization and roles", async () => {
        const result = await userRouter
            .createCaller(createAuthenticatedMockContext({ user: { id: T.caller }, prisma: db }))
            .listMemberships();

        expect(result).toHaveLength(2);

        const first = result.find((m) => m.organizationId === T.org1);
        expect(first).toMatchObject({
            organizationUserId: T.membership1,
            userId: T.caller,
            personId: T.person,
            roles: ["admin", "i3-editor"],
            organization: { id: T.org1, name: "First Org" },
        });
        expect(result.find((m) => m.organizationId === T.org2)?.roles).toEqual(["member"]);
    });

    it("does not carry the member's user identity", async () => {
        const [membership] = await userRouter
            .createCaller(createAuthenticatedMockContext({ user: { id: T.caller }, prisma: db }))
            .listMemberships();

        expect(membership).not.toHaveProperty("name");
        expect(membership).not.toHaveProperty("email");
        expect(membership).not.toHaveProperty("user");
    });
});

describe("userRouter.getSession", () => {
    const db = createMockPrisma();

    it("returns the caller's user and session-level fields", async () => {
        const userId = UserId.create();

        const result = await userRouter
            .createCaller(
                createAuthenticatedMockContext({
                    user: {
                        id: userId,
                        name: "Ada Lovelace",
                        email: "ada@example.com",
                        role: "admin",
                    },
                    session: { impersonatedBy: "impersonator-id" },
                    prisma: db,
                }),
            )
            .getSession();

        expect(result).toEqual({
            user: {
                id: userId,
                name: "Ada Lovelace",
                email: "ada@example.com",
                emailVerified: true,
                image: null,
                role: "admin",
            },
            session: { impersonatedBy: "impersonator-id" },
        });
    });

    it("returns null rather than throwing when there is no session", async () => {
        const result = await userRouter
            .createCaller({
                prisma: db,
                auth: null,
                hasPermission: async () => {},
                getHeaders: async () => new Headers(),
            })
            .getSession();

        expect(result).toBeNull();
    });
});

describe("userRouter invitations", () => {
    // Dataset: the caller has two pending invitations (one to accept, one to reject, so neither
    // test leans on the mocked Better Auth leaving the other's fixture untouched), an expired and
    // an already-accepted one, plus someone else has a pending one; only the first two are
    // actionable by the caller.
    const T = {
        org: OrganizationId.create(),
        inviter: UserId.create(),
        caller: UserId.create(),
        pending: InvitationId.create(),
        pendingToReject: InvitationId.create(),
        expired: InvitationId.create(),
        accepted: InvitationId.create(),
        someoneElses: InvitationId.create(),
        // A named-person invitation, kept on its own user/membership so this test can write
        // freely without disturbing the accept/reject fixtures above.
        namingCaller: UserId.create(),
        namedPerson: PersonId.create(),
        naming: InvitationId.create(),
        namingMembership: OrganizationUserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Invite Org", slug: "invite-org", createdAt: new Date() },
        });
        for (const [id, email] of [
            [T.inviter, "inviter@example.com"],
            [T.caller, "caller@example.com"],
        ] as const) {
            await db.user.create({ data: { id, name: email, email, emailVerified: true } });
        }
        await db.user.create({
            data: {
                id: T.namingCaller,
                name: "Naming Caller",
                email: "naming-caller@example.com",
                emailVerified: true,
            },
        });
        await db.person.create({
            data: {
                id: T.namedPerson,
                organizationId: T.org,
                name: "Named Person",
                email: "named-person@example.com",
                status: "Active",
                tags: [],
                properties: {},
            },
        });
        await db.organizationUser.create({
            data: {
                id: T.namingMembership,
                organizationId: T.org,
                userId: T.namingCaller,
                role: "member",
            },
        });

        const base = { organizationId: T.org, inviterId: T.inviter, role: "member" };
        const future = new Date("2099-01-01T00:00:00Z");
        await db.organizationInvitation.create({
            data: {
                ...base,
                id: T.pending,
                email: "caller@example.com",
                status: "pending",
                expiresAt: future,
            },
        });
        await db.organizationInvitation.create({
            data: {
                ...base,
                id: T.naming,
                email: "naming-caller@example.com",
                personId: T.namedPerson,
                status: "pending",
                expiresAt: future,
            },
        });
        await db.organizationInvitation.create({
            data: {
                ...base,
                id: T.pendingToReject,
                email: "caller@example.com",
                status: "pending",
                expiresAt: future,
            },
        });
        await db.organizationInvitation.create({
            data: {
                ...base,
                id: T.expired,
                email: "caller@example.com",
                status: "pending",
                expiresAt: new Date("2020-01-01T00:00:00Z"),
            },
        });
        await db.organizationInvitation.create({
            data: {
                ...base,
                id: T.accepted,
                email: "caller@example.com",
                status: "accepted",
                expiresAt: future,
            },
        });
        await db.organizationInvitation.create({
            data: {
                ...base,
                id: T.someoneElses,
                email: "other@example.com",
                status: "pending",
                expiresAt: future,
            },
        });
    });

    function user() {
        return userRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.caller, email: "caller@example.com" },
                prisma: db,
            }),
        );
    }

    function namingCallerUser() {
        return userRouter.createCaller(
            createAuthenticatedMockContext({
                user: {
                    id: T.namingCaller,
                    name: "Naming Caller",
                    email: "naming-caller@example.com",
                },
                prisma: db,
            }),
        );
    }

    it("lists only the caller's pending, unexpired invitations", async () => {
        const result = await user().listInvitations();

        expect(result.map((i) => i.id).sort()).toEqual([T.pending, T.pendingToReject].sort());
    });

    it("accepts through Better Auth and logs the new membership on both the caller's and the organization's timeline", async () => {
        acceptInvitationMock.mockResolvedValueOnce({ member: { id: "member_1" } });

        const result = await user().acceptInvitation({ invitationId: T.pending });

        expect(result).toEqual({ organizationSlug: "invite-org" });
        expect(acceptInvitationMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: { invitationId: T.pending } }),
        );

        const entries = await db.logEntry.findMany({ where: { objectId: "member_1" } });
        expect(entries).toHaveLength(2);

        const userEntry = entries.find((e) => e.scope === "user");
        const orgEntry = entries.find((e) => e.scope === "organization");
        expect(userEntry).toMatchObject({
            ownerId: T.caller,
            action: "Create",
            objectType: "OrganizationMembership",
        });
        expect(orgEntry).toMatchObject({
            organizationId: T.org,
            userId: T.caller,
            action: "Create",
            objectType: "OrganizationMembership",
        });

        // Two independently meaningful events, correlated by one batch.
        expect(userEntry?.batchId).toBeTruthy();
        expect(orgEntry?.batchId).toBe(userEntry?.batchId);
        const batch = await db.logBatch.findUnique({ where: { id: userEntry!.batchId! } });
        expect(batch).toMatchObject({ operationKey: "invitation-accept", userId: T.caller });
    });

    it("links the invitation's named person onto the new membership", async () => {
        acceptInvitationMock.mockResolvedValueOnce({ member: { id: T.namingMembership } });

        await namingCallerUser().acceptInvitation({ invitationId: T.naming });

        const membership = await db.organizationUser.findFirst({
            where: { id: T.namingMembership },
        });
        expect(membership?.personId).toBe(T.namedPerson);

        // The invitation-accept batch's two entries, plus the person-link entry.
        const entries = await db.logEntry.findMany({ where: { objectId: T.namingMembership } });
        expect(entries).toHaveLength(3);
        const linkEntry = entries.find((e) => e.description?.includes("Linked person"));
        expect(linkEntry).toMatchObject({
            scope: "organization",
            organizationId: T.org,
            userId: T.namingCaller,
            action: "Update",
            objectType: "OrganizationMembership",
        });
        expect(linkEntry?.description).toContain("the invitation named the person");
    });

    it("rejects through Better Auth and logs it on both timelines", async () => {
        rejectInvitationMock.mockResolvedValueOnce({});

        await user().rejectInvitation({ invitationId: T.pendingToReject });

        expect(rejectInvitationMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: { invitationId: T.pendingToReject } }),
        );

        const entries = await db.logEntry.findMany({ where: { objectId: T.pendingToReject } });
        expect(entries).toHaveLength(2);

        const userEntry = entries.find((e) => e.scope === "user");
        const orgEntry = entries.find((e) => e.scope === "organization");
        expect(userEntry).toMatchObject({
            ownerId: T.caller,
            action: "Update",
            objectType: "OrganizationInvitation",
        });
        expect(orgEntry).toMatchObject({
            organizationId: T.org,
            userId: T.caller,
            action: "Update",
            objectType: "OrganizationInvitation",
        });

        expect(orgEntry?.batchId).toBe(userEntry?.batchId);
        const batch = await db.logBatch.findUnique({ where: { id: userEntry!.batchId! } });
        expect(batch).toMatchObject({ operationKey: "invitation-reject", userId: T.caller });
    });

    it.each([
        ["expired", T.expired],
        ["already accepted", T.accepted],
        ["addressed to someone else", T.someoneElses],
    ])("refuses to act on an invitation that is %s", async (_label, invitationId) => {
        acceptInvitationMock.mockClear();
        rejectInvitationMock.mockClear();

        await expect(user().acceptInvitation({ invitationId })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
        await expect(user().rejectInvitation({ invitationId })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
        expect(acceptInvitationMock).not.toHaveBeenCalled();
        expect(rejectInvitationMock).not.toHaveBeenCalled();
    });
});

describe("userRouter.leaveOrganization", () => {
    const T = {
        org: OrganizationId.create(),
        ownedOrg: OrganizationId.create(),
        caller: UserId.create(),
        outsider: UserId.create(),
        membership: OrganizationUserId.create(),
        ownership: OrganizationUserId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Leave Org", slug: "leave-org", createdAt: new Date() },
        });
        await db.user.create({
            data: { id: T.caller, name: "Caller", email: "caller@example.com" },
        });
        await db.user.create({
            data: { id: T.outsider, name: "Outsider", email: "outsider@example.com" },
        });
        await db.organizationUser.create({
            data: { id: T.membership, organizationId: T.org, userId: T.caller, role: "member" },
        });
        await db.organization.create({
            data: { id: T.ownedOrg, name: "Owned", slug: "owned-org", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: { id: T.ownership, organizationId: T.ownedOrg, userId: T.caller, role: "owner" },
        });
    });

    function user(id = T.caller) {
        return userRouter.createCaller(
            createAuthenticatedMockContext({ user: { id }, prisma: db }),
        );
    }

    it("deletes the membership and logs it on both the caller's and the organization's timeline", async () => {
        const result = await user().leaveOrganization({ organizationId: T.org });

        expect(result).toEqual({ ok: true });
        expect(await db.organizationUser.findUnique({ where: { id: T.membership } })).toBeNull();

        const entries = await db.logEntry.findMany({ where: { objectId: T.membership } });
        expect(entries).toHaveLength(2);

        const userEntry = entries.find((e) => e.scope === "user");
        const orgEntry = entries.find((e) => e.scope === "organization");
        expect(userEntry).toMatchObject({
            ownerId: T.caller,
            action: "Delete",
            objectType: "OrganizationMembership",
        });
        expect(orgEntry).toMatchObject({
            organizationId: T.org,
            userId: T.caller,
            action: "Delete",
            objectType: "OrganizationMembership",
        });

        expect(orgEntry?.batchId).toBe(userEntry?.batchId);
        const batch = await db.logBatch.findUnique({ where: { id: userEntry!.batchId! } });
        expect(batch).toMatchObject({ operationKey: "organization-leave", userId: T.caller });
    });

    it("lets the only owner leave, leaving the organization with no owner", async () => {
        await user().leaveOrganization({ organizationId: T.ownedOrg });
        expect(await db.organizationUser.count({ where: { organizationId: T.ownedOrg } })).toBe(0);
    });

    it("refuses to leave an organization you're not a member of", async () => {
        await expect(
            user(T.outsider).leaveOrganization({ organizationId: T.org }),
        ).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });
});

describe("userRouter.closeMyAccount", () => {
    const T = {
        closer: UserId.create(),
        soleOwner: UserId.create(),
        org: OrganizationId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const [id, email] of [
            [T.closer, "closer@example.com"],
            [T.soleOwner, "owner@example.com"],
        ] as const) {
            await db.user.create({ data: { id, name: email, email } });
        }
        await db.organization.create({
            data: { id: T.org, name: "Only Mine SAR", slug: "only-mine", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: {
                id: OrganizationUserId.create(),
                organizationId: T.org,
                userId: T.soleOwner,
                role: "owner",
            },
        });
    });

    function caller(id: string, email: string) {
        return userRouter.createCaller(
            createAuthenticatedMockContext({ user: { id, email }, prisma: db }),
        );
    }

    it("refuses without the caller's own email typed to confirm", async () => {
        await expect(
            caller(T.closer, "closer@example.com").closeMyAccount({ confirmEmail: "nope" }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect((await db.user.findUnique({ where: { id: T.closer } }))?.status).toBe("Active");
    });

    it("lists the organisations closing would leave ownerless, then allows it", async () => {
        const owner = caller(T.soleOwner, "owner@example.com");
        expect(await owner.listSoleOwnedOrganizations()).toEqual([
            { id: expect.any(String), name: "Only Mine SAR" },
        ]);

        await owner.closeMyAccount({ confirmEmail: "owner@example.com" });
        expect((await db.user.findUnique({ where: { id: T.soleOwner } }))?.status).toBe("Deleted");
    });

    it("moves the account to the Rubbish bin with a system-scoped entry", async () => {
        await caller(T.closer, "closer@example.com").closeMyAccount({
            confirmEmail: " Closer@Example.com ",
        });

        expect((await db.user.findUnique({ where: { id: T.closer } }))?.status).toBe("Deleted");
        const [entry] = await db.logEntry.findMany({
            where: { objectType: "User", objectId: T.closer, action: "Delete" },
        });
        expect(entry).toMatchObject({ scope: "system", ownerId: null, userId: T.closer });
        expect(entry.description).toMatch(/closed by its owner/);
    });
});

describe("userRouter closed-account gate", () => {
    const T = { selfClosed: UserId.create(), adminDeleted: UserId.create() };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const [id, deletedBy] of [
            [T.selfClosed, "Self"],
            [T.adminDeleted, "Admin"],
        ] as const) {
            await db.user.create({
                data: { id, name: id, email: `${id}@example.com`, status: "Deleted", deletedBy },
            });
        }
    });

    // The session carries the account's status (Better Auth `additionalFields`).
    function caller(id: string, deletedBy: "Self" | "Admin") {
        return userRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id, email: `${id}@example.com`, status: "Deleted", deletedBy },
                prisma: db,
            }),
        );
    }

    it("refuses ordinary procedures to a closed account", async () => {
        await expect(caller(T.selfClosed, "Self").listMemberships()).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("reports whether the owner may restore it", async () => {
        expect(await caller(T.selfClosed, "Self").getAccountClosure()).toMatchObject({
            closed: true,
            canRestore: true,
        });
        expect(await caller(T.adminDeleted, "Admin").getAccountClosure()).toMatchObject({
            closed: true,
            canRestore: false,
        });
    });

    it("refuses to self-restore an account an administrator deleted", async () => {
        await expect(caller(T.adminDeleted, "Admin").restoreMyAccount()).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message: expect.stringMatching(/deleted by an administrator/),
        });
        expect((await db.user.findUnique({ where: { id: T.adminDeleted } }))?.status).toBe(
            "Deleted",
        );
    });

    it("restores an account its owner closed", async () => {
        await caller(T.selfClosed, "Self").restoreMyAccount();
        expect(await db.user.findUnique({ where: { id: T.selfClosed } })).toMatchObject({
            status: "Active",
            deletedBy: null,
        });
    });
});
