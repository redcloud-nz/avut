/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection, parseLoadSubsetOptions } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { FormInstance, FormInstanceItem } from "@/lib/schemas/form-instance";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getFormInstancesCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.forms.listDraftFormInstances.queryKey({ organizationId }),
            queryFn: async (ctx) => {
                const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions);

                const queryParams = { formKey: "", formStatus: undefined };

                params.filters.forEach((filter) => {
                    const field = filter.field.join(".");
                    if (field === "formKey" && filter.operator === "eq") {
                        queryParams.formKey = filter.value;
                    }
                    if (field === "formStatus" && filter.operator === "eq") {
                        queryParams.formStatus = filter.value;
                    }
                });

                if (queryParams.formKey === "") {
                    throw new Error("formKey filter is required to load form instances.");
                }

                return await trpcClient.forms.listDraftFormInstances.query({
                    organizationId,
                    ...queryParams,
                });
            },
            queryClient: getQueryClient(),
            schema: FormInstance.schema,
            getKey: (instance) => instance.id,
            syncMode: "on-demand",

            onInsert: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.forms.saveFormInstanceData.mutate({
                            organizationId: organizationId,
                            formInstanceId: mutation.modified.id,
                            formKey: mutation.modified.formKey,
                            formData: mutation.modified.formData,
                        });
                    }),
                );
            },
            onUpdate: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.forms.saveFormInstanceData.mutate({
                            organizationId: organizationId,
                            formInstanceId: mutation.modified.id,
                            formKey: mutation.modified.formKey,
                            formData: mutation.modified.formData,
                        });
                    }),
                );
            },

            onDelete: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(
                        async (mutation) =>
                            await trpcClient.forms.deleteFormInstance.mutate({
                                organizationId: organizationId,
                                formKey: mutation.modified.formKey,
                                formInstanceId: mutation.original.id,
                            }),
                    ),
                );
            },
        }),
    ),
);

export const getFormInstanceItemsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.forms.listFormInstanceItems.queryKey({ organizationId }),
            queryFn: async (ctx) => {
                const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions);

                const queryParams = { formInstanceId: "" };

                params.filters.forEach((filter) => {
                    const field = filter.field.join(".");
                    if (field === "formInstanceId" && filter.operator === "eq") {
                        queryParams.formInstanceId = filter.value;
                    }
                });

                if (queryParams.formInstanceId === "") {
                    throw new Error(
                        "formInstanceId filter is required to load form instance items.",
                    );
                }

                return await trpcClient.forms.listFormInstanceItems.query({
                    organizationId,
                    ...queryParams,
                });
            },
            queryClient: getQueryClient(),
            schema: FormInstanceItem.schema,
            getKey: (item) => item.id,
            syncMode: "on-demand",

            onInsert: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.forms.saveFormInstanceItemData.mutate({
                            organizationId: organizationId,
                            formInstanceItemId: mutation.modified.id,
                            formInstanceId: mutation.modified.formInstanceId,
                            parentItemId: mutation.modified.parentItemId,
                            collectionKey: mutation.modified.collectionKey,
                            formData: mutation.modified.formData,
                        });
                    }),
                );
            },
        }),
    ),
);
