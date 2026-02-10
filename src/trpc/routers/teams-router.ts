/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { pick } from "remeda";
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { PersonId } from "@/lib/schemas/person";
import { TeamData, TeamId } from "@/lib/schemas/team";
import {
    TeamMembershipData,
    TeamMembershipId,
} from "@/lib/schemas/team-membership";
import { auth } from "@/server/auth";
import { revalidateTeam } from "@/server/team";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

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
     * Create a new team membership, adding a person to a team.
     * @param ctx The authenticated context.
     * @param input The team membership data, including teamId, personId, tags, and properties.
     * @returns The created team membership data.
     * @throws TRPCError(Not_FOUND) If the specified team or person does not exist within the organization.
     */
    createTeamMembership: organizationProcedure({ team: ["update"] })
        .input(
            TeamMembershipData.schema.pick({
                teamId: true,
                personId: true,
                tags: true,
                properties: true,
            }),
        )
        .output(TeamMembershipData.schema)
        .mutation(async ({ ctx, input }) => {
            const [team, person, existing] = await Promise.all([
                ctx.prisma.team.findUnique({
                    where: {
                        id: input.teamId,
                        organizationId: ctx.organizationId,
                    },
                }),
                ctx.prisma.person.findUnique({
                    where: {
                        id: input.personId,
                        organizationId: ctx.organizationId,
                    },
                }),
                ctx.prisma.teamMembership.findFirst({
                    where: {
                        teamId: input.teamId,
                        personId: input.personId,
                    },
                }),
            ]);

            if (!team) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(input.teamId),
                });
            }

            if (!person) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(input.personId),
                });
            }

            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `Person(${input.personId}) is already a member of Team(${input.teamId}).`,
                });
            }

            const teamMembershipId = TeamMembershipId.create();

            const [created] = await Promise.all([
                ctx.prisma.teamMembership.create({
                    data: {
                        id: teamMembershipId,
                        organizationId: ctx.organizationId,
                        teamId: input.teamId,
                        personId: input.personId,
                        tags: input.tags,
                        properties: input.properties,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "TeamMembership",
                    objectId: teamMembershipId,
                    changes: diffObject({}, input),
                }),
            ]);

            return TeamMembershipData.fromRecord(created);
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
            await Promise.all([
                await auth.api.removeTeam({
                    body: {
                        teamId: input.teamId,
                        organizationId: ctx.organizationId,
                    },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "Team",
                    objectId: input.teamId,
                }),
            ]);
        }),

    /**
     * Delete a team membership, removing a person from a team.
     * @param ctx The authenticated context.
     * @param personId The ID of the person to remove from the team.
     * @param teamId The ID of the team to remove the person from.
     * @throws TRPCError(Not_FOUND) If the specified team membership does not exist within the organization.
     */
    deleteTeamMembership: organizationProcedure({ team: ["update"] })
        .input(z.object({ personId: PersonId.schema, teamId: TeamId.schema }))
        .mutation(async ({ ctx, input: { personId, teamId } }) => {
            const existing = await ctx.prisma.teamMembership.findUnique({
                where: {
                    organizationId: ctx.organizationId,
                    teamId_personId: {
                        teamId,
                        personId,
                    },
                },
                select: { id: true },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamMembershipNotFound({
                        teamId,
                        personId,
                    }),
                });
            }

            await Promise.all([
                ctx.prisma.teamMembership.delete({
                    where: {
                        organizationId: ctx.organizationId,
                        teamId_personId: {
                            teamId,
                            personId,
                        },
                    },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "TeamMembership",
                    objectId: `${teamId}_${personId}`,
                }),
            ]);
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
     * List team memberships, optionally filtered by teamId or personId.
     * @param ctx The authenticated context.
     * @param personId The optional ID of the person to filter memberships by.
     * @param teamId The optional ID of the team to filter memberships by.
     * @returns An array of team memberships matching the specified filters.
     */
    listTeamMemberships: organizationProcedure({ team: ["view"] })
        .input(
            z.object({
                personId: PersonId.schema.optional(),
                teamId: TeamId.schema.optional(),
            }),
        )
        .output(z.array(TeamMembershipData.schema))
        .query(async ({ ctx, input: { organizationId, personId, teamId } }) => {
            const teamMembershipRecords =
                await ctx.prisma.teamMembership.findMany({
                    where: {
                        organizationId,
                        personId,
                        teamId,
                    },
                });

            return teamMembershipRecords.map(TeamMembershipData.fromRecord);
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

    /**
     * Update a team membership, modifying the tags or properties of a person's membership in a team.
     * @param teamId The ID of the team membership to update.
     * @param personId The ID of the person whose team membership is being updated.
     * @param update The fields to update on the team membership (tags and/or properties).
     * @returns The updated team membership data.
     * @throws TRPCError(Not_FOUND) If the team membership does not exist.
     */
    updateTeamMembership: organizationProcedure({ team: ["update"] })
        .input(
            z.object({
                teamId: TeamId.schema,
                personId: PersonId.schema,
                update: TeamMembershipData.schema.pick({
                    tags: true,
                    properties: true,
                }),
            }),
        )
        .output(TeamMembershipData.schema)
        .mutation(async ({ ctx, input: { teamId, personId, update } }) => {
            const existing = await ctx.prisma.teamMembership.findUnique({
                where: {
                    teamId_personId: {
                        teamId,
                        personId,
                    },
                },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamMembershipNotFound({
                        teamId,
                        personId,
                    }),
                });
            }

            const diff = diffObject(
                TeamMembershipData.schema.parse(existing),
                update,
            );

            if (diff.length == 0)
                return TeamMembershipData.fromRecord(existing);

            const [updated] = await Promise.all([
                // Apply the changes
                ctx.prisma.teamMembership.update({
                    where: {
                        teamId_personId: {
                            teamId,
                            personId,
                        },
                    },
                    data: { ...update },
                }),
                // Record an event for the update
                ctx.logEvent({
                    action: "Update",
                    objectType: "TeamMembership",
                    objectId: `${teamId}_${personId}`,
                    changes: diff,
                }),
            ]);

            return TeamMembershipData.fromRecord(updated);
        }),
});
