/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection, parseLoadSubsetOptions } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { Skill } from "@/lib/schemas/skill";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, RouterInput, trpc, trpcClient } from "@/trpc/client";

export const getSkillsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.skills.listSkills.queryKey({
                organizationId,
            }),
            queryFn: async (ctx) => {
                const { filters } = parseLoadSubsetOptions(
                    ctx.meta?.loadSubsetOptions,
                );

                const input: RouterInput["skills"]["listSkills"] = {
                    organizationId: ctx.meta?.organizationId!,
                };

                for (const filter of filters) {
                    const field = filter.field.join(".");
                    if (field == "skillPackageId" && filter.operator == "eq") {
                        input.skillPackageId = filter.value;
                    }
                }

                return await trpcClient.skills.listSkills.query(input);
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
                        await trpcClient.skills.createSkill.mutate({
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
                        await trpcClient.skills.updateSkill.mutate({
                            organizationId: organizationId,
                            skillId: mutation.original.id,
                            update: data,
                        });
                    }),
                );
            },
            onDelete: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skills.deleteSkill.mutate({
                            organizationId: organizationId,
                            skillId: mutation.original.id,
                        });
                    }),
                );
            },
        }),
    ),
);
