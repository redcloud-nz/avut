/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";

import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

import { D4HEquipmentBrand } from "../schemas/d4h/equipment-brand";

export const getD4HEquipmentBrandsCollection = perOrganization((organizationId) =>
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
