/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4HEquipmentItem = {
    schema: z.object({
        id: z.number(),
        ref: z.string(),
        status: z.string(),
        serial: z.string().nullable(),
        // idMarks: z.string().nullable(),

        owner: z.object({
            resourceType: z.literal("Team"),
            id: z.number(),
        }),
        category: z.object({
            resourceType: z.literal("EquipmentCategory"),
            id: z.number(),
        }),

        kind: z.object({
            resourceType: z.literal("EquipmentKind"),
            id: z.number(),
            title: z.string(),
        }),
        brand: z.object({
            resourceType: z.literal("EquipmentBrand"),
            id: z.number().nullable(),
            title: z.string().optional(),
        }),
        model: z
            .object({
                resourceType: z.literal("EquipmentModel"),
                id: z.number().nullable(),
                title: z.string().optional(),
            })
            .nullable(),
        parents: z.array(
            z.object({
                id: z.number(),
                ref: z.string(),
            }),
        ),
        dateExpires: z.string().nullable(),
        dateFirstUse: z.string().nullable(),
        dateManufactured: z.string().nullable(),
        datePurchased: z.string().nullable(),
        dateRetired: z.string().nullable(),
        dateWarranty: z.string().nullable(),
    }),
} as const;

export type D4HEquipmentItem = z.infer<typeof D4HEquipmentItem.schema>;
