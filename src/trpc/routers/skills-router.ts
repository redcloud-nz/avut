/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { Prisma } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import { OrganizationId, OrganizationRef } from "@/lib/schemas/organization";
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

/**
 * Router for managing skill package subscriptions and listing the groups and skills associated with the organization's subscribed skill packages.
 */
export const skillsRouter = createTrpcRouter({
    /**
     * Create a new skill check session for the organization. The caller is assigned as the
     * session's sole assessor, so they must have a linked person record.
     * @param name The name of the session.
     * @param startsAt Optional start datetime for the session.
     * @param endsAt Optional end datetime for the session.
     * @param notes Optional notes for the session.
     * @param status The status of the session.
     * @returns The created skill check session.
     * @throws TRPCError(BAD_REQUEST) if the caller has no linked person record.
     */
    createSession: organizationProcedure({ skillCheckSession: ["create"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                create: SkillCheckSession.modifiableSchema,
            }),
        )
        .output(
            z.object({
                created: SkillCheckSession.schema.extend({ assessors: z.array(PersonRef.schema) }),
            }),
        )
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId, create } }) => {
            const orgUser = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId, userId: ctx.userId },
                select: { personId: true },
            });
            if (!orgUser?.personId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: Messages.noLinkedPersonRecord(),
                });
            }
            const assessorPersonId = orgUser.personId;

            const session = await createSessionWithNextNumber(
                ctx,
                organizationId,
                (sessionNumber) => ({
                    id: skillCheckSessionId,
                    organizationId,
                    name: create.name.trim() || `Session #${sessionNumber}`,
                    sessionNumber,
                    startsAt: new Date(create.date),
                    endsAt: new Date(create.date),
                    notes: create.notes,
                    status: create.status,
                    assessors: { connect: [{ id: assessorPersonId }] },
                }),
            );

            await ctx.logEvent({
                action: "Create",
                objectType: "SkillCheckSession",
                objectId: skillCheckSessionId,
                changes: diffObject({}, create),
            });

            return {
                created: {
                    ...SkillCheckSession.fromRecord(session),
                    assessors: session.assessors.map((person) => PersonRef.schema.parse(person)),
                },
            };
        }),

    /**
     * Delete a skill check session. Requires the "delete" action on "skillCheckSession".
     * @param skillCheckSessionId The ID of the skill check session to delete.
     * @returns The deleted skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    deleteSession: organizationProcedure({ skillCheckSession: ["delete"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(z.object({ deleted: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId } }) => {
            const session = await getSessionOrThrow(ctx, skillCheckSessionId);

            await ctx.prisma.$transaction([
                ctx.prisma.skillCheckSession.delete({
                    where: {
                        id: skillCheckSessionId,
                        organizationId,
                    },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "SkillCheckSession",
                    objectId: skillCheckSessionId,
                }),
            ]);

            return { deleted: session };
        }),

    /**
     * Get a single published skill package by ID, including this organization's subscription
     * status and package-level counts.
     * @param skillPackageId The ID of the skill package to retrieve.
     * @returns The skill package with organization, subscription, skillCount, subscriptionCount.
     * @throws TRPCError(NOT_FOUND) if the package doesn't exist or isn't published.
     */
    getPackage: organizationProcedure({ skillPackageSubscription: ["view"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(
            SkillPackage.schema.extend({
                organization: z.object({
                    id: z.string(),
                    name: z.string(),
                }),
                subscription: SkillPackageSubscription.schema.nullable(),
                skillCount: z.number(),
                subscriptionCount: z.number(),
            }),
        )
        .query(async ({ ctx, input: { organizationId, skillPackageId } }) => {
            const pkg = await ctx.prisma.skillPackage.findUnique({
                where: {
                    id: skillPackageId,
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
                    organizationId: true,
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

            if (!pkg) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillPackageNotFound(skillPackageId),
                });
            }

            return {
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
            };
        }),

    /**
     * Get a skill check session by ID.
     * @param skillCheckSessionId The ID of the skill check session to retrieve.
     * @returns The skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    getSession: organizationProcedure({ skillCheckSession: ["view"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(SkillCheckSession.schema.extend({ assessors: z.array(PersonRef.schema) }))
        .query(async ({ ctx, input: { skillCheckSessionId } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: skillCheckSessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        assessors: {
                            select: { id: true, name: true },
                        },
                    },
                })) ?? sessionNotFound(skillCheckSessionId);

            return {
                ...SkillCheckSession.fromRecord(session),
                assessors: session.assessors.map((person) => PersonRef.schema.parse(person)),
            };
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
    listAssessableSkills: organizationProcedure({ skillPackageSubscription: ["view"] })
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
        skillPackageSubscription: ["view"],
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
                    organizationId: true,
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
     * @param scope The scope of assessees to return, either "all" for all personnel that are assigned or have checks recorded in the session, or "assigned" for only those personnel that are currently assigned to the session.
     * @returns An array of assessees assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionAssessees: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                scope: z.enum(["all", "assigned"]),
            }),
        )
        .output(z.array(PersonRef.schema))
        .query(async ({ ctx, input: { sessionId, scope } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
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
                })) ?? sessionNotFound(sessionId);

            if (scope == "assigned") {
                // Return only the personnel that are currently assigned.
                return session.assessees
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            } else {
                // Return all personnel that are either currently assigned or have checks recorded in the session.
                const checks = await ctx.prisma.skillCheck.findMany({
                    where: {
                        sessionId,
                    },
                    select: {
                        assesseeId: true,
                        assessee: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    distinct: ["assesseeId"],
                });
                const allAssessees = [
                    ...session.assessees,
                    ...checks.map((check) => check.assessee),
                ];

                const uniqueAssessees = R.uniqueBy(allAssessees, (a) => a.id);

                return uniqueAssessees
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            }
        }),

    /**
     * List the personnel that are assigned to a particular skill check session as assessors.
     * @param skillCheckSessionId The ID of the skill check session to list assessors for.
     * @param scope The scope of assessors to return, either "all" for all personnel that are assigned or have checks recorded in the session, or "assigned" for only those personnel that are currently assigned to the session.
     * @returns An array of assessors assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionAssessors: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                scope: z.enum(["all", "assigned"]),
            }),
        )
        .output(z.array(PersonRef.schema))
        .query(async ({ ctx, input: { sessionId, scope } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: sessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        assessors: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                })) ?? sessionNotFound(sessionId);

            if (scope === "assigned") {
                return session.assessors
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            } else {
                const checks = await ctx.prisma.skillCheck.findMany({
                    where: {
                        sessionId,
                    },
                    select: {
                        assessorId: true,
                        assessor: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    distinct: ["assessorId"],
                });

                const assessors = checks.map((check) => check.assessor);

                const uniqueAssessors = R.uniqueBy(assessors, (a) => a.id);

                return uniqueAssessors
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            }
        }),

    /**
     * List the skills that are assigned to a particular skill check session.
     * @param skillCheckSessionId The ID of the skill check session to list skills for.
     * @param scope The scope of skills to return, either "all" for all skills that are assigned or have checks recorded in the session, or "assigned" for only those skills that are currently assigned to the session.
     * @returns An array of refs representing the skills assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionSkills: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                scope: z.enum(["all", "assigned"]),
            }),
        )
        .output(z.array(SkillRef.schema))
        .query(async ({ ctx, input: { sessionId, scope } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
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
                })) ?? sessionNotFound(sessionId);

            if (scope == "assigned") {
                // Return only the skills that are currently assigned.
                return session.skills
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((skill) => SkillRef.schema.parse(skill));
            } else {
                // Return all skills that are either currently assigned or have checks recorded in the session.
                const checks = await ctx.prisma.skillCheck.findMany({
                    where: {
                        sessionId,
                    },
                    select: {
                        skillId: true,
                        skill: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    distinct: ["skillId"],
                });
                const allSkills = [...session.skills, ...checks.map((check) => check.skill)];

                const uniqueSkills = R.uniqueBy(allSkills, (a) => a.id);

                return uniqueSkills
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((skill) => SkillRef.schema.parse(skill));
            }
        }),

    /**
     * List all skill check sessions for the organization. Requires "view" skill on "Skills" module.
     * @returns An array of skill check sessions associated with the organization.
     */
    listSessions: organizationProcedure({
        skillPackageSubscription: ["view"],
    })
        .output(z.array(SkillCheckSession.schema.extend({ assessors: z.array(PersonRef.schema) })))
        .query(async ({ ctx, input: { organizationId } }) => {
            const sessions = await ctx.prisma.skillCheckSession.findMany({
                where: {
                    organizationId,
                },
                include: {
                    assessors: {
                        select: { id: true, name: true },
                    },
                },
            });

            return sessions.map((session) => ({
                ...SkillCheckSession.fromRecord(session),
                assessors: session.assessors.map((person) => PersonRef.schema.parse(person)),
            }));
        }),

    /**
     * List the packages that the organization is currently subscribed to, including details about the package and the subscription. Requires "view" skill on "Skills" module.
     * @returns An array of skill packages that the organization is subscribed to, including subscription details.
     */
    listSubscribedPackages: organizationProcedure({ skillPackageSubscription: ["view"] })
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
     * Get the next available session number for the organization, for use as a display default
     * when creating a new session. Advisory only — the number actually assigned at creation may
     * differ if another session is created concurrently.
     * @returns The next available session number.
     */
    nextSessionNumber: organizationProcedure({ skillCheckSession: ["view"] })
        .output(z.object({ nextSessionNumber: z.number().int() }))
        .query(async ({ ctx, input: { organizationId } }) => ({
            nextSessionNumber: await getNextSessionNumber(ctx, organizationId),
        })),

    /**
     * Subscribe the organization to the specified skill package, allowing access to the skills within the package. The package must be published and not already subscribed to by the organization.
     * @param skillPackageId The ID of the skill package to subscribe to.
     * @returns The created skill package subscription.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or is not published.
     * @throws TRPCError(BAD_REQUEST) if the organization is already subscribed to the skill package.
     */
    subscribeToPackage: organizationProcedure({ skillPackageSubscription: ["subscribe"] })
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
            const [subscription] = await ctx.prisma.$transaction([
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
        skillPackageSubscription: ["subscribe"],
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
            await ctx.prisma.$transaction([
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
            const existing = await getSessionOrThrow(ctx, skillCheckSessionId);

            const changes = diffObject(SkillCheckSession.modifiableSchema.parse(existing), update);

            if (changes.length == 0) return { updated: existing }; // No changes

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.skillCheckSession.update({
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
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "SkillCheckSession",
                    objectId: skillCheckSessionId,
                    changes,
                }),
            ]);

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

                const changes = [
                    ...addedPersonIds.map((id) => ({
                        path: ["assessees"],
                        type: "arr_add" as const,
                        value: id,
                    })),
                    ...removedPersonIds.map((id) => ({
                        path: ["assessees"],
                        type: "arr_del" as const,
                        value: id,
                    })),
                ];

                const [updated] = await ctx.prisma.$transaction([
                    ctx.prisma.skillCheckSession.update({
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
                    }),
                    ctx.logEvent({
                        action: "Update",
                        objectType: "SkillCheckSession",
                        objectId: skillCheckSessionId,
                        changes,
                    }),
                ]);
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

                const changes = [
                    ...addedSkillIds.map((id) => ({
                        path: ["skills"],
                        type: "arr_add" as const,
                        value: id,
                    })),
                    ...removedSkillIds.map((id) => ({
                        path: ["skills"],
                        type: "arr_del" as const,
                        value: id,
                    })),
                ];

                const [updated] = await ctx.prisma.$transaction([
                    ctx.prisma.skillCheckSession.update({
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
                    }),
                    ctx.logEvent({
                        action: "Update",
                        objectType: "SkillCheckSession",
                        objectId: skillCheckSessionId,
                        changes,
                    }),
                ]);
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
    const session =
        (await ctx.prisma.skillCheckSession.findUnique({
            where: {
                id: sessionId,
                organizationId: ctx.organizationId,
            },
        })) ?? sessionNotFound(sessionId);
    return SkillCheckSession.fromRecord(session);
}

function sessionNotFound(sessionId: SkillCheckSessionId): never {
    throw new TRPCError({
        code: "NOT_FOUND",
        message: Messages.skillCheckSessionNotFound(sessionId),
    });
}

const MAX_SESSION_NUMBER_ATTEMPTS = 5;

/**
 * Determine the next available session number for an organization, i.e. one greater than the
 * highest `sessionNumber` currently in use (or 1 if the organization has no sessions yet).
 */
async function getNextSessionNumber(
    ctx: AuthenticatedOrganizationContext,
    organizationId: OrganizationId,
): Promise<number> {
    const { _max } = await ctx.prisma.skillCheckSession.aggregate({
        where: { organizationId },
        _max: { sessionNumber: true },
    });
    return (_max.sessionNumber ?? 0) + 1;
}

/**
 * Create a skill check session, assigning it the next available `sessionNumber` for the
 * organization. Two concurrent creates can race for the same number; if the unique constraint on
 * `[organizationId, sessionNumber]` is violated, retries with the next number instead.
 * @param ctx The TRPC context.
 * @param organizationId The organization to create the session in.
 * @param buildData Builds the full create payload given the session number assigned to it.
 * @returns The created session, including its assessors.
 */
async function createSessionWithNextNumber(
    ctx: AuthenticatedOrganizationContext,
    organizationId: OrganizationId,
    buildData: (sessionNumber: number) => Prisma.SkillCheckSessionUncheckedCreateInput,
): Promise<
    Prisma.SkillCheckSessionGetPayload<{
        include: { assessors: { select: { id: true; name: true } } };
    }>
> {
    let sessionNumber = await getNextSessionNumber(ctx, organizationId);

    for (let attempt = 1; attempt <= MAX_SESSION_NUMBER_ATTEMPTS; attempt++) {
        try {
            return await ctx.prisma.skillCheckSession.create({
                data: buildData(sessionNumber),
                include: {
                    assessors: {
                        select: { id: true, name: true },
                    },
                },
            });
        } catch (error) {
            const isConflict =
                error instanceof Object &&
                "code" in error &&
                error.code === "P2002" &&
                attempt < MAX_SESSION_NUMBER_ATTEMPTS;
            if (!isConflict) throw error;
            sessionNumber++;
        }
    }
    throw new Error("unreachable");
}
