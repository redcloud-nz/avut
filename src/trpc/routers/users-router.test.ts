/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// The routers under test reach server-only modules at import time. The procedures
// exercised here use ctx.prisma (the injected mock), so an empty stub is enough to let
// them import in jsdom.
vi.mock("server-only", () => ({}));

// `revokeSession` delegates the actual revocation to Better Auth so its session cache is
// invalidated properly. The tests assert on that delegation rather than standing up a real
// auth instance.
const revokeSessionMock = vi.fn();
vi.mock("@/server/auth", () => ({
    auth: { api: { revokeSession: (...args: unknown[]) => revokeSessionMock(...args) } },
}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { UserSessionId } from "@/lib/schemas/user-session";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { personnelRouter } from "./personnel-router";
import { usersRouter } from "./users-router";

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
