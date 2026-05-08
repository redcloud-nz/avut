/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { OrganizationRef } from "@/lib/schemas/organization";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillCheckSession, SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { Skill, SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import {
    SkillPackageSubscription,
    SkillPackageSubscriptionId,
} from "@/lib/schemas/skill-package-subscription";

import { AuthenticatedOrganizationContext, createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";
import { SkillCheck } from "@/lib/schemas/skill-check";

/**
 * Router for managing skill package subscriptions and listing the groups and skills associated with the organization's subscribed skill packages.
 */
export const skillsRouter = createTrpcRouter({
    /**
     * Create a new skill check session for the organization.
     * @param name The name of the session.
     * @param startsAt Optional start datetime for the session.
     * @param endsAt Optional end datetime for the session.
     * @param notes Optional notes for the session.
     * @param status The status of the session.
     * @returns The created skill check session.
     */
    createSession: organizationProcedure({ skillCheckSession: ["create"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                create: SkillCheckSession.modifiableSchema,
            }),
        )
        .output(z.object({ created: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId, create } }) => {
            const session = await ctx.prisma.skillCheckSession.create({
                data: {
                    id: skillCheckSessionId,
                    organizationId,
                    name: create.name,
                    startsAt: create.date,
                    endsAt: create.date,
                    notes: create.notes,
                    status: create.status,
                },
            });

            return { created: SkillCheckSession.fromRecord(session) };
        }),

    /**
     * Delete a skill check session. Requires "assess" permission on "Skills" module.
     * @param skillCheckSessionId The ID of the skill check session to delete.
     * @returns The deleted skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    deleteSession: organizationProcedure({ skillCheckSession: ["delete"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(z.object({ deleted: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId } }) => {
            const session = await getSessionOrThrow(ctx, skillCheckSessionId);

            await ctx.prisma.skillCheckSession.delete({
                where: {
                    id: skillCheckSessionId,
                    organizationId,
                },
            });

            return { deleted: session };
        }),

    /**
     * Get a skill check session by ID.
     * @param skillCheckSessionId The ID of the skill check session to retrieve.
     * @returns The skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    getSession: organizationProcedure({ skillCheckSession: ["view"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(SkillCheckSession.schema)
        .query(async ({ ctx, input: { skillCheckSessionId } }) => {
            const session = await getSessionOrThrow(ctx, skillCheckSessionId);

            return session;
        }),

    /**
     * Get metrics for a skill check session, including the number of assessees, skills, and checks associated with the session.
     */
    getSessionMetrics: organizationProcedure({ skillCheckSession: ["view"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(
            z.object({
                assesseeCount: z.number(),
                skillCount: z.number(),
                checkCount: z.number(),
            }),
        )
        .query(async ({ ctx, input: { skillCheckSessionId } }) => {
            const session = await ctx.prisma.skillCheckSession.findUnique({
                where: {
                    organizationId: ctx.organizationId,
                    id: skillCheckSessionId,
                },
                include: {
                    _count: {
                        select: {
                            assessees: true,
                            skills: true,
                            skillChecks: true,
                        },
                    },
                },
            });

            if (!session)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckSessionNotFound(skillCheckSessionId),
                });

            return {
                assesseeCount: session._count.assessees,
                skillCount: session._count.skills,
                checkCount: session._count.skillChecks,
            };
        }),

    /**
     * List the skills that are assessable for this organization based on their current skill package subscriptions.
     */
    listAssessableSkills: organizationProcedure({ skills: ["view"] })
        .output(
            z.object({
                skillPackages: z.array(SkillPackage.schema),
                skillGroups: z.array(SkillGroup.schema),
                skills: z.array(Skill.schema),
            }),
        )
        .query(async ({ ctx }) => {
            const subscriptions = await ctx.prisma.skillPackageSubscription.findMany({
                where: {
                    organizationId: ctx.organizationId,
                },
                include: {
                    skillPackage: {
                        include: {
                            skills: true,
                            groups: true,
                        },
                    },
                },
            });

            const skillPackages = subscriptions.map((sub) =>
                SkillPackage.fromRecord(sub.skillPackage),
            );
            const skillGroups = subscriptions.flatMap((sub) =>
                sub.skillPackage.groups.map((group) => SkillGroup.fromRecord(group)),
            );
            const skills = subscriptions.flatMap((sub) =>
                sub.skillPackage.skills.map((skill) => Skill.fromRecord(skill)),
            );
            return { skillPackages, skillGroups, skills };
        }),

    /**
     * List all skill package that are published and available for subscription by the organization.
     * @returns An array of skill packages including subscription status for the organization.
     */
    listPackages: organizationProcedure({
        skills: ["view"],
    })
        .output(
            z.array(
                SkillPackage.schema.extend({
                    organization: z.object({
                        id: z.string(),
                        name: z.string(),
                    }),
                    subscription: SkillPackageSubscription.schema.nullable(),
                    skillCount: z.number(),
                    subscriptionCount: z.number(),
                }),
            ),
        )
        .query(async ({ ctx, input: { organizationId } }) => {
            const publishedPackages = await ctx.prisma.skillPackage.findMany({
                where: {
                    published: true,
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    tags: true,
                    properties: true,
                    published: true,
                    updatedAt: true,
                    createdAt: true,
                    status: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    subscriptions: {
                        where: {
                            organizationId,
                        },
                    },
                    _count: {
                        select: {
                            subscriptions: true,
                            skills: {
                                where: {
                                    status: "Active",
                                },
                            },
                        },
                    },
                },
            });

            return publishedPackages.map((pkg) => ({
                ...SkillPackage.fromRecord(pkg),
                organization: {
                    id: pkg.organization.id,
                    name: pkg.organization.name,
                },
                skillCount: pkg._count.skills,
                subscriptionCount: pkg._count.subscriptions,

                subscription:
                    pkg.subscriptions.length > 0
                        ? SkillPackageSubscription.fromRecord(pkg.subscriptions[0])
                        : null,
            }));
        }),

    /**
     * List the personnel that are assigned to a particular skill check session as assessees.
     * @param skillCheckSessionId The ID of the skill check session to list assessees for.
     * @returns An array of assessees assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionAssessees: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
            }),
        )
        .output(z.array(PersonRef.schema))
        .query(async ({ ctx, input: { sessionId } }) => {
            const session = await ctx.prisma.skillCheckSession.findUnique({
                where: {
                    id: sessionId,
                    organizationId: ctx.organizationId,
                },
                include: {
                    assessees: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            if (!session) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckSessionNotFound(sessionId),
                });
            }

            return session.assessees
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((person) => PersonRef.schema.parse(person));
        }),

    /**
     * List the skills that are assigned to a particular skill check session.
     * @param skillCheckSessionId The ID of the skill check session to list skills for.
     * @returns An array of refs representing the skills assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionSkills: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
            }),
        )
        .output(z.array(SkillRef.schema))
        .query(async ({ ctx, input: { sessionId } }) => {
            const session = await ctx.prisma.skillCheckSession.findUnique({
                where: {
                    id: sessionId,
                    organizationId: ctx.organizationId,
                },
                include: {
                    skills: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            if (!session) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckSessionNotFound(sessionId),
                });
            }

            return session.skills.map((skill) => SkillRef.schema.parse(skill));
        }),

    /**
     * List all skill check sessions for the organization. Requires "view" skill on "Skills" module.
     * @returns An array of skill check sessions associated with the organization.
     */
    listSessions: organizationProcedure({
        skills: ["view"],
    })
        .output(z.array(SkillCheckSession.schema))
        .query(async ({ ctx, input: { organizationId } }) => {
            const sessions = await ctx.prisma.skillCheckSession.findMany({
                where: {
                    organizationId,
                },
            });

            return sessions.map((session) => SkillCheckSession.fromRecord(session));
        }),

    /**
     * List the packages that the organization is currently subscribed to, including details about the package and the subscription. Requires "view" skill on "Skills" module.
     * @returns An array of skill packages that the organization is subscribed to, including subscription details.
     */
    listSubscribedPackages: organizationProcedure({ skills: ["view"] })
        .output(
            z.array(
                SkillPackage.schema.extend({
                    organization: OrganizationRef.schema,
                    subscription: SkillPackageSubscription.schema,
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const subscriptions = await ctx.prisma.skillPackageSubscription.findMany({
                where: {
                    organizationId: ctx.organizationId,
                },
                include: {
                    skillPackage: {
                        include: {
                            organization: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            });

            return subscriptions.map((sub) => ({
                ...SkillPackage.fromRecord(sub.skillPackage),
                organization: OrganizationRef.schema.parse(sub.skillPackage.organization),
                subscription: SkillPackageSubscription.fromRecord(sub),
            }));
        }),

    /**
     * Subscribe the organization to the specified skill package, allowing access to the skills within the package. The package must be published and not already subscribed to by the organization.
     * @param skillPackageId The ID of the skill package to subscribe to.
     * @returns The created skill package subscription.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or is not published.
     * @throws TRPCError(BAD_REQUEST) if the organization is already subscribed to the skill package.
     */
    subscribeToPackage: organizationProcedure({ skills: ["subscribe"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
            }),
        )
        .output(z.object({ created: SkillPackageSubscription.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillPackageId } }) => {
            // Check if the package exists and is published
            const skillPackage = await ctx.prisma.skillPackage.findUnique({
                where: {
                    id: skillPackageId,
                },
            });

            if (!skillPackage || !skillPackage.published) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillPackageNotFound(skillPackageId),
                });
            }

            // Check if already subscribed
            const existingSubscription = await ctx.prisma.skillPackageSubscription.findUnique({
                where: {
                    organizationId_skillPackageId: {
                        organizationId,
                        skillPackageId: skillPackageId,
                    },
                },
            });

            if (existingSubscription) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: Messages.alreadySubscribedToPackage(skillPackage.name),
                });
            }

            // Create subscription
            const [subscription] = await Promise.all([
                ctx.prisma.skillPackageSubscription.create({
                    data: {
                        id: SkillPackageSubscriptionId.create(),
                        organizationId,
                        skillPackageId,
                    },
                }),
                ctx.logEvent({
                    action: "Subscribe",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                    description: `Subscribed to skill package "${skillPackage.name}".`,
                }),
            ]);

            return {
                created: SkillPackageSubscription.fromRecord(subscription),
            };
        }),

    /**
     * Unsubscribe the organization from the specified skill package, removing access to the skills within the package. The organization must be currently subscribed to the package.
     * @param skillPackageId The ID of the skill package to unsubscribe from.
     * @returns The deleted skill package subscription.
     * @throws TRPCError(NOT_FOUND) if the subscription does not exist.
     */
    unsubscribeFromPackage: organizationProcedure({
        skills: ["subscribe"],
    })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
            }),
        )
        .output(z.object({ deleted: SkillPackageSubscription.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillPackageId } }) => {
            // Check if the subscription exists
            const existingSubscription = await ctx.prisma.skillPackageSubscription.findUnique({
                where: {
                    organizationId_skillPackageId: {
                        organizationId,
                        skillPackageId,
                    },
                },
                include: {
                    skillPackage: true,
                },
            });

            if (!existingSubscription) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillPackageSubscriptionNotFound(
                        `${organizationId}-${skillPackageId}`,
                    ),
                });
            }

            // Delete subscription
            await Promise.all([
                ctx.prisma.skillPackageSubscription.delete({
                    where: {
                        id: existingSubscription.id,
                    },
                }),
                ctx.logEvent({
                    action: "Unsubscribe",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                    description: `Unsubscribed from skill package "${existingSubscription.skillPackage.name}."`,
                }),
            ]);
            return {
                deleted: SkillPackageSubscription.fromRecord(existingSubscription),
            };
        }),

    /**
     * Update a skill check session.
     * @param skillCheckSessionId The ID of the skill check session to update.
     * @param update The fields to update on the skill check session.
     * @returns The updated skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    updateSession: organizationProcedure({ skillCheckSession: ["update"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                update: SkillCheckSession.modifiableSchema,
            }),
        )
        .output(z.object({ updated: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId, update } }) => {
            await getSessionOrThrow(ctx, skillCheckSessionId);

            const updated = await ctx.prisma.skillCheckSession.update({
                where: {
                    id: skillCheckSessionId,
                    organizationId,
                },
                include: {},
                data: {
                    name: update.name,
                    startsAt: update.date,
                    endsAt: update.date,
                    notes: update.notes,
                    status: update.status,
                },
            });

            return { updated: SkillCheckSession.fromRecord(updated) };
        }),

    /**
     * Update the personnel assigned to a skill check session as assessees. This will replace the current list of assessees with the provided list.
     * @param skillCheckSessionId The ID of the skill check session to update assessees for.
     * @param personIds An array of person IDs to assign as assessees to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    updateSessionAssessees: organizationProcedure({ skillCheckSession: ["update"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                addedPersonIds: z.array(PersonId.schema),
                removedPersonIds: z.array(PersonId.schema),
            }),
        )
        .output(
            z.object({
                updatedAssessees: z.array(PersonRef.schema),
                updatedSession: SkillCheckSession.schema,
            }),
        )
        .mutation(
            async ({ ctx, input: { skillCheckSessionId, addedPersonIds, removedPersonIds } }) => {
                // Verify that the session exists and belongs to the organization.
                await getSessionOrThrow(ctx, skillCheckSessionId);

                const updated = await ctx.prisma.skillCheckSession.update({
                    where: {
                        id: skillCheckSessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        assessees: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    data: {
                        assessees: {
                            connect: addedPersonIds.map((id) => ({ id })),
                            disconnect: removedPersonIds.map((id) => ({ id })),
                        },
                    },
                });
                return {
                    updatedAssessees: updated.assessees,
                    updatedSession: SkillCheckSession.fromRecord(updated),
                };
            },
        ),

    /**
     * Update the skills assigned to a skill check session. This will replace the current list of skills with the provided list.
     * @param skillCheckSessionId The ID of the skill check session to update skills for.
     * @param skillIds An array of skill IDs to assign to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    updateSessionSkills: organizationProcedure({ skillCheckSession: ["update"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                addedSkillIds: z.array(SkillId.schema),
                removedSkillIds: z.array(SkillId.schema),
            }),
        )
        .output(
            z.object({
                updatedSkills: z.array(SkillRef.schema),
                updatedSession: SkillCheckSession.schema,
            }),
        )
        .mutation(
            async ({ ctx, input: { skillCheckSessionId, addedSkillIds, removedSkillIds } }) => {
                // Verify that the session exists and belongs to the organization.
                await getSessionOrThrow(ctx, skillCheckSessionId);

                const updated = await ctx.prisma.skillCheckSession.update({
                    where: {
                        id: skillCheckSessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        skills: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    data: {
                        skills: {
                            connect: addedSkillIds.map((id) => ({ id })),
                            disconnect: removedSkillIds.map((id) => ({ id })),
                        },
                    },
                });
                return {
                    updatedSkills: updated.skills,
                    updatedSession: SkillCheckSession.fromRecord(updated),
                };
            },
        ),
});

/**
 * Helper function to retrieve a skill check session by ID and ensure it belongs to the organization.
 * @param ctx The TRPC context containing the organization ID.
 * @param sessionId The ID of the skill check session to retrieve.
 * @returns The skill check session.
 * @throws TRPCError(NOT_FOUND) if the session is not found or does not belong to the organization.
 */
async function getSessionOrThrow(
    ctx: AuthenticatedOrganizationContext,
    sessionId: SkillCheckSessionId,
): Promise<SkillCheckSession> {
    const session = await ctx.prisma.skillCheckSession.findUnique({
        where: {
            id: sessionId,
            organizationId: ctx.organizationId,
        },
    });
    if (!session) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: Messages.skillCheckSessionNotFound(sessionId),
        });
    }
    return SkillCheckSession.fromRecord(session);
}
