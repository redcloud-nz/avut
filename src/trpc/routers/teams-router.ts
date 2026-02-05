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
import { TeamMembershipData } from "@/lib/schemas/team-membership";
import { PersonData } from "@/lib/schemas/person";

export const teamsRouter = createTrpcRouter({
    /**
     * Create a new team in the organization.
     */
    createTeam: organizationProcedure({ team: ["create"] })
        .input(
            z.object({
                team: TeamData.modifiableSchema,
            }),
        )
        .output(TeamData.schema)
        .mutation(async ({ ctx, input: { organizationId, team } }) => {
            // Create the team via the auth API
            const data = await auth.api.createTeam({
                body: {
                    name: team.name,
                    organizationId,
                },
            });

            const changes = diffObject({}, team);

            const [createdTeam] = await Promise.all([
                // Update additional fields
                ctx.prisma.team.update({
                    where: { organizationId: organizationId, id: data.id },
                    data: pick(team, ["description", "tags", "properties"]),
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "Team",
                    objectId: data.id,
                    changes,
                }),
            ]);

            return TeamData.fromRecord(createdTeam);
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
    getTeam: organizationProcedure({ team: ["view"] })
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
     * List all members of a team.
     * @param ctx The authenticated context.
     * @param teamId The ID of the team to list members for.
     * @returns An array of team memberships, including person data.
     * @throws TRPCError(Not_FOUND) If the team does not exist within the organization.
     */
    listTeamMembers: organizationProcedure({ team: ["view"] })
        .input(z.object({ teamId: TeamId.schema }))
        .output(
            z.array(
                TeamMembershipData.schema.extend({ person: PersonData.schema }),
            ),
        )
        .query(async ({ ctx, input: { teamId } }) => {
            const [team, memberships] = await Promise.all([
                ctx.prisma.team.findUnique({
                    where: {
                        id: teamId,
                        organizationId: ctx.organizationId,
                    },
                    select: { id: true },
                }),
                ctx.prisma.teamMembership.findMany({
                    where: {
                        teamId,
                    },
                    include: {
                        person: true,
                    },
                }),
            ]);

            if (!team)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });

            return memberships.map((membership) => ({
                ...TeamMembershipData.fromRecord(membership),
                person: PersonData.fromRecord(membership.person),
            }));
        }),

    /**
     * List all teams in the organization.
     */
    listTeams: organizationProcedure({ team: ["view"] })
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
     * @param teamId The ID of the team to update.
     * @param update The fields to update on the team.
     * @returns The updated team data.
     * @throws TRPCError(Not_FOund) If the team does not exist.
     */
    updateTeam: organizationProcedure({ team: ["update"] })
        .input(
            z.object({
                teamId: TeamId.schema,
                update: TeamData.modifiableSchema,
            }),
        )
        .output(TeamData.schema)
        .mutation(async ({ ctx, input: { teamId, update } }) => {
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

            const diff = diffObject(
                TeamData.modifiableSchema.parse(existingTeam),
                update,
            );

            if (diff.length == 0) return TeamData.fromRecord(existingTeam); // No changes

            const [updated] = await Promise.all([
                // Apply the changes
                ctx.prisma.team.update({
                    where: { organizationId: ctx.organizationId, id: teamId },
                    data: { ...update },
                }),
                // Record an event for the update
                ctx.logEvent({
                    action: "Update",
                    objectType: "Team",
                    objectId: teamId,
                    changes: diff,
                }),
            ]);

            // Clear cached data
            await revalidateTeam(teamId);

            return TeamData.fromRecord(updated);
        }),
});
