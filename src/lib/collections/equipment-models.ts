/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { D4HEquipmentModel } from "../schemas/d4h/equipment-model";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getD4HEquipmentModelsCollection = perOrganization((organizationId) =>
    createCollection(
        queryCollectionOptions({
            queryClient: getQueryClient(),
            queryKey: trpc.d4hApi.listEquipmentModels.queryKey({
                organizationId,
            }),
            queryFn: async () => {
                return trpcClient.d4hApi.listEquipmentModels.query({
                    organizationId,
                    module: "d4h-views",
                });
            },
            getKey: (item) => item.id,
            schema: D4HEquipmentModel.schema,
        }),
    ),
);
