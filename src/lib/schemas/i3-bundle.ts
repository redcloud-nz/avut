/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { I3Bundle as I3BundleRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { recordStatusSchema, zodNanoId16 } from "../validation";

import { I3BrandModelRule, I3TemplateId } from "./i3-template";

export const I3BundleId = {
    schema: zodNanoId16("I3BundleId expected").brand<"I3BundleId">(),

    create: () => I3BundleId.schema.parse(nanoId16()),
} as const;

export type I3BundleId = string & z.BRAND<"I3BundleId">;

const i3BundleSchema = z.object({
    id: I3BundleId.schema,
    organizationId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    status: recordStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const I3Bundle = {
    schema: i3BundleSchema,

    modifiableSchema: i3BundleSchema.pick({
        name: true,
        description: true,
    }),

    fromRecord: (record: I3BundleRecord): I3Bundle => {
        return i3BundleSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        });
    },
};

export type I3Bundle = z.infer<typeof i3BundleSchema>;

export type ModifiableI3Bundle = z.infer<typeof I3Bundle.modifiableSchema>;

/** A bundle as the list shows it, with the number of its lines that can be compared. */
export const I3BundleSummary = {
    schema: i3BundleSchema.extend({
        /** Lines whose template is Active and has a D4H type. */
        templateCount: z.number(),
    }),
} as const;

export type I3BundleSummary = z.infer<typeof I3BundleSummary.schema>;

export const I3BundleRef = {
    schema: i3BundleSchema.pick({
        id: true,
        name: true,
    }),
} as const;

export type I3BundleRef = z.infer<typeof I3BundleRef.schema>;

/**
 * One line of a bundle: the template it names, with the rules its items are checked against. The
 * template may be soft-deleted or have lost its D4H type; such lines are kept but can't be
 * compared.
 */
const i3BundleLineSchema = z.object({
    template: z.object({
        id: I3TemplateId.schema,
        name: z.string(),
        status: recordStatusSchema,
        d4h: z
            .object({
                categoryId: z.number(),
                categoryTitle: z.string(),
                kindId: z.number(),
                kindTitle: z.string(),
                requireSN: z.boolean(),
                brandModelRule: I3BrandModelRule.schema,
            })
            .nullable(),
        /** The brand/model pairs of the template's variants that have D4H records. */
        variants: z.array(z.object({ brandId: z.number(), modelId: z.number() })),
    }),
});

export const I3BundleLine = {
    schema: i3BundleLineSchema,
} as const;

export type I3BundleLine = z.infer<typeof i3BundleLineSchema>;
