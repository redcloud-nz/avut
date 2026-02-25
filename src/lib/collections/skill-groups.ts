/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
    createCollection,
    createOptimisticAction,
    parseLoadSubsetOptions,
} from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { OrganizationId } from "@/lib/schemas/organization";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
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

export const reorderGroupsAction = createOptimisticAction<{
    organizationId: OrganizationId;
    skillPackageId: SkillPackageId;
    newOrder: SkillGroupId[];
}>({
    onMutate({ organizationId, newOrder }) {
        const collection = getSkillGroupsCollection(organizationId);

        newOrder.forEach((groupId, index) => {
            const group = collection.get(groupId);
            if (group) {
                collection.update(groupId, (draft) => {
                    draft.sequence = index + 1;
                });
            }
        });
    },

    async mutationFn({ organizationId, skillPackageId, newOrder }) {
        await trpcClient.skills.reorderGroups.mutate({
            organizationId,
            skillPackageId,
            newOrder,
        });

        // Refetch the skill groups collection to ensure we have the latest data, including any changes made by the server during the reorder operation.
        await getSkillGroupsCollection(organizationId).utils.refetch();
    },
});
