/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { pick } from "remeda";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { PersonData, PersonId, PersonRef } from "@/lib/schemas/person";
import { TeamData, TeamId, TeamRef } from "@/lib/schemas/team";
import { TeamMembershipData, TeamMembershipId } from "@/lib/schemas/team-membership";
import { auth } from "@/server/auth";
import { getPersonalD4HAccessTokenForUser } from "@/server/d4h-access-token";
import { D4HListResponse, getD4HFetchClient, getD4HTokenMetadata } from "@/server/d4h-api/client";

import { AuthenticatedOrganizationContext, createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

import { createPerson, getPersonByEmail } from "./personnel-router";

export const teamsRouter = createTrpcRouter({
    /**
     * Create a new team in the organization.
     */
    createTeam: organizationProcedure({ team: ["create"] })
        .input(
            z.object({
                create: TeamData.modifiableSchema,
            }),
        )
        .output(
            z.object({
                created: TeamData.schema,
            }),
        )
        .mutation(async ({ ctx, input: { organizationId, create } }) => {
            // Create the team via the auth API
            const data = await auth.api.createTeam({
                body: {
                    name: create.name,
                    organizationId,
                },
            });

            const changes = diffObject({}, create);

            const [createdTeam] = await Promise.all([
                // Update additional fields
                ctx.prisma.team.update({
                    where: { organizationId: organizationId, id: data.id },
                    data: pick(create, ["description", "tags", "properties"]),
                    include: {
                        d4h: true,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "Team",
                    objectId: data.id,
                    changes,
                }),
            ]);

            return { created: TeamData.fromRecord(createdTeam) };
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
            z.object({
                teamId: TeamId.schema,
                personId: PersonId.schema,
                create: TeamMembershipData.modifiableSchema,
            }),
        )
        .output(
            z.object({
                created: TeamMembershipData.schema.extend({
                    person: PersonRef.schema,
                    team: TeamRef.schema,
                }),
            }),
        )
        .mutation(async ({ ctx, input: { teamId, personId, create } }) => {
            const [team, person, existing] = await Promise.all([
                ctx.prisma.team.findUnique({
                    where: {
                        id: teamId,
                        organizationId: ctx.organizationId,
                    },
                }),
                ctx.prisma.person.findUnique({
                    where: {
                        id: personId,
                        organizationId: ctx.organizationId,
                    },
                }),
                ctx.prisma.teamMembership.findFirst({
                    where: {
                        teamId: teamId,
                        personId: personId,
                    },
                }),
            ]);

            if (!team) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });
            }

            if (!person) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(personId),
                });
            }

            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `Person(${personId}) is already a member of Team(${teamId}).`,
                });
            }

            const teamMembershipId = TeamMembershipId.create();

            const [created] = await Promise.all([
                ctx.prisma.teamMembership.create({
                    data: {
                        id: teamMembershipId,
                        organizationId: ctx.organizationId,
                        teamId,
                        personId,
                        tags: create.tags,
                        properties: create.properties,
                    },
                    include: {
                        person: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        team: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "TeamMembership",
                    objectId: teamMembershipId,
                    changes: diffObject({}, create),
                }),
            ]);

            return {
                created: {
                    ...TeamMembershipData.fromRecord(created),
                    person: PersonRef.schema.parse(created.person),
                    team: TeamRef.schema.parse(created.team),
                },
            };
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
        .mutation(async ({ input: { teamId }, ctx }) => {
            await Promise.all([
                await auth.api.removeTeam({
                    body: {
                        teamId,
                        organizationId: ctx.organizationId,
                    },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "Team",
                    objectId: teamId,
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
        .input(
            z.object({
                personId: PersonId.schema,
                teamId: TeamId.schema,
            }),
        )
        .mutation(async ({ ctx, input: { personId, teamId } }) => {
            const [team, existing] = await Promise.all([
                ctx.prisma.team.findUnique({
                    where: {
                        organizationId: ctx.organizationId,
                        id: teamId,
                    },
                    select: { id: true },
                }),
                ctx.prisma.teamMembership.findUnique({
                    where: {
                        organizationId: ctx.organizationId,
                        teamId_personId: {
                            teamId,
                            personId,
                        },
                    },
                    select: { id: true },
                }),
            ]);

            if (!team) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });
            }

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
     * Get a team by ID.
     * @param teamId The ID of the team to retrieve.
     * @returns The team.
     * @throws TRPCError(NOT_FOUND) if the team does not exist within the organization.
     */
    getTeam: organizationProcedure({ team: ["view"] })
        .input(z.object({ teamId: TeamId.schema }))
        .output(TeamData.schema)
        .query(async ({ ctx, input: { teamId } }) => {
            // `getTeam` here is the module-scoped helper below, not this procedure —
            // object keys are not in lexical scope.
            const team = await getTeam(ctx, teamId);

            if (!team) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });
            }

            return team;
        }),

    /**
     * Import a team from D4H, creating a new team in the organization that is linked to an existing team in D4H.
     * @deprecated
     */
    importTeamFromD4H: organizationProcedure({ team: ["create"] })
        .input(
            z.object({
                create: TeamData.modifiableSchema,
                d4hTeamId: z.number(),
            }),
        )
        .output(z.object({ created: TeamData.schema }))
        .mutation(async ({ ctx, input: { create, d4hTeamId } }) => {
            const accessToken = await getPersonalD4HAccessTokenForUser(
                ctx.organizationId,
                ctx.userId,
            );
            if (!accessToken)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No personal D4H Access Token found for user",
                });

            const d4hTeam = await getD4HTeam(accessToken, d4hTeamId);

            const data = await auth.api.createTeam({
                body: {
                    name: create.name,
                    organizationId: ctx.organizationId,
                },
            });

            const changes = diffObject({}, { ...create, properties: { d4hTeamId } });

            const [createdTeam] = await Promise.all([
                // Update additional fields
                ctx.prisma.team.update({
                    where: { organizationId: ctx.organizationId, id: data.id },
                    data: {
                        description: create.description,
                        tags: create.tags,

                        properties: {
                            d4hTeamId,
                            d4hTeamName: d4hTeam.title,
                            d4hServer: accessToken.serverCode,
                            d4hLastSync: new Date().toISOString(),
                            ...create.properties,
                        },
                    },
                    include: {
                        d4h: true,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "Team",
                    objectId: data.id,
                    changes,
                }),
            ]);

            const personnel = await Promise.all(
                d4hTeam.members.map(async (member) => {
                    const existingPerson = await getPersonByEmail(ctx, member.email.value);
                    if (existingPerson) return { member, person: existingPerson };

                    const { created: newPerson } = await createPerson(ctx, PersonId.create(), {
                        name: member.name,
                        email: member.email.value,
                        tags: [],
                        properties: {
                            d4hId: member.id,
                        },
                    });
                    return { member, person: newPerson };
                }),
            );

            await Promise.all(
                personnel.flatMap(({ member, person }) => {
                    const teamMembershipId = TeamMembershipId.create();

                    const memberCreate = {
                        teamId: createdTeam.id,
                        personId: person.id,
                        tags: [],
                        properties: {
                            d4hMemberId: member.id,
                        },
                    };

                    return [
                        ctx.prisma.teamMembership.create({
                            data: {
                                id: teamMembershipId,
                                organizationId: ctx.organizationId,
                                ...memberCreate,
                            },
                        }),
                        ctx.logEvent({
                            action: "Create",
                            objectType: "TeamMembership",
                            objectId: teamMembershipId,
                            changes: diffObject({}, memberCreate),
                        }),
                    ];
                }),
            );

            return { created: TeamData.fromRecord(createdTeam) };
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
                include: {
                    d4h: true,
                },
                orderBy: {
                    name: "asc",
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
        .output(
            z.array(
                TeamMembershipData.schema.extend({
                    team: TeamData.schema.pick({ id: true, name: true }),
                    person: PersonData.schema.pick({ id: true, name: true }),
                }),
            ),
        )
        .query(async ({ ctx, input: { organizationId, personId, teamId } }) => {
            const teamMembershipRecords = await ctx.prisma.teamMembership.findMany({
                where: {
                    organizationId,
                    personId,
                    teamId,
                },
                include: {
                    team: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    person: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            return teamMembershipRecords.map((record) => ({
                ...TeamMembershipData.fromRecord(record),
                team: record.team,
                person: record.person,
            }));
        }),

    syncronizeD4HTeam: organizationProcedure({ team: ["update"] })
        .input(z.object({ teamId: TeamId.schema }))
        .mutation(async ({ ctx, input: { teamId } }) => {
            const team = await getTeam(ctx, teamId);

            if (!team)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });

            if (team.d4h == null)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Team is not linked to D4H",
                });

            const members = (
                await ctx.prisma.teamMembership.findMany({
                    where: {
                        teamId,
                        organizationId: ctx.organizationId,
                    },
                })
            ).map(TeamMembershipData.fromRecord);

            const accessToken = await getPersonalD4HAccessTokenForUser(
                ctx.organizationId,
                ctx.userId,
            );
            if (!accessToken)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No personal D4H Access Token found for user",
                });

            const d4hTeam = await getD4HTeam(accessToken, team.properties.d4hTeamId);

            // Find members that are in our system but have been removed.
            for (const member of members) {
                const d4hMember = d4hTeam.members.find(
                    (m) => m.id === member.properties.d4hMemberId,
                );
                if (!d4hMember) {
                    await ctx.prisma.teamMembership.delete({
                        where: {
                            teamId_personId: {
                                teamId,
                                personId: member.personId,
                            },
                        },
                    });
                    await ctx.logEvent({
                        action: "Delete",
                        objectType: "TeamMembership",
                        objectId: `${teamId}_${member.personId}`,
                        description: `Member ${member.personId} removed from team as they are no longer in the linked D4H team.`,
                    });
                }
            }

            for (const d4hMember of d4hTeam.members) {
                const member = members.find((m) => m.properties.d4hMemberId === d4hMember.id);
                if (!member) {
                    // This member is in D4H but not in our system, add them.
                    let person = await getPersonByEmail(ctx, d4hMember.email.value);
                    if (!person) {
                        const { created: newPerson } = await createPerson(ctx, PersonId.create(), {
                            name: d4hMember.name,
                            email: d4hMember.email.value,
                            tags: [],
                            properties: {
                                d4hId: d4hMember.id,
                            },
                        });
                        person = newPerson;
                    }

                    const teamMembershipId = TeamMembershipId.create();

                    const memberCreate = {
                        teamId,
                        personId: person.id,
                        tags: [],
                        properties: {
                            d4hMemberId: d4hMember.id,
                        },
                    };

                    await ctx.prisma.teamMembership.create({
                        data: {
                            id: teamMembershipId,
                            organizationId: ctx.organizationId,
                            ...memberCreate,
                        },
                    });
                    await ctx.logEvent({
                        action: "Create",
                        objectType: "TeamMembership",
                        objectId: teamMembershipId,
                        description: `Member ${person.id} added to team as they are in the linked D4H team but not in our system.`,
                        changes: diffObject({}, memberCreate),
                    });
                }
            }

            // Update the last sync time
            await ctx.prisma.team.update({
                where: { organizationId: ctx.organizationId, id: teamId },
                data: {
                    properties: {
                        ...team.properties,
                        d4hLastSync: new Date().toISOString(),
                    },
                },
            });
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
        .output(
            z.object({
                updated: TeamData.schema,
            }),
        )
        .mutation(async ({ ctx, input: { teamId, update } }) => {
            const existingTeam = await getTeam(ctx, teamId);

            if (!existingTeam)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });

            const diff = diffObject(TeamData.modifiableSchema.parse(existingTeam), update);

            if (diff.length == 0) return { updated: existingTeam }; // No changes

            const [updated] = await Promise.all([
                // Apply the changes
                ctx.prisma.team.update({
                    where: { organizationId: ctx.organizationId, id: teamId },
                    data: { ...update },
                    include: {
                        d4h: true,
                    },
                }),
                // Record an event for the update
                ctx.logEvent({
                    action: "Update",
                    objectType: "Team",
                    objectId: teamId,
                    changes: diff,
                }),
            ]);

            return { updated: TeamData.fromRecord(updated) };
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
        .output(
            z.object({
                updated: TeamMembershipData.schema,
            }),
        )
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

            const diff = diffObject(TeamMembershipData.schema.parse(existing), update);

            if (diff.length == 0) return { updated: TeamMembershipData.fromRecord(existing) };

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

            return { updated: TeamMembershipData.fromRecord(updated) };
        }),
});

/**
 * Utility function to fetch a D4H team and its members using a user's access token, ensuring the team is accessible with the token.
 * @param accessToken The user's D4H access token.
 * @param d4hTeamId The ID of the D4H team to fetch.
 * @returns The D4H team and its members.
 * @throws TRPCError(Not_FOUND) If the D4H team is not found or not accessible with the user's token.
 * @throws TRPCError(INTERNAL_SERVER_ERROR) If there is an error fetching the team members.
 */
async function getD4HTeam(accessToken: D4HAccessToken_ServerOnly, d4hTeamId: number) {
    const fetchClient = getD4HFetchClient(accessToken);
    const { d4HTeams } = await getD4HTokenMetadata(accessToken);

    const d4hTeam = d4HTeams.find((team) => team.id === d4hTeamId);
    if (!d4hTeam)
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `D4H Team with ID ${d4hTeamId} not found or not accessible with the user's token.`,
        });

    const { data: membersData, error } = await fetchClient.GET(
        `/v3/{context}/{contextId}/members`,
        {
            params: {
                path: {
                    context: "team",
                    contextId: d4hTeamId,
                },
                query: {
                    status: ["OPERATIONAL", "NON_OPERATIONAL"],
                },
            },
        },
    );
    if (error) {
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            cause: error,
            message: `Failed to fetch members of D4H Team with ID ${d4hTeamId}`,
        });
    }
    const members = (membersData as D4HListResponse).results.map((raw) =>
        D4HMember.schema.parse(raw),
    );

    return { ...d4hTeam, members };
}

/**
 * Utility function to fetch a Team by ID.
 * @param ctx
 * @param teamId
 * @returns
 */
async function getTeam(
    ctx: AuthenticatedOrganizationContext,
    teamId: TeamId,
): Promise<TeamData | null> {
    const team = await ctx.prisma.team.findUnique({
        where: {
            id: teamId,
            organizationId: ctx.organizationId,
        },
        include: {
            d4h: true,
        },
    });

    return team ? TeamData.fromRecord(team) : null;
}
