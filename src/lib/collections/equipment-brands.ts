/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { D4HEquipmentBrand } from "../d4h-api/equipment-brand";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getD4HEquipmentBrandsCollection = perOrganization(
    (organizationId) =>
        createCollection(
            queryCollectionOptions({
                queryClient: getQueryClient(),
                queryKey: trpc.d4hApi.listEquipmentBrands.queryKey({
                    organizationId,
                }),
                queryFn: async () => {
                    return trpcClient.d4hApi.listEquipmentBrands.query({
                        organizationId,
                    });
                },
                getKey: (item) => item.id,
                schema: D4HEquipmentBrand.schema,
            }),
        ),
);
