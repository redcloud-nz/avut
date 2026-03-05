/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { D4hPPETemplate as D4hPpeTemplateRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

export const D4hPpeTemplateId = {
    schema: zodNanoId16(
        "D4hPpeTemplateId expected",
    ).brand<"D4hPpeTemplateId">(),

    create: () => D4hPpeTemplateId.schema.parse(nanoId16()),
} as const;

export type D4hPpeTemplateId = string & z.BRAND<"D4hPpeTemplateId">;

const d4hPpeTemplateSchema = z.object({
    id: D4hPpeTemplateId.schema,
    organizationId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    d4hCategoryId: z.number(),
    d4hKindId: z.number(),
    d4hModelIds: z.array(z.number()),
    active: z.boolean().default(true),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    updatedAt: z.iso.datetime().default(() => new Date().toISOString()),
});

export const D4hPpeTemplate = {
    schema: d4hPpeTemplateSchema,

    modifiableSchema: d4hPpeTemplateSchema.pick({
        name: true,
        description: true,
        d4hCategoryId: true,
        d4hKindId: true,
        d4hModelIds: true,
        active: true,
    }),

    fromRecord: (record: D4hPpeTemplateRecord) =>
        d4hPpeTemplateSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        }),
};

export type D4hPpeTemplate = z.infer<typeof d4hPpeTemplateSchema>;

export type ModifiableD4hPpeTemplate = z.infer<
    typeof D4hPpeTemplate.modifiableSchema
>;
