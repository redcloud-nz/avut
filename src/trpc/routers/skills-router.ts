/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import {
    SkillPackageSubscription,
    SkillPackageSubscriptionId,
} from "@/lib/schemas/skill-package-subscription";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * Router for managing skill package subscriptions and listing the groups and skills associated with the organization's subscribed skill packages.
 */
export const skillsRouter = createTrpcRouter({
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
                        ? SkillPackageSubscription.fromRecord(
                              pkg.subscriptions[0],
                          )
                        : null,
            }));
        }),

    listSubscribedPackages: organizationProcedure({}).query(
        async ({ ctx, input: { organizationId } }) => {
            const subscriptions =
                await ctx.prisma.skillPackageSubscription.findMany({
                    where: {
                        organizationId,
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
                organization: {
                    id: sub.skillPackage.organization.id,
                    name: sub.skillPackage.organization.name,
                },
                subscription: SkillPackageSubscription.fromRecord(sub),
            }));
        },
    ),

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
        .mutation(
            async ({ ctx, input: { organizationId, skillPackageId } }) => {
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
                const existingSubscription =
                    await ctx.prisma.skillPackageSubscription.findUnique({
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
                        message: Messages.alreadySubscribedToPackage(
                            skillPackage.name,
                        ),
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
            },
        ),

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
        .mutation(
            async ({ ctx, input: { organizationId, skillPackageId } }) => {
                // Check if the subscription exists
                const existingSubscription =
                    await ctx.prisma.skillPackageSubscription.findUnique({
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
                    deleted:
                        SkillPackageSubscription.fromRecord(
                            existingSubscription,
                        ),
                };
            },
        ),
});
