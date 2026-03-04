/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import {
    getD4HEquipmentCategories,
    getD4HEquipmentItems,
} from "@/lib/d4h-api/client";
import { D4HEquipmentCategory } from "@/lib/d4h-api/equipment-category";
import { D4HEquipmentItem } from "@/lib/d4h-api/equipment-item";
import { getConfiguredD4HViewsAccessToken } from "@/server/d4h-access-token";

import { createTrpcRouter, organizationProcedure } from "../init";

export const d4hApiRouter = createTrpcRouter({
    listEquipmentCategories: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentCategory.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
            );

            const equipmentCategories =
                await getD4HEquipmentCategories(accessToken);

            return equipmentCategories;
        }),

    listEquipmentItems: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentItem.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
            );

            const equipmentItems = await getD4HEquipmentItems(accessToken);

            return equipmentItems;
        }),
});
