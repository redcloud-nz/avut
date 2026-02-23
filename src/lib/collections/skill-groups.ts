/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection, parseLoadSubsetOptions } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { SkillGroup } from "@/lib/schemas/skill-group";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, RouterInput, trpc, trpcClient } from "@/trpc/client";

export const getSkillGroupsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.skills.listGroups.queryKey({
                organizationId,
            }),
            queryFn: async (ctx) => {
                const { filters } = parseLoadSubsetOptions(
                    ctx.meta?.loadSubsetOptions,
                );

                const input: RouterInput["skills"]["listGroups"] = {
                    organizationId,
                };

                for (const filter of filters) {
                    const field = filter.field.join(".");
                    if (field == "skillPackageId" && filter.operator == "eq") {
                        input.skillPackageId = filter.value;
                    }
                }

                return await trpcClient.skills.listGroups.query(input);
            },
            queryClient: getQueryClient(),
            getKey: (skillGroup) => skillGroup.id,
            schema: SkillGroup.schema,
            staleTime: 1000 * 60 * 5, // 5 minutes
            syncMode: "on-demand",

            onInsert: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skills.createGroup.mutate({
                            organizationId: organizationId,
                            ...mutation.modified,
                        });
                    }),
                );
            },
            onUpdate: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        const data = mutation.modified;
                        await trpcClient.skills.updateGroup.mutate({
                            organizationId: organizationId,
                            skillGroupId: mutation.original.id,
                            update: data,
                        });
                    }),
                );
            },
            onDelete: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skills.deleteGroup.mutate({
                            organizationId: organizationId,
                            skillGroupId: mutation.original.id,
                        });
                    }),
                );
            },
        }),
    ),
);
