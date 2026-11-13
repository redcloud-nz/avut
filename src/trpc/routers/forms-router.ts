/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import {
    FormInstance,
    FormInstanceId,
    FormInstanceItem,
    FormInstanceItemId,
} from "@/lib/schemas/form-instance";
import * as Forms from "@/server/services/forms";

import { createTrpcRouter, organizationProcedure } from "../init";

export const formsRouter = createTrpcRouter({
    /**
     * Delete a draft form instance by its ID, ensuring it belongs to the current user and organization.
     *
     * @param formInstanceId - The ID of the form instance to delete.
     * @throws TRPCError(NOT_FOUND) if the form instance does not exist, does not belong to the user/organization, or isn't a draft.
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
                    formStatus: "Draft",
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
                    formStatus: "Draft",
                },
            });
        }),

    /**
     * Delete an item from a draft form instance by its ID, ensuring it belongs to the specified form
     * instance and that the instance belongs to the current user and organization.
     *
     * @param formInstanceId - The ID of the form instance the item belongs to.
     * @param formInstanceItemId - The ID of the form instance item to delete.
     * @throws TRPCError(NOT_FOUND) if the form instance item does not exist, does not belong to the specified form instance, or the instance isn't the user's draft in this organization.
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
                    formInstance: {
                        id: formInstanceId,
                        organizationId: ctx.organizationId,
                        userId: ctx.userId,
                        formStatus: "Draft",
                    },
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
                        formStatus: "Draft",
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
     * Save or update a draft form instance, ensuring it belongs to the current user and organization.
     *
     * @param formInstanceId - The ID of the form instance to save or update.
     * @param formKey - The key of the form this instance belongs to.
     * @param formData - The data for the form instance.
     * @returns The saved or updated form instance.
     * @throws TRPCError(CONFLICT) if the form instance belongs to a different user or organization, if the form key does not match an existing instance with the same ID, or if the existing instance isn't a draft — thrown as `ConflictError` from `Forms.saveInstance` and mapped by `mapDomainErrors`.
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
            return Forms.saveInstance(ctx, { formInstanceId, formKey, formData });
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
     * @throws TRPCError(NOT_FOUND) if the specified form instance does not exist, does not belong to the user/organization, or isn't a draft.
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
                        formStatus: "Draft",
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
