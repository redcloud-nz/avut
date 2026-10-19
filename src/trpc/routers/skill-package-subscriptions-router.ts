/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { Prisma } from "@/generated/prisma/client";
import { OrganizationRef } from "@/lib/schemas/organization";
import { Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import {
    availableSkillPackageWhere,
    SkillPackage,
    SkillPackageId,
} from "@/lib/schemas/skill-package";
import {
    SkillPackageSubscription,
    SkillPackageSubscriptionId,
} from "@/lib/schemas/skill-package-subscription";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * The catalogue-facing shape of a package's skills and groups: names, descriptions, ordering,
 * and default include/required flags only. The pick keeps the catalogue contents payload small;
 * the fields it leaves out aren't sensitive (`getSkill` returns them in full).
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
 * Prisma `where` for the packages an organization's catalogue shows: every available package
 * (see `SkillPackage.isAvailable`), plus any withdrawn (unpublished or Archived, but not Deleted)
 * package the organization still subscribes to, so it can find the package and unsubscribe.
 */
function catalogueSkillPackageWhere(organizationId: string) {
    return {
        OR: [
            availableSkillPackageWhere,
            { status: { not: "Deleted" }, subscriptions: { some: { organizationId } } },
        ],
    } satisfies Prisma.SkillPackageWhereInput;
}

/**
 * Router for managing skill package subscriptions and listing the groups and skills associated with the organization's subscribed skill packages.
 */
export const skillPackageSubscriptionsRouter = createTrpcRouter({
    /**
     * Get a single skill group by ID, with its skills, its package, and whether this organization
     * subscribes to that package. A group is visible when its package is in the catalogue (see
     * `catalogueSkillPackageWhere`): every available package, plus a withdrawn (unpublished or
     * Archived) package this organization still subscribes to. An Archived group is returned.
     * @param skillPackageId The ID of the package the group must belong to.
     * @param skillGroupId The ID of the skill group to retrieve.
     * @returns The skill group, plus `skillPackage`, `subscribed`, and `skills` (its non-Deleted
     *   skills, Archived included, in `sequence` order).
     * @throws TRPCError(NOT_FOUND) if the group doesn't exist, is Deleted, or belongs to a
     *   different package, or its package is Deleted, or withdrawn and this organization doesn't
     *   subscribe to it.
     */
    getGroup: organizationProcedure({ skillPackageSubscription: ["view"] })
        .input(
            z.object({ skillPackageId: SkillPackageId.schema, skillGroupId: SkillGroupId.schema }),
        )
        .output(
            SkillGroup.schema.extend({
                skillPackage: SkillPackage.schema,
                subscribed: z.boolean(),
                skills: z.array(Skill.schema),
            }),
        )
        .query(async ({ ctx, input: { organizationId, skillPackageId, skillGroupId } }) => {
            const group = await ctx.prisma.skillGroup.findFirst({
                where: {
                    id: skillGroupId,
                    skillPackageId,
                    status: { not: "Deleted" },
                    skillPackage: catalogueSkillPackageWhere(organizationId),
                },
                include: {
                    skills: { where: { status: { not: "Deleted" } }, orderBy: { sequence: "asc" } },
                    skillPackage: {
                        include: {
                            subscriptions: { where: { organizationId }, select: { id: true } },
                        },
                    },
                },
            });

            if (!group) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillGroupNotFound(skillGroupId),
                });
            }

            return {
                ...SkillGroup.fromRecord(group),
                skillPackage: SkillPackage.fromRecord(group.skillPackage),
                subscribed: group.skillPackage.subscriptions.length > 0,
                skills: group.skills.map(Skill.fromRecord),
            };
        }),

    /**
     * Get a single catalogue skill package by ID, including this organization's subscription
     * status and package-level counts. The catalogue holds every available package, plus any
     * withdrawn (unpublished or Archived) package this organization still subscribes to, so a
     * subscriber can open it and unsubscribe.
     * @param skillPackageId The ID of the skill package to retrieve.
     * @returns The skill package with organization, subscription, skillCount, subscriptionCount,
     *   and its active groups (each with its active skills) for the catalogue contents view.
     * @throws TRPCError(NOT_FOUND) if the package doesn't exist, is Deleted, or is withdrawn and
     *   this organization doesn't subscribe to it.
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
                    ...catalogueSkillPackageWhere(organizationId),
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
     * Get a single skill by ID, with its group, its package, and whether this organization
     * subscribes to that package. A skill is visible when its package is in the catalogue (see
     * `catalogueSkillPackageWhere`): every available package, plus a withdrawn (unpublished or
     * Archived) package this organization still subscribes to. An Archived skill is returned.
     * @param skillId The ID of the skill to retrieve.
     * @returns The skill, plus `group` (its skill group, or null when that group is Deleted; the
     *   key is `group`, as in the Skills list's rows, not Prisma's `skillGroup`), `skillPackage`,
     *   and `subscribed`.
     * @throws TRPCError(NOT_FOUND) if the skill doesn't exist or is Deleted, or its package is
     *   Deleted, or withdrawn and this organization doesn't subscribe to it.
     */
    getSkill: organizationProcedure({ skillPackageSubscription: ["view"] })
        .input(z.object({ skillId: SkillId.schema }))
        .output(
            Skill.schema.extend({
                group: SkillGroup.schema.nullable(),
                skillPackage: SkillPackage.schema,
                subscribed: z.boolean(),
            }),
        )
        .query(async ({ ctx, input: { organizationId, skillId } }) => {
            const skill = await ctx.prisma.skill.findFirst({
                where: {
                    id: skillId,
                    status: { not: "Deleted" },
                    skillPackage: catalogueSkillPackageWhere(organizationId),
                },
                include: {
                    skillGroup: true,
                    skillPackage: {
                        include: {
                            subscriptions: { where: { organizationId }, select: { id: true } },
                        },
                    },
                },
            });

            if (!skill) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillNotFound(skillId),
                });
            }

            return {
                ...Skill.fromRecord(skill),
                group:
                    skill.skillGroup.status === "Deleted"
                        ? null
                        : SkillGroup.fromRecord(skill.skillGroup),
                skillPackage: SkillPackage.fromRecord(skill.skillPackage),
                subscribed: skill.skillPackage.subscriptions.length > 0,
            };
        }),

    /**
     * List the skills that are assessable for this organization based on their current skill package subscriptions.
     * Only available packages count (see `SkillPackage.isAvailable`): a withdrawn package's skills are left out.
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
                    skillPackage: availableSkillPackageWhere,
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
     * List the catalogue: every available package (see `SkillPackage.isAvailable`), plus any
     * withdrawn (unpublished or Archived) package this organization still subscribes to, so it can
     * find the package and unsubscribe.
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
            const cataloguePackages = await ctx.prisma.skillPackage.findMany({
                where: catalogueSkillPackageWhere(organizationId),
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

            return cataloguePackages.map((pkg) => ({
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
     * Only available packages are listed (see `SkillPackage.isAvailable`); a withdrawn subscription is left out.
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
                    skillPackage: availableSkillPackageWhere,
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
     * Subscribe the organization to the specified skill package, allowing access to the skills within the package. The package must be available (published and `Active`, see `SkillPackage.isAvailable`) and not already subscribed to by the organization.
     * @param skillPackageId The ID of the skill package to subscribe to.
     * @returns The created skill package subscription.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or is not available.
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
            // Check if the package exists and is available
            const skillPackage = await ctx.prisma.skillPackage.findUnique({
                where: {
                    id: skillPackageId,
                },
            });

            if (!skillPackage || !SkillPackage.isAvailable(skillPackage)) {
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
