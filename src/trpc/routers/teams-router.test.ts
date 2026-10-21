/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "@/lib/errors";
import { nanoId16 } from "@/lib/id";
import { BatchUpdatePlanId } from "@/lib/schemas/batch-update-plan";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { EXECUTION_STALE_MS } from "@/server/services/batch-update-plans";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { teamsRouter } from "./teams-router";

// teams-router reaches @/server/auth at import time. The procedures under test only touch
// ctx.prisma (the injected mock), so stubbing server-only is enough to let the module load
// under jsdom.
vi.mock("server-only", () => ({}));

// The D4H linking procedures touch only getConfiguredD4HAccessToken and the
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
    getConfiguredD4HAccessToken: vi.fn(async () => ({
        id: "d4h-token-fixture-id",
        organizationId: null,
        userId: null,
        label: "Test token",
        serverCode: "us",
        token: "fake-token",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    })),
    toD4HCredentialRef: vi.fn((token: { id: string }) => ({
        credentialId: token.id,
        organizationId: null,
        userId: null,
    })),
}));

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

describe("teamsRouter D4H sync plans", () => {
    async function seed() {
        const db = createMockPrisma();
        const T = {
            org: OrganizationId.create(),
            otherOrg: OrganizationId.create(),
            user: nanoId16(),
            team: TeamId.create(),
            departedPerson: PersonId.create(),
            departedMembership: TeamMembershipId.create(),
        };

        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
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

        async function createPlan() {
            const created = await caller.createD4HTeamSyncPlan({
                organizationId: T.org,
                teamId: T.team,
            });
            if (created.status !== "ready") throw new Error("expected a ready plan");
            return created;
        }

        return { db, T, caller, createPlan };
    }

    it("creates a plan, then executes it: archives departed members, adds new ones, one batch", async () => {
        const { db, T, caller, createPlan } = await seed();

        const { planId } = await createPlan();
        const { plan: executed } = await caller.executeD4HTeamSyncPlan({
            organizationId: T.org,
            planId,
            skipItemIds: [],
        });

        expect(executed).toMatchObject({ id: planId, teamId: T.team });
        expect(executed.payload.counts).toMatchObject({ additions: 1, archivals: 1 });

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

        const row = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
        expect(row).toMatchObject({ status: "Completed", logBatchId: batch!.id });
    });

    it("takes over a membership a concurrent manual add created first instead of crashing", async () => {
        const { db, T, caller, createPlan } = await seed();

        const { planId } = await createPlan();

        // Simulate a concurrent manual add winning the race: it creates an unlinked
        // TeamMembership row for Grace between the executor's lookup and its own create, so the
        // create loses to the unique constraint on (teamId, personId) — see issue #164.
        const originalCreate = db.teamMembership.create.bind(db.teamMembership) as (
            args: unknown,
        ) => Promise<unknown>;
        const createSpy = vi.spyOn(db.teamMembership, "create") as unknown as {
            mockImplementationOnce: (
                fn: (args: { data: Record<string, unknown> }) => unknown,
            ) => void;
            mockRestore: () => void;
        };
        createSpy.mockImplementationOnce((args) => {
            return (async () => {
                const { d4h: _linked, ...manual } = args.data;
                await originalCreate({
                    ...args,
                    data: { ...manual, id: TeamMembershipId.create() },
                });
                const raceError = new Error("Unique constraint failed on (teamId, personId)");
                Object.assign(raceError, { code: "P2002" });
                throw raceError;
            })();
        });

        const { outcomes } = await caller.executeD4HTeamSyncPlan({
            organizationId: T.org,
            planId,
            skipItemIds: [],
        });
        createSpy.mockRestore();

        expect(outcomes).toContainEqual({ itemId: "add:501", result: "applied" });
        const grace = await db.person.findFirstOrThrow({
            where: { organizationId: T.org, email: "grace@example.com" },
        });
        const memberships = await db.teamMembership.findMany({
            where: { teamId: T.team, personId: grace.id },
            include: { d4h: true },
        });
        expect(memberships).toHaveLength(1);
        expect(memberships[0]?.status).toBe("Active");
        expect(memberships[0]?.d4h?.d4hMemberId).toBe(501);
    });

    it("gives NOT_FOUND for another organization's plan", async () => {
        const { db, T, caller } = await seed();
        const otherPlan = BatchUpdatePlanId.create();
        await db.batchUpdatePlan.create({
            data: {
                id: otherPlan,
                organizationId: T.otherOrg,
                kind: "d4h-team-sync",
                targetType: "Team",
                targetId: T.team,
                status: "Pending",
                payload: {},
            },
        });

        await expect(
            caller.executeD4HTeamSyncPlan({
                organizationId: T.org,
                planId: otherPlan,
                skipItemIds: [],
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        const row = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: otherPlan } });
        expect(row.status).toBe("Pending");
    });

    it("gives CONFLICT executing the same plan twice, opening no batch for the refused run", async () => {
        const { db, T, caller, createPlan } = await seed();
        const { planId } = await createPlan();

        await caller.executeD4HTeamSyncPlan({ organizationId: T.org, planId, skipItemIds: [] });
        const batches = await db.logBatch.count();
        await expect(
            caller.executeD4HTeamSyncPlan({ organizationId: T.org, planId, skipItemIds: [] }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(await db.logBatch.count()).toBe(batches);
    });

    it("gives CONFLICT executing a plan whose team was archived since, and writes nothing", async () => {
        const { db, T, caller, createPlan } = await seed();
        const { planId } = await createPlan();
        await db.team.update({ where: { id: T.team }, data: { status: "Archived" } });

        await expect(
            caller.executeD4HTeamSyncPlan({ organizationId: T.org, planId, skipItemIds: [] }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(await db.person.findFirst({ where: { email: "grace@example.com" } })).toBeNull();
        const row = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
        expect(row.status).toBe("Pending");
    });

    it("gives BAD_REQUEST creating a plan for an archived team", async () => {
        const { db, T, caller } = await seed();
        await db.team.update({ where: { id: T.team }, data: { status: "Archived" } });

        await expect(
            caller.createD4HTeamSyncPlan({ organizationId: T.org, teamId: T.team }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    // `getConfiguredD4HAccessToken` throws `NotConfiguredError` when the org has D4H turned off or
    // the caller has no personal token (#175, #174); the client needs its message, not a 500.
    // Executing needs no token: the plan carries everything.
    it("needs a D4H token to create a plan but not to execute one", async () => {
        const { db, T, caller, createPlan } = await seed();
        const notConfigured = new NotConfiguredError(
            "D4H integration is not enabled for this organisation.",
        );
        const tokenMock = vi.mocked(getConfiguredD4HAccessToken);

        tokenMock.mockRejectedValueOnce(notConfigured);
        await expect(
            caller.createD4HTeamSyncPlan({ organizationId: T.org, teamId: T.team }),
        ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: notConfigured.message });

        const { planId } = await createPlan();
        const original = tokenMock.getMockImplementation();
        tokenMock.mockRejectedValue(notConfigured);
        try {
            await caller.executeD4HTeamSyncPlan({
                organizationId: T.org,
                planId,
                skipItemIds: [],
            });
        } finally {
            tokenMock.mockImplementation(original!);
        }
        const row = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
        expect(row.status).toBe("Completed");
    });

    it("unlinking supersedes the team's pending plan", async () => {
        const { db, T, caller, createPlan } = await seed();
        const { planId } = await createPlan();

        await caller.unlinkTeamFromD4H({ organizationId: T.org, teamId: T.team });

        const row = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: planId } });
        expect(row.status).toBe("Superseded");
        await expect(
            caller.executeD4HTeamSyncPlan({ organizationId: T.org, planId, skipItemIds: [] }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("a refused unlink has still superseded the pending plans, so none can start after it", async () => {
        const { db, T, caller, createPlan } = await seed();
        const { planId: running } = await createPlan();
        const { planId: pending } = await createPlan();
        await db.batchUpdatePlan.update({
            where: { id: running },
            data: { status: "Executing", executionStartedAt: new Date() },
        });

        await expect(
            caller.unlinkTeamFromD4H({ organizationId: T.org, teamId: T.team }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        expect(await db.team_D4H.findUnique({ where: { teamId: T.team } })).not.toBeNull();
        const row = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id: pending } });
        expect(row.status).toBe("Superseded");
    });

    it.each([
        ["stale", { executionStartedAt: new Date(Date.now() - EXECUTION_STALE_MS - 1000) }],
        ["finished", { status: "Completed" as const }],
    ])(
        "refuses to unlink while a sync is executing, then unlinks once it's %s",
        async (_, then) => {
            const { db, T, caller, createPlan } = await seed();
            const { planId } = await createPlan();
            await db.batchUpdatePlan.update({
                where: { id: planId },
                data: { status: "Executing", executionStartedAt: new Date() },
            });

            await expect(
                caller.unlinkTeamFromD4H({ organizationId: T.org, teamId: T.team }),
            ).rejects.toMatchObject({
                code: "CONFLICT",
                message: "A sync of this team is running. Try again once it finishes.",
            });
            expect(await db.team_D4H.findUnique({ where: { teamId: T.team } })).not.toBeNull();

            await db.batchUpdatePlan.update({ where: { id: planId }, data: then });
            await caller.unlinkTeamFromD4H({ organizationId: T.org, teamId: T.team });
            expect(await db.team_D4H.findUnique({ where: { teamId: T.team } })).toBeNull();
        },
    );
});

describe("teamsRouter link to D4H", () => {
    async function seed() {
        const db = createMockPrisma();
        const T = {
            org: OrganizationId.create(),
            user: nanoId16(),
            team: TeamId.create(),
        };
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: { id: T.team, organizationId: T.org, name: "Alpha", properties: {}, tags: [] },
        });
        const caller = teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["create", "update"], organization: ["view"] },
                prisma: db,
            }),
        );
        return { db, T, caller };
    }

    /** The link created nobody and no plan, and wrote the Team entry under a `d4h-team-link` batch. */
    async function expectLinkedWithoutImport(
        db: ReturnType<typeof createMockPrisma>,
        teamId: string,
    ) {
        const link = await db.team_D4H.findUniqueOrThrow({ where: { teamId } });
        expect(link.d4hTeamId).toBe(4242);
        expect(await db.person.findFirst({ where: { email: "grace@example.com" } })).toBeNull();
        expect(await db.teamMembership.count({ where: { teamId } })).toBe(0);
        expect(await db.batchUpdatePlan.count({ where: { targetId: teamId } })).toBe(0);

        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: teamId },
        });
        expect(entries.map((e) => e.action)).toEqual(["Update"]);
        const batch = await db.logBatch.findUniqueOrThrow({ where: { id: entries[0].batchId! } });
        expect(batch.operationKey).toBe("d4h-team-link");
    }

    it("linkTeamToD4H links the team and imports nobody", async () => {
        const { db, T, caller } = await seed();

        const { updated } = await caller.linkTeamToD4H({
            organizationId: T.org,
            teamId: T.team,
            d4hTeamId: 4242,
        });

        expect(updated.d4h?.d4hTeamId).toBe(4242);
        await expectLinkedWithoutImport(db, T.team);
    });
});

describe("teamsRouter.listTeamMemberships", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        zoe: PersonId.create(),
        amy: PersonId.create(),
        amyMembership: TeamMembershipId.create(),
        zoeMembership: TeamMembershipId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: {
                id: T.team,
                organizationId: T.org,
                name: "Alpha",
                description: "",
                properties: {},
                tags: [],
            },
        });
        // Seeded Zoe-before-Amy so the name ordering assertion is meaningful.
        await db.person.create({
            data: {
                id: T.zoe,
                organizationId: T.org,
                name: "Zoe Zebra",
                email: "zoe@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.person.create({
            data: {
                id: T.amy,
                organizationId: T.org,
                name: "Amy Adams",
                email: "amy@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.teamMembership.create({
            data: {
                id: T.zoeMembership,
                organizationId: T.org,
                teamId: T.team,
                personId: T.zoe,
                tags: [],
                properties: {},
                status: "Active",
                d4h: {
                    create: {
                        d4hMemberId: 77,
                        d4hStatus: "NON_OPERATIONAL",
                        d4hPosition: "Medic",
                    },
                },
            },
        });
        await db.teamMembership.create({
            data: {
                id: T.amyMembership,
                organizationId: T.org,
                teamId: T.team,
                personId: T.amy,
                tags: [],
                properties: {},
                status: "Active",
            },
        });
    });

    function makeCaller() {
        return teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns rows ordered by person name", async () => {
        const rows = await makeCaller().listTeamMemberships({
            organizationId: T.org,
            teamId: T.team,
        });

        expect(rows.map((r) => r.person.name)).toEqual(["Amy Adams", "Zoe Zebra"]);
    });

    it("includes the person email", async () => {
        const [amy] = await makeCaller().listTeamMemberships({
            organizationId: T.org,
            teamId: T.team,
        });

        expect(amy.person.email).toBe("amy@example.com");
    });

    it("maps the D4H snapshot when present and null otherwise", async () => {
        const rows = await makeCaller().listTeamMemberships({
            organizationId: T.org,
            teamId: T.team,
        });
        const byName = Object.fromEntries(rows.map((r) => [r.person.name, r]));

        expect(byName["Amy Adams"].d4h).toBeNull();
        expect(byName["Zoe Zebra"].d4h).toMatchObject({
            d4hMemberId: 77,
            d4hStatus: "NON_OPERATIONAL",
            d4hPosition: "Medic",
        });
    });
});

describe("teamsRouter.getTeamMembership", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        d4hPerson: PersonId.create(),
        manualPerson: PersonId.create(),
        strangerPerson: PersonId.create(),
        d4hMembership: TeamMembershipId.create(),
        manualMembership: TeamMembershipId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        await db.team.create({
            data: {
                id: T.team,
                organizationId: T.org,
                name: "Alpha",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.person.create({
            data: {
                id: T.d4hPerson,
                organizationId: T.org,
                name: "Dana D4H",
                email: "dana@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.person.create({
            data: {
                id: T.manualPerson,
                organizationId: T.org,
                name: "Manny Manual",
                email: "manny@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.person.create({
            data: {
                id: T.strangerPerson,
                organizationId: T.org,
                name: "Stan Stranger",
                email: "stan@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.teamMembership.create({
            data: {
                id: T.d4hMembership,
                organizationId: T.org,
                teamId: T.team,
                personId: T.d4hPerson,
                tags: [],
                properties: {},
                status: "Active",
                d4h: {
                    create: {
                        d4hMemberId: 12,
                        d4hStatus: "OPERATIONAL",
                        d4hPosition: "Lead",
                        d4hRef: "R-12",
                        d4hRoleId: 3,
                    },
                },
            },
        });
        await db.teamMembership.create({
            data: {
                id: T.manualMembership,
                organizationId: T.org,
                teamId: T.team,
                personId: T.manualPerson,
                tags: [],
                properties: {},
                status: "Active",
            },
        });
    });

    function makeCaller() {
        return teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns the row with the D4H snapshot (incl. ref / roleId)", async () => {
        const row = await makeCaller().getTeamMembership({
            organizationId: T.org,
            teamId: T.team,
            personId: T.d4hPerson,
        });

        expect(row.person).toMatchObject({ name: "Dana D4H", email: "dana@example.com" });
        expect(row.team).toMatchObject({ id: T.team, name: "Alpha" });
        expect(row.d4h).toMatchObject({
            d4hMemberId: 12,
            d4hStatus: "OPERATIONAL",
            d4hPosition: "Lead",
            d4hRef: "R-12",
            d4hRoleId: 3,
        });
    });

    it("returns d4h: null for a manually-added membership", async () => {
        const row = await makeCaller().getTeamMembership({
            organizationId: T.org,
            teamId: T.team,
            personId: T.manualPerson,
        });

        expect(row.d4h).toBeNull();
    });

    it("throws NOT_FOUND when the pair has no membership", async () => {
        await expect(
            makeCaller().getTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.strangerPerson,
            }),
        ).rejects.toThrow(/not found/i);
    });

    it("is organization-scoped", async () => {
        await expect(
            makeCaller().getTeamMembership({
                organizationId: T.otherOrg,
                teamId: T.team,
                personId: T.d4hPerson,
            }),
        ).rejects.toThrow(/not found/i);
    });

    describe("getTeamMembershipById", () => {
        it("returns the row for the membership's own id", async () => {
            const row = await makeCaller().getTeamMembershipById({
                organizationId: T.org,
                teamMembershipId: T.d4hMembership,
            });

            expect(row.id).toBe(T.d4hMembership);
            expect(row.person).toMatchObject({ name: "Dana D4H", email: "dana@example.com" });
            expect(row.team).toMatchObject({ id: T.team, name: "Alpha" });
            expect(row.d4h).toMatchObject({ d4hMemberId: 12 });
        });

        it("throws NOT_FOUND for an id with no membership", async () => {
            await expect(
                makeCaller().getTeamMembershipById({
                    organizationId: T.org,
                    teamMembershipId: TeamMembershipId.create(),
                }),
            ).rejects.toThrow(/not found/i);
        });

        it("is organization-scoped", async () => {
            await expect(
                makeCaller().getTeamMembershipById({
                    organizationId: T.otherOrg,
                    teamMembershipId: T.d4hMembership,
                }),
            ).rejects.toThrow(/not found/i);
        });
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

    it("soft-deletes a team and records a Delete log entry", async () => {
        const { created } = await makeCaller({ team: ["create"] }).createTeam({
            organizationId: T.org,
            create: { name: "Doomed", description: "", tags: [], properties: {} },
        });

        await makeCaller({ team: ["delete"] }).deleteTeam({
            organizationId: T.org,
            teamId: created.id,
        });

        const row = await db.team.findUnique({ where: { id: created.id } });
        expect(row).toMatchObject({ status: "Deleted" });
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

describe("teamsRouter.archiveTeam / restoreTeam", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        otherOrgTeam: TeamId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
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

    function makeCaller(perms: Record<string, string[]> = { team: ["update"] }) {
        return teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], ...perms },
                prisma: db,
            }),
        );
    }

    it("archives an active team and records an Archive log entry", async () => {
        const { updated } = await makeCaller().archiveTeam({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(updated.status).toBe("Archived");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: T.team, action: "Archive" },
        });
        expect(entries).toHaveLength(1);
    });

    it("is idempotent — archiving an already-archived team writes no new log entry", async () => {
        const { updated } = await makeCaller().archiveTeam({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(updated.status).toBe("Archived");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: T.team, action: "Archive" },
        });
        expect(entries).toHaveLength(1);
    });

    it("restores an archived team and records a Restore log entry", async () => {
        const { updated } = await makeCaller().restoreTeam({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(updated.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: T.team, action: "Restore" },
        });
        expect(entries).toHaveLength(1);
    });

    it("is idempotent — restoring an already-active team writes no new log entry", async () => {
        const { updated } = await makeCaller().restoreTeam({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(updated.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: T.team, action: "Restore" },
        });
        expect(entries).toHaveLength(1);
    });

    it("throws NOT_FOUND archiving a team in another organization", async () => {
        await expect(
            makeCaller().archiveTeam({ organizationId: T.org, teamId: T.otherOrgTeam }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("is forbidden without team:update permission", async () => {
        await expect(
            makeCaller({ team: ["view"] }).archiveTeam({ organizationId: T.org, teamId: T.team }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});

describe("teamsRouter.deleteTeam / recoverTeam", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        member: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: {
                id: T.team,
                organizationId: T.org,
                name: "Alpha",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.person.create({
            data: {
                id: T.member,
                organizationId: T.org,
                name: "Grace Hopper",
                email: "grace@example.com",
                tags: [],
                properties: {},
            },
        });
        await db.teamMembership.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                teamId: T.team,
                personId: T.member,
                tags: [],
                properties: {},
            },
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

    it("reports the active member count as the delete impact", async () => {
        const impact = await makeCaller({ team: ["view"] }).getTeamDeleteImpact({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(impact).toEqual({ memberCount: 1 });
    });

    it("soft-deletes the team without touching its memberships", async () => {
        await makeCaller({ team: ["delete"] }).deleteTeam({
            organizationId: T.org,
            teamId: T.team,
        });

        const team = await db.team.findUnique({ where: { id: T.team } });
        expect(team).toMatchObject({ status: "Deleted" });

        const membership = await db.teamMembership.findFirst({ where: { teamId: T.team } });
        expect(membership).toMatchObject({ status: "Active" });
    });

    it("restoreTeam (archive-restore) refuses a Deleted team", async () => {
        await expect(
            makeCaller({ team: ["update"] }).restoreTeam({ organizationId: T.org, teamId: T.team }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("recoverTeam requires team:delete, not team:update", async () => {
        await expect(
            makeCaller({ team: ["update"] }).recoverTeam({
                organizationId: T.org,
                teamId: T.team,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("recovers a deleted team back to Active and records a Recover log entry", async () => {
        const { updated } = await makeCaller({ team: ["delete"] }).recoverTeam({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(updated.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Team", objectId: T.team, action: "Recover" },
        });
        expect(entries).toHaveLength(1);
    });
});

describe("teamsRouter.deleteTeamMembership / recoverTeamMembership", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        member: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: {
                id: T.team,
                organizationId: T.org,
                name: "Alpha",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.person.create({
            data: {
                id: T.member,
                organizationId: T.org,
                name: "Grace Hopper",
                email: "grace-membership-lifecycle@example.com",
                tags: [],
                properties: {},
            },
        });
        await db.teamMembership.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                teamId: T.team,
                personId: T.member,
                tags: [],
                properties: {},
            },
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

    it("requires team:delete, not team:update, to remove a member", async () => {
        await expect(
            makeCaller({ team: ["update"] }).deleteTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.member,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("soft-deletes the membership and excludes it from listTeamMemberships", async () => {
        await makeCaller({ team: ["delete"] }).deleteTeamMembership({
            organizationId: T.org,
            teamId: T.team,
            personId: T.member,
        });

        const membership = await db.teamMembership.findFirst({ where: { teamId: T.team } });
        expect(membership).toMatchObject({ status: "Deleted" });

        const listed = await makeCaller({ team: ["view"] }).listTeamMemberships({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(listed).toHaveLength(0);
    });

    it("getTeamMembership and updateTeamMembership treat a Deleted membership as not found (#308)", async () => {
        await expect(
            makeCaller({ team: ["view"] }).getTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.member,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        await expect(
            makeCaller({ team: ["update"] }).updateTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.member,
                update: { tags: ["edited"], properties: {} },
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });

        const membership = await db.teamMembership.findFirst({ where: { teamId: T.team } });
        expect(membership?.tags).toEqual([]);
    });

    it("recoverTeamMembership requires team:delete, not team:update", async () => {
        await expect(
            makeCaller({ team: ["update"] }).recoverTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.member,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("recovers a deleted membership back to Active and records a Recover log entry", async () => {
        const { updated } = await makeCaller({ team: ["delete"] }).recoverTeamMembership({
            organizationId: T.org,
            teamId: T.team,
            personId: T.member,
        });
        expect(updated.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "TeamMembership", action: "Recover" },
        });
        expect(entries).toHaveLength(1);

        const listed = await makeCaller({ team: ["view"] }).listTeamMemberships({
            organizationId: T.org,
            teamId: T.team,
        });
        expect(listed).toHaveLength(1);
    });

    it("updateTeamMembership refuses a membership belonging to another organization", async () => {
        await expect(
            makeCaller({ team: ["update"] }).updateTeamMembership({
                organizationId: OrganizationId.create(),
                teamId: T.team,
                personId: T.member,
                update: { tags: ["edited"], properties: {} },
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("teamsRouter.listTeams", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        active: TeamId.create(),
        archived: TeamId.create(),
        deleted: TeamId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: {
                id: T.active,
                organizationId: T.org,
                name: "Active Team",
                description: "",
                properties: {},
                tags: [],
                status: "Active",
            },
        });
        await db.team.create({
            data: {
                id: T.archived,
                organizationId: T.org,
                name: "Archived Team",
                description: "",
                properties: {},
                tags: [],
                status: "Archived",
            },
        });
        await db.team.create({
            data: {
                id: T.deleted,
                organizationId: T.org,
                name: "Deleted Team",
                description: "",
                properties: {},
                tags: [],
                status: "Deleted",
            },
        });
    });

    function makeCaller() {
        return teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], team: ["view"] },
                prisma: db,
            }),
        );
    }

    it("excludes Deleted teams but includes Archived ones", async () => {
        const teams = await makeCaller().listTeams({ organizationId: T.org });
        const ids = teams.map((t) => t.id);

        expect(ids).toContain(T.active);
        expect(ids).toContain(T.archived);
        expect(ids).not.toContain(T.deleted);
    });
});

describe("teamsRouter guards against an archived team", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        person: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: {
                id: T.team,
                organizationId: T.org,
                name: "Alpha",
                properties: {},
                tags: [],
                status: "Archived",
            },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Alice Anderson",
                email: "alice@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
    });

    it("rejects adding a member to an archived team", async () => {
        const caller = teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );

        await expect(
            caller.createTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.person,
                create: { tags: [], properties: {} },
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects linking an archived team to D4H", async () => {
        const caller = teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );

        await expect(
            caller.linkTeamToD4H({ organizationId: T.org, teamId: T.team, d4hTeamId: 1 }),
        ).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message: expect.stringMatching(/archived/),
        });
        expect(await db.team_D4H.findFirst({ where: { teamId: T.team } })).toBeNull();
    });
});

describe("teamsRouter.createTeamMembership guards against a Deleted person", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        person: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: { id: T.team, organizationId: T.org, name: "Alpha", properties: {}, tags: [] },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Dora Deleted",
                email: "dora-deleted@example.com",
                tags: [],
                properties: {},
                status: "Deleted",
            },
        });
    });

    it("rejects adding a person who is in the Rubbish bin", async () => {
        const caller = teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );

        await expect(
            caller.createTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.person,
                create: { tags: [], properties: {} },
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("teamsRouter.createTeamMembership re-adding a previously-removed member", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        team: TeamId.create(),
        person: PersonId.create(),
    };

    const db = createMockPrisma();

    function caller() {
        return teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["update", "delete"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.team.create({
            data: { id: T.team, organizationId: T.org, name: "Alpha", properties: {}, tags: [] },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Alice Anderson",
                email: "alice-readd@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
    });

    it("revives the Deleted row instead of conflicting on 'already a member'", async () => {
        const { created } = await caller().createTeamMembership({
            organizationId: T.org,
            teamId: T.team,
            personId: T.person,
            create: { tags: [], properties: {} },
        });

        await caller().deleteTeamMembership({
            organizationId: T.org,
            teamId: T.team,
            personId: T.person,
        });

        const { created: readded } = await caller().createTeamMembership({
            organizationId: T.org,
            teamId: T.team,
            personId: T.person,
            create: { tags: ["core"], properties: {} },
        });

        expect(readded.id).toBe(created.id);
        expect(readded).toMatchObject({ status: "Active", tags: ["core"] });

        const rows = await db.teamMembership.findMany({
            where: { teamId: T.team, personId: T.person },
        });
        expect(rows).toHaveLength(1);
    });

    it("still rejects adding an already-Active member", async () => {
        await expect(
            caller().createTeamMembership({
                organizationId: T.org,
                teamId: T.team,
                personId: T.person,
                create: { tags: [], properties: {} },
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });
});
