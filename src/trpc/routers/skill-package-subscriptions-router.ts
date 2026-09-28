/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { OrganizationRef } from "@/lib/schemas/organization";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import {
    SkillPackageSubscription,
    SkillPackageSubscriptionId,
} from "@/lib/schemas/skill-package-subscription";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * The public, catalogue-facing shape of a package's skills and groups: names, descriptions,
 * ordering, and default include/required flags only — never `properties`, `tags`, or timestamps,
 * which must not leak to orgs that aren't subscribed.
 */
const catalogueSkillSchema = Skill.schema.pick({
    id: true,
    skillGroupId: true,
    name: true,
    description: true,
    sequence: true,
    defaultInclude: true,
    defaultRequired: true,
});

const catalogueGroupSchema = SkillGroup.schema
    .pick({
        id: true,
        name: true,
        description: true,
        sequence: true,
        defaultInclude: true,
    })
    .extend({ skills: z.array(catalogueSkillSchema) });

/**
 * Router for managing skill package subscriptions and listing the groups and skills associated with the organization's subscribed skill packages.
 */
export const skillPackageSubscriptionsRouter = createTrpcRouter({
    /**
     * Get a single published skill package by ID, including this organization's subscription
     * status and package-level counts.
     * @param skillPackageId The ID of the skill package to retrieve.
     * @returns The skill package with organization, subscription, skillCount, subscriptionCount,
     *   and its active groups (each with its active skills) for the catalogue contents view.
     * @throws TRPCError(NOT_FOUND) if the package doesn't exist or isn't published.
     *
     * Note: unlike the builder's `getPackage`, this response is NOT flat — a cache effect that
     * writes a mutation response wholesale into this query key would drop `groups`. Spread `old`.
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
                groups: z.array(catalogueGroupSchema),
            }),
        )
        .query(async ({ ctx, input: { organizationId, skillPackageId } }) => {
            const pkg = await ctx.prisma.skillPackage.findUnique({
                where: {
                    id: skillPackageId,
                    published: true,
                    status: { not: "Deleted" },
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
                    groups: {
                        where: { status: "Active" },
                        orderBy: { sequence: "asc" },
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            sequence: true,
                            defaultInclude: true,
                            skills: {
                                where: { status: "Active" },
                                orderBy: { sequence: "asc" },
                                select: {
                                    id: true,
                                    skillGroupId: true,
                                    name: true,
                                    description: true,
                                    sequence: true,
                                    defaultInclude: true,
                                    defaultRequired: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            subscriptions: true,
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
                // Derived from the loaded contents so the count can never disagree with what the
                // catalogue page renders (archived groups and their still-active skills are excluded).
                skillCount: pkg.groups.reduce((total, group) => total + group.skills.length, 0),
                subscriptionCount: pkg._count.subscriptions,
                subscription:
                    pkg.subscriptions.length > 0
                        ? SkillPackageSubscription.fromRecord(pkg.subscriptions[0])
                        : null,
                groups: pkg.groups,
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
                    skillPackage: { status: { not: "Deleted" } },
                },
                include: {
                    skillPackage: {
                        include: {
                            skills: { where: { status: { not: "Deleted" } } },
                            groups: { where: { status: { not: "Deleted" } } },
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
                    status: { not: "Deleted" },
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
                    skillPackage: { status: { not: "Deleted" } },
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

            if (!skillPackage || !skillPackage.published || skillPackage.status === "Deleted") {
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
});
