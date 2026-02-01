/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { pick } from "remeda";
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { TeamData, TeamId } from "@/lib/schemas/team";
import { auth } from "@/server/auth";
import { revalidateTeam } from "@/server/team";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const teamsRouter = createTrpcRouter({
    /**
     * Create a new team in the organization.
     */
    createTeam: organizationProcedure({ team: ["create"] })
        .input(TeamData.modifiableSchema)
        .output(TeamData.schema)
        .mutation(async ({ ctx, input: { organizationId, ...team } }) => {
            // Create the team via the auth API
            const data = await auth.api.createTeam({
                body: {
                    name: team.name,
                    organizationId,
                },
            });

            // Update additional fields
            const updatedTeam = await ctx.prisma.team.update({
                where: { organizationId: organizationId, id: data.id },
                data: pick(team, ["description", "tags", "properties"]),
            });

            const changes = diffObject({}, team);

            await ctx.logEvent({
                action: "Create",
                objectType: "Team",
                objectId: data.id,
                changes,
            });

            return TeamData.fromRecord(updatedTeam);
        }),

    /**
     * Delete a team from the organization.
     */
    deleteTeam: organizationProcedure({ team: ["delete"] })
        .input(
            z.object({
                teamId: TeamId.schema,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            await auth.api.removeTeam({
                body: {
                    teamId: input.teamId,
                    organizationId: ctx.organizationId,
                },
            });
        }),

    /**
     * Retrieve a team by its ID.
     */
    getTeam: organizationProcedure()
        .input(z.object({ teamId: TeamId.schema }))
        .output(TeamData.schema)
        .query(async ({ input, ctx }) => {
            const teamRecord = await ctx.prisma.team.findUnique({
                where: {
                    id: input.teamId,
                    organizationId: ctx.organizationId,
                },
            });

            if (!teamRecord)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(input.teamId),
                });

            return TeamData.fromRecord(teamRecord);
        }),

    /**
     * List all teams in the organization.
     */
    listTeams: organizationProcedure()
        .output(z.array(TeamData.schema))
        .query(async ({ ctx }) => {
            const teamRecords = await ctx.prisma.team.findMany({
                where: {
                    organizationId: ctx.organizationId,
                },
            });

            return teamRecords.map(TeamData.fromRecord);
        }),

    /**
     * Update an existing team.
     * @param input The team data to update.
     * @returns The updated team data.
     * @throws TRPCError(Not_FOund) If the team does not exist.
     */
    updateTeam: organizationProcedure({ team: ["update"] })
        .input(TeamData.modifiableSchema.extend({ teamId: TeamId.schema }))
        .output(TeamData.schema)
        .mutation(
            async ({ ctx, input: { teamId, organizationId, ...update } }) => {
                const existingTeam = await ctx.prisma.team.findUnique({
                    where: {
                        id: teamId,
                        organizationId: ctx.organizationId,
                    },
                });

                if (!existingTeam)
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.teamNotFound(teamId),
                    });

                const changes = diffObject(
                    TeamData.modifiableSchema.parse(existingTeam),
                    update,
                );

                if (changes.length == 0)
                    return TeamData.fromRecord(existingTeam); // No changes

                const updated = await ctx.prisma.team.update({
                    where: { organizationId: ctx.organizationId, id: teamId },
                    data: { ...update },
                });

                await ctx.logEvent({
                    action: "Update",
                    objectType: "Team",
                    objectId: teamId,
                    changes,
                });

                // Clear cached data
                await revalidateTeam(teamId);

                return TeamData.fromRecord(updated);
            },
        ),
});
