/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// The routers under test reach server-only modules at import time. The procedures
// exercised here use ctx.prisma (the injected mock), so an empty stub is enough to let
// them import in jsdom.
vi.mock("server-only", () => ({}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
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
        await users().unlinkPerson({ organizationId: T.org, userId: T.user1 });

        expect(
            await users().getLinkedPerson({ organizationId: T.org, userId: T.user1 }),
        ).toBeNull();

        // person1 is now available to link again
        const unlinked = await personnel().listUnlinkedPersonnel({ organizationId: T.org });
        expect(unlinked.map((p) => p.id)).toContain(T.person1);
    });
});
