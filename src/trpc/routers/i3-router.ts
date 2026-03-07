/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";
import {
    AuthenticatedOrganizationContext,
    createTrpcRouter,
    organizationProcedure,
} from "../init";
import { I3Template, I3TemplateId } from "@/lib/schemas/i3-template";
import { diffObject } from "@/lib/diff";
import { TRPCError } from "@trpc/server";
import {
    I3TemplateVariant,
    I3TemplateVariantId,
} from "@/lib/schemas/i3-template-variant";
import { Messages } from "../messages";

export const i3Router = createTrpcRouter({
    /**
     * Create a new I3 Template.
     */
    createTemplate: organizationProcedure({ i3Template: ["create"] })
        .input(
            z.object({
                templateId: I3TemplateId.schema,
                create: I3Template.modifiableSchema,
            }),
        )
        .output(z.object({ created: I3Template.schema }))
        .mutation(async ({ ctx, input: { templateId, create } }) => {
            const diff = diffObject({}, create);

            const [created] = await Promise.all([
                ctx.prisma.i3Template.create({
                    data: {
                        id: templateId,
                        organizationId: ctx.organizationId,
                        name: create.name,
                        description: create.description,
                        d4h: create.d4h
                            ? {
                                  create: {
                                      ...create.d4h,
                                  },
                              }
                            : undefined,
                    },
                    include: {
                        d4h: true,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "I3Template",
                    objectId: templateId,
                    changes: diff,
                }),
            ]);

            return { created: I3Template.fromRecord(created) };
        }),

    /**
     * Create a new I3 Template Variant for a given template.
     * @param templateId The ID of the template to create the variant for. The template must belong to the organization.
     * @param variantId The ID of the new template variant.
     * @param create The data for the new template variant.
     * @returns The created template variant.
     */
    createTemplateVariant: organizationProcedure({ i3Template: ["update"] })
        .input(
            z.object({
                templateId: I3TemplateId.schema,
                variantId: I3TemplateVariantId.schema,
                create: I3TemplateVariant.modifiableSchema,
            }),
        )
        .output(z.object({ created: I3TemplateVariant.schema }))
        .mutation(async ({ ctx, input: { templateId, variantId, create } }) => {
            // Ensure the template exists and belongs to the organization
            await getI3TemplateOrThrow(ctx, templateId);

            const diff = diffObject({}, create);

            const [created] = await Promise.all([
                ctx.prisma.i3TemplateVariant.create({
                    data: {
                        id: variantId,
                        templateId: templateId,
                        name: create.name,
                        d4h: create.d4h
                            ? {
                                  create: {
                                      ...create.d4h,
                                  },
                              }
                            : undefined,
                    },
                    include: {
                        d4h: true,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "I3TemplateVariant",
                    objectId: variantId,
                    changes: diff,
                }),
            ]);

            return { created: I3TemplateVariant.fromRecord(created) };
        }),

    /**
     * Delete a D4H PPE Template. This is a hard delete and cannot be undone.
     */
    deleteTemplate: organizationProcedure({ i3Template: ["delete"] })
        .input(z.object({ templateId: I3TemplateId.schema }))
        .output(z.object({ deleted: I3Template.schema }))
        .mutation(async ({ ctx, input: { templateId } }) => {
            const existing = await getI3TemplateOrThrow(ctx, templateId);

            await Promise.all([
                ctx.prisma.i3Template.delete({
                    where: { id: templateId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "I3Template",
                    objectId: templateId,
                    changes: diffObject(existing, {}),
                }),
            ]);

            return { deleted: existing };
        }),

    /**
     * Delete a D4H PPE Template Variant. This is a hard delete and cannot be undone.
     */
    deleteTemplateVariant: organizationProcedure({ i3Template: ["update"] })
        .input(
            z.object({
                templateId: I3TemplateId.schema,
                variantId: I3TemplateVariantId.schema,
            }),
        )
        .output(z.object({ deleted: I3TemplateVariant.schema }))
        .mutation(async ({ ctx, input: { templateId, variantId } }) => {
            const existing = await ctx.prisma.i3TemplateVariant.findUnique({
                where: {
                    id: variantId,
                    template: {
                        id: templateId,
                        organizationId: ctx.organizationId,
                    },
                },
                include: { d4h: true },
            });

            if (!existing)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.i3TemplateVariantNotFound(variantId),
                });

            await Promise.all([
                ctx.prisma.i3TemplateVariant.delete({
                    where: { id: variantId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "I3TemplateVariant",
                    objectId: variantId,
                }),
            ]);

            return { deleted: I3TemplateVariant.fromRecord(existing) };
        }),

    /**
     * List all D4H PPE Templates for the organization.
     */
    listTemplates: organizationProcedure({ i3Template: ["view"] })
        .output(
            z.array(
                I3Template.schema.extend({
                    variants: z.array(I3TemplateVariant.schema),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const templates = await ctx.prisma.i3Template.findMany({
                where: { organizationId: ctx.organizationId },
                include: {
                    d4h: true,
                    variants: {
                        include: {
                            d4h: true,
                        },
                    },
                },
            });
            return templates.map((template) => ({
                ...I3Template.fromRecord(template),
                variants: template.variants.map(I3TemplateVariant.fromRecord),
            }));
        }),

    listTemplateVariants: organizationProcedure({ i3Template: ["view"] })
        .input(
            z.object({
                templateId: I3TemplateId.schema,
            }),
        )
        .output(z.array(I3TemplateVariant.schema))
        .query(async ({ ctx, input: { templateId: i3TemplateId } }) => {
            const template = await ctx.prisma.i3Template.findUnique({
                where: { id: i3TemplateId, organizationId: ctx.organizationId },
                include: { variants: { include: { d4h: true } } },
            });

            if (!template)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.i3TemplateNotFound(i3TemplateId),
                });

            return template.variants.map(I3TemplateVariant.fromRecord);
        }),

    /**
     * Update a D4H PPE Template. Only the fields included in the input will be updated.
     */
    updateTemplate: organizationProcedure({ i3Template: ["update"] })
        .input(
            z.object({
                templateId: I3TemplateId.schema,
                update: I3Template.modifiableSchema,
            }),
        )
        .output(z.object({ updated: I3Template.schema }))
        .mutation(async ({ ctx, input: { templateId, update } }) => {
            const existing = await getI3TemplateOrThrow(ctx, templateId);

            const [updated] = await Promise.all([
                ctx.prisma.i3Template.update({
                    where: { id: templateId },
                    data: {
                        name: update.name,
                        description: update.description,
                        d4h: update.d4h
                            ? {
                                  upsert: {
                                      create: {
                                          ...update.d4h,
                                      },
                                      update: {
                                          ...update.d4h,
                                      },
                                  },
                              }
                            : {
                                  delete: true,
                              },
                    },
                    include: { d4h: true },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "I3Template",
                    objectId: templateId,
                    changes: diffObject(existing, update),
                }),
            ]);

            return { updated: I3Template.fromRecord(updated) };
        }),
});

async function getI3TemplateOrThrow(
    ctx: AuthenticatedOrganizationContext,
    templateId: I3TemplateId,
) {
    const template = await ctx.prisma.i3Template.findUnique({
        where: { id: templateId, organizationId: ctx.organizationId },
        include: { d4h: true },
    });

    if (!template) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: Messages.i3TemplateNotFound(templateId),
        });
    }
    return I3Template.fromRecord(template);
}
