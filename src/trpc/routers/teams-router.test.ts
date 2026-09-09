/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// teams-router reaches @/server/auth at import time. The procedures under test only touch
// ctx.prisma (the injected mock), so stubbing server-only is enough to let the module load
// under jsdom.
vi.mock("server-only", () => ({}));

// syncronizeD4HTeam calls neither auth.api.createTeam nor anything else requiring a
// behavioral @/server/auth mock — only getPersonalD4HAccessTokenForUser and
// getD4HTeam/getD4HFetchClient, which is why those two are stubbed here (same pattern as
// d4h-access-tokens-router.test.ts) rather than a live D4H client.
vi.mock("@/server/d4h-api/client", () => ({
    getD4HFetchClient: vi.fn(() => ({
        GET: vi.fn(async () => ({
            data: {
                results: [
                    {
                        id: 501,
                        resourceType: "Member",
                        email: { value: "grace@example.com", verified: true },
                        name: "Grace Hopper",
                        owner: { id: 4242, resourceType: "Team" },
                        position: null,
                        ref: null,
                        role: { id: null, resourceType: "Role" },
                        status: "OPERATIONAL",
                    },
                ],
                page: 1,
                pageSize: 50,
                totalSize: 1,
            },
            error: undefined,
        })),
    })),
    getD4HTokenMetadata: vi.fn(async () => ({
        d4HTeams: [{ id: 4242, resourceType: "Team", title: "Alpha D4H" }],
        d4HOrganisations: [],
    })),
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

describe("teamsRouter.syncronizeD4HTeam — batching", () => {
    it("stamps every log entry from one run with the same LogBatch", async () => {
        const db = createMockPrisma();
        const T = {
            org: OrganizationId.create(),
            user: nanoId16(),
            team: TeamId.create(),
            // A person/membership already in our system whose D4H membership has been
            // removed — d4hMemberId 999 never appears among the mocked D4H members
            // (id 501), so this triggers the TeamMembership-Delete branch.
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
                properties: { d4hTeamId: 4242 },
                tags: [],
            },
        });
        // The `d4h` relation is what `getTeam` checks to confirm the team is linked —
        // separate from `properties.d4hTeamId`, which `syncronizeD4HTeam` reads directly.
        await db.team_D4H.create({
            data: {
                teamId: T.team,
                d4hTeamId: 4242,
                d4hTeamName: "Alpha D4H",
                d4hServer: "us",
                d4hLastSyncedAt: null,
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
            },
        });
        await db.teamMembership.create({
            data: {
                id: T.departedMembership,
                organizationId: T.org,
                teamId: T.team,
                personId: T.departedPerson,
                tags: [],
                properties: { d4hMemberId: 999 },
            },
        });

        const caller = teamsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { team: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );

        await caller.syncronizeD4HTeam({ organizationId: T.org, teamId: T.team });

        // Sanity check the wiring actually did what the fixture set it up to do: a
        // departed member removed, a new one (from D4H member id 501, "grace@example.com")
        // created via `createPerson`, and the team's `d4hLastSync` bumped.
        expect(
            await db.teamMembership.findUnique({
                where: { teamId_personId: { teamId: T.team, personId: T.departedPerson } },
            }),
        ).toBeNull();
        const newPerson = await db.person.findFirst({
            where: { organizationId: T.org, email: "grace@example.com" },
        });
        expect(newPerson).not.toBeNull();
        expect(
            await db.teamMembership.findFirst({
                where: { teamId: T.team, personId: newPerson!.id },
            }),
        ).not.toBeNull();

        const entries = await db.logEntry.findMany({ where: { organizationId: T.org } });

        // One TeamMembership-Delete, one Person-Create, one TeamMembership-Create, one
        // Team-Update — a wiring change that silently drops one of these must fail here.
        expect(entries).toHaveLength(4);
        expect(entries.map((e) => e.objectType).sort()).toEqual(
            ["Person", "Team", "TeamMembership", "TeamMembership"].sort(),
        );

        const batchIds = new Set(entries.map((e) => e.batchId));
        expect(batchIds.size).toBe(1);
        const [batchId] = batchIds;
        expect(batchId).not.toBeNull();

        const batch = await db.logBatch.findUnique({ where: { id: batchId! } });
        expect(batch).toMatchObject({
            operationKey: "d4h-team-sync",
            userId: T.user,
        });
    });
});
