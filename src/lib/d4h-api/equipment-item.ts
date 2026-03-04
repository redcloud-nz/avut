/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

const d4HEquipmentItemBase = z.object({
    id: z.number(),
    ref: z.string(),
    status: z.string(),
    owner: z.object({
        resourceType: z.literal("Team"),
        id: z.number(),
    }),
    category: z.object({
        resourceType: z.literal("EquipmentCategory"),
        id: z.number(),
    }),
    model: z.object({
        resourceType: z.literal("EquipmentModel"),
        id: z.number().nullable(),
    }),
});

export const D4HEquipmentItem = {
    schema: d4HEquipmentItemBase.extend({
        kind: z.object({
            resourceType: z.literal("EquipmentKind"),
            id: z.number(),
            title: z.string(),
        }),
        parents: z.array(d4HEquipmentItemBase).nullable(),
    }),
} as const;

export type D4HEquipmentItem = z.infer<typeof D4HEquipmentItem.schema>;
