/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { nanoId16 } from "@/lib/id";
import type { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { teamScopeRouter } from "./team-scope-router";

describe("teamScopeRouter", () => {
    // Dataset: one org with the "rescue" team (D4H-linked) and an unlinked "alpine" team. Grace
    // is granted both. Rescue's roster: Zara and Abe Active (Abe D4H-managed), Cleo Archived,
    // Dan Deleted, and Fay's membership Active but Fay herself Archived. Alpine's roster: Ed, to
    // show the roster is per team.
    const T = {
        org: OrganizationId.create(),
        rescue: TeamId.create(),
        alpine: TeamId.create(),
        grace: UserId.create(),
        abe: PersonId.create(),
        cleo: PersonId.create(),
        dan: PersonId.create(),
        ed: PersonId.create(),
        fay: PersonId.create(),
        zara: PersonId.create(),
        abeMembership: TeamMembershipId.create(),
        zaraMembership: TeamMembershipId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Search Org", slug: "search-org", createdAt: new Date() },
        });
        await db.user.create({
            data: { id: T.grace, name: "Grace", email: "grace@example.com" },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.grace },
        });

        for (const [id, name, slug] of [
            [T.rescue, "Rescue", "rescue"],
            [T.alpine, "Alpine", "alpine"],
        ] as const) {
            await db.team.create({
                data: {
                    id,
                    organizationId: T.org,
                    name,
                    slug,
                    description: `${name} team`,
                    tags: [],
                    properties: {},
                },
            });
            await db.teamUser.create({
                data: { id: nanoId16(), organizationId: T.org, teamId: id, userId: T.grace },
            });
        }
        await db.team_D4H.create({
            data: {
                teamId: T.rescue,
                d4hTeamId: 42,
                d4hTeamName: "D4H Rescue",
                d4hServerCode: "ap",
            },
        });

        for (const [id, name, status] of [
            [T.abe, "Abe", "Active"],
            [T.cleo, "Cleo", "Active"],
            [T.dan, "Dan", "Active"],
            [T.ed, "Ed", "Active"],
            [T.fay, "Fay", "Archived"],
            [T.zara, "Zara", "Active"],
        ] as const) {
            await db.person.create({
                data: {
                    id,
                    organizationId: T.org,
                    name,
                    status,
                    email: `${name.toLowerCase()}@example.com`,
                    tags: [],
                    properties: {},
                },
            });
        }

        for (const [id, teamId, personId, status] of [
            [T.zaraMembership, T.rescue, T.zara, "Active"],
            [T.abeMembership, T.rescue, T.abe, "Active"],
            [TeamMembershipId.create(), T.rescue, T.cleo, "Archived"],
            [TeamMembershipId.create(), T.rescue, T.dan, "Deleted"],
            [TeamMembershipId.create(), T.rescue, T.fay, "Active"],
            [TeamMembershipId.create(), T.alpine, T.ed, "Active"],
        ] as const) {
            await db.teamMembership.create({
                data: {
                    id,
                    organizationId: T.org,
                    teamId,
                    personId,
                    status,
                    tags: [],
                    properties: {},
                },
            });
        }
        await db.teamMembership_D4H.create({
            data: {
                teamMembershipId: T.abeMembership,
                d4hMemberId: 7,
                d4hStatus: "OPERATIONAL",
                d4hPosition: "Team Leader",
                d4hRef: "R07",
            },
        });
    });

    function makeCaller(permissions: Permissions = {}) {
        return teamScopeRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.grace }, permissions, prisma: db }),
        );
    }

    describe("getTeam", () => {
        it("returns the granted team with its org and D4H link", async () => {
            await expect(makeCaller().getTeam({ teamSlug: "rescue" })).resolves.toEqual({
                id: T.rescue,
                name: "Rescue",
                slug: "rescue",
                description: "Rescue team",
                organization: { id: T.org, name: "Search Org", slug: "search-org" },
                d4h: { d4hTeamId: 42, d4hTeamName: "D4H Rescue", d4hServerCode: "ap" },
            });
        });

        it("returns a null D4H link for an unlinked team", async () => {
            const team = await makeCaller().getTeam({ teamSlug: "alpine" });

            expect(team).toMatchObject({ id: T.alpine, d4h: null });
        });

        it("refuses an unknown slug with NOT_FOUND", async () => {
            await expect(makeCaller().getTeam({ teamSlug: "nowhere" })).rejects.toMatchObject({
                code: "NOT_FOUND",
            });
        });
    });

    describe("listRoster", () => {
        it("lists the team's Active memberships by person name, with D4H details when present", async () => {
            const rows = await makeCaller({ team: ["view"] }).listRoster({ teamSlug: "rescue" });

            expect(rows).toEqual([
                {
                    id: T.abeMembership,
                    person: { id: T.abe, name: "Abe" },
                    d4h: { d4hPosition: "Team Leader", d4hRef: "R07" },
                },
                {
                    id: T.zaraMembership,
                    person: { id: T.zara, name: "Zara" },
                    d4h: null,
                },
            ]);
        });

        it("leaves out an Active membership whose person isn't Active", async () => {
            const rows = await makeCaller({ team: ["view"] }).listRoster({ teamSlug: "rescue" });

            expect(rows.map((row) => row.person.id)).not.toContain(T.fay);
        });

        it("refuses a granted user without team: view with FORBIDDEN", async () => {
            await expect(makeCaller().listRoster({ teamSlug: "rescue" })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
        });
    });
});
