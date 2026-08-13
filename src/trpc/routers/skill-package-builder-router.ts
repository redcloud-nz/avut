/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";

import { AuthenticatedOrganizationContext, createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const skillPackageBuilderRouter = createTrpcRouter({
    /**
     * Archive the specified skill, marking it as archived but not deleting it from the database. Only skills with status "Active" can be archived.
     * @param skillId The ID of the skill to archive.
     * @return The updated skill with status "Archived".
     * @throws TRPCError(NOT_FOUND) if the skill does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill is not in "Active" status.
     */
    archiveSkill: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillId: SkillId.schema }))
        .output(z.object({ updated: Skill.schema }))
        .mutation(async ({ ctx, input: { skillId } }) => {
            const existingSkill = await getSkillOrThrow(ctx, skillId);

            if (existingSkill.status != "Active")
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Skill(${skillId}) with status ${existingSkill.status} cannot be archived. Only skills with status Active can be archived.`,
                });

            const [updated] = await Promise.all([
                ctx.prisma.skill.update({
                    where: { id: skillId },
                    data: { status: "Archived" },
                }),
                ctx.logEvent({
                    action: "Archive",
                    objectType: "Skill",
                    objectId: skillId,
                }),
            ]);
            return { updated: Skill.fromRecord(updated) };
        }),

    /**
     * Archive the specified skill group, marking it as archived but not deleting it from the database. Only groups with status "Active" can be archived.
     * @param skillGroupId The ID of the skill group to archive.
     * @return The updated skill group with status "Archived".
     * @throws TRPCError(NOT_FOUND) if the skill group does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill group is not in "Active" status.
     */
    archiveGroup: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillGroupId: SkillGroupId.schema }))
        .output(z.object({ updated: SkillGroup.schema }))
        .mutation(async ({ ctx, input: { skillGroupId } }) => {
            const existingGroup = await getSkillGroupOrThrow(ctx, skillGroupId);

            if (existingGroup.status != "Active")
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `SkillGroup(${skillGroupId}) with status ${existingGroup.status} cannot be archived. Only groups with status Active can be archived.`,
                });

            const [updated] = await Promise.all([
                ctx.prisma.skillGroup.update({
                    where: { id: skillGroupId },
                    data: { status: "Archived" },
                }),
                ctx.logEvent({
                    action: "Archive",
                    objectType: "SkillGroup",
                    objectId: skillGroupId,
                }),
            ]);
            return { updated: SkillGroup.fromRecord(updated) };
        }),

    /**
     * Archive the specified skill package, marking it as archived but not deleting it from the database. Only packages with status "Active" can be archived.
     * @param skillPackageId The ID of the skill package to archive.
     * @return The updated skill package with status "Archived".
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill package is not in "Active" status.
     */
    archivePackage: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(z.object({ updated: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId } }) => {
            const existingPackage = await getSkillPackageOrThrow(ctx, skillPackageId);

            if (existingPackage.status != "Active")
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `SkillPackage(${skillPackageId}) with status ${existingPackage.status} cannot be archived. Only packages with status Active can be archived.`,
                });

            const [updated] = await Promise.all([
                ctx.prisma.skillPackage.update({
                    where: { id: skillPackageId },
                    data: { status: "Archived" },
                }),
                ctx.logEvent({
                    action: "Archive",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                }),
            ]);
            return { updated: SkillPackage.fromRecord(updated) };
        }),

    /**
     * Create new new group within a skill package.
     * @param skillPackageId The ID of the skill package to add the group to.
     * @param skillGroupId The ID of the skill group to create.
     * @param create The skill group data to create.
     * @returns The created skill group.
     * @throws TRPCError(NOT_FOUND) if the specified skill package does not exist.
     */
    createGroup: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
                skillGroupId: SkillGroupId.schema,
                create: SkillGroup.modifiableSchema,
            }),
        )
        .output(z.object({ created: SkillGroup.schema }))
        .mutation(
            async ({ ctx, input: { organizationId, skillGroupId, skillPackageId, create } }) => {
                // Verify the skill package exists in the organization
                const skillPackage = await ctx.prisma.skillPackage.findUnique({
                    where: {
                        id: skillPackageId,
                        organizationId,
                    },
                    include: {
                        groups: {
                            select: {
                                sequence: true,
                            },
                        },
                    },
                });

                if (!skillPackage) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillPackageNotFound(skillPackageId),
                    });
                }

                // Determine the highest sequence number among existing groups in the package
                const highestSequenceNumber = skillPackage.groups.reduce(
                    (max, group) => Math.max(max, group.sequence),
                    0,
                );

                const diff = diffObject({}, create);

                const [created] = await Promise.all([
                    ctx.prisma.skillGroup.create({
                        data: {
                            skillPackageId,
                            id: skillGroupId,
                            sequence: highestSequenceNumber + 1,
                            ...create,
                        },
                    }),
                    ctx.logEvent({
                        action: "Create",
                        objectType: "SkillGroup",
                        objectId: skillGroupId,
                        changes: diff,
                    }),
                ]);

                return { created: SkillGroup.fromRecord(created) };
            },
        ),

    /**
     * Create a new skill package.
     * @param skillPackageId The ID of the skill package to create.
     * @param create The skill package data to create.
     * @returns The created skill package.
     */
    createPackage: organizationProcedure({ skillPackageBuilder: ["create"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
                create: SkillPackage.modifiableSchema,
            }),
        )
        .output(z.object({ created: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillPackageId, create } }) => {
            const diff = diffObject({}, create);

            const [created] = await Promise.all([
                ctx.prisma.skillPackage.create({
                    data: {
                        id: skillPackageId,
                        organizationId,
                        ...create,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                    changes: diff,
                }),
            ]);

            return { created: SkillPackage.fromRecord(created) };
        }),

    /**
     * Create a new skill within a skill package and optionally a skill group.
     * @param input The skill data.
     * @returns The created skill.
     */
    createSkill: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(
            z.object({
                skillId: SkillId.schema,
                skillPackageId: SkillPackageId.schema,
                skillGroupId: SkillGroupId.schema,
                create: Skill.modifiableSchema,
            }),
        )
        .output(z.object({ created: Skill.schema }))
        .mutation(
            async ({
                ctx,
                input: { organizationId, skillId, skillPackageId, skillGroupId, create },
            }) => {
                const skillGroup = await ctx.prisma.skillGroup.findUnique({
                    where: {
                        id: skillGroupId,
                        skillPackage: {
                            id: skillPackageId,
                            organizationId,
                        },
                    },
                    include: {
                        skillPackage: true,
                        skills: {
                            select: { sequence: true },
                        },
                    },
                });

                if (!skillGroup) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillGroupNotFound(skillGroupId),
                    });
                }

                const highestSequenceNumber = Math.max(
                    ...skillGroup.skills.map((s) => s.sequence),
                    0,
                );

                const diff = diffObject({}, create);

                const [created] = await Promise.all([
                    ctx.prisma.skill.create({
                        data: {
                            id: skillId,
                            skillPackageId,
                            skillGroupId,
                            sequence: highestSequenceNumber + 1,
                            ...create,
                        },
                    }),
                    ctx.logEvent({
                        action: "Create",
                        objectType: "Skill",
                        objectId: skillId,
                        changes: diff,
                    }),
                ]);

                return { created: Skill.fromRecord(created) };
            },
        ),

    /**
     * Delete the specified skill group and all associated skills.
     * @param skillGroupId The ID of the skill group to delete.
     * @throws TRPCError(NOT_FOUND) if the skill group does not exist.
     */
    deleteGroup: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillGroupId: SkillGroupId.schema }))
        .output(z.object({ deleted: SkillGroup.schema }))
        .mutation(async ({ ctx, input: { skillGroupId } }) => {
            // Verify the skill group exists and belongs to the organization before attempting deletion
            const skillGroup = await getSkillGroupOrThrow(ctx, skillGroupId);

            // TODO Check if the group contains skills that have recorded checks. If so only mark as deleted instead of actually deleting.

            await Promise.all([
                ctx.prisma.skillGroup.delete({
                    where: { id: skillGroupId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "SkillGroup",
                    objectId: skillGroupId,
                }),
            ]);
            return { deleted: skillGroup };
        }),

    /**
     * Delete the specified skill package and all associated groups and skills.
     * @param skillPackageId The ID of the skill package to delete.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist.
     */
    deletePackage: organizationProcedure({ skillPackageBuilder: ["delete"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(z.object({ deleted: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId } }) => {
            // Verify the skill package exists before attempting deletion
            const skillPackage = await getSkillPackageOrThrow(ctx, skillPackageId);

            // TODO Check if the package contains skills that have recorded checks. If so only mark as deleted instead of actually deleting.

            await Promise.all([
                ctx.prisma.skillPackage.delete({
                    where: { id: skillPackageId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                }),
            ]);
            return { deleted: skillPackage };
        }),

    /**
     * Delete the specified skill.
     * @param skillId The ID of the skill to delete.
     * @throws TRPCError(NOT_FOUND) if the skill does not exist.
     */
    deleteSkill: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillId: SkillId.schema }))
        .output(z.object({ deleted: Skill.schema }))
        .mutation(async ({ ctx, input: { skillId } }) => {
            // Verify the skill exists and belongs to the organization before attempting deletion
            const skill = await getSkillOrThrow(ctx, skillId);

            await Promise.all([
                ctx.prisma.skill.delete({
                    where: { id: skillId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "Skill",
                    objectId: skillId,
                }),
            ]);
            return { deleted: skill };
        }),

    /**
     * Get a single skill group by ID, including its parent skill package.
     * @param skillGroupId The ID of the skill group to retrieve.
     * @returns The skill group with its parent skill package.
     * @throws TRPCError(NOT_FOUND) if the skill group does not exist or does not belong to the organization.
     */
    getGroup: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(z.object({ skillGroupId: SkillGroupId.schema }))
        .output(SkillGroup.schema.extend({ skillPackage: SkillPackage.schema }))
        .query(async ({ ctx, input: { organizationId, skillGroupId } }) => {
            const group = await ctx.prisma.skillGroup.findUnique({
                where: {
                    id: skillGroupId,
                    skillPackage: { organizationId },
                },
                include: { skillPackage: true },
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
            };
        }),

    /**
     * Get a single skill package by ID.
     * @param skillPackageId The ID of the skill package to retrieve.
     * @returns The skill package.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or does not belong to the organization.
     */
    getPackage: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(SkillPackage.schema)
        .query(async ({ ctx, input: { skillPackageId } }) =>
            getSkillPackageOrThrow(ctx, skillPackageId),
        ),

    /**
     * Get a single skill by ID, including its parent skill group and skill package.
     * @param skillId The ID of the skill to retrieve.
     * @returns The skill with its parent skill group and skill package.
     * @throws TRPCError(NOT_FOUND) if the skill does not exist or does not belong to the organization.
     */
    getSkill: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(z.object({ skillId: SkillId.schema }))
        .output(
            Skill.schema.extend({
                skillGroup: SkillGroup.schema,
                skillPackage: SkillPackage.schema,
            }),
        )
        .query(async ({ ctx, input: { organizationId, skillId } }) => {
            const skill = await ctx.prisma.skill.findUnique({
                where: {
                    id: skillId,
                    skillPackage: { organizationId },
                },
                include: { skillGroup: true, skillPackage: true },
            });

            if (!skill) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillNotFound(skillId),
                });
            }

            return {
                ...Skill.fromRecord(skill),
                skillGroup: SkillGroup.fromRecord(skill.skillGroup),
                skillPackage: SkillPackage.fromRecord(skill.skillPackage),
            };
        }),

    /**
     * List all skill groups within the organization, optionally filtered by skill package.
     * @param skillPackageId Skill package ID to filter groups by.
     * @returns An array of skill groups.
     */
    listGroups: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
            }),
        )
        .output(z.array(SkillGroup.schema))
        .query(async ({ ctx, input: { organizationId, skillPackageId } }) => {
            const skillGroups = await ctx.prisma.skillGroup.findMany({
                where: {
                    skillPackage: {
                        organizationId,
                        id: skillPackageId,
                    },
                },
            });

            return skillGroups.map(SkillGroup.fromRecord);
        }),

    /**
     * List all skill packages owned by the organization.
     * @returns An array of skill packages.
     */
    listPackages: organizationProcedure({ skillPackageBuilder: ["view"] })
        .output(z.array(SkillPackage.schema))
        .query(async ({ ctx, input: { organizationId } }) => {
            const skillPackages = await ctx.prisma.skillPackage.findMany({
                where: {
                    organizationId,
                },
            });

            return skillPackages.map(SkillPackage.fromRecord);
        }),

    /**
     * List all skills within the organization, optionally filtered by skill package and/or skill group.
     * @param skillPackageId Skill package ID to filter skills by.
     * @returns An array of skills.
     */
    listSkills: organizationProcedure({ skillPackageBuilder: ["view"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
            }),
        )
        .output(z.array(Skill.schema))
        .query(async ({ ctx, input: { organizationId, skillPackageId } }) => {
            const skills = await ctx.prisma.skill.findMany({
                where: {
                    skillPackage: {
                        organizationId,
                        id: skillPackageId,
                    },
                },
            });

            return skills.map(Skill.fromRecord);
        }),

    /**
     * Move a skill to a different skill group within the same skill package.
     * @param skillId The ID of the skill to move.
     * @param targetGroupId The ID of the skill group to move the skill to.
     * @throws TRPCError(NOT_FOUND) if the skill or target skill group does not exist or does not belong to the organization.
     */
    moveSkill: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(
            z.object({
                skillId: SkillId.schema,
                destinationPackageId: SkillPackageId.schema,
                destinationGroupId: SkillGroupId.schema,
            }),
        )
        .mutation(async ({ ctx, input: { skillId, destinationPackageId, destinationGroupId } }) => {
            const [skill, destinationGroup] = await Promise.all([
                getSkillOrThrow(ctx, skillId),
                getSkillGroupOrThrow(ctx, destinationGroupId),
            ]);

            if (destinationGroup.skillPackageId !== destinationPackageId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Target group does not belong to the specified destination package.`,
                });
            }

            const changes = diffObject(
                {
                    skillGroupId: skill.skillGroupId,
                    skillPackageId: skill.skillPackageId,
                },
                {
                    skillGroupId: destinationGroupId,
                    skillPackageId: destinationPackageId,
                },
            );

            const [updated] = await Promise.all([
                ctx.prisma.skill.update({
                    where: { id: skillId },
                    data: {
                        skillGroupId: destinationGroupId,
                        skillPackageId: destinationPackageId,
                    },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "Skill",
                    objectId: skillId,
                    description: `Moved skill to group ${destinationGroup.name}`,
                    changes,
                }),
            ]);

            return { updated: Skill.fromRecord(updated) };
        }),

    /**
     * Publish the specified skill package, making it available for use. Only packages with status "Active" can be published.
     * @param skillPackageId The ID of the skill package to publish.
     * @return The updated skill package with published set to true.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill package is not in "Active" status.
     * @throws TRPCError(BAD_REQUEST) if the skill package is already published.
     */
    publishPackage: organizationProcedure({ skillPackageBuilder: ["publish"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(z.object({ published: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId } }) => {
            const existingPackage = await getSkillPackageOrThrow(ctx, skillPackageId);

            if (existingPackage.status != "Active")
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `SkillPackage(${skillPackageId}) with status ${existingPackage.status} cannot be published. Only packages with status Active can be published.`,
                });

            if (existingPackage.published)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `SkillPackage(${skillPackageId}) is already published.`,
                });

            const [published] = await Promise.all([
                ctx.prisma.skillPackage.update({
                    where: { id: skillPackageId },
                    data: { published: true },
                }),
                ctx.logEvent({
                    action: "Publish",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                }),
            ]);
            return { published: SkillPackage.fromRecord(published) };
        }),

    /**
     * Reorder skill groups within a skill package.
     * @param skillPackageId The ID of the skill package.
     * @param newOrder An array of skill group IDs representing the new order.
     * @returns An object indicating the success of the operation.
     */
    reorderGroups: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
                newOrder: z.array(SkillGroupId.schema),
            }),
        )
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ ctx, input: { skillPackageId, newOrder } }) => {
            const skillPackage = await ctx.prisma.skillPackage.findUnique({
                where: {
                    id: skillPackageId,
                    organizationId: ctx.organizationId,
                },
                include: {
                    groups: {
                        select: { id: true, sequence: true },
                    },
                },
            });

            if (!skillPackage)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillPackageNotFound(skillPackageId),
                });

            const toUpdate: { id: SkillGroupId; sequence: number }[] = [];

            newOrder.forEach((groupId, index) => {
                const group = skillPackage.groups.find((g) => g.id === groupId);

                if (group && group.sequence != index + 1) {
                    toUpdate.push({ id: groupId, sequence: index + 1 });
                }
            });

            if (toUpdate.length > 0) {
                await Promise.all(
                    toUpdate.map(({ id, sequence }) =>
                        ctx.prisma.skillGroup.update({
                            where: { id },
                            data: { sequence },
                        }),
                    ),
                );
            }

            return { success: true };
        }),

    /**
     * Reorder skills within a skill group.
     * @param skillGroupId The ID of the skill group.
     * @param newOrder An array of skill IDs representing the new order.
     * @returns An object indicating the success of the operation.
     */
    reorderGroupSkills: organizationProcedure({
        skillPackageBuilder: ["update"],
    })
        .input(
            z.object({
                skillGroupId: SkillGroupId.schema,
                newOrder: z.array(SkillId.schema),
            }),
        )
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ ctx, input: { skillGroupId, newOrder } }) => {
            const group = await ctx.prisma.skillGroup.findUnique({
                where: {
                    id: skillGroupId,
                    skillPackage: {
                        organizationId: ctx.organizationId,
                    },
                },
                include: {
                    skills: {
                        select: { id: true, sequence: true },
                    },
                },
            });

            if (!group)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillGroupNotFound(skillGroupId),
                });

            const toUpdate: { id: SkillId; sequence: number }[] = [];

            newOrder.forEach((skillId, index) => {
                const skill = group.skills.find((s) => s.id === skillId);

                if (skill && skill.sequence != index + 1) {
                    toUpdate.push({ id: skillId, sequence: index + 1 });
                }
            });

            if (toUpdate.length > 0) {
                await Promise.all(
                    toUpdate.map(({ id, sequence }) =>
                        ctx.prisma.skill.update({
                            where: { id },
                            data: { sequence },
                        }),
                    ),
                );
            }

            return { success: true };
        }),

    /**
     * Restore the specified skill, changing its status from "Archived" or "Deleted" back to "Active". Only skills with status "Archived" or "Deleted" can be restored.
     * @param skillId The ID of the skill to restore.
     * @return The updated skill with status "Active".
     * @throws TRPCError(NOT_FOUND) if the skill does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill is not in "Archived" or "Deleted" status.
     */
    restoreSkill: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillId: SkillId.schema }))
        .output(z.object({ updated: Skill.schema }))
        .mutation(async ({ ctx, input: { skillId } }) => {
            const existingSkill = await getSkillOrThrow(ctx, skillId);

            if (!["Archived", "Deleted"].includes(existingSkill.status))
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Skill(${skillId}) with status ${existingSkill.status} cannot be restored. Only skills with status 'Archived' or 'Deleted' can be restored.`,
                });

            const [updated] = await Promise.all([
                ctx.prisma.skill.update({
                    where: { id: skillId },
                    data: { status: "Active" },
                }),
                ctx.logEvent({
                    action: "Restore",
                    objectType: "Skill",
                    objectId: skillId,
                }),
            ]);
            return { updated: Skill.fromRecord(updated) };
        }),

    /**
     * Restore the specified skill group, changing its status from "Archived" or "Deleted" back to "Active". Only groups with status "Archived" or "Deleted" can be restored.
     * @param skillGroupId The ID of the skill group to restore.
     * @return The updated skill group with status "Active".
     * @throws TRPCError(NOT_FOUND) if the skill group does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill group is not in "Archived" or "Deleted" status.
     */
    restoreGroup: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillGroupId: SkillGroupId.schema }))
        .output(z.object({ updated: SkillGroup.schema }))
        .mutation(async ({ ctx, input: { skillGroupId } }) => {
            const existingGroup = await getSkillGroupOrThrow(ctx, skillGroupId);

            if (!["Archived", "Deleted"].includes(existingGroup.status))
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `SkillGroup(${skillGroupId}) with status ${existingGroup.status} cannot be restored. Only groups with status 'Archived' or 'Deleted' can be restored.`,
                });

            const [updated] = await Promise.all([
                ctx.prisma.skillGroup.update({
                    where: { id: skillGroupId },
                    data: { status: "Active" },
                }),
                ctx.logEvent({
                    action: "Restore",
                    objectType: "SkillGroup",
                    objectId: skillGroupId,
                }),
            ]);
            return { updated: SkillGroup.fromRecord(updated) };
        }),

    /**
     * Restore the specified skill package, changing its status from "Archived" or "Deleted" back to "Active". Only packages with status "Archived" or "Deleted" can be restored.
     * @param skillPackageId The ID of the skill package to restore.
     * @return The updated skill package with status "Active".
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill package is not in "Archived" or "Deleted" status.
     */
    restorePackage: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(z.object({ updated: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId } }) => {
            const existingPackage = await getSkillPackageOrThrow(ctx, skillPackageId);

            if (!["Archived", "Deleted"].includes(existingPackage.status))
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `SkillPackage(${skillPackageId}) with status ${existingPackage.status} cannot be restored. Only packages with status 'Archived' or 'Deleted' can be restored.`,
                });

            const [updated] = await Promise.all([
                ctx.prisma.skillPackage.update({
                    where: { id: skillPackageId },
                    data: { status: "Active" },
                }),
                ctx.logEvent({
                    action: "Restore",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                }),
            ]);
            return { updated: SkillPackage.fromRecord(updated) };
        }),

    /**
     * Unpublish the specified skill package, making it unavailable for use. Only packages that are currently published can be unpublished.
     * @param skillPackageId The ID of the skill package to unpublish.
     * @return The updated skill package with published set to false.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist or does not belong to the organization.
     * @throws TRPCError(BAD_REQUEST) if the skill package is not published.
     */
    unpublishPackage: organizationProcedure({
        skillPackageBuilder: ["publish"],
    })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(z.object({ unpublished: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId } }) => {
            const existingPackage = await getSkillPackageOrThrow(ctx, skillPackageId);

            if (!existingPackage.published)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `SkillPackage(${skillPackageId}) is not published.`,
                });

            const [unpublished] = await Promise.all([
                ctx.prisma.skillPackage.update({
                    where: { id: skillPackageId },
                    data: { published: false },
                }),
                ctx.logEvent({
                    action: "Unpublish",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                }),
            ]);
            return { unpublished: SkillPackage.fromRecord(unpublished) };
        }),

    /**
     * Update the specified skill group.
     * @param skillGroupId The ID of the skill group to update.
     * @param update The fields to update on the skill group.
     * @returns The updated skill group.
     * @throws TRPCError(NOT_FOUND) if the skill group does not exist.
     */
    updateGroup: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(
            z.object({
                skillGroupId: SkillGroupId.schema,
                update: SkillGroup.modifiableSchema,
            }),
        )
        .output(z.object({ updated: SkillGroup.schema }))
        .mutation(async ({ ctx, input: { skillGroupId, update } }) => {
            const existingGroup = await getSkillGroupOrThrow(ctx, skillGroupId);

            const diff = diffObject(SkillGroup.modifiableSchema.parse(existingGroup), update);

            const [updated] = await Promise.all([
                ctx.prisma.skillGroup.update({
                    where: { id: skillGroupId },
                    data: update,
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "SkillGroup",
                    objectId: skillGroupId,
                    changes: diff,
                }),
            ]);

            return { updated: SkillGroup.fromRecord(updated) };
        }),

    /**
     * Update the specified skill package.
     * @param skillPackageId The ID of the skill package to update.
     * @param update The fields to update on the skill package.
     * @returns The updated skill package.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist.
     */
    updatePackage: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
                update: SkillPackage.modifiableSchema,
            }),
        )
        .output(z.object({ updated: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId, update } }) => {
            const existingPackage = await getSkillPackageOrThrow(ctx, skillPackageId);

            const diff = diffObject(SkillPackage.modifiableSchema.parse(existingPackage), update);

            const [updated] = await Promise.all([
                ctx.prisma.skillPackage.update({
                    where: { id: skillPackageId },
                    data: update,
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "SkillPackage",
                    objectId: skillPackageId,
                    changes: diff,
                }),
            ]);

            return { updated: SkillPackage.fromRecord(updated) };
        }),

    /**
     * Update the specified skill.
     * @param skillId The ID of the skill to update.
     * @param update The fields to update on the skill.
     * @returns The updated skill.
     * @throws TRPCError(NOT_FOUND) if the skill does not exist.
     */
    updateSkill: organizationProcedure({ skillPackageBuilder: ["update"] })
        .input(
            z.object({
                skillId: SkillId.schema,
                update: Skill.modifiableSchema,
            }),
        )
        .output(z.object({ updated: Skill.schema }))
        .mutation(async ({ ctx, input: { skillId, update } }) => {
            const existingSkill = await getSkillOrThrow(ctx, skillId);

            const diff = diffObject(Skill.modifiableSchema.parse(existingSkill), update);

            const [updated] = await Promise.all([
                ctx.prisma.skill.update({
                    where: { id: skillId },
                    data: update,
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "Skill",
                    objectId: skillId,
                    changes: diff,
                }),
            ]);

            return { updated: Skill.fromRecord(updated) };
        }),
});

/**
 * Utility function to retrieve a skill by ID and ensure it belongs to the organization, throwing a TRPCError if not found.
 * @param ctx The authenticated organization context.
 * @param skillId The ID of the skill to retrieve.
 * @returns The skill record if found.
 * @throws TRPCError(NOT_FOUND) if the skill does not exist or does not belong to the organization.
 */
async function getSkillOrThrow(
    ctx: AuthenticatedOrganizationContext,
    skillId: SkillId,
): Promise<Skill> {
    const existingSkill = await ctx.prisma.skill.findUnique({
        where: {
            id: skillId,
            skillPackage: {
                organizationId: ctx.organizationId,
            },
        },
    });

    if (!existingSkill) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: Messages.skillNotFound(skillId),
        });
    }

    return Skill.fromRecord(existingSkill);
}

/**
 * Utility function to retrieve a skill group by ID and ensure it belongs to the organization, throwing a TRPCError if not found.
 * @param ctx The authenticated organization context.
 * @param skillGroupId The ID of the skill group to retrieve.
 * @returns The skill group record if found.
 * @throws TRPCError(NOT_FOUND) if the skill group does not exist or does not belong to the organization.
 */
async function getSkillGroupOrThrow(
    ctx: AuthenticatedOrganizationContext,
    skillGroupId: SkillGroupId,
): Promise<SkillGroup> {
    const existingGroup = await ctx.prisma.skillGroup.findUnique({
        where: {
            id: skillGroupId,
            skillPackage: {
                organizationId: ctx.organizationId,
            },
        },
    });

    if (!existingGroup) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: Messages.skillGroupNotFound(skillGroupId),
        });
    }

    return SkillGroup.fromRecord(existingGroup);
}

/**
 * Utility function to retrieve a skill package by ID and ensure it belongs to the organization, throwing a TRPCError if not found.
 * @param ctx The authenticated organization context.
 * @param skillPackageId The ID of the skill package to retrieve.
 * @returns The skill package record if found.
 * @throws TRPCError(NOT_FOUND) if the skill package does not exist or does not belong to the organization.
 */
async function getSkillPackageOrThrow(
    ctx: AuthenticatedOrganizationContext,
    skillPackageId: SkillPackageId,
): Promise<SkillPackage> {
    const existingPackage = await ctx.prisma.skillPackage.findUnique({
        where: {
            id: skillPackageId,
            organizationId: ctx.organizationId,
        },
    });

    if (!existingPackage) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: Messages.skillPackageNotFound(skillPackageId),
        });
    }

    return SkillPackage.fromRecord(existingPackage);
}
