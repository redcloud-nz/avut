/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TeamId } from "@/lib/schemas/team";
import { TeamUserData } from "@/lib/schemas/team-user";
import { UserId } from "@/lib/schemas/user";
import * as TeamUsers from "@/server/services/team-users";

import { createTrpcRouter, organizationProcedure } from "../init";

/**
 * Team access grants (`TeamUser`): which members of the organization may use a team's scope.
 * Viewing takes `member: ["view"]`, and granting or revoking takes `member: ["update"]`, the
 * same permissions as managing the organization's users.
 */
export const teamUsersRouter = createTrpcRouter({
    /**
     * Grant a member access to one of the organization's teams.
     * @throws TRPCError(NOT_FOUND) if the team isn't in the organization, or the user isn't an
     * (undeleted) member of it.
     * @throws TRPCError(CONFLICT) if the team isn't Active, or the user already has access.
     */
    grantTeamAccess: organizationProcedure({ member: ["update"] })
        .input(z.object({ teamId: TeamId.schema, userId: UserId.schema }))
        .output(z.void())
        .mutation(async ({ ctx, input: { teamId, userId } }) => {
            await TeamUsers.grant(ctx, teamId, userId);
        }),

    /**
     * The users granted access to a team.
     * @throws TRPCError(NOT_FOUND) if the team isn't in the organization.
     */
    listTeamUsers: organizationProcedure({ member: ["view"] })
        .input(z.object({ teamId: TeamId.schema }))
        .output(z.array(TeamUserData.teamGrantSchema))
        .query(async ({ ctx, input: { teamId } }) => {
            return await TeamUsers.listForTeam(ctx, teamId);
        }),

    /** The teams a user has been granted access to in the organization. */
    listUserTeams: organizationProcedure({ member: ["view"] })
        .input(z.object({ userId: UserId.schema }))
        .output(z.array(TeamUserData.userGrantSchema))
        .query(async ({ ctx, input: { userId } }) => {
            return await TeamUsers.listForUser(ctx, userId);
        }),

    /**
     * Revoke a user's access to a team.
     * @throws TRPCError(NOT_FOUND) if the user has no access to the team.
     */
    revokeTeamAccess: organizationProcedure({ member: ["update"] })
        .input(z.object({ teamId: TeamId.schema, userId: UserId.schema }))
        .output(z.void())
        .mutation(async ({ ctx, input: { teamId, userId } }) => {
            await TeamUsers.revoke(ctx, teamId, userId);
        }),
});
