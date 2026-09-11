/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// teams-router reaches @/server/auth at import time. The procedures under test only touch
// ctx.prisma (the injected mock), so stubbing server-only is enough to let the module load
// under jsdom.
vi.mock("server-only", () => ({}));

// The D4H linking procedures touch only getPersonalD4HAccessTokenForUser and the
// cached fetch helpers in @/server/d4h-api/client — stubbed here (same pattern as
// d4h-access-tokens-router.test.ts) rather than a live D4H client.
const grace = {
    id: 501,
    resourceType: "Member" as const,
    email: { value: "grace@example.com", verified: true },
    name: "Grace Hopper",
    owner: { id: 4242, resourceType: "Team" as const },
    position: null,
    ref: null,
    role: { id: null, resourceType: "Role" as const },
    status: "OPERATIONAL" as const,
};

vi.mock("@/server/d4h-api/client", () => ({
    getD4HTokenMetadata: vi.fn(async () => ({
        d4HTeams: [{ id: 4242, resourceType: "Team", title: "Alpha D4H" }],
        d4HOrganisations: [],
    })),
    fetchD4HTeamDetailCached: vi.fn(async () => ({
        id: 4242,
        resourceType: "Team",
        title: "Alpha D4H",
        timezone: "Pacific/Auckland",
    })),
    fetchD4HTeamMembersForSync: vi.fn(async () => [grace]),
    fetchD4HOrganisationCached: vi.fn(async () => {
        throw new Error("not expected for an org-less linked team");
    }),
}));

vi.mock("@/server/d4h-access-token", () => ({
    getPersonalD4HAccessTokenForUser: vi.fn(async () => ({
        id: "d4h-token-fixture-id",
        organizationId: null,
        userId: null,
        label: "Test token",
        serverCode: "us",
        token: "fake-token",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    })),
}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { teamsRouter } from "./teams-router";

describe("teamsRouter.getTeam", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        team: TeamId.create(),
        otherOrgTeam: TeamId.create(),
        user: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        // `Organization.createdAt` has no schema default — prisma-mock requires it.
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
        });
        // `properties` and `tags` are spelled out because prisma-mock stores the schema's
        // `@default("{}")` as the literal string, which then fails TeamData's record schema.
        await db.team.create({
            data: {
                id: T.team,
                organizationId: T.org,
                name: "Alpha",
                description: "First team",
                properties: {},
                tags: [],
            },
        });
        await db.team.create({
            data: {
                id: T.otherOrgTeam,
                organizationId: T.otherOrg,
                name: "Bravo",
                properties: {},
                tags: [],
            },
        });
    });

    function makeCaller() {
        return teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                // `organizationProcedure` always folds in `organization: ["view"]`, so the
                // mock context has to grant it alongside the procedure's own permission.
                permissions: { team: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns the team", async () => {
        const team = await makeCaller().getTeam({ organizationId: T.org, teamId: T.team });

        expect(team.id).toBe(T.team);
        expect(team.name).toBe("Alpha");
        expect(team.d4h).toBeNull();
    });

    it("throws NOT_FOUND for an unknown team", async () => {
        await expect(
            makeCaller().getTeam({ organizationId: T.org, teamId: TeamId.create() }),
        ).rejects.toThrow(/not found/i);
    });

    // Organization scoping is the security boundary — a valid team id from another org
    // must not resolve.
    it("throws NOT_FOUND for a team in another organization", async () => {
        await expect(
            makeCaller().getTeam({ organizationId: T.org, teamId: T.otherOrgTeam }),
        ).rejects.toThrow(/not found/i);
    });
});

describe("teamsRouter.applyD4HTeamSync", () => {
    async function seed() {
        const db = createMockPrisma();
        const T = {
            org: OrganizationId.create(),
            user: nanoId16(),
            team: TeamId.create(),
            departedPerson: PersonId.create(),
            departedMembership: TeamMembershipId.create(),
        };

        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: {
                id: T.team,
                organizationId: T.org,
                name: "Alpha",
                description: "First team",
                properties: {},
                tags: [],
            },
        });
        await db.team_D4H.create({
            data: {
                teamId: T.team,
                d4hTeamId: 4242,
                d4hTeamName: "Alpha D4H",
                d4hServerCode: "us",
                d4hOrganisationId: null,
                d4hTimezone: null,
                lastSyncedAt: null,
            },
        });
        await db.person.create({
            data: {
                id: T.departedPerson,
                organizationId: T.org,
                name: "Departed Person",
                email: "departed@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.teamMembership.create({
            data: {
                id: T.departedMembership,
                organizationId: T.org,
                teamId: T.team,
                personId: T.departedPerson,
                tags: [],
                properties: {},
                status: "Active",
                d4h: { create: { d4hMemberId: 999, d4hStatus: "OPERATIONAL" } },
            },
        });

        const caller = teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );
        return { db, T, caller };
    }

    it("archives departed members, adds new ones, and batches every log entry", async () => {
        const { db, T, caller } = await seed();

        const plan = await caller.planD4HTeamSync({ organizationId: T.org, teamId: T.team });
        const { plan: applied } = await caller.applyD4HTeamSync({
            organizationId: T.org,
            teamId: T.team,
            planToken: plan.planToken,
        });

        expect(applied.counts).toMatchObject({ additions: 1, archivals: 1 });

        const departed = await db.teamMembership.findUnique({
            where: { teamId_personId: { teamId: T.team, personId: T.departedPerson } },
        });
        expect(departed?.status).toBe("Archived");

        const grace = await db.person.findFirst({
            where: { organizationId: T.org, email: "grace@example.com" },
        });
        expect(grace).not.toBeNull();
        const graceMembership = await db.teamMembership.findFirst({
            where: { teamId: T.team, personId: grace!.id },
            include: { d4h: true },
        });
        expect(graceMembership?.status).toBe("Active");
        expect(graceMembership?.d4h?.d4hMemberId).toBe(501);

        const teamD4H = await db.team_D4H.findUnique({ where: { teamId: T.team } });
        expect(teamD4H?.lastSyncedAt).not.toBeNull();

        const entries = await db.logEntry.findMany({ where: { organizationId: T.org } });
        const batchIds = new Set(entries.map((e) => e.batchId));
        expect(batchIds.size).toBe(1);
        const batch = await db.logBatch.findUnique({ where: { id: [...batchIds][0]! } });
        expect(batch).toMatchObject({ operationKey: "d4h-team-sync", userId: T.user });
    });

    it("rejects a stale planToken with a StalePlanError and writes nothing", async () => {
        const { db, T, caller } = await seed();

        await expect(
            caller.applyD4HTeamSync({
                organizationId: T.org,
                teamId: T.team,
                planToken: "stale-token-that-will-not-match",
            }),
        ).rejects.toThrow();

        const departed = await db.teamMembership.findUnique({
            where: { teamId_personId: { teamId: T.team, personId: T.departedPerson } },
        });
        expect(departed?.status).toBe("Active");
        expect(await db.person.findFirst({ where: { email: "grace@example.com" } })).toBeNull();
    });
});

// Teams are managed directly through Prisma (no better-auth team plugin), so create
// and delete are plain `$transaction([write, logEvent])` pairs.
describe("teamsRouter.createTeam / deleteTeam", () => {
    const T = { org: OrganizationId.create(), user: nanoId16() };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    function makeCaller(perms: Record<string, string[]>) {
        return teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], ...perms },
                prisma: db,
            }),
        );
    }

    it("creates a team and records a Create log entry", async () => {
        const { created } = await makeCaller({ team: ["create"] }).createTeam({
            organizationId: T.org,
            create: { name: "Rescue", description: "R", tags: [], properties: {} },
        });

        expect(created.name).toBe("Rescue");
        const row = await db.team.findUnique({ where: { id: created.id } });
        expect(row).toMatchObject({ organizationId: T.org, name: "Rescue" });

        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: created.id },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ action: "Create", organizationId: T.org });
    });

    it("deletes a team and records a Delete log entry", async () => {
        const { created } = await makeCaller({ team: ["create"] }).createTeam({
            organizationId: T.org,
            create: { name: "Doomed", description: "", tags: [], properties: {} },
        });

        await makeCaller({ team: ["delete"] }).deleteTeam({
            organizationId: T.org,
            teamId: created.id,
        });

        expect(await db.team.findUnique({ where: { id: created.id } })).toBeNull();
        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: created.id, action: "Delete" },
        });
        expect(entries).toHaveLength(1);
    });

    it("deleteTeam throws NOT_FOUND for an unknown team", async () => {
        await expect(
            makeCaller({ team: ["delete"] }).deleteTeam({
                organizationId: T.org,
                teamId: TeamId.create(),
            }),
        ).rejects.toThrow(/not found/i);
    });
});
