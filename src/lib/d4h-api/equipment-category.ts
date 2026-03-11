/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4HEquipmentCategory = {
    inputSchema: z.object({
        id: z.number(),
        resourceType: z.literal("EquipmentCategory"),

        title: z.string(),
        owner: z.object({
            resourceType: z.enum(["Team", "Organisation"]),
            id: z.number(),
        }),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("EquipmentCategory"),

        title: z.string(),
        owner: z.object({
            resourceType: z.enum(["Team", "Organisation"]),
            id: z.number(),
            title: z.string(),
        }),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),
} as const;

export type D4HEquipmentCategory = z.infer<typeof D4HEquipmentCategory.schema>;
