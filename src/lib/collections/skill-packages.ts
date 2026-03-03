/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { SkillPackage } from "@/lib/schemas/skill-package";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getSkillPackagesCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey:
                trpc.skillPackageBuilder.listPackagesOwnedByOrganization.queryKey(
                    {
                        organizationId,
                    },
                ),
            queryFn: async () => {
                return await trpcClient.skillPackageBuilder.listPackagesOwnedByOrganization.query(
                    {
                        organizationId: organizationId,
                    },
                );
            },
            queryClient: getQueryClient(),
            getKey: (skillPackage) => skillPackage.id,
            schema: SkillPackage.schema,

            onInsert: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skillPackageBuilder.createPackage.mutate(
                            {
                                organizationId: organizationId,
                                ...mutation.modified,
                            },
                        );
                    }),
                );
            },
            onUpdate: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        const data = mutation.modified;
                        await trpcClient.skillPackageBuilder.updatePackage.mutate(
                            {
                                organizationId: organizationId,
                                skillPackageId: mutation.original.id,
                                update: data,
                            },
                        );
                    }),
                );
            },
            onDelete: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skillPackageBuilder.deletePackage.mutate(
                            {
                                organizationId: organizationId,
                                skillPackageId: mutation.original.id,
                            },
                        );
                    }),
                );
            },
        }),
    ),
);
