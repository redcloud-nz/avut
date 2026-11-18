/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { nanoId16 } from "@/lib/id";
import type { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { teamUsersRouter } from "./team-users-router";

// `organizationProcedure` always folds in `organization: ["view"]`, and the mock's
// `hasPermission` checks statements literally, so each fixture spells out its grants.
const MEMBER: Permissions = { organization: ["view"], member: ["view"] };
const ADMIN: Permissions = { organization: ["view"], member: ["view", "update"] };

describe("teamUsersRouter", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        team: TeamId.create(),
        archivedTeam: TeamId.create(),
        outsiderTeam: TeamId.create(),
        admin: UserId.create(),
        member: UserId.create(),
        alice: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const [id, name] of [
            [T.admin, "Admin"],
            [T.member, "Member"],
            [T.alice, "Alice"],
        ] as const) {
            await db.user.create({
                data: { id, name, email: `${name.toLowerCase()}@example.com` },
            });
            await db.organizationUser.create({
                data: { id: nanoId16(), organizationId: T.org, userId: id },
            });
        }
        for (const [id, organizationId, name, status] of [
            [T.team, T.org, "Rescue", "Active"],
            [T.archivedTeam, T.org, "Alpine", "Archived"],
            [T.outsiderTeam, T.otherOrg, "Outsider", "Active"],
        ] as const) {
            await db.team.create({
                data: { id, organizationId, name, status, tags: [], properties: {} },
            });
        }
    });

    function makeCaller(userId: UserId, permissions: Permissions) {
        return teamUsersRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: userId }, permissions, prisma: db }),
        );
    }

    describe("permissions", () => {
        it("refuses grantTeamAccess without member: update", async () => {
            await expect(
                makeCaller(T.member, MEMBER).grantTeamAccess({
                    organizationId: T.org,
                    teamId: T.team,
                    userId: T.member,
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("refuses revokeTeamAccess without member: update", async () => {
            await expect(
                makeCaller(T.member, MEMBER).revokeTeamAccess({
                    organizationId: T.org,
                    teamId: T.team,
                    userId: T.member,
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });
    });

    describe("grant, list and revoke", () => {
        it("lets an admin grant access, shown in both lists", async () => {
            await makeCaller(T.admin, ADMIN).grantTeamAccess({
                organizationId: T.org,
                teamId: T.team,
                userId: T.alice,
            });

            const teamUsers = await makeCaller(T.member, MEMBER).listTeamUsers({
                organizationId: T.org,
                teamId: T.team,
            });
            expect(teamUsers.map((row) => row.userId)).toEqual([T.alice]);

            const userTeams = await makeCaller(T.member, MEMBER).listUserTeams({
                organizationId: T.org,
                userId: T.alice,
            });
            expect(userTeams.map((row) => row.team.id)).toEqual([T.team]);

            const grantable = await makeCaller(T.member, MEMBER).listGrantableUsers({
                organizationId: T.org,
                teamId: T.team,
            });
            expect(grantable.map((row) => row.id)).toEqual([T.admin, T.member]);
        });

        it("maps a repeat grant to CONFLICT", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).grantTeamAccess({
                    organizationId: T.org,
                    teamId: T.team,
                    userId: T.alice,
                }),
            ).rejects.toMatchObject({ code: "CONFLICT" });
        });

        it("lets an admin revoke access", async () => {
            await makeCaller(T.admin, ADMIN).revokeTeamAccess({
                organizationId: T.org,
                teamId: T.team,
                userId: T.alice,
            });

            const teamUsers = await makeCaller(T.member, MEMBER).listTeamUsers({
                organizationId: T.org,
                teamId: T.team,
            });
            expect(teamUsers).toEqual([]);
        });
    });

    describe("domain errors", () => {
        it("maps an archived team to CONFLICT", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).grantTeamAccess({
                    organizationId: T.org,
                    teamId: T.archivedTeam,
                    userId: T.alice,
                }),
            ).rejects.toMatchObject({ code: "CONFLICT" });
        });

        it("maps a team in another organization to NOT_FOUND", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).grantTeamAccess({
                    organizationId: T.org,
                    teamId: T.outsiderTeam,
                    userId: T.alice,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            await expect(
                makeCaller(T.member, MEMBER).listTeamUsers({
                    organizationId: T.org,
                    teamId: T.outsiderTeam,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            await expect(
                makeCaller(T.member, MEMBER).listGrantableUsers({
                    organizationId: T.org,
                    teamId: T.outsiderTeam,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("maps revoking a grant that doesn't exist to NOT_FOUND", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).revokeTeamAccess({
                    organizationId: T.org,
                    teamId: T.team,
                    userId: T.member,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });
    });
});
