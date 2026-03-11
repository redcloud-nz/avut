/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import * as z from "zod";

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

import { D4HEquipmentItem } from "@/lib/d4h-api/equipment-item";
import { perOrganization } from "@/lib/utils";
import { getQueryClient, trpc, trpcClient } from "@/trpc/client";

export const getD4HEquipmentItemsCollection = perOrganization(
    (organizationId) =>
        createCollection(
            queryCollectionOptions({
                queryClient: getQueryClient(),
                queryKey: trpc.d4hApi.listEquipmentItems.queryKey({
                    organizationId,
                }),
                queryFn: async () => {
                    const fetchedItems =
                        await trpcClient.d4hApi.listEquipmentItems.query({
                            organizationId,
                        });
                    return fetchedItems.map((item) => ({
                        ...item,
                        parentId:
                            item.parents.length > 0
                                ? item.parents[item.parents.length - 1].id
                                : null,
                    }));
                },
                getKey: (item) => item.id,
                schema: D4HEquipmentItem.schema.extend({
                    parentId: z.number().nullable(),
                }),
            }),
        ),
);
