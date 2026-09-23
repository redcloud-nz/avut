/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
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

// `revokeSession` delegates the actual revocation to Better Auth so its session cache is
// invalidated properly. The tests assert on that delegation rather than standing up a real
// auth instance.
const revokeSessionMock = vi.fn();
const acceptInvitationMock = vi.fn();
const rejectInvitationMock = vi.fn();
vi.mock("@/server/auth", () => ({
    auth: {
        api: {
            revokeSession: (...args: unknown[]) => revokeSessionMock(...args),
            acceptInvitation: (...args: unknown[]) => acceptInvitationMock(...args),
            rejectInvitation: (...args: unknown[]) => rejectInvitationMock(...args),
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

describe("usersRouter session management", () => {
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

    function users(sessionId: string = T.sessionCurrent) {
        return usersRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user1 },
                session: { id: sessionId, token: "token-current" },
                prisma: db,
            }),
        );
    }

    it("lists only the current user's unexpired sessions", async () => {
        const sessions = await users().listSessions();

        expect(sessions.map((s) => s.id).sort()).toEqual([T.sessionCurrent, T.sessionOther].sort());
    });

    it("flags the requesting session as current", async () => {
        const sessions = await users().listSessions();

        expect(sessions.find((s) => s.id === T.sessionCurrent)?.isCurrent).toBe(true);
        expect(sessions.find((s) => s.id === T.sessionOther)?.isCurrent).toBe(false);
    });

    it("never exposes session tokens", async () => {
        const sessions = await users().listSessions();

        for (const session of sessions) {
            expect(session).not.toHaveProperty("token");
        }
    });

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

describe("users.listMemberships", () => {
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
        const result = await usersRouter
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
        const [membership] = await usersRouter
            .createCaller(createAuthenticatedMockContext({ user: { id: T.caller }, prisma: db }))
            .listMemberships();

        expect(membership).not.toHaveProperty("name");
        expect(membership).not.toHaveProperty("email");
        expect(membership).not.toHaveProperty("user");
    });
});

describe("users.getSession", () => {
    const db = createMockPrisma();

    it("returns the caller's user and session-level fields", async () => {
        const userId = UserId.create();

        const result = await usersRouter
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
        const result = await usersRouter
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

describe("users invitations", () => {
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

    function users() {
        return usersRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.caller, email: "caller@example.com" },
                prisma: db,
            }),
        );
    }

    it("lists only the caller's pending, unexpired invitations", async () => {
        const result = await users().listInvitations();

        expect(result.map((i) => i.id).sort()).toEqual([T.pending, T.pendingToReject].sort());
    });

    it("accepts through Better Auth and logs the new membership on both the caller's and the organization's timeline", async () => {
        acceptInvitationMock.mockResolvedValueOnce({ member: { id: "member_1" } });

        const result = await users().acceptInvitation({ invitationId: T.pending });

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

    it("rejects through Better Auth and logs it on both timelines", async () => {
        rejectInvitationMock.mockResolvedValueOnce({});

        await users().rejectInvitation({ invitationId: T.pendingToReject });

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

        await expect(users().acceptInvitation({ invitationId })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
        await expect(users().rejectInvitation({ invitationId })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
        expect(acceptInvitationMock).not.toHaveBeenCalled();
        expect(rejectInvitationMock).not.toHaveBeenCalled();
    });
});
