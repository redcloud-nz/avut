/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import {
    FormInstance,
    FormInstanceId,
    FormInstanceItem,
    FormInstanceItemId,
} from "@/lib/schemas/form-instance";

import { AuthenticatedOrganizationContext, createTrpcRouter, organizationProcedure } from "../init";
import { TRPCError } from "@trpc/server";

export const formsRouter = createTrpcRouter({
    /**
     * Delete a form instance by its ID, ensuring it belongs to the current user and organization.
     *
     * @param formInstanceId - The ID of the form instance to delete.
     * @throws TRPCError(NOT_FOUND) if the form instance does not exist or does not belong to the user/organization.
     */
    deleteFormInstance: organizationProcedure()
        .input(
            z.object({
                formInstanceId: FormInstanceId.schema,
                formKey: z.string(),
            }),
        )
        .mutation(async ({ ctx, input: { formInstanceId, formKey } }) => {
            const existing = await ctx.prisma.formInstance.findUnique({
                where: {
                    id: formInstanceId,
                    organizationId: ctx.organizationId,
                    userId: ctx.userId,
                    formKey,
                },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `FormInstance(${formInstanceId}) not found`,
                });
            }

            await ctx.prisma.formInstance.delete({
                where: {
                    id: formInstanceId,
                    organizationId: ctx.organizationId,
                    userId: ctx.userId,
                    formKey,
                },
            });
        }),

    /**
     * Delete an item from a form instance by its ID, ensuring it belongs to the specified form instance.
     *
     * @param formInstanceId - The ID of the form instance the item belongs to.
     * @param formInstanceItemId - The ID of the form instance item to delete.
     * @throws TRPCError(NOT_FOUND) if the form instance item does not exist or does not belong to the specified form instance.
     */
    deleteFormInstanceItem: organizationProcedure()
        .input(
            z.object({
                formInstanceId: FormInstanceId.schema,
                formInstanceItemId: FormInstanceItemId.schema,
            }),
        )
        .mutation(async ({ ctx, input: { formInstanceId, formInstanceItemId } }) => {
            const existing = await ctx.prisma.formInstanceItem.findUnique({
                where: {
                    id: formInstanceItemId,
                    formInstanceId,
                },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `FormInstanceItem(${formInstanceItemId}) not found`,
                });
            }

            await ctx.prisma.formInstanceItem.delete({
                where: {
                    id: formInstanceItemId,

                    formInstance: {
                        id: formInstanceId,
                        organizationId: ctx.organizationId,
                        userId: ctx.userId,
                    },
                },
            });
        }),

    /**
     * Get form instances for the current user and organization by form key.
     *
     * @param formKey - The key of the form to retrieve instances for.
     * @returns An array of form instances matching the specified form key.
     */
    listDraftFormInstances: organizationProcedure()
        .input(
            z.object({
                formKey: z.string(),
            }),
        )
        .output(z.array(FormInstance.schema))
        .query(async ({ ctx, input: { formKey } }) => {
            const formInstances = await ctx.prisma.formInstance.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    userId: ctx.userId,
                    formKey,
                    formStatus: "Draft",
                },
            });

            return formInstances.map(FormInstance.fromRecord);
        }),

    /**
     * Get form instance items for a specific form instance.
     *
     * @param formInstanceId - The ID of the form instance to retrieve items for.
     * @returns An array of form instance items associated with the specified form instance.
     */
    listFormInstanceItems: organizationProcedure()
        .input(
            z.object({
                formInstanceId: FormInstanceId.schema,
            }),
        )
        .output(z.array(FormInstanceItem.schema))
        .query(async ({ ctx, input: { formInstanceId } }) => {
            const formInstanceItems = await ctx.prisma.formInstanceItem.findMany({
                where: {
                    formInstanceId,
                },
            });

            return formInstanceItems.map(FormInstanceItem.fromRecord);
        }),

    /**
     * Save or update a form instance, ensuring it belongs to the current user and organization.
     *
     * @param formInstanceId - The ID of the form instance to save or update.
     * @param formKey - The key of the form this instance belongs to.
     * @param formData - The data for the form instance.
     * @returns The saved or updated form instance.
     * @throws TRPCError(CONFLICT) if the form instance belongs to a different user or organization, or if the form key does not match an existing instance with the same ID.
     */
    saveFormInstanceData: organizationProcedure()
        .input(
            z.object({
                formInstanceId: FormInstanceId.schema,
                formKey: z.string(),
                formData: z.record(z.string(), z.unknown()),
            }),
        )
        .output(FormInstance.schema)
        .mutation(async ({ ctx, input: { formInstanceId, formKey, formData } }) => {
            return saveFormInstance(ctx, { formInstanceId, formKey, formData });
        }),

    /**
     * Save or update a form instance item, ensuring it belongs to the specified form instance and organization.
     *
     * @param formInstanceId - The ID of the form instance the item belongs to.
     * @param formInstanceItemId - The ID of the form instance item to save or update.
     * @param parentItemId - The ID of the parent item, if applicable.
     * @param collectionKey - The key of the collection this item belongs to.
     * @param formData - The data for the form instance item.
     * @returns The saved or updated form instance item.
     * @throws TRPCError(NOT_FOUND) if the specified form instance does not exist or does not belong to the user/organization.
     */
    saveFormInstanceItemData: organizationProcedure()
        .input(
            z.object({
                formInstanceId: FormInstanceId.schema,
                formInstanceItemId: FormInstanceItemId.schema,
                parentItemId: FormInstanceItemId.schema.nullable(),
                collectionKey: z.string(),
                formData: z.record(z.string(), z.unknown()),
            }),
        )
        .output(FormInstanceItem.schema)
        .mutation(
            async ({
                ctx,
                input: {
                    formInstanceId,
                    formInstanceItemId,
                    parentItemId,
                    collectionKey,
                    formData,
                },
            }) => {
                const formInstance = await ctx.prisma.formInstance.findUnique({
                    where: {
                        id: formInstanceId,
                        organizationId: ctx.organizationId,
                        userId: ctx.userId,
                    },
                });
                if (!formInstance)
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: `FormInstance(${formInstanceId}) not found`,
                    });

                const updatedFormInstanceItem = await ctx.prisma.formInstanceItem.upsert({
                    where: { id: formInstanceItemId },
                    update: {
                        parentItemId,
                        collectionKey,
                        formData: formData as object,
                    },
                    create: {
                        id: formInstanceItemId,
                        formInstanceId,
                        parentItemId,
                        collectionKey,
                        formData: formData as object,
                    },
                });

                return FormInstanceItem.fromRecord(updatedFormInstanceItem);
            },
        ),
});

export async function saveFormInstance(
    ctx: AuthenticatedOrganizationContext,
    {
        formInstanceId,
        formKey,
        formData,
    }: { formInstanceId: FormInstanceId; formKey: string; formData: Record<string, unknown> },
) {
    const existing = await ctx.prisma.formInstance.findUnique({
        where: {
            id: formInstanceId,
        },
    });
    if (
        existing &&
        (existing.organizationId !== ctx.organizationId || existing.userId !== ctx.userId)
    ) {
        throw new TRPCError({
            code: "CONFLICT",
            message: `FormInstance(${formInstanceId}) belongs to a different user or organization`,
        });
    }
    if (existing && existing.formKey !== formKey) {
        throw new TRPCError({
            code: "CONFLICT",
            message: `FormInstance(${formInstanceId}) formKey mismatch: expected ${existing.formKey}, got ${formKey}`,
        });
    }

    const updatedFormInstance = await ctx.prisma.formInstance.upsert({
        where: { id: formInstanceId },
        update: {
            formData: formData as object,
            formStatus: "Draft",
            updatedAt: new Date(),
        },
        create: {
            id: formInstanceId,
            formKey,
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            formData: formData as object,
            formStatus: "Draft",
        },
    });

    return FormInstance.fromRecord(updatedFormInstance);
}
