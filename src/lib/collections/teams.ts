/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { TeamData } from "@/lib/schemas/team";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getTeamsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.teams.listTeams.queryKey({ organizationId }),
            queryFn: async () => {
                return await trpcClient.teams.listTeams.query({
                    organizationId: organizationId,
                });
            },
            queryClient: getQueryClient(),
            getKey: (team) => team.id,
            schema: TeamData.schema,

            // onInsert: async ({ transaction }) => {
            //     await Promise.all(
            //         transaction.mutations.map(
            //             async (mutation) =>
            //                 await trpcClient.teams.createTeam.mutate({
            //                     organizationId: organizationId,
            //                     team: mutation.modified,
            //                 }),
            //         ),
            //     );
            // },
            // onUpdate: async ({ transaction }) => {
            //     await Promise.all(
            //         transaction.mutations.map(
            //             async (mutation) =>
            //                 await trpcClient.teams.updateTeam.mutate({
            //                     organizationId: organizationId,
            //                     teamId: mutation.original.id,
            //                     update: mutation.modified,
            //                 }),
            //         ),
            //     );
            // },
            // onDelete: async ({ transaction }) => {
            //     await Promise.all(
            //         transaction.mutations.map(
            //             async (mutation) =>
            //                 await trpcClient.teams.deleteTeam.mutate({
            //                     organizationId: organizationId,
            //                     teamId: mutation.original.id,
            //                 }),
            //         ),
            //     );
            // },
        }),
    ),
);
