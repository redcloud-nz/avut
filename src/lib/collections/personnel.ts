/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { PersonData } from "@/lib/schemas/person";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getPersonnelCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryKey: trpc.personnel.listPersonnel.queryKey({ organizationId }),
            queryFn: async () => {
                return await trpcClient.personnel.listPersonnel.query({
                    organizationId: organizationId,
                });
            },
            queryClient: getQueryClient(),
            getKey: (person) => person.id,
            schema: PersonData.schema,
        }),
    ),
);
