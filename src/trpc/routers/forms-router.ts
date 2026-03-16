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

import { createTrpcRouter, organizationProcedure } from "../init";

export const formsRouter = createTrpcRouter({
    deleteFormInstance: organizationProcedure()
        .input(
            z.object({
                formInstanceId: FormInstanceId.schema,
            }),
        )
        .mutation(async ({ ctx, input: { formInstanceId } }) => {
            await ctx.prisma.formInstance.delete({
                where: {
                    id: formInstanceId,
                    organizationId: ctx.organizationId,
                    userId: ctx.userId,
                },
            });
        }),

    deleteFormInstanceItem: organizationProcedure()
        .input(
            z.object({
                formInstanceId: FormInstanceId.schema,
                formInstanceItemId: FormInstanceItemId.schema,
            }),
        )
        .mutation(async ({ ctx, input: { formInstanceId, formInstanceItemId } }) => {
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
    listFormInstances: organizationProcedure()
        .input(
            z.object({
                formKey: z.string(),
                formStatus: z.string().optional(),
            }),
        )
        .output(z.array(FormInstance.schema))
        .query(async ({ ctx, input: { formKey, formStatus } }) => {
            const formInstances = await ctx.prisma.formInstance.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    userId: ctx.userId,
                    formKey,
                    formStatus,
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
        }),

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
