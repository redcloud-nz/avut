/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { D4HTeamRef } from "@/lib/d4h-api/team";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getD4HTeamsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryClient: getQueryClient(),
            queryKey: trpc.d4hApi.listTeams.queryKey({
                organizationId,
            }),
            queryFn: async () => {
                return trpcClient.d4hApi.listTeams.query({
                    organizationId,
                });
            },
            getKey: (item) => item.id,
            schema: D4HTeamRef.schema,
        }),
    ),
);
