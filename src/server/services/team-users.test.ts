/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/errors";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { TeamUserId } from "@/lib/schemas/team-user";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as TeamUsers from "./team-users";

describe("team-users", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        team: TeamId.create(),
        archivedTeam: TeamId.create(),
        emptyTeam: TeamId.create(),
        outsiderTeam: TeamId.create(),
        admin: UserId.create(),
        alice: UserId.create(),
        bob: UserId.create(),
        carol: UserId.create(),
        deleted: UserId.create(),
        outsider: UserId.create(),
        newcomer: UserId.create(),
        alicePerson: PersonId.create(),
        bobPerson: PersonId.create(),
        aliceGrant: TeamUserId.create(),
        bobGrant: TeamUserId.create(),
        carolGrant: TeamUserId.create(),
        deletedGrant: TeamUserId.create(),
        aliceArchivedGrant: TeamUserId.create(),
    };

    const db = createMockPrisma();

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.admin },
            permissions: {},
            prisma: db,
        });
    }

    async function entriesFor(objectId: string) {
        return db.logEntry.findMany({ where: { objectType: "TeamUser", objectId } });
    }

    async function contextRefsOf(logEntryId: string) {
        return db.logEntryObject.findMany({ where: { logEntryId, role: "context" } });
    }

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        for (const [id, name, status] of [
            [T.admin, "Admin", "Active"],
            [T.alice, "Alice", "Active"],
            [T.bob, "Bob", "Active"],
            [T.carol, "Carol", "Active"],
            [T.deleted, "Dave", "Deleted"],
            [T.outsider, "Olive", "Active"],
            [T.newcomer, "Nina", "Active"],
        ] as const) {
            await db.user.create({
                data: { id, name, email: `${name.toLowerCase()}@example.com`, status },
            });
        }

        for (const [id, name] of [
            [T.alicePerson, "Alice"],
            [T.bobPerson, "Bob"],
        ] as const) {
            await db.person.create({
                data: {
                    id,
                    organizationId: T.org,
                    name,
                    email: `${name.toLowerCase()}@example.com`,
                    tags: [],
                    properties: {},
                },
            });
        }

        for (const [userId, organizationId, personId] of [
            [T.admin, T.org, null],
            [T.alice, T.org, T.alicePerson],
            [T.bob, T.org, T.bobPerson],
            [T.carol, T.org, null],
            [T.deleted, T.org, null],
            [T.newcomer, T.org, null],
            [T.outsider, T.otherOrg, null],
        ] as const) {
            await db.organizationUser.create({
                data: { id: nanoId16(), organizationId, userId, personId },
            });
        }

        for (const [id, organizationId, name, status] of [
            [T.team, T.org, "Rescue", "Active"],
            [T.archivedTeam, T.org, "Alpine", "Archived"],
            [T.emptyTeam, T.org, "Empty", "Active"],
            [T.outsiderTeam, T.otherOrg, "Outsider", "Active"],
        ] as const) {
            await db.team.create({
                data: { id, organizationId, name, status, tags: [], properties: {} },
            });
        }

        // Alice is on the roster; Bob's membership is archived, so he isn't.
        for (const [personId, status] of [
            [T.alicePerson, "Active"],
            [T.bobPerson, "Archived"],
        ] as const) {
            await db.teamMembership.create({
                data: {
                    id: nanoId16(),
                    organizationId: T.org,
                    teamId: T.team,
                    personId,
                    status,
                    tags: [],
                    properties: {},
                },
            });
        }

        for (const [id, teamId, userId] of [
            [T.carolGrant, T.team, T.carol],
            [T.bobGrant, T.team, T.bob],
            [T.aliceGrant, T.team, T.alice],
            [T.deletedGrant, T.team, T.deleted],
            [T.aliceArchivedGrant, T.archivedTeam, T.alice],
        ] as const) {
            await db.teamUser.create({
                data: { id, organizationId: T.org, teamId, userId },
            });
        }
    });

    describe("listForTeam", () => {
        it("lists the team's grants by user name, leaving out soft-deleted users", async () => {
            const rows = await TeamUsers.listForTeam(ctx(), T.team);

            expect(rows.map((row) => row.user.name)).toEqual(["Alice", "Bob", "Carol"]);
            expect(rows[0]).toMatchObject({
                id: T.aliceGrant,
                teamId: T.team,
                userId: T.alice,
                user: { id: T.alice, email: "alice@example.com", image: null },
            });
        });

        it("marks only users whose person has an Active membership as on the roster", async () => {
            const rows = await TeamUsers.listForTeam(ctx(), T.team);
            const onRoster = Object.fromEntries(rows.map((row) => [row.user.name, row.onRoster]));

            expect(onRoster).toEqual({ Alice: true, Bob: false, Carol: false });
        });

        it("returns an empty list for a team with no grants", async () => {
            expect(await TeamUsers.listForTeam(ctx(), T.emptyTeam)).toEqual([]);
        });

        it("throws NotFoundError for a team in another organization", async () => {
            await expect(TeamUsers.listForTeam(ctx(), T.outsiderTeam)).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("listForUser", () => {
        it("lists the user's grants in the organization by team name, with slug and status", async () => {
            const rows = await TeamUsers.listForUser(ctx(), T.alice);

            expect(rows).toEqual([
                expect.objectContaining({
                    id: T.aliceArchivedGrant,
                    team: { id: T.archivedTeam, name: "Alpine", slug: null, status: "Archived" },
                }),
                expect.objectContaining({
                    id: T.aliceGrant,
                    team: { id: T.team, name: "Rescue", slug: null, status: "Active" },
                }),
            ]);
        });

        it("returns an empty list for a user with no grants", async () => {
            expect(await TeamUsers.listForUser(ctx(), T.newcomer)).toEqual([]);
        });
    });

    describe("grant", () => {
        it("creates the grant and a Create entry that refs the team and the user", async () => {
            const created = await TeamUsers.grant(ctx(), T.emptyTeam, T.newcomer);

            expect(created).toMatchObject({
                organizationId: T.org,
                teamId: T.emptyTeam,
                userId: T.newcomer,
            });
            const entries = await entriesFor(created.id);
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({ action: "Create", organizationId: T.org });
            expect(entries[0].description).toContain("Nina");
            expect(entries[0].description).toContain("Empty");
            expect(await contextRefsOf(entries[0].id)).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ objectType: "Team", objectId: T.emptyTeam }),
                    expect.objectContaining({ objectType: "User", objectId: T.newcomer }),
                ]),
            );
        });

        it("throws NotFoundError for a team in another organization", async () => {
            await expect(TeamUsers.grant(ctx(), T.outsiderTeam, T.carol)).rejects.toThrow(
                NotFoundError,
            );
        });

        it("throws ConflictError for a team that isn't Active", async () => {
            await expect(TeamUsers.grant(ctx(), T.archivedTeam, T.carol)).rejects.toThrow(
                new ConflictError("Archived teams can't be granted access."),
            );
        });

        it("throws NotFoundError for a user who isn't a member of the organization", async () => {
            await expect(TeamUsers.grant(ctx(), T.team, T.outsider)).rejects.toThrow(NotFoundError);
            expect(
                await db.teamUser.findMany({ where: { teamId: T.team, userId: T.outsider } }),
            ).toHaveLength(0);
        });

        it("throws NotFoundError for a soft-deleted user", async () => {
            await expect(TeamUsers.grant(ctx(), T.emptyTeam, T.deleted)).rejects.toThrow(
                NotFoundError,
            );
        });

        it("throws ConflictError when the user already has access", async () => {
            await expect(TeamUsers.grant(ctx(), T.team, T.carol)).rejects.toThrow(ConflictError);
            expect(await entriesFor(T.carolGrant)).toHaveLength(0);
        });
    });

    describe("revoke", () => {
        it("deletes the grant and logs a Delete entry that refs the team and the user", async () => {
            await TeamUsers.revoke(ctx(), T.team, T.bob);

            expect(await db.teamUser.findUnique({ where: { id: T.bobGrant } })).toBeNull();
            const entries = await entriesFor(T.bobGrant);
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({ action: "Delete", organizationId: T.org });
            expect(entries[0].description).toContain("Bob");
            expect(entries[0].description).toContain("Rescue");
            expect(await contextRefsOf(entries[0].id)).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ objectType: "Team", objectId: T.team }),
                    expect.objectContaining({ objectType: "User", objectId: T.bob }),
                ]),
            );
        });

        it("throws NotFoundError when there is no grant", async () => {
            await expect(TeamUsers.revoke(ctx(), T.emptyTeam, T.carol)).rejects.toThrow(
                NotFoundError,
            );
        });

        it("throws NotFoundError for a grant in another organization", async () => {
            const otherCtx = createOrganizationMockContext({
                organizationId: T.otherOrg,
                user: { id: T.admin },
                permissions: {},
                prisma: db,
            });

            await expect(TeamUsers.revoke(otherCtx, T.team, T.alice)).rejects.toThrow(
                NotFoundError,
            );
            expect(await db.teamUser.findUnique({ where: { id: T.aliceGrant } })).not.toBeNull();
        });
    });
});
