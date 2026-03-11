/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import {
    I3TemplateVariant as I3TemplateVariantRecord,
    I3TemplateVariant_D4H as I3TemplateVariant_D4HRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

export const I3TemplateVariantId = {
    schema: zodNanoId16(
        "I3TemplateVariantId expected",
    ).brand<"I3TemplateVariantId">(),

    create: () => I3TemplateVariantId.schema.parse(nanoId16()),
} as const;

export type I3TemplateVariantId = string & z.BRAND<"I3TemplateVariantId">;

const i3TemplateVariantSchema = z.object({
    id: I3TemplateVariantId.schema,
    templateId: z.string(),
    name: z.string().min(1).max(100),
    d4h: z
        .object({
            brandId: z.number(),
            brandTitle: z.string(),
            modelId: z.number(),
            modelTitle: z.string(),
        })
        .nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const I3TemplateVariant = {
    schema: i3TemplateVariantSchema,

    modifiableSchema: i3TemplateVariantSchema.pick({
        name: true,
        d4h: true,
    }),

    fromRecord: (
        record: I3TemplateVariantRecord & {
            d4h: I3TemplateVariant_D4HRecord | null;
        },
    ) =>
        i3TemplateVariantSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        }),
};

export type I3TemplateVariant = z.infer<typeof i3TemplateVariantSchema>;

export type ModifiableI3TemplateVariant = z.infer<
    typeof I3TemplateVariant.modifiableSchema
>;
