/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import {
    I3Template as I3TemplateRecord,
    I3Template_D4H as I3Template_D4HRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { recordStatusSchema, zodNanoId16, zodTmplString } from "../validation";

export const I3TemplateId = {
    schema: zodNanoId16("I3TemplateId expected").brand<"I3TemplateId">(),

    create: () => I3TemplateId.schema.parse(nanoId16()),
} as const;

export type I3TemplateId = string & z.BRAND<"I3TemplateId">;

const i3TemplateSchema = z.object({
    id: I3TemplateId.schema,
    organizationId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    d4h: z
        .object({
            categoryId: z.number(),
            categoryTitle: z.string(),
            kindId: z.number(),
            kindTitle: z.string(),
            outputRefFormat: zodTmplString({
                categoryName: "",
                kindTitle: "",
                brandTitle: "",
                modelTitle: "",
                teamPrefix: "",
                memberRef: "",
            }),
        })
        .nullable(),
    status: recordStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const I3Template = {
    schema: i3TemplateSchema,

    modifiableSchema: i3TemplateSchema.pick({
        name: true,
        description: true,
        d4h: true,
    }),

    fromRecord: (
        record: I3TemplateRecord & { d4h: I3Template_D4HRecord | null },
    ): I3Template => {
        return i3TemplateSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        });
    },
};

export type I3Template = z.infer<typeof i3TemplateSchema>;

export type ModifiableI3Template = z.infer<typeof I3Template.modifiableSchema>;
