/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { D4HMember } from "@/lib/d4h-api/member";
import { D4HTeamRef } from "@/lib/d4h-api/team";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getD4HMembersCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryClient: getQueryClient(),
            queryKey: trpc.d4hApi.listEquipmentItems.queryKey({
                organizationId,
            }),
            queryFn: async () => {
                return trpcClient.d4hApi.listMembers.query({
                    organizationId,
                });
            },
            getKey: (item) => item.id,
            schema: D4HMember.schema.extend({ team: D4HTeamRef.schema }),
        }),
    ),
);
