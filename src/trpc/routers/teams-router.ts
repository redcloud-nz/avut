/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { SyncPlan } from "@/lib/schemas/d4h-sync-plan";
import { OrganizationD4HData } from "@/lib/schemas/organization-d4h";
import { PersonData, PersonId, PersonRef } from "@/lib/schemas/person";
import { TeamData, TeamId, TeamRef } from "@/lib/schemas/team";
import { TeamMembershipData, TeamMembershipId } from "@/lib/schemas/team-membership";
import { getPersonalD4HAccessTokenForUser } from "@/server/d4h-access-token";
import { assertD4HLinkAllowed } from "@/server/d4h-link-invariants";
import { createLogBatch, formatActorLabel } from "@/server/log-entry";

import { AuthenticatedOrganizationContext, createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

import {
    planD4HSync,
    resolveD4HTeamForLink,
    runTeamSync,
    syncOrganizationD4HCache,
    upsertOrganizationD4H,
} from "./teams-router.d4h";

export const teamsRouter = createTrpcRouter({
    /**
     * Apply a previewed D4H team sync. Re-fetches and re-plans server-side; if the
     * fresh plan no longer matches `planToken` it rejects with a `StalePlanError`
     * cause and writes nothing. See docs/specs/d4h-linking.md §7.
     */
    applyD4HTeamSync: organizationProcedure({ team: ["update"] })
        .input(z.object({ teamId: TeamId.schema, planToken: z.string() }))
        .output(z.object({ plan: SyncPlan.schema }))
        .mutation(async ({ ctx, input: { organizationId, teamId, planToken } }) => {
            const team = await ctx.prisma.team.findUnique({
                where: { id: teamId, organizationId },
                include: { d4h: true },
            });
            if (!team) {
                throw new TRPCError({ code: "NOT_FOUND", message: Messages.teamNotFound(teamId) });
            }
            if (!team.d4h) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Team is not linked to D4H" });
            }

            const token = await getPersonalD4HAccessTokenForUser(organizationId, ctx.userId);
            if (!token) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No personal D4H Access Token found for user",
                });
            }

            const batch = await createLogBatch(
                {
                    operationKey: "d4h-team-sync",
                    userId: ctx.userId,
                    actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
                    description: `Synchronised team "${team.name}" from its linked D4H team`,
                },
                ctx.prisma,
            );

            return runTeamSync(ctx, {
                teamD4H: team.d4h,
                token,
                batchId: batch.id,
                requireFreshMatch: planToken,
            });
        }),

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
            const teamId = TeamId.create();

            const changes = diffObject({ tags: [], properties: {} }, create);

            const [createdTeam] = await ctx.prisma.$transaction([
                ctx.prisma.team.create({
                    data: {
                        id: teamId,
                        organizationId,
                        name: create.name,
                        description: create.description,
                        tags: create.tags,
                        properties: create.properties,
                    },
                    include: {
                        d4h: true,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "Team",
                    objectId: teamId,
                    changes,
                }),
            ]);

            return { created: TeamData.fromRecord(createdTeam) };
        }),

    /**
     * Create a new AVUT team from a D4H team, link it, and run the first membership
     * sync — all in one operation batch. `name` defaults to the D4H team title.
     */
    createTeamFromD4H: organizationProcedure({ team: ["create"] })
        .input(z.object({ d4hTeamId: z.number(), name: z.string().optional() }))
        .output(z.object({ created: TeamData.schema }))
        .mutation(async ({ ctx, input: { organizationId, d4hTeamId, name: inputName } }) => {
            const resolved = await resolveD4HTeamForLink(ctx, d4hTeamId);

            const duplicate = await ctx.prisma.team_D4H.findFirst({
                where: { d4hTeamId, team: { organizationId } },
            });
            if (duplicate) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "That D4H team is already linked to a team in this organization.",
                });
            }

            const orgD4H = await ctx.prisma.organization_D4H.findUnique({
                where: { organizationId },
            });
            const action = assertD4HLinkAllowed({
                orgD4H: orgD4H
                    ? { serverCode: orgD4H.serverCode, d4hOrganisationId: orgD4H.d4hOrganisationId }
                    : null,
                tokenServerCode: resolved.token.serverCode,
                owningOrgId: resolved.owningOrgId,
            });

            const name = inputName?.trim() || resolved.d4hTeamName;

            const batch = await createLogBatch(
                {
                    operationKey: "d4h-team-link",
                    userId: ctx.userId,
                    actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
                    description: `Created team "${name}" from D4H and synced its members`,
                },
                ctx.prisma,
            );

            await upsertOrganizationD4H(ctx, { action, resolved, batchId: batch.id });

            const teamId = TeamId.create();
            const [team] = await ctx.prisma.$transaction([
                ctx.prisma.team.create({
                    data: {
                        id: teamId,
                        organizationId,
                        name,
                        description: `Linked to D4H team "${resolved.d4hTeamName}"`,
                        tags: [],
                        properties: {},
                        d4h: {
                            create: {
                                d4hTeamId,
                                d4hTeamName: resolved.d4hTeamName,
                                d4hServerCode: resolved.token.serverCode,
                                d4hOrganisationId: resolved.owningOrgId,
                                linkTokenId: resolved.token.id,
                            },
                        },
                    },
                    include: { d4h: true },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "Team",
                    objectId: teamId,
                    changes: diffObject(
                        { tags: [], properties: {} },
                        { name, tags: [], properties: {} },
                    ),
                    batchId: batch.id,
                }),
            ]);

            await runTeamSync(ctx, {
                teamD4H: team.d4h!,
                token: resolved.token,
                batchId: batch.id,
            });

            const created = await getTeam(ctx, teamId);
            return { created: created! };
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

            const [created] = await ctx.prisma.$transaction([
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
                    changes: diffObject({ tags: [], properties: {} }, create),
                    refs: [
                        { objectType: "Person", objectId: personId, role: "context" },
                        { objectType: "Team", objectId: teamId, role: "context" },
                    ],
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
            const existing = await ctx.prisma.team.findUnique({
                where: { id: teamId, organizationId: ctx.organizationId },
                select: { id: true },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.teamNotFound(teamId),
                });
            }

            await ctx.prisma.$transaction([
                // TeamConfig / Team_D4H / TeamMembership rows cascade away with the team.
                ctx.prisma.team.delete({
                    where: { id: teamId, organizationId: ctx.organizationId },
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

            await ctx.prisma.$transaction([
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
                    objectId: existing.id,
                    refs: [
                        { objectType: "Person", objectId: personId, role: "context" },
                        { objectType: "Team", objectId: teamId, role: "context" },
                    ],
                }),
            ]);
        }),

    /**
     * The org-level D4H link (`Organization_D4H`) for the current org, or `null`
     * if the org has never linked a team to D4H. Read model for the admin
     * organisation page's D4H card. See docs/specs/d4h-linking.md §3.1.
     */
    getOrganizationD4H: organizationProcedure({ organization: ["view"] })
        .output(OrganizationD4HData.schema.nullable())
        .query(async ({ ctx, input: { organizationId } }) => {
            const [orgD4H, linkedTeamCount] = await Promise.all([
                ctx.prisma.organization_D4H.findUnique({ where: { organizationId } }),
                ctx.prisma.team_D4H.count({ where: { team: { organizationId } } }),
            ]);

            return orgD4H ? OrganizationD4HData.fromRecord(orgD4H, linkedTeamCount) : null;
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
     * Link an existing AVUT team to a D4H team, creating (or reusing) the org-level
     * D4H link and running the first membership sync. See docs/specs/d4h-linking.md §6.1.
     */
    linkTeamToD4H: organizationProcedure({ team: ["update"] })
        .input(z.object({ teamId: TeamId.schema, d4hTeamId: z.number() }))
        .output(z.object({ plan: SyncPlan.schema }))
        .mutation(async ({ ctx, input: { organizationId, teamId, d4hTeamId } }) => {
            const team = await ctx.prisma.team.findUnique({
                where: { id: teamId, organizationId },
                include: { d4h: true },
            });
            if (!team) {
                throw new TRPCError({ code: "NOT_FOUND", message: Messages.teamNotFound(teamId) });
            }
            if (team.d4h) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "This team is already linked to D4H.",
                });
            }

            const resolved = await resolveD4HTeamForLink(ctx, d4hTeamId);

            const duplicate = await ctx.prisma.team_D4H.findFirst({
                where: { d4hTeamId, team: { organizationId } },
            });
            if (duplicate) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "That D4H team is already linked to a team in this organization.",
                });
            }

            const orgD4H = await ctx.prisma.organization_D4H.findUnique({
                where: { organizationId },
            });
            const action = assertD4HLinkAllowed({
                orgD4H: orgD4H
                    ? { serverCode: orgD4H.serverCode, d4hOrganisationId: orgD4H.d4hOrganisationId }
                    : null,
                tokenServerCode: resolved.token.serverCode,
                owningOrgId: resolved.owningOrgId,
            });

            const batch = await createLogBatch(
                {
                    operationKey: "d4h-team-link",
                    userId: ctx.userId,
                    actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
                    description: `Linked team "${team.name}" to D4H and synced its members`,
                },
                ctx.prisma,
            );

            await upsertOrganizationD4H(ctx, { action, resolved, batchId: batch.id });

            const [teamD4H] = await ctx.prisma.$transaction([
                ctx.prisma.team_D4H.create({
                    data: {
                        teamId,
                        d4hTeamId,
                        d4hTeamName: resolved.d4hTeamName,
                        d4hServerCode: resolved.token.serverCode,
                        d4hOrganisationId: resolved.owningOrgId,
                        linkTokenId: resolved.token.id,
                    },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "Team",
                    objectId: teamId,
                    description: `Linked to D4H team "${resolved.d4hTeamName}"`,
                    batchId: batch.id,
                }),
            ]);

            return runTeamSync(ctx, { teamD4H, token: resolved.token, batchId: batch.id });
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
                    person: PersonData.schema.pick({ id: true, name: true, email: true }),
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
                    d4h: true,
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
                            email: true,
                        },
                    },
                },
                orderBy: {
                    person: { name: "asc" },
                },
            });

            return teamMembershipRecords.map((record) => ({
                ...TeamMembershipData.fromRecord(record),
                team: record.team,
                person: record.person,
            }));
        }),

    /**
     * Preview the changes a D4H sync would make to a linked team. Pure read — no writes.
     */
    planD4HTeamSync: organizationProcedure({ team: ["update"] })
        .input(z.object({ teamId: TeamId.schema }))
        .output(SyncPlan.schema)
        .query(async ({ ctx, input: { organizationId, teamId } }) => {
            const team = await ctx.prisma.team.findUnique({
                where: { id: teamId, organizationId },
                include: { d4h: true },
            });
            if (!team) {
                throw new TRPCError({ code: "NOT_FOUND", message: Messages.teamNotFound(teamId) });
            }
            if (!team.d4h) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Team is not linked to D4H" });
            }

            const token = await getPersonalD4HAccessTokenForUser(organizationId, ctx.userId);
            if (!token) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No personal D4H Access Token found for user",
                });
            }

            return planD4HSync(ctx, { teamD4H: team.d4h, token });
        }),

    /**
     * Refresh the org-level D4H cache (name, timezone, currency, reporting-year
     * start) from D4H. Metadata only — team membership sync stays per-team.
     */
    syncOrganizationD4H: organizationProcedure({ organization: ["update"] }).mutation(
        async ({ ctx }) => {
            await syncOrganizationD4HCache(ctx);
        },
    ),

    /**
     * Remove the org-level D4H link. Refuses while any team in the org is still
     * linked. See docs/specs/d4h-linking.md §6.4.
     */
    unlinkOrganizationFromD4H: organizationProcedure({ organization: ["update"] }).mutation(
        async ({ ctx, input: { organizationId } }) => {
            const orgD4H = await ctx.prisma.organization_D4H.findUnique({
                where: { organizationId },
            });
            if (!orgD4H) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "This organization is not linked to D4H.",
                });
            }

            const linkedTeams = await ctx.prisma.team_D4H.count({
                where: { team: { organizationId } },
            });
            if (linkedTeams > 0) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: `Unlink all ${linkedTeams} D4H-linked team(s) first.`,
                });
            }

            await ctx.prisma.$transaction([
                ctx.prisma.organization_D4H.delete({ where: { organizationId } }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "Organization",
                    objectId: organizationId,
                    description: "Unlinked from D4H organisation.",
                }),
            ]);
        },
    ),

    /**
     * Unlink a team from D4H. `TeamMembership_D4H` rows cascade away; the
     * `TeamMembership` rows stay (they become manually-managed). In org-less mode
     * this also removes the org-level link. See docs/specs/d4h-linking.md §6.3.
     */
    unlinkTeamFromD4H: organizationProcedure({ team: ["update"] })
        .input(z.object({ teamId: TeamId.schema }))
        .mutation(async ({ ctx, input: { organizationId, teamId } }) => {
            const team = await ctx.prisma.team.findUnique({
                where: { id: teamId, organizationId },
                include: { d4h: true },
            });
            if (!team) {
                throw new TRPCError({ code: "NOT_FOUND", message: Messages.teamNotFound(teamId) });
            }
            if (!team.d4h) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Team is not linked to D4H" });
            }

            const orgD4H = await ctx.prisma.organization_D4H.findUnique({
                where: { organizationId },
            });
            const orgLessMode = orgD4H != null && orgD4H.d4hOrganisationId == null;

            await ctx.prisma.$transaction([
                ctx.prisma.team_D4H.delete({ where: { teamId } }),
                ...(orgLessMode
                    ? [ctx.prisma.organization_D4H.delete({ where: { organizationId } })]
                    : []),
                ctx.logEvent({
                    action: "Update",
                    objectType: "Team",
                    objectId: teamId,
                    description: "Unlinked from D4H.",
                }),
            ]);
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

            const [updated] = await ctx.prisma.$transaction([
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

            const diff = diffObject(
                TeamMembershipData.modifiableSchema.parse(TeamMembershipData.fromRecord(existing)),
                update,
            );

            if (diff.length == 0) return { updated: TeamMembershipData.fromRecord(existing) };

            const [updated] = await ctx.prisma.$transaction([
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
                    objectId: existing.id,
                    changes: diff,
                    refs: [
                        { objectType: "Person", objectId: personId, role: "context" },
                        { objectType: "Team", objectId: teamId, role: "context" },
                    ],
                }),
            ]);

            return { updated: TeamMembershipData.fromRecord(updated) };
        }),
});

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

    if (!team) return null;

    // Resolve the D4H organisation name from the org-level cache (at most one
    // `Organization_D4H` per org) so the detail view can show it alongside the id.
    const orgD4H = team.d4h
        ? await ctx.prisma.organization_D4H.findUnique({
              where: { organizationId: ctx.organizationId },
              select: { d4hOrganisationName: true },
          })
        : null;

    return TeamData.fromRecord({
        ...team,
        d4h: team.d4h
            ? { ...team.d4h, d4hOrganisationName: orgD4H?.d4hOrganisationName ?? null }
            : null,
    });
}
