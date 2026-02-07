/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { pick } from "remeda";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { TeamMembershipData } from "@/lib/schemas/team-membership";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getTeamMembershipsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.teams.listTeamMemberships.queryKey({
                organizationId,
            }),
            queryFn: async () => {
                return await trpcClient.teams.listTeamMemberships.query({
                    organizationId: organizationId,
                });
            },
            queryClient: getQueryClient(),
            schema: TeamMembershipData.schema.omit({
                id: true,
                organizationId: true,
            }),
            getKey: (membership) =>
                `${membership.teamId}-${membership.personId}`,

            onInsert: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        await trpcClient.teams.createTeamMembership.mutate({
                            organizationId: organizationId,
                            ...mutation.modified,
                        });
                    }),
                );
            },
            onUpdate: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(async (mutation) => {
                        const data = pick(mutation.modified, [
                            "tags",
                            "properties",
                        ]);
                        await trpcClient.teams.updateTeamMembership.mutate({
                            organizationId: organizationId,
                            teamId: mutation.original.teamId,
                            personId: mutation.original.personId,
                            update: data,
                        });
                    }),
                );
            },
            onDelete: async ({ transaction }) => {
                await Promise.all(
                    transaction.mutations.map(
                        async (mutation) =>
                            await trpcClient.teams.deleteTeamMembership.mutate({
                                organizationId: organizationId,
                                teamId: mutation.original.teamId,
                                personId: mutation.original.personId,
                            }),
                    ),
                );
            },
        }),
    ),
);
