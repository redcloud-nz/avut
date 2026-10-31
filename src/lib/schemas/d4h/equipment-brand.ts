/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4HEquipmentBrand = {
    inputSchema: z.object({
        id: z.number(),
        resourceType: z.literal("EquipmentBrand"),
        owner: z.object({
            id: z.number(),
            resourceType: z.enum(["Team", "Organisation"]),
        }),
        title: z.string(),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),

    schema: z.object({
        id: z.number(),
        resourceType: z.literal("EquipmentBrand"),
        owner: z.object({
            id: z.number(),
            resourceType: z.enum(["Team", "Organisation"]),
            title: z.string(),
        }),
        title: z.string(),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),
} as const;

export type D4HEquipmentBrand = z.infer<typeof D4HEquipmentBrand.schema>;

export const D4HEquipmentBrandRef = {
    schema: z.object({
        id: z.number(),
        title: z.string(),
    }),
} as const;

export type D4HEquipmentBrandRef = z.infer<typeof D4HEquipmentBrandRef.schema>;
