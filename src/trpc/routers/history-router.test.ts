/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { Roles, type Role } from "@/lib/permissions";
import { LogEntryId, LogEntryObjectId, LogObjectType } from "@/lib/schemas/log-entry";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import * as ObjectHistory from "@/server/services/object-history";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { assertHasPermissionResult } from "../permissions";

import { historyRouter } from "./history-router";

// Wrap the real service so the tests can read the `relatedTypes` the router works out.
vi.mock("@/server/services/object-history", async (importOriginal) => {
    const actual = await importOriginal<typeof ObjectHistory>();
    return { ...actual, list: vi.fn(actual.list) };
});

describe("history.listObjectHistory", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        person: PersonId.create(),
        tokenId: "d4h-token-id",
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Pat Person",
                email: "pat@example.com",
            },
        });
        await db.logEntry.create({
            data: {
                id: LogEntryId.create(),
                scope: "organization",
                organizationId: T.org,
                sequence: 1,
                action: "Create",
                objectType: "Person",
                objectId: T.person,
                actorLabel: "Una User <una@example.com>",
                changes: [],
                objects: {
                    create: [
                        {
                            id: LogEntryObjectId.create(),
                            objectType: "Person",
                            objectId: T.person,
                            role: "primary",
                        },
                    ],
                },
            },
        });
    });

    /** A caller holding exactly `role`, authorized by the real role definition. */
    function makeCaller(role: Role) {
        return historyRouter.createCaller({
            ...createAuthenticatedMockContext({ user: { id: T.user }, prisma: db }),
            hasPermission: async (_organizationId, required) =>
                assertHasPermissionResult(Roles[role].authorize(required), required),
        });
    }

    /** The `relatedTypes` the router handed the service on its most recent call. */
    function lastRelatedTypes() {
        const calls = vi.mocked(ObjectHistory.list).mock.calls;
        return calls[calls.length - 1][1].relatedTypes;
    }

    const personInput = {
        organizationId: T.org,
        objectType: "Person",
        objectId: T.person,
    } as const;
    const tokenInput = {
        organizationId: T.org,
        objectType: "D4HAccessToken",
        objectId: T.tokenId,
    } as const;

    it("lets a member read a Person's history", async () => {
        const page = await makeCaller("member").listObjectHistory(personInput);

        expect(page.entries.map((entry) => entry.objectId)).toEqual([T.person]);
        expect(page.nextCursor).toBeNull();
    });

    it("refuses a member a D4H access token's history", async () => {
        await expect(makeCaller("member").listObjectHistory(tokenInput)).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
        expect(ObjectHistory.list).not.toHaveBeenCalled();
    });

    it("lets an admin read both", async () => {
        const caller = makeCaller("admin");

        await expect(caller.listObjectHistory(personInput)).resolves.toMatchObject({
            entries: [expect.objectContaining({ objectId: T.person })],
        });
        await expect(caller.listObjectHistory(tokenInput)).resolves.toEqual({
            entries: [],
            nextCursor: null,
        });
    });

    it("rejects an object type with no History page", async () => {
        await expect(
            makeCaller("admin").listObjectHistory({
                organizationId: T.org,
                // @ts-expect-error — not a key of `HistoryObjects`
                objectType: "I3Template",
                objectId: "some-template",
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("gives an admin every related type", async () => {
        await makeCaller("admin").listObjectHistory(personInput);

        expect([...lastRelatedTypes()].sort()).toEqual([...LogObjectType.values].sort());
    });

    it("leaves out OrganizationMembership for a caller without member:view", async () => {
        await makeCaller("skills-assessor").listObjectHistory(personInput);

        const relatedTypes = lastRelatedTypes();
        expect(relatedTypes).not.toContain("OrganizationMembership");
        expect(relatedTypes).toEqual(
            expect.arrayContaining(["Person", "Team", "TeamMembership", "SkillCheckSession"]),
        );
    });

    it("leaves out TeamMembership and Team for a caller without team:view", async () => {
        await makeCaller("i3-editor").listObjectHistory(personInput);

        const relatedTypes = lastRelatedTypes();
        expect(relatedTypes).not.toContain("TeamMembership");
        expect(relatedTypes).not.toContain("Team");
        expect(relatedTypes).toEqual(expect.arrayContaining(["Person", "OrganizationMembership"]));
    });
});
