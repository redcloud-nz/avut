/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

export const D4HEquipmentModel = {
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("EquipmentModel"),

        title: z.string(),
        owner: z.object({
            id: z.number(),
            resourceType: z.enum(["Team", "Organisation"]),
        }),
        brand: z.object({
            id: z.number(),
            resourceType: z.literal("EquipmentBrand"),
        }),
        updatedAt: z.iso.datetime(),
    }),
} as const;

export type D4HEquipmentModel = z.infer<typeof D4HEquipmentModel.schema>;
