/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection, parseLoadSubsetOptions } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { SkillCheck } from "@/lib/schemas/skill-check";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getSkillChecksCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.skillChecks.listSkillChecks.queryKey({ organizationId }),
            queryFn: async (ctx) => {
                const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions);

                // We can apply client-side filtering for sessionId and assesseeId since those are likely to be used together with listSessions or listPersonnel which would have already loaded the relevant skill checks into the cache.
                const queryParams = {
                    sessionId: undefined,
                    assesseeId: undefined,
                    assessorId: undefined,
                    skillId: undefined,
                };

                params.filters.forEach((filter) => {
                    const field = filter.field.join(".");
                    if (field === "sessionId" && filter.operator === "eq") {
                        queryParams.sessionId = filter.value;
                    }
                    if (field === "assesseeId" && filter.operator === "eq") {
                        queryParams.assesseeId = filter.value;
                    }
                    if (field === "assessorId" && filter.operator === "eq") {
                        queryParams.assessorId = filter.value;
                    }
                    if (field === "skillId" && filter.operator === "eq") {
                        queryParams.skillId = filter.value;
                    }
                });

                return await trpcClient.skillChecks.listSkillChecks.query({
                    organizationId,
                    ...queryParams,
                });
            },
            queryClient: getQueryClient(),
            schema: SkillCheck.schema,
            getKey: (check) => check.id,
            syncMode: "on-demand",

            async onInsert({ transaction }) {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skillChecks.createSkillCheck.mutate({
                            organizationId: organizationId,
                            skillCheckId: mutation.modified.id,
                            sessionId: mutation.modified.sessionId,
                            create: {
                                assesseeId: mutation.modified.assesseeId,
                                assessorId: mutation.modified.assessorId,
                                skillId: mutation.modified.skillId,
                                result: mutation.modified.result,
                                notes: mutation.modified.notes,
                            },
                        });
                    }),
                );
            },

            async onUpdate({ transaction }) {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skillChecks.updateSkillCheck.mutate({
                            organizationId: organizationId,
                            skillCheckId: mutation.modified.id,
                            update: {
                                result: mutation.modified.result,
                                notes: mutation.modified.notes,
                            },
                        });
                    }),
                );
            },

            async onDelete({ transaction }) {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.skillChecks.deleteSkillCheck.mutate({
                            organizationId: organizationId,
                            skillCheckId: mutation.modified.id,
                        });
                    }),
                );
            },
        }),
    ),
);
