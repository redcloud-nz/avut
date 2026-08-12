/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// teams-router reaches @/server/auth at import time. The procedures under test only touch
// ctx.prisma (the injected mock), so stubbing server-only is enough to let the module load
// under jsdom.
vi.mock("server-only", () => ({}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
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
