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
import { Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, RouterInput, trpc, trpcClient } from "@/trpc/client";

export const getSkillsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.skillPackageBuilder.listSkills.queryKey({
                organizationId,
            }),
            queryFn: async (ctx) => {
                const { filters } = parseLoadSubsetOptions(
                    ctx.meta?.loadSubsetOptions,
                );

                const input: RouterInput["skillPackageBuilder"]["listSkills"] =
                    {
                        organizationId,
                    };

                for (const filter of filters) {
                    const field = filter.field.join(".");
                    if (field == "skillPackageId" && filter.operator == "eq") {
                        input.skillPackageId = filter.value;
                    }
                }

                return await trpcClient.skillPackageBuilder.listSkills.query(
                    input,
                );
            },
            queryClient: getQueryClient(),
            getKey: (skill) => skill.id,
            schema: Skill.schema,
            staleTime: 1000 * 60 * 5, // 5 minutes
            syncMode: "on-demand",

            meta: {
                organizationId,
            },

            onInsert: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skillPackageBuilder.createSkill.mutate(
                            {
                                organizationId,
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
                        await trpcClient.skillPackageBuilder.updateSkill.mutate(
                            {
                                organizationId,
                                skillId: mutation.original.id,
                                update: data,
                            },
                        );
                    }),
                );
            },
            onDelete: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skillPackageBuilder.deleteSkill.mutate(
                            {
                                organizationId,
                                skillId: mutation.original.id,
                            },
                        );
                    }),
                );
            },
        }),
    ),
);

export const reorderSkillsAction = createOptimisticAction<{
    organizationId: OrganizationId;
    skillGroupId: SkillGroupId;
    newOrder: SkillId[];
}>({
    onMutate({ organizationId, newOrder }) {
        const collection = getSkillsCollection(organizationId);

        newOrder.forEach((skillId, index) => {
            const skill = collection.get(skillId);
            if (skill) {
                collection.update(skillId, (draft) => {
                    draft.sequence = index + 1;
                });
            }
        });
    },
    async mutationFn({ organizationId, skillGroupId, newOrder }) {
        await trpcClient.skillPackageBuilder.reorderGroupSkills.mutate({
            organizationId,
            skillGroupId,
            newOrder,
        });

        // Refetch the skills collection to ensure we have the latest data, including any changes made by the server during the reorder operation.
        await getSkillsCollection(organizationId).utils.refetch();
    },
});
