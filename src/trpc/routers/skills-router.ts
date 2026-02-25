/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";

import {
    AuthenticatedOrganizationContext,
    createTrpcRouter,
    organizationProcedure,
} from "../init";
import { Messages } from "../messages";

export const skillsRouter = createTrpcRouter({
    /**
     * Create new new group within a skill package.
     * @param input The skill group data.
     * @returns The created skill group.
     * @throws TRPCError(NOT_FOUND) if the specified skill package does not exist.
     */
    createGroup: organizationProcedure({ skillPackage: ["update"] })
        .input(
            SkillGroup.modifiableSchema.extend({
                id: SkillGroupId.schema,
                skillPackageId: SkillPackageId.schema,
            }),
        )
        .output(z.object({ created: SkillGroup.schema }))
        .mutation(
            async ({
                ctx,
                input: { organizationId, id: skillGroupId, ...fields },
            }) => {
                // Verify the skill package exists in the organization
                const skillPackage = await ctx.prisma.skillPackage.findUnique({
                    where: {
                        id: fields.skillPackageId,
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
                        message: Messages.skillPackageNotFound(
                            fields.skillPackageId,
                        ),
                    });
                }

                // Determine the highest sequence number among existing groups in the package
                const highestSequenceNumber = skillPackage.groups.reduce(
                    (max, group) => Math.max(max, group.sequence),
                    0,
                );

                const diff = diffObject({}, fields);

                const [created] = await Promise.all([
                    ctx.prisma.skillGroup.create({
                        data: {
                            id: skillGroupId,
                            sequence: highestSequenceNumber + 1,
                            ...fields,
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
     * @param input The skill package data.
     * @returns The created skill package.
     */
    createPackage: organizationProcedure({ skillPackage: ["create"] })
        .input(
            SkillPackage.modifiableSchema.extend({
                id: SkillPackageId.schema,
            }),
        )
        .output(z.object({ created: SkillPackage.schema }))
        .mutation(
            async ({
                ctx,
                input: { organizationId, id: skillPackageId, ...fields },
            }) => {
                const diff = diffObject({}, fields);

                const [created] = await Promise.all([
                    ctx.prisma.skillPackage.create({
                        data: {
                            id: skillPackageId,
                            organizationId,
                            ...fields,
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
            },
        ),

    /**
     * Create a new skill within a skill package and optionally a skill group.
     * @param input The skill data.
     * @returns The created skill.
     */
    createSkill: organizationProcedure({ skillPackage: ["update"] })
        .input(
            Skill.modifiableSchema.extend({
                id: SkillId.schema,
                skillPackageId: SkillPackageId.schema,
                skillGroupId: SkillGroupId.schema.nullable(),
            }),
        )
        .output(z.object({ created: Skill.schema }))
        .mutation(
            async ({
                ctx,
                input: {
                    organizationId,
                    id: skillId,
                    skillPackageId,
                    skillGroupId,
                    ...fields
                },
            }) => {
                const [skillPackage, skillGroup] = await Promise.all([
                    ctx.prisma.skillPackage.findUnique({
                        where: {
                            id: skillPackageId,
                            organizationId,
                        },
                        include: {
                            skills: {
                                select: {
                                    sequence: true,
                                },
                            },
                        },
                    }),
                    skillGroupId
                        ? ctx.prisma.skillGroup.findUnique({
                              where: {
                                  id: skillGroupId,
                                  skillPackageId: skillPackageId,
                              },
                              include: {
                                  skills: {
                                      select: {
                                          sequence: true,
                                      },
                                  },
                              },
                          })
                        : Promise.resolve(null),
                ]);

                if (!skillPackage) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillPackageNotFound(skillPackageId),
                    });
                }

                if (skillGroupId && !skillGroup) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillGroupNotFound(skillGroupId),
                    });
                }

                const highestSequenceNumber = skillGroup
                    ? Math.max(...skillGroup.skills.map((s) => s.sequence), 0)
                    : Math.max(
                          ...skillPackage.skills.map((s) => s.sequence),
                          0,
                      );

                const diff = diffObject({}, fields);

                const [created] = await Promise.all([
                    ctx.prisma.skill.create({
                        data: {
                            id: skillId,
                            skillPackageId,
                            skillGroupId,
                            sequence: highestSequenceNumber + 1,
                            ...fields,
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
    deleteGroup: organizationProcedure({ skillPackage: ["update"] })
        .input(z.object({ skillGroupId: SkillGroupId.schema }))
        .output(z.object({ deleted: SkillGroup.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillGroupId } }) => {
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
    deletePackage: organizationProcedure({ skillPackage: ["delete"] })
        .input(z.object({ skillPackageId: SkillPackageId.schema }))
        .output(z.object({ deleted: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId } }) => {
            // Verify the skill package exists before attempting deletion
            const skillPackage = await getSkillPackageOrThrow(
                ctx,
                skillPackageId,
            );

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
    deleteSkill: organizationProcedure({ skillPackage: ["update"] })
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
     * Retrieve a single skill by ID, ensuring it belongs to the organization.
     * @param skillId The ID of the skill to retrieve.
     * @param skillGroupId Optional skill group ID to verify the skill belongs to.
     * @param skillPackageId Optional skill package ID to verify the skill belongs to.
     * @returns The skill data.
     * @throws TRPCError(NOT_FOUND) if the skill does not exist or does not belong to the organization.
     */
    getSkill: organizationProcedure({ skillPackage: ["view"] })
        .input(
            z.object({
                skillId: SkillId.schema,
                skillGroupId: SkillGroupId.schema.optional(),
                skillPackageId: SkillPackageId.schema.optional(),
            }),
        )
        .output(Skill.schema)
        .query(
            async ({
                ctx,
                input: { skillId, skillGroupId, skillPackageId },
            }) => {
                const skill = await getSkillOrThrow(ctx, skillId);

                if (skillGroupId && skill.skillGroupId !== skillGroupId) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillNotFound(skillId),
                    });
                }

                if (skillPackageId && skill.skillPackageId !== skillPackageId) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillNotFound(skillId),
                    });
                }

                return skill;
            },
        ),

    /**
     * List all skill groups within the organization, optionally filtered by skill package.
     * @param skillPackageId Optional skill package ID to filter groups by.
     * @returns An array of skill groups.
     */
    listGroups: organizationProcedure({ skillPackage: ["view"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema.optional(),
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
     * List all skill packages within the organization.
     */
    listPackages: organizationProcedure({ skillPackage: ["view"] })
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
     * @param skillGroupId Optional skill group ID to filter skills by.
     * @param skillPackageId Optional skill package ID to filter skills by.
     * @returns An array of skills.
     */
    listSkills: organizationProcedure({ skillPackage: ["view"] })
        .input(
            z.object({
                skillGroupId: SkillGroupId.schema.optional(),
                skillPackageId: SkillPackageId.schema.optional(),
            }),
        )
        .output(z.array(Skill.schema))
        .query(
            async ({
                ctx,
                input: { organizationId, skillGroupId, skillPackageId },
            }) => {
                const skills = await ctx.prisma.skill.findMany({
                    where: {
                        skillGroupId: skillGroupId,
                        skillPackage: {
                            organizationId,
                            id: skillPackageId,
                        },
                    },
                });

                return skills.map(Skill.fromRecord);
            },
        ),

    /**
     * Update the specified skill group.
     * @param skillGroupId The ID of the skill group to update.
     * @param update The fields to update on the skill group.
     * @returns The updated skill group.
     * @throws TRPCError(NOT_FOUND) if the skill group does not exist.
     */
    updateGroup: organizationProcedure({ skillPackage: ["update"] })
        .input(
            z.object({
                skillGroupId: SkillGroupId.schema,
                update: SkillGroup.modifiableSchema,
            }),
        )
        .output(z.object({ updated: SkillGroup.schema }))
        .mutation(async ({ ctx, input: { skillGroupId, update } }) => {
            const existingGroup = await getSkillGroupOrThrow(ctx, skillGroupId);

            if (
                existingGroup.status == "Active" &&
                update.status == "Archived"
            ) {
                // Archive Action

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
            } else if (
                existingGroup.status == "Archived" &&
                update.status == "Active"
            ) {
                // Restore Action
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
            } else {
                // Regular update.

                const diff = diffObject(
                    SkillGroup.modifiableSchema.parse(existingGroup),
                    update,
                );

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
            }
        }),

    /**
     * Update the specified skill package.
     * @param skillPackageId The ID of the skill package to update.
     * @param update The fields to update on the skill package.
     * @returns The updated skill package.
     * @throws TRPCError(NOT_FOUND) if the skill package does not exist.
     */
    updatePackage: organizationProcedure({ skillPackage: ["update"] })
        .input(
            z.object({
                skillPackageId: SkillPackageId.schema,
                update: SkillPackage.modifiableSchema,
            }),
        )
        .output(z.object({ updated: SkillPackage.schema }))
        .mutation(async ({ ctx, input: { skillPackageId, update } }) => {
            const existingPackage = await getSkillPackageOrThrow(
                ctx,
                skillPackageId,
            );

            if (
                existingPackage.status == "Active" &&
                update.status == "Archived"
            ) {
                // Archive action.
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
            } else if (
                existingPackage.status == "Archived" &&
                update.status == "Active"
            ) {
                // Restore action.
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
            } else {
                // Regular update.
                const diff = diffObject(
                    SkillPackage.modifiableSchema.parse(existingPackage),
                    update,
                );

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
            }
        }),

    /**
     * Update the specified skill.
     * @param skillId The ID of the skill to update.
     * @param update The fields to update on the skill.
     * @returns The updated skill.
     * @throws TRPCError(NOT_FOUND) if the skill does not exist.
     */
    updateSkill: organizationProcedure({ skillPackage: ["update"] })
        .input(
            z.object({
                skillId: SkillId.schema,
                update: Skill.modifiableSchema,
            }),
        )
        .output(z.object({ updated: Skill.schema }))
        .mutation(async ({ ctx, input: { skillId, update } }) => {
            const existingSkill = await getSkillOrThrow(ctx, skillId);

            if (existingSkill.status == "Active" && update.status == "Active") {
                // Archive action.

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
            } else if (
                existingSkill.status == "Archived" &&
                update.status == "Active"
            ) {
                // Restore action.
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
            } else {
                const diff = diffObject(
                    Skill.modifiableSchema.parse(existingSkill),
                    update,
                );

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
            }
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
